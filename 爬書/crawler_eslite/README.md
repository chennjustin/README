# Eslite.com Book Scraper

This project implements a web scraper that collects book data from Eslite.com (誠品) website and stores it in a PostgreSQL database for a rental bookstore management system.

## Features

- Web scraping of books from Eslite.com website (target: 1000 books from 10 categories)
- Systematic category browsing to collect book links (100 books per category)
- HTML parsing to extract book details (title, author, price, publisher, category)
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

2. Install Playwright browser:
```bash
playwright install chromium
```

Note: Eslite.com uses Vue.js to dynamically load content, so we need Playwright to render JavaScript. The browser will be downloaded automatically on first run if not already installed.

3. Set up PostgreSQL database:
   - Ensure the database `rental_bookstore` exists (or modify `config.py`)
   - The scraper will automatically create the `books` table if it doesn't exist
   - Configure database connection in `config.py`:
     - Update `DB_CONFIG` with your PostgreSQL credentials

3. Configure categories:
   - Edit `config.py` and add your 10 category URLs to `ESLITE_CATEGORIES`
   - Format: `("Category Name", "https://www.eslite.com/category/...", 100)`

## Usage

Run the scraper:
```bash
python main.py
```

The scraper will:
1. Connect to PostgreSQL database
2. Browse 10 book categories systematically
3. Collect book links from listing pages (100 books per category)
4. Fetch detailed information for each book from detail pages
5. Parse and extract book information (title, author, price, publisher, category)
6. Process and validate data
7. Store books in database (skipping duplicates)
8. Display progress and statistics

## Configuration

Edit `config.py` to customize:
- `TARGET_BOOK_COUNT`: Number of books to scrape (default: 1000)
- `BOOKS_PER_CATEGORY`: Number of books per category (default: 100)
- `BATCH_SIZE`: Batch size for processing (default: 20)
- `REQUEST_DELAY`: Base delay between requests in seconds (default: 2.5)
- `RANDOM_DELAY_RANGE`: Random delay range to avoid pattern detection (default: 1.0-3.0 seconds)
- `ESLITE_CATEGORIES`: List of 10 categories with URLs and limits
- Database connection settings

## Project Structure

- `main.py`: Entry point
- `scraper.py`: Main scraper orchestration logic
- `eslite_client.py`: Eslite.com website client for HTTP requests
- `eslite_parser.py`: HTML parser for extracting book data
- `data_processor.py`: Data transformation and validation
- `database_handler.py`: PostgreSQL database operations
- `config.py`: Configuration settings

## Database Schema

The scraper uses the same `books` table as other scrapers:
- `book_id`: Primary key (format: `ESLITE_{product_id}`)
- `name`: Book title
- `publisher`: Publisher name
- `author`: Author name
- `price`: Price (extracted from website)
- `isbn`: ISBN number (if available, currently not extracted)
- `open_library_id`: NULL for Eslite.com books
- `source_url`: Book detail page URL
- `created_at`: Creation timestamp
- `updated_at`: Update timestamp

## Data Extraction

The scraper extracts the following information from Eslite.com:
- **Book Title**: Extracted from page title or heading
- **Author**: Extracted from author section or page text
- **Price**: Parsed from price display (handles various formats)
- **Publisher**: Extracted from publisher information or page text
- **Category**: Extracted from breadcrumb navigation or category tags (if available)

## Notes

- **JavaScript Rendering**: Eslite.com uses Vue.js to dynamically load content. The scraper uses Playwright to wait for JavaScript execution before extracting data.
- The scraper includes delays between requests to be respectful to the server
- Duplicate books are automatically skipped based on `book_id`
- Failed requests are logged and the scraper continues processing
- HTML structure may change over time; parser may need updates
- Ensure compliance with Eslite.com terms of service
- The scraper uses browser automation (Playwright) to handle JavaScript-rendered content
- Category information is extracted but not currently stored in database (can be added if needed)
- Browser runs in headless mode by default (set `headless=False` in `eslite_client.py` for debugging)

## Troubleshooting

### Common Issues

1. **Connection errors**: Check internet connection and database credentials
2. **Parsing failures**: Eslite.com HTML structure may have changed; update parser selectors
3. **Rate limiting**: Increase `REQUEST_DELAY` in `config.py` if getting blocked
4. **Database errors**: Verify PostgreSQL is running and credentials are correct
5. **No books found**: Verify category URLs are correct and accessible

### Debugging

Enable verbose output by modifying the scraper to print more details, or check the console output for error messages during scraping.

