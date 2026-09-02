/* @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { CatalogueEntry } from '../catalogue/types';
import { CatalogueEntryDetails } from './CatalogueEntryDetails';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];

afterEach(() => {
  mounted.splice(0).forEach(({ container, root }) => {
    act(() => root.unmount());
    container.remove();
  });
});

describe('CatalogueEntryDetails magic equipment', () => {
  it('renders equipped magic weapon text and the resolved weapon action', async () => {
    const stormfang: CatalogueEntry = {
      id: 'stormfang', category: 'item', name: 'Stormfang', description: '', source: 'Custom', ruleset: 'Homebrewry',
      data: { magicWeapon: { shortDescription: 'A black-lacquered blade.', effectText: 'The weapon is a +1 magic weapon.', attackBonus: 1, damageBonus: 1, extraDamageDice: '1d6', extraDamageType: 'lightning' } }
    };
    const guard: CatalogueEntry = {
      id: 'guard', category: 'monster', name: 'Storm Guard', description: '', source: 'Custom', ruleset: 'Homebrewry',
      data: {
        equipment: [{ itemId: 'stormfang', actionIndexes: [0] }],
        actions: [{ name: 'Shortsword', text: '_Melee Attack Roll:_ +4, reach 5 ft. _Hit:_ 5 (1d6 + 2) Piercing damage.' }]
      }
    };
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });

    await act(async () => {
      root.render(<CatalogueEntryDetails entry={guard} references={{ catalogue: new Map([['item:stormfang', stormfang]]) }} />);
    });

    expect(container.textContent).toContain('Equipment');
    expect(container.textContent).toContain('A black-lacquered blade.');
    expect(container.textContent).toContain('What it does.');
    expect(container.textContent).toContain('+5, reach 5 ft.');
    expect(container.textContent).toContain('6 (1d6 +3) Piercing damage plus 1d6 lightning damage');
  });

  it('renders an encounter-only item overlay without changing the source stat block', async () => {
    const wingedPlate: CatalogueEntry = {
      id: 'winged-plate', category: 'item', name: 'Winged Plate', description: '', source: 'Custom', ruleset: 'Homebrewry',
      data: { monsterStatBlock: { changes: [
        { field: 'armorClass', operation: 'add', value: 2 },
        { field: 'hitPoints', operation: 'add', value: 10 },
        { field: 'flySpeed', operation: 'set', value: 60 },
        { field: 'dexterity', operation: 'set', value: 18 }
      ], traits: [{ name: 'Winged', text: 'The guard gains a Fly Speed.' }] } }
    };
    const guard: CatalogueEntry = {
      id: 'guard-overlay', category: 'monster', name: 'Guard', description: '', source: 'SRD-521', ruleset: '5.5e',
      data: {
        ac: '16 (chain mail)', hp: '11 (2d8 + 2)', speed: { walk: 30 },
        abilities: { str: 13, dex: 12, con: 12, int: 10, wis: 11, cha: 10 }
      }
    };
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push({ container, root });

    await act(async () => {
      root.render(
        <CatalogueEntryDetails
          entry={guard}
          equipment={[{ itemId: 'winged-plate', actionIndexes: [] }]}
          references={{ catalogue: new Map([['item:winged-plate', wingedPlate]]) }}
        />
      );
    });

    expect(container.textContent).toContain('18 (chain mail)');
    expect(container.textContent).toContain('21 (2d8 + 2)');
    expect(container.textContent).toContain('walk 30 ft., fly 60 ft.');
    expect(container.textContent).toContain('DEX18');
    expect(container.textContent).toContain('Winged');
    expect(guard.data).toMatchObject({ ac: '16 (chain mail)', hp: '11 (2d8 + 2)', abilities: { dex: 12 } });
  });
});
