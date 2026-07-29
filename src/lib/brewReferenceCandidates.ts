import { getOutline } from './outline';
import { normalizeWorldbuildingName } from './worldbuilding';
import type { Brew, WorldbuildingEntry, WorldbuildingKind } from '../types';

export type BrewReferenceCandidate = {
  name: string;
  kind: WorldbuildingKind;
  brewId: string;
  brewTitle: string;
  sectionId: string;
};

const ignoredHeading = /^(?:campaign|chapter\s*(?:\d+|#)|day\s*\d+|area\s*\d+|\d+[a-z]?|locations?|cities|people|taverns?|encounters?|happenings|general features|hooks?(?:\s*\/\s*interesting traits)?|notable (?:locations?|npcs?)|travel(?:ing)?(?: encounters)?|camp followers|translation\s*\d+|here.?s how it works|combat tacticks|the party is (?:assigned|told)|gear|random npc.?s|trade partners|locations of those for ransom|cities not on the map)$/i;

function cleanHeading(text: string): string {
  return normalizeWorldbuildingName(text)
    .replace(/^\d+[a-z]?\s*[.:+–—-]+\s*/i, '')
    .replace(/\s*\|\s*.+$/, '')
    .replace(/\s*:\s*$/, '')
    .trim();
}

function inferKind(name: string): WorldbuildingKind {
  const value = name.toLocaleLowerCase();
  if (/(?:road|route|pass|crossing|border)/.test(value)) return 'road';
  if (/(?:sky-guard|team|crew|keepers|front|band|faction|soldiers|merchants|family|denizens|guild|alliance|liberation)/.test(value)) return 'faction';
  if (/^(?:princess|prince|king|queen|lord|lady|general|high priestess|master builder|archivist|silkmaster|chantador|talon|haundry|handry|thomas|rowan|dul?lys|brave peters|sootman|archibald|habiniah|meryn|rajine|akka)/.test(value)) return 'character';
  if (/(?:sharlai|zsweon|illoni|levenvey|doulm|noag desert|bandit lands)/.test(value)) return 'region';
  if (/(?:gyrro|addersilk|chant|sund|thronereef|merrowwatch|merrowfort)/.test(value)) return 'town';
  return 'landmark';
}

/** Extracts only named outline headings. It never scans prose for state or changes brew content. */
export function findBrewReferenceCandidates(brews: readonly Brew[], existing: readonly WorldbuildingEntry[]): BrewReferenceCandidate[] {
  const known = new Set(existing.flatMap((entry) => [entry.name, ...entry.aliases]).map((name) => normalizeWorldbuildingName(name).toLocaleLowerCase()));
  const seen = new Set(known);

  return brews.flatMap((brew) => getOutline(brew.content).flatMap((heading) => {
    const name = cleanHeading(heading.text);
    const normalised = name.toLocaleLowerCase();
    if (!name || ignoredHeading.test(name) || name.length < 3 || seen.has(normalised)) return [];
    seen.add(normalised);
    return [{ name, kind: inferKind(name), brewId: brew.id, brewTitle: brew.title, sectionId: heading.id }];
  }));
}
