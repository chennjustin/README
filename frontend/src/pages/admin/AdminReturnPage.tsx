import { FormEvent, useState } from 'react';
import { adminApi } from '../../api/adminApi';
import { useAdmin } from '../../context/AdminContext';
import {
  LoanSearchResult,
  LoanSearchRecord,
  FineCalculationRequest,
  FineCalculationItem,
  BatchReturnItem,
} from '../../types';

interface ReturnListItem extends LoanSearchRecord {
  final_condition?: string;
  lost: boolean;
  fine_calculation?: FineCalculationItem;
}

export function AdminReturnPage() {
  const { token } = useAdmin();
  const [searchType, setSearchType] = useState<'loan_id' | 'member_id'>('loan_id');
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState<LoanSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [returnList, setReturnList] = useState<ReturnListItem[]>([]);
  const [calculatingFines, setCalculatingFines] = useState(false);
  const [returning, setReturning] = useState(false);
  const [returnResult, setReturnResult] = useState<{ success_count: number; fail_count: number; results?: any[] } | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [expandedLoans, setExpandedLoans] = useState<Set<number>>(new Set());

  // Get available condition options based on original condition
  const getConditionOptions = (originalCondition: string): Array<{ value: string; label: string }> => {
    const options: Array<{ value: string; label: string }> = [{ value: '', label: '保持原狀' }];
    
    if (originalCondition === 'Good') {
      options.push({ value: 'Fair', label: 'Fair' }, { value: 'Poor', label: 'Poor' });
    } else if (originalCondition === 'Fair') {
      options.push({ value: 'Poor', label: 'Poor' });
    }
    // If originalCondition is 'Poor', only '保持原狀' option is available
    
    return options;
  };

  // Format date to display (YYYY-MM-DD)
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Calculate overdue days and get return status
  const getReturnStatus = (dueDate: string): { status: string; overdueDays: number } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
      return { status: '逾期', overdueDays: diffDays };
    } else {
      return { status: '正常', overdueDays: 0 };
    }
  };

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      setSearchError('請先在管理端登入頁登入。');
      return;
    }
    const value = Number(searchValue);
    if (!Number.isFinite(value)) {
      setSearchError('請輸入有效的數字。');
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults([]);
    try {
      const res = await adminApi.searchLoans(token, searchType, value);
      setSearchResults(res.loans);
      // Initialize all loans as expanded by default
      setExpandedLoans(new Set(res.loans.map((loan) => loan.loan_id)));
      if (res.loans.length === 0) {
        setSearchError('找不到未還書的記錄。');
      }
    } catch (e: any) {
      setSearchError(e.message || '搜尋失敗');
    } finally {
      setSearchLoading(false);
    }
  };

  const isRecordInList = (record: LoanSearchRecord): boolean => {
    return returnList.some(
      (item) =>
        item.loan_id === record.loan_id &&
        item.book_id === record.book_id &&
        item.copies_serial === record.copies_serial
    );
  };

  const handleAddToReturnList = (record: LoanSearchRecord) => {
    if (isRecordInList(record)) {
      return;
    }
    setReturnList([
      ...returnList,
      {
        ...record,
        final_condition: undefined,
        lost: false,
      },
    ]);
  };

  const handleRemoveFromReturnList = (loanId: number, bookId: number, copiesSerial: number) => {
    setReturnList(
      returnList.filter(
        (item) =>
          !(item.loan_id === loanId && item.book_id === bookId && item.copies_serial === copiesSerial)
      )
    );
    // Clear fine calculation when removing
    setReturnResult(null);
  };

  const handleUpdateReturnItem = (
    loanId: number,
    bookId: number,
    copiesSerial: number,
    updates: Partial<Pick<ReturnListItem, 'final_condition' | 'lost'>>
  ) => {
    setReturnList(
      returnList.map((item) =>
        item.loan_id === loanId && item.book_id === bookId && item.copies_serial === copiesSerial
          ? { ...item, ...updates, fine_calculation: undefined }
          : item
      )
    );
    // Clear fine calculation when updating
    setReturnResult(null);
  };

  const handleCalculateFines = async () => {
    if (!token) {
      setReturnError('請先在管理端登入頁登入。');
      return;
    }
    if (returnList.length === 0) {
      setReturnError('還書列表為空。');
      return;
    }
    setCalculatingFines(true);
    setReturnError(null);
    try {
      const items: FineCalculationRequest[] = returnList.map((item) => ({
        loan_id: item.loan_id,
        book_id: item.book_id,
        copies_serial: item.copies_serial,
        final_condition: item.final_condition,
        lost: item.lost,
        due_date: item.due_date,
        purchase_price: item.purchase_price,
        original_condition: item.original_condition,
      }));
      const res = await adminApi.calculateFines(token, items);
      // Map fine calculations back to return list items
      const fineMap = new Map<string, FineCalculationItem>();
      res.items.forEach((item) => {
        const key = `${item.loan_id}-${item.book_id}-${item.copies_serial}`;
        fineMap.set(key, item);
      });
      setReturnList(
        returnList.map((item) => {
          const key = `${item.loan_id}-${item.book_id}-${item.copies_serial}`;
          return {
            ...item,
            fine_calculation: fineMap.get(key),
          };
        })
      );
    } catch (e: any) {
      setReturnError(e.message || '試算罰金失敗');
    } finally {
      setCalculatingFines(false);
    }
  };

  const toggleLoanExpanded = (loanId: number) => {
    setExpandedLoans((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(loanId)) {
        newSet.delete(loanId);
      } else {
        newSet.add(loanId);
      }
      return newSet;
    });
  };

  const handleBatchReturn = async () => {
    if (!token) {
      setReturnError('請先在管理端登入頁登入。');
      return;
    }
    if (returnList.length === 0) {
      setReturnError('還書列表為空。');
      return;
    }
    setReturning(true);
    setReturnError(null);
    try {
      const items: BatchReturnItem[] = returnList.map((item) => ({
        loan_id: item.loan_id,
        book_id: item.book_id,
        copies_serial: item.copies_serial,
        final_condition: item.final_condition,
        lost: item.lost,
        immediateCharge: false,
      }));
      const res = await adminApi.batchReturn(token, items);
      setReturnResult({
        success_count: res.success_count,
        fail_count: res.fail_count,
        results: res.results,
      });
      // Remove successfully returned items from list
      const successKeys = new Set(
        res.results
          .filter((r) => r.success)
          .map((r) => `${r.loan_id}-${r.book_id}-${r.copies_serial}`)
      );
      setReturnList(returnList.filter((item) => !successKeys.has(`${item.loan_id}-${item.book_id}-${item.copies_serial}`)));
      // Clear search results after successful return
      if (res.fail_count === 0) {
        setSearchResults([]);
        setSearchValue('');
        setExpandedLoans(new Set());
      }
    } catch (e: any) {
      setReturnError(e.message || '批次還書失敗');
    } finally {
      setReturning(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">櫃檯還書</div>

      {/* Search Section */}
      <div style={{ marginBottom: '2rem' }}>
        <form onSubmit={handleSearch}>
        <div className="form-row">
          <div className="form-field">
              <label className="form-label">搜尋類型</label>
              <select
                className="form-select"
                value={searchType}
                onChange={(e) => {
                  setSearchType(e.target.value as 'loan_id' | 'member_id');
                  setSearchResults([]);
                  setSearchValue('');
                }}
              >
                <option value="loan_id">Book Loan ID (loan_id)</option>
                <option value="member_id">Member ID (member_id)</option>
              </select>
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">
                {searchType === 'loan_id' ? 'Book Loan ID' : 'Member ID'}
              </label>
            <input
              className="form-input"
                type="number"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={`請輸入${searchType === 'loan_id' ? 'Book Loan ID' : 'Member ID'}`}
            />
          </div>
            <div className="form-field" style={{ alignSelf: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={searchLoading}>
                {searchLoading ? '搜尋中...' : '搜尋'}
              </button>
            </div>
          </div>
        </form>
        {searchError && <div className="error-text" style={{ marginTop: '0.5rem' }}>{searchError}</div>}
      </div>

      {/* Search Results Section */}
      {searchResults.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: '600' }}>搜尋結果</h3>
          {searchResults.map((loan) => {
            const isExpanded = expandedLoans.has(loan.loan_id);
            return (
              <div
                key={loan.loan_id}
                style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  backgroundColor: '#f9f9f9',
                }}
              >
                <div
                  style={{
                    marginBottom: '0.75rem',
                    fontWeight: '600',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  onClick={() => toggleLoanExpanded(loan.loan_id)}
                >
                  <div style={{ flex: 1 }}>
                    <div>Loan ID: {loan.loan_id} | Member ID: {loan.member_id} | 會員姓名: {loan.member_name}</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '400', marginTop: '0.25rem' }}>
                      借書日期: {formatDate(loan.loan_date)} | 應還書日期: {formatDate(loan.max_due_date)}
                    </div>
                  </div>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      marginLeft: '1rem',
                      flexShrink: 0,
                    }}
                  >
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
                {isExpanded && (
                  <div>
                    <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>借閱記錄：</div>
                    {loan.records.map((record) => (
                  <div
                    key={`${record.loan_id}-${record.book_id}-${record.copies_serial}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      backgroundColor: isRecordInList(record) ? '#e8f5e9' : '#fff',
                      border: isRecordInList(record) ? '2px solid #4caf50' : '1px solid #e0e0e0',
                      borderRadius: '4px',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div>
                        <strong>Book ID:</strong> {record.book_id} | <strong>Copies Serial:</strong>{' '}
                        {record.copies_serial} | <strong>書名:</strong> {record.book_name} |{' '}
                        <strong>原本狀態:</strong> {record.original_condition}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                        借出日期: {formatDate(record.date_out)} | 到期日期: {formatDate(record.due_date)} | 還書狀態:{' '}
                        {(() => {
                          const recordStatus = getReturnStatus(record.due_date);
                          return (
                            <span
                              style={{
                                color: recordStatus.status === '逾期' ? '#f44336' : '#4caf50',
                                fontWeight: '600',
                              }}
                            >
                              {recordStatus.status === '逾期'
                                ? `逾期（逾期 ${recordStatus.overdueDays} 天）`
                                : '正常'}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    {isRecordInList(record) ? (
                      <button
                        className="btn"
                        style={{ backgroundColor: '#f44336', color: 'white', marginLeft: '1rem' }}
                        onClick={() =>
                          handleRemoveFromReturnList(record.loan_id, record.book_id, record.copies_serial)
                        }
                      >
                        移除
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        style={{ marginLeft: '1rem' }}
                        onClick={() => handleAddToReturnList(record)}
                      >
                        加入還書列表
                      </button>
                    )}
                  </div>
                    ))}
                  </div>
                )}
          </div>
            );
          })}
        </div>
      )}

      {/* Return List Section */}
      {returnList.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: '600' }}>還書列表</h3>
          {returnList.map((item) => (
            <div
              key={`${item.loan_id}-${item.book_id}-${item.copies_serial}`}
              style={{
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                padding: '1rem',
                marginBottom: '1rem',
                backgroundColor: '#fff',
              }}
            >
              <div style={{ marginBottom: '0.75rem' }}>
                <strong>Loan ID:</strong> {item.loan_id} | <strong>Book ID:</strong> {item.book_id} |{' '}
                <strong>Copies Serial:</strong> {item.copies_serial} | <strong>書名:</strong> {item.book_name}
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <strong>原本狀態:</strong> {item.original_condition} | <strong>到期日期:</strong> {item.due_date}
        </div>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">最終書況</label>
            <select
              className="form-select"
                    value={item.final_condition || ''}
                    onChange={(e) =>
                      handleUpdateReturnItem(
                        item.loan_id,
                        item.book_id,
                        item.copies_serial,
                        { final_condition: e.target.value || undefined }
                      )
                    }
                    disabled={item.lost}
                  >
                    {getConditionOptions(item.original_condition).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
            </select>
          </div>
          <div className="form-field">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
                      checked={item.lost}
                      onChange={(e) =>
                        handleUpdateReturnItem(
                          item.loan_id,
                          item.book_id,
                          item.copies_serial,
                          { lost: e.target.checked }
                        )
                      }
                      style={{ marginRight: '0.5rem' }}
                    />
                    標記為遺失
                  </label>
                </div>
              </div>
              {item.fine_calculation && (
                <div
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    backgroundColor: '#fff3e0',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                  }}
                >
                  <div>
                    <strong>逾期天數:</strong> {item.fine_calculation.overdue_days} 天
                  </div>
                  <div>
                    <strong>罰金明細:</strong> 逾期罰金 {item.fine_calculation.fine_breakdown.overdue_fee} | 損壞罰金{' '}
                    {item.fine_calculation.fine_breakdown.damage_fee} | 遺失罰金{' '}
                    {item.fine_calculation.fine_breakdown.lost_fee}
                  </div>
                  <div style={{ marginTop: '0.5rem', fontWeight: '600' }}>
                    <strong>總罰金:</strong> {item.fine_calculation.fine_breakdown.total}
                  </div>
                </div>
              )}
              <button
                className="btn"
                style={{
                  marginTop: '0.75rem',
                  backgroundColor: '#f44336',
                  color: 'white',
                }}
                onClick={() =>
                  handleRemoveFromReturnList(item.loan_id, item.book_id, item.copies_serial)
                }
              >
                從列表中移除
              </button>
            </div>
          ))}
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={handleCalculateFines}
              disabled={calculatingFines}
            >
              {calculatingFines ? '試算中...' : '試算罰金'}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleBatchReturn}
              disabled={returning}
            >
              {returning ? '辦理還書中...' : '辦理還書'}
            </button>
          </div>
        </div>
      )}

      {/* Return Result */}
      {returnResult && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: returnResult.fail_count === 0 ? '#e8f5e9' : '#fff3e0',
            borderRadius: '4px',
          }}
        >
          <div style={{ fontWeight: '600', marginBottom: returnResult.fail_count > 0 ? '0.5rem' : '0' }}>
            本次還書成功 {returnResult.success_count} 筆、失敗 {returnResult.fail_count} 筆
          </div>
          {returnResult.fail_count > 0 && returnResult.results && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>失敗詳情：</div>
              {returnResult.results
                .filter((r) => !r.success)
                .map((r, idx) => (
                  <div key={idx} style={{ marginTop: '0.25rem', fontSize: '0.9rem', color: '#d32f2f' }}>
                    Loan ID {r.loan_id}, Book ID {r.book_id}, Copies {r.copies_serial}: {r.error || '未知錯誤'}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {returnError && (
        <div className="error-text" style={{ marginTop: '1rem' }}>
          {returnError}
        </div>
      )}
    </div>
  );
}
