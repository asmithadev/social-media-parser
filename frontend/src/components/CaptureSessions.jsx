import { useEffect, useState } from 'react';
import { getSessions } from '../api';
import StartSession from './StartSession';
import SessionDetails from './SessionDetails';

export default function CaptureSessions({ token, panchnamaId, caseId, canManage }) {
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    getSessions(token, panchnamaId)
      .then(records => {
        if (active) { setSessions(records); setSelectedId(records.length ? String(records[0].id) : ''); }
      })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, panchnamaId, reload]);

  function handleStarted(session) {
    setSessions([...sessions, session]);
    setSelectedId(String(session.id));
  }

  const selected = sessions.find(session => String(session.id) === selectedId);

  return (
    <section className="capture-sessions" aria-labelledby="sessions-title">
      <h3 id="sessions-title">Capture sessions</h3>
      {loading ? <p role="status">Loading sessions…</p> : error ? (
        <div><p className="error" role="alert">{error}</p>
          <button className="secondary" onClick={() => setReload(reload + 1)}>Try again</button>
        </div>
      ) : (
        <>
          {canManage && <StartSession token={token} panchnamaId={panchnamaId} caseId={caseId} onStarted={handleStarted} />}
          {!sessions.length ? <p className="muted">No capture sessions have been started.</p> : (
            <>
              <label htmlFor="selected-session">Choose a capture session</label>
              <select id="selected-session" value={selectedId} onChange={event => setSelectedId(event.target.value)}>
                {sessions.map(session => <option key={session.id} value={session.id}>
                  Session #{session.id} — Account #{session.accountId} — {session.status}
                </option>)}
              </select>
              {selected && <SessionDetails key={selected.id} token={token} sessionId={selected.id} canManage={canManage}
                onUpdated={updated => setSessions(records => records.map(record => record.id === updated.id ? updated : record))} />}
            </>
          )}
        </>
      )}
    </section>
  );
}
