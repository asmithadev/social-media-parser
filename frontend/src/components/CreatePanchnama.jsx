import { useState } from 'react';
import { createPanchnama } from '../api';

export default function CreatePanchnama({ token, caseId, onCreated }) {
  const [number, setNumber] = useState('');
  const [authority, setAuthority] = useState('');
  const [location, setLocation] = useState('');
  const [heldAt, setHeldAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError(''); setMessage(''); setSaving(true);
    try {
      // datetime-local contains local time. Send the same instant as UTC.
      const record = await createPanchnama(token, caseId, {
        panchnamaNo: number.trim(), authorityRef: authority.trim(),
        location: location.trim(), heldAt: new Date(heldAt).toISOString(),
      });
      onCreated(record);
      setNumber(''); setAuthority(''); setLocation(''); setHeldAt('');
      setMessage('Panchnama created. Add its witnesses below.');
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h3>Create a panchnama</h3>
      <form className="admin-form" onSubmit={handleSubmit}>
        <fieldset disabled={saving}>
          <label htmlFor="panchnama-number">Panchnama number</label>
          <input id="panchnama-number" required maxLength={50} value={number} onChange={event => setNumber(event.target.value)} />
          <label htmlFor="panchnama-authority">Authority reference</label>
          <input id="panchnama-authority" required maxLength={100} value={authority} onChange={event => setAuthority(event.target.value)} />
          <label htmlFor="panchnama-location">Location</label>
          <input id="panchnama-location" required maxLength={255} value={location} onChange={event => setLocation(event.target.value)} />
          <label htmlFor="panchnama-time">Date and time (your local time)</label>
          <input id="panchnama-time" type="datetime-local" required value={heldAt} onChange={event => setHeldAt(event.target.value)} />
          <button type="submit">{saving ? 'Creating…' : 'Create panchnama'}</button>
        </fieldset>
        {error && <p className="error" role="alert">{error}</p>}
        {message && <p className="success" role="status">{message}</p>}
      </form>
    </>
  );
}
