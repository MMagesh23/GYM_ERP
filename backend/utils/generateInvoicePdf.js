const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { registerFonts } = require('./pdfFonts');
const { amountToWords } = require('./numberToWords');

const STATUS_COLORS = {
  paid: '#10b981',
  partial: '#f59e0b',
  pending: '#9ca3af',
  refunded: '#6b7280',
  partially_refunded: '#f59e0b',
  failed: '#ef4444',
};

// NEW — diagonal status stamp drawn across the page, the way a printed
// professional invoice is often rubber-stamped. Deliberately skipped for
// 'paid' (the normal, unremarkable outcome) so a routine invoice stays
// clean; shown for every other status where the reader benefits from an
// unmissable, at-a-glance flag.
const WATERMARK_TEXT = {
  pending: { text: 'UNPAID', color: '#ef4444' },
  partial: { text: 'PARTIALLY PAID', color: '#f59e0b' },
  refunded: { text: 'REFUNDED', color: '#9ca3af' },
  partially_refunded: { text: 'PARTIALLY REFUNDED', color: '#9ca3af' },
  failed: { text: 'PAYMENT FAILED', color: '#ef4444' },
};

const PAGE = { left: 50, right: 545, width: 495 };
const PAGE_BOTTOM = 780;
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// Ensures a block of the given height fits on the current page before it's
// drawn — used for the bottom "amount in words / bank details / terms /
// footer" block so it never gets visually cut mid-section by a page break.
const ensureSpace = (doc, y, neededHeight, accent) => {
  if (y + neededHeight <= PAGE_BOTTOM) return y;
  doc.addPage();
  doc.rect(0, 0, doc.page.width, 8).fill(accent);
  return 40;
};

// Best-effort QR code (invoice number + total + date, for quick manual
// verification) — generation failures must never break invoice output, so
// any error here just results in no QR code being drawn.
const buildVerificationQr = async (data) => {
  try {
    const payload = `Invoice: ${data.invoiceNumber}\nAmount: ${data.gym.currency || '₹'}${data.grandTotal.toFixed(2)}\nDate: ${fmtDate(data.issuedDate)}`;
    return await QRCode.toBuffer(payload, { width: 88, margin: 0, color: { dark: '#111827', light: '#FFFFFFFF' } });
  } catch (err) {
    return null;
  }
};

/**
 * Streams a formatted, professional invoice PDF directly to an Express
 * response. Now async — generates a small verification QR code before
 * drawing, and lays out an extended footer block (amount in words, bank/UPI
 * payment details, terms & conditions, authorized-signatory line) beneath
 * the existing totals section, in addition to the original header/billed-to/
 * line-items/totals layout.
 *
 * @param {import('express').Response} res
 * @param {{
 *   invoiceNumber: string,
 *   issuedDate: Date,
 *   gym: {
 *     name: string, address?: string, contact?: string, email?: string,
 *     gst?: string, pan?: string, website?: string, footer?: string,
 *     currency?: string, accentColor?: string,
 *     bankDetails?: { accountHolderName?: string, bankName?: string, accountNumber?: string, ifscCode?: string, upiId?: string },
 *     terms?: string,
 *   },
 *   member: { memberId: string, name: string, phone?: string, email?: string },
 *   lineItems: Array<{ description: string, quantity?: number, unitPrice: number, amount: number }>,
 *   subTotal: number, discount?: number, tax?: number, grandTotal: number,
 *   paymentMethod?: string, transactionNumber?: string,
 *   status?: string, amountPaid?: number, refundedAmount?: number,
 *   membershipPeriod?: { start: Date, end: Date } | null,
 * }} data
 */
const streamInvoicePdf = async (res, data) => {
  const currency = data.gym.currency || '₹';
  const accent = data.gym.accentColor || '#3390fa';
  const doc = new PDFDocument({ size: 'A4', margin: 0 }); // margins managed manually for a full-bleed top bar
  const font = registerFonts(doc);

  const qrBuffer = await buildVerificationQr(data);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${data.invoiceNumber}.pdf"`);
  doc.pipe(res);

  // ── Top accent bar ──────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 8).fill(accent);

  // ── Watermark (diagonal status stamp) ───────────────────────────────
  const watermark = WATERMARK_TEXT[data.status];
  if (watermark) {
    doc.save();
    doc.rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] });
    doc.font(font.bold).fontSize(64).fillOpacity(0.09).fillColor(watermark.color);
    doc.text(watermark.text, 0, doc.page.height / 2 - 40, { width: doc.page.width, align: 'center' });
    doc.fillOpacity(1).restore();
  }

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
  if (data.gym.website) {
    doc.text(data.gym.website, PAGE.left, y, { width: 300 });
    y = doc.y + 1;
  }
  // NEW — GSTIN and PAN on one line when both are present
  const regLine = [data.gym.gst ? `GSTIN ${data.gym.gst}` : null, data.gym.pan ? `PAN ${data.gym.pan}` : null]
    .filter(Boolean)
    .join('   ·   ');
  if (regLine) {
    doc.text(regLine, PAGE.left, y, { width: 300 });
    y = doc.y;
  }

  const rightX = 355;
  const rightW = PAGE.right - rightX;
  // NEW — "TAX INVOICE" when GST-registered, plain "INVOICE" otherwise
  doc.font(font.bold).fontSize(20).fillColor(accent).text(
    data.gym.gst ? 'TAX INVOICE' : 'INVOICE',
    rightX, 38, { width: rightW, align: 'right' }
  );
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

  // NEW — small verification QR code, top-right, below the status badge
  if (qrBuffer) {
    const qrSize = 62;
    const qrY = doc.y + 10;
    doc.image(qrBuffer, PAGE.right - qrSize, qrY, { width: qrSize, height: qrSize });
    doc.font(font.regular).fontSize(6.5).fillColor('#9ca3af')
      .text('Scan to verify', PAGE.right - qrSize, qrY + qrSize + 2, { width: qrSize, align: 'center' });
    y = Math.max(y, qrY + qrSize + 12);
  }

  y = Math.max(y, doc.y) + 18;
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
    y += 10;
    doc.font(font.regular).fontSize(8.5).fillColor('#9ca3af');
    doc.text(
      `Paid via ${data.paymentMethod.replace('_', ' ').toUpperCase()}${data.transactionNumber ? `   ·   Ref: ${data.transactionNumber}` : ''}`,
      PAGE.left,
      y
    );
    y = doc.y;
  }

  // ── NEW: bottom block — amount in words, bank/UPI details, terms,
  // authorized signature, footer — kept together and page-break-safe via
  // ensureSpace() so it's never visually split across a page boundary.
  const bank = data.gym.bankDetails || {};
  const hasBankDetails = Boolean(bank.accountNumber || bank.upiId);
  const termsLines = data.gym.terms ? Math.ceil(data.gym.terms.length / 95) : 0;
  const estimatedBottomHeight = 40 + (hasBankDetails ? 70 : 0) + (termsLines ? 20 + termsLines * 11 : 0) + 60;

  y = ensureSpace(doc, y + 20, estimatedBottomHeight, accent);

  // Amount in words — a standard fixture on professional/tax invoices,
  // computed from the actual grand total so it can never drift from the
  // numeric total shown above.
  doc.moveTo(PAGE.left, y).lineTo(PAGE.right, y).strokeColor('#f0f1f3').stroke();
  y += 12;
  doc.font(font.bold).fontSize(7.5).fillColor('#9ca3af').text('AMOUNT IN WORDS', PAGE.left, y, { characterSpacing: 0.5 });
  y = doc.y + 2;
  doc.font(font.regular).fontSize(9).fillColor('#374151').text(
    amountToWords(data.grandTotal, data.gym.currencyWordsLabel || 'Rupees'),
    PAGE.left,
    y,
    { width: PAGE.width }
  );
  y = doc.y + 16;

  // Bank / UPI payment details (left) + authorized signature (right),
  // side by side — only drawn when the gym has actually configured any
  // payment details in Settings; otherwise this row is skipped entirely.
  const blockTop = y;
  if (hasBankDetails) {
    doc.font(font.bold).fontSize(7.5).fillColor('#9ca3af').text('PAYMENT DETAILS', PAGE.left, blockTop, { characterSpacing: 0.5 });
    let by = blockTop + 12;
    doc.font(font.regular).fontSize(8.5).fillColor('#374151');
    if (bank.accountHolderName) { doc.text(`Account Name: ${bank.accountHolderName}`, PAGE.left, by, { width: 260 }); by = doc.y + 2; }
    if (bank.bankName) { doc.text(`Bank: ${bank.bankName}`, PAGE.left, by, { width: 260 }); by = doc.y + 2; }
    if (bank.accountNumber) { doc.text(`Account No: ${bank.accountNumber}`, PAGE.left, by, { width: 260 }); by = doc.y + 2; }
    if (bank.ifscCode) { doc.text(`IFSC: ${bank.ifscCode}`, PAGE.left, by, { width: 260 }); by = doc.y + 2; }
    if (bank.upiId) { doc.text(`UPI ID: ${bank.upiId}`, PAGE.left, by, { width: 260 }); by = doc.y + 2; }
    y = Math.max(y, by);
  }

  // Authorized signature — right-aligned box with a signature line
  const sigW = 200;
  const sigX = PAGE.right - sigW;
  doc.font(font.regular).fontSize(8.5).fillColor('#9ca3af');
  doc.text('For ' + data.gym.name, sigX, blockTop, { width: sigW, align: 'right' });
  doc.moveTo(sigX + 40, blockTop + 48).lineTo(PAGE.right, blockTop + 48).strokeColor('#9ca3af').stroke();
  doc.text('Authorized Signatory', sigX, blockTop + 52, { width: sigW, align: 'right' });
  y = Math.max(y, blockTop + 66);

  // Terms & Conditions — from Settings.invoiceTerms; skipped entirely when unset.
  if (data.gym.terms) {
    y += 14;
    doc.moveTo(PAGE.left, y).lineTo(PAGE.right, y).strokeColor('#f0f1f3').stroke();
    y += 12;
    doc.font(font.bold).fontSize(7.5).fillColor('#9ca3af').text('TERMS & CONDITIONS', PAGE.left, y, { characterSpacing: 0.5 });
    y = doc.y + 3;
    doc.font(font.regular).fontSize(8).fillColor('#6b7280').text(data.gym.terms, PAGE.left, y, { width: PAGE.width });
    y = doc.y;
  }

  // ── Footer ────────────────────────────────────────────────────────────
  if (data.gym.footer) {
    y += 16;
    doc.moveTo(PAGE.left, y).lineTo(PAGE.right, y).strokeColor('#f0f1f3').stroke();
    doc.font(font.regular).fontSize(8.5).fillColor('#9ca3af').text(data.gym.footer, PAGE.left, y + 12, { width: PAGE.width, align: 'center' });
  }

  doc.end();
};

module.exports = { streamInvoicePdf };