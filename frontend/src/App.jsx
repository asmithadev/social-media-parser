import { useState } from 'react';
import Login from './components/Login';
import CaseList from './components/CaseList';
import CaseDetails from './components/CaseDetails';
import AdminPanel from './components/AdminPanel';
import AuditLogs from './components/AuditLogs';
import { isDemoMode, signIn } from './api';

export default function App() {
  // Keep the signed-in user and selected case in React state.
  const [session, setSession] = useState(null);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [page, setPage] = useState('cases');
  const [theme, setTheme] = useState('light');

  async function handleLogin(email, password) {
    const result = await signIn(email, password);
    setSession(result);
  }

  function handleLogout() {
    setSession(null);
    setSelectedCaseId(null);
    setPage('cases');
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <div className="header-content">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">EC</span>
            <div>Evidence Capture<small>Social media evidence workspace</small></div>
          </div>
          <div className="header-actions">
          <button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} appearance`}>
            <span aria-hidden="true">{theme === 'light' ? '◐' : '◑'}</span> {theme === 'light' ? 'Dark' : 'Light'}
          </button>
          {session && (
            <div className="account-menu">
              <span>{session.user.fullName} <span className="role">({session.user.role})</span></span>
              <button className="secondary" onClick={handleLogout}>Sign out</button>
            </div>
          )}
          </div>
        </div>
      </header>

      <main className="container" id="main-content" tabIndex={-1}>
        {isDemoMode && <p className="demo-notice">Demo mode · All accounts and case records shown here are fictional.</p>}
        {session && session.user.role === 'admin' && (
          <nav className="page-menu" aria-label="Main navigation">
            <button className={page === 'cases' ? '' : 'secondary'} aria-current={page === 'cases' ? 'page' : undefined}
              onClick={() => { setPage('cases'); setSelectedCaseId(null); }}>Cases</button>
            <button className={page === 'admin' ? '' : 'secondary'} aria-current={page === 'admin' ? 'page' : undefined}
              onClick={() => setPage('admin')}>Admin tools</button>
            <button className={page === 'audit' ? '' : 'secondary'} aria-current={page === 'audit' ? 'page' : undefined}
              onClick={() => setPage('audit')}>Audit logs</button>
          </nav>
        )}
        {!session ? (
          <Login onLogin={handleLogin} />
        ) : page === 'admin' && session.user.role === 'admin' ? (
          <AdminPanel token={session.token} />
        ) : page === 'audit' && session.user.role === 'admin' ? (
          <AuditLogs token={session.token} />
        ) : selectedCaseId === null ? (
          <CaseList token={session.token} onSelectCase={setSelectedCaseId} />
        ) : (
          <CaseDetails key={selectedCaseId} token={session.token} caseId={selectedCaseId}
            user={session.user}
            canEdit={session.user.role === 'admin' && !isDemoMode}
            onBack={() => setSelectedCaseId(null)} />
        )}
      </main>
      <footer className="site-footer"><span>Evidence Capture</span><span>Capture · Verify · Review</span></footer>
    </div>
  );
}
