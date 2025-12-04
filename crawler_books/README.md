# Books.com.tw Book Scraper

This project implements a web scraper that collects book data from Books.com.tw (博客來) website and stores it in a PostgreSQL database for a rental bookstore management system.

## Features

- Web scraping of books from Books.com.tw website (target: 500 books)
- Systematic category browsing to collect book links
- HTML parsing to extract book details (title, author, price, publisher)
- Automatic data processing, validation, and cleaning
- PostgreSQL database storage with duplicate prevention
- Real-time progress display
- Error handling with logging and continuation
- Respectful scraping with delays and proper headers

## Requirements

- Python 3.7+
- PostgreSQL 12+
- Internet connection

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Set up PostgreSQL database:
   - Ensure the database `rental_bookstore` exists (or modify `config.py`)
   - The scraper will automatically create the `books` table if it doesn't exist
   - Configure database connection in `config.py`:
     - Update `DB_CONFIG` with your PostgreSQL credentials

## Usage

Run the scraper:
```bash
python main.py
```

The scraper will:
1. Connect to PostgreSQL database
2. Browse book categories systematically
3. Collect book product IDs and URLs from listing pages
4. Fetch detailed information for each book from detail pages
5. Parse and extract book information (title, author, price, publisher, ISBN)
6. Process and validate data
7. Store books in database (skipping duplicates)
8. Display progress and statistics

## Configuration

Edit `config.py` to customize:
- `TARGET_BOOK_COUNT`: Number of books to scrape (default: 500)
- `BATCH_SIZE`: Batch size for processing (default: 20)
- `REQUEST_DELAY`: Base delay between requests in seconds (default: 2.5)
- `RANDOM_DELAY_RANGE`: Random delay range to avoid pattern detection (default: 1.0-3.0 seconds)
- `BOOK_CATEGORIES`: List of categories to browse with category codes and limits
- Database connection settings

## Project Structure

- `main.py`: Entry point
- `scraper.py`: Main scraper orchestration logic
- `books_com_tw_client.py`: Books.com.tw website client for HTTP requests
- `books_com_tw_parser.py`: HTML parser for extracting book data
- `data_processor.py`: Data transformation and validation
- `database_handler.py`: PostgreSQL database operations
- `config.py`: Configuration settings

## Database Schema

The scraper uses the same `books` table as the Open Library scraper:
- `book_id`: Primary key (format: `BOOKS_COM_TW_{product_id}`)
- `name`: Book title
- `publisher`: Publisher name
- `author`: Author name
- `price`: Price (extracted from website)
- `isbn`: ISBN number (if available)
- `open_library_id`: NULL for Books.com.tw books
- `source_url`: Book detail page URL
- `created_at`: Creation timestamp
- `updated_at`: Update timestamp

## Data Extraction

The scraper extracts the following information from Books.com.tw:
- **Book Title**: Extracted from page title or heading
- **Author**: Extracted from author section
- **Price**: Parsed from price display (handles various formats)
- **Publisher**: Extracted from publisher information
- **ISBN**: Extracted from metadata or page content (if available)

## Notes

- The scraper includes delays between requests to be respectful to the server
- Duplicate books are automatically skipped based on `book_id` or `isbn`
- Failed requests are logged and the scraper continues processing
- HTML structure may change over time; parser may need updates
- Ensure compliance with Books.com.tw terms of service
- The scraper uses proper User-Agent headers and session management

## Troubleshooting

### Common Issues

1. **Connection errors**: Check internet connection and database credentials
2. **Parsing failures**: Books.com.tw HTML structure may have changed; update parser selectors
3. **Rate limiting**: Increase `REQUEST_DELAY` in `config.py` if getting blocked
4. **Database errors**: Verify PostgreSQL is running and credentials are correct

### Debugging

Enable verbose output by modifying the scraper to print more details, or check the console output for error messages during scraping.

