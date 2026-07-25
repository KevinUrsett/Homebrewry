import { openDB } from 'idb';
import type { Brew } from '../types';

const DATABASE_NAME = 'homebrewry';
const STORE_NAME = 'brews';

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

const getDatabase = () =>
  openDB(DATABASE_NAME, 1, {
    upgrade(database) {
      const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('updatedAt', 'updatedAt');
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

export async function deleteBrew(id: string): Promise<void> {
  const database = await getDatabase();
  await database.delete(STORE_NAME, id);
}
