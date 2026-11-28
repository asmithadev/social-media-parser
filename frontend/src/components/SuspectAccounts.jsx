import { useEffect, useState } from 'react';
import { getAccounts, getPlatforms, createAccount } from '../api';

export default function SuspectAccounts({ suspectId, token, canEdit }) {
  const [accounts, setAccounts] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [platformId, setPlatformId] = useState('');
  const [handle, setHandle] = useState('');
  const [platformAccountId, setPlatformAccountId] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError('');
    Promise.all([getAccounts(token, suspectId), getPlatforms(token)])
      .then(([accounts, platforms]) => {
        if (active) { setAccounts(accounts); setPlatforms(platforms); }
      })
      .catch(error => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [suspectId, token, reload]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      const account = await createAccount(token, suspectId, {
        platformId: Number(platformId),
        handle: handle.trim(),
        platformAccountId: platformAccountId.trim() || null,
        profileUrl: profileUrl.trim() || null,
      });
      setAccounts([...accounts, account]);
      setHandle(''); setPlatformAccountId(''); setProfileUrl('');
      setMessage('Social account registered.');
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p role="status">Loading social accounts…</p>;
  if (loadError) return (
    <div><p className="error" role="alert">{loadError}</p>
      <button className="secondary" onClick={() => setReload(reload + 1)}>Try again</button>
    </div>
  );

  return (
    <>
      <h3>Registered social accounts</h3>
      {!accounts.length ? <p className="muted">No social accounts registered for this suspect.</p> : (
        <div className="table-container">
          <table>
            <caption className="muted">Social accounts for the selected suspect</caption>
            <thead><tr><th>Platform</th><th>Handle</th><th>Platform account ID</th><th>Profile</th></tr></thead>
            <tbody>{accounts.map(account => (
              <tr key={account.id}>
                <td>{platforms.find(platform => platform.id === account.platformId)?.name || `Platform #${account.platformId}`}</td>
                <td className="account-handle">{account.handle}</td>
                <td>{account.platformAccountId || 'Not provided'}</td>
                <td>{account.profileUrl ? <a href={account.profileUrl} target="_blank" rel="noopener noreferrer">Open profile</a> : 'Not provided'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {canEdit && (
        <>
          <h3>Register a social account</h3>
          <form className="admin-form" onSubmit={handleSubmit}>
            <fieldset disabled={saving || !platforms.length}>
              <label htmlFor="account-platform">Platform</label>
              <select id="account-platform" required value={platformId} onChange={event => setPlatformId(event.target.value)}>
                <option value="">Choose a platform</option>
                {platforms.map(platform => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
              </select>
              <label htmlFor="account-handle">Handle or username</label>
              <input id="account-handle" required maxLength={150} value={handle} onChange={event => setHandle(event.target.value)} />
              <label htmlFor="account-platform-id">Permanent platform account ID (optional)</label>
              <input id="account-platform-id" maxLength={100} value={platformAccountId} onChange={event => setPlatformAccountId(event.target.value)} />
              <label htmlFor="account-profile">Profile URL (optional, http:// or https://)</label>
              <input id="account-profile" type="url" value={profileUrl} onChange={event => setProfileUrl(event.target.value)} />
              <button type="submit">{saving ? 'Registering…' : 'Register account'}</button>
            </fieldset>
            {!platforms.length && <p className="muted">No active platforms are available. Seed the platform list first.</p>}
            {error && <p className="error" role="alert">{error}</p>}
            {message && <p className="success" role="status">{message}</p>}
          </form>
        </>
      )}
    </>
  );
}
