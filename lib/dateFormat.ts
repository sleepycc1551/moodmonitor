const DATE_LOCALE = "en-US";

function asDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLongDate(value: string | Date): string {
  const date = asDate(value);
  if (!date) return "Date not available";

  return date.toLocaleDateString(DATE_LOCALE, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatShortDate(value: string | Date): string {
  const date = asDate(value);
  if (!date) return "Date not available";

  return date.toLocaleDateString(DATE_LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatChartDate(value: string | Date): string {
  const date = asDate(value);
  if (!date) return "N/A";

  return date.toLocaleDateString(DATE_LOCALE, {
    month: "short",
    day: "numeric",
  });
}

export function formatTime(value: string | Date): string {
  const date = asDate(value);
  if (!date) return "Time not available";

  return date.toLocaleTimeString(DATE_LOCALE, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateTime(value: string | Date): string {
  const date = asDate(value);
  if (!date) return "Date not available";

  return date.toLocaleString(DATE_LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
