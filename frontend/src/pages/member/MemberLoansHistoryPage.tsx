import { useEffect, useState } from 'react';
import { memberApi } from '../../api/memberApi';
import { useMember } from '../../context/MemberContext';
import { LoanItem } from '../../types';
import { formatDate } from '../../utils/dateFormat';

export function MemberLoansHistoryPage() {
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
      const data = await memberApi.getHistoryLoans(memberId);
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

  return (
    <div className="card">
      <div className="card-title">歷史借閱紀錄</div>
      {!memberId && <div className="text-muted">請先在「個人總覽」設定 member_id。</div>}
      {memberId && (
        <>
          {loading && <div className="text-muted">載入中...</div>}
          {error && <div className="error-text">{error}</div>}
          {!loading && items.length === 0 && (
            <div className="text-muted">目前沒有歷史紀錄。</div>
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
                  <th>歸還日</th>
                  <th>租金</th>
                  <th>額外費用</th>
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
                    <td>{r.return_date ? formatDate(r.return_date) : '未歸還'}</td>
                    <td>{r.rental_fee}</td>
                    <td>{r.add_fee_total}</td>
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


