import type { CampaignDataSyncMetadata, WorldbuildingEntry } from '../types';
import { getDatabase, markCampaignDataChanged, WORLDBUILDING_STORE_NAME } from './brewStore';

export async function listWorldbuildingEntries(): Promise<WorldbuildingEntry[]> {
  const database = await getDatabase();
  const entries = await database.getAll(WORLDBUILDING_STORE_NAME) as WorldbuildingEntry[];
  return entries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function saveWorldbuildingEntry(entry: WorldbuildingEntry): Promise<CampaignDataSyncMetadata> {
  const database = await getDatabase();
  await database.put(WORLDBUILDING_STORE_NAME, entry);
  return markCampaignDataChanged();
}

export async function deleteWorldbuildingEntry(id: string): Promise<CampaignDataSyncMetadata> {
  const database = await getDatabase();
  await database.delete(WORLDBUILDING_STORE_NAME, id);
  return markCampaignDataChanged();
}
