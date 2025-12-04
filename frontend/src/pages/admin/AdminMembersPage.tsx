import { FormEvent, useState } from 'react';
import { adminApi } from '../../api/adminApi';
import { useAdmin } from '../../context/AdminContext';

export function AdminMembersPage() {
  const { token } = useAdmin();
  const [createForm, setCreateForm] = useState({
    name: '',
    phone: '',
    email: '',
    initialBalance: 0,
  });
  const [balanceMemberId, setBalanceMemberId] = useState('');
  const [balanceAmount, setBalanceAmount] = useState(0);
  const [statusMemberId, setStatusMemberId] = useState('');
  const [status, setStatus] = useState('Active');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requireToken = () => {
    if (!token) {
      setError('請先在管理端登入頁登入。');
      return false;
    }
    return true;
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!requireToken()) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await adminApi.createMember(token!, createForm);
      setMessage('新增會員成功。');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onAdjustBalance = async (e: FormEvent) => {
    e.preventDefault();
    if (!requireToken()) return;
    const id = Number(balanceMemberId);
    if (!Number.isFinite(id)) {
      setError('請輸入有效的 memberId。');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await adminApi.adjustMemberBalance(token!, id, balanceAmount);
      setMessage('調整餘額成功。');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onUpdateStatus = async (e: FormEvent) => {
    e.preventDefault();
    if (!requireToken()) return;
    const id = Number(statusMemberId);
    if (!Number.isFinite(id)) {
      setError('請輸入有效的 memberId。');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await adminApi.updateMemberStatus(token!, id, status);
      setMessage('更新會員狀態成功。');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="card">
        <div className="card-title">新增會員</div>
        <form onSubmit={onCreate}>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">姓名</label>
              <input
                className="form-input"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label className="form-label">電話</label>
              <input
                className="form-input"
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label className="form-label">初始儲值金額</label>
              <input
                className="form-input"
                type="number"
                value={createForm.initialBalance}
                onChange={(e) =>
                  setCreateForm({ ...createForm, initialBalance: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            新增會員
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-title">調整會員餘額</div>
        <form onSubmit={onAdjustBalance}>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Member ID</label>
              <input
                className="form-input"
                value={balanceMemberId}
                onChange={(e) => setBalanceMemberId(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">調整金額（可正可負）</label>
              <input
                className="form-input"
                type="number"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(Number(e.target.value))}
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            送出
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-title">修改會員狀態</div>
        <form onSubmit={onUpdateStatus}>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Member ID</label>
              <input
                className="form-input"
                value={statusMemberId}
                onChange={(e) => setStatusMemberId(e.target.value)}
              />
            </div>
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
        {message && <div className="text-muted">{message}</div>}
        {error && <div className="error-text">{error}</div>}
      </div>
    </>
  );
}


