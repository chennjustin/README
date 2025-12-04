"""
Open Library API client module
Handles all API requests to Open Library
"""

import time
import requests
from typing import Dict, List, Optional, Any
import config


class OpenLibraryClient:
    """
    Client for interacting with Open Library API
    Handles search, book details retrieval, and error handling
    """
    
    def __init__(self):
        self.base_search_url = config.OPEN_LIBRARY_SEARCH_URL
        self.base_books_url = config.OPEN_LIBRARY_BOOKS_URL
        self.base_works_url = config.OPEN_LIBRARY_WORKS_URL
        self.base_book_detail_url = config.OPEN_LIBRARY_BOOKS_DETAIL_URL
        self.request_delay = config.REQUEST_DELAY
        self.max_retries = config.MAX_RETRIES
        self.retry_delay = config.RETRY_DELAY
        self.timeout = config.TIMEOUT
        self.headers = {
            "User-Agent": config.USER_AGENT,
            "Accept": "application/json"
        }
    
    def _make_request(self, url: str, params: Optional[Dict] = None) -> Optional[Dict]:
        """
        Make HTTP request with retry logic and error handling
        Returns JSON response or None if request fails
        """
        for attempt in range(self.max_retries):
            try:
                response = requests.get(
                    url,
                    params=params,
                    headers=self.headers,
                    timeout=self.timeout
                )
                response.raise_for_status()
                return response.json()
            except requests.exceptions.RequestException as e:
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay * (attempt + 1))
                    continue
                else:
                    print(f"Request failed after {self.max_retries} attempts: {e}")
                    return None
    
    def search_books(self, query: str, limit: int = 100, offset: int = 0) -> Optional[Dict]:
        """
        Search for books using a query string
        Returns search results JSON or None if request fails
        
        According to Open Library API docs:
        - Default returns works (not editions)
        - Can request specific fields using 'fields' parameter
        - Supports pagination with offset/limit or page/limit
        """
        params = {
            "q": query,
            "limit": limit,
            "offset": offset,
            # Request additional fields that might be useful
            # edition_key provides edition identifiers which can be used to fetch ISBNs
            "fields": "key,title,author_name,edition_key,isbn,isbn_10,isbn_13"
        }
        
        url = self.base_search_url
        result = self._make_request(url, params)
        
        # Add delay between requests to be respectful
        time.sleep(self.request_delay)
        
        return result
    
    def get_book_by_isbn(self, isbn: str) -> Optional[Dict]:
        """
        Get book details by ISBN
        Returns book data JSON or None if request fails
        """
        params = {
            "bibkeys": f"ISBN:{isbn}",
            "format": "json",
            "jscmd": "data"
        }
        
        url = self.base_books_url
        result = self._make_request(url, params)
        
        time.sleep(self.request_delay)
        
        if result and f"ISBN:{isbn}" in result:
            return result[f"ISBN:{isbn}"]
        return None
    
    def get_books_by_isbns(self, isbns: List[str]) -> Dict[str, Optional[Dict]]:
        """
        Get multiple books by ISBNs in a single request
        Returns dictionary mapping ISBN to book data
        """
        if not isbns:
            return {}
        
        # Format ISBNs for API request
        bibkeys = ",".join([f"ISBN:{isbn}" for isbn in isbns])
        params = {
            "bibkeys": bibkeys,
            "format": "json",
            "jscmd": "data"
        }
        
        url = self.base_books_url
        result = self._make_request(url, params)
        
        time.sleep(self.request_delay)
        
        # Extract book data for each ISBN
        books_data = {}
        if result:
            for isbn in isbns:
                isbn_key = f"ISBN:{isbn}"
                if isbn_key in result:
                    books_data[isbn] = result[isbn_key]
                else:
                    books_data[isbn] = None
        
        return books_data
    
    def get_work_details(self, work_id: str) -> Optional[Dict]:
        """
        Get work details by work ID (Open Library work identifier)
        Returns work data JSON or None if request fails
        
        Handles various formats:
        - "/works/OL74502W" -> extracts "OL74502W"
        - "works/OL74502W" -> extracts "OL74502W"
        - "OL74502W" -> uses as is
        """
        # Remove leading slash if present
        if work_id.startswith("/"):
            work_id = work_id[1:]
        
        # Extract the actual ID part if path prefix is included
        # e.g., "works/OL74502W" -> "OL74502W"
        if "/" in work_id:
            parts = work_id.split("/")
            # Get the last part which should be the ID
            work_id = parts[-1]
        
        url = f"{self.base_works_url}/{work_id}.json"
        result = self._make_request(url)
        
        time.sleep(self.request_delay)
        
        return result
    
    def get_book_details(self, book_id: str) -> Optional[Dict]:
        """
        Get book details by book ID (Open Library book identifier)
        Returns book data JSON or None if request fails
        
        Handles various formats:
        - "/books/OL1234567M" -> extracts "OL1234567M"
        - "books/OL1234567M" -> extracts "OL1234567M"
        - "OL1234567M" -> uses as is
        """
        # Remove leading slash if present
        if book_id.startswith("/"):
            book_id = book_id[1:]
        
        # Extract the actual ID part if path prefix is included
        # e.g., "books/OL1234567M" -> "OL1234567M"
        if "/" in book_id:
            parts = book_id.split("/")
            # Get the last part which should be the ID
            book_id = parts[-1]
        
        url = f"{self.base_book_detail_url}/{book_id}.json"
        result = self._make_request(url)
        
        time.sleep(self.request_delay)
        
        return result
    
    def get_author_details(self, author_key: str) -> Optional[Dict]:
        """
        Get author details by author key (Open Library author identifier)
        Returns author data JSON or None if request fails
        
        Handles various formats:
        - "/authors/OL1234567A" -> extracts "OL1234567A"
        - "authors/OL1234567A" -> extracts "OL1234567A"
        - "OL1234567A" -> uses as is
        """
        # Remove leading slash if present
        if author_key.startswith("/"):
            author_key = author_key[1:]
        
        # Extract the actual ID part if path prefix is included
        if "/" in author_key:
            parts = author_key.split("/")
            author_key = parts[-1]
        
        url = f"https://openlibrary.org/authors/{author_key}.json"
        result = self._make_request(url)
        
        time.sleep(self.request_delay)
        
        return result
    
    def get_edition_from_work(self, work_data: Dict) -> Optional[Dict]:
        """
        Get an edition from a work
        Works may reference editions, we try to get the first available edition
        
        Open Library work structure:
        - May have "editions" key with a dict containing entries
        - May have edition keys in other fields
        - We need to fetch editions via a separate API call
        
        Returns edition data JSON or None if not found
        """
        work_key = work_data.get("key")
        if not work_key:
            return None
        
        # Clean work key
        if work_key.startswith("/"):
            work_key = work_key[1:]
        if "/" in work_key:
            parts = work_key.split("/")
            work_key = parts[-1]
        
        # Try to get editions via Open Library Editions API
        # Format: https://openlibrary.org/works/{work_id}/editions.json
        editions_url = f"https://openlibrary.org/works/{work_key}/editions.json"
        editions_result = self._make_request(editions_url)
        
        if editions_result and "entries" in editions_result:
            entries = editions_result["entries"]
            if isinstance(entries, list) and len(entries) > 0:
                # Get first edition
                first_edition = entries[0]
                if isinstance(first_edition, dict) and "key" in first_edition:
                    edition_key = first_edition["key"]
                    return self.get_book_details(edition_key)
        
        # Fallback: check if work_data has edition information directly
        if "editions" in work_data:
            editions = work_data["editions"]
            if isinstance(editions, dict) and "entries" in editions:
                entries = editions["entries"]
                if isinstance(entries, list) and len(entries) > 0:
                    first_edition = entries[0]
                    if isinstance(first_edition, dict) and "key" in first_edition:
                        edition_key = first_edition["key"]
                        return self.get_book_details(edition_key)
        
        return None

