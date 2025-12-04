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
    
    def process_book_data(self, book: Dict, sequence_number: int, valid_publishers: List[str] = None) -> Dict:
        """
        Process and complete missing fields in book data
        Returns processed book dictionary with all required fields
        book_id is formatted as 8-digit integer starting from 00000000
        """
        # Format book_id as 8-digit integer (zero-padded)
        book_id = f"{sequence_number:08d}"
        
        # Handle publisher field
        publisher = book.get('publisher') or "Unknown Publisher"
        if publisher == "新功能介紹":
            # Replace "新功能介紹" with a random valid publisher
            if valid_publishers and len(valid_publishers) > 0:
                publisher = random.choice(valid_publishers)
            else:
                publisher = "Unknown Publisher"
        
        # Replace publisher if it exceeds 50 characters
        if len(publisher) > 50:
            if valid_publishers and len(valid_publishers) > 0:
                publisher = random.choice(valid_publishers)
            else:
                publisher = "Unknown Publisher"
        
        # Handle author field - keep only first author if multiple authors exist
        author = book.get('author') or "Unknown Author"
        author = self._process_author(author)
        
        # Handle book name - remove supplementary information
        book_name = book.get('name') or f"Unknown Book {book_id}"
        book_name = self._process_book_name(book_name)
        
        processed = {
            'book_id': book_id,
            'name': book_name,
            'author': author,
            'publisher': publisher,
            'price': self._process_price(book.get('price'), book_id)
        }
        
        return processed
    
    def _process_author(self, author: str) -> str:
        """
        Process author field to keep only first author if multiple authors exist
        Handles separators like "、", ",", and keywords like "合著", "等", "編著", "譯者"
        """
        if not author or not author.strip():
            return "Unknown Author"
        
        author = author.strip()
        
        # Check for keywords that indicate multiple authors
        keywords_to_remove = ["合著", "等", "編著", "譯者", "◎"]
        for keyword in keywords_to_remove:
            if keyword in author:
                # Remove everything from the keyword onwards
                index = author.find(keyword)
                author = author[:index].strip()
        
        # Check for common separators
        separators = ["、", ",", "，", "/", "／"]
        for separator in separators:
            if separator in author:
                # Keep only the first author before the separator
                parts = author.split(separator, 1)
                author = parts[0].strip()
                break
        
        return author if author else "Unknown Author"
    
    def _process_book_name(self, name: str) -> str:
        """
        Remove supplementary information from book name
        Removes content in brackets [], parentheses (), and other supplementary text
        """
        if not name or not name.strip():
            return name
        
        import re
        
        # Remove content in 【】 brackets (Chinese brackets) - most common pattern
        name = re.sub(r'【[^】]*】', '', name)
        
        # Remove content in （） parentheses (Chinese parentheses)
        name = re.sub(r'（[^）]*）', '', name)
        
        # Remove content in () parentheses (English parentheses)
        name = re.sub(r'\([^)]*\)', '', name)
        
        # Remove content in [] brackets (English brackets)
        name = re.sub(r'\[[^\]]*\]', '', name)
        
        # Remove content in 「」 quotes (Chinese quotes)
        name = re.sub(r'「[^」]*」', '', name)
        
        # Remove content in 『』 quotes (Chinese double quotes)
        name = re.sub(r'『[^』]*』', '', name)
        
        # Remove content in ~ ~ (tildes)
        name = re.sub(r'~[^~]*~', '', name)
        
        # Remove standalone version indicators at the end (but keep numbers that are part of title)
        # Pattern: (2版), (二版), (全新第2版), etc. but only if standalone
        name = re.sub(r'\s*[（(]\s*[全新增修修訂]*[第]?[0-9一二三四五六七八九十]+[版版本]\s*[）)]\s*$', '', name)
        
        # Remove trailing colons and their content (supplementary descriptions)
        name = re.sub(r'：.*$', '', name)
        
        # Clean up multiple spaces and trim
        name = re.sub(r'\s+', ' ', name)
        name = name.strip()
        
        # Remove trailing punctuation
        name = re.sub(r'[：:、，,。.]+$', '', name)
        name = name.strip()
        
        return name if name else "Unknown Book"
    
    def _process_price(self, price: Optional[float], book_id: str) -> float:
        """
        Process price field based on book_id
        All books (including ESLITE) should have price = original_price * 10%
        Original price is randomly generated between 300-500
        Price is rounded to nearest integer
        """
        # For all books, generate random original price between 300-500
        # Then calculate 10% of original price
        original_price = random.randint(300, 500)
        calculated_price = original_price * 0.1
        # Round to nearest integer
        return round(calculated_price)
    
    def get_valid_publishers(self, books: List[Dict]) -> List[str]:
        """
        Extract all valid publishers from books list
        Excludes "新功能介紹", empty/None publishers, and publishers exceeding 50 characters
        Returns list of unique valid publishers (max 50 characters)
        """
        valid_publishers = set()
        for book in books:
            publisher = book.get('publisher')
            if publisher and publisher.strip() and publisher != "新功能介紹":
                publisher = publisher.strip()
                # Only include publishers with 50 characters or less
                if len(publisher) <= 50:
                    valid_publishers.add(publisher)
        
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
                processed_book = self.process_book_data(book, len(processed_books), valid_publishers)
                processed_books.append(processed_book)
            
            # Filter out books with name > 150 characters or author > 60 characters
            filtered_books = []
            removed_count = 0
            for book in processed_books:
                book_name = book.get('name', '')
                author = book.get('author', '')
                
                if len(book_name) > 150 or len(author) > 60:
                    removed_count += 1
                    continue
                
                filtered_books.append(book)
            
            if removed_count > 0:
                print(f"Removed {removed_count} book(s) with name > 150 chars or author > 60 chars")
                print(f"Before filtering: {len(processed_books)}, After filtering: {len(filtered_books)}")
            
            # Remove duplicates based on book name
            unique_books = self.remove_duplicates_by_name(filtered_books)
            
            # Reassign book_id sequentially after removing duplicates
            for index, book in enumerate(unique_books):
                book['book_id'] = f"{index:08d}"
            
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

