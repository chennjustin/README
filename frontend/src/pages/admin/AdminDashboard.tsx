import { useAdmin } from '../../context/AdminContext';

export function AdminDashboard() {
  const { admin } = useAdmin();

  return (
    <>
      <div className="card">
        <div className="card-title">管理員基本資料</div>
        {!admin && <div className="text-muted">請先登入管理員帳號。</div>}
        {admin && (
          <>
            <div className="form-row">
              <div className="form-field">
                <span className="form-label">管理員 ID</span>
                <span>{admin.admin_id}</span>
              </div>
              <div className="form-field">
                <span className="form-label">姓名</span>
                <span>{admin.name}</span>
              </div>
              <div className="form-field">
                <span className="form-label">電話</span>
                <span>{admin.phone}</span>
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <span className="form-label">角色</span>
                <span>{admin.role}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

