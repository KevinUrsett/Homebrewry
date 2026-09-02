import { useState } from 'react';
import {
  magicWeaponForItem,
  monsterStatBlockModifiersForItem,
  monsterStatChangeDefinitions,
  type MonsterStatChange,
  type MonsterStatField
} from '../catalogue/magicItems';
import type { CatalogueCategory, CustomCatalogueCategory, CustomCatalogueEntry } from '../catalogue/types';
import { MarkdownEditor } from './MarkdownEditor';
import type { WorldbuildingKind, WorldbuildingType } from '../types';

type CustomItemEditorProps = {
  entry: CustomCatalogueEntry;
  mode: 'create' | 'edit';
  onCancel: () => void;
  onSave: (entry: CustomCatalogueEntry) => Promise<void>;
  customCategories: readonly CustomCatalogueCategory[];
  worldbuildingTypes: readonly WorldbuildingType[];
  onCreateWorldbuildingReference: (name: string, kind: WorldbuildingKind) => Promise<string | null> | string | null;
  onCreateCatalogueReference: (name: string, category: CatalogueCategory) => Promise<string | null> | string | null;
};

function numberField(value: string): number {
  const number = Number(value);
  return Number.isInteger(number) && Number.isFinite(number) ? number : 0;
}

type ItemKind = 'item' | 'magic-item' | 'magic-weapon';
type EditableStatChange = {
  field: MonsterStatField;
  operation: 'add' | 'set';
  value: string;
};

function itemKindFor(entry: CustomCatalogueEntry): ItemKind {
  if (magicWeaponForItem(entry)) return 'magic-weapon';
  return monsterStatBlockModifiersForItem(entry) ? 'magic-item' : 'item';
}

export function CustomItemEditor({ entry, mode, onCancel, onSave, customCategories, worldbuildingTypes, onCreateWorldbuildingReference, onCreateCatalogueReference }: CustomItemEditorProps) {
  const existingMagicWeapon = magicWeaponForItem(entry);
  const existingModifiers = monsterStatBlockModifiersForItem(entry);
  const [name, setName] = useState(entry.name);
  const [type, setType] = useState(entry.type ?? '');
  const [notes, setNotes] = useState(entry.description);
  const [itemKind, setItemKind] = useState<ItemKind>(() => itemKindFor(entry));
  const [shortDescription, setShortDescription] = useState(existingMagicWeapon?.shortDescription ?? '');
  const [effectText, setEffectText] = useState(existingMagicWeapon?.effectText ?? '');
  const [attackBonus, setAttackBonus] = useState(String(existingMagicWeapon?.attackBonus ?? 0));
  const [damageBonus, setDamageBonus] = useState(String(existingMagicWeapon?.damageBonus ?? 0));
  const [extraDamageDice, setExtraDamageDice] = useState(existingMagicWeapon?.extraDamageDice ?? '');
  const [extraDamageType, setExtraDamageType] = useState(existingMagicWeapon?.extraDamageType ?? '');
  const [statChanges, setStatChanges] = useState<EditableStatChange[]>(() => (existingModifiers?.changes ?? []).map((change) => ({ ...change, value: String(change.value) })));
  const [traits, setTraits] = useState(() => existingModifiers?.traits ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMagicWeapon = itemKind === 'magic-weapon';
  const isEncounterItem = itemKind !== 'item';

  const addStatChange = () => setStatChanges((current) => [...current, { field: 'armorClass', operation: 'add', value: '0' }]);
  const updateStatChange = (index: number, change: Partial<EditableStatChange>) => {
    setStatChanges((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item));
  };
  const updateStatField = (index: number, field: MonsterStatField) => {
    const definition = monsterStatChangeDefinitions.find((item) => item.field === field);
    updateStatChange(index, { field, operation: definition?.canAdd ? 'add' : 'set', value: '' });
  };
  const removeStatChange = (index: number) => setStatChanges((current) => current.filter((_item, itemIndex) => itemIndex !== index));
  const addTrait = () => setTraits((current) => [...current, { name: '', text: '' }]);
  const updateTrait = (index: number, change: Partial<{ name: string; text: string }>) => {
    setTraits((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item));
  };
  const removeTrait = (index: number) => setTraits((current) => current.filter((_item, itemIndex) => itemIndex !== index));

  const save = async () => {
    const data: Record<string, unknown> = { ...entry.data };
    if (isMagicWeapon) {
      data.magicWeapon = {
        shortDescription: shortDescription.trim(),
        effectText: effectText.trim(),
        attackBonus: numberField(attackBonus),
        damageBonus: numberField(damageBonus),
        extraDamageDice: extraDamageDice.trim(),
        extraDamageType: extraDamageType.trim()
      };
    } else {
      delete data.magicWeapon;
    }
    if (isEncounterItem) {
      const changes: MonsterStatChange[] = [];
      for (const change of statChanges) {
        const definition = monsterStatChangeDefinitions.find((item) => item.field === change.field);
        if (!definition) continue;
        if (definition.valueType === 'number') {
          const value = Number(change.value);
          if (Number.isFinite(value)) changes.push({ field: change.field, operation: change.operation, value });
          continue;
        }
        const value = change.value.trim();
        if (value) changes.push({ field: change.field, operation: 'set', value });
      }
      const resolvedTraits = traits.flatMap((trait) => {
        const name = trait.name.trim();
        const text = trait.text.trim();
        return name && text ? [{ name, text }] : [];
      });
      if (changes.length || resolvedTraits.length) data.monsterStatBlock = { changes, traits: resolvedTraits };
      else delete data.monsterStatBlock;
    } else {
      delete data.monsterStatBlock;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave({ ...entry, name, description: notes, data, ...(type.trim() ? { type: type.trim() } : { type: undefined }) });
      onCancel();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the custom item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="custom-catalogue-editor custom-item-editor" aria-label={mode === 'create' ? 'Create custom item' : 'Edit custom item'}>
      <header>
        <p className="eyebrow">Campaign-owned item</p>
        <h2>{mode === 'create' ? 'Create item' : 'Edit custom item'}</h2>
        <p>Create reusable magic loot here. Its stat changes apply only when it is equipped in an Encounter.</p>
      </header>

      <label>Name<input aria-label="Item name" onChange={(event) => setName(event.target.value)} value={name} /></label>
      <label>Type or subtitle<input onChange={(event) => setType(event.target.value)} placeholder="Very rare magic weapon" value={type} /></label>

      <label className="custom-item-kind-control">
        <span>Item kind</span>
        <select aria-label="Item kind" onChange={(event) => setItemKind(event.target.value as ItemKind)} value={itemKind}>
          <option value="item">Other item</option>
          <option value="magic-item">Magic item</option>
          <option value="magic-weapon">Magic weapon</option>
        </select>
      </label>

      {isMagicWeapon && (
        <section className="custom-item-magic-weapon" aria-label="Magic weapon details">
          <header><h3>Magic weapon details</h3><p>These fields appear in an equipped monster’s stat block.</p></header>
          <label>Short description<textarea aria-label="Magic weapon short description" onChange={(event) => setShortDescription(event.target.value)} placeholder="A black-lacquered blade that hums in rain." value={shortDescription} /></label>
          <label>What it does<textarea aria-label="Magic weapon effects" onChange={(event) => setEffectText(event.target.value)} placeholder="The weapon is a +1 magic weapon." value={effectText} /></label>
          <fieldset className="custom-item-weapon-modifiers">
            <legend>Weapon modifiers</legend>
            <label>Attack bonus<input aria-label="Magic weapon attack bonus" inputMode="numeric" onChange={(event) => setAttackBonus(event.target.value)} type="number" value={attackBonus} /></label>
            <label>Damage bonus<input aria-label="Magic weapon damage bonus" inputMode="numeric" onChange={(event) => setDamageBonus(event.target.value)} type="number" value={damageBonus} /></label>
            <label>Extra damage dice<input aria-label="Magic weapon extra damage dice" onChange={(event) => setExtraDamageDice(event.target.value)} placeholder="1d6" value={extraDamageDice} /></label>
            <label>Extra damage type<input aria-label="Magic weapon extra damage type" onChange={(event) => setExtraDamageType(event.target.value)} placeholder="lightning" value={extraDamageType} /></label>
          </fieldset>
        </section>
      )}

      {isEncounterItem && (
        <section className="custom-item-stat-block" aria-label="Encounter stat block changes">
          <header><h3>Encounter stat block changes</h3><p>These modifiers affect only the equipped monster in an Encounter. Use traits for special properties that should appear in its stat block.</p></header>
          <div className="custom-item-stat-change-list">
            {statChanges.map((change, index) => {
              const definition = monsterStatChangeDefinitions.find((item) => item.field === change.field) ?? monsterStatChangeDefinitions[0];
              return (
                <div className="custom-item-stat-change" key={`${change.field}-${index}`}>
                  <label>Stat
                    <select aria-label={`Stat change ${index + 1} target`} onChange={(event) => updateStatField(index, event.target.value as MonsterStatField)} value={change.field}>
                      {monsterStatChangeDefinitions.map((item) => <option key={item.field} value={item.field}>{item.label}</option>)}
                    </select>
                  </label>
                  <label>Change
                    <select aria-label={`Stat change ${index + 1} operation`} disabled={!definition.canAdd} onChange={(event) => updateStatChange(index, { operation: event.target.value as EditableStatChange['operation'] })} value={definition.canAdd ? change.operation : 'set'}>
                      {definition.canAdd && <option value="add">Add</option>}
                      <option value="set">Set to</option>
                    </select>
                  </label>
                  <label>{definition.valueType === 'number' ? 'Value' : 'Text'}
                    <input aria-label={`Stat change ${index + 1} value`} inputMode={definition.valueType === 'number' ? 'numeric' : undefined} onChange={(event) => updateStatChange(index, { value: event.target.value })} type={definition.valueType === 'number' ? 'number' : 'text'} value={change.value} />
                  </label>
                  <button aria-label={`Remove stat change ${index + 1}`} onClick={() => removeStatChange(index)} type="button">Remove</button>
                </div>
              );
            })}
          </div>
          <button className="custom-item-add-change" onClick={addStatChange} type="button">Add stat change</button>
          <div className="custom-item-trait-list">
            {traits.map((trait, index) => (
              <div className="custom-item-trait" key={index}>
                <label>Name<input aria-label={`Added trait ${index + 1} name`} onChange={(event) => updateTrait(index, { name: event.target.value })} placeholder="Winged Boots" value={trait.name} /></label>
                <label>Trait text<textarea aria-label={`Added trait ${index + 1} text`} onChange={(event) => updateTrait(index, { text: event.target.value })} placeholder="The monster gains a Fly Speed of 30 feet." value={trait.text} /></label>
                <button aria-label={`Remove added trait ${index + 1}`} onClick={() => removeTrait(index)} type="button">Remove trait</button>
              </div>
            ))}
          </div>
          <button className="custom-item-add-change" onClick={addTrait} type="button">Add stat block trait</button>
        </section>
      )}

      <div className="custom-catalogue-description">
        <span>Full notes</span>
        <MarkdownEditor
          ariaLabel="Custom item notes"
          compact
          content={notes}
          customCatalogueCategories={customCategories}
          onChange={setNotes}
          onCreateCatalogueReference={onCreateCatalogueReference}
          onCreateWorldbuildingReference={onCreateWorldbuildingReference}
          worldbuildingTypes={worldbuildingTypes}
        />
      </div>
      {error && <p className="custom-monster-error" role="alert">{error}</p>}
      <div className="custom-monster-actions">
        <button disabled={saving} onClick={onCancel} type="button">Cancel</button>
        <button className="primary-button" disabled={saving} onClick={() => void save()} type="button">{saving ? 'Saving…' : 'Save item'}</button>
      </div>
    </section>
  );
}
