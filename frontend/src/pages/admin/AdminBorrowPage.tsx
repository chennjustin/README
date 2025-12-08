import { FormEvent, useEffect, useState, useRef } from 'react';
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
  const itemsRef = useRef<BorrowItem[]>([]); // 用於追蹤最新的 items 狀態
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
  const [missingBooks, setMissingBooks] = useState<number[]>([]); // 記錄提交時缺少的書籍 ID
  const [reservationCopiesInput, setReservationCopiesInput] = useState<Record<number, string>>({});
  const [reservationAvailableCopies, setReservationAvailableCopies] = useState<Record<number, Array<{
    copies_serial: number;
    status: string;
    book_condition: string;
    rental_price: number;
  }>>>({});
  const [loadingReservationCopies, setLoadingReservationCopies] = useState<Record<number, boolean>>({});

  // 同步 itemsRef 與 items state
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Load reservation data from navigation state
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
              loadReservationCopies(book.book_id, state.member_id);
            });
          }
        });
      }
      // Clear location state to prevent re-processing on re-render
      window.history.replaceState({}, document.title);
      console.log('Reservation data loaded:', state);
    }
  }, [location.state, token]);

  // Load available copies for a book in reservation context
  const loadReservationCopies = async (bookId: number, memberId: number) => {
    if (!token) return;

    setLoadingReservationCopies((prev) => ({ ...prev, [bookId]: true }));
    try {
      const result = await adminApi.getAvailableCopies(token, bookId, memberId);
      setReservationAvailableCopies((prev) => ({
        ...prev,
        [bookId]: result.copies,
      }));
    } catch (e) {
      console.error('Failed to load reservation copies:', e);
      setReservationAvailableCopies((prev) => ({
        ...prev,
        [bookId]: [],
      }));
    } finally {
      setLoadingReservationCopies((prev) => ({ ...prev, [bookId]: false }));
    }
  };

  const confirmMember = async (id?: string) => {
    const mid = id || memberId;
    if (!mid.trim()) {
      setError('請輸入會員 ID');
      return;
    }

    const memberIdNum = Number(mid);
    if (!Number.isFinite(memberIdNum) || memberIdNum <= 0) {
      setError('會員 ID 格式錯誤');
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
    itemsRef.current = []; // 清除 ref

    try {
      const profile = await adminApi.getMemberDetail(token, memberIdNum);
      setMemberDetail(profile);
      setError(null);
    } catch (e: any) {
      const { code: errorCode, message: errorMsg } = parseError(e);
      setError(getErrorMessage(errorCode, errorMsg));
    } finally {
      setConfirmingMember(false);
    }
  };

  function parseError(e: any): { code: string; message: string } {
    if (e?.response?.data?.error) {
      return {
        code: e.response.data.error.code || 'UNKNOWN_ERROR',
        message: e.response.data.error.message || '發生未知錯誤',
      };
    }
    return { code: 'UNKNOWN_ERROR', message: e?.message || '發生未知錯誤' };
  }

  function getErrorMessage(code: string, message: string): string {
    const errorMessages: Record<string, string> = {
      MEMBER_NOT_FOUND: '找不到此會員',
      INSUFFICIENT_BALANCE: '會員餘額不足',
      LOAN_LIMIT_EXCEEDED: '已達借閱上限',
      BOOK_NOT_AVAILABLE: '書籍不可借',
      COPY_NOT_FOUND: '找不到此書籍複本',
      COPY_NOT_AVAILABLE: '此複本不可借',
      INVALID_INPUT: message || '輸入格式錯誤',
    };
    return errorMessages[code] || message || '發生未知錯誤';
  }

  const addItem = async () => {
    if (!memberDetail) {
      setError('請先確認會員。');
      return;
    }

    if (!token) {
      setError('請先在管理端登入頁登入。');
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
      
      // Add item to list with all details (使用函數式更新確保狀態同步)
      setItems((prevItems) => {
        const newItems = [...prevItems, preview];
        itemsRef.current = newItems; // 同步更新 ref
        console.log('Added item to list:', { bookId: b, copiesSerial: c, newItemsCount: newItems.length });
        return newItems;
      });
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
      itemsRef.current = newItems; // 同步更新 ref
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
    setItems((prevItems) => {
      const removedItem = prevItems[index];
      const newItems = prevItems.filter((_, i) => i !== index);
      itemsRef.current = newItems; // 同步更新 ref
      console.log('Removed item:', { index, removedItem, newItemsCount: newItems.length });
      return newItems;
    });
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
    
    // 使用 ref 來獲取最新的 items 狀態
    const currentItems = itemsRef.current.length > 0 ? itemsRef.current : items;
    
    if (currentItems.length === 0) {
      setError('請至少添加一筆借書項目。');
      return;
    }
    
    const mid = memberDetail.member_id;

    // Revalidate all items before submission (先驗證，確保 items 是最新的)
    const isValid = await revalidateAllItems();
    if (!isValid) {
      return;
    }

    // 驗證完成後，使用最新的 items 狀態（從 ref 獲取，因為 revalidateAllItems 會更新它）
    const validatedItems = itemsRef.current.length > 0 ? itemsRef.current : items;
    
    // 如果從預約進入，檢查是否所有預約的書籍都已加入借書列表
    if (reservationData) {
      // 統一用數字來比較 book_id，避免型別不一致
      const reservationBookIds = reservationData.books.map(b => Number(b.book_id));
      // 使用 Set 來確保去重，因為同一本書可能有多個複本
      const borrowedBookIdsSet = new Set(validatedItems.map(item => Number(item.book_id)));
      
      console.log('Validation check after revalidate:', {
        reservationBookIds,
        borrowedBookIds: Array.from(borrowedBookIdsSet),
        items: validatedItems.map(i => ({ book_id: i.book_id, copies_serial: i.copies_serial }))
      });
      
      // 檢查是否所有預約的書籍都已加入（至少有一個複本）
      const missing = reservationBookIds.filter(
        (bookId) => !borrowedBookIdsSet.has(Number(bookId))
      );
      
      console.log('Missing books:', missing);
      
      if (missing.length > 0) {
        setMissingBooks(missing); // 記錄缺少的書籍 ID（統一為數字）
        const missingBookNames = missing.map((bookId) => {
          const book = reservationData.books.find(
            (b) => Number(b.book_id) === Number(bookId)
          );
          return book ? book.name : `Book ID: ${bookId}`;
        });
        setError(`請將預約中的所有書籍都加入借書列表。缺少：${missingBookNames.join('、')}`);
        return;
      } else {
        setMissingBooks([]); // 清除缺少的書籍記錄
      }
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Convert items to the format expected by the API
      const apiItems = validatedItems.map((it) => ({
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
        console.log('Sending reservation_id:', reservationData.reservation_id);
      } else {
        console.log('No reservation_id to send');
      }

      const res = await adminApi.borrow(token, borrowPayload);
      setResult(res);
      // Clear the list after successful submission
      setItems([]);
      itemsRef.current = []; // 清除 ref
      setBookIdInput('');
      setCopySerialInput('');
      setMissingBooks([]); // 清除缺少的書籍記錄
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
      setItems((prevItems) => {
        const newItems = [...prevItems, preview];
        itemsRef.current = newItems; // 同步更新 ref
        console.log('Added book to list:', { bookId, copiesSerial, newItemsCount: newItems.length });
        return newItems;
      });
      
      // 清除該書籍的缺少標記（如果有的話）
      setMissingBooks((prevMissing) => {
        const filtered = prevMissing.filter((id) => Number(id) !== Number(bookId));
        console.log('Updated missing books:', { bookId, prevMissing, filtered });
        return filtered;
      });
      
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
                  itemsRef.current = []; // 清除 ref
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
            <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>
                預約書籍
              </h3>
              <div style={{ fontSize: '0.875rem', color: '#666' }}>
                需加入全部 {reservationData.books.length} 本書籍才能辦理借書
              </div>
            </div>
            {reservationData.books.map((book) => {
              // 統一轉成數字來比較，避免後端傳回字串/數字不一致造成判斷錯誤
              const bookIdNum = Number(book.book_id);
              const isBookInList = items.some(item => Number(item.book_id) === bookIdNum);
              const addedCount = items.filter(item => Number(item.book_id) === bookIdNum).length;
              const isMissing = missingBooks.some(id => Number(id) === bookIdNum); // 是否在提交時被標記為缺少
              
              // Debug log
              if (process.env.NODE_ENV === 'development') {
                console.log('Book status check:', {
                  bookId: book.book_id,
                  isBookInList,
                  addedCount,
                  isMissing,
                  itemsCount: items.length,
                  items: items.map(i => ({ book_id: i.book_id, copies_serial: i.copies_serial }))
                });
              }
              
              return (
                <div
                  key={book.book_id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    backgroundColor: isBookInList ? '#f0fdf4' : (isMissing ? '#fef2f2' : '#fff'),
                    border: isBookInList ? '1px solid #10b981' : (isMissing ? '1px solid #ef4444' : '1px solid #e5e7eb'),
                    borderRadius: '4px',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      {isBookInList && (
                        <span style={{ color: '#10b981', fontWeight: '600', fontSize: '0.875rem' }}>
                          ✓ 已加入 ({addedCount} 本)
                        </span>
                      )}
                      {!isBookInList && !isMissing && (
                        <span style={{ color: '#666', fontWeight: '500', fontSize: '0.875rem' }}>
                          待加入
                        </span>
                      )}
                      {!isBookInList && isMissing && (
                        <span style={{ color: '#ef4444', fontWeight: '600', fontSize: '0.875rem' }}>
                          ⚠ 尚未辦理
                        </span>
                      )}
                    </div>
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
                onChange={(e) => setBookIdInput(e.target.value)}
                disabled={loading || validating || addingItem || !memberDetail}
                placeholder="請輸入書籍 ID"
              />
            </div>
            <div className="form-field">
              <label className="form-label">Copies Serial</label>
              <input
                className="form-input"
                value={copySerialInput}
                onChange={(e) => setCopySerialInput(e.target.value)}
                disabled={loading || validating || addingItem || !memberDetail}
                placeholder="請輸入副本序號"
              />
            </div>
            <div className="form-field" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={addItem}
                disabled={loading || validating || addingItem || !memberDetail}
              >
                {addingItem ? '加入中...' : '加入列表'}
              </button>
            </div>
          </div>
        )}

        {/* Items list */}
        {items.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <div className="card-title" style={{ marginBottom: '1rem' }}>借書列表</div>
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
                {items.map((item, index) => (
                  <tr key={`${item.book_id}-${item.copies_serial}-${index}`}>
                    <td>{item.book_id}</td>
                    <td>{item.copies_serial}</td>
                    <td>{item.book_name}</td>
                    <td>{item.status}</td>
                    <td>{item.rental_fee}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => removeItem(index)}
                        disabled={loading || validating}
                      >
                        移除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: '1rem', textAlign: 'right', fontSize: '1.1rem', fontWeight: '600' }}>
              總租金: {totalRentalFee}
            </div>
          </div>
        )}

        {/* Submit button */}
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || validating || items.length === 0}
          >
            {loading ? '處理中...' : '辦理借書'}
          </button>
        </div>

        {error && <div className="error-text" style={{ marginTop: '1rem' }}>{error}</div>}
        {result && (
          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #10b981' }}>
            <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: '#10b981' }}>借書成功！</div>
            <div>借書 ID: {result.loan_id}</div>
            <div>總租金: {result.total_rental_fee}</div>
          </div>
        )}
      </form>
    </div>
  );
}
