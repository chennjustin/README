import { FormEvent, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { useAdmin } from '../../context/AdminContext';
import { MemberDetail, LoanSummary, LoanRecordDetail } from '../../types';
import { formatDate } from '../../utils/dateFormat';

export function AdminMemberDetailPage() {
  const { memberId: memberIdParam } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const { token } = useAdmin();
  const memberId = memberIdParam ? Number(memberIdParam) : null;

  const [memberDetail, setMemberDetail] = useState<MemberDetail | null>(null);
  const [loans, setLoans] = useState<LoanSummary[]>([]);
  const [expandedLoanId, setExpandedLoanId] = useState<number | null>(null);
  const [loanRecords, setLoanRecords] = useState<Record<number, LoanRecordDetail[]>>({});
  const [status, setStatus] = useState('Active');
  const [topUpAmount, setTopUpAmount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loansLoading, setLoansLoading] = useState(false);
  const [recordsLoading, setRecordsLoading] = useState<Record<number, boolean>>({});

  const requireToken = () => {
    if (!token) {
      setError('請先在管理端登入頁登入。');
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (!memberId || !Number.isFinite(memberId)) {
      setError('無效的會員 ID');
      return;
    }
    loadMemberDetail();
    loadMemberLoans();
  }, [memberId, token]);

  const loadMemberDetail = async () => {
    if (!requireToken() || !memberId) return;
    setDetailLoading(true);
    setError(null);
    try {
      const detail = await adminApi.getMemberDetail(token!, memberId);
      setMemberDetail(detail);
      setStatus(detail.status);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const loadMemberLoans = async () => {
    if (!requireToken() || !memberId) return;
    setLoansLoading(true);
    setError(null);
    try {
      const loanList = await adminApi.getMemberLoans(token!, memberId);
      setLoans(loanList);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoansLoading(false);
    }
  };

  const loadLoanRecords = async (loanId: number) => {
    if (!requireToken()) return;
    if (loanRecords[loanId]) {
      // Already loaded
      return;
    }
    setRecordsLoading((prev) => ({ ...prev, [loanId]: true }));
    try {
      const records = await adminApi.getLoanRecords(token!, loanId);
      setLoanRecords((prev) => ({ ...prev, [loanId]: records }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRecordsLoading((prev) => ({ ...prev, [loanId]: false }));
    }
  };

  const onUpdateStatus = async (e: FormEvent) => {
    e.preventDefault();
    if (!requireToken() || !memberId) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await adminApi.updateMemberStatus(token!, memberId, status);
      setMessage('更新會員狀態成功。');
      await loadMemberDetail();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onCreateTopUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!requireToken() || !memberId) return;
    if (topUpAmount <= 0) {
      setError('儲值金額必須大於 0');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await adminApi.createTopUp(token!, memberId, topUpAmount);
      setMessage('新增儲值成功。');
      setTopUpAmount(0);
      await loadMemberDetail();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleLoanDetails = async (loanId: number) => {
    if (expandedLoanId === loanId) {
      setExpandedLoanId(null);
    } else {
      setExpandedLoanId(loanId);
      await loadLoanRecords(loanId);
    }
  };

  if (!memberId || !Number.isFinite(memberId)) {
    return (
      <div className="card">
        <div className="error-text">無效的會員 ID</div>
      </div>
    );
  }

  if (detailLoading) {
    return (
      <div className="card">
        <div className="text-muted">載入中...</div>
      </div>
    );
  }

  if (!memberDetail) {
    return (
      <div className="card">
        <div className="error-text">找不到會員資料</div>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div className="card-title">會員資訊</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <strong>會員 ID：</strong> {memberDetail.member_id}
          </div>
          <div>
            <strong>姓名：</strong> {memberDetail.name}
          </div>
          <div>
            <strong>電話：</strong> {memberDetail.phone}
          </div>
          <div>
            <strong>Email：</strong> {memberDetail.email}
          </div>
          <div>
            <strong>狀態：</strong> {memberDetail.status}
          </div>
          <div>
            <strong>餘額：</strong> {memberDetail.balance}
          </div>
          <div>
            <strong>會員等級：</strong> {memberDetail.level_name}
          </div>
          <div>
            <strong>折扣率：</strong> {memberDetail.discount_rate}
          </div>
          <div>
            <strong>最大借閱本數：</strong> {memberDetail.max_book_allowed}
          </div>
          <div>
            <strong>借閱天數：</strong> {memberDetail.hold_days}
          </div>
          <div>
            <strong>加入日期：</strong> {formatDate(memberDetail.join_date)}
          </div>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/admin/members')}>
          返回會員列表
        </button>
      </div>

      <div className="card">
        <div className="card-title">修改會員狀態</div>
        <form onSubmit={onUpdateStatus}>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">狀態</label>
              <select
                className="form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            更新
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-title">新增儲值</div>
        {memberDetail.status !== 'Active' ? (
          <div className="text-muted">
            此會員狀態為 {memberDetail.status}，無法進行儲值操作
          </div>
        ) : (
          <form onSubmit={onCreateTopUp}>
            <div className="form-row">
              <div className="form-field">
                <label className="form-label">儲值金額</label>
                <input
                  className="form-input"
                  type="number"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(Number(e.target.value))}
                  min="1"
                  step="1"
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              新增儲值
            </button>
          </form>
        )}
      </div>

      <div className="card">
        <div className="card-title">儲值歷史記錄</div>
        {memberDetail.top_ups.length === 0 ? (
          <div className="text-muted">目前沒有儲值記錄。</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>儲值 ID</th>
                <th>金額</th>
                <th>日期</th>
                <th>處理人員</th>
              </tr>
            </thead>
            <tbody>
              {memberDetail.top_ups.map((topUp) => (
                <tr key={topUp.top_up_id}>
                  <td>{topUp.top_up_id}</td>
                  <td>{topUp.amount}</td>
                  <td>{formatDate(topUp.top_up_date)}</td>
                  <td>{topUp.admin_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-title">借閱紀錄</div>
        {loansLoading && <div className="text-muted">載入中...</div>}
        {!loansLoading && loans.length === 0 && (
          <div className="text-muted">目前沒有借閱記錄。</div>
        )}
        {!loansLoading && loans.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>借閱 ID</th>
                <th>借閱日期</th>
                <th>總金額</th>
                <th>項目數</th>
                <th>進行中</th>
                <th>處理人員</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <tr key={loan.loan_id}>
                  <td>{loan.loan_id}</td>
                  <td>{formatDate(loan.loan_date)}</td>
                  <td>{loan.final_price}</td>
                  <td>{loan.item_count}</td>
                  <td>{loan.active_count}</td>
                  <td>{loan.admin_name}</td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      onClick={() => toggleLoanDetails(loan.loan_id)}
                      disabled={recordsLoading[loan.loan_id]}
                    >
                      {expandedLoanId === loan.loan_id ? '隱藏詳情' : '查看詳情'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {expandedLoanId !== null && (
          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <h4>借閱 ID {expandedLoanId} 詳細記錄</h4>
            {recordsLoading[expandedLoanId] && <div className="text-muted">載入中...</div>}
            {!recordsLoading[expandedLoanId] && loanRecords[expandedLoanId] && (
              <>
                {loanRecords[expandedLoanId].length === 0 ? (
                  <div className="text-muted">沒有詳細記錄。</div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>書籍 ID</th>
                        <th>複本序號</th>
                        <th>書名</th>
                        <th>作者</th>
                        <th>出版社</th>
                        <th>借出日期</th>
                        <th>到期日期</th>
                        <th>歸還日期</th>
                        <th>租金</th>
                        <th>續借次數</th>
                        <th>書況</th>
                        <th>額外費用</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loanRecords[expandedLoanId].map((record, idx) => (
                        <tr key={`${record.book_id}-${record.copies_serial}-${idx}`}>
                          <td>{record.book_id}</td>
                          <td>{record.copies_serial}</td>
                          <td>{record.book_name}</td>
                          <td>{record.author}</td>
                          <td>{record.publisher || '-'}</td>
                          <td>{formatDate(record.date_out)}</td>
                          <td>{formatDate(record.due_date)}</td>
                          <td>{record.return_date ? formatDate(record.return_date) : '未歸還'}</td>
                          <td>{record.rental_fee}</td>
                          <td>{record.renew_cnt}</td>
                          <td>{record.book_condition}</td>
                          <td>
                            {record.add_fees && record.add_fees.length > 0 ? (
                              <div>
                                {record.add_fees.map((fee, feeIdx) => (
                                  <div key={feeIdx}>
                                    {fee.type}: {fee.amount} ({formatDate(fee.date)})
                                  </div>
                                ))}
                              </div>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {message && (
        <div className="card">
          <div className="text-muted">{message}</div>
        </div>
      )}
      {error && (
        <div className="card">
          <div className="error-text">{error}</div>
        </div>
      )}
    </>
  );
}

