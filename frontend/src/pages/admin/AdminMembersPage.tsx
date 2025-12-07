import { FormEvent, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { useAdmin } from '../../context/AdminContext';
import { MemberSearchResult } from '../../types';

export function AdminMembersPage() {
  const { token } = useAdmin();
  const [createForm, setCreateForm] = useState({
    name: '',
    phone: '',
    email: '',
    initialBalance: 0,
  });
  const [searchMemberId, setSearchMemberId] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberSearchResult | null>(null);
  const [topUpAmount, setTopUpAmount] = useState(0);
  const [newStatus, setNewStatus] = useState('Active');
  const [actionLoading, setActionLoading] = useState(false);

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

    // Validate all fields are filled
    setError(null);
    setMessage(null);

    if (!createForm.name || createForm.name.trim() === '') {
      setError('請填寫姓名欄位');
      return;
    }
    if (!createForm.phone || createForm.phone.trim() === '') {
      setError('請填寫電話欄位');
      return;
    }
    if (!createForm.email || createForm.email.trim() === '') {
      setError('請填寫Email欄位');
      return;
    }

    setLoading(true);
    try {
      await adminApi.createMember(token!, createForm);
      setMessage('新增會員成功！');
      setCreateForm({ name: '', phone: '', email: '', initialBalance: 0 });
    } catch (e: any) {
      // Handle specific error messages from backend
      if (e.message && e.message.includes('該會員已註冊')) {
        setError('該會員已註冊');
      } else {
        setError(e.message || '新增會員失敗');
      }
    } finally {
      setLoading(false);
    }
  };

  const onSearch = async () => {
    if (!requireToken()) return;
    setSearchLoading(true);
    setError(null);
    try {
      const params: { memberId?: string; name?: string } = {};
      if (searchMemberId.trim()) {
        params.memberId = searchMemberId.trim();
      }
      if (searchName.trim()) {
        params.name = searchName.trim();
      }
      const results = await adminApi.searchMembers(token!, params);
      setSearchResults(results);
    } catch (e: any) {
      // Handle authentication errors specially
      if (e.name === 'AuthenticationError' || e.message?.includes('UNAUTHORIZED')) {
        setError('登入已過期，請重新登入');
      } else {
        setError(e.message);
      }
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Auto-load all members on page load
  useEffect(() => {
    if (token) {
      const loadAllMembers = async () => {
        if (!token) return;
        setSearchLoading(true);
        setError(null);
        try {
          const results = await adminApi.searchMembers(token, {});
          setSearchResults(results);
        } catch (e: any) {
          // Handle authentication errors specially
          if (e.name === 'AuthenticationError' || e.message?.includes('UNAUTHORIZED')) {
            setError('登入已過期，請重新登入');
          } else {
            setError(e.message);
          }
          setSearchResults([]);
        } finally {
          setSearchLoading(false);
        }
      };
      loadAllMembers();
    }
  }, [token]);

  const handleTopUpClick = (member: MemberSearchResult) => {
    setSelectedMember(member);
    setTopUpAmount(0);
    setError(null);
    setTopUpModalOpen(true);
  };

  const handleStatusClick = (member: MemberSearchResult) => {
    setSelectedMember(member);
    setNewStatus(member.status);
    setError(null);
    setStatusModalOpen(true);
  };

  const closeTopUpModal = () => {
    setTopUpModalOpen(false);
    setSelectedMember(null);
    setTopUpAmount(0);
    setError(null);
  };

  const closeStatusModal = () => {
    setStatusModalOpen(false);
    setSelectedMember(null);
    setError(null);
  };

  const handleTopUpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!requireToken() || !selectedMember || topUpAmount <= 0) {
      setError('請輸入有效的儲值金額');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await adminApi.createTopUp(token!, selectedMember.member_id, topUpAmount);
      setMessage(`會員 ${selectedMember.name} 儲值成功。`);
      closeTopUpModal();
      await onSearch(); // Reload member list
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!requireToken() || !selectedMember) {
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await adminApi.updateMemberStatus(token!, selectedMember.member_id, newStatus);
      setMessage(`會員 ${selectedMember.name} 狀態更新成功。`);
      closeStatusModal();
      await onSearch(); // Reload member list
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
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
        {message && <div className="text-muted">{message}</div>}
      </div>

      <div className="card">
        <div className="card-title">會員搜尋</div>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">Member ID</label>
            <input
              className="form-input"
              value={searchMemberId}
              onChange={(e) => setSearchMemberId(e.target.value)}
              placeholder="輸入會員 ID"
            />
          </div>
          <div className="form-field">
            <label className="form-label">姓名</label>
            <input
              className="form-input"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="輸入姓名關鍵字"
            />
          </div>
        </div>
        <button className="btn btn-primary" onClick={onSearch} disabled={searchLoading}>
          搜尋
        </button>
        {error && <div className="error-text">{error}</div>}
      </div>

      <div className="card">
        <div className="card-title">會員列表</div>
        {searchLoading && <div className="text-muted">載入中...</div>}
        {!searchLoading && searchResults.length === 0 && (searchMemberId !== '' || searchName !== '') && (
          <div className="text-muted">目前沒有符合條件的會員。</div>
        )}
        {searchResults.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>姓名</th>
                <th>電話</th>
                <th>狀態</th>
                <th>餘額</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.map((member) => (
                <tr key={member.member_id}>
                  <td>
                    <Link to={`/admin/members/${member.member_id}`}>{member.member_id}</Link>
                  </td>
                  <td>
                    <Link to={`/admin/members/${member.member_id}`}>{member.name}</Link>
                  </td>
                  <td>{member.phone}</td>
                  <td>{member.status}</td>
                  <td>{member.balance}</td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                      onClick={() => handleTopUpClick(member)}
                      disabled={member.status !== 'Active'}
                      title={member.status !== 'Active' ? `會員狀態為 ${member.status}，無法進行儲值操作` : ''}
                    >
                      新增儲值
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                      onClick={() => handleStatusClick(member)}
                    >
                      修改狀態
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Top-up Modal */}
      {topUpModalOpen && selectedMember && (
        <div className="modal-overlay" onClick={closeTopUpModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">新增儲值</h2>
              <button className="modal-close" onClick={closeTopUpModal} aria-label="關閉">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <form onSubmit={handleTopUpSubmit}>
              <div className="modal-body">
                <div className="form-field" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">會員：</label>
                  <div>
                    {selectedMember.name} (ID: {selectedMember.member_id})
                  </div>
                </div>
                <div className="form-field" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">目前餘額：</label>
                  <div>{selectedMember.balance}</div>
                </div>
                <div className="form-field">
                  <label className="form-label">儲值金額</label>
                  <input
                    className="form-input"
                    type="number"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(Number(e.target.value))}
                    min="1"
                    step="1"
                    required
                    autoFocus
                  />
                </div>
                {error && <div className="error-text" style={{ marginTop: '1rem' }}>{error}</div>}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeTopUpModal}
                  disabled={actionLoading}
                >
                  取消
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? '處理中...' : '確認儲值'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {statusModalOpen && selectedMember && (
        <div className="modal-overlay" onClick={closeStatusModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">修改狀態</h2>
              <button className="modal-close" onClick={closeStatusModal} aria-label="關閉">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <form onSubmit={handleStatusSubmit}>
              <div className="modal-body">
                <div className="form-field" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">會員：</label>
                  <div>
                    {selectedMember.name} (ID: {selectedMember.member_id})
                  </div>
                </div>
                <div className="form-field" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">目前狀態：</label>
                  <div>{selectedMember.status}</div>
                </div>
                <div className="form-field">
                  <label className="form-label">新狀態</label>
                  <select
                    className="form-select"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    required
                    autoFocus
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
                {error && <div className="error-text" style={{ marginTop: '1rem' }}>{error}</div>}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeStatusModal}
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


