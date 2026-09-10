import { useState } from 'react';

type RenameBrewDialogProps = {
  title: string;
  onCancel: () => void;
  onRename: (title: string) => Promise<void> | void;
};

export function RenameBrewDialog({ title, onCancel, onRename }: RenameBrewDialogProps) {
  const [draft, setDraft] = useState(title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const nextTitle = draft.trim();

  const submit = async () => {
    if (!nextTitle || saving) return;
    setSaving(true);
    setError('');
    try {
      await onRename(nextTitle);
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : 'The brew could not be renamed.');
      setSaving(false);
    }
  };

  return (
    <div className="rename-brew-backdrop" onMouseDown={() => !saving && onCancel()} role="presentation">
      <form
        aria-labelledby="rename-brew-title"
        aria-modal="true"
        className="rename-brew-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => { event.preventDefault(); void submit(); }}
        role="dialog"
      >
        <p className="eyebrow">Brew library</p>
        <h2 id="rename-brew-title">Rename brew</h2>
        <label htmlFor="rename-brew-input">Brew name</label>
        <input
          autoFocus
          id="rename-brew-input"
          maxLength={160}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          value={draft}
        />
        {error && <p aria-live="polite" className="rename-brew-error">{error}</p>}
        <div className="rename-brew-actions">
          <button disabled={saving} onClick={onCancel} type="button">Cancel</button>
          <button className="primary-button" disabled={!nextTitle || saving} type="submit">{saving ? 'Saving…' : 'Rename'}</button>
        </div>
      </form>
    </div>
  );
}
