import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const NAV_ITEMS = [
  { path: '/', label: 'Espace de travail', icon: '📝' },
  { path: '/profile', label: 'Profil', icon: '👤' },
  { path: '/billing', label: 'Abonnement', icon: '💳' },
  { path: '/feedback', label: 'Feedback', icon: '💬' },
  { path: '/settings', label: 'Paramètres', icon: '⚙️' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const toggleTheme = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="app-layout">
      {/* Mobile menu overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="logo-icon">🩻</span>
            <span className="logo-text">Rad Report AI</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon">🛡️</span>
              <span className="nav-label">Admin</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          <button className="btn btn-ghost sidebar-btn" onClick={toggleTheme} title="Changer de thème">
            {theme === 'dark' ? '☀️' : '🌙'} {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          </button>
          <button className="btn btn-ghost sidebar-btn" onClick={handleLogout}>
            🚪 Déconnexion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-area">
        {/* Header */}
        <header className="app-header">
          <button
            className="btn btn-ghost mobile-menu-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>
          <div className="header-spacer" />
          <div className="header-user">
            <span className="header-user-name">
              {user?.display_name || user?.email?.split('@')[0] || 'Utilisateur'}
            </span>
            {user?.subscription_plan && (
              <span className="badge badge-new">{user.subscription_plan}</span>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="page-content">
          {children}
        </main>
      </div>

      <style>{layoutStyles}</style>
    </div>
  );
}

const layoutStyles = `
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* ─── Sidebar ─────────────────────────────── */
.sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  background: var(--color-bg-alt);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  transition: transform var(--transition-normal);
  z-index: 100;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid var(--color-border);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  font-size: 24px;
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--color-accent), #6C63FF);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.sidebar-nav {
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 500;
  transition: all var(--transition-fast);
  text-decoration: none;
}

.nav-item:hover {
  background: var(--color-surface);
  color: var(--color-text);
}

.nav-item-active {
  background: var(--color-highlight-bg);
  color: var(--color-accent);
}

.nav-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-btn {
  justify-content: flex-start;
  font-size: 13px;
  width: 100%;
}

.sidebar-overlay {
  display: none;
}

/* ─── Main area ───────────────────────────── */
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.app-header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  padding: 0 24px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-alt);
  gap: 12px;
}

.mobile-menu-btn {
  display: none;
  font-size: 20px;
}

.header-spacer {
  flex: 1;
}

.header-user {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-user-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.page-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

/* ─── Responsive ──────────────────────────── */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 280px;
    transform: translateX(-100%);
    box-shadow: var(--shadow-lg);
  }

  .sidebar-open {
    transform: translateX(0);
  }

  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 99;
  }

  .mobile-menu-btn {
    display: flex;
  }

  .page-content {
    padding: 16px;
  }
}
`;
