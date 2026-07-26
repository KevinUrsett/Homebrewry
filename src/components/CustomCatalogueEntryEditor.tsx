import { useState } from 'react';
import type { CatalogueCategory, CustomCatalogueCategory, CustomCatalogueEntry } from '../catalogue/types';
import { MarkdownEditor } from './MarkdownEditor';
import type { WorldbuildingKind, WorldbuildingType } from '../types';

type CustomCatalogueEntryEditorProps = {
  categoryLabel: string;
  entry: CustomCatalogueEntry;
  mode: 'create' | 'edit';
  onCancel: () => void;
  onSave: (entry: CustomCatalogueEntry) => Promise<void>;
  customCategories: readonly CustomCatalogueCategory[];
  worldbuildingTypes: readonly WorldbuildingType[];
  onCreateWorldbuildingReference: (name: string, kind: WorldbuildingKind) => Promise<string | null> | string | null;
  onCreateCatalogueReference: (name: string, category: CatalogueCategory) => Promise<string | null> | string | null;
};

export function CustomCatalogueEntryEditor({ categoryLabel, entry, mode, onCancel, onSave, customCategories, worldbuildingTypes, onCreateWorldbuildingReference, onCreateCatalogueReference }: CustomCatalogueEntryEditorProps) {
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
      <div className="custom-catalogue-description">
        <span>Description</span>
        <MarkdownEditor
          ariaLabel="Catalogue entry description"
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
      {error && <p className="custom-monster-error" role="alert">{error}</p>}
      <div className="custom-monster-actions">
        <button disabled={saving} onClick={onCancel} type="button">Cancel</button>
        <button className="primary-button" disabled={saving} onClick={() => void save()} type="button">{saving ? 'Saving…' : 'Save entry'}</button>
      </div>
    </section>
  );
}
