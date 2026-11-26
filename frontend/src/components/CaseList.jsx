import { useEffect, useState } from 'react';
import { getCases } from '../api';

export default function CaseList({ token, onSelectCase }) {
  const [cases, setCases] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getCases(token)
      .then(records => { if (active) setCases(records); })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    // Ignore a response if the user has already left this screen.
    return () => { active = false; };
  }, [token, reload]);

  const visibleCases = cases.filter(record =>
    `${record.caseNumber} ${record.title}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <section aria-labelledby="cases-title">
      <p className="eyebrow">Case workspace</p>
      <h1 id="cases-title">Cases</h1>
      <p className="muted">Choose a case to see its details.</p>
      {loading ? <p className="card" role="status">Loading cases…</p> : error ? (
        <div className="card">
          <p className="error" role="alert">{error}</p>
          <button className="secondary" onClick={() => setReload(reload + 1)}>Try again</button>
        </div>
      ) : (
        <>
        <div className="case-summary" aria-label="Case overview">
          <div className="summary-item"><strong>{cases.length}</strong><span>Available cases</span></div>
          <div className="summary-item"><strong>{cases.filter(record => record.status === 'open').length}</strong><span>Open cases</span></div>
          <div className="summary-item"><strong>{cases.filter(record => record.status === 'closed').length}</strong><span>Closed cases</span></div>
        </div>
        <div className="card">
          <label htmlFor="case-search">Search cases</label>
          <input id="case-search" type="search" placeholder="Case number or title"
            value={search} onChange={event => setSearch(event.target.value)} />
          {cases.length === 0 ? <p className="empty-state">No cases are available for your account.</p> :
            visibleCases.length === 0 ? <p className="empty-state">No cases match your search.</p> : (
              <div className="table-container">
                <table>
                  <caption className="muted">{visibleCases.length} {visibleCases.length === 1 ? 'case' : 'cases'}</caption>
                  <thead><tr><th>Case number</th><th>Title</th><th>Status</th><th>Details</th></tr></thead>
                  <tbody>
                    {visibleCases.map(record => (
                      <tr key={record.id}>
                        <td className="case-number">{record.caseNumber}</td>
                        <td>{record.title}</td>
                        <td><span className={`badge ${record.status}`}>{record.status}</span></td>
                        <td><button className="secondary" aria-label={`View case ${record.caseNumber}`}
                          onClick={() => onSelectCase(record.id)}>View case</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
        </>
      )}
    </section>
  );
}
