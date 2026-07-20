/**
 * Builds a Mongoose-compatible sort object from user-supplied sortBy/sortDir,
 * restricted to a whitelist so a request can't sort on an arbitrary/unindexed
 * field (or one that shouldn't be sortable at all, e.g. a sensitive field).
 *
 * @param {string|undefined} sortBy - requested field name
 * @param {string|undefined} sortDir - 'asc' | 'desc' (anything else defaults to desc)
 * @param {string[]} allowedFields - whitelist of sortable field names for this list endpoint
 * @param {object} defaultSort - fallback sort object, e.g. { createdAt: -1 }
 */
const buildSort = (sortBy, sortDir, allowedFields, defaultSort) => {
  if (!sortBy || !allowedFields.includes(sortBy)) return defaultSort;
  return { [sortBy]: sortDir === 'asc' ? 1 : -1 };
};

module.exports = { buildSort };