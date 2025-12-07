import { FormEvent, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { useAdmin } from '../../context/AdminContext';
import { BorrowPreview } from '../../types';

interface BorrowItem extends BorrowPreview {
  // Extends BorrowPreview with all required fields
}

interface ReservationData {
  fromReservation: boolean;
  reservation_id?: number;
  member_id: number;
  member_name: string;
  books: Array<{
    book_id: number;
    name: string;
    author?: string;
    publisher?: string;
  }>;
}

export function AdminBorrowPage() {
  const { token } = useAdmin();
  const location = useLocation();
  const [memberId, setMemberId] = useState('');
  const [items, setItems] = useState<BorrowItem[]>([]);
  const [bookIdInput, setBookIdInput] = useState('');
  const [copySerialInput, setCopySerialInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [validating, setValidating] = useState(false);
  const [reservationData, setReservationData] = useState<ReservationData | null>(null);
  const [reservationCopiesInput, setReservationCopiesInput] = useState<Record<number, string>>({});

  // Parse error message and extract error code
  const parseError = (error: any): { code: string; message: string } => {
    const errorMessage = error?.message || '發生未知錯誤';
    // Error format from API config: "CODE: message"
    const match = errorMessage.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      return { code: match[1], message: match[2] };
    }
    return { code: 'UNKNOWN_ERROR', message: errorMessage };
  };

  // Error message mapping based on error code
  const getErrorMessage = (errorCode: string, defaultMessage: string): string => {
    const errorMap: Record<string, string> = {
      MEMBER_NOT_FOUND: '找不到會員',
      COPY_NOT_FOUND: '找不到書籍複本',
      MEMBER_INACTIVE: '會員狀態不可借書',
      COPY_NOT_AVAILABLE: '複本不可借出',
      INVALID_INPUT: '輸入格式錯誤',
      HTTP_ERROR: defaultMessage,
      UNKNOWN_ERROR: defaultMessage,
    };
    return errorMap[errorCode] || defaultMessage;
  };

  // Handle reservation data from navigation
  useEffect(() => {
    const state = location.state as ReservationData | null;
    if (state?.fromReservation) {
      setReservationData(state);
      setMemberId(String(state.member_id));
      // Clear location state to prevent re-processing on re-render
      window.history.replaceState({}, document.title);
      // Debug: log reservation data
      console.log('Reservation data loaded:', state);
    }
  }, [location.state]);

  const addItem = async () => {
    // Validate all inputs are provided
    if (!memberId.trim()) {
      setError('請輸入 Member ID。');
      return;
    }
    if (!bookIdInput.trim()) {
      setError('請輸入 Book ID。');
      return;
    }
    if (!copySerialInput.trim()) {
      setError('請輸入 Copies Serial。');
      return;
    }

    // Validate numeric inputs
    const mid = Number(memberId);
    const b = Number(bookIdInput);
    const c = Number(copySerialInput);
    if (!Number.isFinite(mid) || !Number.isFinite(b) || !Number.isFinite(c)) {
      setError('Member ID、Book ID、Copies Serial 必須為有效數字。');
      return;
    }

    if (!token) {
      setError('請先在管理端登入頁登入。');
      return;
    }

    // Check if item already exists in list
    const exists = items.some(
      (it) => it.book_id === b && it.copies_serial === c
    );
    if (exists) {
      setError('此書籍複本已存在於列表中。');
      return;
    }

    setAddingItem(true);
    setError(null);

    try {
      // Call API to get preview information and validate
      const preview = await adminApi.getBorrowPreview(token, mid, b, c);
      
      // Add item to list with all details
      setItems([...items, preview]);
      setBookIdInput('');
      setCopySerialInput('');
      setError(null);
    } catch (e: any) {
      // Handle different error types
      const { code: errorCode, message: errorMsg } = parseError(e);
      setError(getErrorMessage(errorCode, errorMsg));
    } finally {
      setAddingItem(false);
    }
  };

  // Revalidate all items before submission
  const revalidateAllItems = async (): Promise<boolean> => {
    if (!token || items.length === 0) {
      return false;
    }

    const mid = Number(memberId);
    if (!Number.isFinite(mid)) {
      setError('請輸入有效的 member_id。');
      return false;
    }

    setValidating(true);
    const newItems: BorrowItem[] = [];

    try {
      // Revalidate each item
      for (const item of items) {
        const preview = await adminApi.getBorrowPreview(
          token,
          mid,
          item.book_id,
          item.copies_serial
        );
        newItems.push(preview);
      }

      // Update items with latest validated data
      setItems(newItems);
      setError(null);
      return true;
    } catch (e: any) {
      const { code: errorCode, message: errorMsg } = parseError(e);
      setError(`驗證失敗：${getErrorMessage(errorCode, errorMsg)}`);
      return false;
    } finally {
      setValidating(false);
    }
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    setError(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('請先在管理端登入頁登入。');
      return;
    }
    const mid = Number(memberId);
    if (!Number.isFinite(mid) || items.length === 0) {
      setError('請輸入有效的 member_id 並至少一筆借書項目。');
      return;
    }

    // Revalidate all items before submission
    const isValid = await revalidateAllItems();
    if (!isValid) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Convert items to the format expected by the API
      const apiItems = items.map((it) => ({
        book_id: it.book_id,
        copies_serial: it.copies_serial,
      }));

      // Include reservation_id if this is from a reservation
      const borrowPayload: { member_id: number; items: any[]; reservation_id?: number } = {
        member_id: mid,
        items: apiItems,
      };
      if (reservationData?.reservation_id) {
        borrowPayload.reservation_id = reservationData.reservation_id;
        // Debug: log reservation_id being sent
        console.log('Sending reservation_id:', reservationData.reservation_id);
      } else {
        console.log('No reservation_id to send');
      }

      const res = await adminApi.borrow(token, borrowPayload);
      setResult(res);
      // Clear the list after successful submission
      setItems([]);
      setMemberId('');
      // Clear reservation data after successful borrow
      if (reservationData) {
        setReservationData(null);
      }
    } catch (e: any) {
      const { code: errorCode, message: errorMsg } = parseError(e);
      setError(getErrorMessage(errorCode, errorMsg));
    } finally {
      setLoading(false);
    }
  };

  // Handle adding book from reservation
  const addReservationBook = async (bookId: number, copiesSerial: number) => {
    if (!token || !memberId.trim()) {
      setError('請確認 Member ID 已填入。');
      return;
    }

    const mid = Number(memberId);
    if (!Number.isFinite(mid)) {
      setError('請輸入有效的 Member ID。');
      return;
    }

    // Check if item already exists in list
    const exists = items.some(
      (it) => it.book_id === bookId && it.copies_serial === copiesSerial
    );
    if (exists) {
      setError('此書籍複本已存在於列表中。');
      return;
    }

    setAddingItem(true);
    setError(null);

    try {
      // Call API to get preview information and validate
      const preview = await adminApi.getBorrowPreview(token, mid, bookId, copiesSerial);
      
      // Add item to list with all details
      setItems([...items, preview]);
      setError(null);
    } catch (e: any) {
      // Handle different error types
      const { code: errorCode, message: errorMsg } = parseError(e);
      setError(getErrorMessage(errorCode, errorMsg));
    } finally {
      setAddingItem(false);
    }
  };

  // Calculate total rental fee
  const totalRentalFee = items.reduce((sum, item) => sum + item.rental_fee, 0);

  return (
    <div className="card">
      <div className="card-title">櫃檯借書</div>
      
      {/* Reservation books section */}
      {reservationData && (
        <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: '600' }}>
            預約書籍（會員：{reservationData.member_name}，Member ID: {reservationData.member_id}）
          </h3>
          {reservationData.books.map((book) => (
            <div
              key={book.book_id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem',
                marginBottom: '0.5rem',
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
              }}
            >
              <div style={{ flex: 1 }}>
                <div>
                  <strong>Book ID:</strong> {book.book_id} | <strong>書名:</strong> {book.name}
                  {book.author && ` | <strong>作者:</strong> ${book.author}`}
                  {book.publisher && ` | <strong>出版社:</strong> ${book.publisher}`}
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                  請輸入 Copies Serial 後點擊「加入列表」
                </div>
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="Copies Serial"
                    value={reservationCopiesInput[book.book_id] || ''}
                    onChange={(e) => {
                      setReservationCopiesInput({
                        ...reservationCopiesInput,
                        [book.book_id]: e.target.value,
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const serial = Number(reservationCopiesInput[book.book_id]);
                        if (Number.isFinite(serial)) {
                          addReservationBook(book.book_id, serial);
                          setReservationCopiesInput({
                            ...reservationCopiesInput,
                            [book.book_id]: '',
                          });
                        }
                      }
                    }}
                    disabled={loading || validating || addingItem}
                    style={{ width: '150px' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      const serial = Number(reservationCopiesInput[book.book_id]);
                      if (Number.isFinite(serial)) {
                        addReservationBook(book.book_id, serial);
                        setReservationCopiesInput({
                          ...reservationCopiesInput,
                          [book.book_id]: '',
                        });
                      } else {
                        setError('請輸入有效的 Copies Serial。');
                      }
                    }}
                    disabled={loading || validating || addingItem}
                    style={{ padding: '4px 12px', fontSize: '12px' }}
                  >
                    {addingItem ? '加入中...' : '加入列表'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit}>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">Member ID</label>
            <input
              className="form-input"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              disabled={loading || validating}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">Book ID</label>
            <input
              className="form-input"
              value={bookIdInput}
              onChange={(e) => setBookIdInput(e.target.value)}
              disabled={loading || validating || addingItem}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Copies Serial</label>
            <input
              className="form-input"
              value={copySerialInput}
              onChange={(e) => setCopySerialInput(e.target.value)}
              disabled={loading || validating || addingItem}
            />
          </div>
          <div className="form-field" style={{ justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={addItem}
              disabled={loading || validating || addingItem}
            >
              {addingItem ? '加入中...' : '加入列表'}
            </button>
          </div>
        </div>
        {items.length > 0 && (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Book ID</th>
                  <th>Copies Serial</th>
                  <th>書名</th>
                  <th>書籍狀態</th>
                  <th>租金</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={`${it.book_id}-${it.copies_serial}-${idx}`}>
                    <td>{it.book_id}</td>
                    <td>{it.copies_serial}</td>
                    <td>{it.book_name}</td>
                    <td>{it.status}</td>
                    <td>{it.rental_fee}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => removeItem(idx)}
                        disabled={loading || validating}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        移除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    總租金：
                  </td>
                  <td style={{ fontWeight: 'bold' }}>{totalRentalFee}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </>
        )}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || validating || items.length === 0}
        >
          {validating ? '驗證中...' : loading ? '處理中...' : '辦理借書'}
        </button>
      </form>
      {result && (
        <div className="text-muted">
          完成借書，Loan ID: {result.loan_id}，總租金: {result.final_price}，會員新餘額:{' '}
          {result.member?.balance}
        </div>
      )}
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}

