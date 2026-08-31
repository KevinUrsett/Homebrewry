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
});
