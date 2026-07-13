import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { Layout } from './components/Layout';
import { ToastContainer } from './components/Toast';
import { LandingPage } from './pages/LandingPage';
import { WorkspacePage } from './pages/WorkspacePage';

// Lazy load secondary pages
import { lazy, Suspense } from 'react';
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const BillingPage = lazy(() => import('./pages/BillingPage').then(m => ({ default: m.BillingPage })));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage').then(m => ({ default: m.FeedbackPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));

function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div className="spinner" />
    </div>
  );
}

function AuthenticatedApp() {
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<WorkspacePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default function App() {
  const { isLoading, isAuthenticated, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--color-bg)',
      }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  return (
    <BrowserRouter>
      {isAuthenticated ? <AuthenticatedApp /> : <Routes><Route path="*" element={<LandingPage />} /></Routes>}
      <ToastContainer />
    </BrowserRouter>
  );
}
