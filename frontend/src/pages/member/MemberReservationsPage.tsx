import { useEffect, useState } from 'react';
import { memberApi } from '../../api/memberApi';
import { useMember } from '../../context/MemberContext';
import { ReservationItem } from '../../types';

export function MemberReservationsPage() {
  const { memberId } = useMember();
  const [items, setItems] = useState<ReservationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!memberId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await memberApi.getReservations(memberId);
      setItems(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  const cancel = async (reservationId: number) => {
    if (!memberId) return;
    try {
      await memberApi.cancelReservation(memberId, reservationId);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="card">
      <div className="card-title">我的預約</div>
      {!memberId && <div className="text-muted">請先在「個人總覽」設定 member_id。</div>}
      {memberId && (
        <>
          {loading && <div className="text-muted">載入中...</div>}
          {error && <div className="error-text">{error}</div>}
          {!loading && items.length === 0 && (
            <div className="text-muted">目前沒有預約紀錄。</div>
          )}
          {items.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>預約日期</th>
                  <th>狀態</th>
                  <th>書籍</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.reservation_id}>
                    <td>{r.reservation_id}</td>
                    <td>{r.reserve_date}</td>
                    <td>{r.status}</td>
                    <td>
                      {r.books?.map((b) => (
                        <div key={b.book_id}>{b.name}</div>
                      ))}
                    </td>
                    <td>
                      {r.status === 'Active' && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => cancel(r.reservation_id)}
                        >
                          取消
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}


