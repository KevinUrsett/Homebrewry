import { memo, useId, useLayoutEffect, useRef, useState } from 'react';
import { dungeonCardDetails } from '../lib/dungeonReferences';
import { dungeonMapName, dungeonRooms } from '../lib/dungeons';
import type { BrewAsset, DungeonRecord } from '../types';
import { DungeonRoomMap, DungeonRoomText } from './DungeonRoomContent';
import '../brew-dungeon.css';

export type BrewDungeonCardState = {
  expanded: boolean;
  foldedRooms: ReadonlySet<string>;
};

const closedCard: BrewDungeonCardState = { expanded: false, foldedRooms: new Set() };

function BrewDungeonContent({ dungeon, id, assets, foldedRooms, onFold }: {
  dungeon: DungeonRecord;
  id: string;
  assets?: ReadonlyMap<string, BrewAsset>;
  foldedRooms: ReadonlySet<string>;
  onFold: (key: string, folded: boolean) => void;
}) {
  const section = useRef<HTMLDivElement>(null);
  const rooms = dungeonRooms(dungeon);
  const jumpToRoom = (roomId: string) => {
    const room = Array.from(section.current?.querySelectorAll<HTMLDetailsElement>('.brew-dungeon-room') ?? [])
      .find((element) => element.dataset.roomId === roomId);
    if (!room) return;
    room.open = true;
    room.querySelector('summary')?.focus({ preventScroll: true });
    room.scrollIntoView({ block: 'start' });
  };

  return (
    <div className="brew-dungeon-content" id={id} ref={section}>
      {dungeon.areas.filter((area) => area.imageSource).map((map, index) => (
        <div className="brew-dungeon-map" key={map.id}>
          <DungeonRoomMap area={map} label={dungeonMapName(map, index)}
            asset={map.imageSource?.startsWith('asset://') ? assets?.get(map.imageSource.slice(8)) : undefined}
            empty={() => <p className="dungeon-empty-note">Map unavailable on this device.</p>}
            key={map.imageSource} onSelect={jumpToRoom} />
        </div>
      ))}
      {rooms.map(({ room }) => (
        <details className="brew-dungeon-room" data-room-id={room.id} key={room.id} open={!foldedRooms.has(room.id)}
          onToggle={(event) => onFold(room.id, !event.currentTarget.open)}>
          <summary><strong>{room.name.trim() || 'Untitled room'}</strong></summary>
          <div className="brew-dungeon-room-text"><DungeonRoomText room={room} heading="h4" /></div>
        </details>
      ))}
      {!rooms.length && <p className="dungeon-empty-note">No rooms in this dungeon yet.</p>}
    </div>
  );
}

export const BrewDungeonCard = memo(function BrewDungeonCard({ dungeon, label, anchor, assets, interactive = true, initialState = closedCard, onStateChange, onBrowse }: {
  dungeon?: DungeonRecord;
  label: string;
  anchor?: string;
  assets?: ReadonlyMap<string, BrewAsset>;
  interactive?: boolean;
  initialState?: BrewDungeonCardState;
  onStateChange?: (state: BrewDungeonCardState) => void;
  onBrowse?: () => void;
}) {
  const [state, setState] = useState(initialState);
  const bodyId = useId();
  const summaryId = useId();
  const { name, summary, actionLabel } = dungeonCardDetails(dungeon, label);
  const expanded = Boolean(interactive && dungeon && state.expanded);
  const details = (
    <span className="brew-dungeon-title">
      <strong>{name}</strong>
      <span className="brew-dungeon-caption" id={summaryId}>{dungeon ? `Dungeon · ${summary}` : summary}</span>
    </span>
  );

  useLayoutEffect(() => { onStateChange?.(state); }, [onStateChange, state]);

  const foldRoom = (key: string, folded: boolean) => {
    setState((current) => {
      if (!current.expanded || current.foldedRooms.has(key) === folded) return current;
      const foldedRooms = new Set(current.foldedRooms);
      if (folded) foldedRooms.add(key);
      else foldedRooms.delete(key);
      return { ...current, foldedRooms };
    });
  };

  return (
    <section className={`brew-dungeon-card-shell${expanded ? ' is-expanded' : ''}`} id={anchor}>
      {interactive && (dungeon || onBrowse) ? (
        <button aria-controls={expanded ? bodyId : undefined} aria-describedby={summaryId}
          aria-expanded={dungeon ? expanded : undefined} aria-label={expanded ? `Collapse ${name}` : actionLabel}
          className="brew-dungeon-header"
          onClick={dungeon ? () => setState((current) => current.expanded ? closedCard : { ...closedCard, expanded: true }) : onBrowse} type="button">
          {details}
          {!dungeon && <span className="brew-dungeon-browse">Browse dungeons</span>}
        </button>
      ) : <div className="brew-dungeon-header">{details}</div>}
      {expanded && dungeon && <BrewDungeonContent assets={assets} dungeon={dungeon} foldedRooms={state.foldedRooms} id={bodyId} onFold={foldRoom} />}
    </section>
  );
});
