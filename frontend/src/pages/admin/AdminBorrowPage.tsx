import { FormEvent, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { useAdmin } from '../../context/AdminContext';
import { BorrowPreview, MemberDetail } from '../../types';

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
  const [memberDetail, setMemberDetail] = useState<MemberDetail | null>(null);
  const [confirmingMember, setConfirmingMember] = useState(false);
  const [items, setItems] = useState<BorrowItem[]>([]);
  const [bookIdInput, setBookIdInput] = useState('');
  const [copySerialInput, setCopySerialInput] = useState('');
  const [availableCopies, setAvailableCopies] = useState<Array<{
    copies_serial: number;
    status: string;
    book_condition: string;
    rental_price: number;
  }>>([]);
  const [loadingCopies, setLoadingCopies] = useState(false);
  const [selectedBookName, setSelectedBookName] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [validating, setValidating] = useState(false);
  const [reservationData, setReservationData] = useState<ReservationData | null>(null);
  const [reservationCopiesInput, setReservationCopiesInput] = useState<Record<number, string>>({});
  const [reservationAvailableCopies, setReservationAvailableCopies] = useState<Record<number, Array<{
    copies_serial: number;
    status: string;
    book_condition: string;
    rental_price: number;
  }>>>({});
  const [loadingReservationCopies, setLoadingReservationCopies] = useState<Record<number, boolean>>({});

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
      MEMBER_INACTIVE: '會員狀態不可借書，請先將會員狀態設為 Active',
      COPY_NOT_AVAILABLE: '複本不可借出',
      INVALID_INPUT: '輸入格式錯誤',
      HTTP_ERROR: defaultMessage,
      UNKNOWN_ERROR: defaultMessage,
    };
    return errorMap[errorCode] || defaultMessage;
  };

  // Load available copies for reservation books
  const loadReservationCopies = async (bookId: number) => {
    if (!token) {
      return;
    }

    setLoadingReservationCopies((prev) => ({ ...prev, [bookId]: true }));

    try {
      const result = await adminApi.getAvailableCopies(token, bookId);
      setReservationAvailableCopies((prev) => ({
        ...prev,
        [bookId]: result.copies || [],
      }));
    } catch (e: any) {
      // Silently fail for reservation copies loading
      setReservationAvailableCopies((prev) => ({
        ...prev,
        [bookId]: [],
      }));
    } finally {
      setLoadingReservationCopies((prev) => ({ ...prev, [bookId]: false }));
    }
  };

  // Handle reservation data from navigation
  useEffect(() => {
    const state = location.state as ReservationData | null;
    if (state?.fromReservation) {
      setReservationData(state);
      setMemberId(String(state.member_id));
      // Auto-confirm member if from reservation
      if (token) {
        confirmMember(String(state.member_id)).then(() => {
          // After member is confirmed, load available copies for each book
          if (token && state.books) {
            state.books.forEach((book) => {
              loadReservationCopies(book.book_id);
            });
          }
        });
      }
      // Clear location state to prevent re-processing on re-render
      window.history.replaceState({}, document.title);
      // Debug: log reservation data
      console.log('Reservation data loaded:', state);
    }
  }, [location.state]);

  // Confirm member function
  const confirmMember = async (memberIdValue?: string): Promise<void> => {
    const mid = memberIdValue || memberId;
    if (!mid.trim()) {
      setError('請輸入 Member ID。');
      return;
    }

    const midNum = Number(mid);
    if (!Number.isFinite(midNum) || midNum <= 0) {
      setError('Member ID 必須為有效的正整數。');
      return;
    }

    if (!token) {
      setError('請先在管理端登入頁登入。');
      return;
    }

    setConfirmingMember(true);
    setError(null);
    setMemberDetail(null);
    setItems([]); // Clear items when changing member

    try {
      const detail = await adminApi.getMemberDetail(token, midNum);
      setMemberDetail(detail);
      setMemberId(String(midNum));
      setError(null);
    } catch (e: any) {
      const { code: errorCode, message: errorMsg } = parseError(e);
      setError(getErrorMessage(errorCode, errorMsg));
      setMemberDetail(null);
    } finally {
      setConfirmingMember(false);
    }
  };

  // Fetch available copies when book_id changes
  const handleBookIdChange = async (value: string) => {
    setBookIdInput(value);
    setCopySerialInput(''); // Clear copies_serial when book_id changes
    setAvailableCopies([]);
    setSelectedBookName(null);

    if (!value.trim()) {
      return;
    }

    const bookId = Number(value);
    if (!Number.isFinite(bookId) || bookId <= 0) {
      return;
    }

    if (!token) {
      return;
    }

    setLoadingCopies(true);
    setError(null);

    try {
      const result = await adminApi.getAvailableCopies(token, bookId);
      setAvailableCopies(result.copies || []);
      setSelectedBookName(result.book_name);
      if (result.copies.length === 0) {
        setError('此書籍目前沒有可用的複本。');
      }
    } catch (e: any) {
      const { code: errorCode, message: errorMsg } = parseError(e);
      setError(getErrorMessage(errorCode, errorMsg));
      setAvailableCopies([]);
      setSelectedBookName(null);
    } finally {
      setLoadingCopies(false);
    }
  };

  const addItem = async () => {
    // Validate member is confirmed
    if (!memberDetail) {
      setError('請先確認會員。');
      return;
    }

    if (!bookIdInput.trim()) {
      setError('請輸入 Book ID。');
      return;
    }
    if (!copySerialInput.trim()) {
      setError('請選擇 Copies Serial。');
      return;
    }

    // Validate numeric inputs
    const mid = memberDetail.member_id;
    const b = Number(bookIdInput);
    const c = Number(copySerialInput);
    if (!Number.isFinite(b) || !Number.isFinite(c)) {
      setError('Book ID、Copies Serial 必須為有效數字。');
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
    if (!token || items.length === 0 || !memberDetail) {
      return false;
    }

    const mid = memberDetail.member_id;

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
    if (!memberDetail) {
      setError('請先確認會員。');
      return;
    }
    if (items.length === 0) {
      setError('請至少添加一筆借書項目。');
      return;
    }
    const mid = memberDetail.member_id;

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
      setBookIdInput('');
      setCopySerialInput('');
      // Clear reservation data after successful borrow
      if (reservationData) {
        setReservationData(null);
      }
      // Note: Keep memberDetail so admin can continue adding books for the same member
    } catch (e: any) {
      const { code: errorCode, message: errorMsg } = parseError(e);
      setError(getErrorMessage(errorCode, errorMsg));
    } finally {
      setLoading(false);
    }
  };

  // Handle adding book from reservation
  const addReservationBook = async (bookId: number, copiesSerial: number) => {
    if (!memberDetail) {
      setError('請先確認會員。');
      return;
    }

    if (!token) {
      setError('請先在管理端登入頁登入。');
      return;
    }

    const mid = memberDetail.member_id;

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
      
      <form onSubmit={onSubmit}>
        {/* Member confirmation section - only show when NOT from reservation */}
        {!reservationData && (
          <div className="form-row">
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Member ID</label>
              <input
                className="form-input"
                value={memberId}
                onChange={(e) => {
                  setMemberId(e.target.value);
                  setMemberDetail(null); // Clear member detail when ID changes
                  setItems([]); // Clear items when member changes
                }}
                disabled={loading || validating || confirmingMember}
                placeholder="請輸入會員 ID"
              />
            </div>
            <div className="form-field" style={{ justifyContent: 'flex-end', alignSelf: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => confirmMember()}
                disabled={loading || validating || confirmingMember || !memberId.trim()}
              >
                {confirmingMember ? '確認中...' : '確認會員'}
              </button>
            </div>
          </div>
        )}

        {/* Member info display */}
        {memberDetail && (
          <div style={{ 
            marginBottom: '1.5rem', 
            padding: '1rem', 
            backgroundColor: '#f9fafb', 
            borderRadius: '8px', 
            border: '1px solid #e5e7eb' 
          }}>
            <div style={{ marginBottom: '0.75rem', fontWeight: '600', fontSize: '1rem' }}>
              會員資訊
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
              <div>
                <strong>姓名：</strong> {memberDetail.name}
              </div>
              <div>
                <strong>等級：</strong> {memberDetail.level_name}
              </div>
              <div>
                <strong>可租借天數：</strong> {memberDetail.hold_days} 天
              </div>
              <div>
                <strong>餘額：</strong> {memberDetail.balance}
              </div>
            </div>
          </div>
        )}

        {/* Reservation books section - only show when from reservation and member is confirmed */}
        {reservationData && memberDetail && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: '600' }}>
              預約書籍
            </h3>
            {reservationData.books.map((book) => {
              const isBookInList = items.some(item => item.book_id === book.book_id);
              return (
                <div
                  key={book.book_id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div>
                      <strong>Book ID:</strong> {book.book_id} | <strong>書名:</strong> {book.name}
                      {book.author && ` | <strong>作者:</strong> ${book.author}`}
                      {book.publisher && ` | <strong>出版社:</strong> ${book.publisher}`}
                    </div>
                    {!isBookInList && (
                      <>
                        {loadingReservationCopies[book.book_id] && (
                          <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                            載入可用複本中...
                          </div>
                        )}
                        {!loadingReservationCopies[book.book_id] && reservationAvailableCopies[book.book_id] && reservationAvailableCopies[book.book_id].length === 0 && (
                          <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#ef4444' }}>
                            此書籍目前沒有可用的複本
                          </div>
                        )}
                        {!loadingReservationCopies[book.book_id] && reservationAvailableCopies[book.book_id] && reservationAvailableCopies[book.book_id].length > 0 && (
                          <>
                            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                              請選擇 Copies Serial 後點擊「加入列表」
                            </div>
                            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <select
                                className="form-input"
                                value={reservationCopiesInput[book.book_id] || ''}
                                onChange={(e) => {
                                  setReservationCopiesInput({
                                    ...reservationCopiesInput,
                                    [book.book_id]: e.target.value,
                                  });
                                }}
                                disabled={loading || validating || addingItem || !memberDetail}
                                style={{ 
                                  width: '200px',
                                  padding: '0.5rem',
                                  borderRadius: '4px',
                                  border: '1px solid #d1d5db',
                                  backgroundColor: '#fff',
                                  fontSize: '1rem'
                                }}
                              >
                                <option value="">請選擇副本序號</option>
                                {reservationAvailableCopies[book.book_id].map((copy) => (
                                  <option key={copy.copies_serial} value={copy.copies_serial}>
                                    {copy.copies_serial} (書況: {copy.book_condition}, 租金: {copy.rental_price})
                                  </option>
                                ))}
                              </select>
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
                                    setError('請選擇有效的 Copies Serial。');
                                  }
                                }}
                                disabled={loading || validating || addingItem || !memberDetail || !reservationCopiesInput[book.book_id]}
                                style={{ padding: '4px 12px', fontSize: '12px' }}
                              >
                                {addingItem ? '加入中...' : '加入列表'}
                              </button>
                            </div>
                          </>
                        )}
                      </>
                    )}
                    {isBookInList && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#10b981', fontWeight: '500' }}>
                        ✓ 已加入列表
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

         {/* Book input section - only show when NOT from reservation and member is confirmed */}
         {!reservationData && memberDetail && (
           <div className="form-row">
             <div className="form-field">
               <label className="form-label">Book ID</label>
               <input
                 className="form-input"
                 value={bookIdInput}
                 onChange={(e) => handleBookIdChange(e.target.value)}
                 disabled={loading || validating || addingItem || loadingCopies || !memberDetail}
                 placeholder="請輸入書籍 ID"
               />
               {loadingCopies && (
                 <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                   載入中...
                 </div>
               )}
               {selectedBookName && !loadingCopies && (
                 <div style={{ fontSize: '0.875rem', color: '#059669', marginTop: '0.25rem' }}>
                   書名: {selectedBookName}
                 </div>
               )}
             </div>
             {availableCopies.length > 0 && (
               <div className="form-field">
                 <label className="form-label">Copies Serial</label>
                 <select
                   className="form-input"
                   value={copySerialInput}
                   onChange={(e) => setCopySerialInput(e.target.value)}
                   disabled={loading || validating || addingItem || !memberDetail}
                   style={{ 
                     padding: '0.5rem',
                     borderRadius: '4px',
                     border: '1px solid #d1d5db',
                     backgroundColor: '#fff',
                     fontSize: '1rem'
                   }}
                 >
                   <option value="">請選擇副本序號</option>
                   {availableCopies.map((copy) => (
                     <option key={copy.copies_serial} value={copy.copies_serial}>
                       {copy.copies_serial} (書況: {copy.book_condition}, 租金: {copy.rental_price})
                     </option>
                   ))}
                 </select>
               </div>
             )}
             {availableCopies.length > 0 && (
               <div className="form-field" style={{ justifyContent: 'flex-end' }}>
                 <button
                   type="button"
                   className="btn btn-secondary"
                   onClick={addItem}
                   disabled={loading || validating || addingItem || !memberDetail || !copySerialInput}
                 >
                   {addingItem ? '加入中...' : '加入列表'}
                 </button>
               </div>
             )}
           </div>
         )}
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
        {memberDetail && (
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || validating || items.length === 0 || !memberDetail}
          >
            {validating ? '驗證中...' : loading ? '處理中...' : '辦理借書'}
          </button>
        )}
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

