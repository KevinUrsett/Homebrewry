import type { WorldbuildingEntry } from '../types';
import { getDatabase, WORLDBUILDING_STORE_NAME } from './brewStore';

export async function listWorldbuildingEntries(): Promise<WorldbuildingEntry[]> {
  const database = await getDatabase();
  const entries = await database.getAll(WORLDBUILDING_STORE_NAME) as WorldbuildingEntry[];
  return entries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function saveWorldbuildingEntry(entry: WorldbuildingEntry): Promise<void> {
  const database = await getDatabase();
  await database.put(WORLDBUILDING_STORE_NAME, entry);
}

export async function deleteWorldbuildingEntry(id: string): Promise<void> {
  const database = await getDatabase();
  await database.delete(WORLDBUILDING_STORE_NAME, id);
}
