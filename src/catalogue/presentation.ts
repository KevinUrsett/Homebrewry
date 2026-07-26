import type { CatalogueEntry } from './types';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function dataString(entry: CatalogueEntry, key: string): string | undefined {
  const value = entry.data[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

export function dataRecord(entry: CatalogueEntry, key: string): Record<string, unknown> {
  const value = entry.data[key];
  return isRecord(value) ? value : {};
}

export function dataRecords(entry: CatalogueEntry, key: string): Record<string, unknown>[] {
  const value = entry.data[key];
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function cataloguePlainText(value: string, limit?: number): string {
  const normalized = value
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!limit || normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

export function entrySummary(entry: CatalogueEntry): string[] {
  if (entry.category === 'monster') {
    const identity = [dataString(entry, 'size'), dataString(entry, 'type'), dataString(entry, 'alignment')].filter(Boolean).join(' ');
    const combat = [
      dataString(entry, 'ac') && `AC ${dataString(entry, 'ac')}`,
      dataString(entry, 'hp') && `HP ${dataString(entry, 'hp')}`,
      dataString(entry, 'cr') && `CR ${dataString(entry, 'cr')}`
    ].filter(Boolean).join(' · ');
    return [identity, combat].filter(Boolean);
  }

  if (entry.category === 'spell') {
    const level = Number(dataString(entry, 'level') ?? 0);
    const spellLevel = level === 0 ? 'Cantrip' : `Level ${level}`;
    const school = dataString(entry, 'school');
    const range = dataString(entry, 'range');
    const rangeUnits = dataString(entry, 'rangeUnits');
    return [[spellLevel, school].filter(Boolean).join(' · '), range ? `Range ${range} ${rangeUnits ?? ''}`.trim() : ''].filter(Boolean);
  }

  if (entry.category === 'item') {
    const type = dataString(entry, 'type');
    const value = dataString(entry, 'value');
    const weight = dataString(entry, 'weight');
    return [[type, value && `${value} GP`, weight && `${weight} lb.`].filter(Boolean).join(' · ')].filter(Boolean);
  }

  if (entry.category === 'class') {
    const hitDie = dataString(entry, 'hd');
    return [hitDie ? `Hit Die d${hitDie}` : ''];
  }

  if (entry.category === 'subclass') {
    const className = dataString(entry, 'class')?.split('|')[0];
    return [className ? `${className} subclass` : ''];
  }

  if (entry.category === 'feat') return [dataString(entry, 'prerequisite') ?? dataString(entry, 'category') ?? ''];
  if (entry.category === 'rule') return [entry.type ?? 'Rule'];
  if (entry.category === 'table') return [entry.columns?.length ? `${entry.columns.length} columns · ${entry.rows?.length ?? 0} rows` : ''];
  return [];
}

export function speedText(entry: CatalogueEntry): string {
  const speed = dataRecord(entry, 'speed');
  const simpleSpeed = entry.data.speed;
  if (typeof simpleSpeed === 'string' || typeof simpleSpeed === 'number') return String(simpleSpeed);
  const entries = Object.entries(speed).flatMap(([kind, value]) => typeof value === 'number' ? [`${kind} ${value} ft.`] : []);
  return entries.join(', ');
}
