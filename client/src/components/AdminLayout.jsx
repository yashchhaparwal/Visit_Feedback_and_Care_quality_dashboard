import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ChartIcon, HeartIcon, LinkIcon, ListIcon, MailIcon } from './icons.jsx';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: ChartIcon, end: true },
  { to: '/admin/feedback', label: 'All feedback', icon: ListIcon },
  { to: '/admin/links', label: 'Visits & links', icon: LinkIcon },
  { to: '/admin/summary', label: 'Weekly email', icon: MailIcon },
];

export default function AdminLayout() {
  return (
    <div className="admin">
      <nav className="sidebar" aria-label="Main">
        <div className="brand">
          <span className="brand-mark"><HeartIcon size={16} /></span>
          <span className="brand-text">
            TheCarePal
            <small>Care quality</small>
          </span>
        </div>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="main">
        {/* Keeps the nav on screen while a lazily-loaded page arrives */}
        <Suspense fallback={<div className="card skeleton" style={{ height: 400 }} aria-busy="true" />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
