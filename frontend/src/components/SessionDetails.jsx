import { useEffect, useState } from 'react';
import { getSession, getSessionSections, saveSectionOutcome, finishSession } from '../api';
import SectionOutcome from './SectionOutcome';
import Screenshots from './Screenshots';

export default function SessionDetails({ token, sessionId, canManage, onUpdated }) {
  const [session, setSession] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError(''); setError(''); setMessage('');
    Promise.all([getSession(token, sessionId), getSessionSections(token, sessionId)])
      .then(([session, sections]) => {
        if (active) { setSession(session); setSections(sections); onUpdated(session); }
      })
      .catch(error => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, sessionId, reload]);

  async function handleSave(sectionId, fields) {
    setSaving(true); setError(''); setMessage('');
    try {
      const outcome = await saveSectionOutcome(token, sessionId, sectionId, fields);
      setSections(records => records.map(record => record.id === sectionId ? { ...record, status: outcome.status, reason: outcome.reason } : record));
      setMessage('Section result saved.');
    } finally { setSaving(false); }
  }

  async function handleFinish(status) {
    setSaving(true); setError(''); setMessage('');
    try {
      const updated = await finishSession(token, sessionId, status);
      setSession(updated); onUpdated(updated);
      setMessage(`Session ${updated.status}.`);
    } catch (error) { setError(error.message); }
    finally { setSaving(false); }
  }

  const pending = sections.filter(section => section.status === 'pending').length;
  const canEdit = canManage && session?.status === 'open';

  return (
    <div className="session-details">
      <button className="secondary" disabled={saving || loading} onClick={() => setReload(reload + 1)}>Refresh session</button>
      {loading ? <p role="status">Loading session details…</p> : loadError ? <p className="error" role="alert">{loadError}</p> : session && (
        <>
          <dl className="case-facts">
            <div><dt>Status</dt><dd>{session.status}</dd></div>
            <div><dt>Account</dt><dd>#{session.accountId}</dd></div>
            <div><dt>Device</dt><dd>{session.deviceType} {session.deviceLabel || ''}</dd></div>
            <div><dt>Tool version</dt><dd>{session.toolVersion}</dd></div>
            <div><dt>Started</dt><dd>{new Date(session.startedAt).toLocaleString('en-IN')}</dd></div>
            <div><dt>Ended</dt><dd>{session.endedAt ? new Date(session.endedAt).toLocaleString('en-IN') : 'Not ended'}</dd></div>
          </dl>
          <Screenshots token={token} sessionId={sessionId} sections={sections}
            canUpload={canEdit} disabled={saving} onBusyChange={setSaving} />
          <h4>Capture sections</h4>
          {!sections.length && <p className="muted">No capture sections are configured for this platform.</p>}
          {sections.map(section => canEdit ? (
            <SectionOutcome key={section.id + '-' + section.status + '-' + (section.reason || '')}
              section={section} disabled={saving} onSave={handleSave} />
          ) : (
            <p key={section.id}><strong>{section.sectionName}:</strong> {section.status}{section.reason ? ` — ${section.reason}` : ''}</p>
          ))}
          {canEdit && (
            <>
              <p className="muted">{pending} sections pending. Save a result for every section before completing.</p>
              <div className="session-actions">
                <button disabled={saving || pending > 0 || !sections.length} onClick={() => handleFinish('completed')}>Complete session</button>
                <button className="secondary" disabled={saving} onClick={() => handleFinish('failed')}>End as failed</button>
              </div>
            </>
          )}
          {!canEdit && <p className="muted">Only the panchnama’s examiner can change an open session.</p>}
          {error && <p className="error form-feedback" role="alert">{error}</p>}
          {message && <p className="success form-feedback" role="status">{message}</p>}
        </>
      )}
    </div>
  );
}
