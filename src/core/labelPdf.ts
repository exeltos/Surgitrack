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
      'html{background:#fff!important;zoom:1!important}body{margin:0!important;box-shadow:none!important}*{letter-spacing:0!important;text-transform:none!important}.bc svg{visibility:hidden}';
    doc.head.appendChild(capture);
    const canvas = await html2canvas(doc.body, {
      scale: 600 / 96,
      backgroundColor: '#ffffff',
      width,
      height,
      windowWidth: width,
      windowHeight: height,
    });
    // Pure black and white: a grey or off-white pixel is dotted by a label printer's driver (the specks seen over
    // the whole sticker). The barcodes are not in the capture at all; they are drawn below as vector bars, so
    // their edges are as sharp as the printer can make them.
    const context = canvas.getContext('2d');
    if (context) {
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const {data} = image;
      for (let i = 0; i < data.length; i += 4) {
        const ink = (data[i] + data[i + 1] + data[i + 2]) / 3 < 150 ? 0 : 255;
        data[i] = data[i + 1] = data[i + 2] = ink;
        data[i + 3] = 255;
      }
      context.putImageData(image, 0, 0);
    }
    const bars = Array.from(doc.querySelectorAll<SVGSVGElement>('.bc svg')).map(svg => {
      const box = svg.getBoundingClientRect();
      const view = (svg.getAttribute('viewBox') || '0 0 1 1').split(/\s+/).map(Number);
      const rects = Array.from(svg.querySelectorAll('rect')).map(r => ({
        x: Number(r.getAttribute('x')),
        y: Number(r.getAttribute('y')),
        w: Number(r.getAttribute('width')),
        h: Number(r.getAttribute('height')),
      }));
      return {box, view, rects};
    });
    const pdf = new jsPDF({
      unit: 'mm',
      format: [widthMm, heightMm],
      orientation: widthMm >= heightMm ? 'landscape' : 'portrait',
    });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');
    pdf.setFillColor(0, 0, 0);
    for (const {box, view, rects} of bars) {
      const [, , viewWidth, viewHeight] = view;
      for (const r of rects)
        pdf.rect(
          (box.left + (r.x / viewWidth) * box.width) / PX_PER_MM,
          (box.top + (r.y / viewHeight) * box.height) / PX_PER_MM,
          (r.w / viewWidth) * (box.width / PX_PER_MM),
          (r.h / viewHeight) * (box.height / PX_PER_MM),
          'F',
        );
    }
    // Opens the print dialog when the viewer shows it.
    pdf.autoPrint();
    return pdf.output('blob');
  } finally {
    frame.remove();
  }
}
