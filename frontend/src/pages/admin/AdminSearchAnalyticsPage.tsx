import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';
import { searchHistoryApi, SearchAnalytics } from '../../api/searchHistoryApi';
import { booksApi } from '../../api/booksApi';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Cell,
} from 'recharts';

export function AdminSearchAnalyticsPage() {
  const { admin } = useAdmin();
  const [analytics, setAnalytics] = useState<SearchAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [bookNames, setBookNames] = useState<Record<number, string>>({});
  const [categoryNames, setCategoryNames] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!admin) {
      setError('請先登入管理員');
      return;
    }

    const loadAnalytics = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await searchHistoryApi.getAnalytics(days, 20);
        setAnalytics(data);

        // 載入書籍名稱
        const bookIds = data.top_books.map((b) => b.book_id);
        if (bookIds.length > 0) {
          try {
            const books = await Promise.all(
              bookIds.map(async (bookId) => {
                try {
                  const book = await booksApi.getDetail(bookId);
                  return { bookId, name: book.name };
                } catch {
                  return { bookId, name: `書籍 ID: ${bookId}` };
                }
              })
            );
            const nameMap: Record<number, string> = {};
            books.forEach((b) => {
              nameMap[b.bookId] = b.name;
            });
            setBookNames(nameMap);
          } catch (e) {
            console.error('Failed to load book names:', e);
          }
        }

        // 載入分類名稱
        const categoryIds = data.top_categories?.map((c) => c.category_id) || [];
        if (categoryIds.length > 0) {
          try {
            const categories = await booksApi.getCategories();
            const categoryMap: Record<number, string> = {};
            categories.forEach((cat) => {
              categoryMap[cat.category_id] = cat.name;
            });
            setCategoryNames(categoryMap);
          } catch (e) {
            console.error('Failed to load category names:', e);
          }
        }
      } catch (e: any) {
        setError(e.message || '載入分析資料失敗');
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [admin, days]);

  // 準備圖表數據（只顯示前 10 名）
  const chartKeywords = analytics?.top_keywords.slice(0, 10) || [];
  
  // 如果數據超過 10 筆，在圖表下方顯示提示
  const hasMoreKeywords = (analytics?.top_keywords.length || 0) > 10;

  return (
    <div>
      <div className="card">
        <div className="card-title">搜尋趨勢分析</div>
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>分析期間：</span>
            <select
              className="form-input"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              style={{ width: '150px' }}
            >
              <option value={7}>最近 7 天</option>
              <option value={30}>最近 30 天</option>
              <option value={60}>最近 60 天</option>
              <option value={90}>最近 90 天</option>
            </select>
          </label>
        </div>
        {loading && <div className="text-muted">載入中...</div>}
        {error && <div className="error-text">{error}</div>}
        {!loading && !error && analytics && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>總搜尋次數</div>
              <div style={{ fontSize: '2rem', fontWeight: '600', color: 'var(--primary-green)' }}>
                {analytics.total_searches}
              </div>
            </div>
            <div style={{ padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>活躍會員數</div>
              <div style={{ fontSize: '2rem', fontWeight: '600', color: 'var(--primary-green)' }}>
                {analytics.active_members}
              </div>
            </div>
          </div>
        )}
      </div>

      {!loading && !error && analytics && (
        <>
          {/* 最熱門的搜尋關鍵詞 - 長條圖 */}
          <div className="card">
            <div className="card-title">最熱門的搜尋關鍵詞</div>
            {analytics.top_keywords.length === 0 ? (
              <div className="text-muted">目前沒有資料。</div>
            ) : (
              <div style={{ marginTop: '1rem', width: '100%', height: '400px' }}>
                <ResponsiveContainer>
                  <BarChart
                    data={chartKeywords}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                  >
                    <XAxis type="number" />
                    <YAxis
                      type="category"
                      dataKey="keyword"
                      width={100}
                      tick={{ fontSize: 12 }}
                      interval={0}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value} 次`, '搜尋次數']}
                      labelStyle={{ color: '#111827' }}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="#10b981" 
                      radius={[0, 4, 4, 0]}
                      barSize={30}
                    >
                      {chartKeywords.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="#10b981" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {hasMoreKeywords && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666', textAlign: 'center' }}>
                    僅顯示前 10 名，共 {analytics.top_keywords.length} 筆關鍵詞
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 最常被搜尋的書籍 - 可點擊 */}
          <div className="card">
            <div className="card-title">最常被搜尋的書籍</div>
            {analytics.top_books.length === 0 ? (
              <div className="text-muted">目前沒有資料。</div>
            ) : (
              <table className="table" style={{ marginTop: '1rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>排名</th>
                    <th>書籍名稱</th>
                    <th style={{ width: '100px' }}>搜尋次數</th>
                    <th style={{ width: '180px' }}>最後搜尋時間</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.top_books.map((item, index) => (
                    <tr key={item.book_id}>
                      <td>{index + 1}</td>
                      <td>
                        <Link
                          to={`/admin/books/${item.book_id}`}
                          style={{
                            color: 'var(--primary-green)',
                            textDecoration: 'none',
                            fontWeight: '500',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.textDecoration = 'underline';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.textDecoration = 'none';
                          }}
                        >
                          {bookNames[item.book_id] || `書籍 ID: ${item.book_id}`}
                        </Link>
                      </td>
                      <td>{item.count}</td>
                      <td>{new Date(item.last_searched).toLocaleString('zh-TW')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 搜尋趨勢（按日期） - 折線圖 */}
          <div className="card">
            <div className="card-title">搜尋趨勢（按日期）</div>
            {analytics.search_trends.length === 0 ? (
              <div className="text-muted">目前沒有資料。</div>
            ) : (
              <div style={{ marginTop: '1rem', width: '100%', height: '300px' }}>
                <ResponsiveContainer>
                  <LineChart data={analytics.search_trends} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) => [`${value} 次`, '搜尋次數']}
                      labelStyle={{ color: '#111827' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: '#10b981', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 篩選條件統計 */}
          {(analytics.top_categories?.length > 0 || analytics.price_ranges?.length > 0) && (
            <div className="card">
              <div className="card-title">最常用的篩選條件</div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '1.5rem',
                  marginTop: '1rem',
                }}
              >
                {/* 最常用的分類 */}
                {analytics.top_categories && analytics.top_categories.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem', fontWeight: '600' }}>
                      最常用的分類
                    </h4>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {analytics.top_categories.map((cat, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '0.75rem',
                            borderBottom: '1px solid #e5e7eb',
                            backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb',
                          }}
                        >
                          <span>
                            {categoryNames[cat.category_id] || `分類 ID: ${cat.category_id}`}
                          </span>
                          <span style={{ color: '#666', fontWeight: '500' }}>{cat.count} 次</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 價格範圍使用頻率 */}
                {analytics.price_ranges && analytics.price_ranges.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem', fontWeight: '600' }}>
                      價格範圍使用頻率
                    </h4>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {analytics.price_ranges.map((range, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '0.75rem',
                            borderBottom: '1px solid #e5e7eb',
                            backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb',
                          }}
                        >
                          <span>
                            {range.min_price === 0 && range.max_price === 999999
                              ? '無限制'
                              : range.min_price === 0
                              ? `$0 - $${range.max_price}`
                              : range.max_price === 999999
                              ? `$${range.min_price} 以上`
                              : `$${range.min_price} - $${range.max_price}`}
                          </span>
                          <span style={{ color: '#666', fontWeight: '500' }}>{range.count} 次</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
