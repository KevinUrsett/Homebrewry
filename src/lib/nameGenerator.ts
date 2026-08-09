import type { WorldbuildingKind } from '../types';

export type NameCategory = 'person' | 'settlement' | 'region' | 'faction' | 'deity' | 'object' | 'event' | 'political';
export type NameCulture = 'belentoran' | 'doulmian' | 'eastern-court' | 'desert-court' | 'northern-guild';

export type NameGeneratorOptions = {
  category: NameCategory;
  culture: NameCulture;
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

export const nameCultureLabels: Record<NameCulture, string> = {
  belentoran: 'Belentoran mixed',
  doulmian: 'Doulmian',
  'eastern-court': 'Eastern court · family first',
  'desert-court': 'Desert court · lineage names',
  'northern-guild': 'Northern guild · trade surnames'
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
const professions = ['Aetherwright', 'Gearwright', 'Lensmaker', 'Runesmith', 'Coilkeeper', 'Lampwright', 'Wardengraver', 'Glassblower', 'Bridgewright', 'Signalman', 'Boilermaker', 'Cartwright', 'Clockmaker', 'Foundry', 'Tanner', 'Weaver', 'Mason', 'Locksmith', 'Scribe', 'Chandler'];
const easternFamilies = ['Arai', 'Bao', 'Chen', 'Han', 'Kwon', 'Lin', 'Mori', 'Ren', 'Shen', 'Sato'];
const easternGiven = ['Aiko', 'Daichi', 'Hana', 'Jin', 'Kei', 'Mei', 'Nari', 'Riku', 'Sora', 'Yuna'];
const desertGiven = ['Amin', 'Dariya', 'Farid', 'Jamal', 'Nadira', 'Qasim', 'Rami', 'Sahra', 'Tariq', 'Zahra'];
const desertFamilies = ['al-Basir', 'al-Karim', 'al-Mazin', 'al-Nur', 'al-Rashid', 'al-Sahir', 'al-Veyr', 'al-Zahir'];
const doulmianGiven = ['Ackhun', 'Anahiri', 'Dunai', 'Elogtro', 'Inhio', 'Nivi', 'Shien', 'Vajun'];
const doulmianFamilies = ['Aner', 'Besh', 'DunDun', 'Halor', 'Keth', 'Naram', 'Othin', 'Varai'];

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

function constructedName(culture: NameCulture = 'belentoran'): string {
  if (culture === 'doulmian') return `${pick(doulmianGiven)}${Math.random() < 0.45 ? pick(['a', 'en', 'or', 'i']) : ''}`;
  if (culture === 'eastern-court') return pick(easternGiven);
  if (culture === 'desert-court') return pick(desertGiven);
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
  const title = options.includeTitles && Math.random() < 0.45 ? `${pick(personTitles)} ` : '';
  if (options.culture === 'eastern-court') {
    return { name: `${title}${pick(easternFamilies)} ${pick(easternGiven)}`, category: options.category, kind: 'character', style: 'constructed' };
  }
  if (options.culture === 'desert-court') {
    const lineage = Math.random() < 0.35 ? ` ibn ${pick(desertGiven)}` : '';
    return { name: `${title}${pick(desertGiven)} ${pick(desertFamilies)}${lineage}`, category: options.category, kind: 'character', style: 'formal' };
  }
  if (options.culture === 'doulmian') {
    return { name: `${title}${pick(doulmianGiven)} ${pick(doulmianFamilies)}`, category: options.category, kind: 'character', style: 'constructed' };
  }
  const compoundSurname = options.allowCompounds && Math.random() < 0.2;
  const surname = Math.random() < 0.62
    ? pick(professions)
    : compoundSurname
      ? compound(options)
      : `${pick(secondaryStarts)}${pick(['wood', 'leeves', 'del', 'ward', 'mere', 'rock', 'vale', 'croft'])}`;
  return { name: `${title}${constructedName(options.culture)} ${surname}`, category: options.category, kind: 'character', style: compoundSurname ? 'compound' : title ? 'formal' : 'constructed' };
}

function settlementName(options: NameGeneratorOptions): GeneratedName {
  const isCompound = options.allowCompounds && Math.random() < 0.28;
  const base = isCompound ? compound(options) : constructedName(options.culture);
  const hasSuffix = Math.random() < 0.52;
  const plain = hasSuffix ? `${base}${pick(suffixes(options.affixes))}` : base;
  const name = options.allowDirections && Math.random() < 0.24 ? `${pick(requestedDirections(options.affixes))} ${plain}` : plain;
  return { name, category: options.category, kind: 'town', style: isCompound ? 'compound' : 'constructed' };
}

function regionName(options: NameGeneratorOptions): GeneratedName {
  if (options.allowCompounds && Math.random() < 0.32) {
    const first = pick([...normaliseTheme(options.theme), ...qualities, ...materials]);
    const shape = pick(['Reach', 'March', 'Stretch', 'Coast', 'Plains', 'Hollows']);
    return { name: `The ${first} ${shape}`, category: options.category, kind: 'region', style: 'formal' };
  }
  return { name: `${constructedName(options.culture)} ${pick(['Reach', 'Vale', 'March', 'Coast'])}`, category: options.category, kind: 'region', style: 'constructed' };
}

function factionName(options: NameGeneratorOptions): GeneratedName {
  const isCompound = options.allowCompounds && Math.random() < 0.45;
  const symbol = isCompound ? compound(options) : constructedName(options.culture);
  const form = Math.random() < 0.5 ? `The ${symbol} ${pick(collective)}` : Math.random() < 0.5 ? `Order of the ${symbol}` : `House ${symbol}`;
  return { name: form, category: options.category, kind: 'faction', style: isCompound ? 'compound' : 'formal' };
}

function deityName(options: NameGeneratorOptions): GeneratedName {
  const name = constructedName(options.culture);
  const epithet = options.includeTitles ? `, ${pick(['Keeper of Gates', 'Mother of the Far Road', 'The Patient Flame', 'Warden of Names'])}` : '';
  return { name: `${name}${epithet}`, category: options.category, kind: 'deity', style: 'constructed' };
}

function objectName(options: NameGeneratorOptions): GeneratedName {
  const isCompound = options.allowCompounds && Math.random() < 0.35;
  const name = isCompound ? `The ${compound(options)}` : `The ${constructedName(options.culture)} ${pick(['Key', 'Crown', 'Ledger', 'Lantern', 'Spear'])}`;
  return { name, category: options.category, kind: 'item', style: isCompound ? 'compound' : 'formal' };
}

function eventName(options: NameGeneratorOptions): GeneratedName {
  const isCompound = options.allowCompounds && Math.random() < 0.35;
  const name = isCompound
    ? `The ${compound(options)} ${pick(['Treaty', 'Riot', 'Accord', 'Crossing', 'Feast'])}`
    : `The ${constructedName(options.culture)} ${pick(['Accord', 'Year', 'Crossing'])}`;
  return { name, category: options.category, kind: 'event', style: isCompound ? 'compound' : 'formal' };
}

function politicalName(options: NameGeneratorOptions): GeneratedName {
  const government = pick(['Kingdom', 'Monarchy', 'Republic', 'Empire', 'Principality']);
  const name = government === 'Empire' && Math.random() < 0.5
    ? `The ${constructedName(options.culture)} Empire`
    : `${government} of ${constructedName(options.culture)}`;
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
