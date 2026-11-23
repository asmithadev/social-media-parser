export default function StructuredEvidence({ structured }) {
  if (!structured) return <p className="muted">Run OCR again to extract structured fields from this screenshot.</p>;

  return (
    <section aria-label="Structured evidence">
      <h4>Detected fields</h4>
      <p className="muted">These are unverified text matches. Check sender, date and message boundaries against the screenshot.
        Dates keep their displayed format; bubble direction and sender identity are not inferred.</p>
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
    </section>
  );
}
