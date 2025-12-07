import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { useAdmin } from '../../context/AdminContext';
import { formatDate } from '../../utils/dateFormat';

export function AdminReservationsPage() {
  const { token } = useAdmin();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Active');
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Search related state
  const [searchType, setSearchType] = useState<'member_id' | 'book_name'>('member_id');
  const [searchValue, setSearchValue] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeSearchParams, setActiveSearchParams] = useState<{ member_id?: number; book_name?: string } | undefined>(undefined);

  const load = async () => {
    if (!token) {
      setError('請先在管理端登入頁登入。');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getReservations(token, status, activeSearchParams);
      setData(res as any[]);
    } catch (e: any) {
      // Handle authentication errors specially
      if (e.name === 'AuthenticationError' || e.message?.includes('UNAUTHORIZED')) {
        setError('登入已過期，請重新登入');
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status, activeSearchParams]);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      setSearchError('請先在管理端登入頁登入。');
      return;
    }
    
    setSearchLoading(true);
    setSearchError(null);
    
    try {
      let searchParams: { member_id?: number; book_name?: string } | undefined;
      
      if (searchType === 'member_id') {
        const memberId = Number(searchValue);
        if (!Number.isFinite(memberId)) {
          setSearchError('請輸入有效的 Member ID。');
          setSearchLoading(false);
          return;
        }
        searchParams = { member_id: memberId };
      } else {
        // book_name
        if (!searchValue.trim()) {
          setSearchError('請輸入書名。');
          setSearchLoading(false);
          return;
        }
        searchParams = { book_name: searchValue.trim() };
      }
      
      setActiveSearchParams(searchParams);
    } catch (e: any) {
      setSearchError(e.message || '搜尋失敗');
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchValue('');
    setActiveSearchParams(undefined);
    setSearchError(null);
  };

  const handleBorrow = (reservation: any) => {
    // Navigate to borrow page with reservation data
    navigate('/admin/loans/borrow', {
      state: {
        fromReservation: true,
        member_id: reservation.member_id,
        member_name: reservation.member_name,
        books: reservation.books, // [{ book_id, name, author, publisher }]
      },
    });
  };

  return (
    <div className="card">
      <div className="card-title">預約管理</div>
      
      {/* Status filter */}
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">狀態</label>
          <select
            className="form-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="Active">Active</option>
            <option value="Fulfilled">Fulfilled</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Search Section */}
      <div style={{ marginBottom: '2rem', marginTop: '1rem' }}>
        <form onSubmit={handleSearch}>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">搜尋類型</label>
              <select
                className="form-select"
                value={searchType}
                onChange={(e) => {
                  setSearchType(e.target.value as 'member_id' | 'book_name');
                  setSearchValue('');
                  setActiveSearchParams(undefined);
                  setSearchError(null);
                }}
              >
                <option value="member_id">Member ID</option>
                <option value="book_name">書名</option>
              </select>
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">
                {searchType === 'member_id' ? 'Member ID' : '書名'}
              </label>
              <input
                className="form-input"
                type={searchType === 'member_id' ? 'number' : 'text'}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={`請輸入${searchType === 'member_id' ? 'Member ID' : '書名'}`}
              />
            </div>
            <div className="form-field" style={{ alignSelf: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={searchLoading}>
                {searchLoading ? '搜尋中...' : '搜尋'}
              </button>
            </div>
            {activeSearchParams && (
              <div className="form-field" style={{ alignSelf: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={clearSearch}
                >
                  清除搜尋
                </button>
              </div>
            )}
          </div>
        </form>
        {searchError && <div className="error-text" style={{ marginTop: '0.5rem' }}>{searchError}</div>}
      </div>

      {loading && <div className="text-muted">載入中...</div>}
      {error && <div className="error-text">{error}</div>}
      {data.length === 0 && !loading && <div className="text-muted">沒有資料。</div>}
      {data.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>會員</th>
              <th>日期</th>
              <th>狀態</th>
              <th>書籍</th>
              <th style={{ minWidth: '120px', width: '120px' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.reservation_id}>
                <td>{r.reservation_id}</td>
                <td>{r.member_name}</td>
                <td>{formatDate(r.reserve_date)}</td>
                <td>{r.status}</td>
                <td>
                  {r.books?.map((b: any) => (
                    <div key={b.book_id}>{b.name}</div>
                  ))}
                </td>
                <td style={{ minWidth: '120px', width: '120px', whiteSpace: 'nowrap' }}>
                  {r.status === 'Active' && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleBorrow(r)}
                    >
                      辦理借書
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}


