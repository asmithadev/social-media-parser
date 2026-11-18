import { useState } from 'react';
import { createCase } from '../api';

export default function CreateCase({ token, onCreated }) {
  const [caseNumber, setCaseNumber] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const record = await createCase(token, {
        caseNumber: caseNumber.trim(), title: title.trim(), description: description.trim() || null,
      });
      onCreated(record);
      setMessage(`Case ${record.caseNumber} created. You can now assign users below.`);
      setCaseNumber('');
      setTitle('');
      setDescription('');
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card" aria-labelledby="create-case-title">
      <h2 id="create-case-title">Create a case</h2>
      <form className="admin-form" onSubmit={handleSubmit}>
        <fieldset disabled={saving}>
          <label htmlFor="new-case-number">Case number</label>
          <input id="new-case-number" required maxLength={50} value={caseNumber}
            onChange={event => setCaseNumber(event.target.value)} />
          <label htmlFor="new-case-title">Title</label>
          <input id="new-case-title" required maxLength={255} value={title}
            onChange={event => setTitle(event.target.value)} />
          <label htmlFor="new-case-description">Description (optional)</label>
          <textarea id="new-case-description" rows={3} value={description}
            onChange={event => setDescription(event.target.value)} />
          <button type="submit">{saving ? 'Creating…' : 'Create case'}</button>
        </fieldset>
        {error && <p className="error" role="alert">{error}</p>}
        {message && <p className="success" role="status">{message}</p>}
      </form>
    </section>
  );
}
