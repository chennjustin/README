import { useEffect, useState } from 'react';
import { memberApi } from '../api/memberApi';
import { MemberProfile } from '../types';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  bookName: string;
  bookId: number;
  estimatedRental: number;
  memberId: number;
}

export function ReservationModal({
  isOpen,
  onClose,
  onConfirm,
  bookName,
  bookId,
  estimatedRental,
  memberId,
}: ReservationModalProps) {
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 計算領取日期（操作當下 + 5 天）
  const pickupDate = new Date();
  pickupDate.setDate(pickupDate.getDate() + 5);
  const pickupDateStr = pickupDate.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  useEffect(() => {
    if (isOpen && memberId) {
      loadMemberProfile();
    }
  }, [isOpen, memberId]);

  const loadMemberProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const profile = await memberApi.getProfile(memberId);
      setMemberProfile(profile);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!memberProfile) return;

    // 檢查餘額
    if (memberProfile.balance < estimatedRental) {
      setError(`餘額不足！目前餘額：${memberProfile.balance} 元，預估租金：${estimatedRental} 元`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await memberApi.createReservation(memberId, [bookId]);
      onConfirm();
      onClose();
    } catch (e: any) {
      setError(e.message || '預約失敗');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">預約確認</h2>
          <button className="modal-close" onClick={onClose} aria-label="關閉">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {loading && <div className="text-muted">載入中...</div>}
          {error && <div className="error-text">{error}</div>}

          {memberProfile && (
            <>
              <div className="reservation-detail">
                <div className="reservation-detail-row">
                  <span className="reservation-detail-label">書名：</span>
                  <span className="reservation-detail-value">{bookName}</span>
                </div>
                <div className="reservation-detail-row">
                  <span className="reservation-detail-label">預估租金：</span>
                  <span className="reservation-detail-value">${estimatedRental} 元</span>
                </div>
                <div className="reservation-detail-row">
                  <span className="reservation-detail-label">領取日期：</span>
                  <span className="reservation-detail-value">{pickupDateStr}</span>
                </div>
                <div className="reservation-detail-row">
                  <span className="reservation-detail-label">目前餘額：</span>
                  <span className={`reservation-detail-value ${memberProfile.balance < estimatedRental ? 'error-text' : ''}`}>
                    ${memberProfile.balance} 元
                  </span>
                </div>
              </div>

              {memberProfile.balance < estimatedRental && (
                <div className="reservation-warning">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                  <span>餘額不足，無法預約。請先儲值。</span>
                </div>
              )}

              <div className="reservation-note">
                <p>注意：預約時不會扣款，實際扣款將在店面租借時進行。</p>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={submitting || loading || !memberProfile || memberProfile.balance < estimatedRental}
          >
            {submitting ? '處理中...' : '確認預約'}
          </button>
        </div>
      </div>
    </div>
  );
}

