const PDFDocument = require('pdfkit');
const { registerFonts } = require('./pdfFonts');

/**
 * Streams a formatted invoice PDF directly to an Express response.
 * @param {import('express').Response} res
 * @param {{
 *   invoiceNumber: string,
 *   issuedDate: Date,
 *   gym: { name: string, address?: string, contact?: string, email?: string, gst?: string, footer?: string, currency?: string },
 *   member: { memberId: string, name: string, phone?: string, email?: string },
 *   lineItems: Array<{ description: string, quantity?: number, unitPrice: number, amount: number }>,
 *   subTotal: number, discount?: number, tax?: number, grandTotal: number,
 *   paymentMethod?: string, transactionNumber?: string,
 * }} data
 */
const streamInvoicePdf = (res, data) => {
  const currency = data.gym.currency || '₹';
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  // FIX: register a Unicode font (Noto Sans) so `currency` (₹ by default) and any
  // other non-Latin-1 characters render correctly instead of a missing-glyph box.
  const font = registerFonts(doc);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${data.invoiceNumber}.pdf"`);
  doc.pipe(res);

  // Header
  doc.fontSize(20).font(font.bold).text(data.gym.name, { continued: false });
  doc.fontSize(9).font(font.regular).fillColor('#555');
  if (data.gym.address) doc.text(data.gym.address);
  const contactLine = [data.gym.contact, data.gym.email].filter(Boolean).join('  ·  ');
  if (contactLine) doc.text(contactLine);
  if (data.gym.gst) doc.text(`GSTIN: ${data.gym.gst}`);
  doc.fillColor('#000');

  doc.moveDown(1.5);
  doc.fontSize(16).font(font.bold).text('INVOICE', { align: 'right' });
  doc.fontSize(10).font(font.regular).text(`Invoice #: ${data.invoiceNumber}`, { align: 'right' });
  doc.text(`Date: ${new Date(data.issuedDate).toLocaleDateString()}`, { align: 'right' });

  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ddd').stroke();
  doc.moveDown(0.8);

  // Bill to
  doc.fontSize(10).font(font.bold).text('Billed to');
  doc.font(font.regular).fontSize(10);
  doc.text(data.member.name);
  doc.text(`Member ID: ${data.member.memberId}`);
  if (data.member.phone) doc.text(data.member.phone);
  if (data.member.email) doc.text(data.member.email);

  doc.moveDown(1.2);

  // Line items table
  const tableTop = doc.y;
  const col = { desc: 50, qty: 330, price: 390, amount: 470 };

  doc.font(font.bold).fontSize(10);
  doc.text('Description', col.desc, tableTop);
  doc.text('Qty', col.qty, tableTop);
  doc.text('Price', col.price, tableTop);
  doc.text('Amount', col.amount, tableTop);
  doc.moveTo(50, tableTop + 16).lineTo(545, tableTop + 16).strokeColor('#ddd').stroke();

  let y = tableTop + 24;
  doc.font(font.regular).fontSize(10);
  data.lineItems.forEach((item) => {
    doc.text(item.description, col.desc, y, { width: 260 });
    doc.text(String(item.quantity || 1), col.qty, y);
    doc.text(`${currency}${item.unitPrice.toFixed(2)}`, col.price, y);
    doc.text(`${currency}${item.amount.toFixed(2)}`, col.amount, y);
    y += 20;
  });

  doc.moveTo(50, y + 4).lineTo(545, y + 4).strokeColor('#ddd').stroke();
  y += 16;

  const totalsRow = (label, value, bold = false) => {
    doc.font(bold ? font.bold : font.regular).fontSize(10);
    doc.text(label, col.price - 60, y, { width: 100, align: 'right' });
    doc.text(`${currency}${value.toFixed(2)}`, col.amount, y);
    y += 18;
  };

  totalsRow('Subtotal', data.subTotal);
  if (data.discount) totalsRow('Discount', -data.discount);
  if (data.tax) totalsRow('Tax', data.tax);
  totalsRow('Total', data.grandTotal, true);

  if (data.paymentMethod) {
    doc.moveDown(1);
    doc.font(font.regular).fontSize(9).fillColor('#555');
    doc.text(`Payment method: ${data.paymentMethod.replace('_', ' ').toUpperCase()}`, 50, y + 10);
    if (data.transactionNumber) doc.text(`Transaction ref: ${data.transactionNumber}`, 50, y + 24);
  }

  if (data.gym.footer) {
    doc.fontSize(9).fillColor('#888').text(data.gym.footer, 50, 760, { width: 495, align: 'center' });
  }

  doc.end();
};

module.exports = { streamInvoicePdf };