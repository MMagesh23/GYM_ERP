const fs = require('fs');
const path = require('path');

// FIX: PDFKit's built-in standard fonts (Helvetica, Helvetica-Bold, etc.) use
// WinAnsi encoding, which does NOT contain the ₹ (Indian Rupee Sign, U+20B9)
// glyph — or most other non-Latin-1 characters. Since Settings.currencySymbol
// defaults to '₹', every generated invoice and profit-report PDF was rendering
// a missing-glyph tofu box (or throwing, depending on the PDFKit version)
// instead of the rupee sign.
//
// Fix: embed a Unicode TTF (Noto Sans) and register it under names that mirror
// the standard font names, so existing calls like
// `doc.font('Helvetica-Bold')` keep working — call registerFonts(doc) once per
// document, then use the returned font names.
//
// Falls back to the original standard fonts (with a console.warn) if the font
// files aren't present, so this never hard-crashes an install that hasn't
// pulled the assets/fonts directory for some reason.

const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const REGULAR_PATH = path.join(FONT_DIR, 'NotoSans-Regular.ttf');
const BOLD_PATH = path.join(FONT_DIR, 'NotoSans-Bold.ttf');

let fontsAvailable = null; // memoized after first check
const checkFontsAvailable = () => {
  if (fontsAvailable === null) {
    fontsAvailable = fs.existsSync(REGULAR_PATH) && fs.existsSync(BOLD_PATH);
    if (!fontsAvailable) {
      console.warn(
        `[pdfFonts] Noto Sans font files not found in ${FONT_DIR} — falling back to PDFKit's ` +
          'built-in Helvetica, which cannot render the ₹ symbol or other non-Latin-1 characters.'
      );
    }
  }
  return fontsAvailable;
};

/**
 * Registers Unicode fonts on a PDFDocument and returns the font-name constants
 * to use in place of 'Helvetica' / 'Helvetica-Bold'.
 * @param {PDFKit.PDFDocument} doc
 * @returns {{ regular: string, bold: string }}
 */
const registerFonts = (doc) => {
  if (checkFontsAvailable()) {
    doc.registerFont('Body', REGULAR_PATH);
    doc.registerFont('Body-Bold', BOLD_PATH);
    return { regular: 'Body', bold: 'Body-Bold' };
  }
  return { regular: 'Helvetica', bold: 'Helvetica-Bold' };
};

module.exports = { registerFonts };