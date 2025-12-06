import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MemberProvider, useMember } from './context/MemberContext';
import { AdminProvider } from './context/AdminContext';
import { MemberDashboard } from './pages/member/MemberDashboard';
import { MemberLoginPage } from './pages/member/MemberLoginPage';
import { BookSearchPage } from './pages/member/BookSearchPage';
import { BookDetailPage } from './pages/member/BookDetailPage';
import { MemberReservationsPage } from './pages/member/MemberReservationsPage';
import { MemberLoansActivePage } from './pages/member/MemberLoansActivePage';
import { MemberLoansHistoryPage } from './pages/member/MemberLoansHistoryPage';
import { MemberStatsPage } from './pages/member/MemberStatsPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
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

function AppShell() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

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
            </>
          ) : (
            <>
              <div className="app-sidebar-section-title">Admin</div>
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

            <Route path="/admin" element={<AdminLoginPage />} />
            <Route path="/admin/members" element={<AdminMembersPage />} />
            <Route path="/admin/loans/borrow" element={<AdminBorrowPage />} />
            <Route path="/admin/loans/return" element={<AdminReturnPage />} />
            <Route path="/admin/reservations" element={<AdminReservationsPage />} />
            <Route path="/admin/stats" element={<AdminStatsPage />} />
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


