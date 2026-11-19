import { useEffect, useState } from 'react';
import { getWitnesses, addWitness } from '../api';

export default function Witnesses({ token, panchnamaId, canAdd }) {
  const [witnesses, setWitnesses] = useState([]);
  const [fullName, setFullName] = useState('');
  const [contactNo, setContactNo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError('');
    getWitnesses(token, panchnamaId)
      .then(records => { if (active) setWitnesses(records); })
      .catch(error => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, panchnamaId, reload]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      const witness = await addWitness(token, panchnamaId, {
        fullName: fullName.trim(), contactNo: contactNo.trim() || null,
      });
      setWitnesses([...witnesses, witness]);
      setFullName(''); setContactNo('');
      setMessage('Witness added.');
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p role="status">Loading witnesses…</p>;
  if (loadError) return (
    <div><p className="error" role="alert">{loadError}</p>
      <button className="secondary" onClick={() => setReload(reload + 1)}>Try again</button>
    </div>
  );

  return (
    <>
      <h3>Witnesses</h3>
      {!witnesses.length ? <p className="muted">No witnesses added yet.</p> : (
        <ul>{witnesses.map(witness => <li key={witness.id}>{witness.fullName}</li>)}</ul>
      )}
      {canAdd ? (
        <form className="admin-form" onSubmit={handleSubmit}>
          <fieldset disabled={saving}>
            <label htmlFor="witness-name">Witness full name</label>
            <input id="witness-name" required maxLength={150} value={fullName} onChange={event => setFullName(event.target.value)} />
            <label htmlFor="witness-contact">Contact number (optional)</label>
            <input id="witness-contact" type="tel" maxLength={15} value={contactNo} onChange={event => setContactNo(event.target.value)} />
            <button type="submit">{saving ? 'Adding…' : 'Add witness'}</button>
          </fieldset>
          {error && <p className="error" role="alert">{error}</p>}
          {message && <p className="success" role="status">{message}</p>}
        </form>
      ) : <p className="muted">Only this panchnama’s examiner can add witnesses.</p>}
    </>
  );
}
