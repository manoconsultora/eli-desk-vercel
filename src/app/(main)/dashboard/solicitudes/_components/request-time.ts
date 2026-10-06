const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// A request is NEW during its first 24 hours.
export function isNewRequest(createdAt: string, now: number) {
  return now - new Date(createdAt).getTime() < DAY;
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function requestedAgo(createdAt: string, now: number) {
  const elapsed = Math.max(0, now - new Date(createdAt).getTime());
  if (elapsed < MINUTE) return "hace instantes";
  if (elapsed < HOUR) return `hace ${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < DAY) return `hace ${plural(Math.floor(elapsed / HOUR), "hora", "horas")}`;
  return `hace ${plural(Math.floor(elapsed / DAY), "día", "días")}`;
}
