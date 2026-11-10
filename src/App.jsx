import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast.jsx';
import Layout from './components/Layout.jsx';
import HomePage from './pages/HomePage.jsx';
import CatalogPage from './pages/CatalogPage.jsx';

// Admin pulls in the scanner + auth UI; students never need it.
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));

const TITLES = {
  '/': 'Free Textbook Library · College of Charleston',
  '/catalog': 'Catalog · Free Textbook Library',
  '/admin': 'Admin · Free Textbook Library'
};

function ScrollAndTitle() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    document.title = TITLES[pathname] || TITLES['/'];
    let robots = document.querySelector('meta[name="robots"]');
    if (pathname === '/admin') {
      if (!robots) {
        robots = document.createElement('meta');
        robots.name = 'robots';
        document.head.appendChild(robots);
      }
      robots.content = 'noindex, nofollow';
    } else {
      robots?.remove();
    }
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <ScrollAndTitle />
      <Layout>
        <Suspense fallback={<div className="empty-state">Loading…</div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/index.html" element={<Navigate to="/" replace />} />
            <Route path="/catalog.html" element={<Navigate to="/catalog" replace />} />
            <Route path="/admin.html" element={<Navigate to="/admin" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    </ToastProvider>
  );
}
