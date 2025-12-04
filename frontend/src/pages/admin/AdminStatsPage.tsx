import { useEffect, useState } from 'react';
import { booksApi } from '../../api/booksApi';
import { TopBook, TopCategory } from '../../types';

export function AdminStatsPage() {
  const [topBooks, setTopBooks] = useState<TopBook[]>([]);
  const [topCategories, setTopCategories] = useState<TopCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [books, cats] = await Promise.all([
          booksApi.getTopBooks(20),
          booksApi.getTopCategories(20),
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
        <div className="card-title">報表 / 統計</div>
        {loading && <div className="text-muted">載入中...</div>}
        {error && <div className="error-text">{error}</div>}
      </div>
      <div className="card">
        <div className="card-title">熱門書籍（依借閱次數）</div>
        {topBooks.length === 0 && !loading && <div className="text-muted">沒有資料。</div>}
        {topBooks.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>書名</th>
                <th>作者</th>
                <th>借閱次數</th>
              </tr>
            </thead>
            <tbody>
              {topBooks.map((b) => (
                <tr key={b.book_id}>
                  <td>{b.name}</td>
                  <td>{b.author}</td>
                  <td>{b.borrow_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card">
        <div className="card-title">熱門類別（依借閱次數）</div>
        {topCategories.length === 0 && !loading && <div className="text-muted">沒有資料。</div>}
        {topCategories.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>類別</th>
                <th>借閱次數</th>
              </tr>
            </thead>
            <tbody>
              {topCategories.map((c) => (
                <tr key={c.category_id}>
                  <td>{c.name}</td>
                  <td>{c.borrow_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}


