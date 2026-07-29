import type { BelentorDate, BelentorMonth } from '../types';

export const belentorMonths: readonly { name: BelentorMonth; star?: string }[] = [
  { name: 'Quen' },
  { name: 'Incan', star: 'Amarielle' },
  { name: 'Abjar', star: 'Etoilien Ardienne' },
  { name: 'Methyl Melt' },
  { name: 'Illin', star: 'Miralune Pectra' },
  { name: 'Evao', star: 'Flambelle Avedentri' },
  { name: 'Eryl' },
  { name: 'Conjun', star: 'Luminaire Saphira' },
  { name: 'Din', star: 'Orelia Voyante' },
  { name: 'Albedo Perigee' },
  { name: 'Unri', star: 'Noctara Ombrelle' },
  { name: 'Trin', star: 'Transmutia Evoline' }
];

const monthNames = new Set<string>(belentorMonths.map(({ name }) => name));

export function isBelentorDate(value: unknown): value is BelentorDate {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const date = value as Record<string, unknown>;
  return (date.era === 'BA' || date.era === 'AA')
    && typeof date.year === 'number' && Number.isInteger(date.year) && date.year >= 0
    && typeof date.month === 'string' && monthNames.has(date.month)
    && typeof date.day === 'number' && Number.isInteger(date.day) && date.day >= 1 && date.day <= 30;
}

export function formatBelentorDate(date: BelentorDate): string {
  return `${date.day} ${date.month} ${date.year} ${date.era}`;
}

/** Converts the shared 12-month, 30-day Belentor calendar into a sortable point around Ascension. */
export function belentorDateValue(date: BelentorDate): number {
  const month = belentorMonths.findIndex(({ name }) => name === date.month);
  const withinYear = month * 30 + date.day;
  return date.era === 'AA' ? date.year * 360 + withinYear : -(date.year * 360 + withinYear);
}

export function compareBelentorDates(left: BelentorDate, right: BelentorDate): number {
  return belentorDateValue(left) - belentorDateValue(right);
}
