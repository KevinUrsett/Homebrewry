import { useRef, useState } from 'react';
import type { PrivateMonsterImportReport } from '../lib/privateMonsterImport';

type PrivateMonsterImportDialogProps = {
  existingCount: number;
  onClear: () => Promise<void>;
  onClose: () => void;
  onImport: (file: File) => Promise<PrivateMonsterImportReport>;
};

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

export function PrivateMonsterImportDialog({ existingCount, onClear, onClose, onImport }: PrivateMonsterImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PrivateMonsterImportReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importArchive = async () => {
    if (!file) return;
    if (existingCount > 0 && !window.confirm(`Replace the ${pluralize(existingCount, 'private monster')} in this catalogue? This cannot be undone.`)) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const nextReport = await onImport(file);
      setReport(nextReport);
    } catch (cause) {
      setReport(null);
      setError(cause instanceof Error ? cause.message : 'The monster archive could not be imported.');
    } finally {
      setBusy(false);
    }
  };

  const clearArchive = async () => {
    if (!existingCount || !window.confirm(`Remove the ${pluralize(existingCount, 'private monster')} from this catalogue? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onClear();
      setReport(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The private monster catalogue could not be removed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="import-backdrop" role="dialog" aria-modal="true" aria-labelledby="private-monster-import-title">
      <section className="import-dialog private-monster-import-dialog">
        <p className="eyebrow">Private catalogue</p>
        <h2 id="private-monster-import-title">Import a monster archive</h2>
        <p>
          This imports <strong>monsters.json</strong> from a compatible ZIP into your private catalogue. When Drive is connected, it is backed up to a separate private Drive file for your other devices.
        </p>
        <p className="private-import-note">
          Artwork inside the archive is not copied. Imported data never enters brew files, GitHub, or the public app bundle.
        </p>

        <input
          accept=".zip,application/zip,application/x-zip-compressed"
          className="visually-hidden"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setError(null);
            setReport(null);
            event.target.value = '';
          }}
          ref={fileInputRef}
          type="file"
        />
        <div className="private-import-file-row">
          <button disabled={busy} onClick={() => fileInputRef.current?.click()} type="button">Choose ZIP file</button>
          <span>{file ? file.name : 'No archive selected'}</span>
        </div>

        {error && <p className="private-import-error" role="alert">{error}</p>}
        {report && (
          <p className="private-import-success" role="status">
            Imported {pluralize(report.importedCount, 'private monster')}. Skipped {pluralize(report.skippedExistingCount, 'existing record')} and {pluralize(report.skippedInvalidCount, 'invalid record')}. {pluralize(report.imageFileCount, 'image file')} were left in the archive.
          </p>
        )}

        <div className="import-actions private-import-actions">
          <button className="quiet-danger" disabled={busy || !existingCount} onClick={() => void clearArchive()} type="button">Remove private monsters</button>
          <span />
          <button disabled={busy} onClick={onClose} type="button">Close</button>
          <button className="primary-button" disabled={busy || !file} onClick={() => void importArchive()} type="button">
            {busy ? 'Importing…' : existingCount ? 'Replace private monsters' : 'Import privately'}
          </button>
        </div>
      </section>
    </div>
  );
}
