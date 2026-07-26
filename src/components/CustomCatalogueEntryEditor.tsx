import { useState } from 'react';
import type { CustomCatalogueEntry } from '../catalogue/types';

type CustomCatalogueEntryEditorProps = {
  categoryLabel: string;
  entry: CustomCatalogueEntry;
  mode: 'create' | 'edit';
  onCancel: () => void;
  onSave: (entry: CustomCatalogueEntry) => Promise<void>;
};

export function CustomCatalogueEntryEditor({ categoryLabel, entry, mode, onCancel, onSave }: CustomCatalogueEntryEditorProps) {
  const [name, setName] = useState(entry.name);
  const [type, setType] = useState(entry.type ?? '');
  const [description, setDescription] = useState(entry.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      await onSave({ ...entry, name, description, ...(type.trim() ? { type: type.trim() } : { type: undefined }) });
      onCancel();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the catalogue entry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="custom-catalogue-editor" aria-label={mode === 'create' ? `Create ${categoryLabel} entry` : `Edit ${categoryLabel} entry`}>
      <header>
        <p className="eyebrow">Campaign-owned {categoryLabel}</p>
        <h2>{mode === 'create' ? 'Create entry' : 'Edit entry'}</h2>
        <p>This entry is private to this campaign and syncs through the campaign data file.</p>
      </header>
      <label>Name<input aria-label="Catalogue entry name" onChange={(event) => setName(event.target.value)} value={name} /></label>
      <label>Type or subtitle<input onChange={(event) => setType(event.target.value)} placeholder="Optional classification" value={type} /></label>
      <label>Description<textarea onChange={(event) => setDescription(event.target.value)} placeholder="Rules, lore, mechanics, or notes…" value={description} /></label>
      {error && <p className="custom-monster-error" role="alert">{error}</p>}
      <div className="custom-monster-actions">
        <button disabled={saving} onClick={onCancel} type="button">Cancel</button>
        <button className="primary-button" disabled={saving} onClick={() => void save()} type="button">{saving ? 'Saving…' : 'Save entry'}</button>
      </div>
    </section>
  );
}
