import { useEffect, useState } from 'react';
import { getParsedEvidence, processScreenshot } from '../api';
import StructuredEvidence from './StructuredEvidence';

export default function ParsedEvidence({ token, screenshotId, canParse, onStatusChange }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [visual, setVisual] = useState(false);
  const [incomingSide, setIncomingSide] = useState('left');
  const [region, setRegion] = useState({ x: 0, y: 15, width: 100, height: 70 });

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    getParsedEvidence(token, screenshotId)
      .then(result => { if (active) setResult(result); })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, screenshotId, reload]);

  async function handleProcess() {
    setError('');
    const area = Object.fromEntries(Object.entries(region).map(([key, value]) => [key, Number(value) / 100]));
    if (visual && (!Object.values(area).every(Number.isFinite) || area.x < 0 || area.y < 0 ||
      area.width <= 0 || area.height <= 0 || area.x + area.width > 1 || area.y + area.height > 1)) {
      setError('Choose a chat area inside the screenshot using percentages from 0 to 100.');
      return;
    }
    setRunning(true);
    try {
      const result = await processScreenshot(token, screenshotId, visual ? { visual: { region: area, incomingSide } } : {});
      setResult(result); onStatusChange?.(result.parseStatus);
    } catch (error) {
      setError(error.message);
      if (error.data?.parseStatus) {
        setResult({ artifact: null, parseStatus: error.data.parseStatus });
        onStatusChange?.(error.data.parseStatus);
      }
    } finally { setRunning(false); }
  }

  return (
    <section className="parsed-evidence" aria-labelledby="ocr-title">
      <h4 id="ocr-title">Extracted text</h4>
      <button className="secondary" disabled={loading || running} onClick={() => setReload(reload + 1)}>Refresh text</button>
      {loading ? <p role="status">Loading extracted text…</p> : (
        <>
          {result && <p>OCR status: {running ? 'processing' : result.parseStatus}</p>}
          {result?.artifact ? (
            result.artifact.text ? <pre className="ocr-text">{result.artifact.text}</pre> : <p>No readable text was found in this image.</p>
          ) : <p className="muted">{result?.message || 'No extracted text is available yet.'}</p>}
          {result?.artifact && <StructuredEvidence structured={result.artifact.structured} />}
          {canParse && <fieldset className="admin-form" disabled={running}>
            <label><input type="checkbox" style={{ width: 'auto' }} checked={visual} onChange={event => setVisual(event.target.checked)} /> Analyze chat positions (messages sections only)</label>
            {visual && <>
              <p>Choose the chat area as percentages of the screenshot. Exclude headers, sidebars and the composer.</p>
              {Object.entries(region).map(([key, value]) => <label key={key}>
                Chat area {key} (%)
                <input type="number" min="0" max="100" value={value}
                  onChange={event => setRegion({ ...region, [key]: event.target.value })} />
              </label>)}
              <label>Incoming message side
                <select value={incomingSide} onChange={event => setIncomingSide(event.target.value)}>
                  <option value="left">Left</option><option value="right">Right</option>
                </select>
              </label>
              <p className="muted">Direction is a position-based candidate, not sender identity. Centered text stays unknown.</p>
            </>}
          </fieldset>}
          {canParse && <button disabled={running} onClick={handleProcess}>
            {running ? 'Extracting text…' : result?.parseStatus === 'failed' ? 'Retry OCR' : result?.parseStatus === 'parsed' ? 'Run OCR again' : 'Extract text'}
          </button>}
          {running && <p role="status">Processing locally. Text takes up to a minute; position analysis adds another OCR pass.</p>}
          {error && <p className="error" role="alert">{error}</p>}
          <p className="muted">OCR can make mistakes. Compare extracted text with the original screenshot.</p>
        </>
      )}
    </section>
  );
}
