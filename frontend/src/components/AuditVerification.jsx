import { useState } from 'react';
import { verifyAuditChain } from '../api';

export default function AuditVerification({ token }) {
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [checkedAt, setCheckedAt] = useState('');
  const [checkpointId, setCheckpointId] = useState('');
  const [checkpointHash, setCheckpointHash] = useState('');
  const verified = result?.valid && result?.checkpointMatches !== false;

  async function handleVerify(event) {
    event.preventDefault();
    setChecking(true); setError(''); setResult(null); setCheckedAt('');
    try {
      const id = checkpointId.trim();
      const hash = checkpointHash.trim();
      if (id || hash) {
        if (!/^[1-9][0-9]{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n || !/^[a-f0-9]{64}$/.test(hash)) {
          throw new Error('Enter both a valid checkpoint ID and a 64-character lowercase SHA-256 hash, or leave both blank.');
        }
      }
      const result = await verifyAuditChain(token, id, hash);
      setResult(result);
      setCheckedAt(new Date().toISOString());
    } catch (error) { setError(error.message); }
    finally { setChecking(false); }
  }

  function exportCheckpoint() {
    const checkpoint = { checkpointId: result.headId, checkpointHash: result.headHash, checkedAt };
    const url = URL.createObjectURL(new Blob([JSON.stringify(checkpoint, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'audit-checkpoint-' + result.headId + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="card audit-verification" aria-labelledby="verification-title">
      <h2 id="verification-title">Verify hash chain</h2>
      <p className="muted">Checks all stored entries, including entries not yet loaded in the table.</p>
      <form className="admin-form" onSubmit={handleVerify}>
        <fieldset disabled={checking}>
          <label htmlFor="checkpoint-id">Trusted checkpoint ID (optional)</label>
          <input id="checkpoint-id" type="text" inputMode="numeric" maxLength={19} value={checkpointId}
            onChange={event => setCheckpointId(event.target.value)} />
          <label htmlFor="checkpoint-hash">Trusted checkpoint hash (optional)</label>
          <input id="checkpoint-hash" type="text" maxLength={64} value={checkpointHash} spellCheck={false}
            onChange={event => setCheckpointHash(event.target.value)} />
          <p className="muted">Paste both values from an earlier trusted checkpoint, or leave both blank for a chain-only check.</p>
          <button type="submit">{checking ? 'Verifying…' : 'Verify hash chain'}</button>
        </fieldset>
      </form>
      {checking && <p role="status">Checking the audit chain…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {result && (
        <div>
          <p className={verified ? 'success' : 'error'} role={verified ? 'status' : 'alert'}>
            {verified ? 'Stored audit chain verified.' : 'Audit chain verification failed.'}
          </p>
          <p>Checked at: {new Date(checkedAt).toLocaleString('en-IN')}</p>
          <p>Entries checked: {result.checked}</p>
          <p>Last entry ID: {result.headId ?? 'No entries'}</p>
          <p>Last chain hash: <code className="file-hash">{result.headHash}</code></p>
          {result.firstInvalidId !== null && <p className="error">First invalid entry: #{result.firstInvalidId}</p>}
          {result.checkpointMatches === true && <p className="success" role="status">Trusted checkpoint matches the stored chain.</p>}
          {result.checkpointMatches === false && <p className="error" role="alert">Trusted checkpoint does not match or its entry is missing. Review the audit history.</p>}
          {result.checkpointMatches == null && <p>No trusted checkpoint was compared.</p>}
          {verified && result.headId && (
            <button className="secondary" onClick={exportCheckpoint}>Export checkpoint</button>
          )}
          {result.valid && !result.headId && <p>The chain is empty; there is no entry to export as a checkpoint.</p>}
          <p className="muted">This result is a snapshot. Verify again after new actions. Keep a trusted copy of the last ID and hash outside the database to help detect deletion of final entries.</p>
        </div>
      )}
    </section>
  );
}
