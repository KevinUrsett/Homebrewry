import type { CampaignDataSyncMetadata, WorldbuildingEntry, WorldbuildingType } from '../types';
import { getDatabase, markCampaignDataChanged, WORLDBUILDING_STORE_NAME, WORLDBUILDING_TYPE_STORE_NAME } from './brewStore';

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

export async function saveWorldbuildingEntries(entries: readonly WorldbuildingEntry[]): Promise<CampaignDataSyncMetadata> {
  const database = await getDatabase();
  const transaction = database.transaction(WORLDBUILDING_STORE_NAME, 'readwrite');
  await Promise.all(entries.map((entry) => transaction.store.put(entry)));
  await transaction.done;
  return markCampaignDataChanged();
}

export async function deleteWorldbuildingEntry(id: string): Promise<CampaignDataSyncMetadata> {
  const database = await getDatabase();
  await database.delete(WORLDBUILDING_STORE_NAME, id);
  return markCampaignDataChanged();
}

export async function listWorldbuildingTypes(): Promise<WorldbuildingType[]> {
  const database = await getDatabase();
  const types = await database.getAll(WORLDBUILDING_TYPE_STORE_NAME) as WorldbuildingType[];
  return types.sort((left, right) => left.name.localeCompare(right.name));
}

export async function saveWorldbuildingType(type: WorldbuildingType): Promise<CampaignDataSyncMetadata> {
  const database = await getDatabase();
  await database.put(WORLDBUILDING_TYPE_STORE_NAME, type);
  return markCampaignDataChanged();
}
