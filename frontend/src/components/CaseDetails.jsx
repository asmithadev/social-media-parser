import { useEffect, useState } from 'react';
import { getCase } from '../api';
import CaseSuspects from './CaseSuspects';

export default function CaseDetails({ caseId, token, onBack, canEdit }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getCase(caseId, token)
      .then(record => { if (active) setRecord(record); })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [caseId, token]);

  return (
    <section aria-labelledby="details-title">
      <button className="secondary back-button" onClick={onBack}>← Back to cases</button>
      <h1 id="details-title">Case details</h1>
      {loading ? <p className="card" role="status">Loading case details…</p> : error ? (
        <p className="card error" role="alert">{error}</p>
      ) : record && (
        <div className="case-sections">
        <article className="card">
          <div className="case-heading">
            <div><p className="case-number muted">{record.caseNumber}</p><h2>{record.title}</h2></div>
            <span className={`badge ${record.status}`}>{record.status}</span>
          </div>
          <h3>Description</h3>
          <p className="description">{record.description || 'No description has been provided.'}</p>
          <dl className="case-facts">
            <div><dt>Case number</dt><dd>{record.caseNumber}</dd></div>
            <div><dt>Created on</dt><dd>{new Date(record.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}</dd></div>
            <div><dt>Created by</dt><dd>User #{record.createdBy}</dd></div>
            <div><dt>Status</dt><dd className="status-text">{record.status}</dd></div>
          </dl>
        </article>
        <CaseSuspects caseId={caseId} token={token} canEdit={canEdit} />
        </div>
      )}
    </section>
  );
}
