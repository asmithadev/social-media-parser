const { PDFDocument } = require('pdfkit');
const { buffer } = require('node:stream/consumers');
const readEvidence = require('./evidence-file');

async function renderReport(record, versionNo) {
  const pdf = new PDFDocument({ size: 'A4', margin: 48 });
  const output = buffer(pdf);
  try {
    pdf.fontSize(22).text('Social Media Evidence Report');
    pdf.moveDown().fontSize(12).text('Panchnama ' + record.panchnamaNo + ' | Version ' + versionNo);
    pdf.text('Case: ' + record.assignment.case.caseNumber);
    pdf.text('Held at: ' + record.heldAt.toISOString());
    pdf.text('Location: ' + record.location);
    pdf.text('Authority: ' + record.authorityRef);
    pdf.text('Examiner: ' + record.assignment.user.fullName);
    pdf.moveDown().text('Witnesses');
    for (const witness of record.witnesses) pdf.text(witness.fullName);
    if (!record.witnesses.length) pdf.text('No witnesses recorded.');
    for (const session of record.sessions) {
      pdf.moveDown().fontSize(12).text(
        'Session ' + session.id + ' | ' + session.account.platform.name + ' | ' + session.account.handle +
        ' | ' + session.deviceType + ' | ' + session.status
      );
      const outcomes = new Map(session.outcomes.map(row => [row.platformSectionId, row]));
      for (const section of session.account.platform.sections) {
        const outcome = outcomes.get(section.id);
        const status = outcome?.status ?? 'pending';
        const reason = outcome?.reason ? ' - ' + outcome.reason : '';
        pdf.fontSize(10).text(section.sectionName + ': ' + status + reason);
      }
    }

    for (const session of record.sessions) {
      for (const screenshot of session.screenshots) {
        const result = await readEvidence(screenshot.filePath, screenshot.sha256Hash);
        if (!result.bytes) {
          pdf.end();
          await output;
          return { status: 409, message: 'Screenshot ' + screenshot.id + ' could not be verified.' };
        }
        pdf.addPage();
        pdf.fontSize(16).text('Screenshot ' + screenshot.id);
        pdf.moveDown(0.5).fontSize(10).text(
          'Session ' + session.id + ' | ' + screenshot.section.sectionName + ' | Sequence ' + screenshot.sequenceNo
        );
        pdf.text('Captured: ' + screenshot.capturedAt.toISOString());
        pdf.text('SHA-256: ' + screenshot.sha256Hash);
        try {
          pdf.image(result.bytes, 48, pdf.y + 12, { fit: [499, 650], align: 'center' });
        } catch {
          pdf.end();
          await output;
          return { status: 409, message: 'Screenshot ' + screenshot.id + ' could not be rendered.' };
        }
      }
    }
    pdf.end();
    return { bytes: await output };
  } catch (error) {
    pdf.destroy();
    await output.catch(() => {});
    throw error;
  }
}

module.exports = renderReport;
