"""
Export books data from database to CSV file
Processes and completes missing fields before export
"""

import psycopg2
import csv
import random
from typing import List, Dict, Optional
import sys
import os

# Add crawler_openlib to path to import config
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'crawler_openlib'))
import config


class BookExporter:
    """
    Handles exporting books data from database to CSV
    Processes missing fields and ensures data completeness
    """
    
    def __init__(self):
        self.db_config = config.DB_CONFIG
        self.connection = None
        self.cursor = None
    
    def connect(self):
        """
        Establish connection to PostgreSQL database
        """
        try:
            self.connection = psycopg2.connect(
                host=self.db_config["host"],
                port=self.db_config["port"],
                database=self.db_config["database"],
                user=self.db_config["user"],
                password=self.db_config["password"]
            )
            self.cursor = self.connection.cursor()
            print("Database connection established successfully")
        except psycopg2.Error as e:
            print(f"Error connecting to database: {e}")
            raise
    
    def disconnect(self):
        """
        Close database connection
        """
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()
        print("Database connection closed")
    
    def fetch_all_books(self) -> List[Dict]:
        """
        Fetch all books from database
        Returns list of book dictionaries
        """
        try:
            query = """
                SELECT book_id, name, author, publisher, price
                FROM books
                ORDER BY book_id
            """
            self.cursor.execute(query)
            rows = self.cursor.fetchall()
            
            books = []
            for row in rows:
                books.append({
                    'book_id': row[0],
                    'name': row[1],
                    'author': row[2],
                    'publisher': row[3],
                    'price': row[4]
                })
            
            print(f"Fetched {len(books)} books from database")
            return books
        except psycopg2.Error as e:
            print(f"Error fetching books: {e}")
            raise
    
    def process_book_data(self, book: Dict, valid_publishers: List[str] = None) -> Dict:
        """
        Process and complete missing fields in book data
        Returns processed book dictionary with all required fields
        """
        book_id = book.get('book_id') or f"BOOK_{random.randint(10000, 99999)}"
        
        # Handle publisher field
        publisher = book.get('publisher') or "Unknown Publisher"
        if publisher == "新功能介紹":
            # Replace "新功能介紹" with a random valid publisher
            if valid_publishers and len(valid_publishers) > 0:
                publisher = random.choice(valid_publishers)
            else:
                publisher = "Unknown Publisher"
        
        processed = {
            'book_id': book_id,
            'name': book.get('name') or f"Unknown Book {book_id}",
            'author': book.get('author') or "Unknown Author",
            'publisher': publisher,
            'price': self._process_price(book.get('price'), book_id)
        }
        
        return processed
    
    def _process_price(self, price: Optional[float], book_id: str) -> float:
        """
        Process price field based on book_id
        All books (including ESLITE) should have price = original_price * 10%
        Original price is randomly generated between 300-500
        """
        # For all books, generate random original price between 300-500
        # Then calculate 10% of original price
        original_price = random.randint(300, 500)
        calculated_price = original_price * 0.1
        return round(calculated_price, 2)
    
    def get_valid_publishers(self, books: List[Dict]) -> List[str]:
        """
        Extract all valid publishers from books list
        Excludes "新功能介紹" and empty/None publishers
        Returns list of unique valid publishers
        """
        valid_publishers = set()
        for book in books:
            publisher = book.get('publisher')
            if publisher and publisher.strip() and publisher != "新功能介紹":
                valid_publishers.add(publisher.strip())
        
        return list(valid_publishers)
    
    def remove_duplicates_by_name(self, books: List[Dict]) -> List[Dict]:
        """
        Remove duplicate books based on book name
        Keeps the first occurrence of each book name
        Returns deduplicated list of books
        """
        seen_names = {}
        unique_books = []
        duplicates_count = 0
        
        for book in books:
            book_name = book.get('name', '').strip()
            
            # Normalize book name for comparison (lowercase and remove extra spaces)
            normalized_name = ' '.join(book_name.lower().split())
            
            if normalized_name and normalized_name not in seen_names:
                # First occurrence of this book name, keep it
                seen_names[normalized_name] = True
                unique_books.append(book)
            elif normalized_name:
                # Duplicate book name, skip it
                duplicates_count += 1
        
        if duplicates_count > 0:
            print(f"Removed {duplicates_count} duplicate book(s) based on name")
            print(f"Original count: {len(books)}, Unique count: {len(unique_books)}")
        
        return unique_books
    
    def export_to_csv(self, books: List[Dict], output_file: str = "book.csv"):
        """
        Export books data to CSV file
        Includes only required fields: book_id, name, author, publisher, price
        """
        if not books:
            print("No books to export")
            return
        
        # Required fields in order
        fieldnames = ['book_id', 'name', 'author', 'publisher', 'price']
        
        try:
            with open(output_file, 'w', newline='', encoding='utf-8-sig') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                
                # Write header
                writer.writeheader()
                
                # Write data rows
                for book in books:
                    row = {
                        'book_id': book['book_id'],
                        'name': book['name'],
                        'author': book['author'],
                        'publisher': book['publisher'],
                        'price': book['price']
                    }
                    writer.writerow(row)
            
            print(f"Successfully exported {len(books)} books to {output_file}")
        except Exception as e:
            print(f"Error exporting to CSV: {e}")
            raise
    
    def run(self, output_file: str = "book.csv"):
        """
        Main execution method
        Connects to database, processes data, and exports to CSV
        """
        try:
            # Connect to database
            self.connect()
            
            # Fetch all books
            books = self.fetch_all_books()
            
            if not books:
                print("No books found in database")
                return
            
            # Get valid publishers list (excluding "新功能介紹")
            valid_publishers = self.get_valid_publishers(books)
            print(f"Found {len(valid_publishers)} valid publishers")
            
            # Process each book
            processed_books = []
            for book in books:
                processed_book = self.process_book_data(book, valid_publishers)
                processed_books.append(processed_book)
            
            # Remove duplicates based on book name
            unique_books = self.remove_duplicates_by_name(processed_books)
            
            # Export to CSV
            self.export_to_csv(unique_books, output_file)
            
            print(f"\nExport completed successfully!")
            print(f"Output file: {output_file}")
            print(f"Total books exported: {len(unique_books)}")
            
        except Exception as e:
            print(f"Error during export process: {e}")
            import traceback
            traceback.print_exc()
        finally:
            self.disconnect()


def main():
    """
    Main function
    """
    exporter = BookExporter()
    exporter.run("book.csv")


if __name__ == "__main__":
    main()

