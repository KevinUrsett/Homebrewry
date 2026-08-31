import { useState } from 'react';
import { magicWeaponForItem } from '../catalogue/magicItems';
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

export function CustomItemEditor({ entry, mode, onCancel, onSave, customCategories, worldbuildingTypes, onCreateWorldbuildingReference, onCreateCatalogueReference }: CustomItemEditorProps) {
  const existingMagicWeapon = magicWeaponForItem(entry);
  const [name, setName] = useState(entry.name);
  const [type, setType] = useState(entry.type ?? '');
  const [notes, setNotes] = useState(entry.description);
  const [isMagicWeapon, setIsMagicWeapon] = useState(Boolean(existingMagicWeapon));
  const [shortDescription, setShortDescription] = useState(existingMagicWeapon?.shortDescription ?? '');
  const [effectText, setEffectText] = useState(existingMagicWeapon?.effectText ?? '');
  const [attackBonus, setAttackBonus] = useState(String(existingMagicWeapon?.attackBonus ?? 0));
  const [damageBonus, setDamageBonus] = useState(String(existingMagicWeapon?.damageBonus ?? 0));
  const [extraDamageDice, setExtraDamageDice] = useState(existingMagicWeapon?.extraDamageDice ?? '');
  const [extraDamageType, setExtraDamageType] = useState(existingMagicWeapon?.extraDamageType ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <p>Create reusable gear here. A magic weapon can then be equipped by any campaign-owned monster.</p>
      </header>

      <label>Name<input aria-label="Item name" onChange={(event) => setName(event.target.value)} value={name} /></label>
      <label>Type or subtitle<input onChange={(event) => setType(event.target.value)} placeholder="Very rare magic weapon" value={type} /></label>

      <label className="custom-item-kind-control">
        <span>Item kind</span>
        <select aria-label="Item kind" onChange={(event) => setIsMagicWeapon(event.target.value === 'magic-weapon')} value={isMagicWeapon ? 'magic-weapon' : 'item'}>
          <option value="item">Other item</option>
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
