import type { WorldbuildingKind } from '../types';

export type NameCategory = 'person' | 'settlement' | 'region' | 'faction' | 'deity' | 'object' | 'event' | 'political';

export type NameGeneratorOptions = {
  category: NameCategory;
  theme: string;
  affixes: string;
  allowDirections: boolean;
  allowCompounds: boolean;
  includeTitles: boolean;
};

export type GeneratedName = {
  name: string;
  category: NameCategory;
  kind: WorldbuildingKind;
  style: 'constructed' | 'compound' | 'formal';
};

export const nameCategoryLabels: Record<NameCategory, string> = {
  person: 'Person',
  settlement: 'Settlement',
  region: 'Region',
  faction: 'Faction or organisation',
  deity: 'Deity',
  object: 'Object',
  event: 'Event',
  political: 'Political entity'
};

const defaultSuffixes = ['hold', 'keep', 'hall', 'town', 'port', 'quay', 'lund', 'wall', 'guard', 'link', 'mere', 'ford', 'wick', 'stead', 'mark', 'watch', 'croft', 'haven'];
const directions = ['North', 'South', 'East', 'West'];
const structures = ['Gate', 'Hall', 'Keep', 'Bridge', 'Crown', 'Archive', 'Watch', 'Market', 'Spire', 'Mill', 'Crossing', 'Vault', 'Court', 'Beacon', 'Step'];
const geography = ['River', 'Hill', 'Shore', 'Wood', 'Lake', 'Marsh', 'Vale', 'Reach', 'Fen', 'Down', 'Moor', 'Dell', 'Bay', 'Cape', 'Field', 'Cleft', 'Ridge'];
const materials = ['Iron', 'Glass', 'Stone', 'Grain', 'Ivory', 'Copper', 'Clay', 'Amber', 'Ash', 'Flint', 'Pearl', 'Bronze', 'Salt', 'Slate'];
const qualities = ['Black', 'White', 'Deep', 'High', 'Pale', 'Old', 'Far', 'Low', 'Red', 'Grey', 'Still', 'Hollow', 'Wide', 'Last', 'Golden'];
const imagery = ['Boar', 'Skull', 'Wing', 'Tooth', 'Bloom', 'Sail', 'Step', 'Hare', 'Horn', 'Lantern', 'Root', 'Cairn', 'Bell', 'Crest', 'Hammer'];
const collective = ['Syndicate', 'Company', 'Accord', 'Circle', 'League', 'Guard', 'Assembly', 'Consortium', 'Brotherhood', 'Covenant', 'Wardens', 'House', 'Fellowship'];
const personTitles = ['Captain', 'Father', 'Lady', 'Lord', 'Marshal', 'Archivist', 'Archmage', 'Steward', 'Provost', 'Warden', 'Master of Keys'];
const constructedStarts = ['Tev', 'Viel', 'Quin', 'Fer', 'Tsu', 'Saph', 'Eld', 'Val', 'Bel', 'Ilo', 'Mar', 'Doul', 'Caen', 'Huj', 'Juun', 'Or', 'Kyr', 'Ner', 'Aven', 'Brin', 'Cori', 'Drel', 'Esm', 'Fara', 'Galen', 'Hav', 'Iri', 'Jor', 'Kela', 'Lume', 'Mera', 'Navi', 'Oren', 'Pella', 'Ruva', 'Seli', 'Toren', 'Ulan', 'Vera', 'Ysen', 'Zara'];
const constructedEnds = ['ca', 'le', 'del', 'enk', 'rei', 'rin', 'or', 'en', 'ai', 'eth', 'ar', 'at', 'un', 'is', 'a', 'el', 'in', 'os', 'et', 'um', 'ia', 'on', 'ra', 'el', 'is'];
const secondaryStarts = ['Black', 'Green', 'River', 'White', 'Grain', 'Iron', 'Cword', 'Gold', 'Bright', 'Sable', 'Moss', 'Copper', 'Flint', 'Pale', 'Hearth', 'Marsh', 'Candle', 'Bell', 'Hollow', 'Ridge', 'Tide', 'Briar'];

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function normaliseTheme(theme: string): string[] {
  const value = theme.toLocaleLowerCase();
  const words: string[] = [];
  if (/(sea|coast|ocean|ship|harbour|harbor|sail)/.test(value)) words.push('Tide', 'Coral', 'Sail', 'Quay', 'Brine', 'Anchor', 'Gull', 'Reef');
  if (/(forest|wood|tree|grove)/.test(value)) words.push('Wood', 'Briar', 'Moss', 'Oak', 'Thorn', 'Fern', 'Hollow', 'Root');
  if (/(mountain|stone|mine|cave)/.test(value)) words.push('Stone', 'Flint', 'Peak', 'Hollow', 'Crag', 'Slate', 'Echo', 'Cairn');
  if (/(desert|sand|sun|heat)/.test(value)) words.push('Dune', 'Amber', 'Sere', 'Salt', 'Ember', 'Mirage', 'Ochre', 'Wind');
  if (/(cold|winter|ice|snow)/.test(value)) words.push('Frost', 'Pine', 'Rime', 'White', 'Hearth', 'Glacier', 'Still', 'Fir');
  if (/(relig|temple|faith|holy)/.test(value)) words.push('Candle', 'Bell', 'Ash', 'Star', 'Vigil', 'Chapel', 'Morrow', 'Reliquary');
  if (/(trade|merchant|market|gold)/.test(value)) words.push('Coin', 'Ledger', 'Gold', 'Grain', 'Caravan', 'Scale', 'Wagon', 'Silk');
  return words;
}

function constructedName(): string {
  const start = pick(constructedStarts);
  const end = pick(constructedEnds);
  return start.endsWith(end[0]!) ? `${start}${end.slice(1)}` : `${start}${end}`;
}

function suffixes(affixes: string): string[] {
  const supplied = affixes
    .split(',')
    .map((part) => part.trim().replace(/^[-–—]/, '').replace(/[-–—]$/, ''))
    .filter((part) => part.length > 1 && !/^(north|south|east|west)$/i.test(part));
  return supplied.length ? supplied : defaultSuffixes;
}

function requestedDirections(affixes: string): string[] {
  const supplied = affixes.match(/north|south|east|west/gi)?.map((value) => value[0]!.toUpperCase() + value.slice(1).toLocaleLowerCase()) ?? [];
  return supplied.length ? supplied : directions;
}

function compound(options: NameGeneratorOptions): string {
  const themeWords = normaliseTheme(options.theme);
  const first = pick([...themeWords, ...materials, ...qualities, ...imagery]);
  const second = pick([...geography, ...structures, ...imagery]);
  return `${first}${second}`;
}

function personName(options: NameGeneratorOptions): GeneratedName {
  const surname = options.allowCompounds && Math.random() < 0.55
    ? compound(options)
    : `${pick(secondaryStarts)}${pick(['wood', 'leeves', 'del', 'ward', 'mere', 'rock'])}`;
  const title = options.includeTitles && Math.random() < 0.55 ? `${pick(personTitles)} ` : '';
  return { name: `${title}${constructedName()} ${surname}`, category: options.category, kind: 'character', style: title ? 'formal' : 'constructed' };
}

function settlementName(options: NameGeneratorOptions): GeneratedName {
  const base = options.allowCompounds && Math.random() < 0.6 ? compound(options) : constructedName();
  const affix = pick(suffixes(options.affixes));
  const directed = options.allowDirections && Math.random() < 0.4 ? `${pick(requestedDirections(options.affixes))}${base}` : `${base}${affix}`;
  return { name: directed, category: options.category, kind: 'town', style: options.allowCompounds ? 'compound' : 'constructed' };
}

function regionName(options: NameGeneratorOptions): GeneratedName {
  if (options.allowCompounds && Math.random() < 0.6) {
    const first = pick([...normaliseTheme(options.theme), ...qualities, ...materials]);
    const shape = pick(['Reach', 'March', 'Stretch', 'Coast', 'Plains', 'Hollows']);
    return { name: `The ${first} ${shape}`, category: options.category, kind: 'region', style: 'formal' };
  }
  return { name: `${constructedName()} ${pick(['Reach', 'Vale', 'March', 'Coast'])}`, category: options.category, kind: 'region', style: 'constructed' };
}

function factionName(options: NameGeneratorOptions): GeneratedName {
  const symbol = options.allowCompounds ? compound(options) : constructedName();
  const form = Math.random() < 0.5 ? `The ${symbol} ${pick(collective)}` : `Order of the ${symbol}`;
  return { name: form, category: options.category, kind: 'faction', style: options.allowCompounds ? 'compound' : 'formal' };
}

function deityName(options: NameGeneratorOptions): GeneratedName {
  const name = constructedName();
  const epithet = options.includeTitles ? `, ${pick(['Keeper of Gates', 'Mother of the Far Road', 'The Patient Flame', 'Warden of Names'])}` : '';
  return { name: `${name}${epithet}`, category: options.category, kind: 'deity', style: 'constructed' };
}

function objectName(options: NameGeneratorOptions): GeneratedName {
  const name = options.allowCompounds ? `The ${compound(options)}` : `The ${constructedName()} ${pick(['Key', 'Crown', 'Ledger', 'Lantern', 'Spear'])}`;
  return { name, category: options.category, kind: 'item', style: options.allowCompounds ? 'compound' : 'formal' };
}

function eventName(options: NameGeneratorOptions): GeneratedName {
  const name = options.allowCompounds
    ? `The ${compound(options)} ${pick(['Treaty', 'Riot', 'Accord', 'Crossing', 'Feast'])}`
    : `The ${constructedName()} ${pick(['Accord', 'Year', 'Crossing'])}`;
  return { name, category: options.category, kind: 'event', style: 'formal' };
}

function politicalName(options: NameGeneratorOptions): GeneratedName {
  const government = pick(['Kingdom', 'Monarchy', 'Republic', 'Empire', 'Principality']);
  const name = government === 'Empire' && Math.random() < 0.5
    ? `The ${constructedName()} Empire`
    : `${government} of ${constructedName()}`;
  return { name, category: options.category, kind: 'faction', style: 'formal' };
}

export function generateName(options: NameGeneratorOptions): GeneratedName {
  switch (options.category) {
    case 'person': return personName(options);
    case 'settlement': return settlementName(options);
    case 'region': return regionName(options);
    case 'faction': return factionName(options);
    case 'deity': return deityName(options);
    case 'object': return objectName(options);
    case 'event': return eventName(options);
    case 'political': return politicalName(options);
  }
}

export function generateNames(options: NameGeneratorOptions, count = 6): GeneratedName[] {
  const results: GeneratedName[] = [];
  const names = new Set<string>();
  for (let attempts = 0; results.length < count && attempts < count * 12; attempts += 1) {
    const result = generateName(options);
    if (names.has(result.name)) continue;
    names.add(result.name);
    results.push(result);
  }
  return results;
}
