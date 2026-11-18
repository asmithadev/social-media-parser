import { useState } from 'react';
import Login from './components/Login';
import CaseList from './components/CaseList';
import CaseDetails from './components/CaseDetails';
import { isDemoMode, signIn } from './api';

export default function App() {
  // Keep the signed-in user and selected case in React state.
  const [session, setSession] = useState(null);
  const [selectedCaseId, setSelectedCaseId] = useState(null);

  async function handleLogin(email, password) {
    const result = await signIn(email, password);
    setSession(result);
  }

  function handleLogout() {
    setSession(null);
    setSelectedCaseId(null);
  }

  return (
    <>
      <header className="site-header">
        <div className="header-content">
          <div className="brand">Evidence Capture</div>
          {session && (
            <div className="account-menu">
              <span>{session.user.fullName} <span className="role">({session.user.role})</span></span>
              <button className="secondary" onClick={handleLogout}>Sign out</button>
            </div>
          )}
        </div>
      </header>

      <main className="container">
        {isDemoMode && <p className="demo-notice">Demo mode · All accounts and case records shown here are fictional.</p>}
        {!session ? (
          <Login onLogin={handleLogin} />
        ) : selectedCaseId === null ? (
          <CaseList token={session.token} onSelectCase={setSelectedCaseId} />
        ) : (
          <CaseDetails key={selectedCaseId} token={session.token} caseId={selectedCaseId}
            onBack={() => setSelectedCaseId(null)} />
        )}
      </main>
    </>
  );
}
