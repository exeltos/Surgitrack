/** A4 in millimetres, and the width (in CSS pixels) a printed sheet is laid out at before it is captured. */
const A4 = {width: 210, height: 297};
const SHEET_WIDTH = 794;

/**
 * Turns a printable sheet (a whole HTML document, as the print previews use) into an A4 PDF file: the sheet
 * is laid out off screen, captured, and cut into pages. Text in any language comes out as the browser draws
 * it. The libraries load on first use.
 */
export async function htmlToPdf(html: string): Promise<Blob> {
  const [{default: html2canvas}, {jsPDF}] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${SHEET_WIDTH}px;height:1123px;border:0;`;
  document.body.appendChild(frame);
  try {
    await new Promise<void>(resolve => {
      frame.addEventListener('load', () => resolve(), {once: true});
      frame.srcdoc = html;
    });
    const sheet = frame.contentDocument?.body;
    if (!sheet) throw new Error('The sheet could not be laid out.');
    // The capture is cut into pages here: no screen-only page height (it would add an empty page); and the
    // labels as written, without letter spacing or CSS capitals (the capture misplaces Greek letters in them).
    const capture = sheet.ownerDocument.createElement('style');
    capture.textContent = 'body{min-height:0!important}*{letter-spacing:0!important;text-transform:none!important}';
    sheet.ownerDocument.head.appendChild(capture);
    const canvas = await html2canvas(sheet, {scale: 2, backgroundColor: '#ffffff', windowWidth: SHEET_WIDTH});
    const pdf = new jsPDF({unit: 'mm', format: 'a4', orientation: 'portrait'});
    // The captured sheet, cut into A4 pages from the top, down to its last line (not the blank below it).
    const pagePixels = Math.floor((canvas.width * A4.height) / A4.width);
    const bottom = Math.min(canvas.height, contentBottom(canvas) + 48);
    const page = document.createElement('canvas');
    page.width = canvas.width;
    for (let top = 0, index = 0; top < bottom; top += pagePixels, index += 1) {
      const height = Math.min(pagePixels, bottom - top);
      page.height = height;
      const context = page.getContext('2d');
      if (!context) break;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, page.width, height);
      context.drawImage(canvas, 0, top, canvas.width, height, 0, 0, canvas.width, height);
      if (index) pdf.addPage();
      pdf.addImage(page.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, A4.width, (height * A4.width) / canvas.width);
    }
    return pdf.output('blob');
  } finally {
    frame.remove();
  }
}

/** The last row of the capture with anything drawn on it (white below it is left out). */
function contentBottom(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) return canvas.height;
  const {data, width, height} = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let y = height - 1; y >= 0; y -= 2)
    for (let x = 0; x < width; x += 6) {
      const i = (y * width + x) * 4;
      if (data[i] < 235 || data[i + 1] < 235 || data[i + 2] < 235) return y + 1;
    }
  return height;
}

/** Hands a PDF to the phone's share sheet (mail, messages, Drive…) or, where there is none, downloads it. */
export async function shareOrDownloadPdf(blob: Blob, fileName: string, title: string) {
  const file = new File([blob], fileName, {type: 'application/pdf'});
  if (navigator.canShare?.({files: [file]})) {
    try {
      await navigator.share({files: [file], title});
      return;
    } catch (error) {
      // The person closed the share sheet: nothing else to do.
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
