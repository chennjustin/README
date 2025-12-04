import { useEffect, useState } from 'react';
import { memberApi } from '../../api/memberApi';
import { useMember } from '../../context/MemberContext';
import { MemberProfile } from '../../types';

export function MemberDashboard() {
  const { memberId, setMemberId } = useMember();
  const [inputId, setInputId] = useState(memberId ? String(memberId) : '');
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadProfile = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await memberApi.getProfile(id);
      setProfile(data);
    } catch (e: any) {
      setError(e.message);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (memberId) {
      loadProfile(memberId);
    }
  }, [memberId]);

  const handleSetMember = () => {
    const id = Number(inputId);
    if (!Number.isFinite(id) || id <= 0) {
      setError('請輸入有效的 member_id（正整數）');
      return;
    }
    setMemberId(id);
  };

  return (
    <>
      <div className="card">
        <div className="card-title">會員登入（模擬）</div>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">Member ID</label>
            <input
              className="form-input"
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              placeholder="輸入 member_id"
            />
          </div>
          <div className="form-field" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleSetMember}>
              使用此 ID
            </button>
          </div>
        </div>
        {error && <div className="error-text">{error}</div>}
        {memberId && (
          <div className="text-muted">目前使用中的 member_id：{memberId}</div>
        )}
      </div>

      <div className="card">
        <div className="card-title">會員基本資料與等級</div>
        {loading && <div className="text-muted">載入中...</div>}
        {!loading && !profile && <div className="text-muted">請先設定有效的 member_id。</div>}
        {profile && (
          <>
            <div className="form-row">
              <div className="form-field">
                <span className="form-label">姓名</span>
                <span>{profile.name}</span>
              </div>
              <div className="form-field">
                <span className="form-label">Email</span>
                <span>{profile.email}</span>
              </div>
              <div className="form-field">
                <span className="form-label">電話</span>
                <span>{profile.phone}</span>
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <span className="form-label">加入日期</span>
                <span>{profile.join_date}</span>
              </div>
              <div className="form-field">
                <span className="form-label">狀態</span>
                <span>{profile.status}</span>
              </div>
              <div className="form-field">
                <span className="form-label">餘額</span>
                <span>{profile.balance}</span>
              </div>
            </div>
            <div className="spacer-md" />
            <div className="card-title">等級權益</div>
            <div className="form-row">
              <div className="form-field">
                <span className="form-label">折扣比例</span>
                <span>{(profile.discount_rate * 100).toFixed(0)}%</span>
              </div>
              <div className="form-field">
                <span className="form-label">可借冊數上限</span>
                <span>{profile.max_book_allowed}</span>
              </div>
              <div className="form-field">
                <span className="form-label">每本可借天數</span>
                <span>{profile.hold_days} 天</span>
              </div>
              <div className="form-field">
                <span className="form-label">目前借閱中本數</span>
                <span>{profile.active_loans}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}


