import { memo, useId, useLayoutEffect, useRef, useState } from 'react';
import { dungeonCardDetails } from '../lib/dungeonReferences';
import { roomNumber } from '../lib/dungeons';
import type { BrewAsset, DungeonArea, DungeonRecord } from '../types';
import { DungeonRoomMap, DungeonRoomText } from './DungeonRoomContent';
import '../brew-dungeon.css';

export type BrewDungeonCardState = {
  expanded: boolean;
  foldedRooms: ReadonlySet<string>;
};

const closedCard: BrewDungeonCardState = { expanded: false, foldedRooms: new Set() };

function BrewDungeonArea({ area, assets, foldedRooms, onFold }: {
  area: DungeonArea;
  assets?: ReadonlyMap<string, BrewAsset>;
  foldedRooms: ReadonlySet<string>;
  onFold: (key: string, folded: boolean) => void;
}) {
  const section = useRef<HTMLElement>(null);
  const asset = area.imageSource?.startsWith('asset://') ? assets?.get(area.imageSource.slice(8)) : undefined;
  const rooms = [...area.rooms].sort((left, right) => left.number - right.number);
  const jumpToRoom = (roomId: string) => {
    const room = Array.from(section.current?.querySelectorAll<HTMLDetailsElement>('.brew-dungeon-room') ?? [])
      .find((element) => element.dataset.roomId === roomId);
    if (!room) return;
    room.open = true;
    room.querySelector('summary')?.focus({ preventScroll: true });
    room.scrollIntoView({ block: 'start' });
  };

  return (
    <section className="brew-dungeon-area" ref={section}>
      <h3 className="brew-dungeon-area-heading">{area.name.trim() || 'Untitled area'}</h3>
      {area.imageSource && <div className="brew-dungeon-map">
        <DungeonRoomMap area={area} asset={asset} empty={() => <p className="dungeon-empty-note">Map unavailable on this device.</p>}
          key={area.imageSource} onSelect={jumpToRoom} />
      </div>}
      {rooms.map((room) => {
        const key = JSON.stringify([area.id, room.id]);
        return (
          <details className="brew-dungeon-room" data-room-id={room.id} key={room.id} open={!foldedRooms.has(key)}
            onToggle={(event) => onFold(key, !event.currentTarget.open)}>
            <summary><span className="brew-dungeon-room-number">{roomNumber(room)}</span><strong>{room.name.trim() || 'Untitled room'}</strong></summary>
            <div className="brew-dungeon-room-text"><DungeonRoomText room={room} heading="h4" /></div>
          </details>
        );
      })}
      {!rooms.length && <p className="dungeon-empty-note">No rooms in this area yet.</p>}
    </section>
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
  const { name, summary, action, actionLabel, missing } = dungeonCardDetails(dungeon, label);
  const expanded = Boolean(interactive && dungeon && state.expanded);
  const className = `brew-map-card${missing ? ' is-missing' : ''}`;
  const details = (
    <span className="brew-map-card-details">
      <small>Dungeon</small>
      <strong>{name}</strong>
      <span>{summary}</span>
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

  if (!interactive || (!dungeon && !onBrowse)) return <section className={className} id={anchor}>{details}</section>;

  return (
    <section className={`brew-dungeon-card-shell${expanded ? ' is-expanded' : ''}`} id={anchor}>
      <button aria-controls={expanded ? bodyId : undefined} aria-expanded={dungeon ? expanded : undefined}
        aria-label={expanded ? `Collapse ${name}` : actionLabel} className={className}
        onClick={dungeon ? () => setState((current) => current.expanded ? closedCard : { ...closedCard, expanded: true }) : onBrowse} type="button">
        {details}
        <span className="primary-button brew-map-card-action">{expanded ? 'Collapse' : action}</span>
      </button>
      {expanded && dungeon && <div className="brew-dungeon-content" id={bodyId}>
        {dungeon.areas.map((area) => <BrewDungeonArea area={area} assets={assets} foldedRooms={state.foldedRooms} key={area.id} onFold={foldRoom} />)}
        {!dungeon.areas.length && <p className="dungeon-empty-note">No areas in this dungeon yet.</p>}
      </div>}
    </section>
  );
});
