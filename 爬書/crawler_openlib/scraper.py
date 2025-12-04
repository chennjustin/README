"""
Main scraper module
Orchestrates the scraping process using all other modules
"""

import time
from typing import Dict, List, Set, Optional
from open_library_client import OpenLibraryClient
from data_processor import DataProcessor
from database_handler import DatabaseHandler
from search_strategy import SearchStrategy
import config


class BookScraper:
    """
    Main scraper class that coordinates the entire scraping process
    Handles search, data retrieval, processing, and storage
    """
    
    def __init__(self):
        self.client = OpenLibraryClient()
        self.processor = DataProcessor()
        self.db_handler = DatabaseHandler()
        self.strategy = SearchStrategy()
        self.target_count = config.TARGET_BOOK_COUNT
        self.batch_size = config.BATCH_SIZE
        self.search_limit = config.SEARCH_LIMIT
        
        # Statistics tracking
        self.stats = {
            "total_searched": 0,
            "total_processed": 0,
            "total_inserted": 0,
            "total_failed": 0,
            "total_duplicates": 0
        }
        
        # Track processed book IDs to avoid duplicates
        self.processed_book_ids: Set[str] = set()
        self.processed_isbns: Set[str] = set()
    
    def initialize_database(self):
        """
        Initialize database connection and create table
        """
        print("Initializing database...")
        self.db_handler.connect()
        self.db_handler.create_table_if_not_exists()
        
        # Load existing book IDs to avoid duplicates
        self.processed_book_ids = self.db_handler.get_existing_book_ids()
        print(f"Loaded {len(self.processed_book_ids)} existing books from database")
    
    def search_and_collect_books(self) -> List[Dict]:
        """
        Search for books using all strategies and collect identifiers
        Returns list of book identifiers (ISBNs or keys)
        """
        print("Starting search phase...")
        all_queries = self.strategy.get_all_queries()
        book_identifiers = []
        
        for i, query_info in enumerate(all_queries, 1):
            query_type = query_info["type"]
            query_value = query_info["value"]
            query_string = query_info["query"]
            
            print(f"\n[{i}/{len(all_queries)}] Searching: {query_type} - {query_value}")
            
            # Search with pagination
            offset = 0
            books_from_query = []
            
            while len(books_from_query) < self._get_limit_for_query_type(query_type):
                search_result = self.client.search_books(
                    query_string,
                    limit=self.search_limit,
                    offset=offset
                )
                
                if not search_result:
                    print(f"  No results or error for query: {query_value}")
                    break
                
                # Process search results
                identifiers = self.processor.process_search_result(search_result)
                
                # Filter out already processed books
                new_identifiers = []
                for identifier in identifiers:
                    isbn = identifier.get("isbn")
                    key = identifier.get("value")
                    
                    # Check if already processed
                    if isbn and isbn in self.processed_isbns:
                        continue
                    if key and key in self.processed_book_ids:
                        continue
                    
                    new_identifiers.append(identifier)
                    if isbn:
                        self.processed_isbns.add(isbn)
                    if key:
                        self.processed_book_ids.add(key)
                
                books_from_query.extend(new_identifiers)
                self.stats["total_searched"] += len(identifiers)
                
                # Check if we have enough results
                if len(books_from_query) >= self._get_limit_for_query_type(query_type):
                    break
                
                # Check if there are more results
                # API may return numFound or num_found (handle both formats)
                num_found = search_result.get("numFound") or search_result.get("num_found", 0)
                if offset + self.search_limit >= num_found:
                    break
                
                offset += self.search_limit
                print(f"  Found {len(new_identifiers)} new books (total: {len(books_from_query)})")
            
            book_identifiers.extend(books_from_query)
            print(f"  Collected {len(books_from_query)} books from {query_value}")
            
            # Check if we have enough books
            if len(book_identifiers) >= self.target_count:
                print(f"\nReached target count of {self.target_count} books")
                break
        
        print(f"\nSearch phase complete. Collected {len(book_identifiers)} book identifiers")
        return book_identifiers[:self.target_count]  # Limit to target count
    
    def fetch_book_details(self, book_identifiers: List[Dict]) -> List[Dict]:
        """
        Fetch detailed information for collected book identifiers
        Returns list of processed book data
        """
        print("\nStarting detail fetching phase...")
        processed_books = []
        
        # Separate ISBNs and keys for batch processing
        isbns = [item["isbn"] for item in book_identifiers if item.get("isbn")]
        keys = [item["value"] for item in book_identifiers if item.get("type") == "key"]
        
        # Process ISBNs in batches
        if isbns:
            print(f"Processing {len(isbns)} books by ISBN...")
            for i in range(0, len(isbns), self.batch_size):
                batch_isbns = isbns[i:i + self.batch_size]
                print(f"  Batch {i//self.batch_size + 1}: Processing {len(batch_isbns)} ISBNs...")
                
                books_data = self.client.get_books_by_isbns(batch_isbns)
                
                for isbn, book_data in books_data.items():
                    if book_data:
                        # Get author details if author only has key
                        author_details_cache = {}
                        if "authors" in book_data:
                            authors = book_data["authors"] if isinstance(book_data["authors"], list) else []
                            for author in authors:
                                if isinstance(author, dict) and "key" in author:
                                    author_key = author["key"]
                                    if author_key and "/authors/" in author_key:
                                        # Fetch author details
                                        author_details = self.client.get_author_details(author_key)
                                        if author_details and "name" in author_details:
                                            author_details_cache[author_key] = author_details["name"]
                        
                        processed = self.processor.process_book_data(book_data, isbn, author_details_cache)
                        if processed:
                            processed["source_url"] = f"{config.OPEN_LIBRARY_BOOKS_URL}?bibkeys=ISBN:{isbn}"
                            processed_books.append(processed)
                            self.stats["total_processed"] += 1
                        else:
                            self.stats["total_failed"] += 1
                    else:
                        self.stats["total_failed"] += 1
                
                self._print_progress(len(processed_books), len(book_identifiers))
        
        # Process keys (Open Library IDs)
        if keys:
            print(f"\nProcessing {len(keys)} books by Open Library ID...")
            for i, key in enumerate(keys, 1):
                if i % 50 == 0:
                    print(f"  Processed {i}/{len(keys)} books...")
                
                # Try to get work details first
                if "/works/" in key:
                    work_data = self.client.get_work_details(key)
                    if work_data:
                        # Try to get a specific edition for complete information
                        edition_data = self.client.get_edition_from_work(work_data)
                        
                        # Use edition data if available, otherwise fall back to work data
                        book_data = edition_data if edition_data else work_data
                        
                        # Merge work and edition data to get complete information
                        # Edition has publisher and detailed author info, work has title
                        if edition_data and work_data:
                            # Prefer edition data but keep work title if edition doesn't have it
                            if "title" not in edition_data and "title" in work_data:
                                book_data = {**edition_data, "title": work_data["title"]}
                            else:
                                book_data = edition_data
                        
                        # Get author details if author only has key
                        author_details_cache = {}
                        if "authors" in book_data:
                            authors = book_data["authors"] if isinstance(book_data["authors"], list) else []
                            for author in authors:
                                if isinstance(author, dict) and "key" in author:
                                    author_key = author["key"]
                                    if author_key and "/authors/" in author_key:
                                        # Fetch author details
                                        author_details = self.client.get_author_details(author_key)
                                        if author_details and "name" in author_details:
                                            author_details_cache[author_key] = author_details["name"]
                        
                        processed = self.processor.process_book_data(book_data, None, author_details_cache)
                        if processed:
                            # Build proper source URL by removing leading slash if present
                            clean_key = key.lstrip("/")
                            processed["source_url"] = f"{config.OPEN_LIBRARY_WORKS_URL}/{clean_key}"
                            processed_books.append(processed)
                            self.stats["total_processed"] += 1
                            continue
                
                # Fallback to book details
                book_data = self.client.get_book_details(key)
                if book_data:
                    # Get author details if author only has key
                    author_details_cache = {}
                    if "authors" in book_data:
                        authors = book_data["authors"] if isinstance(book_data["authors"], list) else []
                        for author in authors:
                            if isinstance(author, dict) and "key" in author:
                                author_key = author["key"]
                                if author_key and "/authors/" in author_key:
                                    # Fetch author details
                                    author_details = self.client.get_author_details(author_key)
                                    if author_details and "name" in author_details:
                                        author_details_cache[author_key] = author_details["name"]
                    
                    processed = self.processor.process_book_data(book_data, None, author_details_cache)
                    if processed:
                        # Build proper source URL by removing leading slash if present
                        clean_key = key.lstrip("/")
                        processed["source_url"] = f"{config.OPEN_LIBRARY_BOOKS_DETAIL_URL}/{clean_key}"
                        processed_books.append(processed)
                        self.stats["total_processed"] += 1
                    else:
                        self.stats["total_failed"] += 1
                else:
                    self.stats["total_failed"] += 1
                
                if i % 10 == 0:
                    self._print_progress(len(processed_books), len(book_identifiers))
        
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
        print("Open Library Book Scraper")
        print("=" * 60)
        print(f"Target: {self.target_count} books\n")
        
        try:
            # Initialize database
            self.initialize_database()
            
            # Search and collect book identifiers
            book_identifiers = self.search_and_collect_books()
            
            if not book_identifiers:
                print("No books found. Exiting.")
                return
            
            # Fetch detailed information
            books_data = self.fetch_book_details(book_identifiers)
            
            if not books_data:
                print("No book data processed. Exiting.")
                return
            
            # Save to database
            self.save_books_to_database(books_data)
            
            # Print final statistics
            self._print_final_stats()
            
        except Exception as e:
            print(f"\nError during scraping: {e}")
            raise
        finally:
            # Close database connection
            if self.db_handler.connection:
                self.db_handler.disconnect()
    
    def _get_limit_for_query_type(self, query_type: str) -> int:
        """
        Get the limit for number of books to fetch per query type
        """
        if query_type == "subject":
            return config.SUBJECTS_PER_CATEGORY
        elif query_type == "author":
            return config.AUTHORS_PER_AUTHOR
        elif query_type == "keyword":
            return config.KEYWORDS_PER_QUERY
        return 50  # Default limit
    
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
        print(f"Total books searched: {self.stats['total_searched']}")
        print(f"Total books processed: {self.stats['total_processed']}")
        print(f"Total books inserted: {self.stats['total_inserted']}")
        print(f"Total duplicates skipped: {self.stats['total_duplicates']}")
        print(f"Total failed: {self.stats['total_failed']}")
        print("=" * 60)

