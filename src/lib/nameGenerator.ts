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
  preferAlliteration: boolean;
};

export type GeneratedName = {
  name: string;
  category: NameCategory;
  kind: WorldbuildingKind;
  style: 'constructed' | 'compound' | 'formal';
  /** Present for people so a generated batch can keep both name parts unique. */
  givenName?: string;
  surname?: string;
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
const constructedStarts = ['Tev', 'Viel', 'Quin', 'Fer', 'Tsu', 'Saph', 'Eld', 'Val', 'Bel', 'Ilo', 'Mar', 'Doul', 'Caen', 'Huj', 'Juun', 'Or', 'Kyr', 'Ner', 'Aven', 'Brin', 'Cori', 'Drel', 'Esm', 'Fara', 'Galen', 'Hav', 'Iri', 'Jor', 'Kela', 'Lume', 'Mera', 'Navi', 'Oren', 'Pella', 'Ruva', 'Seli', 'Toren', 'Ulan', 'Vera', 'Ysen', 'Zara', 'Ald', 'Beor', 'Catr', 'Dagn', 'Edr', 'Fjol', 'Gunn', 'Hald', 'Ivar', 'Jarek', 'Kost', 'Leof', 'Marek', 'Nikol', 'Oskar', 'Radom', 'Sven', 'Tomas', 'Ulrik', 'Vesna', 'Wulfr', 'Yar', 'Zden'];
const professions = ['Aetherwright', 'Artificer', 'Boilermaker', 'Bridgewright', 'Cartwright', 'Chandler', 'Clockmaker', 'Coilkeeper', 'Copperwright', 'Dredger', 'Foundryman', 'Gearwright', 'Glassblower', 'Gravemason', 'Lamplighter', 'Lampwright', 'Lensmaker', 'Locksmith', 'Mason', 'Navigator', 'Rigger', 'Runesmith', 'Scribe', 'Signalman', 'Surveyor', 'Tanner', 'Tinkerer', 'Valvekeeper', 'Wardengraver', 'Weaver'];
const easternFamilies = ['Arai', 'Bao', 'Chen', 'Cho', 'Han', 'Ishida', 'Kwon', 'Lin', 'Mori', 'Ngai', 'Ren', 'Sato', 'Shen', 'Tao', 'Yun', 'Aoki', 'Asano', 'Endo', 'Fujii', 'Hasegawa', 'Inoue', 'Kato', 'Kobayashi', 'Maeda', 'Nakamura', 'Nakano', 'Oda', 'Okada', 'Sakamoto', 'Suzuki', 'Takahashi', 'Tanaka', 'Ueda', 'Watanabe', 'Yamamoto', 'Zhang', 'Li', 'Park', 'Seo', 'Wu', 'Xie', 'Yamada', 'Jeong', 'Kang', 'Qiao'];
const easternGiven = ['Aiko', 'Daichi', 'Hana', 'Jin', 'Kei', 'Mei', 'Nari', 'Riku', 'Sora', 'Yuna', 'Aya', 'Hiro', 'Jun', 'Min', 'Rin', 'Tae', 'Aki', 'Akira', 'Chiyo', 'Emi', 'Fumiko', 'Haru', 'Haruki', 'Haruto', 'Kaito', 'Kaori', 'Kenji', 'Kiyomi', 'Kota', 'Makoto', 'Miki', 'Naoko', 'Rei', 'Sachiko', 'Shiori', 'Takumi', 'Tomo', 'Yori', 'Yuki', 'Kazu', 'Masato', 'Nozomi', 'Seiji', 'Toshi', 'Yui'];
const desertGiven = ['Amin', 'Dariya', 'Farid', 'Jamal', 'Nadira', 'Qasim', 'Rami', 'Sahra', 'Tariq', 'Zahra', 'Ayla', 'Bashir', 'Hadi', 'Laleh', 'Mahir', 'Samira', 'Adil', 'Amina', 'Aziz', 'Basma', 'Dawud', 'Fariha', 'Ilyas', 'Jasmin', 'Karim', 'Layla', 'Mina', 'Nabil', 'Noura', 'Omar', 'Rashid', 'Salma', 'Sami', 'Sana', 'Tala', 'Yasir', 'Zain', 'Zara', 'Adeel', 'Husam', 'Imaan', 'Khalid', 'Maryam', 'Naseem', 'Safiya'];
const desertFamilies = ['al-Basir', 'al-Karim', 'al-Mazin', 'al-Nur', 'al-Rashid', 'al-Sahir', 'al-Veyr', 'al-Zahir', 'al-Hamid', 'al-Miraj', 'al-Qadir', 'al-Safin', 'al-Amin', 'al-Barq', 'al-Dar', 'al-Faris', 'al-Hakim', 'al-Jabir', 'al-Khazin', 'al-Latif', 'al-Mansur', 'al-Najjar', 'al-Qamar', 'al-Rafi', 'al-Sabbah', 'al-Tahir', 'al-Wahid', 'al-Yasir', 'al-Zayt', 'ibn Kharif', 'ibn Sabil', 'Bint Wadi', 'Dar Shamal', 'Darqesh', 'Hazar', 'Khalan', 'Maref', 'Nashir', 'Qadri', 'Sahim', 'Tazir', 'Vahram', 'Zafran', 'Zaydan', 'Zuhair'];
const doulmianGiven = ['Ackhun', 'Anahiri', 'Dunai', 'Elogtro', 'Inhio', 'Nivi', 'Shien', 'Vajun', 'Aresh', 'Hirin', 'Kavun', 'Oshai', 'Beluun', 'Corae', 'Dervin', 'Eshara', 'Falan', 'Ghorin', 'Hivara', 'Ishen', 'Juvak', 'Kelei', 'Lunash', 'Mavun', 'Nireth', 'Orakai', 'Peshin', 'Qavira', 'Ruhen', 'Savax', 'Tirun', 'Uvela', 'Varosh', 'Weshin', 'Xarai', 'Yevan', 'Zurei', 'Avarin', 'Beshai', 'Cevun', 'Doshira', 'Evrin', 'Fushai', 'Gavan', 'Horeth'];
const doulmianFamilies = ['Aner', 'Besh', 'DunDun', 'Halor', 'Keth', 'Naram', 'Othin', 'Varai', 'Daro', 'Kiveth', 'Uru', 'Vesh', 'Avari', 'Belor', 'Cesh', 'Dunvar', 'Eshar', 'Farin', 'Gaveth', 'Horan', 'Iver', 'Jash', 'Kavor', 'Leth', 'Moran', 'Nesh', 'Orin', 'Pavar', 'Qesh', 'Ravin', 'Sethar', 'Tovin', 'Uvar', 'Valesh', 'Weth', 'Xorin', 'Yavar', 'Zeth', 'Anuvar', 'Beshar', 'Cavor', 'Darev', 'Eshun', 'Favar', 'Gorun'];

const constructedEnds = ['ca', 'le', 'del', 'enk', 'rei', 'rin', 'or', 'en', 'ai', 'eth', 'ar', 'at', 'un', 'is', 'a', 'el', 'in', 'os', 'et', 'um', 'ia', 'on', 'ra', 'mir', 'islav', 'ena', 'ora', 'borg', 'frid', 'mund', 'ric', 'stan', 'vlad'];
const secondaryStarts = ['Black', 'Green', 'River', 'White', 'Grain', 'Iron', 'Cword', 'Gold', 'Bright', 'Sable', 'Moss', 'Copper', 'Flint', 'Pale', 'Hearth', 'Marsh', 'Candle', 'Bell', 'Hollow', 'Ridge', 'Tide', 'Briar'];

const recentSurnames: string[] = [];

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function uniqueSurname(create: () => string): string {
  let surname = create();
  for (let attempt = 0; attempt < 80 && recentSurnames.includes(surname); attempt += 1) surname = create();
  recentSurnames.push(surname);
  if (recentSurnames.length > 100) recentSurnames.shift();
  return surname;
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

function constructedName(culture: NameCulture = 'belentoran', initial?: string): string {
  if (culture === 'doulmian') return `${pick(doulmianGiven)}${Math.random() < 0.45 ? pick(['a', 'en', 'or', 'i']) : ''}`;
  if (culture === 'eastern-court') return pick(easternGiven);
  if (culture === 'desert-court') return pick(desertGiven);
  const matchingStarts = initial ? constructedStarts.filter((start) => start[0]?.toLocaleLowerCase() === initial.toLocaleLowerCase()) : [];
  const start = matchingStarts.length ? pick(matchingStarts) : pick(constructedStarts);
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
    const surname = uniqueSurname(() => pick(easternFamilies));
    const givenName = pick(easternGiven);
    return { name: `${title}${surname} ${givenName}`, category: options.category, kind: 'character', style: 'constructed', givenName, surname };
  }
  if (options.culture === 'desert-court') {
    const givenName = pick(desertGiven);
    const surname = uniqueSurname(() => pick(desertFamilies));
    const lineage = Math.random() < 0.35 ? ` ibn ${pick(desertGiven)}` : '';
    return { name: `${title}${givenName} ${surname}${lineage}`, category: options.category, kind: 'character', style: 'formal', givenName, surname };
  }
  if (options.culture === 'doulmian') {
    const givenName = pick(doulmianGiven);
    const surname = uniqueSurname(() => pick(doulmianFamilies));
    return { name: `${title}${givenName} ${surname}`, category: options.category, kind: 'character', style: 'constructed', givenName, surname };
  }
  const compoundSurname = options.allowCompounds && Math.random() < 0.15;
  const professionChance = options.culture === 'northern-guild' ? 0.84 : 0.62;
  const surname = uniqueSurname(() => Math.random() < professionChance
    ? pick(professions)
    : compoundSurname
      ? compound(options)
      : `${pick(secondaryStarts)}${pick(['wood', 'leeves', 'del', 'ward', 'mere', 'rock', 'vale', 'croft'])}`);
  const givenName = constructedName(options.culture, options.preferAlliteration ? surname[0] : undefined);
  return { name: `${title}${givenName} ${surname}`, category: options.category, kind: 'character', style: compoundSurname ? 'compound' : title ? 'formal' : 'constructed', givenName, surname };
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
  const givenNames = new Set<string>();
  const surnames = new Set<string>();
  const normalisePart = (value: string) => value.trim().toLocaleLowerCase();

  for (let attempts = 0; results.length < count && attempts < count * 50; attempts += 1) {
    const result = generateName(options);
    const givenName = result.givenName && normalisePart(result.givenName);
    const surname = result.surname && normalisePart(result.surname);

    // Each click creates a new generation. A person's given name and surname
    // may each appear only once in that generation.
    if (
      names.has(result.name)
      || (givenName !== undefined && givenNames.has(givenName))
      || (surname !== undefined && surnames.has(surname))
    ) continue;

    names.add(result.name);
    if (givenName !== undefined) givenNames.add(givenName);
    if (surname !== undefined) surnames.add(surname);
    results.push(result);
  }
  return results;
}
