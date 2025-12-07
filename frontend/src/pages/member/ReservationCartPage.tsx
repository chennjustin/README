import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReservationCart } from '../../context/ReservationCartContext';
import { useMember } from '../../context/MemberContext';
import { memberApi } from '../../api/memberApi';
import { MemberProfile } from '../../types';

export function ReservationCartPage() {
  const { memberId } = useMember();
  const { items, removeItem, clearCart, totalEstimatedRental } = useReservationCart();
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (memberId) {
      loadMemberProfile();
    }
  }, [memberId]);

  const loadMemberProfile = async () => {
    if (!memberId) return;
    setLoading(true);
    try {
      const profile = await memberApi.getProfile(memberId);
      setMemberProfile(profile);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!memberId || !memberProfile) return;

    // Check member status
    if (memberProfile.status !== 'Active') {
      if (memberProfile.status === 'Suspended') {
        setError('該會員已停權，無法進行預約操作');
      } else if (memberProfile.status === 'Inactive') {
        setError('該會員已註銷帳號，無法進行預約操作');
      } else {
        setError('會員狀態異常，無法進行預約操作');
      }
      return;
    }

    // Check balance
    if (memberProfile.balance < totalEstimatedRental) {
      setError(`餘額不足！目前餘額：${memberProfile.balance} 元，預估租金：${totalEstimatedRental} 元`);
      return;
    }

    if (items.length === 0) {
      setError('購物車為空');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const bookIds = items.map((item) => item.book_id);
      await memberApi.createReservation(memberId, bookIds);
      clearCart();
      navigate('/member/reservations');
    } catch (e: any) {
      setError(e.message || '預約失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">預約購物車</div>
      {!memberId && <div className="text-muted">請先在「個人總覽」設定 member_id。</div>}
      {memberId && (
        <>
          {loading ? (
            <div className="text-muted">載入中...</div>
          ) : (
            <>
              {error && <div className="error-text">{error}</div>}
              {items.length === 0 ? (
                <div className="text-muted">購物車為空，請先到書籍搜尋頁面加入書籍。</div>
              ) : (
                <>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>書名</th>
                        <th>預估租金</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.book_id}>
                          <td>{item.book_name}</td>
                          <td>{item.estimated_rental} 元</td>
                          <td>
                            <button
                              className="btn btn-secondary"
                              onClick={() => removeItem(item.book_id)}
                              disabled={submitting}
                            >
                              移除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div><strong>總預估租金：</strong>{totalEstimatedRental} 元</div>
                        {memberProfile && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <strong>目前餘額：</strong>
                            <span className={memberProfile.balance < totalEstimatedRental ? 'error-text' : ''}>
                              {memberProfile.balance} 元
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={submitting || loading || !memberProfile || memberProfile.status !== 'Active' || memberProfile.balance < totalEstimatedRental}
                      >
                        {submitting ? '處理中...' : '送出預約'}
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
                    <p>注意：預約時不會扣款，實際扣款將在店面租借時進行。</p>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

