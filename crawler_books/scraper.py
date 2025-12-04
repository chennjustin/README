"""
Main scraper module for Books.com.tw
Orchestrates the scraping process using all other modules
"""

import time
from typing import Dict, List, Set
from books_com_tw_client import BooksComTwClient
from books_com_tw_parser import BooksComTwParser
from data_processor import BooksComTwDataProcessor
from database_handler import DatabaseHandler
import config


class BooksComTwScraper:
    """
    Main scraper class that coordinates the entire scraping process
    Handles category browsing, data retrieval, processing, and storage
    """
    
    def __init__(self):
        self.client = BooksComTwClient()
        self.parser = BooksComTwParser()
        self.processor = BooksComTwDataProcessor()
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
        # Filter for Books.com.tw IDs
        self.processed_product_ids = {
            id.replace("BOOKS_COM_TW_", "") 
            for id in existing_ids 
            if id.startswith("BOOKS_COM_TW_")
        }
        print(f"Loaded {len(self.processed_product_ids)} existing Books.com.tw books from database")
    
    def collect_book_links_from_search(self) -> List[Dict]:
        """
        Collect book product IDs from search results
        Returns list of product IDs and URLs
        """
        # Check if search keywords are configured
        if not config.SEARCH_KEYWORDS or len(config.SEARCH_KEYWORDS) == 0:
            print("Search keywords not configured. Skipping search phase.")
            return []
        
        print("Starting search phase...")
        book_links = []
        
        books_per_keyword = self.target_count // len(config.SEARCH_KEYWORDS) + 1
        
        for keyword in config.SEARCH_KEYWORDS:
            if len(book_links) >= self.target_count:
                break
                
            print(f"\nSearching for: {keyword}")
            
            page = 1
            books_from_keyword = []
            max_pages = 10  # Limit pages per keyword to avoid too many requests
            
            while len(books_from_keyword) < books_per_keyword and page <= max_pages:
                print(f"  Fetching search results page {page}...")
                
                html = self.client.search_books(keyword, page)
                if not html:
                    print(f"  Failed to fetch page {page}, moving to next keyword")
                    break
                
                # Parse search results page
                books = self.parser.parse_category_listing(html)
                
                if not books:
                    print(f"  No books found on page {page}, moving to next keyword")
                    break
                
                # Filter out already processed books
                new_books = []
                for book in books:
                    product_id = book.get("product_id")
                    if product_id and product_id not in self.processed_product_ids:
                        new_books.append(book)
                        self.processed_product_ids.add(product_id)
                
                books_from_keyword.extend(new_books)
                self.stats["total_fetched"] += len(books)
                
                print(f"  Found {len(new_books)} new books (total for '{keyword}': {len(books_from_keyword)})")
                
                # Check if we've reached the end (no new books found)
                if len(new_books) == 0:
                    print(f"  No new books found, moving to next keyword")
                    break
                
                page += 1
            
            book_links.extend(books_from_keyword)
            print(f"  Collected {len(books_from_keyword)} books from keyword '{keyword}'")
            
            # Check if we have enough books total
            if len(book_links) >= self.target_count:
                print(f"\nReached target count of {self.target_count} books")
                break
        
        print(f"\nSearch phase complete. Collected {len(book_links)} book links")
        return book_links[:self.target_count]
    
    def collect_book_links_from_categories(self) -> List[Dict]:
        """
        Collect book product IDs from category pages (optional, if category URLs are provided)
        Returns list of product IDs and URLs
        """
        if not config.BOOK_CATEGORIES:
            return []
            
        print("Starting category browsing phase...")
        book_links = []
        
        for category_name, category_url, max_books in config.BOOK_CATEGORIES:
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
            print(f"  Collected {len(books_from_category)} books from {category_name}")
            
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
            product_id = book_link.get("product_id")
            
            if not product_id:
                self.stats["total_skipped"] += 1
                continue
            
            print(f"  [{i}/{total_links}] Fetching details for product {product_id}...")
            
            # Fetch detail page
            html = self.client.get_book_detail_page(product_id)
            if not html:
                print(f"    Failed to fetch detail page")
                self.stats["total_failed"] += 1
                continue
            
            # Parse detail page
            raw_data = self.parser.parse_book_detail(html, product_id)
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
        print("Books.com.tw Book Scraper")
        print("=" * 60)
        print(f"Target: {self.target_count} books\n")
        
        try:
            # Initialize database
            self.initialize_database()
            
            # Collect book links - try categories first, then use search
            book_links = self.collect_book_links_from_categories()
            
            # If category browsing didn't yield enough books, use search (if configured)
            if len(book_links) < self.target_count:
                remaining = self.target_count - len(book_links)
                print(f"\nCategory browsing collected {len(book_links)} books.")
                if config.SEARCH_KEYWORDS and len(config.SEARCH_KEYWORDS) > 0:
                    print(f"Using search to collect remaining {remaining} books...")
                    search_links = self.collect_book_links_from_search()
                    book_links.extend(search_links)
                    book_links = book_links[:self.target_count]
                else:
                    print(f"Search keywords not configured. Collected {len(book_links)} books from categories only.")
            elif len(book_links) == 0:
                # If no categories configured, use search (if configured)
                if config.SEARCH_KEYWORDS and len(config.SEARCH_KEYWORDS) > 0:
                    print("No category URLs configured. Using search strategy...")
                    book_links = self.collect_book_links_from_search()
                else:
                    print("No category URLs configured and no search keywords provided. Cannot collect books.")
            
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

