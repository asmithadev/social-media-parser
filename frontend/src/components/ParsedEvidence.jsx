import { useEffect, useState } from 'react';
import { getParsedEvidence, processScreenshot } from '../api';

export default function ParsedEvidence({ token, screenshotId, canParse, onStatusChange }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

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
    setRunning(true); setError('');
    setResult({ artifact: null, parseStatus: 'pending' });
    onStatusChange?.('pending');
    try {
      const result = await processScreenshot(token, screenshotId);
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
          {canParse && <button disabled={running} onClick={handleProcess}>
            {running ? 'Extracting text…' : result?.parseStatus === 'failed' ? 'Retry OCR' : result?.parseStatus === 'parsed' ? 'Run OCR again' : 'Extract text'}
          </button>}
          {running && <p role="status">Processing locally. This can take up to a minute.</p>}
          {error && <p className="error" role="alert">{error}</p>}
          <p className="muted">OCR can make mistakes. Compare extracted text with the original screenshot.</p>
        </>
      )}
    </section>
  );
}
