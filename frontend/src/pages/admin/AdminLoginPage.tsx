import { FormEvent, useState } from 'react';
import { adminApi } from '../../api/adminApi';
import { useAdmin } from '../../context/AdminContext';

export function AdminLoginPage() {
  const { admin, setAuth } = useAdmin();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi.login(name, phone);
      setAuth(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">管理端登入</div>
      {admin && (
        <div className="text-muted">
          目前以管理員 {admin.name} ({admin.role}) 登入。
        </div>
      )}
      <form onSubmit={onSubmit}>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">帳號 (姓名)</label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="請輸入姓名"
            />
          </div>
          <div className="form-field">
            <label className="form-label">密碼 (手機號碼)</label>
            <input
              className="form-input"
              type="password"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="請輸入手機號碼"
            />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          登入
        </button>
        {error && <div className="error-text">{error}</div>}
      </form>
    </div>
  );
}


