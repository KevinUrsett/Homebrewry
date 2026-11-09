import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createDungeonArea } from '../lib/dungeons';
import type { DungeonRoomMove } from '../lib/dungeonBrewMigration';
import type { BrewAsset, CampaignMapRoom, DungeonArea, DungeonPosition, DungeonRecord, DungeonRoomStatus, Encounter, SocialEncounter } from '../types';
import '../dungeons.css';

type Mode = 'prepare' | 'run';
type EncounterKind = 'combat' | 'social';
type RoomLink = { id: string; kind: EncounterKind; name: string; status?: string; missing: boolean };
type RoomTarget = DungeonPosition & { dungeonId: string; roomId: string };

type Props = {
  dungeons: readonly DungeonRecord[];
  dungeonId: string | null;
  assets: readonly BrewAsset[];
  encounters: readonly Encounter[];
  socialEncounters: readonly SocialEncounter[];
  mode: Mode;
  position: DungeonPosition | null;
  legacyMoves: DungeonRoomMove[];
  onSelect: (id: string) => void;
  onCreate: () => void;
  onUpdate: (id: string, update: (dungeon: DungeonRecord) => DungeonRecord) => void;
  onUpdateArea: (id: string, areaId: string, update: (area: DungeonArea) => DungeonArea) => void;
  onDelete: (id: string) => void;
  onModeChange: (mode: Mode) => void;
  onPosition: (position: DungeonPosition, status?: DungeonRoomStatus | 'unvisited') => void;
  onInsert: (dungeon: DungeonRecord) => void;
  onBackToBrew?: () => void;
  onUploadImage: (file: File) => Promise<string | null>;
  onOpenEncounter: (target: RoomTarget, encounter: RoomLink) => void;
  onCreateEncounter: (target: RoomTarget) => Promise<void>;
  onMoveRooms: (dungeonId: string, moves: DungeonRoomMove[]) => Promise<void>;
};

function roomNumber(room: CampaignMapRoom): string {
  return room.numberLabel ?? String(room.number);
}

function RoomMap({ area, asset, activeRoom, editable, placing, onPlace, onSelect, onMove }: {
  area: DungeonArea;
  asset?: BrewAsset;
  activeRoom?: CampaignMapRoom;
  editable: boolean;
  placing: boolean;
  onPlace: (point: { x: number; y: number }) => void;
  onSelect: (roomId: string) => void;
  onMove: (roomId: string, point: { x: number; y: number }) => void;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const source = area.imageSource;
  const url = useMemo(() => asset ? URL.createObjectURL(asset.blob) : source?.startsWith('https://') ? source : undefined, [asset, source]);
  useEffect(() => () => { if (asset && url) URL.revokeObjectURL(url); }, [asset, url]);
  const [failedUrl, setFailedUrl] = useState<string>();
  if (!url || url === failedUrl) {
    return <div className="maps-image-empty">{source ? 'Map image unavailable on this device.' : 'Add a map image to place pins.'}</div>;
  }

  const pointAt = (event: PointerEvent) => {
    const rect = canvas.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    return {
      x: Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)),
      y: Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100))
    };
  };
  const roomsById = new Map(area.rooms.map((room) => [room.id, room]));

  return (
    <div className={`maps-canvas${placing ? ' is-placing' : ''}`} onPointerDown={(event) => {
      if (!placing || event.button !== 0) return;
      const point = pointAt(event);
      if (point) onPlace(point);
    }} ref={canvas}>
      <img alt={area.name || 'Dungeon map'} draggable={false} onError={() => setFailedUrl(url)} src={url} />
      {area.markers.map((pin) => {
        const room = roomsById.get(pin.roomId);
        if (!room) return null;
        return (
          <button aria-label={`Room ${roomNumber(room)}, ${room.name}`} aria-pressed={activeRoom?.id === room.id} className="map-number-pin" key={pin.roomId}
            onClick={() => onSelect(room.id)}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (!editable || event.button !== 0) return;
              dragStart.current = { x: event.clientX, y: event.clientY };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerCancel={() => { dragStart.current = null; }}
            onPointerUp={(event) => {
              const start = dragStart.current;
              dragStart.current = null;
              if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5) return;
              const point = pointAt(event);
              if (point) onMove(pin.roomId, point);
            }}
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }} type="button"
          >{roomNumber(room)}</button>
        );
      })}
    </div>
  );
}

function RoomEncounters({ room, encounters, socialEncounters, editing, onUpdate, onOpen, onCreate }: {
  room: CampaignMapRoom;
  encounters: readonly Encounter[];
  socialEncounters: readonly SocialEncounter[];
  editing: boolean;
  onUpdate: (changes: Partial<CampaignMapRoom>) => void;
  onOpen: (encounter: RoomLink) => void;
  onCreate: () => Promise<void>;
}) {
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState(false);
  const combatById = new Map(encounters.map((encounter) => [encounter.id, encounter]));
  const socialById = new Map(socialEncounters.map((encounter) => [encounter.id, encounter]));
  const links: RoomLink[] = [
    ...room.encounterIds.map((id) => {
      const encounter = combatById.get(id);
      return { id, kind: 'combat' as const, name: encounter?.name || 'Combat encounter', status: encounter?.status, missing: !encounter };
    }),
    ...(room.socialEncounterIds ?? []).map((id) => {
      const encounter = socialById.get(id);
      return { id, kind: 'social' as const, name: encounter?.name || 'Social encounter', missing: !encounter };
    })
  ];
  if (!editing && !links.length) return null;
  const attach = (kind: EncounterKind, id: string) => {
    if (kind === 'combat') onUpdate({ encounterIds: [...new Set([...room.encounterIds, id])] });
    else onUpdate({ socialEncounterIds: [...new Set([...(room.socialEncounterIds ?? []), id])] });
    setPicking(false);
  };
  return (
    <section aria-label="Room encounters" className="dungeon-room-encounters">
      <h3>Encounters</h3>
      {links.map((link) => (
        <div className="dungeon-encounter" key={`${link.kind}-${link.id}`}>
          <button disabled={link.missing} onClick={() => onOpen(link)} type="button">
            <strong>{link.name}</strong>
            <small>{link.missing ? 'Unavailable' : link.kind === 'social' ? 'Social scene' : link.status?.replaceAll('-', ' ')}</small>
          </button>
          {editing && <button aria-label={`Unlink ${link.name}`} onClick={() => onUpdate(link.kind === 'combat'
            ? { encounterIds: room.encounterIds.filter((id) => id !== link.id) }
            : { socialEncounterIds: (room.socialEncounterIds ?? []).filter((id) => id !== link.id) })} type="button">Unlink</button>}
        </div>
      ))}
      {editing && (
        <>
          <button aria-expanded={picking} onClick={() => setPicking(!picking)} type="button">Add encounter</button>
          {picking && (
            <div className="dungeon-encounter-picker">
              <label>Saved encounter<select value="" onChange={(event) => {
                if (!event.target.value) return;
                const [kind, id] = event.target.value.split(':');
                attach(kind === 'social' ? 'social' : 'combat', id);
              }}>
                <option value="">Choose an encounter</option>
                <optgroup label="Combat">{encounters.filter((item) => !room.encounterIds.includes(item.id)).map((item) => <option key={item.id} value={`combat:${item.id}`}>{item.name || 'Untitled encounter'}</option>)}</optgroup>
                <optgroup label="Social">{socialEncounters.filter((item) => !room.socialEncounterIds?.includes(item.id)).map((item) => <option key={item.id} value={`social:${item.id}`}>{item.name || 'Untitled social encounter'}</option>)}</optgroup>
              </select></label>
              <button disabled={creating} onClick={async () => {
                setCreating(true);
                try { await onCreate(); } finally { setCreating(false); }
              }} type="button">New combat encounter</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function MoveRoomsReview({ dungeon, moves, onMove }: {
  dungeon: DungeonRecord;
  moves: DungeonRoomMove[];
  onMove: (dungeonId: string, moves: DungeonRoomMove[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  return (
    <details className="dungeon-migration">
      <summary>Move rooms into dungeon</summary>
      <p>Choose which brew sections should supply this dungeon’s room text. Review the current notes before moving a section.</p>
      {moves.map((move) => {
        const current = dungeon.areas.flatMap((area) => area.rooms).find((room) => room.id === move.roomId);
        return (
          <details key={move.roomId}>
            <summary>{move.heading}</summary>
            <p>Current dungeon room</p>
            <pre>{[current?.readAloud, current?.notes].filter(Boolean).join('\n\n') || 'Empty'}</pre>
            <p>Brew section to move</p>
            <pre>{move.source}</pre>
            <label><input checked={selected.includes(move.roomId)} onChange={(event) => setSelected(event.target.checked ? [...selected, move.roomId] : selected.filter((id) => id !== move.roomId))} type="checkbox" /> Move this section</label>
          </details>
        );
      })}
      <button className="primary-button" disabled={saving || !selected.length} onClick={async () => {
        setSaving(true);
        setError('');
        try {
          await onMove(dungeon.id, moves.filter((move) => selected.includes(move.roomId)));
          setSelected([]);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : 'Could not move the selected rooms.');
        } finally { setSaving(false); }
      }} type="button">Move selected rooms</button>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}

export function DungeonPanel({
  dungeons, dungeonId, assets, encounters, socialEncounters, mode, position, legacyMoves, onSelect, onCreate,
  onUpdate, onUpdateArea, onDelete, onModeChange, onPosition, onInsert, onBackToBrew, onUploadImage,
  onOpenEncounter, onCreateEncounter, onMoveRooms
}: Props) {
  const dungeon = dungeons.find((item) => item.id === dungeonId) ?? dungeons[0];
  const editing = mode === 'prepare';
  const currentPosition = position ?? (editing ? null : dungeon?.progress);
  const area = dungeon?.areas.find((item) => item.id === currentPosition?.areaId) ?? dungeon?.areas[0];
  const activeRoom = area?.rooms.find((room) => room.id === currentPosition?.roomId) ?? (editing ? area?.rooms[0] : undefined);
  const [phoneView, setPhoneView] = useState<'map' | 'rooms' | 'room'>(() => currentPosition?.roomId ? 'room' : 'map');
  const [placingRoomId, setPlacingRoomId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadInput = useRef<HTMLInputElement>(null);
  const asset = area?.imageSource?.startsWith('asset://') ? assets.find((item) => item.id === area.imageSource?.slice(8)) : undefined;
  const hasImage = Boolean(asset || area?.imageSource?.startsWith('https://'));
  const pinRoom = area?.rooms.find((room) => room.id === placingRoomId);
  const roomStatus = activeRoom && dungeon?.progress?.roomStatuses[activeRoom.id];

  const selectRoom = (roomId: string) => {
    if (!area) return;
    setPlacingRoomId(null);
    setPhoneView('room');
    onPosition({ areaId: area.id, roomId });
  };
  const updateArea = (update: (current: DungeonArea) => DungeonArea) => {
    if (dungeon && area) onUpdateArea(dungeon.id, area.id, update);
  };
  const updateRoom = (changes: Partial<CampaignMapRoom>) => {
    updateArea((current) => ({
      ...current,
      rooms: current.rooms.map((room) => room.id === activeRoom?.id ? { ...room, ...changes, updatedAt: new Date().toISOString() } : room)
    }));
  };
  const addRoom = () => {
    if (!area) return;
    const number = Math.max(0, ...area.rooms.map((room) => room.number)) + 1;
    const id = crypto.randomUUID();
    updateArea((current) => ({
      ...current,
      rooms: [...current.rooms, { id, number, name: `Room ${number}`, notes: '', readAloud: '', encounterIds: [], updatedAt: new Date().toISOString() }]
    }));
    selectRoom(id);
  };
  const placePin = (roomId: string, point: { x: number; y: number }) => {
    updateArea((current) => ({
      ...current,
      markers: [...current.markers.filter((marker) => marker.roomId !== roomId), { roomId, ...point }]
    }));
    setPlacingRoomId(null);
  };

  return (
    <main aria-label="Dungeons workspace" className="maps-panel dungeon-panel">
      <header className="panel-header">
        <div><p className="eyebrow">Campaign workspace</p><h1>Dungeons</h1><p>Prepare and run maps, rooms, and encounters.</p></div>
        <div className="dungeon-actions">
          {onBackToBrew && <button onClick={onBackToBrew} type="button">Back to brew</button>}
          <button className="primary-button" onClick={onCreate} type="button">New dungeon</button>
        </div>
      </header>
      <div className="maps-layout">
        <aside aria-label="Saved dungeons" className="maps-list">
          <strong>Saved dungeons <span>{dungeons.length}</span></strong>
          {dungeons.map((item) => (
            <button aria-pressed={item.id === dungeon?.id} className={item.id === dungeon?.id ? 'is-selected' : ''} key={item.id} onClick={() => onSelect(item.id)} type="button">
              <b>{item.name || 'Untitled dungeon'}</b>
              <small>{item.areas.length} {item.areas.length === 1 ? 'area' : 'areas'} · {item.areas.reduce((sum, entry) => sum + entry.rooms.length, 0)} rooms</small>
            </button>
          ))}
          {!dungeons.length && <p>Create a dungeon to start preparing rooms.</p>}
        </aside>
        {dungeon && area && (
          <section aria-label={dungeon.name || 'Untitled dungeon'} className="map-editor">
            <header className="map-editor-toolbar dungeon-toolbar">
              {editing
                ? <label>Dungeon name<input onChange={(event) => { const name = event.target.value; onUpdate(dungeon.id, (current) => ({ ...current, name })); }} onFocus={(event) => { if (event.target.value === 'New dungeon') event.target.select(); }} value={dungeon.name} /></label>
                : <h2>{dungeon.name || 'Untitled dungeon'}</h2>}
              <div className="dungeon-actions">
                <button aria-pressed={editing} onClick={() => onModeChange('prepare')} type="button">Prepare</button>
                <button aria-pressed={!editing} className="primary-button" onClick={() => onModeChange('run')} type="button">{dungeon.progress && editing ? 'Resume' : 'Run dungeon'}</button>
                <button onClick={() => onInsert(dungeon)} type="button">Insert into brew</button>
                {editing && <button className="danger-button" onClick={() => onDelete(dungeon.id)} type="button">Delete dungeon</button>}
              </div>
            </header>
            <div className="map-editor-toolbar dungeon-area-tools">
              {(editing || dungeon.areas.length > 1) && <label>Area<select value={area.id} onChange={(event) => {
                setPlacingRoomId(null);
                setPhoneView('map');
                onPosition({ areaId: event.target.value, roomId: null });
              }}>{dungeon.areas.map((item) => <option key={item.id} value={item.id}>{item.name || 'Untitled area'}</option>)}</select></label>}
              {editing && (
                <>
                  <label>Area name<input onChange={(event) => { const name = event.target.value; updateArea((current) => ({ ...current, name })); }} value={area.name} /></label>
                  <button onClick={() => {
                    const created = createDungeonArea(`Area ${dungeon.areas.length + 1}`);
                    onUpdate(dungeon.id, (current) => ({ ...current, areas: [...current.areas, created] }));
                    setPlacingRoomId(null);
                    setPhoneView('map');
                    onPosition({ areaId: created.id, roomId: null });
                  }} type="button">Add area</button>
                  {dungeon.areas.length > 1 && <button className="danger-button" onClick={() => {
                    if (!window.confirm(`Remove “${area.name || 'Untitled area'}” and its rooms?`)) return;
                    onUpdate(dungeon.id, (current) => ({ ...current, areas: current.areas.filter((item) => item.id !== area.id) }));
                    setPlacingRoomId(null);
                    setPhoneView('map');
                    onPosition({ areaId: dungeon.areas.find((item) => item.id !== area.id)!.id, roomId: null });
                  }} type="button">Remove area</button>}
                  <label>Map image<select value={asset ? area.imageSource : ''} onChange={(event) => {
                    const imageSource = event.target.value || undefined;
                    updateArea((current) => ({ ...current, imageSource }));
                  }}><option value="">{area.imageSource && !asset ? 'Current map image' : 'Choose image'}</option>
                    {assets.map((item) => <option key={item.id} value={`asset://${item.id}`}>{item.alt || item.name}</option>)}
                  </select></label>
                  <input accept="image/jpeg,image/png,image/webp,image/gif" className="visually-hidden" onChange={async (event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = '';
                    if (!file) return;
                    setUploading(true);
                    try {
                      const imageSource = await onUploadImage(file);
                      if (imageSource) updateArea((current) => ({ ...current, imageSource }));
                    } finally { setUploading(false); }
                  }} ref={uploadInput} type="file" />
                  <button disabled={uploading} onClick={() => uploadInput.current?.click()} type="button">{uploading ? 'Uploading…' : 'Upload map'}</button>
                  {area.imageSource && <button onClick={() => updateArea((current) => ({ ...current, imageSource: undefined }))} type="button">Clear image</button>}
                  <button onClick={addRoom} type="button">Add numbered room</button>
                </>
              )}
            </div>
            {editing && legacyMoves.length > 0 && <MoveRoomsReview dungeon={dungeon} moves={legacyMoves} onMove={onMoveRooms} />}
            <nav aria-label="Dungeon mobile view" className="dungeon-phone-nav">
              <button aria-pressed={phoneView === 'map'} onClick={() => setPhoneView('map')} type="button">Map</button>
              <button aria-pressed={phoneView === 'rooms'} onClick={() => setPhoneView('rooms')} type="button">Rooms</button>
              {activeRoom && <button aria-pressed={phoneView === 'room'} onClick={() => setPhoneView('room')} type="button">Room {roomNumber(activeRoom)}</button>}
            </nav>
            <div className={`dungeon-area-grid phone-${phoneView}`}>
              <section aria-label="Map" className="dungeon-area-map">
                <RoomMap activeRoom={activeRoom} area={area} asset={asset} editable={editing} key={area.id}
                  onMove={placePin} onPlace={(point) => { if (placingRoomId) { placePin(placingRoomId, point); setPhoneView('room'); } }}
                  onSelect={selectRoom} placing={editing && Boolean(placingRoomId)} />
                {pinRoom && <p className="maps-placement-help">Tap the map to place room {roomNumber(pinRoom)}. <button onClick={() => setPlacingRoomId(null)} type="button">Cancel</button></p>}
              </section>
              <nav aria-label="Numbered rooms" className="map-room-list">
                <strong>Rooms</strong>
                {[...area.rooms].sort((left, right) => left.number - right.number).map((room) => (
                  <button aria-current={room.id === activeRoom?.id ? 'location' : undefined} className={room.id === activeRoom?.id ? 'is-selected' : ''} key={room.id} onClick={() => selectRoom(room.id)} type="button">
                    <span>{roomNumber(room)}</span>{room.name || `Room ${room.number}`}
                    {!editing && dungeon.progress?.roomStatuses[room.id] && <small>{dungeon.progress.roomStatuses[room.id]}</small>}
                  </button>
                ))}
                {!area.rooms.length && <p>{editing ? 'Add a numbered room to begin.' : 'This area has no rooms yet.'}</p>}
              </nav>
              {activeRoom ? (
                <section aria-label={`Room ${roomNumber(activeRoom)}`} className="map-room-editor">
                  <header>
                    <h2>{roomNumber(activeRoom)}. {activeRoom.name || `Room ${roomNumber(activeRoom)}`}</h2>
                    <div className="dungeon-actions">
                      <button className="dungeon-phone-back" onClick={() => setPhoneView('map')} type="button">Back to map</button>
                      {editing && <>
                        <button disabled={!hasImage} onClick={() => { setPlacingRoomId(activeRoom.id); setPhoneView('map'); }} type="button">{area.markers.some((marker) => marker.roomId === activeRoom.id) ? 'Move pin' : 'Place pin'}</button>
                        <button className="danger-button" onClick={() => {
                          if (!window.confirm(`Remove room ${roomNumber(activeRoom)}?`)) return;
                          updateArea((current) => ({ ...current, rooms: current.rooms.filter((room) => room.id !== activeRoom.id), markers: current.markers.filter((pin) => pin.roomId !== activeRoom.id) }));
                          setPlacingRoomId(null);
                          setPhoneView('rooms');
                          onPosition({ areaId: area.id, roomId: null });
                        }} type="button">Remove room</button>
                      </>}
                    </div>
                  </header>
                  {editing ? (
                    <>
                      <label>Room name<input onChange={(event) => updateRoom({ name: event.target.value })} onFocus={(event) => { if (event.target.value === `Room ${roomNumber(activeRoom)}`) event.target.select(); }} value={activeRoom.name} /></label>
                      <label>Read aloud<textarea onChange={(event) => updateRoom({ readAloud: event.target.value })} value={activeRoom.readAloud} /></label>
                      <label>GM notes<textarea onChange={(event) => updateRoom({ notes: event.target.value })} value={activeRoom.notes} /></label>
                    </>
                  ) : (
                    <>
                      <label>Room status<select value={roomStatus ?? 'unvisited'} onChange={(event) => onPosition({ areaId: area.id, roomId: activeRoom.id }, event.target.value as DungeonRoomStatus | 'unvisited')}>
                        <option value="unvisited">Unvisited</option><option value="visited">Visited</option><option value="cleared">Cleared</option>
                      </select></label>
                      {activeRoom.readAloud && <div className="dungeon-read-aloud"><h3>Read aloud</h3><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{activeRoom.readAloud}</ReactMarkdown></div>}
                      {activeRoom.notes && <div className="dungeon-room-notes"><h3>GM notes</h3><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{activeRoom.notes}</ReactMarkdown></div>}
                    </>
                  )}
                  <RoomEncounters editing={editing} encounters={encounters} key={activeRoom.id} onCreate={() => onCreateEncounter({ dungeonId: dungeon.id, areaId: area.id, roomId: activeRoom.id })}
                    onOpen={(encounter) => onOpenEncounter({ dungeonId: dungeon.id, areaId: area.id, roomId: activeRoom.id }, encounter)}
                    onUpdate={updateRoom} room={activeRoom} socialEncounters={socialEncounters} />
                </section>
              ) : <p className="dungeon-room-empty">Choose a room from the map or room list.</p>}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
