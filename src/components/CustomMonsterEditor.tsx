import { useState } from 'react';
import { magicWeaponItems, monsterEquipment, monsterWeaponActions, type MonsterWeaponAction } from '../catalogue/magicItems';
import { dataRecord, dataRecords, dataString, speedText } from '../catalogue/presentation';
import type { CatalogueCategory, CatalogueEntry, CustomCatalogueCategory, CustomCatalogueEntry } from '../catalogue/types';
import { MarkdownEditor } from './MarkdownEditor';
import type { WorldbuildingKind, WorldbuildingType } from '../types';

type FeatureKey = 'traits' | 'actions' | 'bonusActions' | 'reactions' | 'legendaryActions';

type CustomMonsterEditorProps = {
  entry: CustomCatalogueEntry;
  mode: 'create' | 'edit';
  onCancel: () => void;
  onSave: (entry: CustomCatalogueEntry) => Promise<void>;
  equipmentItems: readonly CatalogueEntry[];
  customCategories: readonly CustomCatalogueCategory[];
  worldbuildingTypes: readonly WorldbuildingType[];
  onCreateWorldbuildingReference: (name: string, kind: WorldbuildingKind) => Promise<string | null> | string | null;
  onCreateCatalogueReference: (name: string, category: CatalogueCategory) => Promise<string | null> | string | null;
};

const abilityKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const featureGroups: Array<{ key: FeatureKey; label: string; hint: string }> = [
  { key: 'traits', label: 'Traits', hint: 'Name | rules text' },
  { key: 'actions', label: 'Actions', hint: 'Name | rules text' },
  { key: 'bonusActions', label: 'Bonus actions', hint: 'Name | rules text' },
  { key: 'reactions', label: 'Reactions', hint: 'Name | rules text' },
  { key: 'legendaryActions', label: 'Legendary actions', hint: 'Name | rules text' }
];

function stringField(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function featureText(entry: CustomCatalogueEntry, key: FeatureKey): string {
  return dataRecords(entry, key)
    .flatMap((feature) => {
      const name = stringField(feature.name).trim();
      const usage = stringField(feature.usage).trim();
      const text = stringField(feature.text).trim();
      if (!name && !text) return [];
      const label = usage ? `${name || 'Feature'} (${usage})` : name || 'Feature';
      return [text ? `${label} | ${text}` : label];
    })
    .join('\n');
}

function parseFeatures(value: string): Array<Record<string, string>> {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 100)
    .map((line) => {
      const divider = line.indexOf('|');
      const name = (divider === -1 ? line : line.slice(0, divider)).trim() || 'Feature';
      const text = divider === -1 ? '' : line.slice(divider + 1).trim();
      return { name, text };
    });
}

function initialAbilityScores(entry: CustomCatalogueEntry) {
  const abilities = dataRecord(entry, 'abilities');
  return Object.fromEntries(abilityKeys.map((key) => [key, stringField(abilities[key])])) as Record<(typeof abilityKeys)[number], string>;
}

function initialSpeed(entry: CustomCatalogueEntry): string {
  return stringField(entry.data.speed) || speedText(entry);
}

function setDataText(data: Record<string, unknown>, key: string, value: string) {
  const text = value.trim();
  if (text) data[key] = text;
  else delete data[key];
}

export function CustomMonsterEditor({ entry, mode, onCancel, onSave, equipmentItems, customCategories, worldbuildingTypes, onCreateWorldbuildingReference, onCreateCatalogueReference }: CustomMonsterEditorProps) {
  const [name, setName] = useState(entry.name);
  const [description, setDescription] = useState(entry.description);
  const [size, setSize] = useState(dataString(entry, 'size') ?? '');
  const [type, setType] = useState(dataString(entry, 'type') ?? '');
  const [alignment, setAlignment] = useState(dataString(entry, 'alignment') ?? '');
  const [armorClass, setArmorClass] = useState(dataString(entry, 'ac') ?? '');
  const [hitPoints, setHitPoints] = useState(dataString(entry, 'hp') ?? '');
  const [speed, setSpeed] = useState(() => initialSpeed(entry));
  const [challenge, setChallenge] = useState(dataString(entry, 'cr') ?? '');
  const [abilities, setAbilities] = useState(() => initialAbilityScores(entry));
  const [features, setFeatures] = useState<Record<FeatureKey, string>>(() => ({
    traits: featureText(entry, 'traits'),
    actions: featureText(entry, 'actions'),
    bonusActions: featureText(entry, 'bonusActions'),
    reactions: featureText(entry, 'reactions'),
    legendaryActions: featureText(entry, 'legendaryActions')
  }));
  const actionRecords = parseFeatures(features.actions);
  const magicWeapons = magicWeaponItems(equipmentItems);
  const [equipment, setEquipment] = useState(() => monsterEquipment(entry));
  const [equipmentToAdd, setEquipmentToAdd] = useState('');
  const [weaponActions, setWeaponActions] = useState(() => monsterWeaponActions(entry));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const data: Record<string, unknown> = { ...entry.data };
    setDataText(data, 'size', size);
    setDataText(data, 'type', type);
    setDataText(data, 'alignment', alignment);
    setDataText(data, 'ac', armorClass);
    setDataText(data, 'hp', hitPoints);
    setDataText(data, 'speed', speed);
    setDataText(data, 'cr', challenge);

    const nextAbilities: Record<string, number> = {};
    for (const ability of abilityKeys) {
      const score = Number(abilities[ability]);
      if (abilities[ability].trim() && Number.isFinite(score)) nextAbilities[ability] = score;
    }
    if (Object.keys(nextAbilities).length) data.abilities = nextAbilities;
    else delete data.abilities;

    for (const { key } of featureGroups) {
      const records = parseFeatures(features[key]);
      if (records.length) data[key] = records;
      else delete data[key];
    }

    if (equipment.length) data.equipment = equipment;
    else delete data.equipment;
    if (weaponActions.length) data.weaponActions = weaponActions;
    else delete data.weaponActions;

    try {
      setSaving(true);
      setError(null);
      await onSave({ ...entry, name, description, data });
      onCancel();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the custom monster.');
    } finally {
      setSaving(false);
    }
  };

  const addEquipment = () => {
    const item = magicWeapons.find((candidate) => candidate.id === equipmentToAdd);
    if (!item || equipment.some((current) => current.itemId === item.id)) return;
    const likelyWeaponActions = actionRecords.flatMap((action, index) => /(?:Melee|Ranged)(?:\s+Weapon)?\s+Attack(?:\s+Roll)?/i.test(action.text) ? [index] : []);
    setEquipment((current) => [...current, { itemId: item.id, actionIndexes: likelyWeaponActions.length === 1 ? likelyWeaponActions : [] }]);
    setEquipmentToAdd('');
  };

  const removeEquipment = (itemId: string) => {
    setEquipment((current) => current.filter((item) => item.itemId !== itemId));
    setWeaponActions((current) => current.map((action) => action.equipmentId === itemId ? { ...action, equipmentId: '' } : action));
  };

  const toggleEquipmentAction = (itemId: string, actionIndex: number, selected: boolean) => {
    setEquipment((current) => current.map((item) => {
      const actionIndexes = item.actionIndexes ?? [];
      if (item.itemId === itemId) {
        return { ...item, actionIndexes: selected ? [...new Set([...actionIndexes, actionIndex])] : actionIndexes.filter((index) => index !== actionIndex) };
      }
      return selected ? { ...item, actionIndexes: actionIndexes.filter((index) => index !== actionIndex) } : item;
    }));
  };

  const addWeaponAction = () => {
    setWeaponActions((current) => [...current, {
      id: crypto.randomUUID(),
      name: 'Weapon attack',
      attackBonus: 0,
      damageDice: '1d6',
      damageModifier: 0,
      damageType: 'slashing',
      reach: '5 ft.',
      range: '',
      text: '',
      equipmentId: equipment[0]?.itemId ?? ''
    }]);
  };

  const updateWeaponAction = <Key extends keyof MonsterWeaponAction>(id: string, key: Key, value: MonsterWeaponAction[Key]) => {
    setWeaponActions((current) => current.map((action) => action.id === id ? { ...action, [key]: value } : action));
  };

  return (
    <section className="custom-monster-editor" aria-label={mode === 'create' ? 'Create custom monster' : 'Edit custom monster'}>
      <header>
        <p className="eyebrow">Campaign-owned monster</p>
        <h2>{mode === 'create' ? 'Create monster' : 'Edit custom monster'}</h2>
        <p>Use the selected stat block as a template, then save it to your synced catalogue.</p>
      </header>

      <div className="custom-monster-core-grid">
        <label className="custom-monster-name">Name<input aria-label="Monster name" onChange={(event) => setName(event.target.value)} value={name} /></label>
        <label>Size<input onChange={(event) => setSize(event.target.value)} placeholder="Medium" value={size} /></label>
        <label>Type<input onChange={(event) => setType(event.target.value)} placeholder="humanoid" value={type} /></label>
        <label>Alignment<input onChange={(event) => setAlignment(event.target.value)} placeholder="neutral evil" value={alignment} /></label>
        <label>Armor Class<input onChange={(event) => setArmorClass(event.target.value)} placeholder="15 (natural armor)" value={armorClass} /></label>
        <label>Hit Points<input onChange={(event) => setHitPoints(event.target.value)} placeholder="45 (6d8 + 18)" value={hitPoints} /></label>
        <label>Speed<input onChange={(event) => setSpeed(event.target.value)} placeholder="walk 30 ft., fly 60 ft." value={speed} /></label>
        <label>Challenge<input onChange={(event) => setChallenge(event.target.value)} placeholder="3" value={challenge} /></label>
      </div>

      <fieldset className="custom-monster-abilities">
        <legend>Ability scores</legend>
        {abilityKeys.map((ability) => (
          <label key={ability}>{ability.toUpperCase()}<input inputMode="numeric" min="0" onChange={(event) => setAbilities((current) => ({ ...current, [ability]: event.target.value }))} type="number" value={abilities[ability]} /></label>
        ))}
      </fieldset>

      <div className="custom-monster-description">
        <span>Description</span>
        <MarkdownEditor
          ariaLabel="Custom monster description"
          compact
          content={description}
          customCatalogueCategories={customCategories}
          onChange={setDescription}
          onCreateCatalogueReference={onCreateCatalogueReference}
          onCreateWorldbuildingReference={onCreateWorldbuildingReference}
          worldbuildingTypes={worldbuildingTypes}
        />
        <small>Right-click selected text to link it to Worldbuilding or the catalogue.</small>
      </div>

      <section className="custom-monster-features" aria-label="Monster features">
        {featureGroups.map(({ key, label, hint }) => (
          <label key={key}>{label}<small>{hint}; one per line.</small><textarea onChange={(event) => setFeatures((current) => ({ ...current, [key]: event.target.value }))} value={features[key]} /></label>
        ))}
      </section>

      <section className="custom-monster-equipment" aria-label="Monster magic equipment">
        <header><h3>Magic equipment</h3><p>Choose the existing statblock action that uses each weapon. Its displayed attack and damage modifiers update automatically.</p></header>
        <div className="custom-monster-equipment-add">
          <label>Magic weapon
            <select aria-label="Add magic weapon to monster" onChange={(event) => setEquipmentToAdd(event.target.value)} value={equipmentToAdd}>
              <option value="">Choose a campaign magic weapon</option>
              {magicWeapons.filter((item) => !equipment.some((current) => current.itemId === item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <button disabled={!equipmentToAdd} onClick={addEquipment} type="button">Add equipment</button>
        </div>
        {!magicWeapons.length && <p className="custom-monster-hint">Create a campaign-owned Item with Item kind: Magic weapon to equip it here.</p>}
        {equipment.length > 0 && (
          <ul className="custom-monster-equipment-list">
            {equipment.map((item) => {
              const magicWeapon = magicWeapons.find((candidate) => candidate.id === item.itemId);
              return (
                <li key={item.itemId}>
                  <div className="custom-monster-equipment-item-heading"><span><strong>{magicWeapon?.name ?? 'Missing magic weapon'}</strong><small>{magicWeapon?.type || 'This item is no longer available.'}</small></span><button aria-label={`Remove ${magicWeapon?.name ?? 'magic weapon'}`} onClick={() => removeEquipment(item.itemId)} type="button">Remove</button></div>
                  {actionRecords.length > 0 ? (
                    <fieldset className="custom-monster-equipment-targets">
                      <legend>Applies to existing Actions</legend>
                      {actionRecords.map((action, index) => <label key={`${action.name}-${index}`}><input checked={item.actionIndexes.includes(index)} onChange={(event) => toggleEquipmentAction(item.itemId, index, event.target.checked)} type="checkbox" />{action.name || `Action ${index + 1}`}</label>)}
                    </fieldset>
                  ) : <p className="custom-monster-hint">Add an Action before assigning this weapon.</p>}
                  {!item.actionIndexes.length && actionRecords.length > 0 && <p className="custom-monster-hint">Not applied to an action yet.</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="custom-monster-weapon-actions" aria-label="Monster weapon actions">
        <header><h3>Weapon actions</h3><p>Use structured weapon actions for automatic item bonuses. Existing prose actions remain unchanged.</p></header>
        {weaponActions.map((action, index) => (
          <fieldset key={action.id}>
            <legend>Weapon action {index + 1}</legend>
            <div className="custom-monster-weapon-grid">
              <label>Name<input onChange={(event) => updateWeaponAction(action.id, 'name', event.target.value)} value={action.name} /></label>
              <label>Equipped weapon
                <select aria-label={`Weapon action ${index + 1} equipment`} onChange={(event) => updateWeaponAction(action.id, 'equipmentId', event.target.value)} value={action.equipmentId}>
                  <option value="">No magic weapon</option>
                  {equipment.map((item) => <option key={item.itemId} value={item.itemId}>{magicWeapons.find((candidate) => candidate.id === item.itemId)?.name ?? 'Missing magic weapon'}</option>)}
                </select>
              </label>
              <label>Base to hit<input inputMode="numeric" onChange={(event) => updateWeaponAction(action.id, 'attackBonus', Number(event.target.value) || 0)} type="number" value={action.attackBonus} /></label>
              <label>Damage dice<input onChange={(event) => updateWeaponAction(action.id, 'damageDice', event.target.value)} placeholder="1d8" value={action.damageDice} /></label>
              <label>Base damage modifier<input inputMode="numeric" onChange={(event) => updateWeaponAction(action.id, 'damageModifier', Number(event.target.value) || 0)} type="number" value={action.damageModifier} /></label>
              <label>Damage type<input onChange={(event) => updateWeaponAction(action.id, 'damageType', event.target.value)} placeholder="slashing" value={action.damageType} /></label>
              <label>Reach<input onChange={(event) => updateWeaponAction(action.id, 'reach', event.target.value)} placeholder="5 ft." value={action.reach} /></label>
              <label>Range<input onChange={(event) => updateWeaponAction(action.id, 'range', event.target.value)} placeholder="20/60 ft." value={action.range} /></label>
            </div>
            <label className="custom-monster-weapon-text">Additional effect<textarea onChange={(event) => updateWeaponAction(action.id, 'text', event.target.value)} placeholder="On a hit, the target must succeed on…" value={action.text} /></label>
            <button className="quiet-danger" onClick={() => setWeaponActions((current) => current.filter((candidate) => candidate.id !== action.id))} type="button">Remove weapon action</button>
          </fieldset>
        ))}
        <button onClick={addWeaponAction} type="button">Add weapon action</button>
      </section>

      {error && <p className="custom-monster-error" role="alert">{error}</p>}
      <div className="custom-monster-actions">
        <button disabled={saving} onClick={onCancel} type="button">Cancel</button>
        <button className="primary-button" disabled={saving} onClick={() => void save()} type="button">{saving ? 'Saving…' : 'Save monster'}</button>
      </div>
    </section>
  );
}
