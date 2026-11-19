import { useEffect, useState } from 'react';
import { getAuditLogs } from '../api';
import AuditVerification from './AuditVerification';

export default function AuditLogs({ token }) {
  const [logs, setLogs] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setLogs([]); setNextCursor(null);
    getAuditLogs(token)
      .then(data => { if (active) { setLogs(data.logs); setNextCursor(data.nextCursor); } })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, reload]);

  async function handleLoadMore() {
    setLoading(true); setError('');
    try {
      const data = await getAuditLogs(token, nextCursor);
      setLogs(records => [...records, ...data.logs]);
      setNextCursor(data.nextCursor);
    } catch (error) { setError(error.message); }
    finally { setLoading(false); }
  }

  return (
    <section aria-labelledby="audit-title">
      <h1 id="audit-title">Audit logs</h1>
      <p className="muted">Recorded actions across all cases. Only administrators can view this page.</p>
      <AuditVerification token={token} />
      <section className="card" aria-labelledby="audit-entries-title">
        <h2 id="audit-entries-title">Audit entries</h2>
        <p className="muted">Oldest first, 50 entries per page. Refresh to reload from the beginning.</p>
        <button className="secondary" disabled={loading} onClick={() => setReload(reload + 1)}>Refresh entries</button>
        {loading && <p role="status">Loading audit entries…</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {!loading && !error && !logs.length && <p>No audit entries recorded yet.</p>}
        {logs.length > 0 && (
          <div className="table-container">
            <table>
              <caption>{logs.length} loaded entries</caption>
              <thead><tr><th>ID</th><th>Date and time</th><th>User</th><th>Action</th><th>Record</th><th>Details</th></tr></thead>
              <tbody>{logs.map(log => (
                <tr key={log.id}>
                  <td>{log.id}</td>
                  <td>{new Date(log.loggedAt).toLocaleString('en-IN')}</td>
                  <td>{log.userId === null ? 'System / anonymous' : `User #${log.userId}`}</td>
                  <td>{log.action}</td>
                  <td>{log.entityType ? `${log.entityType} #${log.entityId}` : '—'}</td>
                  <td>
                    <details className="audit-entry-details">
                      <summary>View details</summary>
                      <p>Chain hash: <code className="file-hash">{log.chainHash}</code></p>
                      <pre className="ocr-text">{log.detail || 'No additional details.'}</pre>
                    </details>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {nextCursor && <button className="secondary" disabled={loading} onClick={handleLoadMore}>Load more entries</button>}
      </section>
    </section>
  );
}
