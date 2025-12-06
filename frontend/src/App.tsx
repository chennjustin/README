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
        <div className="app-header-title">獨立租借書店系統</div>
        <nav className="app-header-nav">
          <NavLink
            to="/member"
            className={({ isActive }) =>
              'app-header-link' + (isActive && !isAdmin ? ' app-header-link-active' : '')
            }
          >
            會員端
          </NavLink>
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              'app-header-link' + (isActive ? ' app-header-link-active' : '')
            }
          >
            管理端
          </NavLink>
        </nav>
      </header>
      <div className="app-layout">
        <aside className="app-sidebar">
          {!isAdmin ? (
            <>
              <div className="app-sidebar-section-title">Member</div>
              {isLoggedIn ? (
                // Show all pages when logged in
                <>
                  <NavLink
                    to="/member"
                    end
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                  >
                    個人總覽
                  </NavLink>
                  <NavLink
                    to="/member/books"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                  >
                    書籍搜尋
                  </NavLink>
                  <NavLink
                    to="/member/reservations"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                  >
                    我的預約
                  </NavLink>
                  <NavLink
                    to="/member/loans/active"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                  >
                    借閱中
                  </NavLink>
                  <NavLink
                    to="/member/loans/history"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                  >
                    歷史借閱
                  </NavLink>
                  <NavLink
                    to="/member/stats"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                  >
                    熱門排行榜
                  </NavLink>
                  <div className="app-sidebar-divider" />
                  <button
                    className="app-sidebar-logout-btn"
                    onClick={handleMemberLogout}
                  >
                    登出
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
                  >
                    會員登入
                  </NavLink>
                  <NavLink
                    to="/member/books"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                  >
                    書籍搜尋
                  </NavLink>
                  <NavLink
                    to="/member/stats"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                  >
                    熱門排行榜
                  </NavLink>
                </>
              )}
            </>
          ) : (
            <>
              <div className="app-sidebar-section-title">Admin</div>
              {isAdminLoggedIn ? (
                // Show all pages when logged in
                <>
                  <NavLink
                    to="/admin"
                    end
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                  >
                    登入 / 概覽
                  </NavLink>
                  <NavLink
                    to="/admin/members"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                  >
                    會員管理
                  </NavLink>
                  <NavLink
                    to="/admin/loans/borrow"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                  >
                    櫃檯借書
                  </NavLink>
                  <NavLink
                    to="/admin/loans/return"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                  >
                    櫃檯還書
                  </NavLink>
                  <NavLink
                    to="/admin/reservations"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                  >
                    預約管理
                  </NavLink>
                  <NavLink
                    to="/admin/stats"
                    className={({ isActive }) =>
                      'app-sidebar-link' + (isActive ? ' app-sidebar-link-active' : '')
                    }
                  >
                    報表 / 統計
                  </NavLink>
                  <div className="app-sidebar-divider" />
                  <button
                    className="app-sidebar-logout-btn"
                    onClick={handleAdminLogout}
                  >
                    登出
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
                  >
                    管理端登入
                  </NavLink>
                </>
              )}
            </>
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


