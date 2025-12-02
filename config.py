"""
Configuration file for Open Library scraper
Contains API endpoints, database settings, and scraping parameters
"""

# Open Library API endpoints
OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json"
OPEN_LIBRARY_BOOKS_URL = "https://openlibrary.org/api/books"
OPEN_LIBRARY_WORKS_URL = "https://openlibrary.org/works"
OPEN_LIBRARY_BOOKS_DETAIL_URL = "https://openlibrary.org/books"

# API request settings
REQUEST_DELAY = 1.5  # Delay between requests in seconds
MAX_RETRIES = 3  # Maximum number of retry attempts
RETRY_DELAY = 2  # Delay before retry in seconds
TIMEOUT = 30  # Request timeout in seconds

# User agent for API requests
USER_AGENT = "RentalBookstoreSystem/1.0 (Contact: your-email@example.com)"

# Database settings (will be loaded from environment variables)
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "rental_bookstore",
    "user": "amy",
    "password": "postgres"
}

# Scraping settings
TARGET_BOOK_COUNT = 500  # Target number of books to scrape
BATCH_SIZE = 50  # Number of books to process in each batch
SEARCH_LIMIT = 100  # Maximum results per search query

# Search strategy settings
SUBJECTS_PER_CATEGORY = 50  # Number of books to fetch per subject
AUTHORS_PER_AUTHOR = 30  # Number of books to fetch per author
KEYWORDS_PER_QUERY = 40  # Number of books to fetch per keyword query

