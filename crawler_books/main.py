"""
Main entry point for the Books.com.tw book scraper
"""

from scraper import BooksComTwScraper
import sys


def main():
    """
    Main function to run the book scraper
    """
    try:
        scraper = BooksComTwScraper()
        scraper.run()
    except KeyboardInterrupt:
        print("\n\nScraping interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nFatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

