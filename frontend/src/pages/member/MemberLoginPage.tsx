import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { memberApi } from '../../api/memberApi';
import { useMember } from '../../context/MemberContext';

export function MemberLoginPage() {
  const { memberId, setMemberId } = useMember();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await memberApi.login(name, phone);
      setMemberId(result.member_id);
      // Redirect to member dashboard after successful login
      navigate('/member');
    } catch (e: any) {
      // Handle specific error messages from backend
      // Error format from api.ts: "CODE: message"
      if (e.message) {
        const errorMessage = e.message.includes(':') ? e.message.split(':').slice(1).join(':').trim() : e.message;
        setError(errorMessage);
      } else {
        setError('登入失敗，請稍後再試');
      }
    } finally {
      setLoading(false);
    }
  };

  // If already logged in, show current status
  if (memberId) {
    return (
      <div className="card">
        <div className="card-title">會員登入</div>
        <div className="text-muted">
          您已經登入，member_id: {memberId}
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => {
            setMemberId(null);
            setName('');
            setPhone('');
          }}
        >
          登出
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">會員登入</div>
      <form onSubmit={onSubmit}>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">帳號（姓名）</label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="請輸入姓名"
              required
            />
          </div>
          <div className="form-field">
            <label className="form-label">密碼（手機號碼）</label>
            <input
              className="form-input"
              type="password"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="請輸入手機號碼"
              required
            />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? '登入中...' : '登入'}
        </button>
        {error && <div className="error-text">{error}</div>}
      </form>
    </div>
  );
}

