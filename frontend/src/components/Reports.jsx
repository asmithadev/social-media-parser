import { useEffect, useState } from 'react';
import { getReports, generateReport, approveReport, recordPrintRequest, isDemoMode } from '../api';
import ReportDownload from './ReportDownload';

export default function Reports({ token, panchnamaId, user }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError(''); setError(''); setMessage('');
    getReports(token, panchnamaId)
      .then(records => { if (active) setReports(records); })
      .catch(error => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, panchnamaId, reload]);

  async function handleGenerate() {
    setSaving(true); setError(''); setMessage('');
    try {
      const report = await generateReport(token, panchnamaId);
      setReports(records => [report, ...records]);
      setMessage(`Report version ${report.versionNo} generated as a draft.`);
    } catch (error) { setError(error.message); }
    finally { setSaving(false); }
  }

  async function handleApprove(reportId) {
    setSaving(true); setError(''); setMessage('');
    try {
      const updated = await approveReport(token, reportId);
      setReports(records => records.map(record => record.id === updated.id ? updated : record));
      setMessage(`Report version ${updated.versionNo} approved.`);
    } catch (error) { setError(error.message); }
    finally { setSaving(false); }
  }

  async function handlePrintRequest(reportId) {
    setSaving(true); setError(''); setMessage('');
    try {
      const result = await recordPrintRequest(token, reportId);
      setMessage(`Print request recorded (audit #${result.auditLogId}). Open or download the PDF to print it.`);
    } catch (error) { setError(error.message); }
    finally { setSaving(false); }
  }

  const canGenerate = !isDemoMode && ['admin', 'examiner'].includes(user.role);
  const canApprove = !isDemoMode && ['admin', 'reviewer'].includes(user.role);

  return (
    <section className="reports" aria-labelledby="reports-title">
      <h3 id="reports-title">Reports</h3>
      <p className="muted">Finish open capture sessions before generating. Each generation creates a new PDF version.</p>
      <div className="session-actions">
        <button className="secondary" disabled={loading || saving} onClick={() => setReload(reload + 1)}>Refresh reports</button>
        {canGenerate && <button disabled={loading || saving || Boolean(loadError)} onClick={handleGenerate}>
          {saving ? 'Working…' : 'Generate new PDF version'}
        </button>}
      </div>
      {loading ? <p role="status">Loading reports…</p> : loadError ? <p className="error" role="alert">{loadError}</p> : (
        <>
          {isDemoMode && <p className="muted">Report actions are available in real-data mode.</p>}
          {!reports.length && <p className="muted">No reports generated yet.</p>}
          {reports.map(report => (
            <article className="report-version" key={report.id}>
              <h4>Version {report.versionNo} — {report.approvedBy ? 'Approved' : 'Draft'}</h4>
              <p>Generated: {new Date(report.generatedAt).toLocaleString('en-IN')} by user #{report.generatedBy}</p>
              <p>SHA-256: <code className="file-hash">{report.sha256Hash}</code></p>
              {report.approvedBy && <p>Approved: {new Date(report.approvedAt).toLocaleString('en-IN')} by user #{report.approvedBy}</p>}
              <ReportDownload token={token} report={report} disabled={saving} />
              {canApprove && !report.approvedBy && report.generatedBy !== user.id && (
                <div>
                  <p className="muted">Review this PDF before approving its contents.</p>
                  <button disabled={saving} onClick={() => handleApprove(report.id)}>Approve version {report.versionNo}</button>
                </div>
              )}
              {!report.approvedBy && report.generatedBy === user.id && <p className="muted">Another reviewer or administrator must approve your report.</p>}
              {report.approvedBy && !isDemoMode && <button className="secondary" disabled={saving} onClick={() => handlePrintRequest(report.id)}>
                Record print request for version {report.versionNo}
              </button>}
            </article>
          ))}
          {error && <p className="error form-feedback" role="alert">{error}</p>}
          {message && <p className="success form-feedback" role="status">{message}</p>}
        </>
      )}
    </section>
  );
}
