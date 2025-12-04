"""
Main entry point for the Open Library book scraper
"""

from scraper import BookScraper
import sys


def main():
    """
    Main function to run the book scraper
    """
    try:
        scraper = BookScraper()
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

