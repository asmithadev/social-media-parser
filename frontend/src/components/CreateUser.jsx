import { useState } from 'react';
import { createUser } from '../api';

export default function CreateUser({ token, onCreated }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('examiner');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (new TextEncoder().encode(password).length > 72) {
      setError('The password must be at most 72 UTF-8 bytes.');
      return;
    }
    setSaving(true);
    try {
      const user = await createUser(token, { fullName: fullName.trim(), email: email.trim(), password, role });
      onCreated(user);
      setMessage(`${user.fullName} created as ${user.role}. You can now assign this user below.`);
      setFullName('');
      setEmail('');
      setPassword('');
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card" aria-labelledby="create-user-title">
      <h2 id="create-user-title">Create a user</h2>
      <form className="admin-form" onSubmit={handleSubmit}>
        <fieldset disabled={saving}>
          <label htmlFor="new-user-name">Full name</label>
          <input id="new-user-name" required maxLength={150} autoComplete="off" value={fullName}
            onChange={event => setFullName(event.target.value)} />
          <label htmlFor="new-user-email">Email</label>
          <input id="new-user-email" type="email" required maxLength={255} autoComplete="off" value={email}
            onChange={event => setEmail(event.target.value)} />
          <label htmlFor="new-user-password">Password</label>
          <input id="new-user-password" type="password" required maxLength={72} autoComplete="new-password" value={password}
            onChange={event => setPassword(event.target.value)} />
          <label htmlFor="new-user-role">Role</label>
          <select id="new-user-role" value={role} onChange={event => setRole(event.target.value)}>
            <option value="examiner">Examiner</option>
            <option value="reviewer">Reviewer</option>
          </select>
          <button type="submit">{saving ? 'Creating…' : 'Create user'}</button>
        </fieldset>
        {error && <p className="error" role="alert">{error}</p>}
        {message && <p className="success" role="status">{message}</p>}
      </form>
    </section>
  );
}
