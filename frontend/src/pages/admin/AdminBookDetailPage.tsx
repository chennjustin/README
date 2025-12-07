import { FormEvent, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { useAdmin } from '../../context/AdminContext';
import { BookSearchResult, BookCopyInfo } from '../../types';

export function AdminBookDetailPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { token } = useAdmin();
  const [book, setBook] = useState<BookSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [conditionModalOpen, setConditionModalOpen] = useState(false);
  const [selectedCopy, setSelectedCopy] = useState<{ bookId: number; copiesSerial: number; currentCondition: string } | null>(null);
  const [newCondition, setNewCondition] = useState('Good');
  const [actionLoading, setActionLoading] = useState(false);

  const requireToken = () => {
    if (!token) {
      setError('請先在管理端登入頁登入。');
      return false;
    }
    return true;
  };

  useEffect(() => {
    const loadBookDetail = async () => {
      if (!bookId || !requireToken()) return;
      setLoading(true);
      setError(null);
      try {
        const bookIdNum = Number(bookId);
        if (!Number.isFinite(bookIdNum)) {
          setError('無效的書籍 ID');
          return;
        }
        const results = await adminApi.searchBooks(token!, { bookId: bookId });
        if (results.length === 0) {
          setError('找不到此書籍');
        } else {
          setBook(results[0]);
        }
      } catch (e: any) {
        if (e.name === 'AuthenticationError' || e.message?.includes('UNAUTHORIZED')) {
          setError('登入已過期，請重新登入');
        } else {
          setError(e.message || '載入書籍資訊失敗');
        }
      } finally {
        setLoading(false);
      }
    };
    loadBookDetail();
  }, [bookId, token]);

  const handleConditionClick = (copiesSerial: number, currentCondition: string) => {
    if (!book) return;
    setSelectedCopy({ bookId: book.book_id, copiesSerial, currentCondition });
    setNewCondition(currentCondition);
    setError(null);
    setConditionModalOpen(true);
  };

  const closeConditionModal = () => {
    setConditionModalOpen(false);
    setSelectedCopy(null);
    setError(null);
  };

  const handleConditionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!requireToken() || !selectedCopy || !book) {
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await adminApi.updateBookCondition(
        token!,
        selectedCopy.bookId,
        selectedCopy.copiesSerial,
        newCondition
      );
      setMessage('書況更新成功');
      closeConditionModal();
      // Reload book detail
      const results = await adminApi.searchBooks(token!, { bookId: String(book.book_id) });
      if (results.length > 0) {
        setBook(results[0]);
      }
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'Available':
        return '在架上';
      case 'Borrowed':
        return '借出';
      case 'Lost':
        return '遺失';
      default:
        return status;
    }
  };

  const getConditionText = (condition: string): string => {
    switch (condition) {
      case 'Good':
        return '良好';
      case 'Fair':
        return '普通';
      case 'Poor':
        return '差';
      default:
        return condition;
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="text-muted">載入中...</div>
      </div>
    );
  }

  if (error && !book) {
    return (
      <div className="card">
        <div className="error-text">{error}</div>
        <button className="btn btn-secondary" onClick={() => navigate('/admin/books')} style={{ marginTop: '1rem' }}>
          返回書籍列表
        </button>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="card">
        <div className="text-muted">找不到此書籍</div>
        <button className="btn btn-secondary" onClick={() => navigate('/admin/books')} style={{ marginTop: '1rem' }}>
          返回書籍列表
        </button>
      </div>
    );
  }

  // Calculate statistics
  const totalCopies = book.copies.length;
  const availableCount = book.copies.filter((c) => c.status === 'Available').length;
  const borrowedCount = book.copies.filter((c) => c.status === 'Borrowed').length;
  const lostCount = book.copies.filter((c) => c.status === 'Lost').length;

  return (
    <>
      <div className="card">
        <div className="card-title">書籍詳細資訊</div>
        {message && <div className="text-muted" style={{ marginBottom: '1rem', color: 'green' }}>{message}</div>}
        {error && <div className="error-text" style={{ marginBottom: '1rem' }}>{error}</div>}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>書籍 ID：</strong> {book.book_id}
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>書名：</strong> {book.name}
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>作者：</strong> {book.author}
          </div>
          {book.publisher && (
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>出版社：</strong> {book.publisher}
            </div>
          )}
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>總複本數：</strong> {totalCopies}
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>在架上：</strong> {availableCount} 本
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>借出：</strong> {borrowedCount} 本
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>遺失：</strong> {lostCount} 本
          </div>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/admin/books')}>
          返回書籍列表
        </button>
      </div>

      <div className="card">
        <div className="card-title">複本列表</div>
        {book.copies.length === 0 ? (
          <div className="text-muted">此書籍目前沒有複本</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>copies_serial</th>
                <th>書況</th>
                <th>狀態</th>
                <th>租金定價</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {book.copies.map((copy) => (
                <tr key={copy.copies_serial}>
                  <td>{copy.copies_serial}</td>
                  <td>{getConditionText(copy.book_condition)}</td>
                  <td>{getStatusText(copy.status)}</td>
                  <td>{copy.rental_price}</td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                      onClick={() => handleConditionClick(copy.copies_serial, copy.book_condition)}
                    >
                      調整書況
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Condition Update Modal */}
      {conditionModalOpen && selectedCopy && (
        <div className="modal-overlay" onClick={closeConditionModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">調整書況</h2>
              <button className="modal-close" onClick={closeConditionModal} aria-label="關閉">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <form onSubmit={handleConditionSubmit}>
              <div className="modal-body">
                <div className="form-field" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">書籍：</label>
                  <div>
                    Book ID: {selectedCopy.bookId}, Serial: {selectedCopy.copiesSerial}
                  </div>
                </div>
                <div className="form-field" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">目前書況：</label>
                  <div>{getConditionText(selectedCopy.currentCondition)}</div>
                </div>
                <div className="form-field">
                  <label className="form-label">新書況</label>
                  <select
                    className="form-select"
                    value={newCondition}
                    onChange={(e) => setNewCondition(e.target.value)}
                    required
                    autoFocus
                  >
                    <option value="Good">良好</option>
                    <option value="Fair">普通</option>
                    <option value="Poor">差</option>
                  </select>
                </div>
                {error && <div className="error-text" style={{ marginTop: '1rem' }}>{error}</div>}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeConditionModal}
                  disabled={actionLoading}
                >
                  取消
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? '處理中...' : '確認更新'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

