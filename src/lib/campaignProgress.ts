import type { Brew, CampaignEntity, Encounter, EntityCurrentState, WorldbuildingEntry } from '../types';
import { encounterReferenceMatches } from './encounterReferences';
import { getOutlineLocations } from './outline';
import { worldbuildingReferenceMatches } from './worldbuildingReferences';

export type CampaignPosition = {
  brewId: string;
  activeEncounterId: string | null;
  previousEncounterId: string | null;
  nextEncounterId: string | null;
  headingPath: string[];
  sectionId: string | null;
};

export type DerivedPartyLocation = { entityId: string; name: string; source: 'manual' | 'section' } | null;

function sectionForOffset(brew: Brew, offset: number): { id: string | null; headingPath: string[]; start: number; end: number } {
  const headings = getOutlineLocations(brew.content);
  const index = headings.reduce((best, heading, current) => heading.from <= offset ? current : best, -1);
  if (index < 0) return { id: null, headingPath: [], start: 0, end: brew.content.length };
  const target = headings[index]!;
  const end = headings.slice(index + 1).find((heading) => heading.level <= target.level)?.from ?? brew.content.length;
  const path = headings.slice(0, index + 1).filter((heading, current) => {
    const next = headings.slice(current + 1, index + 1).find((candidate) => candidate.level <= heading.level);
    return !next;
  }).map((heading) => heading.text);
  return { id: target.id, headingPath: path, start: target.from, end };
}

function referencedEncounters(brew: Brew, byId: ReadonlyMap<string, Encounter>) {
  return encounterReferenceMatches(brew.content).flatMap((reference) => {
    const encounter = byId.get(reference.id);
    return encounter ? [{ encounter, offset: reference.from }] : [];
  });
}

/**
 * Derives "Now" exclusively from authored encounter order and structured
 * statuses. Brew text is read, never modified or interpreted as canon prose.
 */
export function deriveCampaignPosition(
  brews: readonly Brew[],
  encounters: readonly Encounter[]
): CampaignPosition | null {
  const byId = new Map(encounters.map((encounter) => [encounter.id.toLowerCase(), encounter]));
  const candidates = brews.flatMap((brew) => referencedEncounters(brew, byId).map((item, index, items) => ({ brew, ...item, index, items })));
  const active = candidates.find((candidate) => candidate.encounter.status === 'active');
  const selected = active ?? [...candidates]
    .filter((candidate) => candidate.encounter.status === 'completed')
    .sort((left, right) => right.encounter.updatedAt.localeCompare(left.encounter.updatedAt))[0]
    ?? candidates.find((candidate) => candidate.encounter.status === 'not-started' && !candidate.encounter.optional);
  if (!selected) return null;
  const { brew, encounter, index, items, offset } = selected;
  const section = sectionForOffset(brew, offset);
  const ordered = items.map((item) => item.encounter);
  const activeIndex = index;
  return {
    brewId: brew.id,
    activeEncounterId: encounter.status === 'active' ? encounter.id : null,
    previousEncounterId: ordered.slice(0, activeIndex + (encounter.status === 'completed' ? 1 : 0)).reverse().find((item) => item.id !== encounter.id && (item.status === 'completed' || item.status === 'skipped'))?.id ?? (encounter.status === 'completed' ? encounter.id : null),
    nextEncounterId: ordered.slice(activeIndex + (encounter.status === 'completed' ? 1 : 0)).find((item) => item.status === 'not-started' && !item.optional)?.id ?? null,
    headingPath: section.headingPath,
    sectionId: section.id
  };
}

/** Location is inherited from a Worldbuilding location reference in the current section. */
export function derivePartyLocation(
  position: CampaignPosition | null,
  brews: readonly Brew[],
  entities: readonly CampaignEntity[],
  currentState: ReadonlyMap<string, EntityCurrentState>
): DerivedPartyLocation {
  const manual = currentState.get('party:default')?.fields.location?.value;
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  if (typeof manual === 'string') {
    const entity = entityById.get(manual);
    if (entity) return { entityId: entity.id, name: entity.name, source: 'manual' };
  }
  if (!position) return null;
  const brew = brews.find((item) => item.id === position.brewId);
  if (!brew) return null;
  const heading = position.sectionId ? getOutlineLocations(brew.content).find((item) => item.id === position.sectionId) : undefined;
  const start = heading?.from ?? 0;
  const end = heading ? getOutlineLocations(brew.content).filter((item) => item.from > heading.from && item.level <= heading.level)[0]?.from ?? brew.content.length : brew.content.length;
  const reference = worldbuildingReferenceMatches(brew.content.slice(start, end)).reverse().find((match) => {
    const entity = entities.find((item) => item.source.kind === 'worldbuilding' && item.source.id === match.id);
    return entity?.kind === 'location' || entity?.kind === 'settlement';
  });
  if (!reference) return null;
  const entity = entities.find((item) => item.source.kind === 'worldbuilding' && item.source.id === reference.id);
  return entity ? { entityId: entity.id, name: entity.name, source: 'section' } : null;
}
