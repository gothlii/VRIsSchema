export function getIsoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function extractWeekNumber(label: string): number | null {
  const m = label.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

export function inferIsoWeekYear(weekNumber: number, now = new Date()): number {
  const currentYear = now.getFullYear();
  const currentWeek = getIsoWeek(now);
  const diff = weekNumber - currentWeek;

  if (diff > 26) return currentYear - 1;
  if (diff < -26) return currentYear + 1;
  return currentYear;
}

export function compareWeekLabels(aLabel: string, bLabel: string, now = new Date()): number {
  const aWeek = extractWeekNumber(aLabel);
  const bWeek = extractWeekNumber(bLabel);

  if (aWeek === null || bWeek === null) return aLabel.localeCompare(bLabel, "sv");

  const aYear = inferIsoWeekYear(aWeek, now);
  const bYear = inferIsoWeekYear(bWeek, now);

  if (aYear !== bYear) return aYear - bYear;
  return aWeek - bWeek;
}

function getIsoWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (week - 1) * 7);
  return monday;
}

export function getWeekDateLabels(weekLabel: string, dayCount: number, now = new Date()): string[] {
  const weekNumber = extractWeekNumber(weekLabel);
  if (weekNumber === null) {
    return Array.from({ length: dayCount }, () => "");
  }

  const year = inferIsoWeekYear(weekNumber, now);
  const monday = getIsoWeekMonday(year, weekNumber);

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
  });
}
