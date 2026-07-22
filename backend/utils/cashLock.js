const CashClosing = require('../models/CashClosing');
const ApiError = require('./ApiError');

/**
 * Throws if `date` falls on a day whose cash drawer has already been closed —
 * editing/deleting/backdating a financial record into a closed day would
 * silently desync it from the locked CashClosing snapshot for that day.
 * Admins may override (the closed snapshot itself is never touched by this;
 * it just stops matching reality until someone re-closes or reopens the day),
 * but the override is always audit-logged by the caller.
 *
 * @param {Date|string} date
 * @param {{ isAdmin?: boolean }} opts
 * @returns {Promise<import('../models/CashClosing')|null>} the closing doc if the day is locked, else null
 */
const assertDateEditable = async (date, { isAdmin = false } = {}) => {
  if (!date) return null;
  const dayStart = CashClosing.normalizeDate(new Date(date));
  const closing = await CashClosing.findOne({ date: dayStart, status: 'closed' });
  if (closing && !isAdmin) {
    throw new ApiError(
      409,
      `${dayStart.toDateString()} has already been closed for cash reconciliation. ` +
        'This record can no longer be created, edited, or deleted here — ask an admin to reopen the day first.'
    );
  }
  return closing;
};

module.exports = { assertDateEditable };