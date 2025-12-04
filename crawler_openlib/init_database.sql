-- Database initialization script for rental bookstore system
-- Creates the books table and necessary indexes

-- Create database (run this manually if database doesn't exist)
-- CREATE DATABASE rental_bookstore;

-- Connect to the database and create table
CREATE TABLE IF NOT EXISTS books (
    book_id VARCHAR(255) PRIMARY KEY,
    name TEXT NOT NULL,
    publisher TEXT,
    author TEXT,
    price NUMERIC(10, 2) DEFAULT 0,
    isbn VARCHAR(20),
    open_library_id VARCHAR(255),
    source_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_isbn ON books(isbn);
CREATE INDEX IF NOT EXISTS idx_open_library_id ON books(open_library_id);
CREATE INDEX IF NOT EXISTS idx_author ON books(author);
CREATE INDEX IF NOT EXISTS idx_publisher ON books(publisher);

-- Add comment to table
COMMENT ON TABLE books IS 'Stores book information scraped from Open Library API';

