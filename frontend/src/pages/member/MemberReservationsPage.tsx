import { useEffect, useState } from 'react';
import { memberApi } from '../../api/memberApi';
import { useMember } from '../../context/MemberContext';
import { ReservationItem } from '../../types';
import { formatDate } from '../../utils/dateFormat';

export function MemberReservationsPage() {
  const { memberId } = useMember();
  const [items, setItems] = useState<ReservationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedReservations, setExpandedReservations] = useState<Set<number>>(new Set());

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

  const toggleReservationExpanded = (reservationId: number) => {
    setExpandedReservations((prev) => {
      const next = new Set(prev);
      if (next.has(reservationId)) {
        next.delete(reservationId);
      } else {
        next.add(reservationId);
      }
      return next;
    });
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'Active':
        return '進行中';
      case 'Fulfilled':
        return '已完成';
      case 'Cancelled':
        return '已取消';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'Active':
        return '#28a745';
      case 'Fulfilled':
        return '#007bff';
      case 'Cancelled':
        return '#6c757d';
      default:
        return '#000';
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {items.map((r) => {
                const isExpanded = expandedReservations.has(r.reservation_id);
                return (
                  <div
                    key={r.reservation_id}
                    style={{
                      border: '1px solid #e0e0e0',
                      borderRadius: '4px',
                      padding: '1rem',
                      backgroundColor: '#f9f9f9',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        userSelect: 'none',
                        marginBottom: isExpanded ? '0.75rem' : '0',
                      }}
                      onClick={() => toggleReservationExpanded(r.reservation_id)}
                    >
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ fontWeight: '600' }}>
                          預約 ID: {r.reservation_id}
                        </div>
                        <div style={{ color: '#666', fontSize: '0.9rem' }}>
                          預約日期: {formatDate(r.reserve_date)}
                        </div>
                        <div
                          style={{
                            color: getStatusColor(r.status),
                            fontWeight: '500',
                            fontSize: '0.9rem',
                          }}
                        >
                          {getStatusLabel(r.status)}
                        </div>
                        <div style={{ color: '#666', fontSize: '0.9rem' }}>
                          共 {r.books?.length || 0} 本書
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {r.status === 'Active' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              cancel(r.reservation_id);
                            }}
                          >
                            取消
                          </button>
                        )}
                        <span style={{ fontSize: '1.2rem', color: '#666' }}>
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e0e0e0' }}>
                        <table className="table" style={{ marginBottom: '0' }}>
                          <thead>
                            <tr>
                              <th>書名</th>
                              <th>作者</th>
                              <th>出版社</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.books && r.books.length > 0 ? (
                              r.books.map((b) => (
                                <tr key={b.book_id}>
                                  <td>{b.name}</td>
                                  <td>{b.author}</td>
                                  <td>{b.publisher || '-'}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={3} style={{ textAlign: 'center', color: '#666' }}>
                                  無書籍資料
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}


