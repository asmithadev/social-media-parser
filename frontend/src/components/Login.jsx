import { useState } from 'react';
import { isDemoMode } from '../api';
import { demoCredentials } from '../data/demo';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(email.trim(), password);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-layout">
      <aside className="login-intro" aria-labelledby="intro-title">
        <p className="eyebrow"><span className="status-dot" /> A considered approach to evidence</p>
        <h1 id="intro-title">Every capture.<br />A clearer <em>record.</em></h1>
        <p className="intro-copy">Bring your case, captures and review into one workspace. Keep the source in sight, from the first screenshot to the final report.</p>
        <div className="workflow-panel">
          <div className="workflow-caption"><span>THE EVIDENCE WORKFLOW</span><span aria-hidden="true">↗</span></div>
          {[
            ['01', 'Capture with context', 'Connect screenshots to the case and section.'],
            ['02', 'Check the source', 'Verify file hashes and review extracted text.'],
            ['03', 'Review the record', 'Prepare a report for independent approval.'],
          ].map(([number, title, description]) => <div className="workflow-step" key={number}>
            <span className="step-number">{number}</span><div><strong>{title}</strong><p>{description}</p></div>
          </div>)}
          <p className="workflow-note">One case. A documented path forward.</p>
        </div>
      </aside>
      <section className="card login-card" aria-labelledby="login-title">
      <p className="eyebrow">Welcome to your workspace</p>
      <h1 id="login-title">Sign in</h1>
      <p className="muted">Access your cases and review their details.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" required
          value={email} onChange={event => setEmail(event.target.value)} disabled={loading} />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" required
          value={password} onChange={event => setPassword(event.target.value)} disabled={loading} />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="full-width" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>
      {isDemoMode && (
        <div className="demo-login">
          <strong>Try the demo</strong>
          <p>Email: <code>{demoCredentials.email}</code></p>
          <p>Password: <code>{demoCredentials.password}</code></p>
          <button className="secondary" type="button" onClick={() => {
            setEmail(demoCredentials.email);
            setPassword(demoCredentials.password);
            setError('');
          }} disabled={loading}>Fill demo details</button>
        </div>
      )}
      </section>
    </div>
  );
}
