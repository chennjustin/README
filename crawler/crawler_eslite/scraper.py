"""
Main scraper module for Eslite.com
Orchestrates the scraping process using all other modules
"""

import time
from typing import Dict, List, Set
from eslite_client import EsliteClient
from eslite_parser import EsliteParser
from data_processor import EsliteDataProcessor
from database_handler import DatabaseHandler
import config


class EsliteScraper:
    """
    Main scraper class that coordinates the entire scraping process
    Handles category browsing, data retrieval, processing, and storage
    """
    
    def __init__(self):
        self.client = EsliteClient()
        self.parser = EsliteParser()
        self.processor = EsliteDataProcessor()
        self.db_handler = DatabaseHandler()
        self.target_count = config.TARGET_BOOK_COUNT
        self.batch_size = config.BATCH_SIZE
        
        # Statistics tracking
        self.stats = {
            "total_fetched": 0,
            "total_processed": 0,
            "total_inserted": 0,
            "total_failed": 0,
            "total_duplicates": 0,
            "total_skipped": 0
        }
        
        # Track processed product IDs to avoid duplicates
        self.processed_product_ids: Set[str] = set()
    
    def initialize_database(self):
        """
        Initialize database connection and create table
        """
        print("Initializing database...")
        self.db_handler.connect()
        self.db_handler.create_table_if_not_exists()
        
        # Load existing book IDs to avoid duplicates
        existing_ids = self.db_handler.get_existing_book_ids()
        # Filter for Eslite IDs
        self.processed_product_ids = {
            id.replace("ESLITE_", "") 
            for id in existing_ids 
            if id.startswith("ESLITE_")
        }
        print(f"Loaded {len(self.processed_product_ids)} existing Eslite.com books from database")
    
    def collect_book_links_from_categories(self) -> List[Dict]:
        """
        Collect book links from category pages
        Returns list of book links and basic info
        """
        if not config.ESLITE_CATEGORIES:
            print("No categories configured. Please add category URLs to config.py")
            return []
            
        print("Starting category browsing phase...")
        book_links = []
        
        for category_name, category_url, max_books in config.ESLITE_CATEGORIES:
            print(f"\nBrowsing category: {category_name}")
            
            page = 1
            books_from_category = []
            
            while len(books_from_category) < max_books:
                print(f"  Fetching page {page}...")
                
                html = self.client.get_category_page(category_url, page)
                if not html:
                    print(f"  Failed to fetch page {page}, moving to next category")
                    break
                
                # Parse listing page
                books = self.parser.parse_category_listing(html)
                
                if not books:
                    print(f"  No books found on page {page}, moving to next category")
                    break
                
                # Filter out already processed books
                new_books = []
                for book in books:
                    product_id = book.get("product_id")
                    if product_id and product_id not in self.processed_product_ids:
                        new_books.append(book)
                        self.processed_product_ids.add(product_id)
                
                books_from_category.extend(new_books)
                self.stats["total_fetched"] += len(books)
                
                print(f"  Found {len(new_books)} new books (total in category: {len(books_from_category)})")
                
                # Check if we have enough books from this category
                if len(books_from_category) >= max_books:
                    break
                
                # Check if we've reached the end (no new books found)
                if len(new_books) == 0:
                    print(f"  No new books found, moving to next category")
                    break
                
                page += 1
                
                # Safety limit: don't fetch more than 50 pages per category
                if page > 50:
                    print(f"  Reached page limit for category")
                    break
            
            book_links.extend(books_from_category[:max_books])
            print(f"  Collected {len(books_from_category[:max_books])} books from {category_name}")
            
            # Check if we have enough books total
            if len(book_links) >= self.target_count:
                print(f"\nReached target count of {self.target_count} books")
                break
        
        print(f"\nCategory browsing complete. Collected {len(book_links)} book links")
        return book_links[:self.target_count]
    
    def fetch_and_process_book_details(self, book_links: List[Dict]) -> List[Dict]:
        """
        Fetch detailed information for collected book links
        Returns list of processed book data
        """
        print("\nStarting detail fetching phase...")
        processed_books = []
        
        total_links = len(book_links)
        
        for i, book_link in enumerate(book_links, 1):
            book_url = book_link.get("url")
            product_id = book_link.get("product_id")
            
            if not book_url:
                self.stats["total_skipped"] += 1
                continue
            
            print(f"  [{i}/{total_links}] Fetching details for {product_id or book_url}...")
            
            # Fetch detail page
            html = self.client.get_book_detail_page(book_url)
            if not html:
                print(f"    Failed to fetch detail page")
                self.stats["total_failed"] += 1
                continue
            
            # Parse detail page
            raw_data = self.parser.parse_book_detail(html, book_url)
            if not raw_data:
                print(f"    Failed to parse detail page")
                self.stats["total_failed"] += 1
                continue
            
            # Process data
            processed = self.processor.process_book_data(raw_data)
            if not processed:
                print(f"    Failed to process book data")
                self.stats["total_failed"] += 1
                continue
            
            # Validate data
            if not self.processor.validate_book_data(processed):
                print(f"    Invalid book data")
                self.stats["total_failed"] += 1
                continue
            
            processed_books.append(processed)
            self.stats["total_processed"] += 1
            
            print(f"    Success: {processed['name'][:50]}...")
            
            # Print progress every 10 books
            if i % 10 == 0:
                self._print_progress(len(processed_books), total_links)
        
        print(f"\nDetail fetching complete. Processed {len(processed_books)} books")
        return processed_books
    
    def save_books_to_database(self, books_data: List[Dict]) -> int:
        """
        Save processed books to database
        Returns number of successfully inserted books
        """
        print("\nStarting database insertion phase...")
        
        if not books_data:
            print("No books to insert")
            return 0
        
        # Insert in batches
        total_inserted = 0
        for i in range(0, len(books_data), self.batch_size):
            batch = books_data[i:i + self.batch_size]
            inserted = self.db_handler.insert_books_batch(batch)
            total_inserted += inserted
            self.stats["total_inserted"] += inserted
            self.stats["total_duplicates"] += (len(batch) - inserted)
            
            print(f"  Batch {i//self.batch_size + 1}: Inserted {inserted}/{len(batch)} books")
            self._print_progress(total_inserted, len(books_data))
        
        print(f"\nDatabase insertion complete. Inserted {total_inserted} new books")
        return total_inserted
    
    def run(self):
        """
        Main execution method that runs the complete scraping process
        """
        print("=" * 60)
        print("Eslite.com Book Scraper")
        print("=" * 60)
        print(f"Target: {self.target_count} books")
        print(f"Categories: {len(config.ESLITE_CATEGORIES)}")
        print()
        
        try:
            # Initialize database
            self.initialize_database()
            
            # Collect book links from categories
            book_links = self.collect_book_links_from_categories()
            
            if not book_links:
                print("No book links found. Exiting.")
                return
            
            # Fetch detailed information
            books_data = self.fetch_and_process_book_details(book_links)
            
            if not books_data:
                print("No book data processed. Exiting.")
                return
            
            # Save to database
            self.save_books_to_database(books_data)
            
            # Print final statistics
            self._print_final_stats()
            
        except Exception as e:
            print(f"\nError during scraping: {e}")
            import traceback
            traceback.print_exc()
            raise
        finally:
            # Close connections
            if self.client:
                self.client.close()
            if self.db_handler.connection:
                self.db_handler.disconnect()
    
    def _print_progress(self, current: int, total: int):
        """
        Print progress information
        """
        percentage = (current / total * 100) if total > 0 else 0
        print(f"  Progress: {current}/{total} ({percentage:.1f}%)")
    
    def _print_final_stats(self):
        """
        Print final statistics
        """
        print("\n" + "=" * 60)
        print("Scraping Statistics")
        print("=" * 60)
        print(f"Total links fetched: {self.stats['total_fetched']}")
        print(f"Total books processed: {self.stats['total_processed']}")
        print(f"Total books inserted: {self.stats['total_inserted']}")
        print(f"Total duplicates skipped: {self.stats['total_duplicates']}")
        print(f"Total failed: {self.stats['total_failed']}")
        print(f"Total skipped: {self.stats['total_skipped']}")
        print("=" * 60)

