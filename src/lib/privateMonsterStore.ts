import type { CatalogueEntry } from '../catalogue/types';
import { getDatabase, PRIVATE_MONSTER_STORE_NAME } from './brewStore';

function isPrivateMonster(entry: CatalogueEntry): boolean {
  return entry.category === 'monster' && (entry.source === 'Private import' || entry.source === 'SRD-521 (private import)');
}

export async function listPrivateMonsterEntries(): Promise<CatalogueEntry[]> {
  const database = await getDatabase();
  const entries = await database.getAll(PRIVATE_MONSTER_STORE_NAME) as CatalogueEntry[];
  return entries
    .filter(isPrivateMonster)
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Replaces only the device-local private catalogue. This store is never
 * included in Drive sync, which keeps user-supplied content out of the public
 * repository and separate from brew documents.
 */
export async function replacePrivateMonsterEntries(entries: CatalogueEntry[]): Promise<void> {
  if (entries.some((entry) => !isPrivateMonster(entry))) {
    throw new Error('Only normalized private monster entries can be stored here.');
  }
  const database = await getDatabase();
  const transaction = database.transaction(PRIVATE_MONSTER_STORE_NAME, 'readwrite');
  await transaction.store.clear();
  await Promise.all(entries.map((entry) => transaction.store.put(entry)));
  await transaction.done;
}

export async function clearPrivateMonsterEntries(): Promise<void> {
  const database = await getDatabase();
  await database.clear(PRIVATE_MONSTER_STORE_NAME);
}
