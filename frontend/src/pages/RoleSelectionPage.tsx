import { useNavigate } from 'react-router-dom';

export function RoleSelectionPage() {
  const navigate = useNavigate();

  const handleMemberClick = () => {
    navigate('/member/login');
  };

  const handleAdminClick = () => {
    navigate('/admin/login');
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 'calc(100vh - 73px)',
      padding: '2rem'
    }}>
      <div className="card" style={{ 
        maxWidth: '600px', 
        width: '100%',
        textAlign: 'center'
      }}>
        <div className="card-title" style={{ 
          marginBottom: '1rem',
          fontSize: '1.75rem'
        }}>
          歡迎使用 ReadMe! 租借書店系統
        </div>
        <div style={{ 
          color: '#6b7280',
          marginBottom: '2.5rem',
          fontSize: '1rem'
        }}>
          請選擇您的身份以繼續
        </div>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1rem'
        }}>
          <button
            className="btn"
            onClick={handleMemberClick}
            style={{
              padding: '1.25rem 1.5rem',
              fontSize: '1.125rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              cursor: 'pointer',
              width: '100%',
              transition: 'all 0.2s',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#059669';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#10b981';
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            我是顧客
          </button>
          <button
            className="btn"
            onClick={handleAdminClick}
            style={{
              padding: '1.25rem 1.5rem',
              fontSize: '1.125rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              cursor: 'pointer',
              backgroundColor: '#f3f4f6',
              color: '#111827',
              border: '1px solid #d1d5db',
              width: '100%',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e5e7eb';
              e.currentTarget.style.borderColor = '#9ca3af';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            我是管理員
          </button>
        </div>
      </div>
    </div>
  );
}

