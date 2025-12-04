import { useEffect, useState } from 'react';
import { adminApi } from '../../api/adminApi';
import { useAdmin } from '../../context/AdminContext';

export function AdminReservationsPage() {
  const { token } = useAdmin();
  const [status, setStatus] = useState('Active');
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!token) {
      setError('請先在管理端登入頁登入。');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getReservations(token, status);
      setData(res as any[]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status]);

  const fulfill = async (reservationId: number) => {
    if (!token) return;
    try {
      await adminApi.fulfillReservation(token, reservationId, []);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="card">
      <div className="card-title">預約管理</div>
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
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.reservation_id}>
                <td>{r.reservation_id}</td>
                <td>{r.member_name}</td>
                <td>{r.reserve_date}</td>
                <td>{r.status}</td>
                <td>
                  {r.books?.map((b: any) => (
                    <div key={b.book_id}>{b.name}</div>
                  ))}
                </td>
                <td>
                  {r.status === 'Active' && (
                    <button
                      className="btn btn-primary"
                      onClick={() => fulfill(r.reservation_id)}
                    >
                      標記為已兌現
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


