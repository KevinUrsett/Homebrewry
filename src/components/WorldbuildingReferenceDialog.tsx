import { useEffect } from 'react';
import type { WorldbuildingEntry, WorldbuildingType } from '../types';
import { WorldbuildingReferenceDetails } from './WorldbuildingReferenceDetails';

type WorldbuildingReferenceDialogProps = {
  entry: WorldbuildingEntry;
  types?: readonly WorldbuildingType[];
  onClose: () => void;
  onOpenInWorldbuilding: () => void;
};

export function WorldbuildingReferenceDialog({ entry, types, onClose, onOpenInWorldbuilding }: WorldbuildingReferenceDialogProps) {
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
        aria-labelledby="worldbuilding-reference-title"
        aria-modal="true"
        className="reference-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="reference-dialog-header">
          <span>Worldbuilding reference</span>
          <button aria-label="Close Worldbuilding reference" onClick={onClose} type="button">×</button>
        </div>
        <div id="worldbuilding-reference-title"><WorldbuildingReferenceDetails entry={entry} types={types} /></div>
        <div className="reference-dialog-actions">
          <button onClick={onClose} type="button">Close</button>
          <button className="primary-button" onClick={onOpenInWorldbuilding} type="button">Open in Worldbuilding</button>
        </div>
      </section>
    </div>
  );
}
