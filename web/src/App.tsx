/**
 * App Component
 * Root layout with authentication gate, navigation, and routing.
 *
 * Requirements: 1.2, 12.1, 12.3, 12.4, 16.1, 17.1, 18.1, 19.1, 20.1
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth, AuthProvider } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { UserSelector } from '@/components/UserSelector';
import { UserBadge } from '@/components/UserBadge';
import { UndoSnackbar } from '@/components/UndoSnackbar';
import { UndoSnackbarProvider } from '@/contexts/UndoSnackbarContext';
import { TaskDashboard } from '@/pages/TaskDashboard';
import { ShoppingList } from '@/pages/ShoppingList';
import { Recipes } from '@/pages/Recipes';
import { TaskHistory } from '@/pages/TaskHistory';
import { Settings } from '@/pages/Settings';

function AppContent() {
  const { currentUser, isAuthenticated, loading, logout } = useAuth();
  const { isConnected } = useWebSocket({ userName: currentUser?.name });
  const navigate = useNavigate();

  // Detect if running inside HA (either via ingress path or embedded in an iframe)
  const isInIngress = window.location.pathname.includes('/api/hassio_ingress/') || window.self !== window.top;

  const handleExitToHA = () => {
    try {
      // Try navigating top frame directly (works when same-origin, e.g. ingress)
      if (window.top && window.top !== window.self) {
        window.top.location.href = '/';
        return;
      }
    } catch {
      // Cross-origin: top frame is on a different port/origin
    }
    // Fallback: open HA dashboard in the same tab, replacing the iframe page
    // This works even cross-origin because we're navigating our own window
    // which will break out of the iframe since HA doesn't frame itself
    try {
      const haOrigin = window.location.ancestorOrigins?.[0] || window.location.origin.replace(/:\d+$/, ':8123');
      window.top!.location.href = haOrigin + '/';
    } catch {
      // Last resort: just go to port 8123 on same host
      const host = window.location.hostname;
      window.location.href = `http://${host}:8123/`;
    }
  };

  // Apply saved colour scheme on mount
  useEffect(() => {
    const savedScheme = localStorage.getItem('colorScheme');
    if (savedScheme) {
      document.documentElement.setAttribute('data-scheme', savedScheme);
    }
  }, []);

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
          {isInIngress && (
            <button
              className="btn btn--text btn--ha-exit"
              onClick={handleExitToHA}
              aria-label="Exit to Home Assistant"
              title="Exit to Home Assistant"
            >
              HA
            </button>
          )}
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
          <Route path="/recipes" element={<Recipes />} />
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
        <NavLink to="/recipes" className="bottom-nav-item">
          <span className="bottom-nav-icon">🍳</span>
          <span className="bottom-nav-label">Recipes</span>
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
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </UndoSnackbarProvider>
    </AuthProvider>
  );
}

export default App;
