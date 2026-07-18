import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Footer } from './Footer';

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
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
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

  const openSidebar = () => {
    setSidebarVisible(true);
    setSidebarOpen(true);
  };

  return (
    <div className="app-layout">
      {/* Mobile menu overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''} ${sidebarVisible ? '' : 'sidebar-collapsed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/favicon.png" alt="Logo" className="logo-icon" />
            <span className="logo-text">Rad Report AI</span>
          </div>
          <button
            className="btn btn-ghost sidebar-collapse-btn"
            onClick={() => setSidebarVisible((visible) => !visible)}
            aria-label={sidebarVisible ? 'Réduire la barre latérale' : 'Développer la barre latérale'}
            title={sidebarVisible ? 'Réduire la barre latérale' : 'Développer la barre latérale'}
          >
            {sidebarVisible ? '‹' : '›'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
              onClick={() => setSidebarOpen(false)}
              title={item.label}
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
              title="Admin"
            >
              <span className="nav-icon">🛡️</span>
              <span className="nav-label">Admin</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          <button className="btn btn-ghost sidebar-btn" onClick={toggleTheme} title="Changer de thème">
            <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span className="sidebar-btn-label">{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>
          </button>
          <button className="btn btn-ghost sidebar-btn" onClick={handleLogout} title="Déconnexion">
            <span aria-hidden="true">🚪</span>
            <span className="sidebar-btn-label">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-area">
        {/* Mobile Header */}
        <header className="mobile-header">
          <button
            className="btn btn-ghost mobile-menu-btn"
            onClick={openSidebar}
            aria-label="Ouvrir le menu"
          >
            ☰
          </button>
          <div className="mobile-logo">
            <img src="/favicon.png" alt="Logo" className="logo-icon" style={{ width: 24, height: 24 }} />
            <span>Rad Report AI</span>
          </div>
        </header>

        {/* Scrollable area */}
        <div className="page-scroll">
          <main className="page-content">
            {children}
          </main>

          {location.pathname !== '/' && <Footer />}
        </div>
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
.mobile-header {
  display: none;
}

.sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  background: var(--color-bg-alt);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  transition: width var(--transition-normal), min-width var(--transition-normal), transform var(--transition-normal), border-color var(--transition-normal);
  z-index: 100;
  box-shadow: 12px 0 30px rgba(0, 0, 0, 0.08);
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sidebar-collapse-btn {
  display: inline-flex;
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 50%;
  font-size: 24px;
  line-height: 1;
}

.sidebar-collapsed {
  width: 68px;
  min-width: 68px;
}

.sidebar-collapsed .sidebar-header {
  padding: 14px 10px;
  flex-direction: column;
  gap: 12px;
}

.sidebar-collapsed .sidebar-logo {
  gap: 0;
}

.sidebar-collapsed .logo-text,
.sidebar-collapsed .nav-label,
.sidebar-collapsed .sidebar-btn-label {
  display: none;
}

.sidebar-collapsed .sidebar-nav {
  align-items: center;
  padding: 12px 10px;
}

.sidebar-collapsed .nav-item {
  justify-content: center;
  width: 44px;
  padding: 11px 0;
  gap: 0;
}

.sidebar-collapsed .sidebar-footer {
  align-items: center;
  padding: 10px;
}

.sidebar-collapsed .sidebar-btn {
  justify-content: center;
  width: 44px;
  padding: 10px 0;
}

.logo-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
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
  box-shadow: inset 3px 0 0 var(--color-accent);
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
  position: relative;
}

.mobile-menu-btn {
  display: none;
  font-size: 20px;
}

.page-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.page-content {
  padding: 24px;
  flex: 1;
}

/* ─── Footer ──────────────────────────────── */
.app-footer {
  text-align: center;
  padding: 40px;
  color: var(--color-text-tertiary);
  font-size: 13px;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.landing-social-links {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.landing-social-links span {
  color: var(--color-text-secondary);
  font-weight: 600;
}

.social-icon-list {
  display: flex;
  gap: 8px;
}

.social-icon-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  color: var(--color-text-secondary);
  transition: color var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast), transform var(--transition-fast);
}

.social-icon-link:hover {
  color: white;
  border-color: var(--color-accent);
  background: var(--color-accent);
  transform: translateY(-2px);
}

.social-icon {
  width: 17px;
  height: 17px;
  fill: currentColor;
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

  .sidebar.sidebar-collapsed {
    width: 280px;
    min-width: 280px;
  }

  .sidebar-collapsed .sidebar-header {
    padding: 20px;
    flex-direction: row;
    gap: 0;
  }

  .sidebar-collapsed .sidebar-logo {
    gap: 10px;
  }

  .sidebar-collapsed .logo-text,
  .sidebar-collapsed .nav-label,
  .sidebar-collapsed .sidebar-btn-label {
    display: inline;
  }

  .sidebar-collapsed .sidebar-nav,
  .sidebar-collapsed .sidebar-footer {
    align-items: stretch;
    padding: 12px;
  }

  .sidebar-collapsed .nav-item,
  .sidebar-collapsed .sidebar-btn {
    justify-content: flex-start;
    width: 100%;
    padding: 10px 14px;
    gap: 12px;
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

  .mobile-header {
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--header-height);
    background: var(--color-bg-alt);
    border-bottom: 1px solid var(--color-border);
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
  }

  .mobile-logo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 16px;
  }

  .mobile-menu-btn {
    display: flex;
    position: absolute;
    left: 4px;
    top: 50%;
    transform: translateY(-50%);
    padding: 8px 12px;
    z-index: 60;
  }

  .sidebar-collapse-btn {
    display: none;
  }

  .page-content {
    padding: 16px;
  }
}
`;
