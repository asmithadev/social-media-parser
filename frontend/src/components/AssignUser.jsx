import { useEffect, useState } from 'react';
import { assignUser, getAssignments } from '../api';

export default function AssignUser({ token, cases, users }) {
  const [caseId, setCaseId] = useState('');
  const [userId, setUserId] = useState('');
  const [notes, setNotes] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setAssignments([]);
    setUserId('');
    setError('');
    setLoadError('');
    setMessage('');
    setLoading(Boolean(caseId));
    if (caseId) {
      getAssignments(token, caseId)
        .then(records => { if (active) setAssignments(records); })
        .catch(error => { if (active) setLoadError(error.message); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [caseId, token, reload]);

  // Only active examiners/reviewers who are not already assigned can be chosen.
  const availableUsers = users.filter(user => user.active &&
    ['examiner', 'reviewer'].includes(user.role) && !assignments.some(item => item.userId === user.id));

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const assignment = await assignUser(token, caseId, { userId: Number(userId), userNotes: notes.trim() || null });
      setAssignments([...assignments, assignment]);
      setMessage('User assigned to the selected case.');
      setUserId('');
      setNotes('');
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card" aria-labelledby="assign-user-title">
      <h2 id="assign-user-title">Assign a user to a case</h2>
      {!cases.length && <p className="muted">Create a case first.</p>}
      <form className="admin-form" onSubmit={handleSubmit}>
        <fieldset disabled={saving || !cases.length}>
          <label htmlFor="assignment-case">Case</label>
          <select id="assignment-case" required value={caseId} onChange={event => {
            setCaseId(event.target.value); setUserId(''); setNotes('');
          }}>
            <option value="">Choose a case</option>
            {cases.map(record => <option key={record.id} value={record.id}>{record.caseNumber} — {record.title}</option>)}
          </select>
          <label htmlFor="assignment-user">User</label>
          <select id="assignment-user" required value={userId} disabled={!caseId || loading || Boolean(loadError)}
            onChange={event => setUserId(event.target.value)}>
            <option value="">Choose an examiner or reviewer</option>
            {availableUsers.map(user => <option key={user.id} value={user.id}>{user.fullName} ({user.role}) — {user.email}</option>)}
          </select>
          {caseId && !loading && !loadError && !availableUsers.length && (
            <p className="muted">No unassigned users are available. Create an examiner or reviewer above.</p>
          )}
          <label htmlFor="assignment-notes">Assignment notes (optional)</label>
          <textarea id="assignment-notes" rows={2} value={notes} onChange={event => setNotes(event.target.value)} />
          <button type="submit" disabled={!caseId || !userId || loading || Boolean(loadError)}>
            {saving ? 'Assigning…' : 'Assign user'}
          </button>
        </fieldset>
        {loading && <p role="status">Loading assignments…</p>}
        {(loadError || error) && (
          <div><p className="error" role="alert">{loadError || error}</p>
            <button className="secondary" type="button" disabled={saving} onClick={() => setReload(reload + 1)}>Reload assignments</button>
          </div>
        )}
        {message && <p className="success" role="status">{message}</p>}
      </form>
      {caseId && !loading && !loadError && (
        <div className="assignment-list">
          <h3>Current assignments</h3>
          {!assignments.length ? <p className="muted">No users assigned yet.</p> : (
            <ul>{assignments.map(assignment => {
              const user = users.find(user => user.id === assignment.userId);
              return <li key={assignment.id}>{user ? `${user.fullName} (${user.role})` : `User #${assignment.userId}`}</li>;
            })}</ul>
          )}
        </div>
      )}
    </section>
  );
}
