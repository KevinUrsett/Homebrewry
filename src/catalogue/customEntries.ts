import type { CatalogueCategory, CustomCatalogueEntry } from './types';

function normaliseCustomName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Creates the smallest safe custom catalogue record for an editor reference. */
export function createCustomCatalogueEntry(
  name: string,
  category: CatalogueCategory,
  timestamp = new Date().toISOString(),
  id: string = crypto.randomUUID()
): CustomCatalogueEntry {
  const normalisedName = normaliseCustomName(name);
  if (!normalisedName) throw new Error('Select text before adding a reference.');

  return {
    id,
    category,
    name: normalisedName,
    description: '',
    data: {},
    source: 'Custom',
    ruleset: 'Homebrewry',
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1
  };
}
