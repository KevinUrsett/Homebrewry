import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createDungeonArea, dungeonMapName, dungeonRooms, placeDungeonPin, roomNumber, updateDungeonArea, updateDungeonRoom } from '../lib/dungeons';
import { dungeonRoomSummary } from '../lib/dungeonReferences';
import { DungeonRoomMap, DungeonRoomText } from './DungeonRoomContent';
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
  onModeChange: (mode: Mode, position: DungeonPosition) => void;
  onPosition: (position: DungeonPosition, status?: DungeonRoomStatus | 'unvisited') => void;
  onInsert: (dungeon: DungeonRecord) => void;
  onBackToBrew?: () => void;
  onUploadImage: (file: File) => Promise<string | null>;
  onOpenEncounter: (target: RoomTarget, encounter: RoomLink) => void;
  onCreateEncounter: (target: RoomTarget) => Promise<void>;
  onMoveRooms: (dungeonId: string, moves: DungeonRoomMove[]) => Promise<void>;
};

type Icon = 'back' | 'chevron' | 'close' | 'down' | 'edit' | 'map' | 'more' | 'pin' | 'play' | 'plus' | 'upload';

const iconPaths: Record<Icon, string> = {
  back: 'M19 12H5m7-7-7 7 7 7',
  chevron: 'm9 18 6-6-6-6',
  close: 'm6 6 12 12M6 18 18 6',
  down: 'm6 9 6 6 6-6',
  edit: 'M14 6l4 4M4 20l4-.8L20 7l-4-4L4.8 15 4 20Z',
  map: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15',
  more: 'M5 12h.01m6.99 0h.01m6.99 0h.01',
  pin: 'M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Zm-5 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  play: 'M8 5v14l11-7L8 5Z',
  plus: 'M12 5v14M5 12h14',
  upload: 'M12 15V4m-4 4 4-4 4 4M5 15v5h14v-5'
};

function DungeonIcon({ name }: { name: Icon }) {
  return <svg aria-hidden="true" className="dungeon-icon" fill="none" viewBox="0 0 24 24">
    <path d={iconPaths[name]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={name === 'more' ? 3 : 1.8} />
  </svg>;
}

function DungeonDialog({ title, children, onDismiss }: { title: string; children: ReactNode; onDismiss: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element?.showModal();
    element?.querySelector<HTMLElement>('[data-dialog-focus]')?.focus();
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog aria-labelledby={headingId} className="dungeon-dialog" onCancel={(event) => {
      event.preventDefault();
      onDismiss();
    }} onClick={(event) => { if (event.target === event.currentTarget) onDismiss(); }} ref={dialog}>
      <div className="dungeon-dialog-content">
        <header><h2 id={headingId}>{title}</h2><button aria-label="Close" className="dungeon-button is-icon" onClick={onDismiss} type="button"><DungeonIcon name="close" /></button></header>
        {children}
      </div>
    </dialog>
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
  const availableCombat = encounters.filter((item) => !room.encounterIds.includes(item.id));
  const availableSocial = socialEncounters.filter((item) => !room.socialEncounterIds?.includes(item.id));
  const attach = (kind: EncounterKind, id: string) => {
    if (kind === 'combat') onUpdate({ encounterIds: [...new Set([...room.encounterIds, id])] });
    else onUpdate({ socialEncounterIds: [...new Set([...(room.socialEncounterIds ?? []), id])] });
    setPicking(false);
  };
  return (
    <section aria-label="Room encounters" className="dungeon-room-encounters">
      <header className="dungeon-section-heading">
        <h3>Encounters</h3>
        {editing && <button aria-haspopup="dialog" className="dungeon-button is-quiet" onClick={() => setPicking(true)} type="button"><DungeonIcon name="plus" /> Add encounter</button>}
      </header>
      {links.map((link) => (
        <div className="dungeon-encounter" key={`${link.kind}-${link.id}`}>
          <button className="dungeon-row" disabled={link.missing} onClick={() => onOpen(link)} type="button">
            <span><strong>{link.name}</strong><small>{link.missing ? 'Unavailable' : link.kind === 'social' ? 'Social scene' : link.status?.replaceAll('-', ' ')}</small></span>
            <DungeonIcon name="chevron" />
          </button>
          {editing && <button aria-label={`Unlink ${link.name}`} className="dungeon-button is-icon" onClick={() => onUpdate(link.kind === 'combat'
            ? { encounterIds: room.encounterIds.filter((id) => id !== link.id) }
            : { socialEncounterIds: (room.socialEncounterIds ?? []).filter((id) => id !== link.id) })} title="Unlink encounter" type="button"><DungeonIcon name="close" /></button>}
        </div>
      ))}
      {editing && picking && (
        <DungeonDialog onDismiss={() => setPicking(false)} title="Add encounter">
          <button className="dungeon-button is-primary" disabled={creating} onClick={async () => {
            setCreating(true);
            try { await onCreate(); } finally { setCreating(false); }
          }} type="button"><DungeonIcon name="plus" /> New combat encounter</button>
          {[...availableCombat.map((item) => ({ ...item, kind: 'combat' as const })),
            ...availableSocial.map((item) => ({ ...item, kind: 'social' as const }))].map((item) => (
            <button className="dungeon-row" key={`${item.kind}-${item.id}`} onClick={() => attach(item.kind, item.id)} type="button">
              <span><strong>{item.name || 'Untitled encounter'}</strong><small>{item.kind === 'combat' ? 'Combat' : 'Social scene'}</small></span>
              <DungeonIcon name="plus" />
            </button>
          ))}
        </DungeonDialog>
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
    <div className="dungeon-migration">
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
    </div>
  );
}

type WorkspaceDialog = 'dungeons' | 'options' | 'map' | 'add-map' | 'dungeon-name' | 'migration';

function RenameForm({ label, name, onSave }: { label: string; name: string; onSave: (name: string) => void }) {
  return <form className="dungeon-rename" onSubmit={(event) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('name') ?? '').trim();
    if (value) onSave(value);
  }}>
    <label>{label}<input data-dialog-focus defaultValue={name} name="name" onFocus={(event) => event.currentTarget.select()} required /></label>
    <button className="dungeon-button is-primary" type="submit">Save name</button>
  </form>;
}

export function DungeonPanel({
  dungeons, dungeonId, assets, encounters, socialEncounters, mode, position, legacyMoves, onSelect, onCreate,
  onUpdate, onUpdateArea, onDelete, onModeChange, onPosition, onInsert, onBackToBrew, onUploadImage,
  onOpenEncounter, onCreateEncounter, onMoveRooms
}: Props) {
  const dungeon = dungeons.find((item) => item.id === dungeonId) ?? dungeons[0];
  const editing = mode === 'prepare';
  const currentPosition = position ?? (editing ? null : dungeon?.progress);
  const rooms = dungeon ? dungeonRooms(dungeon) : [];
  const activeEntry = rooms.find(({ room }) => room.id === currentPosition?.roomId);
  const activeRoom = activeEntry?.room;
  const maps = dungeon?.areas.filter((item) => item.imageSource) ?? [];
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const map = maps.find((item) => item.id === selectedMapId)
    ?? maps.find((item) => item.id === currentPosition?.areaId) ?? maps[0] ?? dungeon?.areas[0];
  const [roomOpen, setRoomOpen] = useState(() => Boolean(activeRoom));
  const [placement, setPlacement] = useState<{ roomId: string | null } | null>(null);
  const [popup, setPopup] = useState<WorkspaceDialog | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const uploadInput = useRef<HTMLInputElement>(null);
  const uploadNewMap = useRef(false);
  const panel = useRef<HTMLElement>(null);
  const roomHeading = useRef<HTMLHeadingElement>(null);
  const overviewScroll = useRef(0);
  const roomOpener = useRef<HTMLButtonElement | null>(null);
  const asset = map?.imageSource?.startsWith('asset://') ? assets.find((item) => item.id === map.imageSource?.slice(8)) : undefined;
  const hasImage = Boolean(asset || map?.imageSource?.startsWith('https://'));
  const pinRoom = rooms.find(({ room }) => room.id === placement?.roomId)?.room;
  const showRoom = roomOpen && Boolean(activeRoom);
  const roomStatus = (activeRoom && dungeon?.progress?.roomStatuses[activeRoom.id]) ?? 'unvisited';
  const title = dungeon?.name.trim() || 'Untitled dungeon';
  const resumePosition = editing && !showRoom && dungeon?.progress?.roomId ? dungeon.progress : undefined;

  useLayoutEffect(() => {
    if (!panel.current || !window.matchMedia('(max-width: 820px)').matches) return;
    panel.current.scrollTop = showRoom ? 0 : overviewScroll.current;
    if (showRoom) roomHeading.current?.focus({ preventScroll: true });
    else {
      roomOpener.current?.focus({ preventScroll: true });
      roomOpener.current = null;
    }
  }, [showRoom]);

  const dismiss = () => setPopup(null);
  const overview = () => {
    overviewScroll.current = 0;
    roomOpener.current = null;
    setRoomOpen(false);
    panel.current?.scrollTo({ top: 0 });
  };
  const selectRoom = (areaId: string, roomId: string, trigger?: HTMLButtonElement) => {
    if (!showRoom) {
      overviewScroll.current = panel.current?.scrollTop ?? 0;
      roomOpener.current = trigger ?? null;
    }
    if (maps.some((item) => item.id === areaId)) setSelectedMapId(areaId);
    setPlacement(null);
    setRoomOpen(true);
    onPosition({ areaId, roomId });
  };
  const updateArea = (areaId: string, update: (current: DungeonArea) => DungeonArea) => {
    if (dungeon) onUpdateArea(dungeon.id, areaId, update);
  };
  const updateRoom = (changes: Partial<CampaignMapRoom>) => {
    if (!dungeon || !activeEntry) return;
    onUpdate(dungeon.id, (current) => updateDungeonRoom(current, activeEntry.areaId, activeEntry.room.id, changes));
  };
  const addRoom = (point?: { x: number; y: number }, trigger?: HTMLButtonElement) => {
    if (!dungeon || !map) return;
    const id = crypto.randomUUID();
    onUpdate(dungeon.id, (current) => {
      const number = current.areas.reduce((highest, group) => group.rooms.reduce((max, room) => Math.max(max, room.number), highest), 0) + 1;
      return updateDungeonArea(current, map.id, (group) => ({
        ...group,
        rooms: [...group.rooms, { id, number, name: `Room ${number}`, notes: '', readAloud: '', encounterIds: [], updatedAt: new Date().toISOString() }],
        markers: point ? [...group.markers, { roomId: id, ...point }] : group.markers
      }));
    });
    selectRoom(map.id, id, trigger);
  };
  const movePin = (roomId: string, point: { x: number; y: number }) => {
    if (dungeon && map) onUpdate(dungeon.id, (current) => placeDungeonPin(current, map.id, { roomId, ...point }));
  };
  const startPlacement = (roomId: string | null) => {
    overview();
    setPlacement({ roomId });
  };
  const changeMap = (imageSource?: string, adding = false) => {
    if (dungeon && imageSource && adding) {
      const created = { ...createDungeonArea('Map'), imageSource };
      onUpdate(dungeon.id, (current) => ({ ...current, areas: [...current.areas, created] }));
      setSelectedMapId(created.id);
    } else if (map) updateArea(map.id, (current) => ({ ...current, imageSource }));
    setPlacement(null);
    setUploadFailed(false);
  };
  const openMapUpload = (adding = false) => {
    uploadNewMap.current = adding;
    uploadInput.current?.click();
  };

  return (
    <main aria-label="Dungeons workspace" className={`dungeon-panel${showRoom ? ' is-room-open' : ''}`} ref={panel}>
      <div className="dungeon-workspace">
        <header className="dungeon-workspace-header">
          <div className="dungeon-workspace-title">
            {onBackToBrew
              ? <button className="dungeon-brew-back" onClick={onBackToBrew} type="button"><DungeonIcon name="back" /> Back to brew</button>
              : dungeon && <p className="dungeon-kicker">Dungeons</p>}
            <h1>{dungeon ? <button aria-haspopup="dialog" aria-label={`Switch dungeon, current dungeon ${title}`} className="dungeon-title-button" onClick={() => setPopup('dungeons')} type="button">
              <span>{title}</span><DungeonIcon name="down" />
            </button> : 'Dungeons'}</h1>
          </div>
          {dungeon && map && <div className="dungeon-actions">
            <button className={`dungeon-button ${editing ? 'is-primary' : 'is-secondary'}`} onClick={() => onModeChange(editing ? 'run' : 'prepare',
              resumePosition ?? { areaId: activeEntry?.areaId ?? map.id, roomId: showRoom ? activeRoom?.id ?? null : null })} type="button">
              <DungeonIcon name={editing ? 'play' : 'edit'} />{editing ? (resumePosition ? 'Resume' : 'Run') : 'Prepare'}
            </button>
            {editing && <button aria-haspopup="dialog" aria-label="Dungeon options" className="dungeon-button is-icon is-secondary" onClick={() => setPopup('options')} type="button"><DungeonIcon name="more" /></button>}
          </div>}
        </header>

        {!dungeon && <section className="dungeon-map-empty dungeon-start">
          <span className="dungeon-map-emblem"><DungeonIcon name="map" /></span>
          <h2>Start a dungeon</h2>
          <p>Bring your maps, rooms and encounters together.</p>
          <button className="dungeon-button is-primary" onClick={onCreate} type="button"><DungeonIcon name="plus" /> New dungeon</button>
        </section>}
        {dungeon && map && <>
          <div className={`dungeon-workspace-grid${!editing && !map.imageSource ? ' is-list-only' : ''}`}>
            <section aria-label="Dungeon map" className="dungeon-map-panel dungeon-surface">
              <header className="dungeon-section-heading">
                <h2>{placement ? (pinRoom ? `Tap the map to place room ${roomNumber(pinRoom)}` : 'Tap the map to add a room') : 'Map'}</h2>
                {placement
                  ? <button className="dungeon-button is-quiet" onClick={() => {
                    setPlacement(null);
                    const entry = rooms.find(({ room }) => room.id === pinRoom?.id);
                    if (entry) selectRoom(entry.areaId, entry.room.id);
                  }} type="button">Cancel</button>
                  : editing && hasImage && <div className="dungeon-actions">
                    <button aria-label="Add pin" className="dungeon-button is-quiet" onClick={() => startPlacement(null)} type="button"><DungeonIcon name="plus" /> Pin</button>
                    <button aria-haspopup="dialog" aria-label="Map options" className="dungeon-button is-icon" onClick={() => setPopup('map')} type="button"><DungeonIcon name="more" /></button>
                  </div>}
              </header>
              {maps.length > 1 && <select aria-label="Choose map" className="dungeon-map-picker" onChange={(event) => {
                setSelectedMapId(event.target.value);
                setUploadFailed(false);
              }} value={map.id}>
                {maps.map((item, index) => <option key={item.id} value={item.id}>{dungeonMapName(item, index)}</option>)}
              </select>}
              {editing && <input accept="image/jpeg,image/png,image/webp,image/gif" aria-label="Upload map image" className="visually-hidden" onChange={async (event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (!file) return;
                const adding = uploadNewMap.current;
                setUploading(true);
                setUploadFailed(false);
                try {
                  const imageSource = await onUploadImage(file);
                  if (imageSource) changeMap(imageSource, adding);
                  else setUploadFailed(true);
                } finally { setUploading(false); }
              }} ref={uploadInput} tabIndex={-1} type="file" />}
              <div className="dungeon-map-stage">
                <DungeonRoomMap activeRoom={activeRoom} area={map} asset={asset} editable={editing}
                  label={maps.length > 1 ? dungeonMapName(map, maps.indexOf(map)) : 'Dungeon map'} empty={(unavailable) => (
                  <div className="dungeon-map-empty">
                    <span className="dungeon-map-emblem"><DungeonIcon name="map" /></span>
                    <h3>{unavailable ? 'Map unavailable' : 'No map yet'}</h3>
                    {editing && <div className="dungeon-map-empty-actions">
                      <button className="dungeon-button is-secondary" disabled={uploading} onClick={() => openMapUpload()} type="button">
                        <DungeonIcon name="upload" /> {uploading ? 'Uploading…' : 'Upload map'}
                      </button>
                      {(assets.length > 0 || map.imageSource) && <button aria-haspopup="dialog" className="dungeon-button is-quiet" onClick={() => setPopup('map')} type="button">{assets.length ? 'Saved images' : 'Map options'}</button>}
                    </div>}
                  </div>
                )} key={`${map.id}-${map.imageSource ?? ''}`} onMove={movePin} onPlace={(point) => {
                  if (!placement) return;
                  if (pinRoom) {
                    movePin(pinRoom.id, point);
                    selectRoom(map.id, pinRoom.id);
                  } else addRoom(point);
                }} onSelect={(roomId, trigger) => selectRoom(map.id, roomId, trigger)} placing={Boolean(placement)} />
              </div>
              {uploadFailed && <p className="dungeon-upload-error" role="alert">Could not upload the map. Try another image.</p>}
            </section>

            <nav aria-label="Numbered rooms" className="dungeon-room-list dungeon-surface">
              <header className="dungeon-section-heading">
                <h2>Rooms <span className="dungeon-count">{rooms.length}</span></h2>
                {editing && <button aria-label="Add room" className="dungeon-button is-quiet" onClick={(event) => addRoom(undefined, event.currentTarget)} type="button"><DungeonIcon name="plus" /> Room</button>}
              </header>
              {rooms.map(({ areaId, room }) => {
                const status = dungeon.progress?.roomStatuses[room.id];
                return <button aria-current={room.id === activeRoom?.id ? 'location' : undefined} className="dungeon-row dungeon-room-row" key={room.id} onClick={(event) => selectRoom(areaId, room.id, event.currentTarget)} type="button">
                  <span className="dungeon-number">{roomNumber(room)}</span>
                  <span><strong>{room.name.trim() || 'Untitled room'}</strong>{!editing && status && <small>{status}</small>}</span>
                  <DungeonIcon name="chevron" />
                </button>;
              })}
              {!rooms.length && <p className="dungeon-empty-note">{editing ? 'Add rooms with or without a map.' : 'No rooms in this dungeon yet.'}</p>}
            </nav>

            {activeRoom && activeEntry && showRoom ? (
              <section aria-label={`Room ${roomNumber(activeRoom)}`} className="dungeon-room-panel dungeon-surface">
                <button className="dungeon-button is-quiet dungeon-overview-back" onClick={() => setRoomOpen(false)} type="button"><DungeonIcon name="back" /> Map &amp; rooms</button>
                <header className="dungeon-room-heading">
                  <span aria-hidden="true" className="dungeon-number">{roomNumber(activeRoom)}</span>
                  {editing ? <>
                    <h2 className="visually-hidden" ref={roomHeading} tabIndex={-1}>Edit room {roomNumber(activeRoom)}</h2>
                    <input aria-label="Room name" className="dungeon-room-name" onChange={(event) => updateRoom({ name: event.target.value })} onFocus={(event) => {
                      if (event.target.value === `Room ${activeRoom.number}`) event.target.select();
                    }} placeholder={`Room ${roomNumber(activeRoom)}`} value={activeRoom.name} />
                  </> : <h2 ref={roomHeading} tabIndex={-1}>{activeRoom.name.trim() || `Room ${roomNumber(activeRoom)}`}</h2>}
                </header>
                {editing ? (
                  <>
                    {hasImage && <button className="dungeon-button is-quiet dungeon-place-pin" onClick={() => startPlacement(activeRoom.id)} type="button">
                      <DungeonIcon name="pin" />{map.markers.some((marker) => marker.roomId === activeRoom.id) ? 'Move pin' : 'Place pin'}
                    </button>}
                    <label className="dungeon-field">Read aloud<textarea onChange={(event) => updateRoom({ readAloud: event.target.value })} placeholder="What the players see and hear…" rows={7} value={activeRoom.readAloud} /></label>
                    <label className="dungeon-field">GM notes<textarea onChange={(event) => updateRoom({ notes: event.target.value })} placeholder="Secrets, checks and discoveries…" rows={9} value={activeRoom.notes} /></label>
                  </>
                ) : (
                  <>
                    <div aria-label="Room status" className="dungeon-status" role="group">
                      {(['unvisited', 'visited', 'cleared'] as const).map((status) => <button aria-pressed={roomStatus === status} className="dungeon-button" key={status} onClick={() => onPosition({ areaId: activeEntry.areaId, roomId: activeRoom.id }, status)} type="button">{status}</button>)}
                    </div>
                    <DungeonRoomText room={activeRoom} />
                  </>
                )}
                <RoomEncounters editing={editing} encounters={encounters} key={activeRoom.id} onCreate={() => onCreateEncounter({ dungeonId: dungeon.id, areaId: activeEntry.areaId, roomId: activeRoom.id })}
                  onOpen={(encounter) => onOpenEncounter({ dungeonId: dungeon.id, areaId: activeEntry.areaId, roomId: activeRoom.id }, encounter)}
                  onUpdate={updateRoom} room={activeRoom} socialEncounters={socialEncounters} />
                {editing && <button className="dungeon-button is-quiet is-destructive dungeon-remove-room" onClick={() => {
                  if (!window.confirm(`Remove room ${roomNumber(activeRoom)}?`)) return;
                  updateArea(activeEntry.areaId, (current) => ({ ...current, rooms: current.rooms.filter((room) => room.id !== activeRoom.id), markers: current.markers.filter((pin) => pin.roomId !== activeRoom.id) }));
                  setRoomOpen(false);
                  onPosition({ areaId: map.id, roomId: null });
                }} type="button">Remove room</button>}
              </section>
            ) : <p className="dungeon-room-idle dungeon-surface">{rooms.length ? 'Select a pin or a room to open it.' : 'Room details will appear here.'}</p>}
          </div>

          {popup === 'options' && <DungeonDialog onDismiss={dismiss} title="Dungeon options">
            <button className="dungeon-row" onClick={() => setPopup('dungeon-name')} type="button">Rename dungeon</button>
            <button className="dungeon-row" onClick={() => onInsert(dungeon)} type="button">Insert into brew</button>
            {legacyMoves.length > 0 && <button className="dungeon-row" onClick={() => setPopup('migration')} type="button">Move rooms into dungeon</button>}
            <button className="dungeon-row is-destructive" onClick={() => { dismiss(); onDelete(dungeon.id); }} type="button">Delete dungeon</button>
          </DungeonDialog>}
          {popup === 'dungeon-name' && <DungeonDialog onDismiss={dismiss} title="Rename dungeon">
            <RenameForm label="Dungeon name" name={dungeon.name} onSave={(name) => {
              onUpdate(dungeon.id, (current) => ({ ...current, name }));
              dismiss();
            }} />
          </DungeonDialog>}
          {popup === 'migration' && <DungeonDialog onDismiss={dismiss} title="Move rooms into dungeon">
            <MoveRoomsReview dungeon={dungeon} moves={legacyMoves} onMove={onMoveRooms} />
          </DungeonDialog>}
          {(popup === 'map' || popup === 'add-map') && <DungeonDialog key={popup} onDismiss={dismiss} title={popup === 'add-map' ? 'Add map' : 'Map image'}>
            <button className="dungeon-button is-primary" disabled={uploading} onClick={(event) => {
              event.currentTarget.closest('dialog')?.close();
              dismiss();
              openMapUpload(popup === 'add-map');
            }} type="button"><DungeonIcon name="upload" /> {popup === 'map' && map.imageSource ? 'Upload replacement' : 'Upload map'}</button>
            {assets.length > 0 && <h3 className="dungeon-kicker">Saved images</h3>}
            {assets.map((item) => <button aria-pressed={popup === 'map' && item.id === asset?.id} className="dungeon-row" key={item.id} onClick={() => {
              changeMap(`asset://${item.id}`, popup === 'add-map');
              dismiss();
            }} type="button">{item.alt || item.name}<DungeonIcon name="chevron" /></button>)}
            {popup === 'map' && map.imageSource && <button className="dungeon-row" onClick={() => setPopup('add-map')} type="button">Add map</button>}
            {popup === 'map' && map.imageSource && <button className="dungeon-row is-destructive" onClick={() => { changeMap(); dismiss(); }} type="button">Remove map image</button>}
          </DungeonDialog>}
        </>}

        {popup === 'dungeons' && <DungeonDialog onDismiss={dismiss} title="Saved dungeons">
          <button className="dungeon-button is-primary" onClick={() => { dismiss(); onCreate(); }} type="button"><DungeonIcon name="plus" /> New dungeon</button>
          {dungeons.map((item) => {
            const count = item.areas.reduce((sum, entry) => sum + entry.rooms.length, 0);
            return <button aria-pressed={item.id === dungeon?.id} className="dungeon-row" key={item.id} onClick={() => { dismiss(); if (item.id !== dungeon?.id) onSelect(item.id); }} type="button">
              <span><strong>{item.name.trim() || 'Untitled dungeon'}</strong><small>{dungeonRoomSummary(count)}</small></span>
              <DungeonIcon name="chevron" />
            </button>;
          })}
        </DungeonDialog>}
      </div>
    </main>
  );
}
