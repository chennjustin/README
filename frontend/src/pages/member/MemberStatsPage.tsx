import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { booksApi } from '../../api/booksApi';
import { TopBook, TopCategory } from '../../types';

export function MemberStatsPage() {
  const [topBooks, setTopBooks] = useState<TopBook[]>([]);
  const [topCategories, setTopCategories] = useState<TopCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // 計算當月的開始和結束日期
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const startDate = new Date(year, month, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

        const [books, cats] = await Promise.all([
          booksApi.getTopBooks(10, startDate, endDate),
          booksApi.getTopCategories(10, startDate, endDate),
        ]);
        setTopBooks(books);
        setTopCategories(cats);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <>
      <div className="card">
        <div className="card-title">熱門書籍（本月）</div>
        {loading && <div className="text-muted">載入中...</div>}
        {error && <div className="error-text">{error}</div>}
        {topBooks.length === 0 && !loading && !error && <div className="text-muted">沒有資料。</div>}
        {topBooks.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>排名</th>
                <th>書名</th>
                <th>作者</th>
                <th>出版社</th>
              </tr>
            </thead>
            <tbody>
              {topBooks.map((b, index) => (
                <tr key={b.book_id}>
                  <td>{index + 1}</td>
                  <td>
                    <Link to={`/member/books/${b.book_id}`} className="link">
                      {b.name}
                    </Link>
                  </td>
                  <td>{b.author}</td>
                  <td>{b.publisher || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card">
        <div className="card-title">熱門類別（本月）</div>
        {loading && <div className="text-muted">載入中...</div>}
        {error && <div className="error-text">{error}</div>}
        {topCategories.length === 0 && !loading && !error && <div className="text-muted">沒有資料。</div>}
        {topCategories.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>排名</th>
                <th>類別</th>
              </tr>
            </thead>
            <tbody>
              {topCategories.map((c, index) => (
                <tr key={c.category_id}>
                  <td>{index + 1}</td>
                  <td>
                    <Link to={`/member/books?categoryId=${c.category_id}`} className="link">
                      {c.name}
                    </Link>
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


