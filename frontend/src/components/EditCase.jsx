import { useState } from 'react';
import { updateCase } from '../api';

export default function EditCase({ record, token, onSaved, onCancel }) {
  const [caseNumber, setCaseNumber] = useState(record.caseNumber);
  const [title, setTitle] = useState(record.title);
  const [description, setDescription] = useState(record.description || '');
  const [status, setStatus] = useState(record.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!caseNumber.trim() || !title.trim()) {
      setError('Enter a case number and title.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateCase(token, record.id, {
        caseNumber: caseNumber.trim(),
        title: title.trim(),
        description: description.trim() || null,
        status,
      });
      onSaved(updated);
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit} aria-labelledby="edit-case-heading">
      <h3 id="edit-case-heading">Edit case</h3>
      <fieldset disabled={saving}>
        <label htmlFor="edit-case-number">Case number</label>
        <input id="edit-case-number" required maxLength={50} value={caseNumber}
          onChange={event => setCaseNumber(event.target.value)} />
        <label htmlFor="edit-case-title">Title</label>
        <input id="edit-case-title" required maxLength={255} value={title}
          onChange={event => setTitle(event.target.value)} />
        <label htmlFor="edit-case-description">Description (optional)</label>
        <textarea id="edit-case-description" rows={3} value={description}
          onChange={event => setDescription(event.target.value)} />
        <label htmlFor="edit-case-status">Status</label>
        <select id="edit-case-status" value={status} onChange={event => setStatus(event.target.value)}>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
        <button type="submit">{saving ? 'Saving…' : 'Save changes'}</button>
        <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
      </fieldset>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
