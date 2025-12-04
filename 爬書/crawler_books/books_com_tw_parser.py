"""
Books.com.tw HTML parser module
Extracts structured book data from HTML pages
"""

from bs4 import BeautifulSoup
from typing import Dict, List, Optional
import re


class BooksComTwParser:
    """
    Parser for extracting book information from Books.com.tw HTML pages
    Handles both listing pages and detail pages
    """
    
    def __init__(self):
        pass
    
    def parse_category_listing(self, html: str) -> List[Dict]:
        """
        Parse a category listing page to extract book links and basic info
        
        Args:
            html: HTML content of the category listing page
            
        Returns:
            List of dictionaries containing book identifiers and basic info
        """
        books = []
        
        if not html:
            return books
        
        try:
            soup = BeautifulSoup(html, "html.parser")
            
            # Books.com.tw uses various structures for listing pages
            # Try multiple selectors to find book items
            
            # Common selectors for book items on listing pages
            book_selectors = [
                "div.item",  # Common item container
                "li.item",   # List item format
                "div.search_item",  # Search result format
                "div[class*='item']",  # Any div with "item" in class
            ]
            
            book_elements = []
            for selector in book_selectors:
                elements = soup.select(selector)
                if elements:
                    book_elements = elements
                    break
            
            # If no elements found, try to find links to product pages
            if not book_elements:
                # Look for links containing "/products/"
                product_links = soup.find_all("a", href=re.compile(r"/products/\d+"))
                for link in product_links:
                    product_id = self._extract_product_id_from_url(link.get("href", ""))
                    if product_id:
                        books.append({
                            "product_id": product_id,
                            "url": link.get("href", ""),
                            "title": self._clean_text(link.get_text())
                        })
                return books
            
            # Extract information from book elements
            for element in book_elements:
                book_info = self._extract_book_from_listing_element(element)
                if book_info:
                    books.append(book_info)
                    
        except Exception as e:
            print(f"Error parsing category listing: {e}")
        
        return books
    
    def parse_book_detail(self, html: str, product_id: str) -> Optional[Dict]:
        """
        Parse a book detail page to extract complete information
        
        Args:
            html: HTML content of the book detail page
            product_id: Product ID for this book
            
        Returns:
            Dictionary containing complete book information, or None if parsing failed
        """
        if not html:
            return None
        
        try:
            soup = BeautifulSoup(html, "html.parser")
            
            book_data = {
                "product_id": product_id,
                "name": None,
                "author": None,
                "publisher": None,
                "price": None,
                "isbn": None,
                "url": f"https://www.books.com.tw/products/{product_id}"
            }
            
            # Extract book title
            # Books.com.tw typically has title in h1 or specific div
            title_selectors = [
                "h1[itemprop='name']",
                "h1.title",
                "div[class*='title'] h1",
                "h1",
            ]
            
            for selector in title_selectors:
                title_elem = soup.select_one(selector)
                if title_elem:
                    book_data["name"] = self._clean_text(title_elem.get_text())
                    break
            
            # Extract author
            # Author is often in a specific div or span with itemprop="author"
            author_selectors = [
                "span[itemprop='author']",
                "div[class*='author']",
                "a[href*='author']",
                "span.author",
            ]
            
            for selector in author_selectors:
                author_elem = soup.select_one(selector)
                if author_elem:
                    author_text = self._clean_text(author_elem.get_text())
                    # Remove common prefixes like "作者：", "作者:", etc.
                    author_text = re.sub(r"^作者[：:]\s*", "", author_text)
                    if author_text:
                        book_data["author"] = author_text
                        break
            
            # Extract publisher
            # Publisher is often in a div or span
            publisher_selectors = [
                "span[itemprop='publisher']",
                "div[class*='publisher']",
                "a[href*='publisher']",
                "span.publisher",
            ]
            
            for selector in publisher_selectors:
                publisher_elem = soup.select_one(selector)
                if publisher_elem:
                    publisher_text = self._clean_text(publisher_elem.get_text())
                    # Remove common prefixes
                    publisher_text = re.sub(r"^出版社[：:]\s*", "", publisher_text)
                    publisher_text = re.sub(r"^出版[：:]\s*", "", publisher_text)
                    if publisher_text:
                        book_data["publisher"] = publisher_text
                        break
            
            # Extract price
            # Price is usually in a specific div with class containing "price"
            price_selectors = [
                "span[itemprop='price']",
                "li[class*='price']",
                "div[class*='price']",
                "span.price",
                "strong.price",
            ]
            
            for selector in price_selectors:
                price_elem = soup.select_one(selector)
                if price_elem:
                    price_text = self._clean_text(price_elem.get_text())
                    price_value = self._parse_price(price_text)
                    if price_value is not None:
                        book_data["price"] = price_value
                        break
            
            # Extract ISBN
            # ISBN is often in metadata or specific div
            isbn_selectors = [
                "span[itemprop='isbn']",
                "div[class*='isbn']",
                "span.isbn",
            ]
            
            for selector in isbn_selectors:
                isbn_elem = soup.select_one(selector)
                if isbn_elem:
                    isbn_text = self._clean_text(isbn_elem.get_text())
                    isbn_value = self._extract_isbn(isbn_text)
                    if isbn_value:
                        book_data["isbn"] = isbn_value
                        break
            
            # If ISBN not found in dedicated element, search in all text
            if not book_data["isbn"]:
                page_text = soup.get_text()
                isbn_value = self._extract_isbn(page_text)
                if isbn_value:
                    book_data["isbn"] = isbn_value
            
            # Validate that we have at least name (required field)
            if not book_data["name"]:
                return None
            
            return book_data
            
        except Exception as e:
            print(f"Error parsing book detail for {product_id}: {e}")
            return None
    
    def _extract_book_from_listing_element(self, element) -> Optional[Dict]:
        """
        Extract book information from a listing page element
        
        Args:
            element: BeautifulSoup element containing book info
            
        Returns:
            Dictionary with product_id and url, or None if extraction failed
        """
        try:
            # Find link to product page
            link = element.find("a", href=re.compile(r"/products/\d+"))
            if not link:
                return None
            
            href = link.get("href", "")
            product_id = self._extract_product_id_from_url(href)
            
            if product_id:
                return {
                    "product_id": product_id,
                    "url": href if href.startswith("http") else f"https://www.books.com.tw{href}",
                    "title": self._clean_text(link.get_text())
                }
        except Exception as e:
            print(f"Error extracting book from listing element: {e}")
        
        return None
    
    def _extract_product_id_from_url(self, url: str) -> Optional[str]:
        """
        Extract product ID from Books.com.tw URL
        
        Args:
            url: URL string (e.g., "/products/0011234567" or "https://www.books.com.tw/products/0011234567")
            
        Returns:
            Product ID string, or None if not found
        """
        match = re.search(r"/products/(\d+)", url)
        if match:
            return match.group(1)
        return None
    
    def _parse_price(self, price_text: str) -> Optional[float]:
        """
        Parse price string to float value
        
        Args:
            price_text: Price string (e.g., "$350", "350元", "特價 $299")
            
        Returns:
            Price as float, or None if parsing failed
        """
        if not price_text:
            return None
        
        # Remove currency symbols and common text
        # Remove: $, NT$, 元, 特價, 定價, etc.
        cleaned = re.sub(r"[特價定價售價]", "", price_text, flags=re.IGNORECASE)
        cleaned = re.sub(r"[NT$元]", "", cleaned)
        cleaned = re.sub(r"[,\s]", "", cleaned)
        
        # Extract number
        match = re.search(r"(\d+(?:\.\d+)?)", cleaned)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                pass
        
        return None
    
    def _extract_isbn(self, text: str) -> Optional[str]:
        """
        Extract ISBN from text
        
        Args:
            text: Text that may contain ISBN
            
        Returns:
            ISBN string (10 or 13 digits), or None if not found
        """
        if not text:
            return None
        
        # Look for ISBN-13 (13 digits) or ISBN-10 (10 digits)
        # Common patterns: ISBN: 9781234567890, ISBN 978-123-456-789-0, etc.
        patterns = [
            r"ISBN[：:\s]*(\d{13})",  # ISBN-13
            r"ISBN[：:\s]*(\d{10})",  # ISBN-10
            r"(\d{13})",  # Just 13 digits
            r"(\d{10})",  # Just 10 digits
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                isbn = match.group(1)
                # Validate ISBN length
                if len(isbn) == 10 or len(isbn) == 13:
                    return isbn
        
        return None
    
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
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        
        return text

