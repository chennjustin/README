"""
Configuration file for Books.com.tw scraper
Contains website URLs, database settings, and scraping parameters
"""

# Books.com.tw website URLs
BOOKS_COM_TW_BASE_URL = "https://www.books.com.tw"
# Search URL - format: https://search.books.com.tw/search/query/key/{keyword}
BOOKS_COM_TW_SEARCH_URL = "https://search.books.com.tw/search/query/key"

# API request settings
REQUEST_DELAY = 2.5  # Delay between requests in seconds (be respectful to server)
RANDOM_DELAY_RANGE = (1.0, 3.0)  # Random delay range to avoid pattern detection
MAX_RETRIES = 3  # Maximum number of retry attempts
RETRY_DELAY = 5  # Delay before retry in seconds
TIMEOUT = 30  # Request timeout in seconds

# User agent for web requests
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Database settings (shared with Open Library scraper)
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "rental_bookstore",
    "user": "amy",
    "password": "postgres"
}

# Scraping settings
TARGET_BOOK_COUNT = 1000  # Target number of books to scrape
BATCH_SIZE = 20  # Number of books to process in each batch (smaller for web scraping)
PAGE_SIZE = 20  # Number of books per page on Books.com.tw

# Category codes for systematic browsing (optional, if you have correct URLs)
# Format: (category_name, category_url, max_books_per_category)
# To find correct category URLs:
# 1. Go to https://www.books.com.tw
# 2. Navigate to a category page
# 3. Copy the URL from browser address bar
# Example: ("中文書-文學小說", "https://www.books.com.tw/web/sys_cebbotm/cebook/100307047", 100)
BOOK_CATEGORIES = [
    # Add your category URLs here if you want to use category browsing
    # Example format: ("Category Name", "https://www.books.com.tw/...", 100)
    ("中文書-文學小說", "https://www.books.com.tw/web/books_nbtopm_01/?loc=P_0001_001", 100),
    ("中文書-商業理財", "https://www.books.com.tw/web/books_nbtopm_02/?loc=P_0003_002", 100),
    ("中文書-童書/青少年圖書", "https://www.books.com.tw/web/books_nbtopm_14/?loc=P_0003_012", 100),
    ("中文書-輕小說", "https://www.books.com.tw/web/books_nbtopm_15/?loc=P_0003_016", 100),
    ("中文書-語言學習", "https://www.books.com.tw/web/books_nbtopm_17/?loc=P_0003_018", 100),
    ("中文書-自然科普", "http://books.com.tw/web/books_nbtopm_06/?loc=P_0003_007", 100),
    ("中文書-飲食", "https://www.books.com.tw/web/books_nbtopm_09/?loc=P_0003_009", 100),
    ("中文書-醫療保健", "https://www.books.com.tw/web/books_nbtopm_08/?loc=P_0003_008", 100),
    ("中文書-漫畫", "https://www.books.com.tw/web/books_nbtopm_16/?loc=P_0003_017", 100),
    ("中文書-親子教養", "https://www.books.com.tw/web/books_nbtopm_13/?loc=P_0003_014", 100)

# Search keywords - main strategy for collecting books
# The scraper will search for these keywords and collect books from results
]

SEARCH_KEYWORDS = [
    
]

