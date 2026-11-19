import { useEffect, useState } from 'react';
import { getScreenshotFile } from '../api';
import ParsedEvidence from './ParsedEvidence';

export default function ScreenshotViewer({ token, screenshot, onClose, canParse, onStatusChange }) {
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    let objectUrl;
    setImageUrl(''); setError(''); setLoading(true);
    getScreenshotFile(token, screenshot.id, screenshot.sha256Hash)
      .then(blob => {
        if (active) { objectUrl = URL.createObjectURL(blob); setImageUrl(objectUrl); }
      })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    // Release private image bytes when the viewer closes or changes images.
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [token, screenshot.id, screenshot.sha256Hash, reload]);

  return (
    <section className="screenshot-viewer" aria-labelledby="viewer-title">
      <h4 id="viewer-title">Screenshot #{screenshot.id}</h4>
      <button className="secondary" onClick={onClose}>Close preview</button>
      {loading ? <p role="status">Loading and checking file integrity…</p> : error ? (
        <div><p className="error" role="alert">{error}</p>
          <button className="secondary" onClick={() => setReload(reload + 1)}>Try again</button>
        </div>
      ) : imageUrl && (
        <>
          <p className="success">SHA-256 integrity verified when this file was loaded.</p>
          <a href={imageUrl} download={`screenshot-${screenshot.id}.png`}>Download verified PNG</a>
          <img className="screenshot-image" src={imageUrl} alt={`Screenshot ${screenshot.id}, sequence ${screenshot.sequenceNo}`}
            onError={() => setError('The file hash matched, but the image could not be displayed as a PNG.')} />
        </>
      )}
      <ParsedEvidence token={token} screenshotId={screenshot.id} canParse={canParse} onStatusChange={onStatusChange} />
    </section>
  );
}
