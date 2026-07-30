// Single source of truth for "membership expiry" date/timezone math, used by
// the dashboard, membershipController.expiringSoon, memberController's
// expiry filter, and (going forward) reports/communication features — so
// none of them can ever disagree about what "expiring in N days" means.
//
// Everything here is evaluated against the GYM'S configured business
// timezone (Settings.timeZone, e.g. 'Asia/Kolkata'), not the server's OS
// timezone. A server running in UTC and a gym operating in +5:30 must agree
// on when "today" starts, or a membership expiring at 11pm local time could
// silently disappear from (or wrongly appear in) the list depending on the
// server's clock.

const DAY_MS = 24 * 60 * 60 * 1000;

// Returns the UTC instant corresponding to local midnight (00:00:00) of
// `date`, evaluated in `timeZone`.
const startOfDayInTimezone = (date, timeZone) => {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(date).reduce((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = parseInt(p.value, 10);
      return acc;
    }, {});
    // Some ICU implementations report midnight as hour '24' — normalize.
    const hour = parts.hour === 24 ? 0 : parts.hour;
    const asIfUTC = Date.UTC(parts.year, parts.month - 1, parts.day, hour, parts.minute, parts.second);
    const offsetMs = asIfUTC - date.getTime();
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0) - offsetMs);
  } catch (err) {
    // Invalid/unsupported timeZone string in Settings — fall back to
    // server-local midnight rather than crashing the dashboard.
    const fallback = new Date(date);
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
};

const daysBetween = (laterDate, earlierDate) =>
  Math.round((laterDate.getTime() - earlierDate.getTime()) / DAY_MS);

/**
 * Inclusive expiry window: today through `days` days from now, both ends
 * inclusive (so days=7 includes something expiring exactly 7 days out).
 * @returns {{ todayStart: Date, windowEnd: Date }} windowEnd is EXCLUSIVE
 *          (one full day past the inclusive last day) for use with `$lt`.
 */
const getExpiryWindow = (timeZone, days = 7, now = new Date()) => {
  const todayStart = startOfDayInTimezone(now, timeZone);
  const windowEnd = new Date(todayStart.getTime() + (days + 1) * DAY_MS);
  return { todayStart, windowEnd };
};

/**
 * Calendar-day difference (in the gym's timezone) between a membership's
 * endDate and "today". 0 = expires today, negative = already expired.
 */
const calcDaysRemaining = (endDate, timeZone, now = new Date()) => {
  const todayStart = startOfDayInTimezone(now, timeZone);
  const endStart = startOfDayInTimezone(new Date(endDate), timeZone);
  return daysBetween(endStart, todayStart);
};

// Maps daysRemaining to the badge key used consistently across the UI.
const expiryStatusLabel = (daysRemaining) => {
  if (daysRemaining <= 0) return 'expires_today';
  if (daysRemaining === 1) return '1_day_left';
  if (daysRemaining <= 3) return '2_3_days_left';
  return '4_7_days_left';
};

module.exports = {
  DAY_MS,
  startOfDayInTimezone,
  getExpiryWindow,
  calcDaysRemaining,
  expiryStatusLabel,
};