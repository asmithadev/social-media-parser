import { useEffect, useState } from 'react';
import { getCaseSuspects, getSuspects } from '../api';
import AddSuspect from './AddSuspect';
import SuspectAccounts from './SuspectAccounts';

export default function CaseSuspects({ caseId, token, canEdit }) {
  const [links, setLinks] = useState([]);
  const [suspects, setSuspects] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([getCaseSuspects(token, caseId), canEdit ? getSuspects(token) : Promise.resolve([])])
      .then(([links, suspects]) => {
        if (active) {
          setLinks(links);
          setSuspects(suspects);
          setSelectedId(links.length ? String(links[0].suspectId) : '');
        }
      })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [caseId, token, canEdit, reload]);

  function handleLinked(link) {
    const suspect = suspects.find(suspect => suspect.id === link.suspectId);
    setLinks([...links, { ...link, suspect }]);
    setSelectedId(String(link.suspectId));
  }

  const availableSuspects = suspects.filter(suspect => !links.some(link => link.suspectId === suspect.id));
  const selectedLink = links.find(link => String(link.suspectId) === selectedId);

  return (
    <section className="card" aria-labelledby="case-suspects-title">
      <h2 id="case-suspects-title">Suspects and social accounts</h2>
      {loading ? <p role="status">Loading suspects…</p> : error ? (
        <div><p className="error" role="alert">{error}</p>
          <button className="secondary" onClick={() => setReload(reload + 1)}>Try again</button>
        </div>
      ) : (
        <>
          {canEdit && (
            <AddSuspect token={token} caseId={caseId} suspects={availableSuspects}
              onCreated={suspect => setSuspects([...suspects, suspect])} onLinked={handleLinked} />
          )}
          <h3>Suspects linked to this case</h3>
          {!links.length ? <p className="muted">No suspects are linked to this case yet.</p> : (
            <>
              <label htmlFor="selected-suspect">Choose a suspect to view their accounts</label>
              <select id="selected-suspect" value={selectedId} onChange={event => setSelectedId(event.target.value)}>
                {links.map(link => <option key={link.id} value={link.suspectId}>
                  {link.suspect.fullName} — {link.involvement}
                </option>)}
              </select>
              {selectedLink && (
                <div className="suspect-accounts">
                  <p><strong>{selectedLink.suspect.fullName}</strong>
                    {selectedLink.suspect.alias ? ` (alias: ${selectedLink.suspect.alias})` : ''}</p>
                  {selectedLink.involvementDetails && <p className="description">{selectedLink.involvementDetails}</p>}
                  <SuspectAccounts key={selectedId} suspectId={Number(selectedId)} token={token} canEdit={canEdit} />
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
