const Settings = require('../models/Settings');

/**
 * Atomically increments a named counter on the Settings singleton and returns
 * a zero-padded, prefixed ID, e.g. generateId('memberIdPrefix', 'lastMemberSequence') -> "GYM007"
 */
const generateSequentialId = async (prefixField, counterField, pad = 3) => {
  const settings = await Settings.findOneAndUpdate(
    {},
    { $inc: { [counterField]: 1 } },
    { new: true, upsert: true }
  );
  const seq = settings[counterField];
  const prefix = settings[prefixField] || '';
  return `${prefix}${String(seq).padStart(pad, '0')}`;
};

const generateMemberId = () => generateSequentialId('memberIdPrefix', 'lastMemberSequence', 3);

// Independent counters for other entities (not tied to the gym's member prefix)
const Counter = require('../models/Counter');

const generateEntityId = async (name, prefix, pad = 3) => {
  const counter = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${prefix}${String(counter.seq).padStart(pad, '0')}`;
};

module.exports = { generateMemberId, generateEntityId };
