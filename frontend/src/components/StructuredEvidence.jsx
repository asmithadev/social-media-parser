export default function StructuredEvidence({ structured }) {
  if (!structured) return <p className="muted">Run OCR again to extract structured fields from this screenshot.</p>;

  return (
    <section aria-label="Structured evidence">
      <h4>Detected fields</h4>
      <p className="muted">These are unverified text matches. Check sender, date and message boundaries against the screenshot.
        Dates keep their displayed format. Position-based direction candidates do not establish sender identity.</p>
      <p className="muted">Parser: {structured.parserVersion}{structured.platform ? ' | Platform: ' + structured.platform : ''}</p>
      <p><strong>Usernames:</strong> {structured.usernames.length ? structured.usernames.join(', ') : 'None detected.'}</p>
      <p><strong>Date candidates:</strong> {structured.dates.length ? structured.dates.join(', ') : 'None detected.'}</p>
      <h5>Message candidates</h5>
      {structured.messages.length ? structured.messages.map(message => (
        <div key={message.lineNumber}>
          <p className="muted">OCR line {message.lineNumber}{message.endLineNumber ? ' to ' + message.endLineNumber : ''}</p>
          {message.sender && <p><strong>Sender candidate:</strong> {message.sender}</p>}
          {message.displayedDate && <p><strong>Displayed date/time:</strong> {message.displayedDate} {message.displayedTime}</p>}
          {message.layout && <p className="muted">Layout: {message.layout}</p>}
          <pre className="ocr-text">{message.text}</pre>
        </div>
      )) : <p>No labelled messages detected.</p>}
      {structured.visual && <section aria-label="Chat positions">
        <h5>Chat position candidates</h5>
        <p>Incoming side selected: {structured.visual.incomingSide}. Boxes are OCR text lines, not confirmed bubble boundaries.</p>
        <svg viewBox={`0 0 ${structured.visual.imageWidth} ${structured.visual.imageHeight}`}
          style={{ width: '100%', maxHeight: 400, border: '1px solid #ccc' }} role="img" aria-label="Detected text positions on the screenshot">
          {structured.visual.candidates.map((candidate, index) => <rect key={index} x={candidate.x} y={candidate.y}
            width={candidate.width} height={candidate.height} fill={candidate.direction === 'incoming' ? '#c5dafa' : candidate.direction === 'outgoing' ? '#c7e9cc' : '#ddd'}
            stroke="#555"><title>{candidate.direction}: {candidate.text}</title></rect>)}
        </svg>
        {!structured.visual.candidates.length && <p>No readable text lines were found inside the chat area.</p>}
        {structured.visual.candidates.map((candidate, index) => <div key={index}>
          <p><strong>{candidate.direction} candidate</strong> ({candidate.side}; x {candidate.x}, y {candidate.y})</p>
          <pre className="ocr-text">{candidate.text}</pre>
        </div>)}
      </section>}
    </section>
  );
}
