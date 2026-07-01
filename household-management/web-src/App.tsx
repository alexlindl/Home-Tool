/**
 * App Component
 * Root layout with authentication gate, navigation, and routing.
 *
 * Requirements: 1.2, 12.4, 16.1, 17.1, 18.1, 19.1, 20.1
 */

import { HashRouter, Routes, Route, NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth, AuthProvider } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { UserSelector } from '@/components/UserSelector';
import { UserBadge } from '@/components/UserBadge';
import { UndoSnackbar } from '@/components/UndoSnackbar';
import { UndoSnackbarProvider } from '@/contexts/UndoSnackbarContext';
import { TaskDashboard } from '@/pages/TaskDashboard';
import { ShoppingList } from '@/pages/ShoppingList';
import { TaskHistory } from '@/pages/TaskHistory';
import { Settings } from '@/pages/Settings';

function AppContent() {
  const { currentUser, isAuthenticated, loading, logout } = useAuth();
  const { isConnected } = useWebSocket({ userName: currentUser?.name });
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="app-loading">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return <UserSelector />;
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header-left">
          <Link to="/" className="app-title-link">
            <h1 className="app-title">Home</h1>
          </Link>
          {isConnected && (
            <span
              className="connection-indicator connection-indicator--online"
              title="Connected"
            />
          )}
        </div>
        <div className="app-header-right">
          <button
            className="btn btn--icon"
            onClick={() => navigate('/settings')}
            aria-label="Settings"
            title="Settings"
          >
            ⚙️
          </button>
          <button className="btn btn--text" onClick={logout}>
            Switch
          </button>
          <UserBadge userName={currentUser.name} size="sm" />
          <span className="app-header-username">{currentUser.name}</span>
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<TaskDashboard />} />
          <Route path="/tasks" element={<TaskDashboard />} />
          <Route path="/shopping" element={<ShoppingList />} />
          <Route path="/history" element={<TaskHistory />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <NavLink to="/" className="bottom-nav-item" end>
          <span className="bottom-nav-icon">📋</span>
          <span className="bottom-nav-label">Tasks</span>
        </NavLink>
        <NavLink to="/shopping" className="bottom-nav-item">
          <span className="bottom-nav-icon">🛒</span>
          <span className="bottom-nav-label">Shopping</span>
        </NavLink>
        <NavLink to="/history" className="bottom-nav-item">
          <span className="bottom-nav-icon">📊</span>
          <span className="bottom-nav-label">History</span>
        </NavLink>
      </nav>

      <UndoSnackbar />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <UndoSnackbarProvider>
        <HashRouter>
          <AppContent />
        </HashRouter>
      </UndoSnackbarProvider>
    </AuthProvider>
  );
}

export default App;
