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

export type CatalogueCategory = typeof catalogueCategories[number];

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

export type CatalogueReference = {
  category: CatalogueCategory;
  id: string;
  label: string;
};

export const catalogueCategoryLabels: Record<CatalogueCategory, string> = {
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

export function isCatalogueCategory(value: string): value is CatalogueCategory {
  return (catalogueCategories as readonly string[]).includes(value);
}
