import type { Brew } from '../types';
import { listCustomCatalogueCategories, listCustomCatalogueEntries } from './customCatalogueStore';
import { getCampaignDataSyncMetadata, getLivingWorldData, replaceCampaignData, saveCampaignDataSyncMetadata } from './brewStore';
import { createCampaignDataSnapshot } from './campaignData';
import { syncCampaignData, type CampaignDataSyncResult } from './campaignSync';
import { listEncounters, listPartyMembers } from './encounterStore';
import { listWorldbuildingEntries, listWorldbuildingTypes } from './worldbuildingStore';

/**
 * Refreshes the shared campaign companion file before the workspace opens.
 * This keeps encounters and their equipment aligned with the Drive copy on
 * every device instead of briefly rendering a stale IndexedDB snapshot.
 */
export async function refreshCampaignDataFromDrive(
  accessToken: string,
  brews: Brew[]
): Promise<CampaignDataSyncResult> {
  const [
    encounters,
    partyMembers,
    worldbuildingEntries,
    customCatalogueEntries,
    customCatalogueCategories,
    worldbuildingTypes,
    livingWorld,
    metadata
  ] = await Promise.all([
    listEncounters(),
    listPartyMembers(),
    listWorldbuildingEntries(),
    listCustomCatalogueEntries(),
    listCustomCatalogueCategories(),
    listWorldbuildingTypes(),
    getLivingWorldData(),
    getCampaignDataSyncMetadata()
  ]);

  const localData = createCampaignDataSnapshot(
    encounters,
    partyMembers,
    worldbuildingEntries,
    undefined,
    customCatalogueEntries,
    customCatalogueCategories,
    worldbuildingTypes,
    brews,
    livingWorld
  );
  const result = await syncCampaignData(accessToken, localData, metadata);

  if (result.data === localData) {
    await saveCampaignDataSyncMetadata(result.metadata);
  } else {
    await replaceCampaignData(result.data, result.metadata);
  }

  return result;
}
