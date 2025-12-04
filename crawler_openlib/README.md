# Rental Bookstore Management System - Book Scraper

This project implements a book scraper that collects book data from Open Library API and stores it in a PostgreSQL database for a rental bookstore management system.

## Features

- Bulk scraping of books from Open Library API (target: 500 books)
- Mixed search strategy using subjects, authors, and keywords
- Automatic data processing, validation, and cleaning
- PostgreSQL database storage with duplicate prevention
- Real-time progress display
- Error handling with logging and continuation

## Requirements

- Python 3.7+
- PostgreSQL 12+

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Set up PostgreSQL database:
   - Create a database named `rental_bookstore` (or modify `config.py`)
   - Run the initialization script:
```bash
psql -U postgres -d rental_bookstore -f init_database.sql
```

3. Configure database connection in `config.py`:
   - Update `DB_CONFIG` with your PostgreSQL credentials

## Usage

Run the scraper:
```bash
python main.py
```

The scraper will:
1. Connect to PostgreSQL database
2. Search for books using mixed strategy (subjects, authors, keywords)
3. Collect book identifiers (ISBNs and Open Library IDs)
4. Fetch detailed information for each book
5. Process and validate data
6. Store books in database (skipping duplicates)
7. Display progress and statistics

## Configuration

Edit `config.py` to customize:
- `TARGET_BOOK_COUNT`: Number of books to scrape (default: 500)
- `BATCH_SIZE`: Batch size for processing (default: 50)
- `REQUEST_DELAY`: Delay between API requests in seconds (default: 1.5)
- Database connection settings
- Search strategy limits

## Project Structure

- `main.py`: Entry point
- `scraper.py`: Main scraper orchestration logic
- `open_library_client.py`: Open Library API client
- `data_processor.py`: Data parsing and validation
- `database_handler.py`: PostgreSQL database operations
- `search_strategy.py`: Search query generation
- `config.py`: Configuration settings
- `init_database.sql`: Database initialization script

## Database Schema

The `books` table contains:
- `book_id`: Primary key (Open Library ID)
- `name`: Book title
- `publisher`: Publisher name
- `author`: Author name
- `price`: Price (default: 0)
- `isbn`: ISBN number
- `open_library_id`: Open Library identifier
- `source_url`: API source URL
- `created_at`: Creation timestamp
- `updated_at`: Update timestamp

## Notes

- Open Library API does not provide price information, so price defaults to 0
- The scraper respects API rate limits with request delays
- Duplicate books are automatically skipped
- Failed requests are logged and the scraper continues processing

