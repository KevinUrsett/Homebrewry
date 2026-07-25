import { useEffect } from 'react';
import type { CatalogueEntry } from '../catalogue/types';
import { CatalogueEntryDetails } from './CatalogueEntryDetails';

type ReferenceDialogProps = {
  entry: CatalogueEntry;
  onClose: () => void;
  onOpenInCatalogue: () => void;
};

export function ReferenceDialog({ entry, onClose, onOpenInCatalogue }: ReferenceDialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="reference-backdrop" onMouseDown={onClose} role="presentation">
      <section
        aria-labelledby="reference-title"
        aria-modal="true"
        className="reference-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="reference-dialog-header">
          <span>Reference</span>
          <button aria-label="Close reference" onClick={onClose} type="button">×</button>
        </div>
        <div id="reference-title"><CatalogueEntryDetails entry={entry} /></div>
        <div className="reference-dialog-actions">
          <button onClick={onClose} type="button">Close</button>
          <button className="primary-button" onClick={onOpenInCatalogue} type="button">Open in catalogue</button>
        </div>
      </section>
    </div>
  );
}
