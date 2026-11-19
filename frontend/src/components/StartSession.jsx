import { useEffect, useState } from 'react';
import { getCaseAccounts, startSession } from '../api';

export default function StartSession({ token, panchnamaId, caseId, onStarted }) {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [deviceType, setDeviceType] = useState('macos');
  const [deviceLabel, setDeviceLabel] = useState('');
  const [toolVersion, setToolVersion] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError(''); setAccountId('');
    getCaseAccounts(token, caseId)
      .then(records => { if (active) setAccounts(records); })
      .catch(error => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, caseId, reload]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      const session = await startSession(token, panchnamaId, {
        accountId: Number(accountId), deviceType, deviceLabel: deviceLabel.trim() || null, toolVersion: toolVersion.trim(),
      });
      onStarted(session);
      setMessage('Session started. Record each section result below.');
    } catch (error) { setError(error.message); }
    finally { setSaving(false); }
  }

  return (
    <>
      <p className="muted">Start a session to track capture progress. Capture and upload screenshots separately.</p>
      <button className="secondary" disabled={loading || saving} onClick={() => setReload(reload + 1)}>Refresh case accounts</button>
      {loading ? <p role="status">Loading case accounts…</p> : loadError ? <p className="error" role="alert">{loadError}</p> :
        !accounts.length ? <p className="muted">Link a suspect and register a social account first, then refresh case accounts.</p> : (
          <form className="admin-form" onSubmit={handleSubmit}>
            <fieldset disabled={saving}>
              <label htmlFor="capture-account">Social account</label>
              <select id="capture-account" required value={accountId} onChange={event => setAccountId(event.target.value)}>
                <option value="">Choose an account</option>
                {accounts.map(account => <option key={account.id} value={account.id}>
                  {account.suspectName} — {account.platformName} — {account.handle}
                </option>)}
              </select>
              <label htmlFor="capture-device">Device type</label>
              <select id="capture-device" value={deviceType} onChange={event => setDeviceType(event.target.value)}>
                <option value="macos">macOS</option><option value="ios">iOS</option>
              </select>
              <label htmlFor="capture-label">Device label (optional)</label>
              <input id="capture-label" maxLength={100} value={deviceLabel} onChange={event => setDeviceLabel(event.target.value)} />
              <label htmlFor="capture-version">Capture tool version</label>
              <input id="capture-version" required maxLength={30} value={toolVersion} onChange={event => setToolVersion(event.target.value)} />
              <button type="submit">{saving ? 'Starting…' : 'Start session'}</button>
            </fieldset>
            {error && <p className="error" role="alert">{error}</p>}
            {message && <p className="success" role="status">{message}</p>}
          </form>
        )}
    </>
  );
}
