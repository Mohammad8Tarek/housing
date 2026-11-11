// Calendar math in a given IANA time zone. When `timeZone` is omitted the
// runtime's local zone is used, i.e. exactly the browser's plain Date
// behaviour; the API passes the browser's zone to get the same answers.

function zoneOffsetMs(ts: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ts));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(ts / 1000) * 1000;
}

/** Like `new Date(y, m, d, h, mi, s, ms)` but in `timeZone` (local zone when omitted). */
export function wallClock(
  timeZone: string | undefined,
  y: number,
  m: number,
  d: number,
  h = 0,
  mi = 0,
  s = 0,
  ms = 0,
): Date {
  if (!timeZone) return new Date(y, m, d, h, mi, s, ms);
  const guess = Date.UTC(y, m, d, h, mi, s, ms);
  let ts = guess - zoneOffsetMs(guess, timeZone);
  ts = guess - zoneOffsetMs(ts, timeZone); // settle across DST changes
  return new Date(ts);
}

/** Wall-clock fields of `date` in `timeZone` (local zone when omitted). */
export function fieldsOf(date: Date, timeZone: string | undefined) {
  if (!timeZone) {
    return {
      y: date.getFullYear(), m: date.getMonth(), d: date.getDate(),
      h: date.getHours(), mi: date.getMinutes(), s: date.getSeconds(), ms: date.getMilliseconds(),
    };
  }
  const shifted = new Date(date.getTime() + zoneOffsetMs(date.getTime(), timeZone));
  return {
    y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate(),
    h: shifted.getUTCHours(), mi: shifted.getUTCMinutes(), s: shifted.getUTCSeconds(), ms: shifted.getUTCMilliseconds(),
  };
}

const ZONELESS_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?$/;

/** `new Date(value)`, except zone-less date-times are read in `timeZone`. */
export function parseDate(value: any, timeZone: string | undefined): Date {
  if (timeZone && typeof value === "string") {
    const m = ZONELESS_DATETIME.exec(value.trim());
    if (m) {
      return wallClock(
        timeZone, Number(m[1]), Number(m[2]) - 1, Number(m[3]),
        Number(m[4]), Number(m[5]), Number(m[6] ?? 0), Number((m[7] ?? "0").padEnd(3, "0")),
      );
    }
  }
  return new Date(value);
}


const WEEKDAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * The calendar day `offset` days after today (in `timeZone`), as the forecast
 * tables show it: ISO date, DD/MM/YYYY and weekday name.
 */
export function calendarDay(offset: number, ar: boolean, timeZone?: string) {
  const t = fieldsOf(new Date(), timeZone);
  const d = new Date(Date.UTC(t.y, t.m, t.d + offset));
  const y = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const wd = d.getUTCDay();
  return {
    iso: `${y}-${mm}-${dd}`,
    display: `${dd}/${mm}/${y}`,
    dayName: ar ? WEEKDAYS_AR[wd] : WEEKDAYS_EN[wd],
  };
}
