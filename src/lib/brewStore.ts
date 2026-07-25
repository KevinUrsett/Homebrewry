import { openDB } from 'idb';
import type { Brew } from '../types';

const DATABASE_NAME = 'homebrewry';
const STORE_NAME = 'brews';
export const ASSET_STORE_NAME = 'assets';
export const ENCOUNTER_STORE_NAME = 'encounters';
export const PARTY_STORE_NAME = 'party-members';

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
  openDB(DATABASE_NAME, 4, {
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
    }
  });

export function createBrew(title = 'Untitled Brew'): Brew {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title,
    content: starterContent,
    createdAt: now,
    updatedAt: now,
    version: 1,
    rendererSettings: {
      accentColor: '#7a2f27',
      parchmentTone: 'warm'
    }
  };
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
