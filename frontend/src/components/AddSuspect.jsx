import { useState } from 'react';
import { createSuspect, linkSuspect } from '../api';

export default function AddSuspect({ token, caseId, suspects, onCreated, onLinked }) {
  const [fullName, setFullName] = useState('');
  const [alias, setAlias] = useState('');
  const [suspectId, setSuspectId] = useState('');
  const [involvement, setInvolvement] = useState('suspect');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleCreate(event) {
    event.preventDefault();
    setError(''); setMessage(''); setBusy('create');
    try {
      const suspect = await createSuspect(token, { fullName: fullName.trim(), alias: alias.trim() || null });
      onCreated(suspect);
      setSuspectId(String(suspect.id));
      setFullName(''); setAlias('');
      setMessage('Suspect registered. Use the form below to link them to this case.');
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy('');
    }
  }

  async function handleLink(event) {
    event.preventDefault();
    setError(''); setMessage(''); setBusy('link');
    try {
      const link = await linkSuspect(token, caseId, {
        suspectId: Number(suspectId), involvement, involvementDetails: details.trim() || null,
      });
      onLinked(link);
      setSuspectId(''); setDetails('');
      setMessage('Suspect linked to this case. Their accounts are shown below.');
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <h3>Register a new suspect</h3>
      <p className="muted">If the person is already registered, choose them in the linking form below.</p>
      <form className="admin-form" onSubmit={handleCreate}>
        <fieldset disabled={Boolean(busy)}>
          <label htmlFor="suspect-name">Full name</label>
          <input id="suspect-name" required maxLength={150} value={fullName}
            onChange={event => setFullName(event.target.value)} />
          <label htmlFor="suspect-alias">Alias (optional)</label>
          <input id="suspect-alias" maxLength={150} value={alias} onChange={event => setAlias(event.target.value)} />
          <button type="submit">{busy === 'create' ? 'Registering…' : 'Register suspect'}</button>
        </fieldset>
      </form>

      <h3>Link a registered suspect to this case</h3>
      <form className="admin-form" onSubmit={handleLink}>
        <fieldset disabled={Boolean(busy) || !suspects.length}>
          <label htmlFor="link-suspect">Registered suspect</label>
          <select id="link-suspect" required value={suspectId} onChange={event => setSuspectId(event.target.value)}>
            <option value="">Choose a suspect</option>
            {suspects.map(suspect => <option key={suspect.id} value={suspect.id}>
              {suspect.fullName}{suspect.alias ? ` (${suspect.alias})` : ''} — #{suspect.id}
            </option>)}
          </select>
          <label htmlFor="suspect-involvement">Involvement in this case</label>
          <select id="suspect-involvement" value={involvement} onChange={event => setInvolvement(event.target.value)}>
            <option value="suspect">Suspect</option>
            <option value="accused">Accused</option>
          </select>
          <label htmlFor="suspect-details">Involvement details (optional)</label>
          <textarea id="suspect-details" rows={2} value={details} onChange={event => setDetails(event.target.value)} />
          <button type="submit" disabled={!suspectId}>{busy === 'link' ? 'Linking…' : 'Link suspect to case'}</button>
        </fieldset>
        {!suspects.length && <p className="muted">No unlinked suspects are available. Register a new suspect above.</p>}
      </form>
      {error && <p className="error form-feedback" role="alert">{error}</p>}
      {message && <p className="success form-feedback" role="status">{message}</p>}
    </>
  );
}
