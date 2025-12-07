import { useEffect, useState } from 'react';
import { memberApi } from '../../api/memberApi';
import { useMember } from '../../context/MemberContext';
import { MemberHistoryLoan } from '../../types';
import { formatDate } from '../../utils/dateFormat';

export function MemberLoansHistoryPage() {
  const { memberId } = useMember();
  const [loans, setLoans] = useState<MemberHistoryLoan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedLoans, setExpandedLoans] = useState<Set<number>>(new Set());

  const load = async () => {
    if (!memberId) {
      setLoans([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await memberApi.getHistoryLoans(memberId);
      setLoans(data);
      // 預設展開所有 loan
      setExpandedLoans(new Set(data.map((loan) => loan.loan_id)));
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

  return (
    <div className="card">
      <div className="card-title">歷史借閱紀錄</div>
      {!memberId && <div className="text-muted">請先在「個人總覽」設定 member_id。</div>}
      {memberId && (
        <>
          {loading && <div className="text-muted">載入中...</div>}
          {error && <div className="error-text">{error}</div>}
          {!loading && loans.length === 0 && (
            <div className="text-muted">目前沒有歷史紀錄。</div>
          )}
          {loans.length > 0 && (
            <div>
              {loans.map((loan) => {
                const isExpanded = expandedLoans.has(loan.loan_id);
                const totalAddFee = loan.records.reduce((sum, r) => sum + r.add_fee_total, 0);
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
                        <div>
                          Loan ID: {loan.loan_id} | 總租金: {loan.final_price} | 總額外費用: {totalAddFee}
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: '400', marginTop: '0.25rem' }}>
                          借書日期: {formatDate(loan.loan_date)} | 歸還日期: {formatDate(loan.return_date)} | 借閱書籍數: {loan.records.length} 本
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
                        <table className="table" style={{ marginTop: '0.5rem' }}>
                          <thead>
                            <tr>
                              <th>書籍</th>
                              <th>副本</th>
                              <th>借出日期</th>
                              <th>到期日</th>
                              <th>歸還日</th>
                              <th>租金</th>
                              <th>額外費用</th>
                            </tr>
                          </thead>
                          <tbody>
                            {loan.records.map((record) => (
                              <tr key={`${record.loan_id}-${record.book_id}-${record.copies_serial}`}>
                                <td>
                                  <div>
                                    <strong>{record.book_name}</strong>
                                    {record.author && <div style={{ fontSize: '0.85rem', color: '#666' }}>{record.author}</div>}
                                  </div>
                                </td>
                                <td>{record.copies_serial}</td>
                                <td>{formatDate(record.date_out)}</td>
                                <td>{formatDate(record.due_date)}</td>
                                <td>{formatDate(record.return_date)}</td>
                                <td>{record.rental_fee}</td>
                                <td>{record.add_fee_total}</td>
                              </tr>
                            ))}
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


