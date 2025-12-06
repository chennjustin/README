import { useEffect, useState } from 'react';
import { memberApi } from '../../api/memberApi';
import { useMember } from '../../context/MemberContext';
import { LoanItem } from '../../types';
import { formatDate } from '../../utils/dateFormat';

export function MemberLoansActivePage() {
  const { memberId } = useMember();
  const [items, setItems] = useState<LoanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!memberId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await memberApi.getActiveLoans(memberId);
      setItems(data);
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

  const renew = async (loanId: number, bookId: number, copiesSerial: number) => {
    if (!memberId) return;
    try {
      await memberApi.renewLoan(memberId, loanId, bookId, copiesSerial);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // 檢查是否可以續借
  const canRenew = (item: LoanItem): boolean => {
    // 已續借過就不能再續借
    if (item.renew_cnt >= 1) return false;
    
    // 檢查是否已到期（期限當天也可以續借）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(item.due_date);
    dueDate.setHours(0, 0, 0, 0);
    
    // 如果到期日期在今天或之後，可以續借
    return dueDate >= today;
  };

  // 獲取續借狀態文字
  const getRenewStatus = (item: LoanItem): string => {
    if (item.renew_cnt >= 1) return '已續借';
    if (canRenew(item)) return '可續借';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(item.due_date);
    dueDate.setHours(0, 0, 0, 0);
    
    if (dueDate < today) return '已逾期，無法續借';
    return '不可續借';
  };


  return (
    <div className="card">
      <div className="card-title">目前借閱中</div>
      {!memberId && <div className="text-muted">請先在「個人總覽」設定 member_id。</div>}
      {memberId && (
        <>
          {loading && <div className="text-muted">載入中...</div>}
          {error && <div className="error-text">{error}</div>}
          {!loading && items.length === 0 && (
            <div className="text-muted">目前沒有借閱中的書。</div>
          )}
          {items.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>Loan ID</th>
                  <th>書籍</th>
                  <th>副本</th>
                  <th>借出日期</th>
                  <th>到期日</th>
                  <th>租金</th>
                  <th>續借狀態</th>
                  <th>額外費用</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={`${r.loan_id}-${r.book_id}-${r.copies_serial}`}>
                    <td>{r.loan_id}</td>
                    <td>{r.book_name}</td>
                    <td>{r.copies_serial}</td>
                    <td>{formatDate(r.date_out)}</td>
                    <td>{formatDate(r.due_date)}</td>
                    <td>{r.rental_fee}</td>
                    <td>
                      <span className={r.renew_cnt >= 1 ? 'text-muted' : canRenew(r) ? 'text-success' : 'text-error'}>
                        {getRenewStatus(r)}
                      </span>
                      {r.renew_cnt >= 1 && <span className="text-muted"> ({r.renew_cnt} 次)</span>}
                    </td>
                    <td>{r.add_fee_total}</td>
                    <td>
                      <button
                        className={canRenew(r) ? 'btn btn-primary' : 'btn btn-secondary'}
                        onClick={() => canRenew(r) && renew(r.loan_id, r.book_id, r.copies_serial)}
                        disabled={!canRenew(r)}
                      >
                        續借
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}


