"""
Data processing module for Eslite.com scraper
Handles data transformation and validation for Eslite.com book data
"""

from typing import Dict, Optional
import re


class EsliteDataProcessor:
    """
    Processes raw book data from Eslite.com HTML parsing
    Transforms data to match database schema and validates required fields
    """
    
    def __init__(self):
        pass
    
    def process_book_data(self, raw_data: Dict) -> Optional[Dict]:
        """
        Process raw book data from parser to match database schema
        
        Args:
            raw_data: Raw book data dictionary from parser
            
        Returns:
            Processed book data dictionary ready for database insertion, or None if invalid
        """
        if not raw_data or not isinstance(raw_data, dict):
            return None
        
        # Extract and validate required fields
        product_id = raw_data.get("product_id")
        name = raw_data.get("name")
        
        # Validate required fields
        if not product_id or not name:
            return None
        
        # Generate book_id from product_id
        # Use format: ESLITE_{product_id} to avoid conflicts with other sources
        book_id = f"ESLITE_{product_id}"
        
        # Extract optional fields
        author = raw_data.get("author")
        publisher = raw_data.get("publisher")
        price = raw_data.get("price", 0.0)  # Default to 0 if not found
        category = raw_data.get("category")
        source_url = raw_data.get("url", "")
        
        # Clean and normalize fields
        name = self._clean_text(name)
        author = self._clean_text(author) if author else None
        publisher = self._clean_text(publisher) if publisher else None
        category = self._clean_text(category) if category else None
        
        # Ensure price is a valid number
        if price is None:
            price = 0.0
        try:
            price = float(price)
        except (ValueError, TypeError):
            price = 0.0
        
        # Build processed data dictionary matching database schema
        # Note: category is stored separately if needed, or can be added to database schema
        processed_data = {
            "book_id": book_id,
            "name": name,
            "publisher": publisher,
            "author": author,
            "price": price,
            "isbn": None,  # ISBN extraction can be added if needed
            "open_library_id": None,  # Not applicable for Eslite.com
            "source_url": source_url,
            "category": category  # Store category for reference (may need to add to DB schema)
        }
        
        return processed_data
    
    def validate_book_data(self, book_data: Dict) -> bool:
        """
        Validate that book data has required fields
        
        Args:
            book_data: Processed book data dictionary
            
        Returns:
            True if valid, False otherwise
        """
        required_fields = ["book_id", "name"]
        
        for field in required_fields:
            if field not in book_data or not book_data[field]:
                return False
        
        return True
    
    def _clean_text(self, text: str) -> str:
        """
        Clean and normalize text data
        
        Args:
            text: Raw text string
            
        Returns:
            Cleaned text string
        """
        if not text:
            return ""
        
        if not isinstance(text, str):
            text = str(text)
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        
        return text

