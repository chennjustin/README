"""
Eslite.com HTML parser module
Extracts structured book data from HTML pages
"""

from bs4 import BeautifulSoup
from typing import Dict, List, Optional
import re


class EsliteParser:
    """
    Parser for extracting book information from Eslite.com HTML pages
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
            
            # First, try to find all links that might be product links
            # Eslite.com might use various URL patterns
            all_links = soup.find_all("a", href=True)
            
            # Try multiple patterns for product URLs
            product_url_patterns = [
                r"/product/",
                r"/goods/",
                r"/item/",
                r"/book/",
                r"eslite\.com/product/",
                r"eslite\.com/goods/",
            ]
            
            product_links = []
            for link in all_links:
                href = link.get("href", "")
                if not href:
                    continue
                
                # Check if this link matches any product URL pattern
                for pattern in product_url_patterns:
                    if re.search(pattern, href, re.IGNORECASE):
                        product_links.append(link)
                        break
            
            # If we found product links directly, use them
            if product_links:
                seen_urls = set()
                for link in product_links:
                    href = link.get("href", "")
                    if not href:
                        continue
                    
                    # Normalize URL
                    if href.startswith("/"):
                        href = f"https://www.eslite.com{href}"
                    elif not href.startswith("http"):
                        continue
                    
                    # Avoid duplicates
                    if href in seen_urls:
                        continue
                    seen_urls.add(href)
                    
                    product_id = self._extract_product_id_from_url(href)
                    title = self._clean_text(link.get_text())
                    
                    # Only add if we have a valid URL
                    if href and ("product" in href.lower() or "goods" in href.lower() or "item" in href.lower()):
                        books.append({
                            "product_id": product_id or self._generate_id_from_url(href),
                            "url": href,
                            "title": title or "Unknown"
                        })
                
                if books:
                    return books
            
            # If no direct product links found, try to find containers
            # Try multiple selectors to find book items on listing pages
            book_selectors = [
                "div[class*='product']",
                "div[class*='item']",
                "div[class*='book']",
                "div[class*='goods']",
                "li[class*='product']",
                "li[class*='item']",
                "article[class*='product']",
                "[data-product-id]",
                "[data-item-id]",
            ]
            
            book_elements = []
            for selector in book_selectors:
                try:
                    elements = soup.select(selector)
                    if elements:
                        book_elements = elements
                        print(f"  Found {len(elements)} elements using selector: {selector}")
                        break
                except Exception:
                    continue
            
            # Extract information from book elements
            if book_elements:
                for element in book_elements:
                    book_info = self._extract_book_from_listing_element(element)
                    if book_info:
                        books.append(book_info)
            
            # Debug: If no books found, print some diagnostic info
            if not books:
                print(f"  Debug: No books found. HTML length: {len(html)}")
                print(f"  Debug: Total links in page: {len(all_links)}")
                # Check if page might be JavaScript-rendered
                if len(html) < 10000:
                    print(f"  Warning: HTML is very short ({len(html)} chars), might be JavaScript-rendered")
                # Check for common indicators of JS-rendered content
                if "loading" in html.lower() or "spinner" in html.lower():
                    print(f"  Warning: Page might use JavaScript to load content")
            
            # If still no books found, try to find any links with numeric IDs (might be product IDs)
            if not books:
                # Look for links with numeric patterns that might be product pages
                numeric_links = soup.find_all("a", href=re.compile(r"/\d+"))
                for link in numeric_links[:20]:  # Limit to first 20 to avoid false positives
                    href = link.get("href", "")
                    if href and len(href) > 5:  # Filter out very short paths
                        # Check if it looks like a product page
                        if any(keyword in href.lower() for keyword in ["product", "goods", "item", "book"]):
                            normalized_href = href if href.startswith("http") else f"https://www.eslite.com{href}"
                            books.append({
                                "product_id": self._extract_product_id_from_url(normalized_href) or self._generate_id_from_url(normalized_href),
                                "url": normalized_href,
                                "title": self._clean_text(link.get_text()) or "Unknown"
                            })
                    
        except Exception as e:
            print(f"Error parsing category listing: {e}")
            import traceback
            traceback.print_exc()
        
        return books
    
    def parse_book_detail(self, html: str, book_url: str) -> Optional[Dict]:
        """
        Parse a book detail page to extract complete information
        
        Args:
            html: HTML content of the book detail page
            book_url: URL of the book detail page
            
        Returns:
            Dictionary containing complete book information, or None if parsing failed
        """
        if not html:
            return None
        
        try:
            soup = BeautifulSoup(html, "html.parser")
            
            # Extract product ID from URL
            product_id = self._extract_product_id_from_url(book_url)
            
            book_data = {
                "product_id": product_id,
                "name": None,
                "author": None,
                "publisher": None,
                "price": None,
                "category": None,
                "url": book_url if book_url.startswith("http") else f"https://www.eslite.com{book_url}"
            }
            
            # Extract book title
            # Try multiple selectors for title
            title_selectors = [
                "h1[class*='title']",
                "h1",
                "div[class*='title'] h1",
                "div[class*='product-name']",
                "span[class*='title']",
            ]
            
            for selector in title_selectors:
                title_elem = soup.select_one(selector)
                if title_elem:
                    title_text = self._clean_text(title_elem.get_text())
                    if title_text:
                        book_data["name"] = title_text
                        break
            
            # Extract author
            # Author is often in a specific section
            author_selectors = [
                "div[class*='author']",
                "span[class*='author']",
                "a[href*='author']",
                "li:contains('作者')",
            ]
            
            for selector in author_selectors:
                author_elem = soup.select_one(selector)
                if author_elem:
                    author_text = self._clean_text(author_elem.get_text())
                    # Remove common prefixes
                    author_text = re.sub(r"^作者[：:]\s*", "", author_text)
                    author_text = re.sub(r"^Author[：:]\s*", "", author_text, flags=re.IGNORECASE)
                    if author_text:
                        book_data["author"] = author_text
                        break
            
            # If author not found in dedicated element, search in all text
            if not book_data["author"]:
                page_text = soup.get_text()
                author_match = re.search(r"作者[：:]\s*([^\n\r]+)", page_text)
                if author_match:
                    book_data["author"] = self._clean_text(author_match.group(1))
            
            # Extract publisher
            publisher_selectors = [
                "div[class*='publisher']",
                "span[class*='publisher']",
                "a[href*='publisher']",
                "li:contains('出版社')",
            ]
            
            for selector in publisher_selectors:
                publisher_elem = soup.select_one(selector)
                if publisher_elem:
                    publisher_text = self._clean_text(publisher_elem.get_text())
                    # Remove common prefixes
                    publisher_text = re.sub(r"^出版社[：:]\s*", "", publisher_text)
                    publisher_text = re.sub(r"^Publisher[：:]\s*", "", publisher_text, flags=re.IGNORECASE)
                    if publisher_text:
                        book_data["publisher"] = publisher_text
                        break
            
            # If publisher not found in dedicated element, search in all text
            if not book_data["publisher"]:
                page_text = soup.get_text()
                publisher_match = re.search(r"出版社[：:]\s*([^\n\r]+)", page_text)
                if publisher_match:
                    book_data["publisher"] = self._clean_text(publisher_match.group(1))
            
            # Extract price
            price_selectors = [
                "span[class*='price']",
                "div[class*='price']",
                "strong[class*='price']",
                "li[class*='price']",
            ]
            
            for selector in price_selectors:
                price_elem = soup.select_one(selector)
                if price_elem:
                    price_text = self._clean_text(price_elem.get_text())
                    price_value = self._parse_price(price_text)
                    if price_value is not None:
                        book_data["price"] = price_value
                        break
            
            # If price not found in dedicated element, search in all text
            if not book_data["price"]:
                page_text = soup.get_text()
                price_match = re.search(r"(?:售價|價格|Price)[：:]\s*[NT$]?\s*(\d+(?:,\d+)*(?:\.\d+)?)", page_text)
                if price_match:
                    price_value = self._parse_price(price_match.group(0))
                    if price_value is not None:
                        book_data["price"] = price_value
            
            # Extract category
            # Category might be in breadcrumb navigation or category tags
            category_selectors = [
                "nav[class*='breadcrumb'] a",
                "div[class*='breadcrumb'] a",
                "span[class*='category']",
                "a[href*='/category/']",
            ]
            
            for selector in category_selectors:
                category_elem = soup.select_one(selector)
                if category_elem:
                    category_text = self._clean_text(category_elem.get_text())
                    if category_text and category_text not in ["首頁", "Home", "商品", "Product"]:
                        book_data["category"] = category_text
                        break
            
            # Validate that we have at least name (required field)
            if not book_data["name"]:
                return None
            
            return book_data
            
        except Exception as e:
            print(f"Error parsing book detail for {book_url}: {e}")
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
            link = element.find("a", href=re.compile(r"/(product|goods)/"))
            if not link:
                # Try to find any link in the element
                link = element.find("a")
            
            if not link:
                return None
            
            href = link.get("href", "")
            if not href:
                return None
            
            product_id = self._extract_product_id_from_url(href)
            
            if product_id or href:
                return {
                    "product_id": product_id or self._generate_id_from_url(href),
                    "url": href if href.startswith("http") else f"https://www.eslite.com{href}",
                    "title": self._clean_text(link.get_text())
                }
        except Exception as e:
            print(f"Error extracting book from listing element: {e}")
        
        return None
    
    def _extract_product_id_from_url(self, url: str) -> Optional[str]:
        """
        Extract product ID from Eslite.com URL
        
        Args:
            url: URL string (e.g., "/product/123456" or "https://www.eslite.com/product/123456")
            
        Returns:
            Product ID string, or None if not found
        """
        # Try to extract ID from URL patterns like /product/123456 or /goods/123456
        patterns = [
            r"/(?:product|goods)/(\d+)",
            r"/(?:product|goods)/([^/]+)",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        
        return None
    
    def _generate_id_from_url(self, url: str) -> str:
        """
        Generate a unique ID from URL if product ID cannot be extracted
        
        Args:
            url: URL string
            
        Returns:
            Generated ID string
        """
        # Use URL hash or path as ID
        import hashlib
        url_hash = hashlib.md5(url.encode()).hexdigest()[:12]
        return url_hash
    
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
        cleaned = re.sub(r"[特價定價售價價格Price]", "", price_text, flags=re.IGNORECASE)
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

