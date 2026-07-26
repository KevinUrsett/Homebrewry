import type { CampaignDataSyncMetadata } from '../types';
import type { CustomCatalogueCategory, CustomCatalogueEntry } from '../catalogue/types';
import { normaliseCustomCatalogueEntry } from '../catalogue/customEntries';
import {
  CUSTOM_CATALOGUE_CATEGORY_STORE_NAME,
  CUSTOM_CATALOGUE_STORE_NAME,
  getDatabase,
  markCampaignDataChanged
} from './brewStore';

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

export async function saveCustomCatalogueEntry(entry: CustomCatalogueEntry): Promise<{ entry: CustomCatalogueEntry; metadata: CampaignDataSyncMetadata }> {
  if (!isCustomCatalogueEntry(entry)) throw new Error('Only custom catalogue entries can be stored here.');
  const normalized = normaliseCustomCatalogueEntry(entry);
  const database = await getDatabase();
  await database.put(CUSTOM_CATALOGUE_STORE_NAME, normalized);
  return { entry: normalized, metadata: await markCampaignDataChanged() };
}

export async function deleteCustomCatalogueEntry(id: string): Promise<CampaignDataSyncMetadata> {
  const database = await getDatabase();
  await database.delete(CUSTOM_CATALOGUE_STORE_NAME, id);
  return markCampaignDataChanged();
}

export async function listCustomCatalogueCategories(): Promise<CustomCatalogueCategory[]> {
  const database = await getDatabase();
  const categories = await database.getAll(CUSTOM_CATALOGUE_CATEGORY_STORE_NAME) as CustomCatalogueCategory[];
  return categories.sort((left, right) => left.name.localeCompare(right.name));
}

export async function saveCustomCatalogueCategory(category: CustomCatalogueCategory): Promise<CampaignDataSyncMetadata> {
  const database = await getDatabase();
  await database.put(CUSTOM_CATALOGUE_CATEGORY_STORE_NAME, category);
  return markCampaignDataChanged();
}
