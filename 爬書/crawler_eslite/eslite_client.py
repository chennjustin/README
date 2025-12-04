"""
Eslite.com website client module
Handles browser automation using Playwright to interact with the Eslite.com website
Eslite.com uses Vue.js to dynamically load content, so we need a browser to render JavaScript
"""

import time
import random
from typing import Dict, List, Optional
from playwright.sync_api import sync_playwright, Browser, Page, BrowserContext
import config


class EsliteClient:
    """
    Client for interacting with Eslite.com website using Playwright
    Handles browser automation to wait for JavaScript-rendered content
    """
    
    def __init__(self):
        self.base_url = config.ESLITE_BASE_URL
        self.request_delay = config.REQUEST_DELAY
        self.random_delay_range = config.RANDOM_DELAY_RANGE
        self.timeout = getattr(config, 'PLAYWRIGHT_TIMEOUT', 60000)
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self._init_browser()
        
    def _init_browser(self):
        """
        Initialize Playwright browser instance
        """
        try:
            self.playwright = sync_playwright().start()
            # Launch browser in headless mode (set to False for debugging)
            self.browser = self.playwright.chromium.launch(
                headless=True,
                args=['--disable-blink-features=AutomationControlled']
            )
            
            # Create browser context with realistic settings
            self.context = self.browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent=config.USER_AGENT,
                locale='zh-TW',
                timezone_id='Asia/Taipei',
            )
            
            self.page = self.context.new_page()
            
            # Set extra headers
            self.page.set_extra_http_headers({
                "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
            })
            
        except Exception as e:
            print(f"Error initializing browser: {e}")
            print("Make sure Playwright is installed: pip install playwright && playwright install chromium")
            raise
    
    def _random_delay(self):
        """
        Add random delay between requests to avoid pattern detection
        """
        delay = random.uniform(*self.random_delay_range)
        time.sleep(delay)
    
    def fetch_page(self, url: str, wait_selector: Optional[str] = None, wait_timeout: Optional[int] = None) -> Optional[str]:
        """
        Fetch a web page using Playwright and wait for content to load
        
        Args:
            url: URL to fetch
            wait_selector: CSS selector to wait for (optional, will try common selectors if not provided)
            wait_timeout: Maximum time to wait in milliseconds (default: from config)
            
        Returns:
            HTML content as string after JavaScript execution, or None if failed
        """
        try:
            self._random_delay()
            
            if wait_timeout is None:
                wait_timeout = self.timeout
            
            # Navigate to page - use 'domcontentloaded' instead of 'networkidle'
            # 'networkidle' can timeout if there are continuous requests (analytics, ads, etc.)
            # 'domcontentloaded' waits for DOM to be ready, then we'll wait for specific content
            try:
                self.page.goto(url, wait_until='domcontentloaded', timeout=wait_timeout)
            except Exception as e:
                print(f"  Warning: Navigation timeout or error: {e}")
                # Continue anyway, might still have content
            
            # Wait for content to load - try multiple selectors
            content_loaded = False
            
            if wait_selector:
                try:
                    self.page.wait_for_selector(wait_selector, timeout=20000, state='visible')
                    content_loaded = True
                except Exception:
                    pass  # Continue to try other selectors
            
            if not content_loaded:
                # Try common selectors for product listings
                common_selectors = [
                    'a[href*="/product/"]',
                    'a[href*="/goods/"]',
                    'a[href*="/item/"]',
                    '[class*="product"]',
                    '[class*="item"]',
                    '[data-product-id]',
                    '[data-item-id]',
                ]
                
                for selector in common_selectors:
                    try:
                        # Wait for at least one element to be visible
                        self.page.wait_for_selector(selector, timeout=10000, state='visible')
                        content_loaded = True
                        break
                    except Exception:
                        continue
            
            # If still no content found, wait a bit more for Vue to render
            if not content_loaded:
                print(f"  Warning: No product selectors found, waiting for Vue.js to render...")
                time.sleep(3)  # Give Vue.js more time to render
            
            # Get the rendered HTML
            html = self.page.content()
            
            # Debug: Check if we got meaningful content
            if len(html) < 1000:
                print(f"  Warning: Received very short HTML ({len(html)} chars) from {url}")
            
            return html
            
        except Exception as e:
            print(f"Error fetching {url}: {e}")
            return None
    
    def get_category_page(self, category_url: str, page: int = 1) -> Optional[str]:
        """
        Get a category listing page
        
        Args:
            category_url: Full category URL from config
            page: Page number (1-indexed)
            
        Returns:
            HTML content of the category page after JavaScript rendering
        """
        # Handle pagination
        import re
        if page == 1:
            url = category_url
        elif "page=" in category_url:
            url = re.sub(r"page=\d+", f"page={page}", category_url)
        elif "?" in category_url:
            url = f"{category_url}&page={page}"
        else:
            url = f"{category_url}?page={page}"
        
        # Wait for product links to appear - try multiple patterns
        # Don't specify wait_selector, let it try all common selectors
        return self.fetch_page(url, wait_selector=None)
    
    def get_book_detail_page(self, book_url: str) -> Optional[str]:
        """
        Get a book detail page
        
        Args:
            book_url: Full URL to the book detail page
            
        Returns:
            HTML content of the book detail page after JavaScript rendering
        """
        # Ensure URL is absolute
        if not book_url.startswith("http"):
            book_url = f"{self.base_url}{book_url}"
        
        # Wait for book title or detail content to appear
        return self.fetch_page(book_url, wait_selector='h1, [class*="title"], [class*="product-name"]')
    
    def close(self):
        """
        Close the browser and cleanup
        """
        try:
            if self.page:
                self.page.close()
            if self.context:
                self.context.close()
            if self.browser:
                self.browser.close()
            if self.playwright:
                self.playwright.stop()
        except Exception as e:
            print(f"Error closing browser: {e}")

