import { FormEvent, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { useAdmin } from '../../context/AdminContext';

export function AdminLoginPage() {
  const { admin, setAuth } = useAdmin();
  const navigate = useNavigate();
  
  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (admin) {
      navigate('/admin', { replace: true });
    }
  }, [admin, navigate]);
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
      // Redirect to admin dashboard after successful login
      navigate('/admin', { replace: true });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // If already logged in, redirect will happen in useEffect
  // Show loading state while redirecting
  if (admin) {
    return (
      <div className="card">
        <div className="card-title">管理端登入</div>
        <div className="text-muted">正在導向...</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">管理端登入</div>
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


