import { useRef, useState } from 'react';

type ImportDialogProps = {
  onClose: () => void;
  onImport: (source: string) => void;
};

export function ImportDialog({ onClose, onImport }: ImportDialogProps) {
  const [source, setSource] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="import-backdrop" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <section className="import-dialog">
        <p className="eyebrow">Import source</p>
        <h2 id="import-title">Bring in an existing brew</h2>
        <p>Paste Markdown or Homebrewery-style source. Unsupported syntax stays in the document and is reported after import.</p>
        <textarea aria-label="Source to import" onChange={(event) => setSource(event.target.value)} placeholder="# My brew" value={source} />
        <input
          accept=".md,.markdown,.txt"
          className="visually-hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file) setSource(await file.text());
            event.target.value = '';
          }}
          ref={fileInputRef}
          type="file"
        />
        <div className="import-actions">
          <button onClick={() => fileInputRef.current?.click()} type="button">Choose text file</button>
          <span />
          <button onClick={onClose} type="button">Cancel</button>
          <button className="primary-button" disabled={!source.trim()} onClick={() => onImport(source)} type="button">Import as new brew</button>
        </div>
      </section>
    </div>
  );
}
