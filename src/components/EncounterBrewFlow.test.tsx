/* @vitest-environment jsdom */

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogueEntryKey, type CatalogueEntry } from '../catalogue/types';
import { formatEncounterReference } from '../lib/encounterReferences';
import { getOutline, insertAtOutlineSectionEnd } from '../lib/outline';
import type { Brew, Encounter } from '../types';
import { BrewPreview } from './BrewPreview';
import { EncounterPanel } from './EncounterPanel';
import { OutlinePanel } from './OutlinePanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];

afterEach(() => {
  mounted.splice(0).forEach(({ container, root }) => {
    act(() => root.unmount());
    container.remove();
  });
});

const battleaxe: CatalogueEntry = {
  id: 'battleaxe', category: 'item', name: '+2 Battleaxe', description: '', data: {}, source: 'Custom', ruleset: 'Homebrewry'
};

const encounter: Encounter = {
  id: 'fa32bd5e-2f01-44b6-9db1-81eb346f0d81',
  name: 'Golem at the gate',
  status: 'not-started',
  optional: false,
  participants: [{
    id: 'golem-1', kind: 'monster', name: 'Clay Golem', source: { category: 'monster', id: 'clay-golem' },
    armorClass: 14, maxHitPoints: 133, currentHitPoints: 133, initiative: 3,
    encounterEquipment: [{ itemId: battleaxe.id, actionIndexes: [] }]
  }],
  activeCombatantId: null,
  createdAt: '2026-09-04T16:00:00.000Z',
  updatedAt: '2026-09-04T16:00:00.000Z',
  version: 1
};

function EncounterBrewFixture() {
  const [content, setContent] = useState('# Gatehouse\n\nThe party approaches the city.');
  const [pending, setPending] = useState<Encounter | null>(null);
  const brew: Brew = {
    id: 'brew-1', title: 'Sund', content, createdAt: '2026-09-04T16:00:00.000Z', updatedAt: '2026-09-04T16:00:00.000Z', version: 1,
    rendererSettings: { accentColor: '#7a2f27', parchmentTone: 'warm' }
  };

  return <>
    {pending ? (
      <OutlinePanel
        insertionLabel={pending.name}
        onInsertAtSection={(item) => {
          setContent((current) => insertAtOutlineSectionEnd(current, item?.id ?? null, formatEncounterReference(pending)));
          setPending(null);
        }}
        outline={getOutline(content)}
      />
    ) : (
      <EncounterPanel
        encounters={[encounter]}
        items={[battleaxe]}
        loading={false}
        monsters={[]}
        onCreateEncounter={vi.fn()}
        onCreatePartyMember={vi.fn()}
        onDeleteEncounter={vi.fn()}
        onDeletePartyMember={vi.fn()}
        onInsertReference={setPending}
        onSelectEncounter={vi.fn()}
        onUpdateEncounter={vi.fn()}
        onUpdatePartyMember={vi.fn()}
        partyMembers={[]}
        selectedId={encounter.id}
        syncState="synced"
      />
    )}
    <output aria-label="Brew source">{content}</output>
    <BrewPreview brew={brew} catalogue={new Map([[catalogueEntryKey(battleaxe), battleaxe]])} encounters={new Map([[encounter.id, encounter]])} />
  </>;
}

describe('encounter to brew flow', () => {
  it('places an equipped combat encounter into a selected brew section and renders its Treasure', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });

    await act(async () => { root.render(<EncounterBrewFixture />); });
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Edit Golem at the gate"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Place in brew')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(container.textContent).toContain('Choose where to insert');
    await act(async () => container.querySelector<HTMLButtonElement>('.outline-item')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(container.querySelector('output')?.textContent).toContain(formatEncounterReference(encounter));
    expect(container.querySelector('.brew-encounter-reference')?.textContent).toContain('Golem at the gate');
    const treasureToggle = container.querySelector<HTMLButtonElement>('.brew-encounter-treasure-toggle');
    expect(treasureToggle?.textContent).toContain('1 item');
    await act(async () => treasureToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.querySelector('.brew-encounter-treasure-list')?.textContent).toContain('+2 Battleaxe');
    expect(container.querySelector('.brew-encounter-treasure-list')?.textContent).toContain('Clay Golem');
  });
});
