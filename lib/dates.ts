export const DAY = 86400000;
export const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function sod(d: Date | number) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
// "2026-11-23" is a local calendar day; "2026-11-27T06:00:00" (no zone) is local time; with Z it's an instant.
export function parseDue(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
  return new Date(s);
}
export function dayDiff(d: Date, now = new Date()) { return Math.round((sod(d).getTime() - sod(now).getTime()) / DAY); }
export function fmt(d: Date) { return d.getDate() + " " + MON[d.getMonth()]; }
export function relDue(d: Date, now = new Date()) {
  const n = dayDiff(d, now);
  if (n < 0) return `${-n}d overdue`;
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n < 7) return WD[d.getDay()].slice(0, 3);
  return fmt(d);
}
export function isoDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
