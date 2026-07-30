import { openDB } from 'idb';
import type { CatalogueEntry, CustomCatalogueCategory } from '../catalogue/types';
import type { Brew, CampaignDataSnapshot, CampaignDataSyncMetadata, Encounter, LivingWorldData, PartyMember, PrivateMonsterSyncMetadata, WorldbuildingEntry, WorldbuildingType } from '../types';

const DATABASE_NAME = 'homebrewry';
const STORE_NAME = 'brews';
export const ASSET_STORE_NAME = 'assets';
export const ENCOUNTER_STORE_NAME = 'encounters';
export const PARTY_STORE_NAME = 'party-members';
export const WORLDBUILDING_STORE_NAME = 'worldbuilding';
export const CAMPAIGN_DATA_SYNC_STORE_NAME = 'campaign-data-sync';
export const PRIVATE_MONSTER_STORE_NAME = 'private-monsters';
export const PRIVATE_MONSTER_SYNC_STORE_NAME = 'private-monster-sync';
export const CUSTOM_CATALOGUE_STORE_NAME = 'custom-catalogue';
export const CUSTOM_CATALOGUE_CATEGORY_STORE_NAME = 'custom-catalogue-categories';
export const WORLDBUILDING_TYPE_STORE_NAME = 'worldbuilding-types';
export const LIVING_WORLD_STORE_NAME = 'living-world';

const starterContent = `# The Ashen Road

*A travel encounter for characters of 3rd level.*

## The road ahead

The old imperial road disappears beneath drifts of pale ash. At dusk, a bell rings once from the ruins ahead.

> ##### A warning in the wind
> The ash is warm. Any creature that spends an hour exposed to the open road notices faint whispers in a language it almost understands.

## Encounter: Ashbound scout

| Armor Class | Hit Points | Speed |
| --- | --- | --- |
| 14 (leather) | 27 (5d8 + 5) | 30 ft. |

### Tactics

The scout fires from cover, then offers a bargain: carry a sealed letter to the next settlement, or leave the road before nightfall.
`;

export const getDatabase = () =>
  openDB(DATABASE_NAME, 11, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
      if (oldVersion < 3) {
        const assets = database.createObjectStore(ASSET_STORE_NAME, { keyPath: 'id' });
        assets.createIndex('updatedAt', 'updatedAt');
      }
      if (oldVersion < 4) {
        const encounters = database.createObjectStore(ENCOUNTER_STORE_NAME, { keyPath: 'id' });
        encounters.createIndex('updatedAt', 'updatedAt');
        const party = database.createObjectStore(PARTY_STORE_NAME, { keyPath: 'id' });
        party.createIndex('updatedAt', 'updatedAt');
      }
      if (oldVersion < 5) {
        const worldbuilding = database.createObjectStore(WORLDBUILDING_STORE_NAME, { keyPath: 'id' });
        worldbuilding.createIndex('updatedAt', 'updatedAt');
      }
      if (oldVersion < 6) {
        database.createObjectStore(CAMPAIGN_DATA_SYNC_STORE_NAME, { keyPath: 'id' });
      }
      if (oldVersion < 7) {
        database.createObjectStore(PRIVATE_MONSTER_STORE_NAME, { keyPath: 'id' });
      }
      if (oldVersion < 8) {
        database.createObjectStore(CUSTOM_CATALOGUE_STORE_NAME, { keyPath: 'id' });
      }
      if (oldVersion < 9) {
        database.createObjectStore(PRIVATE_MONSTER_SYNC_STORE_NAME, { keyPath: 'id' });
      }
      if (oldVersion < 10) {
        database.createObjectStore(CUSTOM_CATALOGUE_CATEGORY_STORE_NAME, { keyPath: 'id' });
        database.createObjectStore(WORLDBUILDING_TYPE_STORE_NAME, { keyPath: 'id' });
      }
      if (oldVersion < 11) {
        database.createObjectStore(LIVING_WORLD_STORE_NAME, { keyPath: 'id' });
      }
    }
  });

export function createLivingWorldData(): LivingWorldData {
  return {
    id: 'living-world',
    campaignId: 'default-campaign',
    entities: [],
    entityReferences: [],
    worldEvents: [],
    timelineEntries: [],
    ideaDrafts: []
  };
}

export async function getLivingWorldData(): Promise<LivingWorldData> {
  const database = await getDatabase();
  const stored = await database.get(LIVING_WORLD_STORE_NAME, 'living-world') as LivingWorldData | undefined;
  return stored ? { ...stored, timelineEntries: stored.timelineEntries ?? [], ideaDrafts: stored.ideaDrafts ?? [] } : createLivingWorldData();
}

export async function saveLivingWorldData(data: LivingWorldData): Promise<CampaignDataSyncMetadata> {
  const database = await getDatabase();
  await database.put(LIVING_WORLD_STORE_NAME, data);
  return markCampaignDataChanged();
}

export function createBrew(title = 'Untitled Brew'): Brew {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title,
    content: starterContent,
    createdAt: now,
    createdOn: creationDeviceLabel(),
    updatedAt: now,
    version: 1,
    rendererSettings: {
      accentColor: '#7a2f27',
      parchmentTone: 'warm'
    }
  };
}

export function creationDeviceLabel(): string {
  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/iPhone/i.test(userAgent)) return 'iPhone';
  if (/iPad/i.test(userAgent)) return 'iPad';
  if (/Android/i.test(userAgent)) return 'Android device';
  if (/Windows/i.test(userAgent)) return 'Windows PC';
  if (/Macintosh|Mac OS/i.test(userAgent)) return 'Mac';
  if (/Linux/i.test(userAgent)) return 'Linux PC';
  return 'This device';
}

export async function listBrews(): Promise<Brew[]> {
  const database = await getDatabase();
  const brews = await database.getAll(STORE_NAME);

  return brews.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function seedBrews(): Promise<Brew[]> {
  const existing = await listBrews();
  if (existing.length > 0) return existing;

  const sample = createBrew('The Ashen Road');
  await saveBrew(sample);
  return [sample];
}

export async function saveBrew(brew: Brew): Promise<void> {
  const database = await getDatabase();
  await database.put(STORE_NAME, brew);
}

export async function replaceBrews(brews: Brew[]): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction(STORE_NAME, 'readwrite');

  await Promise.all(brews.map((brew) => transaction.store.put(brew)));
  await transaction.done;
}

export async function deleteBrew(id: string): Promise<void> {
  const database = await getDatabase();
  await database.delete(STORE_NAME, id);
}

export function createCampaignDataSyncMetadata(): CampaignDataSyncMetadata {
  return {
    id: 'campaign-data',
    lastLocalChangeAt: new Date().toISOString(),
    syncState: 'local'
  };
}

export async function getCampaignDataSyncMetadata(): Promise<CampaignDataSyncMetadata> {
  const database = await getDatabase();
  const stored = await database.get(CAMPAIGN_DATA_SYNC_STORE_NAME, 'campaign-data') as CampaignDataSyncMetadata | undefined;
  return stored ?? createCampaignDataSyncMetadata();
}

export async function saveCampaignDataSyncMetadata(metadata: CampaignDataSyncMetadata): Promise<void> {
  const database = await getDatabase();
  await database.put(CAMPAIGN_DATA_SYNC_STORE_NAME, metadata);
}

export async function markCampaignDataChanged(): Promise<CampaignDataSyncMetadata> {
  const current = await getCampaignDataSyncMetadata();
  const next: CampaignDataSyncMetadata = {
    ...current,
    lastLocalChangeAt: new Date().toISOString(),
    syncState: current.conflict ? 'conflict' : current.drive ? 'pending' : 'local'
  };
  await saveCampaignDataSyncMetadata(next);
  return next;
}

export function createPrivateMonsterSyncMetadata(): PrivateMonsterSyncMetadata {
  return {
    id: 'private-monster-catalogue',
    lastLocalChangeAt: new Date().toISOString(),
    syncState: 'local'
  };
}

export async function getPrivateMonsterSyncMetadata(): Promise<PrivateMonsterSyncMetadata> {
  const database = await getDatabase();
  const stored = await database.get(PRIVATE_MONSTER_SYNC_STORE_NAME, 'private-monster-catalogue') as PrivateMonsterSyncMetadata | undefined;
  return stored ?? createPrivateMonsterSyncMetadata();
}

export async function savePrivateMonsterSyncMetadata(metadata: PrivateMonsterSyncMetadata): Promise<void> {
  const database = await getDatabase();
  await database.put(PRIVATE_MONSTER_SYNC_STORE_NAME, metadata);
}

export async function markPrivateMonsterDataChanged(): Promise<PrivateMonsterSyncMetadata> {
  const current = await getPrivateMonsterSyncMetadata();
  const next: PrivateMonsterSyncMetadata = {
    ...current,
    lastLocalChangeAt: new Date().toISOString(),
    syncState: current.conflict ? 'conflict' : current.drive ? 'pending' : 'local'
  };
  await savePrivateMonsterSyncMetadata(next);
  return next;
}

export async function replaceCampaignData(
  snapshot: CampaignDataSnapshot,
  metadata: CampaignDataSyncMetadata
): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction(
    [
      ENCOUNTER_STORE_NAME,
      PARTY_STORE_NAME,
      WORLDBUILDING_STORE_NAME,
      CUSTOM_CATALOGUE_STORE_NAME,
      CUSTOM_CATALOGUE_CATEGORY_STORE_NAME,
      WORLDBUILDING_TYPE_STORE_NAME,
      LIVING_WORLD_STORE_NAME,
      CAMPAIGN_DATA_SYNC_STORE_NAME
    ],
    'readwrite'
  );
  const encounters = transaction.objectStore(ENCOUNTER_STORE_NAME);
  const partyMembers = transaction.objectStore(PARTY_STORE_NAME);
  const worldbuilding = transaction.objectStore(WORLDBUILDING_STORE_NAME);
  const customCatalogue = transaction.objectStore(CUSTOM_CATALOGUE_STORE_NAME);
  const customCatalogueCategories = transaction.objectStore(CUSTOM_CATALOGUE_CATEGORY_STORE_NAME);
  const worldbuildingTypes = transaction.objectStore(WORLDBUILDING_TYPE_STORE_NAME);
  const livingWorld = transaction.objectStore(LIVING_WORLD_STORE_NAME);
  const metadataStore = transaction.objectStore(CAMPAIGN_DATA_SYNC_STORE_NAME);

  await Promise.all([
    encounters.clear(),
    partyMembers.clear(),
    worldbuilding.clear(),
    customCatalogue.clear(),
    customCatalogueCategories.clear(),
    worldbuildingTypes.clear(),
    livingWorld.clear()
  ]);
  await Promise.all([
    ...snapshot.encounters.map((encounter: Encounter) => encounters.put(encounter)),
    ...snapshot.partyMembers.map((member: PartyMember) => partyMembers.put(member)),
    ...snapshot.worldbuildingEntries.map((entry: WorldbuildingEntry) => worldbuilding.put(entry)),
    ...snapshot.customCatalogueEntries.map((entry) => customCatalogue.put(entry)),
    ...snapshot.customCatalogueCategories.map((category: CustomCatalogueCategory) => customCatalogueCategories.put(category)),
    ...snapshot.worldbuildingTypes.map((type: WorldbuildingType) => worldbuildingTypes.put(type)),
    livingWorld.put({
      id: 'living-world',
      campaignId: snapshot.campaignId,
      entities: snapshot.entities,
      entityReferences: snapshot.entityReferences,
      worldEvents: snapshot.worldEvents,
      timelineEntries: snapshot.timelineEntries ?? [],
      ideaDrafts: snapshot.ideaDrafts ?? [],
      ...(snapshot.currentBrewId ? { currentBrewId: snapshot.currentBrewId } : {})
    } satisfies LivingWorldData),
    metadataStore.put(metadata)
  ]);
  await transaction.done;
}

/** Replaces the local private catalogue only after a validated Drive result. */
export async function replacePrivateMonsterData(
  entries: CatalogueEntry[],
  metadata: PrivateMonsterSyncMetadata
): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction(
    [PRIVATE_MONSTER_STORE_NAME, PRIVATE_MONSTER_SYNC_STORE_NAME],
    'readwrite'
  );
  const monsters = transaction.objectStore(PRIVATE_MONSTER_STORE_NAME);
  const metadataStore = transaction.objectStore(PRIVATE_MONSTER_SYNC_STORE_NAME);

  await monsters.clear();
  await Promise.all([
    ...entries.map((entry) => monsters.put(entry)),
    metadataStore.put(metadata)
  ]);
  await transaction.done;
}
