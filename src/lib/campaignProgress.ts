import type { Brew, Encounter } from '../types';
import { encounterReferenceMatches } from './encounterReferences';

export type CampaignPosition = {
  brewId: string;
  activeEncounterId: string | null;
  previousEncounterId: string | null;
  nextEncounterId: string | null;
};

/**
 * Derives "Now" exclusively from authored encounter order and structured
 * statuses. Brew text is read, never modified or interpreted as canon prose.
 */
export function deriveCampaignPosition(
  brews: readonly Brew[],
  encounters: readonly Encounter[]
): CampaignPosition | null {
  const byId = new Map(encounters.map((encounter) => [encounter.id.toLowerCase(), encounter]));
  for (const brew of brews) {
    const ordered = encounterReferenceMatches(brew.content)
      .map((reference) => byId.get(reference.id))
      .filter((encounter): encounter is Encounter => Boolean(encounter));
    const active = ordered.find((encounter) => encounter.status === 'active');
    if (active) {
      const index = ordered.indexOf(active);
      return {
        brewId: brew.id,
        activeEncounterId: active.id,
        previousEncounterId: ordered.slice(0, index).reverse().find((encounter) => encounter.status === 'completed' || encounter.status === 'skipped')?.id ?? null,
        nextEncounterId: ordered.slice(index + 1).find((encounter) => encounter.status === 'not-started' && !encounter.optional)?.id ?? null
      };
    }
    const nextIndex = ordered.findIndex((encounter) => encounter.status === 'not-started' && !encounter.optional);
    if (nextIndex >= 0) {
      return {
        brewId: brew.id,
        activeEncounterId: null,
        previousEncounterId: ordered.slice(0, nextIndex).reverse().find((encounter) => encounter.status === 'completed' || encounter.status === 'skipped')?.id ?? null,
        nextEncounterId: ordered[nextIndex].id
      };
    }
  }
  return null;
}
