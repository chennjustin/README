"""
View scraped book data from the database
Simple script to query and display books stored in the database
"""

from database_handler import DatabaseHandler


def _format_text(text, max_length):
    """
    Format text with truncation if needed
    """
    if not text:
        return "N/A"
    text_str = str(text)
    if len(text_str) > max_length:
        return text_str[:max_length-3] + "..."
    return text_str


def _print_table(rows, headers, col_widths):
    """
    Print a simple formatted table without external dependencies
    """
    # Print header
    header_line = " | ".join(h.ljust(w) for h, w in zip(headers, col_widths))
    print(header_line)
    print("-" * len(header_line))
    
    # Print rows
    for row in rows:
        row_line = " | ".join(str(cell).ljust(w) for cell, w in zip(row, col_widths))
        print(row_line)
    print()


def view_all_books(limit: int = None):
    """
    Display all books from the database in a formatted table
    """
    db_handler = DatabaseHandler()
    
    try:
        db_handler.connect()
        
        # Get total count
        total_count = db_handler.get_book_count()
        print(f"\n{'='*100}")
        print(f"Total books in database: {total_count}")
        print(f"{'='*100}\n")
        
        # Build query
        if limit:
            query = f"SELECT book_id, name, author, publisher, isbn, price, created_at FROM books ORDER BY created_at DESC LIMIT {limit}"
        else:
            query = "SELECT book_id, name, author, publisher, isbn, price, created_at FROM books ORDER BY created_at DESC"
        
        db_handler.cursor.execute(query)
        books = db_handler.cursor.fetchall()
        
        if not books:
            print("No books found in database.")
            return
        
        # Format data for display
        headers = ["Book ID", "Name", "Author", "Publisher", "ISBN", "Price", "Created At"]
        col_widths = [25, 45, 30, 25, 15, 10, 20]
        rows = []
        
        for book in books:
            rows.append([
                _format_text(book[0], 25),
                _format_text(book[1], 45),
                _format_text(book[2], 30),
                _format_text(book[3], 25),
                _format_text(book[4], 15),
                f"${book[5]:.2f}" if book[5] else "$0.00",
                book[6].strftime("%Y-%m-%d %H:%M") if book[6] else "N/A"
            ])
        
        _print_table(rows, headers, col_widths)
        print(f"\nShowing {len(books)} book(s)")
        
    except Exception as e:
        print(f"Error viewing books: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db_handler.disconnect()


def view_statistics():
    """
    Display statistics about the books in the database
    """
    db_handler = DatabaseHandler()
    
    try:
        db_handler.connect()
        
        # Get various statistics
        db_handler.cursor.execute("SELECT COUNT(*) FROM books")
        total_books = db_handler.cursor.fetchone()[0]
        
        db_handler.cursor.execute("SELECT COUNT(DISTINCT author) FROM books WHERE author IS NOT NULL")
        unique_authors = db_handler.cursor.fetchone()[0]
        
        db_handler.cursor.execute("SELECT COUNT(DISTINCT publisher) FROM books WHERE publisher IS NOT NULL")
        unique_publishers = db_handler.cursor.fetchone()[0]
        
        db_handler.cursor.execute("SELECT COUNT(*) FROM books WHERE isbn IS NOT NULL")
        books_with_isbn = db_handler.cursor.fetchone()[0]
        
        db_handler.cursor.execute("SELECT name, author FROM books ORDER BY created_at DESC LIMIT 5")
        recent_books = db_handler.cursor.fetchall()
        
        print(f"\n{'='*70}")
        print("Database Statistics")
        print(f"{'='*70}")
        print(f"Total books: {total_books}")
        print(f"Unique authors: {unique_authors}")
        print(f"Unique publishers: {unique_publishers}")
        print(f"Books with ISBN: {books_with_isbn}")
        
        print(f"\n{'='*70}")
        print("5 Most Recent Books")
        print(f"{'='*70}")
        for i, (name, author) in enumerate(recent_books, 1):
            print(f"\n{i}. {_format_text(name, 70)}")
            if author:
                print(f"   by {author}")
        
        print()
        
    except Exception as e:
        print(f"Error viewing statistics: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db_handler.disconnect()


def search_books(keyword: str):
    """
    Search for books by keyword (searches in name, author, publisher)
    """
    db_handler = DatabaseHandler()
    
    try:
        db_handler.connect()
        
        search_query = """
            SELECT book_id, name, author, publisher, isbn, price
            FROM books
            WHERE LOWER(name) LIKE LOWER(%s)
               OR LOWER(author) LIKE LOWER(%s)
               OR LOWER(publisher) LIKE LOWER(%s)
            ORDER BY name
            LIMIT 50
        """
        
        search_pattern = f"%{keyword}%"
        db_handler.cursor.execute(search_query, (search_pattern, search_pattern, search_pattern))
        books = db_handler.cursor.fetchall()
        
        if not books:
            print(f"\nNo books found matching '{keyword}'")
            return
        
        print(f"\n{'='*100}")
        print(f"Search results for '{keyword}': {len(books)} book(s) found")
        print(f"{'='*100}\n")
        
        headers = ["Book ID", "Name", "Author", "Publisher", "ISBN", "Price"]
        col_widths = [25, 50, 30, 25, 15, 10]
        rows = []
        
        for book in books:
            rows.append([
                _format_text(book[0], 25),
                _format_text(book[1], 50),
                _format_text(book[2], 30),
                _format_text(book[3], 25),
                _format_text(book[4], 15),
                f"${book[5]:.2f}" if book[5] else "$0.00"
            ])
        
        _print_table(rows, headers, col_widths)
        print(f"Showing {len(books)} result(s)")
        
    except Exception as e:
        print(f"Error searching books: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db_handler.disconnect()


def main():
    """
    Main function to provide interactive menu
    """
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        
        if command == "stats" or command == "statistics":
            view_statistics()
        elif command == "search" and len(sys.argv) > 2:
            keyword = " ".join(sys.argv[2:])
            search_books(keyword)
        elif command.isdigit():
            limit = int(command)
            view_all_books(limit)
        else:
            print(f"Unknown command: {command}")
            print_usage()
    else:
        # Default: show first 20 books
        view_all_books(20)


def print_usage():
    """
    Print usage information
    """
    print("\nUsage:")
    print("  python view_data.py              - Show first 20 books")
    print("  python view_data.py <number>     - Show first N books")
    print("  python view_data.py stats        - Show statistics")
    print("  python view_data.py search <keyword> - Search for books")
    print("\nExamples:")
    print("  python view_data.py 50")
    print("  python view_data.py stats")
    print("  python view_data.py search 'Harry Potter'")
    print("  python view_data.py search 'Python'")


if __name__ == "__main__":
    main()
