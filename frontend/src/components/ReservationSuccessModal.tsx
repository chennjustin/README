import { useEffect } from 'react';

interface ReservationCartItem {
  book_id: number;
  book_name: string;
  estimated_rental: number;
  available_count: number;
}

interface ReservationSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ReservationCartItem[];
}

export function ReservationSuccessModal({
  isOpen,
  onClose,
  items,
}: ReservationSuccessModalProps) {
  // Calculate pickup deadline date (5 days from now)
  const pickupDeadline = new Date();
  pickupDeadline.setDate(pickupDeadline.getDate() + 5);
  const pickupDeadlineStr = pickupDeadline.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">預約成功</h2>
          <button className="modal-close" onClick={onClose} aria-label="關閉">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem', 
            marginBottom: '1.5rem',
            padding: '1rem',
            background: '#d1fae5',
            borderRadius: '8px',
            border: '1px solid #10b981'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span style={{ color: '#065f46', fontWeight: '600', fontSize: '1.1rem' }}>
              您的預約已成功建立
            </span>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              marginBottom: '1rem',
              padding: '0.75rem',
              background: '#fef3c7',
              borderRadius: '8px',
              border: '1px solid #fbbf24'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span style={{ color: '#92400e', fontWeight: '500' }}>
                請在 <strong>{pickupDeadlineStr}</strong> 前至店面取書
              </span>
            </div>
            <div style={{ 
              padding: '0.75rem',
              background: '#f3f4f6',
              borderRadius: '8px',
              fontSize: '0.875rem',
              color: '#4b5563'
            }}>
              <p style={{ margin: 0 }}>
                逾期未取將自動取消預約，請務必在期限內完成取書。
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              color: '#374151',
              marginBottom: '0.75rem'
            }}>
              預約書籍清單（共 {items.length} 本）：
            </div>
            <div style={{ 
              maxHeight: '200px', 
              overflowY: 'auto',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '0.5rem'
            }}>
              {items.map((item) => (
                <div 
                  key={item.book_id}
                  style={{ 
                    padding: '0.75rem',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ flex: 1, color: '#111827' }}>{item.book_name}</span>
                  <span style={{ 
                    marginLeft: '1rem', 
                    color: '#6b7280', 
                    fontSize: '0.875rem',
                    whiteSpace: 'nowrap'
                  }}>
                    {item.estimated_rental} 元
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-primary"
            onClick={onClose}
            style={{ width: '100%' }}
          >
            確定
          </button>
        </div>
      </div>
    </div>
  );
}
