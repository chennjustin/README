"""
Debug script to inspect HTML structure from Eslite.com category pages
"""

from eslite_client import EsliteClient
from bs4 import BeautifulSoup
import config

def debug_category_page():
    """
    Fetch and analyze HTML structure of a category page
    """
    client = EsliteClient()
    
    # Test with first category
    if config.ESLITE_CATEGORIES:
        category_name, category_url, _ = config.ESLITE_CATEGORIES[0]
        print(f"Testing category: {category_name}")
        print(f"URL: {category_url}\n")
        
        # Fetch page
        html = client.get_category_page(category_url, 1)
        
        if not html:
            print("Failed to fetch HTML")
            return
        
        print(f"HTML length: {len(html)} characters\n")
        
        # Save HTML to file for inspection
        with open("debug_html_output.html", "w", encoding="utf-8") as f:
            f.write(html)
        print("HTML saved to debug_html_output.html\n")
        
        # Parse and analyze structure
        soup = BeautifulSoup(html, "html.parser")
        
        # Check for common patterns
        print("=== Checking for common patterns ===\n")
        
        # Check for product/item containers
        product_divs = soup.find_all("div", class_=lambda x: x and ("product" in x.lower() or "item" in x.lower()))
        print(f"Divs with 'product' or 'item' in class: {len(product_divs)}")
        
        # Check for links
        all_links = soup.find_all("a", href=True)
        print(f"Total links found: {len(all_links)}")
        
        # Check for product links
        product_links = [a for a in all_links if "/product/" in a.get("href", "") or "/goods/" in a.get("href", "")]
        print(f"Product/goods links: {len(product_links)}")
        
        if product_links:
            print("\nFirst 5 product links:")
            for i, link in enumerate(product_links[:5], 1):
                print(f"  {i}. {link.get('href')} - {link.get_text()[:50]}")
        
        # Check for common container classes
        print("\n=== Checking for common container classes ===")
        common_classes = ["product", "item", "book", "goods", "card", "list"]
        for class_name in common_classes:
            elements = soup.find_all(class_=lambda x: x and class_name in str(x).lower())
            if elements:
                print(f"Elements with '{class_name}' in class: {len(elements)}")
                # Show first element's structure
                if elements:
                    print(f"  First element tag: {elements[0].name}, classes: {elements[0].get('class')}")
        
        # Check for script tags (might indicate JavaScript loading)
        scripts = soup.find_all("script")
        print(f"\nScript tags found: {len(scripts)}")
        
        # Check for data attributes that might contain product info
        data_attrs = soup.find_all(attrs={"data-product-id": True})
        print(f"Elements with data-product-id: {len(data_attrs)}")
        
        # Look for any JSON data in script tags
        print("\n=== Checking for JSON data in scripts ===")
        for script in scripts:
            if script.string and ("product" in script.string.lower() or "book" in script.string.lower()):
                print(f"Found script with product/book keywords (length: {len(script.string)})")
                # Show first 200 chars
                print(f"  Preview: {script.string[:200]}...")
        
        client.close()

if __name__ == "__main__":
    debug_category_page()

