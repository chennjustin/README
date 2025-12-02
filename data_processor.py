"""
Data processing module
Handles parsing, validation, and cleaning of book data from Open Library API
"""

from typing import Dict, Optional, List, Any
import re


class DataProcessor:
    """
    Processes raw book data from Open Library API
    Extracts, validates, and cleans required fields
    """
    
    def __init__(self):
        pass
    
    def extract_book_id(self, data: Dict, isbn: Optional[str] = None) -> Optional[str]:
        """
        Extract book_id from API response
        Uses Open Library key or generates from ISBN
        """
        # Try to get key from data
        if "key" in data:
            key = data["key"]
            # Extract ID part (e.g., "OL1234567M" from "/books/OL1234567M")
            if isinstance(key, str):
                # Remove leading slash and extract ID
                key = key.lstrip("/")
                parts = key.split("/")
                if len(parts) >= 2:
                    return parts[-1]  # Return the ID part
        
        # Fallback to ISBN if available
        if isbn:
            return f"ISBN_{isbn}"
        
        return None
    
    def extract_name(self, data: Dict) -> Optional[str]:
        """
        Extract book name/title from API response
        """
        if "title" in data:
            title = data["title"]
            if isinstance(title, str):
                return self._clean_text(title)
        return None
    
    def extract_publisher(self, data: Dict) -> Optional[str]:
        """
        Extract publisher from API response
        Takes first publisher if multiple exist
        """
        # Try publishers field (plural, list)
        if "publishers" in data:
            publishers = data["publishers"]
            if isinstance(publishers, list) and len(publishers) > 0:
                publisher = publishers[0]
                if isinstance(publisher, dict):
                    # Try different field names in publisher object
                    if "name" in publisher:
                        return self._clean_text(publisher["name"])
                    elif "key" in publisher:
                        # Publisher key, extract name part
                        key = publisher["key"]
                        if isinstance(key, str):
                            # Key format might be "/publishers/publisher_name" or just "publisher_name"
                            parts = key.split("/")
                            if len(parts) > 0:
                                return self._clean_text(parts[-1])
                elif isinstance(publisher, str):
                    return self._clean_text(publisher)
            elif isinstance(publishers, str):
                return self._clean_text(publishers)
        
        # Try alternative field names
        if "publisher" in data:
            publisher = data["publisher"]
            if isinstance(publisher, str):
                return self._clean_text(publisher)
            elif isinstance(publisher, list) and len(publisher) > 0:
                pub = publisher[0]
                if isinstance(pub, dict) and "name" in pub:
                    return self._clean_text(pub["name"])
                elif isinstance(pub, str):
                    return self._clean_text(pub)
        
        return None
    
    def extract_author(self, data: Dict, author_details_cache: Optional[Dict[str, str]] = None) -> Optional[str]:
        """
        Extract author from API response
        Takes first author if multiple exist
        
        Args:
            data: Book data dictionary
            author_details_cache: Optional cache dictionary mapping author keys to author names
                                 If provided and author only has key, will lookup author name from cache
        """
        # Try authors field (plural, list)
        if "authors" in data and isinstance(data["authors"], list):
            if len(data["authors"]) > 0:
                author = data["authors"][0]
                if isinstance(author, dict):
                    # Try different possible field names
                    if "name" in author:
                        return self._clean_text(author["name"])
                    elif "author" in author and isinstance(author["author"], dict):
                        # Nested author object
                        nested_author = author["author"]
                        if "key" in nested_author and author_details_cache:
                            author_key = nested_author["key"]
                            if author_key in author_details_cache:
                                return self._clean_text(author_details_cache[author_key])
                    elif "key" in author:
                        # Author key format: "/authors/OL1234567A"
                        author_key = author["key"]
                        if isinstance(author_key, str):
                            # Check cache first
                            if author_details_cache and author_key in author_details_cache:
                                return self._clean_text(author_details_cache[author_key])
                            # Return key as fallback (will be resolved later)
                            return self._clean_text(author_key)
                elif isinstance(author, str):
                    return self._clean_text(author)
        
        # Try author_names field (from search results)
        if "author_name" in data:
            author_names = data["author_name"]
            if isinstance(author_names, list) and len(author_names) > 0:
                return self._clean_text(author_names[0])
            elif isinstance(author_names, str):
                return self._clean_text(author_names)
        
        # Try alternative field names
        if "author" in data:
            author = data["author"]
            if isinstance(author, str):
                return self._clean_text(author)
            elif isinstance(author, list) and len(author) > 0:
                author_obj = author[0]
                if isinstance(author_obj, dict):
                    if "name" in author_obj:
                        return self._clean_text(author_obj["name"])
                    elif "key" in author_obj and author_details_cache:
                        author_key = author_obj["key"]
                        if author_key in author_details_cache:
                            return self._clean_text(author_details_cache[author_key])
                elif isinstance(author_obj, str):
                    return self._clean_text(author_obj)
        
        return None
    
    def extract_isbn(self, data: Dict) -> Optional[str]:
        """
        Extract ISBN from API response
        Prioritizes ISBN-13, falls back to ISBN-10
        """
        # Try ISBN-13 first
        if "isbn_13" in data and isinstance(data["isbn_13"], list):
            if len(data["isbn_13"]) > 0:
                return str(data["isbn_13"][0])
        
        # Fallback to ISBN-10
        if "isbn_10" in data and isinstance(data["isbn_10"], list):
            if len(data["isbn_10"]) > 0:
                return str(data["isbn_10"][0])
        
        # Try single ISBN field
        if "isbn" in data:
            isbn = data["isbn"]
            if isinstance(isbn, list) and len(isbn) > 0:
                return str(isbn[0])
            elif isinstance(isbn, str):
                return isbn
        
        return None
    
    def extract_open_library_id(self, data: Dict) -> Optional[str]:
        """
        Extract Open Library ID from API response
        """
        if "key" in data:
            key = data["key"]
            if isinstance(key, str):
                return key.lstrip("/")
        return None
    
    def process_book_data(self, data: Dict, isbn: Optional[str] = None, author_details_cache: Optional[Dict[str, str]] = None) -> Optional[Dict]:
        """
        Process complete book data from API response
        Returns dictionary with required fields or None if invalid
        
        Args:
            data: Book data dictionary from API
            isbn: Optional ISBN for fallback
            author_details_cache: Optional cache dictionary mapping author keys to author names
        """
        if not data or not isinstance(data, dict):
            return None
        
        # Extract all fields
        book_id = self.extract_book_id(data, isbn)
        name = self.extract_name(data)
        publisher = self.extract_publisher(data)
        author = self.extract_author(data, author_details_cache)
        extracted_isbn = self.extract_isbn(data) or isbn
        open_library_id = self.extract_open_library_id(data)
        
        # Validate required fields
        if not book_id or not name:
            return None
        
        # Build processed data dictionary
        processed_data = {
            "book_id": book_id,
            "name": name,
            "publisher": publisher,
            "author": author,
            "price": 0,  # Default price as specified
            "isbn": extracted_isbn,
            "open_library_id": open_library_id,
            "source_url": None  # Will be set by scraper
        }
        
        return processed_data
    
    def process_search_result(self, search_result: Dict) -> List[Dict]:
        """
        Process search results to extract book identifiers
        Returns list of book identifiers (ISBNs or Open Library IDs)
        """
        book_identifiers = []
        
        if not search_result or "docs" not in search_result:
            return book_identifiers
        
        docs = search_result["docs"]
        if not isinstance(docs, list):
            return book_identifiers
        
        for doc in docs:
            if not isinstance(doc, dict):
                continue
            
            # Try to get ISBN first (preferred for detail lookup)
            # Note: Search API returns works, not editions, so ISBN may not be directly available
            # But some works may have ISBN in the response if requested via fields parameter
            isbn = None
            if "isbn" in doc:
                isbn_list = doc["isbn"]
                if isinstance(isbn_list, list) and len(isbn_list) > 0:
                    isbn = str(isbn_list[0])
            
            # Also check for isbn_10 and isbn_13 fields
            if not isbn:
                if "isbn_10" in doc:
                    isbn_list = doc["isbn_10"]
                    if isinstance(isbn_list, list) and len(isbn_list) > 0:
                        isbn = str(isbn_list[0])
                elif "isbn_13" in doc:
                    isbn_list = doc["isbn_13"]
                    if isinstance(isbn_list, list) and len(isbn_list) > 0:
                        isbn = str(isbn_list[0])
            
            # Prioritize edition_key over work key (editions have more complete info)
            key = None
            if "edition_key" in doc:
                # Edition keys provide more complete information (publisher, ISBN, etc.)
                edition_keys = doc["edition_key"]
                if isinstance(edition_keys, list) and len(edition_keys) > 0:
                    key = f"/books/{edition_keys[0]}"
            
            # Fallback to work key if no edition key
            if not key:
                key = doc.get("key")
            
            # Use key if available (will be used to fetch details)
            if key and isinstance(key, str):
                book_identifiers.append({
                    "type": "key",
                    "value": key,
                    "isbn": isbn  # Include ISBN if found, but use key for lookup
                })
            elif isbn:
                # If we have ISBN but no key, use ISBN for lookup
                book_identifiers.append({
                    "type": "isbn",
                    "value": isbn,
                    "isbn": isbn
                })
        
        return book_identifiers
    
    def _clean_text(self, text: str) -> str:
        """
        Clean and normalize text data
        Removes extra whitespace and normalizes encoding
        """
        if not isinstance(text, str):
            return ""
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        
        return text
    
    def validate_book_data(self, book_data: Dict) -> bool:
        """
        Validate that book data has required fields
        Returns True if valid, False otherwise
        """
        required_fields = ["book_id", "name"]
        
        for field in required_fields:
            if field not in book_data or not book_data[field]:
                return False
        
        return True

