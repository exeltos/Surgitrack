const PX_PER_MM = 96 / 25.4;
const PT_PER_MM = 72 / 25.4;
// Liberation Sans (the type the PDF is drawn in; metric-compatible with Arial): the height above the baseline of its
// line box, as a share of the font size.
const ASCENT = 0.905;

/**
 * A barcode label as a PDF whose page is exactly the sticker (width × height in mm), drawn entirely as vectors:
 * barcode bars and symbols as shapes, text as real text in an embedded font. A PDF prints at its own page size with
 * no margins, headers or footers, and with nothing but black ink on white: a picture of the label (even a clean black
 * and white one) gets dithered by a label printer's driver, which dotted the whole sticker.
 *
 * The label (an HTML document, as the preview shows it) is laid out off screen at the sticker's size; every piece of
 * text, bar and symbol is then read from where the browser put it and drawn at the same place. The libraries load on
 * first use.
 */
export async function labelToPdf(html: string, widthMm: number, heightMm: number): Promise<Blob> {
  const [{jsPDF}, fonts] = await Promise.all([import('jspdf'), import('./labelFonts')]);
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
    const view = frame.contentWindow;
    if (!doc?.body || !view) throw new Error('The label could not be laid out.');
    // Just the sticker: no screen margin, shadow or zoom.
    const reset = doc.createElement('style');
    reset.textContent =
      'html{background:#fff!important;zoom:1!important}body{margin:0!important;box-shadow:none!important}';
    doc.head.appendChild(reset);
    await doc.fonts?.ready;

    const pdf = new jsPDF({
      unit: 'mm',
      format: [widthMm, heightMm],
      orientation: widthMm >= heightMm ? 'landscape' : 'portrait',
    });
    pdf.addFileToVFS('label-regular.ttf', fonts.LABEL_FONT_REGULAR);
    pdf.addFont('label-regular.ttf', 'labelfont', 'normal');
    pdf.addFileToVFS('label-bold.ttf', fonts.LABEL_FONT_BOLD);
    pdf.addFont('label-bold.ttf', 'labelfont', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.setFillColor(0, 0, 0);
    pdf.setDrawColor(0, 0, 0);
    const mm = (px: number) => px / PX_PER_MM;

    // Barcodes: one filled bar per <rect>, stretched over the box the browser gave the SVG.
    for (const svg of Array.from(doc.querySelectorAll<SVGSVGElement>('.bc svg'))) {
      const box = svg.getBoundingClientRect();
      const [, , viewWidth, viewHeight] = (svg.getAttribute('viewBox') || '0 0 1 1').split(/\s+/).map(Number);
      for (const bar of Array.from(svg.querySelectorAll('rect'))) {
        const [x, y, w, h] = ['x', 'y', 'width', 'height'].map(name => Number(bar.getAttribute(name)));
        pdf.rect(
          mm(box.left + (x / viewWidth) * box.width),
          mm(box.top + (y / viewHeight) * box.height),
          mm((w / viewWidth) * box.width),
          mm((h / viewHeight) * box.height),
          'F',
        );
      }
    }

    // The sterile-date symbols (see core/sterileSymbols.ts), redrawn from their shapes.
    for (const svg of Array.from(doc.querySelectorAll<SVGSVGElement>('svg.sym'))) {
      const box = svg.getBoundingClientRect();
      if (!box.width) continue;
      const x0 = mm(box.left);
      const y0 = mm(box.top);
      if (svg.classList.contains('sym-sterile')) {
        const s = mm(box.width) / 46;
        pdf.setLineWidth(1.2 * s);
        pdf.rect(x0 + 0.6 * s, y0 + 0.6 * s, 44.8 * s, 13.8 * s, 'S');
        pdf.setFont('labelfont', 'bold');
        pdf.setFontSize(9.6 * s * PT_PER_MM);
        pdf.text('STERILE', x0 + 23 * s, y0 + 11 * s, {align: 'center'});
      } else {
        const s = mm(box.width) / 14;
        pdf.setLineWidth(1.4 * s);
        pdf.setLineCap('round');
        const stroke = (startX: number, startY: number, segments: number[][]) =>
          pdf.lines(segments, x0 + startX * s, y0 + startY * s, [s, s], 'S', false);
        stroke(2, 1, [[10, 0]]);
        stroke(2, 17, [[10, 0]]);
        stroke(3, 1.5, [
          [0, 4, 3.5, 5.2, 4, 7.5],
          [-0.5, 2.3, -4, 3.5, -4, 7.5],
        ]);
        stroke(11, 1.5, [
          [0, 4, -3.5, 5.2, -4, 7.5],
          [0.5, 2.3, 4, 3.5, 4, 7.5],
        ]);
      }
    }

    // A logo image in the header, when the hospital uses one.
    for (const img of Array.from(doc.querySelectorAll<HTMLImageElement>('img.logo'))) {
      const box = img.getBoundingClientRect();
      const format = /^data:image\/(png|jpeg|webp)/.exec(img.src)?.[1]?.toUpperCase();
      if (!box.width || !format) continue;
      try {
        pdf.addImage(
          img.src,
          format === 'JPEG' ? 'JPEG' : format,
          mm(box.left),
          mm(box.top),
          mm(box.width),
          mm(box.height),
        );
      } catch {
        // A logo that cannot be drawn is left out; the label is still complete.
      }
    }

    // Text: every visible text node, at the place and size the browser laid it out.
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement;
      const raw = node.textContent || '';
      const first = raw.search(/\S/);
      if (!element || first < 0 || element.closest('svg') || !element.getClientRects().length) continue;
      const last = raw.search(/\s*$/);
      // Composed (a letter and its accent mark as one character), as the font has them.
      let text = raw.slice(first, last).normalize('NFC');
      const range = doc.createRange();
      range.setStart(node, first);
      range.setEnd(node, last);
      const box = range.getBoundingClientRect();
      const style = view.getComputedStyle(element);
      const sizePx = parseFloat(style.fontSize);
      const bold = style.fontWeight === 'bold' || Number(style.fontWeight) >= 600;
      const spacingPx = parseFloat(style.letterSpacing) || 0;
      pdf.setFont('labelfont', bold ? 'bold' : 'normal');
      pdf.setFontSize(sizePx * 0.75);
      const spacing = mm(spacingPx);
      const widthOf = (value: string) => pdf.getTextWidth(value) + spacing * value.length;
      // Text the page cut short with an ellipsis is cut the same way here.
      if (style.textOverflow === 'ellipsis' && box.width > element.clientWidth + 0.5) {
        while (text.length > 1 && widthOf(`${text}…`) > mm(element.clientWidth)) text = text.slice(0, -1);
        text += '…';
      }
      const options: {charSpace?: number; renderingMode?: 'fillThenStroke'} = spacing ? {charSpace: spacing} : {};
      // The brand name is drawn a little heavier: thin strokes come out pale on a thermal printer.
      if (element.classList.contains('brand')) {
        pdf.setLineWidth(0.12);
        options.renderingMode = 'fillThenStroke';
      }
      pdf.text(text, mm(box.left), mm(box.top + ASCENT * sizePx), options);
    }
    // Opens the print dialog when the viewer shows it.
    pdf.autoPrint();
    return pdf.output('blob');
  } finally {
    frame.remove();
  }
}
