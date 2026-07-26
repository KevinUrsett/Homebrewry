export const catalogueCategories = [
  'background',
  'class',
  'feat',
  'item',
  'monster',
  'rule',
  'species',
  'spell',
  'subclass',
  'table'
] as const;

/** Categories bundled with the read-only SRD data set. */
export type BuiltInCatalogueCategory = typeof catalogueCategories[number];

/**
 * Campaigns can add their own category IDs. They are deliberately opaque,
 * stable slugs rather than display names so renaming a category never breaks
 * a reference already written in a brew.
 */
export type CatalogueCategory = string;

export type CustomCatalogueCategory = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type CatalogueColumn = {
  name: string;
  align?: string | null;
};

export type CatalogueEntry = {
  id: string;
  category: CatalogueCategory;
  name: string;
  description: string;
  data: Record<string, unknown>;
  source: string;
  ruleset: string;
  type?: string;
  columns?: CatalogueColumn[];
  rows?: string[][];
};

/** A campaign-owned entry created from the editor, never part of the bundled SRD data. */
export type CustomCatalogueEntry = CatalogueEntry & {
  source: 'Custom';
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type CatalogueReference = {
  category: CatalogueCategory;
  id: string;
  label: string;
};

export const catalogueCategoryLabels: Record<BuiltInCatalogueCategory, string> = {
  background: 'Backgrounds',
  class: 'Classes',
  feat: 'Feats',
  item: 'Items',
  monster: 'Monsters',
  rule: 'Rules',
  species: 'Species',
  spell: 'Spells',
  subclass: 'Subclasses',
  table: 'Tables'
};

export const catalogueEntryKey = (entry: Pick<CatalogueEntry, 'category' | 'id'>) => `${entry.category}:${entry.id}`;

export function isBuiltInCatalogueCategory(value: string): value is BuiltInCatalogueCategory {
  return (catalogueCategories as readonly string[]).includes(value);
}

/** Safe category IDs accepted in source references and campaign data. */
export function isCatalogueCategory(value: string): value is CatalogueCategory {
  return /^[a-z][a-z0-9-]{0,79}$/.test(value);
}

export function catalogueCategoryLabel(
  category: CatalogueCategory,
  customCategories: readonly CustomCatalogueCategory[] = []
): string {
  if (isBuiltInCatalogueCategory(category)) return catalogueCategoryLabels[category];
  return customCategories.find((item) => item.id === category)?.name ?? 'Custom category';
}
