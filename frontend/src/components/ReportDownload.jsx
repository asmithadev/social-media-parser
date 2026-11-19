import { useEffect, useState } from 'react';
import { getReportFile } from '../api';

export default function ReportDownload({ token, report, disabled }) {
  const [requestNumber, setRequestNumber] = useState(0);
  const [fileUrl, setFileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!requestNumber) return;
    let active = true;
    let objectUrl;
    setFileUrl(''); setError(''); setLoading(true);
    getReportFile(token, report.id, report.sha256Hash)
      .then(blob => {
        if (active) { objectUrl = URL.createObjectURL(blob); setFileUrl(objectUrl); }
      })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [token, report.id, report.sha256Hash, requestNumber]);

  return (
    <div className="report-download">
      <button className="secondary" disabled={disabled || loading} onClick={() => setRequestNumber(requestNumber + 1)}>
        {loading ? 'Checking PDF…' : fileUrl ? 'Verify PDF again' : 'Prepare PDF download'}
      </button>
      {loading && <p role="status">Downloading and verifying the PDF…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {fileUrl && (
        <>
          <p className="success">File integrity verified when this PDF was loaded.</p>
          <div className="session-actions">
            <a href={fileUrl} download={`panchnama-${report.panchnamaId}-v${report.versionNo}.pdf`}>Download PDF</a>
            <a href={fileUrl} target="_blank" rel="noopener noreferrer">Open PDF in new tab</a>
          </div>
        </>
      )}
    </div>
  );
}
