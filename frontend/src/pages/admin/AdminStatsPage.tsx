import { useEffect, useState, useRef } from 'react';
import { booksApi } from '../../api/booksApi';
import {
  TopBook,
  TopCategory,
  StatsByMembershipLevel,
  CategoryByLevel,
  StatsSummary,
} from '../../types';

// 添加動畫樣式
const animationStyles = `
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

// 數字動畫 Hook
function useAnimatedNumber(target: number, duration: number = 1500) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) {
      setDisplayValue(0);
      return;
    }

    startValueRef.current = displayValue;
    startTimeRef.current = null;

    const animate = (currentTime: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // 使用 easeOutCubic 緩動函數
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.floor(
        startValueRef.current + (target - startValueRef.current) * easeOutCubic
      );

      setDisplayValue(currentValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(target);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [target, duration]);

  return displayValue;
}

export function AdminStatsPage() {
  // 月份選擇器狀態（初始為空，需要用戶選擇）
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // 數據狀態
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [topBooks, setTopBooks] = useState<TopBook[]>([]);
  const [topCategories, setTopCategories] = useState<TopCategory[]>([]);
  const [statsByLevel, setStatsByLevel] = useState<StatsByMembershipLevel[]>([]);
  const [categoriesByLevel, setCategoriesByLevel] = useState<CategoryByLevel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 根據選定的月份計算開始和結束日期
  const getDateRange = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    return { startDate, endDate };
  };

  const loadData = async () => {
    if (!selectedMonth) {
      // 如果沒有選擇月份，清空數據
      setSummary(null);
      setTopBooks([]);
      setTopCategories([]);
      setStatsByLevel([]);
      setCategoriesByLevel([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = getDateRange(selectedMonth);
      const [summaryData, books, cats, byLevel, catsByLevel] = await Promise.all([
        booksApi.getStatsSummary(startDate, endDate),
        booksApi.getTopBooks(20, startDate, endDate),
        booksApi.getTopCategories(20, startDate, endDate),
        booksApi.getStatsByMembershipLevel(startDate, endDate),
        booksApi.getCategoriesByLevel(20, startDate, endDate),
      ]);
      setSummary(summaryData);
      setTopBooks(books);
      setTopCategories(cats);
      setStatsByLevel(byLevel);
      setCategoriesByLevel(catsByLevel);
    } catch (e: any) {
      setError(e.message || '載入統計資料失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedMonth(e.target.value);
  };

  // 按類別分組熱門類別按等級的數據
  const categoriesGrouped = categoriesByLevel.reduce((acc, item) => {
    if (!acc[item.category_id]) {
      acc[item.category_id] = {
        category_id: item.category_id,
        category_name: item.category_name,
        levels: [],
      };
    }
    acc[item.category_id].levels.push(item);
    return acc;
  }, {} as Record<number, { category_id: number; category_name: string; levels: CategoryByLevel[] }>);

  return (
    <>
      <style>{animationStyles}</style>
      <div className="card" style={{ 
        animation: 'fadeIn 0.4s ease-out',
      }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', margin: 0, marginBottom: '0.25rem', color: '#111827' }}>報表 / 統計</h1>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>查看各月份的營收與借書統計數據</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '1rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#111827' }}>
            <span>選擇月份：</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={handleMonthChange}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                backgroundColor: 'white',
                color: '#111827',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#10b981';
                e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.boxShadow = 'none';
              }}
            />
          </label>
        </div>
        {!selectedMonth && (
          <div style={{ 
            marginTop: '1.5rem', 
            padding: '1rem', 
            backgroundColor: '#f9fafb', 
            borderRadius: '8px', 
            textAlign: 'center',
            animation: 'fadeIn 0.3s ease-out',
          }}>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#6b7280' }}>請選擇月份以查看統計數據</p>
          </div>
        )}
        {selectedMonth && loading && (
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <div style={{ 
              display: 'inline-block', 
              padding: '0.5rem 1rem', 
              backgroundColor: '#f9fafb', 
              borderRadius: '8px',
              color: '#6b7280',
            }}>
              載入中...
            </div>
          </div>
        )}
        {selectedMonth && error && (
          <div style={{ 
            marginTop: '1.5rem', 
            padding: '1rem', 
            backgroundColor: '#fef2f2', 
            borderRadius: '8px', 
            color: '#dc2626',
            border: '1px solid #fecaca',
            animation: 'fadeIn 0.3s ease-out',
          }}>
            {error}
          </div>
        )}
      </div>

      {/* 綜合統計摘要 - 只在選擇月份且有數據時顯示 */}
      {selectedMonth && summary && <StatsSummaryCards summary={summary} />}

      {/* 按會員等級統計 - 只在選擇月份且有數據時顯示 */}
      {selectedMonth && statsByLevel.length > 0 && (
        <div className="card" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
          <div className="card-title">按會員等級統計</div>
          <table className="table">
            <thead>
              <tr>
                <th>會員等級</th>
                <th>借閱次數</th>
                <th>參與會員數</th>
                <th>平均每人借閱次數</th>
              </tr>
            </thead>
            <tbody>
              {statsByLevel.map((item) => (
                <tr key={item.level_id}>
                  <td>{item.level_name}</td>
                  <td>{item.borrow_count}</td>
                  <td>{item.member_count}</td>
                  <td>
                    {item.member_count > 0
                      ? (item.borrow_count / item.member_count).toFixed(2)
                      : '0.00'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 熱門書籍 - 只在選擇月份時顯示 */}
      {selectedMonth && (
        <div className="card">
          <div className="card-title">熱門書籍（依借閱次數）</div>
          {topBooks.length === 0 && !loading && <div className="text-muted">沒有資料。</div>}
          {topBooks.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>排名</th>
                <th>書名</th>
                <th>作者</th>
                <th>出版社</th>
                <th>借閱次數</th>
              </tr>
            </thead>
            <tbody>
              {topBooks.map((b, index) => (
                <tr key={b.book_id}>
                  <td>{index + 1}</td>
                  <td>{b.name}</td>
                  <td>{b.author}</td>
                  <td>{b.publisher || '-'}</td>
                  <td>{b.borrow_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      )}

      {/* 熱門類別 - 只在選擇月份時顯示 */}
      {selectedMonth && (
        <div className="card" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
          <div className="card-title">熱門類別（依借閱次數）</div>
          {topCategories.length === 0 && !loading && <div className="text-muted">沒有資料。</div>}
          {topCategories.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>排名</th>
                <th>類別</th>
                <th>借閱次數</th>
              </tr>
            </thead>
            <tbody>
              {topCategories.map((c, index) => (
                <tr key={c.category_id}>
                  <td>{index + 1}</td>
                  <td>{c.name}</td>
                  <td>{c.borrow_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      )}

      {/* 熱門類別按會員等級分組 - 只在選擇月份且有數據時顯示 */}
      {selectedMonth && Object.keys(categoriesGrouped).length > 0 && (
        <div className="card" style={{ animation: 'fadeInUp 0.5s ease-out' }}>
          <div className="card-title">熱門類別按會員等級分組</div>
          {Object.values(categoriesGrouped).map((group) => (
            <div key={group.category_id} style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ marginBottom: '0.5rem', fontSize: '1rem', fontWeight: 'bold' }}>
                {group.category_name}
              </h4>
              <table className="table" style={{ marginLeft: '1rem' }}>
                <thead>
                  <tr>
                    <th>會員等級</th>
                    <th>借閱次數</th>
                  </tr>
                </thead>
                <tbody>
                  {group.levels.map((item) => (
                    <tr key={`${item.category_id}-${item.level_id}`}>
                      <td>{item.level_name}</td>
                      <td>{item.borrow_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// 統計摘要卡片組件（帶數字動畫）
function StatsSummaryCards({ summary }: { summary: StatsSummary }) {
  const animatedBorrows = useAnimatedNumber(summary.summary.total_borrows);
  const animatedRevenue = useAnimatedNumber(summary.summary.total_revenue);
  const animatedMembers = useAnimatedNumber(summary.summary.active_members);
  const animatedBooks = useAnimatedNumber(summary.summary.unique_books);

  const statCards = [
    {
      title: '總借閱次數',
      value: animatedBorrows,
    },
    {
      title: '總收入',
      value: `$${animatedRevenue.toLocaleString()}`,
    },
    {
      title: '活躍會員數',
      value: animatedMembers,
    },
    {
      title: '借閱書籍種類數',
      value: animatedBooks,
    },
  ];

  return (
    <div className="card" style={{ 
      padding: '0',
      animation: 'fadeInUp 0.5s ease-out',
    }}>
      <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0, color: '#111827' }}>統計摘要</h2>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
          {summary.period.start_date} 至 {summary.period.end_date}
        </p>
      </div>
      <div style={{ 
        display: 'flex', 
        gap: '1rem',
        padding: '1.5rem',
        flexWrap: 'nowrap',
      }}>
        {statCards.map((card, index) => (
          <div
            key={index}
            style={{
              flex: '1',
              background: '#f9fafb',
              borderRadius: '8px',
              padding: '1.25rem',
              transition: 'all 0.2s ease',
              cursor: 'default',
              animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f3f4f6';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f9fafb';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ 
              fontSize: '0.875rem', 
              color: '#6b7280', 
              marginBottom: '0.5rem', 
              fontWeight: '500',
            }}>
              {card.title}
            </div>
            <div style={{ 
              fontSize: '1.75rem', 
              fontWeight: '700', 
              lineHeight: '1.2',
              wordBreak: 'break-word',
              color: '#111827',
            }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


