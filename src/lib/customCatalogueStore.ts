import type { CampaignDataSyncMetadata } from '../types';
import type { CustomCatalogueEntry } from '../catalogue/types';
import { CUSTOM_CATALOGUE_STORE_NAME, getDatabase, markCampaignDataChanged } from './brewStore';

function isCustomCatalogueEntry(entry: CustomCatalogueEntry): boolean {
  return entry.source === 'Custom';
}

export async function listCustomCatalogueEntries(): Promise<CustomCatalogueEntry[]> {
  const database = await getDatabase();
  const entries = await database.getAll(CUSTOM_CATALOGUE_STORE_NAME) as CustomCatalogueEntry[];
  return entries
    .filter(isCustomCatalogueEntry)
    .sort((left, right) => left.category.localeCompare(right.category) || left.name.localeCompare(right.name));
}

export async function saveCustomCatalogueEntry(entry: CustomCatalogueEntry): Promise<CampaignDataSyncMetadata> {
  if (!isCustomCatalogueEntry(entry)) throw new Error('Only custom catalogue entries can be stored here.');
  const database = await getDatabase();
  await database.put(CUSTOM_CATALOGUE_STORE_NAME, entry);
  return markCampaignDataChanged();
}
