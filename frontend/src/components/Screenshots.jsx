import { useEffect, useState } from 'react';
import { getScreenshots, isDemoMode } from '../api';
import UploadScreenshot from './UploadScreenshot';
import ScreenshotViewer from './ScreenshotViewer';

export default function Screenshots({ token, sessionId, sections, canUpload, disabled, onBusyChange }) {
  const [screenshots, setScreenshots] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setSelected(null);
    getScreenshots(token, sessionId)
      .then(records => { if (active) setScreenshots(records); })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, sessionId, reload]);

  function handleUploaded(screenshot) {
    setScreenshots(records => [...records, screenshot].sort((a, b) =>
      a.platformSectionId - b.platformSectionId || a.sequenceNo - b.sequenceNo));
    setSelected(screenshot);
  }

  return (
    <section className="screenshots" aria-labelledby="screenshots-title">
      <h4 id="screenshots-title">Screenshots</h4>
      <button className="secondary" disabled={disabled || loading} onClick={() => setReload(reload + 1)}>Refresh screenshots</button>
      {loading ? <p role="status">Loading screenshots…</p> : error ? <p className="error" role="alert">{error}</p> : (
        <>
          {canUpload && <UploadScreenshot token={token} sessionId={sessionId} sections={sections}
            disabled={disabled} onBusyChange={onBusyChange} onUploaded={handleUploaded} />}
          {!canUpload && <p className="muted">Uploads are available to the panchnama’s examiner while the session is open.</p>}
          {isDemoMode && <p className="muted">The demo image is a 1 × 1 blue PNG placeholder.</p>}
          {!screenshots.length ? <p className="muted">No screenshots uploaded yet.</p> : (
            <ul className="screenshot-list">{screenshots.map(screenshot => (
              <li key={screenshot.id}>
                <strong>{sections.find(section => section.id === screenshot.platformSectionId)?.sectionName || `Section #${screenshot.platformSectionId}`} — sequence {screenshot.sequenceNo}</strong>
                <p>Recorded: {new Date(screenshot.capturedAt).toLocaleString('en-IN')}</p>
                <p>SHA-256: <code className="file-hash">{screenshot.sha256Hash}</code></p>
                <button className="secondary" disabled={disabled} onClick={() => setSelected(screenshot)}>View screenshot #{screenshot.id}</button>
              </li>
            ))}</ul>
          )}
          {selected && <ScreenshotViewer key={selected.id} token={token} screenshot={selected} onClose={() => setSelected(null)} />}
        </>
      )}
    </section>
  );
}
