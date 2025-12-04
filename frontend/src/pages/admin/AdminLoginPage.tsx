import { FormEvent, useState } from 'react';
import { adminApi } from '../../api/adminApi';
import { useAdmin } from '../../context/AdminContext';

export function AdminLoginPage() {
  const { admin, setAuth } = useAdmin();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi.login(name, phone, password);
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
            <label className="form-label">姓名</label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">電話</label>
            <input
              className="form-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">密碼</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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


