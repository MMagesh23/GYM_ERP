const PDFDocument = require('pdfkit');
const { registerFonts } = require('./pdfFonts');

const STATUS_COLORS = {
  paid: '#10b981',
  partial: '#f59e0b',
  pending: '#9ca3af',
  refunded: '#6b7280',
  partially_refunded: '#f59e0b',
  failed: '#ef4444',
};

const PAGE = { left: 50, right: 545, width: 495 };
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Streams a formatted invoice PDF directly to an Express response.
 * Redesigned for a cleaner, more scannable layout: accent header bar,
 * two-column header (identity + invoice meta/status), a shaded "Billed to"
 * card, a properly aligned/striped line-items table, and a right-aligned
 * totals block — all built on a fixed column grid so nothing drifts.
 *
 * @param {import('express').Response} res
 * @param {{
 *   invoiceNumber: string,
 *   issuedDate: Date,
 *   gym: { name: string, address?: string, contact?: string, email?: string, gst?: string, footer?: string, currency?: string, accentColor?: string },
 *   member: { memberId: string, name: string, phone?: string, email?: string },
 *   lineItems: Array<{ description: string, quantity?: number, unitPrice: number, amount: number }>,
 *   subTotal: number, discount?: number, tax?: number, grandTotal: number,
 *   paymentMethod?: string, transactionNumber?: string,
 *   status?: string, amountPaid?: number, refundedAmount?: number,
 *   membershipPeriod?: { start: Date, end: Date } | null,
 * }} data
 */
const streamInvoicePdf = (res, data) => {
  const currency = data.gym.currency || '₹';
  const accent = data.gym.accentColor || '#3390fa';
  const doc = new PDFDocument({ size: 'A4', margin: 0 }); // margins managed manually for a full-bleed top bar
  const font = registerFonts(doc);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${data.invoiceNumber}.pdf"`);
  doc.pipe(res);

  // ── Top accent bar ──────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 8).fill(accent);

  // ── Header: gym identity (left) vs invoice meta + status (right) ───
  let y = 38;
  doc.fillColor('#111827').font(font.bold).fontSize(19).text(data.gym.name, PAGE.left, y, { width: 300 });
  y = doc.y + 3;
  doc.font(font.regular).fontSize(8.5).fillColor('#6b7280');
  if (data.gym.address) {
    doc.text(data.gym.address, PAGE.left, y, { width: 300 });
    y = doc.y + 1;
  }
  const contactLine = [data.gym.contact, data.gym.email].filter(Boolean).join('   ·   ');
  if (contactLine) {
    doc.text(contactLine, PAGE.left, y, { width: 300 });
    y = doc.y + 1;
  }
  if (data.gym.gst) {
    doc.text(`GSTIN ${data.gym.gst}`, PAGE.left, y, { width: 300 });
    y = doc.y;
  }

  const rightX = 355;
  const rightW = PAGE.right - rightX;
  doc.font(font.bold).fontSize(22).fillColor(accent).text('INVOICE', rightX, 38, { width: rightW, align: 'right' });
  doc.font(font.regular).fontSize(9).fillColor('#374151');
  doc.text(`# ${data.invoiceNumber}`, rightX, doc.y + 5, { width: rightW, align: 'right' });
  doc.fillColor('#6b7280').text(fmtDate(data.issuedDate), rightX, doc.y + 2, { width: rightW, align: 'right' });

  if (data.status) {
    const statusLabel = data.status.replace('_', ' ').toUpperCase();
    const badgeColor = STATUS_COLORS[data.status] || '#10b981';
    doc.font(font.bold).fontSize(8.5);
    const bw = doc.widthOfString(statusLabel) + 18;
    const by = doc.y + 8;
    doc.roundedRect(PAGE.right - bw, by, bw, 17, 8.5).fill(badgeColor);
    doc.fillColor('#fff').text(statusLabel, PAGE.right - bw, by + 4.5, { width: bw, align: 'center' });
    doc.fillColor('#000');
    y = Math.max(y, by + 17);
  }

  y = Math.max(y, doc.y) + 22;
  doc.moveTo(PAGE.left, y).lineTo(PAGE.right, y).lineWidth(1).strokeColor('#e5e7eb').stroke();
  y += 20;

  // ── "Billed to" card ────────────────────────────────────────────────
  const cardH = data.membershipPeriod?.start ? 76 : 60;
  doc.roundedRect(PAGE.left, y, 270, cardH, 6).fillAndStroke('#f9fafb', '#f0f1f3');
  doc.font(font.bold).fontSize(7.5).fillColor('#9ca3af').text('BILLED TO', PAGE.left + 16, y + 12, { characterSpacing: 0.6 });
  doc.font(font.bold).fontSize(11.5).fillColor('#111827').text(data.member.name, PAGE.left + 16, y + 25);
  doc.font(font.regular).fontSize(9).fillColor('#6b7280');
  doc.text(`Member ID  ${data.member.memberId}`, PAGE.left + 16, y + 42, { width: 240 });
  const contactBits = [data.member.phone, data.member.email].filter(Boolean).join('   ·   ');
  if (contactBits) doc.text(contactBits, PAGE.left + 16, doc.y + 1, { width: 240 });
  if (data.membershipPeriod?.start && data.membershipPeriod?.end) {
    doc
      .fillColor(accent)
      .fontSize(8.5)
      .text(`Membership period:  ${fmtDate(data.membershipPeriod.start)} – ${fmtDate(data.membershipPeriod.end)}`, PAGE.left + 16, y + cardH - 17, {
        width: 240,
      });
  }

  y += cardH + 28;

  // ── Line items table (fixed column grid, striped rows) ─────────────
  const col = { desc: PAGE.left, qty: 330, price: 395, amount: PAGE.right - 82 };
  const rowH = 22;

  doc.rect(PAGE.left, y, PAGE.width, rowH).fill('#f3f4f6');
  doc.font(font.bold).fontSize(8).fillColor('#4b5563');
  doc.text('DESCRIPTION', col.desc + 12, y + 7, { characterSpacing: 0.3 });
  doc.text('QTY', col.qty, y + 7, { width: 40, align: 'center', characterSpacing: 0.3 });
  doc.text('PRICE', col.price, y + 7, { width: 70, align: 'right', characterSpacing: 0.3 });
  doc.text('AMOUNT', col.amount, y + 7, { width: PAGE.right - col.amount - 12, align: 'right', characterSpacing: 0.3 });
  y += rowH;

  doc.font(font.regular).fontSize(9.5);
  data.lineItems.forEach((item, idx) => {
    if (idx % 2 === 1) doc.rect(PAGE.left, y, PAGE.width, rowH).fill('#fafafa');
    doc.fillColor('#111827');
    doc.text(item.description, col.desc + 12, y + 6, { width: 260 });
    doc.text(String(item.quantity || 1), col.qty, y + 6, { width: 40, align: 'center' });
    doc.text(`${currency}${item.unitPrice.toFixed(2)}`, col.price, y + 6, { width: 70, align: 'right' });
    doc.text(`${currency}${item.amount.toFixed(2)}`, col.amount, y + 6, { width: PAGE.right - col.amount - 12, align: 'right' });
    y += rowH;
  });

  doc.moveTo(PAGE.left, y).lineTo(PAGE.right, y).strokeColor('#e5e7eb').stroke();
  y += 14;

  // ── Totals (right-aligned block) ────────────────────────────────────
  const totalsX = 320;
  const totalsW = PAGE.right - totalsX;
  const totalsRow = (label, value, opts = {}) => {
    doc.font(opts.bold ? font.bold : font.regular).fontSize(opts.bold ? 11 : 9.5);
    doc.fillColor(opts.color || (opts.bold ? '#111827' : '#4b5563'));
    doc.text(label, totalsX, y, { width: totalsW - 95, align: 'left' });
    doc.text(`${value < 0 ? '-' : ''}${currency}${Math.abs(value).toFixed(2)}`, totalsX + totalsW - 95, y, { width: 95, align: 'right' });
    doc.fillColor('#000');
    y += opts.bold ? 20 : 16;
  };

  totalsRow('Subtotal', data.subTotal);
  if (data.discount) totalsRow('Discount', -data.discount, { color: '#059669' });
  if (data.tax) totalsRow('Tax', data.tax);

  y += 3;
  doc.moveTo(totalsX, y).lineTo(PAGE.right, y).strokeColor('#d1d5db').stroke();
  y += 9;

  totalsRow('Total', data.grandTotal, { bold: true });

  if (data.status === 'partial' && data.amountPaid !== undefined) {
    totalsRow('Amount Paid', data.amountPaid, { color: '#059669' });
    totalsRow('Balance Due', Math.max(data.grandTotal - data.amountPaid, 0), { bold: true, color: '#dc2626' });
  }
  if (data.refundedAmount > 0) {
    totalsRow('Refunded', -data.refundedAmount, { color: '#6b7280' });
    totalsRow('Net Received', Math.max(data.grandTotal - data.refundedAmount, 0), { bold: true });
  }

  // ── Payment method note ──────────────────────────────────────────────
  if (data.paymentMethod) {
    y += 12;
    doc.font(font.regular).fontSize(8.5).fillColor('#9ca3af');
    doc.text(
      `Paid via ${data.paymentMethod.replace('_', ' ').toUpperCase()}${data.transactionNumber ? `   ·   Ref: ${data.transactionNumber}` : ''}`,
      PAGE.left,
      y
    );
  }

  // ── Footer ────────────────────────────────────────────────────────────
  if (data.gym.footer) {
    doc.moveTo(PAGE.left, 758).lineTo(PAGE.right, 758).strokeColor('#f0f1f3').stroke();
    doc.font(font.regular).fontSize(8.5).fillColor('#9ca3af').text(data.gym.footer, PAGE.left, 770, { width: PAGE.width, align: 'center' });
  }

  doc.end();
};

module.exports = { streamInvoicePdf };