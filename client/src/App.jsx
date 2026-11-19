import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import FeedbackFormPage from './pages/FeedbackFormPage.jsx';

// Families on a phone only download the small feedback form.
// The dashboard (and the charting library) loads only for the operations team.
const AdminLayout = lazy(() => import('./components/AdminLayout.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const FeedbackListPage = lazy(() => import('./pages/FeedbackListPage.jsx'));
const LinksPage = lazy(() => import('./pages/LinksPage.jsx'));
const SummaryPage = lazy(() => import('./pages/SummaryPage.jsx'));

export default function App() {
  return (
    <Suspense fallback={<div className="center-page subtle">Loading…</div>}>
      <Routes>
        {/* Family-facing: opened from the unique link */}
        <Route path="/f/:token" element={<FeedbackFormPage />} />

        {/* Operations team dashboard */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="feedback" element={<FeedbackListPage />} />
          <Route path="links" element={<LinksPage />} />
          <Route path="summary" element={<SummaryPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Suspense>
  );
}
