"""
Books.com.tw website client module
Handles HTTP requests and basic interaction with the Books.com.tw website
"""

import time
import random
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from typing import Dict, List, Optional
import config


class BooksComTwClient:
    """
    Client for interacting with Books.com.tw website
    Handles HTTP requests with proper headers, delays, and error handling
    """
    
    def __init__(self):
        self.base_url = config.BOOKS_COM_TW_BASE_URL
        self.session = self._create_session()
        self.request_delay = config.REQUEST_DELAY
        self.random_delay_range = config.RANDOM_DELAY_RANGE
        
    def _create_session(self) -> requests.Session:
        """
        Create a requests session with retry strategy and proper headers
        """
        session = requests.Session()
        
        # Configure retry strategy
        retry_strategy = Retry(
            total=config.MAX_RETRIES,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST"]
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        # Set default headers
        session.headers.update({
            "User-Agent": config.USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        })
        
        return session
    
    def _random_delay(self):
        """
        Add random delay between requests to avoid pattern detection
        """
        delay = random.uniform(*self.random_delay_range)
        time.sleep(delay)
    
    def fetch_page(self, url: str, params: Optional[Dict] = None) -> Optional[str]:
        """
        Fetch a web page with error handling and retry logic
        
        Args:
            url: URL to fetch
            params: Optional query parameters
            
        Returns:
            HTML content as string, or None if failed
        """
        try:
            self._random_delay()
            
            response = self.session.get(
                url,
                params=params,
                timeout=config.TIMEOUT
            )
            
            response.raise_for_status()
            
            # Check if response is HTML
            content_type = response.headers.get("Content-Type", "")
            if "text/html" not in content_type:
                print(f"Warning: Unexpected content type: {content_type}")
            
            return response.text
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching {url}: {e}")
            return None
    
    def get_category_page(self, category_url: str, page: int = 1) -> Optional[str]:
        """
        Get a category listing page
        
        Args:
            category_url: Full category URL from config
            page: Page number (1-indexed)
            
        Returns:
            HTML content of the category page
        """
        # Add page parameter if URL doesn't have it
        if "page=" in category_url:
            # Replace existing page parameter
            import re
            url = re.sub(r"page=\d+", f"page={page}", category_url)
        else:
            # Add page parameter
            separator = "&" if "?" in category_url else "?"
            url = f"{category_url}{separator}page={page}"
        
        return self.fetch_page(url)
    
    def get_book_detail_page(self, product_id: str) -> Optional[str]:
        """
        Get a book detail page
        
        Args:
            product_id: Product ID from Books.com.tw (e.g., "0011234567")
            
        Returns:
            HTML content of the book detail page
        """
        url = f"{self.base_url}/products/{product_id}"
        return self.fetch_page(url)
    
    def search_books(self, keyword: str, page: int = 1) -> Optional[str]:
        """
        Search for books by keyword
        
        Args:
            keyword: Search keyword
            page: Page number (1-indexed)
            
        Returns:
            HTML content of search results page
        """
        # Books.com.tw search URL format: https://search.books.com.tw/search/query/key/{keyword}
        url = f"{config.BOOKS_COM_TW_SEARCH_URL}/{keyword}"
        params = {
            "page": str(page)
        }
        
        return self.fetch_page(url, params)
    
    def close(self):
        """
        Close the session
        """
        if self.session:
            self.session.close()

