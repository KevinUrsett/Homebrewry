import { useState } from 'react';
import { dataRecord, dataRecords, dataString, speedText } from '../catalogue/presentation';
import type { CustomCatalogueEntry } from '../catalogue/types';

type FeatureKey = 'traits' | 'actions' | 'bonusActions' | 'reactions' | 'legendaryActions';

type CustomMonsterEditorProps = {
  entry: CustomCatalogueEntry;
  mode: 'create' | 'edit';
  onCancel: () => void;
  onSave: (entry: CustomCatalogueEntry) => Promise<void>;
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

export function CustomMonsterEditor({ entry, mode, onCancel, onSave }: CustomMonsterEditorProps) {
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

      <label className="custom-monster-description">Description<textarea onChange={(event) => setDescription(event.target.value)} placeholder="Optional lore or encounter notes." value={description} /></label>

      <section className="custom-monster-features" aria-label="Monster features">
        {featureGroups.map(({ key, label, hint }) => (
          <label key={key}>{label}<small>{hint}; one per line.</small><textarea onChange={(event) => setFeatures((current) => ({ ...current, [key]: event.target.value }))} value={features[key]} /></label>
        ))}
      </section>

      {error && <p className="custom-monster-error" role="alert">{error}</p>}
      <div className="custom-monster-actions">
        <button disabled={saving} onClick={onCancel} type="button">Cancel</button>
        <button className="primary-button" disabled={saving} onClick={() => void save()} type="button">{saving ? 'Saving…' : 'Save monster'}</button>
      </div>
    </section>
  );
}
