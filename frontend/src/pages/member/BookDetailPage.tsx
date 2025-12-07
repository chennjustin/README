import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { booksApi } from '../../api/booksApi';
import { memberApi } from '../../api/memberApi';
import { useMember } from '../../context/MemberContext';
import { BookDetail, MemberProfile } from '../../types';
import { ReservationModal } from '../../components/ReservationModal';

export function BookDetailPage() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { memberId } = useMember();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);

  useEffect(() => {
    if (!bookId) return;
    const id = Number(bookId);
    if (!Number.isFinite(id)) {
      setError('bookId 格式錯誤');
      return;
    }
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await booksApi.getDetail(id, memberId);
        setBook(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [bookId, memberId]);

  // Load member profile to check status
  useEffect(() => {
    if (!memberId) {
      setMemberProfile(null);
      return;
    }
    const loadProfile = async () => {
      try {
        const profile = await memberApi.getProfile(memberId);
        setMemberProfile(profile);
      } catch (e: any) {
        // Silently fail - member profile loading is optional
        setMemberProfile(null);
      }
    };
    loadProfile();
  }, [memberId]);

  return (
    <div className="card">
      <div className="card-title">書籍詳細資訊</div>
      {loading && <div className="text-muted">載入中...</div>}
      {error && <div className="error-text">{error}</div>}
      {!loading && !book && !error && <div className="text-muted">沒有資料。</div>}
      {book && (
        <>
          <div className="form-row">
            <div className="form-field">
              <span className="form-label">書名</span>
              <span>{book.name}</span>
            </div>
            <div className="form-field">
              <span className="form-label">作者</span>
              <span>{book.author}</span>
            </div>
            <div className="form-field">
              <span className="form-label">出版社</span>
              <span>{book.publisher}</span>
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <span className="form-label">定價</span>
              <span>{book.price}</span>
            </div>
            <div className="form-field">
              <span className="form-label">分類</span>
              <span>
                {book.categories?.map((c) => (
                  <span key={c.category_id} className="tag">
                    {c.name}
                  </span>
                ))}
              </span>
            </div>
          </div>
          <div className="spacer-md" />
          <div className="card-title">各書況可借本數與租金</div>
          <table className="table">
            <thead>
              <tr>
                <th>書況</th>
                <th>租金</th>
                <th>可借本數</th>
                <th>折扣後租金</th>
              </tr>
            </thead>
            <tbody>
              {book.copies.map((c, idx) => (
                <tr key={idx}>
                  <td>{c.book_condition}</td>
                  <td>{c.rental_price}</td>
                  <td>{c.available_count}</td>
                  <td>{Math.round(c.discounted_rental_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="spacer-md" />
          {memberId && memberProfile && memberProfile.status === 'Active' && (
            <div className="book-detail-actions">
              <button
                className="btn btn-primary"
                onClick={() => setShowReservationModal(true)}
                disabled={!book || book.copies.every((c) => c.available_count === 0)}
              >
                預約書籍
              </button>
            </div>
          )}
          {memberId && memberProfile && memberProfile.status !== 'Active' && (
            <div className="text-muted">
              {memberProfile.status === 'Suspended' 
                ? '該會員已停權，無法進行預約操作'
                : memberProfile.status === 'Inactive'
                ? '該會員已註銷帳號，無法進行預約操作'
                : '會員狀態異常，無法進行預約操作'}
            </div>
          )}
          {memberId && !memberProfile && (
            <div className="book-detail-actions">
              <button
                className="btn btn-primary"
                onClick={() => setShowReservationModal(true)}
                disabled={!book || book.copies.every((c) => c.available_count === 0)}
              >
                預約書籍
              </button>
            </div>
          )}
          {!memberId && (
            <div className="text-muted">
              請先登入會員才能預約書籍
            </div>
          )}
        </>
      )}
      {book && memberId && (
        <ReservationModal
          isOpen={showReservationModal}
          onClose={() => setShowReservationModal(false)}
          onConfirm={() => {
            setShowReservationModal(false);
            navigate('/member/reservations');
          }}
          bookName={book.name}
          bookId={book.book_id}
          estimatedRental={book.copies.length > 0 ? Math.min(...book.copies.map((c) => Math.round(c.discounted_rental_price))) : book.price}
          memberId={memberId}
        />
      )}
    </div>
  );
}


