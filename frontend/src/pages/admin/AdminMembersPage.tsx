import { FormEvent, useState } from 'react';
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
      setCreateForm({ name: '', phone: '', email: '', initialBalance: 0 });
    } catch (e: any) {
      setError(e.message);
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
      setError(e.message);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
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
        <div className="card-title">搜尋結果</div>
        {searchLoading && <div className="text-muted">載入中...</div>}
        {!searchLoading && searchResults.length === 0 && searchMemberId === '' && searchName === '' && (
          <div className="text-muted">請輸入搜尋條件進行搜尋。</div>
        )}
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
                <th>Email</th>
                <th>狀態</th>
                <th>餘額</th>
                <th>加入日期</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.map((member) => (
                <tr key={member.member_id}>
                  <td>{member.member_id}</td>
                  <td>
                    <Link to={`/admin/members/${member.member_id}`}>{member.name}</Link>
                  </td>
                  <td>{member.phone}</td>
                  <td>{member.email}</td>
                  <td>{member.status}</td>
                  <td>{member.balance}</td>
                  <td>{member.join_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}


