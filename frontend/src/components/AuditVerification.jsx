import { useState } from 'react';
import { verifyAuditChain } from '../api';

export default function AuditVerification({ token }) {
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [checkedAt, setCheckedAt] = useState('');

  async function handleVerify() {
    setChecking(true); setError(''); setResult(null); setCheckedAt('');
    try {
      const result = await verifyAuditChain(token);
      setResult(result);
      setCheckedAt(new Date().toLocaleString('en-IN'));
    } catch (error) { setError(error.message); }
    finally { setChecking(false); }
  }

  return (
    <section className="card audit-verification" aria-labelledby="verification-title">
      <h2 id="verification-title">Verify hash chain</h2>
      <p className="muted">Checks all stored entries, including entries not yet loaded in the table.</p>
      <button disabled={checking} onClick={handleVerify}>{checking ? 'Verifying…' : 'Verify hash chain'}</button>
      {checking && <p role="status">Checking the audit chain…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {result && (
        <div>
          <p className={result.valid ? 'success' : 'error'} role={result.valid ? 'status' : 'alert'}>
            {result.valid ? 'Stored audit chain verified.' : 'Audit chain verification failed.'}
          </p>
          <p>Checked at: {checkedAt}</p>
          <p>Entries checked: {result.checked}</p>
          <p>Last entry ID: {result.headId ?? 'No entries'}</p>
          <p>Last chain hash: <code className="file-hash">{result.headHash}</code></p>
          {result.firstInvalidId !== null && <p className="error">First invalid entry: #{result.firstInvalidId}</p>}
          <p className="muted">This result is a snapshot. Verify again after new actions. Keep a trusted copy of the last ID and hash outside the database to help detect deletion of final entries.</p>
        </div>
      )}
    </section>
  );
}
