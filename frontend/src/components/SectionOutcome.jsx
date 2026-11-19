import { useState } from 'react';

export default function SectionOutcome({ section, disabled, onSave }) {
  const [status, setStatus] = useState(section.status === 'pending' ? 'captured' : section.status);
  const [reason, setReason] = useState(section.reason || '');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault(); setError('');
    try {
      await onSave(section.id, { status, reason: reason.trim() || null });
    } catch (error) { setError(error.message); }
  }

  return (
    <form className="admin-form section-outcome" onSubmit={handleSubmit}>
      <fieldset disabled={disabled}>
        <legend>{section.sectionName} — saved status: {section.status}</legend>
        <label htmlFor={'section-status-' + section.id}>Result</label>
        <select id={'section-status-' + section.id} value={status} onChange={event => setStatus(event.target.value)}>
          <option value="captured">Captured</option><option value="failed">Failed</option><option value="skipped">Skipped</option>
        </select>
        <label htmlFor={'section-reason-' + section.id}>Reason {status === 'captured' ? '(optional)' : '(required)'}</label>
        <textarea id={'section-reason-' + section.id} required={status !== 'captured'} maxLength={1000}
          value={reason} onChange={event => setReason(event.target.value)} rows={2} />
        <button type="submit">Save section result</button>
      </fieldset>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
