import { useEffect, useState } from 'react';
import { getPanchnamas, isDemoMode } from '../api';
import CreatePanchnama from './CreatePanchnama';
import Witnesses from './Witnesses';
import CaptureSessions from './CaptureSessions';
import Reports from './Reports';

export default function Panchnamas({ caseId, token, user }) {
  const [records, setRecords] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    getPanchnamas(token, caseId)
      .then(records => {
        if (active) {
          setRecords(records);
          setSelectedId(records.length ? String(records[0].id) : '');
        }
      })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [caseId, token, reload]);

  function handleCreated(record) {
    setRecords([...records, record]);
    setSelectedId(String(record.id));
  }

  const selected = records.find(record => String(record.id) === selectedId);
  const canCreate = !isDemoMode && user.role === 'examiner';

  return (
    <section className="card" aria-labelledby="panchnamas-title">
      <h2 id="panchnamas-title">Panchnamas and witnesses</h2>
      {loading ? <p role="status">Loading panchnamas…</p> : error ? (
        <div><p className="error" role="alert">{error}</p>
          <button className="secondary" onClick={() => setReload(reload + 1)}>Try again</button>
        </div>
      ) : (
        <>
          {canCreate ? <CreatePanchnama token={token} caseId={caseId} onCreated={handleCreated} /> : (
            <p className="muted">Panchnamas are created by assigned examiners. Panchnama details are read-only for this account.</p>
          )}
          <h3>Panchnamas in this case</h3>
          {!records.length ? <p className="muted">No panchnamas have been recorded yet.</p> : (
            <>
              <label htmlFor="selected-panchnama">Choose a panchnama</label>
              <select id="selected-panchnama" value={selectedId} onChange={event => setSelectedId(event.target.value)}>
                {records.map(record => <option key={record.id} value={record.id}>{record.panchnamaNo}</option>)}
              </select>
              {selected && (
                <>
                  <dl className="case-facts">
                    <div><dt>Authority reference</dt><dd>{selected.authorityRef}</dd></div>
                    <div><dt>Location</dt><dd>{selected.location}</dd></div>
                    <div><dt>Date and time (local)</dt><dd>{new Date(selected.heldAt).toLocaleString('en-IN')}</dd></div>
                    <div><dt>Examiner</dt><dd>User #{selected.examinerId}</dd></div>
                  </dl>
                  <Witnesses key={selected.id} token={token} panchnamaId={selected.id}
                    canAdd={canCreate && selected.examinerId === user.id} />
                  <CaptureSessions key={'sessions-' + selected.id} token={token} panchnamaId={selected.id}
                    caseId={caseId} canManage={canCreate && selected.examinerId === user.id} />
                  <Reports key={'reports-' + selected.id} token={token} panchnamaId={selected.id} user={user} />
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
