"""
Search strategy module for generating search queries
Defines subjects, authors, and keywords for mixed search strategy
"""

# Popular subjects/categories for book search
SUBJECTS = [
    "Fiction",
    "Science",
    "History",
    "Biography",
    "Technology",
    "Philosophy",
    "Literature",
    "Art",
    "Mathematics",
    "Psychology",
    "Business",
    "Education",
    "Travel",
    "Cooking",
    "Health",
    "Religion",
    "Poetry",
    "Drama",
    "Mystery",
    "Romance"
]

# Popular authors for book search
AUTHORS = [
    "Stephen King",
    "J.K. Rowling",
    "George Orwell",
    "Jane Austen",
    "Ernest Hemingway",
    "Mark Twain",
    "Charles Dickens",
    "William Shakespeare",
    "Agatha Christie",
    "Isaac Asimov",
    "J.R.R. Tolkien",
    "Harper Lee",
    "F. Scott Fitzgerald",
    "Virginia Woolf",
    "Toni Morrison",
    "Maya Angelou",
    "Gabriel Garcia Marquez",
    "Milan Kundera",
    "Kazuo Ishiguro",
    "Haruki Murakami"
]

# General keywords for book search
KEYWORDS = [
    "best books",
    "classic literature",
    "popular books",
    "award winning",
    "bestseller",
    "must read",
    "recommended",
    "famous books",
    "great novels",
    "literary classics",
    "contemporary fiction",
    "modern literature",
    "essential reading",
    "book club",
    "top rated"
]


class SearchStrategy:
    """
    Class to manage search queries for bulk book scraping
    Generates search queries based on subjects, authors, and keywords
    """
    
    def __init__(self):
        self.subjects = SUBJECTS
        self.authors = AUTHORS
        self.keywords = KEYWORDS
    
    def get_subject_queries(self):
        """
        Generate search queries for subjects
        Returns list of query dictionaries with type and value
        """
        queries = []
        for subject in self.subjects:
            queries.append({
                "type": "subject",
                "value": subject,
                "query": f"subject:{subject}"
            })
        return queries
    
    def get_author_queries(self):
        """
        Generate search queries for authors
        Returns list of query dictionaries with type and value
        """
        queries = []
        for author in self.authors:
            queries.append({
                "type": "author",
                "value": author,
                "query": f"author:{author}"
            })
        return queries
    
    def get_keyword_queries(self):
        """
        Generate search queries for keywords
        Returns list of query dictionaries with type and value
        """
        queries = []
        for keyword in self.keywords:
            queries.append({
                "type": "keyword",
                "value": keyword,
                "query": keyword
            })
        return queries
    
    def get_all_queries(self):
        """
        Get all search queries (subjects, authors, keywords)
        Returns combined list of all query dictionaries
        """
        all_queries = []
        all_queries.extend(self.get_subject_queries())
        all_queries.extend(self.get_author_queries())
        all_queries.extend(self.get_keyword_queries())
        return all_queries

