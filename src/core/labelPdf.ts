const PX_PER_MM = 96 / 25.4;

/**
 * A barcode label as a PDF whose page is exactly the sticker (width × height in mm). A PDF prints at its own page
 * size with no margins, headers or footers whatever the browser's print settings, which a web page cannot promise
 * on a roll of stickers. The label is laid out off screen at the sticker's size and captured at about 600 dpi so
 * the bars stay sharp; the libraries load on first use.
 */
export async function labelToPdf(html: string, widthMm: number, heightMm: number): Promise<Blob> {
  const [{default: html2canvas}, {jsPDF}] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const width = Math.round(widthMm * PX_PER_MM);
  const height = Math.round(heightMm * PX_PER_MM);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;border:0;`;
  document.body.appendChild(frame);
  try {
    await new Promise<void>(resolve => {
      frame.addEventListener('load', () => resolve(), {once: true});
      frame.srcdoc = html;
    });
    const doc = frame.contentDocument;
    if (!doc?.body) throw new Error('The label could not be laid out.');
    // Just the sticker: no screen margin, shadow or zoom, and the type as written (the capture misplaces Greek
    // letters in letter-spaced or CSS-capitalised text).
    const capture = doc.createElement('style');
    capture.textContent =
      'html{background:#fff!important;zoom:1!important}body{margin:0!important;box-shadow:none!important}*{letter-spacing:0!important;text-transform:none!important}';
    doc.head.appendChild(capture);
    const canvas = await html2canvas(doc.body, {
      scale: 600 / 96,
      backgroundColor: '#ffffff',
      width,
      height,
      windowWidth: width,
      windowHeight: height,
    });
    const pdf = new jsPDF({
      unit: 'mm',
      format: [widthMm, heightMm],
      orientation: widthMm >= heightMm ? 'landscape' : 'portrait',
    });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');
    // Opens the print dialog when the viewer shows it.
    pdf.autoPrint();
    return pdf.output('blob');
  } finally {
    frame.remove();
  }
}
