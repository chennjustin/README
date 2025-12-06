import { useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { MemberProvider, useMember } from './context/MemberContext';
import { AdminProvider, useAdmin } from './context/AdminContext';
import { MemberDashboard } from './pages/member/MemberDashboard';
import { MemberLoginPage } from './pages/member/MemberLoginPage';
import { BookSearchPage } from './pages/member/BookSearchPage';
import { BookDetailPage } from './pages/member/BookDetailPage';
import { MemberReservationsPage } from './pages/member/MemberReservationsPage';
import { MemberLoansActivePage } from './pages/member/MemberLoansActivePage';
import { MemberLoansHistoryPage } from './pages/member/MemberLoansHistoryPage';
import { MemberStatsPage } from './pages/member/MemberStatsPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminMembersPage } from './pages/admin/AdminMembersPage';
import { AdminMemberDetailPage } from './pages/admin/AdminMemberDetailPage';
import { AdminBorrowPage } from './pages/admin/AdminBorrowPage';
import { AdminReturnPage } from './pages/admin/AdminReturnPage';
import { AdminReservationsPage } from './pages/admin/AdminReservationsPage';
import { AdminStatsPage } from './pages/admin/AdminStatsPage';

// Protected route component for member pages
// Defined at module level to ensure stable component definition
function ProtectedMemberRoute({ children }: { children: React.ReactElement }) {
  const { memberId } = useMember();
  // Strict validation: memberId must be a valid positive integer
  if (!memberId || !Number.isFinite(memberId) || memberId <= 0) {
    return <Navigate to="/member/login" replace />;
  }
  return children;
}

// Protected route component for admin pages
// Defined at module level to ensure stable component definition
function ProtectedAdminRoute({ children }: { children: React.ReactElement }) {
  const { admin } = useAdmin();
  // Check if admin is logged in (admin exists)
  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isAdmin = location.pathname.startsWith('/admin');
  const { memberId, setMemberId } = useMember();
  const { admin, setAuth } = useAdmin();
  // Check if member is logged in (memberId exists and is valid)
  const isLoggedIn = memberId !== null && Number.isFinite(memberId) && memberId > 0;
  // Check if admin is logged in (admin exists)
  const isAdminLoggedIn = admin !== null;

  // Handle member logout
  const handleMemberLogout = () => {
    setMemberId(null);
    navigate('/member/login', { replace: true });
  };

  // Handle admin logout
  const handleAdminLogout = () => {
    setAuth(null);
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-header-left">
          <button 
            className="app-sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label="切換側邊欄"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <div className="app-header-title">ReadMe!</div>
        </div>
      </header>
      <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <aside className="app-sidebar">
          <div className="app-sidebar-content">
          {!isAdmin ? (
            <>
              {isLoggedIn ? (
                // Show all pages when logged in
                <>
                  <NavLink
                    to="/member"
                    end
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                    title="個人總覽"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7"></rect>
                      <rect x="14" y="3" width="7" height="7"></rect>
                      <rect x="14" y="14" width="7" height="7"></rect>
                      <rect x="3" y="14" width="7" height="7"></rect>
                    </svg>
                    {!sidebarCollapsed && <span>個人總覽</span>}
                  </NavLink>
                  <NavLink
                    to="/member/books"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                    title="書籍搜尋"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                    {!sidebarCollapsed && <span>書籍搜尋</span>}
                  </NavLink>
                  <NavLink
                    to="/member/reservations"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                    title="我的預約"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    {!sidebarCollapsed && <span>我的預約</span>}
                  </NavLink>
                  <NavLink
                    to="/member/loans/active"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                    title="借閱中"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                    </svg>
                    {!sidebarCollapsed && <span>借閱中</span>}
                  </NavLink>
                  <NavLink
                    to="/member/loans/history"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                    title="歷史借閱"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                    {!sidebarCollapsed && <span>歷史借閱</span>}
                  </NavLink>
                  <NavLink
                    to="/member/stats"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                    title="熱門排行榜"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="20" x2="18" y2="10"></line>
                      <line x1="12" y1="20" x2="12" y2="4"></line>
                      <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                    {!sidebarCollapsed && <span>熱門排行榜</span>}
                  </NavLink>
                  <div className="app-sidebar-divider" />
                  <button
                    className="app-sidebar-logout-btn"
                    onClick={handleMemberLogout}
                    title="登出"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    {!sidebarCollapsed && <span>登出</span>}
                  </button>
                </>
              ) : (
                // Show only public pages when not logged in
                <>
                  <NavLink
                    to="/member/login"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                    title="會員登入"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                      <polyline points="10 17 15 12 10 7"></polyline>
                      <line x1="15" y1="12" x2="3" y2="12"></line>
                    </svg>
                    {!sidebarCollapsed && <span>會員登入</span>}
                  </NavLink>
                  <NavLink
                    to="/member/books"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                    title="書籍搜尋"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                    {!sidebarCollapsed && <span>書籍搜尋</span>}
                  </NavLink>
                  <NavLink
                    to="/member/stats"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                    title="熱門排行榜"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="20" x2="18" y2="10"></line>
                      <line x1="12" y1="20" x2="12" y2="4"></line>
                      <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                    {!sidebarCollapsed && <span>熱門排行榜</span>}
                  </NavLink>
                </>
              )}
            </>
          ) : (
            <>
              {isAdminLoggedIn ? (
                // Show all pages when logged in
                <>
                  <NavLink
                    to="/admin"
                    end
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                    title="登入 / 概覽"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7"></rect>
                      <rect x="14" y="3" width="7" height="7"></rect>
                      <rect x="14" y="14" width="7" height="7"></rect>
                      <rect x="3" y="14" width="7" height="7"></rect>
                    </svg>
                    {!sidebarCollapsed && <span>登入 / 概覽</span>}
                  </NavLink>
                  <NavLink
                    to="/admin/members"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                    title="會員管理"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    {!sidebarCollapsed && <span>會員管理</span>}
                  </NavLink>
                  <NavLink
                    to="/admin/loans/borrow"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                    title="櫃檯借書"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                    </svg>
                    {!sidebarCollapsed && <span>櫃檯借書</span>}
                  </NavLink>
                  <NavLink
                    to="/admin/loans/return"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                    title="櫃檯還書"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                    </svg>
                    {!sidebarCollapsed && <span>櫃檯還書</span>}
                  </NavLink>
                  <NavLink
                    to="/admin/reservations"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                    title="預約管理"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    {!sidebarCollapsed && <span>預約管理</span>}
                  </NavLink>
                  <NavLink
                    to="/admin/stats"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                    title="報表 / 統計"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="20" x2="18" y2="10"></line>
                      <line x1="12" y1="20" x2="12" y2="4"></line>
                      <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                    {!sidebarCollapsed && <span>報表 / 統計</span>}
                  </NavLink>
                  <div className="app-sidebar-divider" />
                  <button
                    className="app-sidebar-logout-btn"
                    onClick={handleAdminLogout}
                    title="登出"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    {!sidebarCollapsed && <span>登出</span>}
                  </button>
                </>
              ) : (
                // Show only login page when not logged in
                <>
                  <NavLink
                    to="/admin/login"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                    title="管理端登入"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                      <polyline points="10 17 15 12 10 7"></polyline>
                      <line x1="15" y1="12" x2="3" y2="12"></line>
                    </svg>
                    {!sidebarCollapsed && <span>管理端登入</span>}
                  </NavLink>
                </>
              )}
            </>
          )}
          </div>
          {!sidebarCollapsed && (
            <div className="app-sidebar-footer">
              <div className="app-sidebar-profile">
                <div className="app-sidebar-avatar">U</div>
                <div className="app-sidebar-user-info">
                  <div className="app-sidebar-user-name">{isAdmin ? (admin?.name || '管理員') : (isLoggedIn ? '會員' : '訪客')}</div>
                  <div className="app-sidebar-user-role">{isAdmin ? '管理員' : '會員'}</div>
                </div>
              </div>
            </div>
          )}
        </aside>
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/member/login" replace />} />
            <Route path="/member/login" element={<MemberLoginPage />} />
            <Route
              path="/member"
              element={
                <ProtectedMemberRoute>
                  <MemberDashboard />
                </ProtectedMemberRoute>
              }
            />
            <Route path="/member/books" element={<BookSearchPage />} />
            <Route path="/member/books/:bookId" element={<BookDetailPage />} />
            <Route
              path="/member/reservations"
              element={
                <ProtectedMemberRoute>
                  <MemberReservationsPage />
                </ProtectedMemberRoute>
              }
            />
            <Route
              path="/member/loans/active"
              element={
                <ProtectedMemberRoute>
                  <MemberLoansActivePage />
                </ProtectedMemberRoute>
              }
            />
            <Route
              path="/member/loans/history"
              element={
                <ProtectedMemberRoute>
                  <MemberLoansHistoryPage />
                </ProtectedMemberRoute>
              }
            />
            <Route path="/member/stats" element={<MemberStatsPage />} />

            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route
              path="/admin"
              element={
                <ProtectedAdminRoute>
                  <AdminDashboard />
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="/admin/members"
              element={
                <ProtectedAdminRoute>
                  <AdminMembersPage />
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="/admin/members/:memberId"
              element={
                <ProtectedAdminRoute>
                  <AdminMemberDetailPage />
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="/admin/loans/borrow"
              element={
                <ProtectedAdminRoute>
                  <AdminBorrowPage />
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="/admin/loans/return"
              element={
                <ProtectedAdminRoute>
                  <AdminReturnPage />
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="/admin/reservations"
              element={
                <ProtectedAdminRoute>
                  <AdminReservationsPage />
                </ProtectedAdminRoute>
              }
            />
            <Route
              path="/admin/stats"
              element={
                <ProtectedAdminRoute>
                  <AdminStatsPage />
                </ProtectedAdminRoute>
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AdminProvider>
      <MemberProvider>
        <AppShell />
      </MemberProvider>
    </AdminProvider>
  );
}


