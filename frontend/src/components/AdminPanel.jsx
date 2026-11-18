import { useEffect, useState } from 'react';
import { getCases, getUsers } from '../api';
import CreateCase from './CreateCase';
import CreateUser from './CreateUser';
import AssignUser from './AssignUser';

export default function AdminPanel({ token }) {
  const [cases, setCases] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([getCases(token), getUsers(token)])
      .then(([cases, users]) => {
        if (active) { setCases(cases); setUsers(users); }
      })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, reload]);

  return (
    <section aria-labelledby="admin-title">
      <h1 id="admin-title">Admin tools</h1>
      <p className="muted">Create a case, add team members, and assign them to cases.</p>
      {loading ? <p role="status">Loading admin tools…</p> : error ? (
        <div className="card">
          <p className="error" role="alert">{error}</p>
          <button className="secondary" onClick={() => setReload(reload + 1)}>Try again</button>
        </div>
      ) : (
        <div className="admin-forms">
          <CreateCase token={token} onCreated={record => setCases([...cases, record])} />
          <CreateUser token={token} onCreated={user => setUsers([...users, user])} />
          <AssignUser token={token} cases={cases} users={users} />
        </div>
      )}
    </section>
  );
}
