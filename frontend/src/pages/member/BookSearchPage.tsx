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
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>書名</th>
                <th>作者</th>
                <th>出版社</th>
                <th>分類</th>
                <th>可借本數</th>
                <th>預估最低租金</th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.book_id}>
                  <td>{b.book_id}</td>
                  <td>
                    <Link to={`/member/books/${b.book_id}`}>{b.name}</Link>
                  </td>
                  <td>{b.author}</td>
                  <td>{b.publisher}</td>
                  <td>
                    {b.categories?.map((c) => (
                      <span key={c.category_id} className="tag">
                        {c.name}
                      </span>
                    ))}
                  </td>
                  <td>{b.available_count}</td>
                  <td>
                    {b.estimated_min_rental_price != null
                      ? Math.round(b.estimated_min_rental_price)
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}


