"""
Database handler module
Handles PostgreSQL database operations for book data
"""

import psycopg2
from psycopg2.extras import execute_values
from psycopg2 import sql
from typing import Dict, List, Optional
import config


class DatabaseHandler:
    """
    Handles all database operations for the book scraper
    Manages connections, inserts, and duplicate checking
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
    
    def create_table_if_not_exists(self):
        """
        Create books table if it doesn't exist
        """
        create_table_query = """
        CREATE TABLE IF NOT EXISTS books (
            book_id VARCHAR(255) PRIMARY KEY,
            name TEXT NOT NULL,
            publisher TEXT,
            author TEXT,
            price NUMERIC(10, 2) DEFAULT 0,
            isbn VARCHAR(20),
            open_library_id VARCHAR(255),
            source_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_isbn ON books(isbn);
        CREATE INDEX IF NOT EXISTS idx_open_library_id ON books(open_library_id);
        """
        
        try:
            self.cursor.execute(create_table_query)
            self.connection.commit()
            print("Books table created/verified successfully")
        except psycopg2.Error as e:
            self.connection.rollback()
            print(f"Error creating table: {e}")
            raise
    
    def book_exists(self, book_id: str, isbn: Optional[str] = None) -> bool:
        """
        Check if a book already exists in the database
        Checks by book_id first, then by ISBN if provided
        """
        try:
            # Check by book_id
            check_query = "SELECT COUNT(*) FROM books WHERE book_id = %s"
            self.cursor.execute(check_query, (book_id,))
            count = self.cursor.fetchone()[0]
            
            if count > 0:
                return True
            
            # Check by ISBN if provided
            if isbn:
                check_query = "SELECT COUNT(*) FROM books WHERE isbn = %s"
                self.cursor.execute(check_query, (isbn,))
                count = self.cursor.fetchone()[0]
                if count > 0:
                    return True
            
            return False
        except psycopg2.Error as e:
            print(f"Error checking if book exists: {e}")
            return False
    
    def insert_book(self, book_data: Dict) -> bool:
        """
        Insert a single book into the database
        Returns True if successful, False otherwise
        """
        # Check if book already exists
        if self.book_exists(book_data["book_id"], book_data.get("isbn")):
            return False  # Book already exists, skip
        
        insert_query = """
        INSERT INTO books (
            book_id, name, publisher, author, price, 
            isbn, open_library_id, source_url
        ) VALUES (
            %(book_id)s, %(name)s, %(publisher)s, %(author)s, %(price)s,
            %(isbn)s, %(open_library_id)s, %(source_url)s
        )
        """
        
        try:
            self.cursor.execute(insert_query, book_data)
            self.connection.commit()
            return True
        except psycopg2.Error as e:
            self.connection.rollback()
            print(f"Error inserting book {book_data.get('book_id')}: {e}")
            return False
    
    def insert_books_batch(self, books_data: List[Dict]) -> int:
        """
        Insert multiple books in a batch
        Returns number of successfully inserted books
        """
        if not books_data:
            return 0
        
        # Filter out books that already exist
        new_books = []
        for book in books_data:
            if not self.book_exists(book["book_id"], book.get("isbn")):
                new_books.append(book)
        
        if not new_books:
            return 0
        
        insert_query = """
        INSERT INTO books (
            book_id, name, publisher, author, price,
            isbn, open_library_id, source_url
        ) VALUES %s
        ON CONFLICT (book_id) DO NOTHING
        """
        
        # Prepare data for batch insert
        values = [
            (
                book["book_id"],
                book["name"],
                book.get("publisher"),
                book.get("author"),
                book.get("price", 0),
                book.get("isbn"),
                book.get("open_library_id"),
                book.get("source_url")
            )
            for book in new_books
        ]
        
        try:
            execute_values(
                self.cursor,
                insert_query,
                values,
                template=None,
                page_size=100
            )
            self.connection.commit()
            return len(new_books)
        except psycopg2.Error as e:
            self.connection.rollback()
            print(f"Error in batch insert: {e}")
            return 0
    
    def get_book_count(self) -> int:
        """
        Get total number of books in database
        """
        try:
            self.cursor.execute("SELECT COUNT(*) FROM books")
            count = self.cursor.fetchone()[0]
            return count
        except psycopg2.Error as e:
            print(f"Error getting book count: {e}")
            return 0
    
    def get_existing_book_ids(self) -> set:
        """
        Get set of all existing book_ids for quick lookup
        Useful for avoiding duplicate API calls
        """
        try:
            self.cursor.execute("SELECT book_id FROM books")
            book_ids = {row[0] for row in self.cursor.fetchall()}
            return book_ids
        except psycopg2.Error as e:
            print(f"Error getting existing book IDs: {e}")
            return set()

