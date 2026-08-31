import { describe, expect, it } from 'vitest';
import { resolvedMonsterActions, resolvedMonsterEquipment, resolvedMonsterWeaponActions, weaponActionText } from './magicItems';
import type { CatalogueEntry } from './types';

const stormfang: CatalogueEntry = {
  id: 'stormfang',
  category: 'item',
  name: 'Stormfang',
  description: '',
  data: {
    magicWeapon: {
      shortDescription: 'A black-lacquered blade that hums in rain.',
      effectText: 'The weapon is a +1 magic weapon.',
      attackBonus: 1,
      damageBonus: 1,
      extraDamageDice: '1d6',
      extraDamageType: 'lightning'
    }
  },
  source: 'Custom',
  ruleset: 'Homebrewry'
};

const guard: CatalogueEntry = {
  id: 'storm-guard',
  category: 'monster',
  name: 'Storm Guard',
  description: '',
  data: {
    equipment: [{ itemId: 'stormfang' }],
    weaponActions: [{
      id: 'blade',
      name: 'Stormfang',
      attackBonus: 4,
      damageDice: '1d8',
      damageModifier: 2,
      damageType: 'slashing',
      reach: '5 ft.',
      range: '',
      text: 'The target can’t take Reactions until the start of its next turn.',
      equipmentId: 'stormfang'
    }]
  },
  source: 'Custom',
  ruleset: 'Homebrewry'
};

describe('magic equipment', () => {
  it('applies a linked magic weapon only to the selected weapon action', () => {
    const [action] = resolvedMonsterWeaponActions(guard, new Map([['item:stormfang', stormfang]]));

    expect(action).toMatchObject({ resolvedAttackBonus: 5, resolvedDamageModifier: 3, item: stormfang });
    expect(weaponActionText(action)).toContain('+5 to hit');
    expect(weaponActionText(action)).toContain('1d8 +3 slashing damage plus 1d6 lightning damage');
    expect(weaponActionText(action)).toContain('can’t take Reactions');
  });

  it('keeps the base values when a linked item is missing', () => {
    const [action] = resolvedMonsterWeaponActions(guard, new Map());

    expect(action).toMatchObject({ resolvedAttackBonus: 4, resolvedDamageModifier: 2, item: null, magicWeapon: null });
  });

  it('updates the original statblock action selected for the equipped weapon', () => {
    const existingActions: CatalogueEntry = {
      ...guard,
      data: {
        equipment: [{ itemId: 'stormfang', actionIndexes: [0] }],
        actions: [
          { name: 'Shortsword', text: '_Melee Attack Roll:_ +5, reach 5 ft. _Hit:_ 6 (1d6 + 3) Piercing damage.' },
          { name: 'Shortbow', text: '_Ranged Attack Roll:_ +5, range 80/320 ft. _Hit:_ 6 (1d6 + 3) Piercing damage.' }
        ]
      }
    };

    const actions = resolvedMonsterActions(existingActions, new Map([['item:stormfang', stormfang]]));

    expect(actions[0]?.text).toBe('_Melee Attack Roll:_ +6, reach 5 ft. _Hit:_ 7 (1d6 +4) Piercing damage plus 1d6 lightning damage.');
    expect(actions[1]?.text).toBe('_Ranged Attack Roll:_ +5, range 80/320 ft. _Hit:_ 6 (1d6 + 3) Piercing damage.');
  });

  it('overlays encounter equipment without changing the compendium monster', () => {
    const baseMonster: CatalogueEntry = {
      ...guard,
      data: {
        actions: [{ name: 'Shortsword', text: '_Melee Attack Roll:_ +5, reach 5 ft. _Hit:_ 6 (1d6 + 3) Piercing damage.' }]
      }
    };
    const encounterEquipment = resolvedMonsterEquipment(baseMonster, [{ itemId: 'stormfang', actionIndexes: [0] }]);
    const encounterActions = resolvedMonsterActions(baseMonster, new Map([['item:stormfang', stormfang]]), encounterEquipment);
    const sourceActions = resolvedMonsterActions(baseMonster, new Map([['item:stormfang', stormfang]]));

    expect(encounterActions[0]?.text).toBe('_Melee Attack Roll:_ +6, reach 5 ft. _Hit:_ 7 (1d6 +4) Piercing damage plus 1d6 lightning damage.');
    expect(sourceActions[0]?.text).toBe('_Melee Attack Roll:_ +5, reach 5 ft. _Hit:_ 6 (1d6 + 3) Piercing damage.');
    expect(baseMonster.data.actions).toEqual([{ name: 'Shortsword', text: '_Melee Attack Roll:_ +5, reach 5 ft. _Hit:_ 6 (1d6 + 3) Piercing damage.' }]);
  });
});
