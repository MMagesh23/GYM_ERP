// Converts a currency amount into words using the Indian numbering system
// (Crore/Lakh/Thousand) — the app's default currency is INR — for the
// "Amount in Words" line on professional invoices. Kept as its own small,
// dependency-free utility rather than pulling in a number-to-words package
// for one line of text.

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigits = (n) => {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${TENS[tens]}${ones ? ' ' + ONES[ones] : ''}`;
};

const threeDigits = (n) => {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  let out = '';
  if (hundred) out += `${ONES[hundred]} Hundred${rest ? ' ' : ''}`;
  if (rest) out += twoDigits(rest);
  return out;
};

// Indian grouping: ...Crore (10,000,000) / Lakh (100,000) / Thousand / Hundred
const numberToIndianWords = (num) => {
  num = Math.floor(Math.max(num, 0));
  if (num === 0) return 'Zero';

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundred = num;

  const parts = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));

  return parts.join(' ').trim();
};

/**
 * @param {number} amount
 * @param {string} currencyLabel - e.g. 'Rupees', 'Dollars'
 * @returns {string} e.g. "Rupees Twelve Thousand Five Hundred and Fifty Paise Only"
 */
const amountToWords = (amount, currencyLabel = 'Rupees') => {
  const value = Math.max(Number(amount) || 0, 0);
  const rupees = Math.floor(value);
  const paise = Math.round((value - rupees) * 100);

  let words = `${currencyLabel} ${numberToIndianWords(rupees)}`;
  if (paise > 0) words += ` and ${twoDigits(paise)} Paise`;
  return `${words} Only`;
};

module.exports = { amountToWords, numberToIndianWords };