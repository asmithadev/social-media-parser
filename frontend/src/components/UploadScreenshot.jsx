import { useRef, useState } from 'react';
import { uploadScreenshot } from '../api';

export default function UploadScreenshot({ token, sessionId, sections, disabled, onUploaded, onBusyChange }) {
  const [sectionId, setSectionId] = useState('');
  const [sequenceNo, setSequenceNo] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const fileInput = useRef(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true); onBusyChange(true); setError(''); setMessage('');
    try {
      const screenshot = await uploadScreenshot(token, sessionId, {
        sectionId: Number(sectionId), sequenceNo: Number(sequenceNo), sourceUrl: sourceUrl.trim(),
      }, file);
      onUploaded(screenshot);
      setFile(null); setSequenceNo(''); setSourceUrl('');
      if (fileInput.current) fileInput.current.value = '';
      setMessage('Screenshot uploaded. Its hash and timestamp are listed below.');
    } catch (error) { setError(error.message); }
    finally { setSaving(false); onBusyChange(false); }
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <fieldset disabled={disabled || saving || !sections.length}>
        <legend>Upload a screenshot</legend>
        <label htmlFor="screenshot-section">Capture section</label>
        <select id="screenshot-section" required value={sectionId} onChange={event => setSectionId(event.target.value)}>
          <option value="">Choose a section</option>
          {sections.map(section => <option key={section.id} value={section.id}>{section.sectionName}</option>)}
        </select>
        <label htmlFor="screenshot-sequence">Sequence number within this section</label>
        <input id="screenshot-sequence" type="number" min={1} max={2147483647} step={1} required
          value={sequenceNo} onChange={event => setSequenceNo(event.target.value)} />
        <label htmlFor="screenshot-source">Source URL (optional, http:// or https://)</label>
        <input id="screenshot-source" type="url" value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} />
        <label htmlFor="screenshot-file">PNG file (up to 10 MB)</label>
        <input id="screenshot-file" ref={fileInput} type="file" accept="image/png,.png" required
          onChange={event => setFile(event.target.files[0] || null)} />
        <button type="submit">{saving ? 'Uploading…' : 'Upload screenshot'}</button>
      </fieldset>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}
    </form>
  );
}
