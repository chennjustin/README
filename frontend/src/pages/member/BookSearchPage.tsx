import { useEffect, useState } from 'react';
import { booksApi } from '../../api/booksApi';
import { useMember } from '../../context/MemberContext';
import { BookSummary } from '../../types';
import { Link } from 'react-router-dom';

export function BookSearchPage() {
  const { memberId } = useMember();
  const [keyword, setKeyword] = useState('');
  const [author, setAuthor] = useState('');
  const [publisher, setPublisher] = useState('');
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await booksApi.search({
        keyword,
        author,
        publisher,
        memberId: memberId ?? undefined,
      });
      setBooks(data);
    } catch (e: any) {
      setError(e.message);
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="card">
        <div className="card-title">書籍搜尋</div>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">書名關鍵字</label>
            <input
              className="form-input"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">作者</label>
            <input
              className="form-input"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">出版社</label>
            <input
              className="form-input"
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
            />
          </div>
        </div>
        <button className="btn btn-primary" onClick={search} disabled={loading}>
          搜尋
        </button>
        {error && <div className="error-text">{error}</div>}
      </div>

      <div className="card">
        <div className="card-title">搜尋結果</div>
        {loading && <div className="text-muted">載入中...</div>}
        {!loading && books.length === 0 && <div className="text-muted">目前沒有資料。</div>}
        {books.length > 0 && (
          <div className="book-grid">
            {books.map((b) => {
              const isAvailable = b.available_count > 0;
              const rentalPrice = b.estimated_min_rental_price != null
                ? Math.round(b.estimated_min_rental_price)
                : null;
              
              return (
                <Link
                  key={b.book_id}
                  to={`/member/books/${b.book_id}`}
                  className={`book-card ${!isAvailable ? 'book-card-unavailable' : ''}`}
                >
                  <div className="book-card-title">{b.name}</div>
                  <div className="book-card-author">{b.author}</div>
                  {b.categories && b.categories.length > 0 && (
                    <div className="book-card-categories">
                      {b.categories.map((c) => (
                        <span key={c.category_id} className="book-card-tag">
                          {c.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="book-card-footer">
                    <span className={`book-card-status ${isAvailable ? 'book-card-status-available' : ''}`}>
                      {isAvailable ? '可借' : '不可借'}
                    </span>
                    <span className="book-card-price">
                      {rentalPrice ? `TWD ${rentalPrice}` : '-'}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}


