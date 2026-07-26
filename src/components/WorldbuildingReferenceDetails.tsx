import { worldbuildingKindLabel } from '../lib/worldbuilding';
import type { WorldbuildingEntry, WorldbuildingType } from '../types';

type WorldbuildingReferenceDetailsProps = {
  compact?: boolean;
  entry: WorldbuildingEntry;
  types?: readonly WorldbuildingType[];
};

function excerpt(notes: string, compact: boolean): string {
  const value = notes
    .replace(/\[\[[a-z][a-z0-9-]*:[0-9a-f-]+\|([^\]\r\n]+)\]\]/gi, '$1')
    .trim()
    .replace(/\s+/g, ' ');
  if (!compact || value.length <= 360) return value;
  return `${value.slice(0, 357).trimEnd()}…`;
}

export function WorldbuildingReferenceDetails({ compact = false, entry, types = [] }: WorldbuildingReferenceDetailsProps) {
  const notes = excerpt(entry.notes, compact);
  return (
    <article className={`worldbuilding-reference-details ${compact ? 'is-compact' : ''}`}>
      <p className="eyebrow">{worldbuildingKindLabel(entry.kind, types)}</p>
      <strong>{entry.name}</strong>
      {entry.aliases.length > 0 && <span className="worldbuilding-reference-aliases">Also known as {entry.aliases.join(' · ')}</span>}
      {notes ? <p className="worldbuilding-reference-notes">{notes}</p> : <p className="worldbuilding-reference-empty">No notes yet.</p>}
    </article>
  );
}
