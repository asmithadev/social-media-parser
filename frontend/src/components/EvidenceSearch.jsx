import { useState } from 'react';
import { searchEvidence } from '../api';

export default function EvidenceSearch({ token, caseId }) {
  const [query, setQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [results, setResults] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(query, after = null) {
    setLoading(true); setError('');
    if (!after) { setResults([]); setNextCursor(null); setSearchedQuery(query); }
    try {
      const data = await searchEvidence(token, caseId, query, after);
      setResults(records => after ? [...records, ...data.artifacts] : data.artifacts);
      setNextCursor(data.nextCursor);
    } catch (error) { setError(error.message); }
    finally { setLoading(false); }
  }

  return (
    <section className="card" aria-labelledby="evidence-search-title">
      <h2 id="evidence-search-title">Search extracted evidence</h2>
      <form className="admin-form" onSubmit={event => { event.preventDefault(); load(query.trim()); }}>
        <label htmlFor="evidence-query">Text to find in this case</label>
        <input id="evidence-query" type="search" required maxLength={150} value={query} disabled={loading}
          onChange={event => setQuery(event.target.value)} />
        <button type="submit" disabled={loading || !query.trim()}>Search evidence</button>
      </form>
      {loading && <p role="status">Searching…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {searchedQuery && !loading && !error && !results.length && <p>No parsed screenshots match “{searchedQuery}”.</p>}
      {results.map(result => <article key={result.screenshot_id}>
        <h3>Screenshot #{result.screenshot_id}</h3><pre className="ocr-text">{result.text}</pre>
      </article>)}
      {nextCursor && <button className="secondary" disabled={loading} onClick={() => load(searchedQuery, nextCursor)}>Load more results</button>}
    </section>
  );
}
