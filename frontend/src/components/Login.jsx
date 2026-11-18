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
    <section className="card login-card" aria-labelledby="login-title">
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
  );
}
