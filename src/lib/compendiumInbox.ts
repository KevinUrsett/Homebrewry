import { normaliseCustomCatalogueEntry } from '../catalogue/customEntries';
import type { CustomCatalogueEntry } from '../catalogue/types';

export const COMPENDIUM_INBOX_SHEET_ID = '1AGRX3zO6Fh5M3bOR34K9EhgiaoPjMgQiUTBScgIDobc';

/** Read the user's private, dedicated Compendium inbox; never evaluate its contents. */
export async function readCompendiumInbox(token: string): Promise<CustomCatalogueEntry[]> {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' +
    encodeURIComponent(COMPENDIUM_INBOX_SHEET_ID) + '/values/Entries!A2:E500';
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Compendium inbox could not be read (HTTP ${response.status}). Reconnect Google Drive if permission is missing.`);
  const payload: unknown = await response.json();
  const data = payload as { values?: unknown };
  if (!Array.isArray(data.values)) return [];
  const results: CustomCatalogueEntry[] = [];
  const seen = new Set<string>();
  for (const row of data.values) {
    if (!Array.isArray(row) || row.length < 4) continue;
    const [id, category, name, json] = row;
    if ([id, category, name, json].some((v) => typeof v !== 'string')) continue;
    if (!id || !category || !name || !json) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(json); } catch { throw new Error(`Invalid JSON in inbox entry "${name}".`); }
    const raw = parsed as Record<string, unknown>;
    const entry = normaliseCustomCatalogueEntry({
      ...raw,
      id,
      category,
      name,
      source: 'Custom',
      createdAt: raw.createdAt ?? new Date().toISOString(),
      updatedAt: raw.updatedAt ?? new Date().toISOString(),
      version: raw.version ?? 1
    });
    if (seen.has(entry.id)) throw new Error(`Duplicate inbox ID: ${entry.id}`);
    seen.add(entry.id);
    results.push(entry);
  }
  return results;
}
