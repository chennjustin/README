"""
Configuration file for Eslite.com scraper
Contains website URLs, database settings, and scraping parameters
"""

# Eslite.com website URLs
ESLITE_BASE_URL = "https://www.eslite.com"

# API request settings
REQUEST_DELAY = 2.5  # Delay between requests in seconds (be respectful to server)
RANDOM_DELAY_RANGE = (1.0, 3.0)  # Random delay range to avoid pattern detection
MAX_RETRIES = 3  # Maximum number of retry attempts
RETRY_DELAY = 5  # Delay before retry in seconds
TIMEOUT = 30  # Request timeout in seconds (for reference, Playwright uses its own timeout)
PLAYWRIGHT_TIMEOUT = 60000  # Playwright timeout in milliseconds (60 seconds)

# User agent for web requests
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Database settings (shared with other scrapers)
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "rental_bookstore",
    "user": "amy",
    "password": "postgres"
}

# Scraping settings
TARGET_BOOK_COUNT = 1000  # Target number of books to scrape (10 categories × 100 books)
BATCH_SIZE = 20  # Number of books to process in each batch
BOOKS_PER_CATEGORY = 100  # Number of books to scrape per category

# Category configuration
# Format: (category_name, category_url, max_books_per_category)
ESLITE_CATEGORIES = [
    ("中國文學論集", "https://www.eslite.com/category/3/29", 100),
    ("歐美文學", "https://www.eslite.com/category/3/32", 100),
    ("世界文學", "https://www.eslite.com/category/3/33", 100),
    ("詩", "https://www.eslite.com/category/3/35", 100),
    ("自然文學", "https://www.eslite.com/category/3/37", 100),
    ("武俠/歷史小說", "https://www.eslite.com/category/3/41", 100),
    ("推理/驚悚小說", "https://www.eslite.com/category/3/42", 100),
    ("言情小說", "https://www.eslite.com/category/3/43", 100),
    ("科幻/奇幻小說", "https://www.eslite.com/category/3/44", 100),
    ("旅行文學", "https://www.eslite.com/category/3/39", 100),
]

