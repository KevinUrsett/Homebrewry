import { useState, type ComponentProps } from 'react';
import type { SocialEncounter, WorldbuildingEntry } from '../types';
import type { SocialNpcDetails } from '../lib/socialNpcSearch';
import { EncounterPanel as CombatEncounterPanel } from './CombatEncounterPanel';
import { SocialEncounterLayout } from './SocialEncounterLayout';
import '../social-encounter.css';

type CombatEncounterPanelProps = ComponentProps<typeof CombatEncounterPanel>;
type EncounterPanelProps = CombatEncounterPanelProps & {
  socialEncounters?: SocialEncounter[];
  worldbuildingEntries?: WorldbuildingEntry[];
  onCreateSocialNpc?: (name: string, details?: SocialNpcDetails) => WorldbuildingEntry;
  onDeleteSocialEncounter?: (encounter: SocialEncounter) => void;
  onOpenWorldbuildingEntry?: (entry: WorldbuildingEntry) => void;
  onUpdateSocialEncounter?: (encounter: SocialEncounter) => void;
};
type EncounterKind = 'combat' | 'social';

export function EncounterPanel({
  socialEncounters = [],
  worldbuildingEntries = [],
  onCreateSocialNpc = (name, details) => ({ id: crypto.randomUUID(), name, kind: 'npc', aliases: [], notes: '', ...details, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1 }),
  onDeleteSocialEncounter = () => undefined,
  onOpenWorldbuildingEntry = () => undefined,
  onUpdateSocialEncounter = () => undefined,
  ...combatProps
}: EncounterPanelProps) {
  const [kind, setKind] = useState<EncounterKind>('combat');

  return (
    <div className="encounter-kind-shell">
      <nav aria-label="Encounter type" className="encounter-kind-tabs" role="tablist">
        <button aria-selected={kind === 'combat'} className={kind === 'combat' ? 'is-selected' : ''} onClick={() => setKind('combat')} role="tab" type="button">Combat</button>
        <button aria-selected={kind === 'social'} className={kind === 'social' ? 'is-selected' : ''} onClick={() => setKind('social')} role="tab" type="button">Social</button>
      </nav>
      {kind === 'combat' ? <CombatEncounterPanel {...combatProps} /> : (
        <main aria-label="Social encounters" className="encounter-page social-encounter-page">
          <header className="encounter-page-header">
            <div><p className="eyebrow">Roleplay toolkit</p><h1>Social encounters</h1><p>Keep every NPC in the scene visible and open their information when needed.</p></div>
          </header>
          <SocialEncounterLayout encounters={socialEncounters} onCreateNpc={onCreateSocialNpc} onDeleteEncounter={onDeleteSocialEncounter} onOpenWorldbuildingEntry={onOpenWorldbuildingEntry} onUpdateEncounter={onUpdateSocialEncounter} worldbuildingEntries={worldbuildingEntries} />
        </main>
      )}
    </div>
  );
}
