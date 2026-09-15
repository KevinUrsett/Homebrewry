import { useState, type ComponentProps } from 'react';
import { EncounterPanel as CombatEncounterPanel } from './CombatEncounterPanel';
import { SocialEncounterLayout } from './SocialEncounterLayout';
import '../social-encounter.css';

type EncounterPanelProps = ComponentProps<typeof CombatEncounterPanel>;
type EncounterKind = 'combat' | 'social';

export function EncounterPanel(props: EncounterPanelProps) {
  const [kind, setKind] = useState<EncounterKind>('combat');

  return (
    <div className="encounter-kind-shell">
      <nav aria-label="Encounter type" className="encounter-kind-tabs" role="tablist">
        <button aria-selected={kind === 'combat'} className={kind === 'combat' ? 'is-selected' : ''} onClick={() => setKind('combat')} role="tab" type="button">Combat</button>
        <button aria-selected={kind === 'social'} className={kind === 'social' ? 'is-selected' : ''} onClick={() => setKind('social')} role="tab" type="button">Social</button>
      </nav>

      {kind === 'combat' ? <CombatEncounterPanel {...props} /> : (
        <main aria-label="Social encounters" className="encounter-page social-encounter-page">
          <header className="encounter-page-header">
            <div><p className="eyebrow">Roleplay toolkit</p><h1>Social encounters</h1><p>Keep every NPC in the scene visible and open their information when needed.</p></div>
          </header>
          <SocialEncounterLayout />
        </main>
      )}
    </div>
  );
}
