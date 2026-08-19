import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { Brew, BrewAsset, CampaignMapMarker, CampaignMapRecord, CampaignMapRoom, Encounter } from '../types';
import { getOutline } from '../lib/outline';

type Props = {
  maps: CampaignMapRecord[];
  assets: BrewAsset[];
  brews: Brew[];
  encounters: Encounter[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onSave: (map: CampaignMapRecord) => void;
  onDelete: (map: CampaignMapRecord) => void;
  onInsert: (map: CampaignMapRecord) => void;
  onUploadImage: (file: File) => Promise<string | null>;
};

function MapImage({ source, assets, alt }: { source?: string; assets: BrewAsset[]; alt: string }) {
  const asset = source?.startsWith('asset://') ? assets.find((item) => item.id === source.slice(8)) : undefined;
  const url = useMemo(() => asset ? URL.createObjectURL(asset.blob) : source, [asset?.blob, source]);
  useEffect(() => () => { if (asset && url) URL.revokeObjectURL(url); }, [asset, url]);
  return url ? <img alt={alt} src={url} /> : <div className="maps-image-empty">Choose an uploaded image</div>;
}

function emptyRoom(number: number): CampaignMapRoom {
  return { id: crypto.randomUUID(), number, name: `Room ${number}`, notes: '', readAloud: '', encounterIds: [], updatedAt: new Date().toISOString() };
}

export function MapsPanel({ maps, assets, brews, encounters, selectedId, onSelect, onCreate, onSave, onDelete, onInsert, onUploadImage }: Props) {
  const selected = maps.find((map) => map.id === selectedId) ?? maps[0];
  const [placing, setPlacing] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setActiveRoomId(selected?.rooms[0]?.id ?? null); setPlacing(false); }, [selected?.id]);
  const activeRoom = selected?.rooms.find((room) => room.id === activeRoomId) ?? selected?.rooms[0];
  const update = (updater: (map: CampaignMapRecord) => CampaignMapRecord) => { if (selected) onSave(updater(selected)); };
  const point = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return null;
    return { x: Math.max(0, Math.min(100, (clientX - rect.left) / rect.width * 100)), y: Math.max(0, Math.min(100, (clientY - rect.top) / rect.height * 100)) };
  };
  const addRoom = () => {
    if (!selected) return;
    const nextNumber = Math.max(0, ...selected.rooms.map((room) => room.number)) + 1;
    const room = emptyRoom(nextNumber);
    update((map) => ({ ...map, rooms: [...map.rooms, room], updatedAt: new Date().toISOString(), version: map.version + 1 }));
    setActiveRoomId(room.id);
    setPlacing(true);
  };
  const place = (event: PointerEvent<HTMLDivElement>) => {
    if (!selected || !placing || !activeRoom) return;
    const position = point(event.clientX, event.clientY);
    if (!position) return;
    update((map) => ({ ...map, markers: [...map.markers.filter((marker) => marker.roomId !== activeRoom.id), { roomId: activeRoom.id, ...position }], updatedAt: new Date().toISOString(), version: map.version + 1 }));
    setPlacing(false);
  };
  const moveMarker = (event: PointerEvent<HTMLButtonElement>, marker: CampaignMapMarker) => {
    if (!selected || dragging !== marker.roomId) return;
    const position = point(event.clientX, event.clientY);
    if (!position) return;
    update((map) => ({ ...map, markers: map.markers.map((item) => item.roomId === marker.roomId ? { ...item, ...position } : item), updatedAt: new Date().toISOString(), version: map.version + 1 }));
    setDragging(null);
  };
  const updateRoom = (roomId: string, changes: Partial<CampaignMapRoom>) => update((map) => ({ ...map, rooms: map.rooms.map((room) => room.id === roomId ? { ...room, ...changes, updatedAt: new Date().toISOString() } : room), updatedAt: new Date().toISOString(), version: map.version + 1 }));

  return <main className="maps-panel">
    <header className="panel-header"><div><p className="eyebrow">Campaign preparation</p><h1>Maps</h1><p>Prepare numbered locations, then place them in a brew.</p></div><button className="primary-button" onClick={onCreate} type="button">New map</button></header>
    <div className="maps-layout">
      <aside className="maps-list"><strong>Saved maps <span>{maps.length}</span></strong>{maps.map((map) => <button className={map.id === selected?.id ? 'is-selected' : ''} key={map.id} onClick={() => onSelect(map.id)} type="button"><b>{map.name || 'Untitled map'}</b><small>{map.rooms.length} numbered area{map.rooms.length === 1 ? '' : 's'} · {map.linkedBrewIds.length} brew link{map.linkedBrewIds.length === 1 ? '' : 's'}</small></button>)}{!maps.length && <p>Create a map, choose its image, and add numbered areas.</p>}</aside>
      {selected && <section className="map-editor">
        <div className="map-editor-toolbar"><label>Name<input value={selected.name} onChange={(event) => update((map) => ({ ...map, name: event.target.value, updatedAt: new Date().toISOString(), version: map.version + 1 }))} onFocus={(event) => { if (selected.name === 'New map') event.currentTarget.select(); }} /></label><label>Map image<select value={selected.imageSource ?? ''} onChange={(event) => update((map) => ({ ...map, imageSource: event.target.value || undefined, updatedAt: new Date().toISOString(), version: map.version + 1 }))}><option value="">Choose image…</option>{assets.map((asset) => <option key={asset.id} value={`asset://${asset.id}`}>{asset.alt || asset.name}</option>)}</select></label><input accept="image/jpeg,image/png,image/webp,image/gif" className="visually-hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const source = await onUploadImage(file); if (source) update((map) => ({ ...map, imageSource: source, updatedAt: new Date().toISOString(), version: map.version + 1 })); event.target.value = ''; }} ref={imageInputRef} type="file" /><button onClick={() => imageInputRef.current?.click()} type="button">Upload image</button><button onClick={addRoom} type="button">Add numbered room</button><button onClick={() => onInsert(selected)} type="button">Insert in brew</button><button className="danger-button" onClick={() => onDelete(selected)} type="button">Delete</button></div>
        <div className={`maps-canvas${placing ? ' is-placing' : ''}`} onPointerDown={place} ref={canvasRef}><MapImage alt={selected.name || 'Map'} assets={assets} source={selected.imageSource} />{selected.markers.map((marker) => { const room = selected.rooms.find((item) => item.id === marker.roomId); return room ? <button className="map-number-pin" key={marker.roomId} onClick={(event) => { event.stopPropagation(); setActiveRoomId(room.id); }} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setDragging(marker.roomId); }} onPointerUp={(event) => moveMarker(event, marker)} style={{ left: `${marker.x}%`, top: `${marker.y}%` }} type="button">{room.number}</button> : null; })}</div>
        {placing && <p className="maps-placement-help">Tap the map to place room {activeRoom?.number}.</p>}
        <div className="map-room-workspace"><div className="map-room-list"><strong>Areas</strong>{selected.rooms.map((room) => <button className={room.id === activeRoom?.id ? 'is-selected' : ''} key={room.id} onClick={() => setActiveRoomId(room.id)} type="button"><span>{room.number}</span>{room.name || `Room ${room.number}`}</button>)}</div>{activeRoom && <section className="map-room-editor"><header><h2>{activeRoom.number}. {activeRoom.name || `Room ${activeRoom.number}`}</h2><button className="danger-button" onClick={() => { update((map) => ({ ...map, rooms: map.rooms.filter((room) => room.id !== activeRoom.id), markers: map.markers.filter((marker) => marker.roomId !== activeRoom.id), updatedAt: new Date().toISOString(), version: map.version + 1 })); }} type="button">Remove</button></header><label>Room name<input value={activeRoom.name} onChange={(event) => updateRoom(activeRoom.id, { name: event.target.value })} onFocus={(event) => { if (activeRoom.name === `Room ${activeRoom.number}`) event.currentTarget.select(); }} /></label><label>Read aloud<textarea value={activeRoom.readAloud} onChange={(event) => updateRoom(activeRoom.id, { readAloud: event.target.value })} placeholder="Optional text to read at the table…" /></label><label>GM notes<textarea value={activeRoom.notes} onChange={(event) => updateRoom(activeRoom.id, { notes: event.target.value })} placeholder="Secrets, traps, clues, connections…" /></label><label>Link to brew<select value={activeRoom.brewSectionId ?? ''} onChange={(event) => updateRoom(activeRoom.id, { brewSectionId: event.target.value || undefined })}><option value="">No linked section</option>{brews.flatMap((brew) => getOutline(brew.content).map((heading) => <option key={`${brew.id}:${heading.id}`} value={`${brew.id}:${heading.id}`}>{brew.title}: {heading.text}</option>))}</select></label><fieldset><legend>Encounters</legend>{encounters.map((encounter) => <label className="map-encounter-choice" key={encounter.id}><input checked={activeRoom.encounterIds.includes(encounter.id)} onChange={(event) => updateRoom(activeRoom.id, { encounterIds: event.target.checked ? [...activeRoom.encounterIds, encounter.id] : activeRoom.encounterIds.filter((id) => id !== encounter.id) })} type="checkbox" />{encounter.name || 'Untitled encounter'}</label>)}{!encounters.length && <p>Create encounters first, then attach any number here.</p>}</fieldset></section>}</div>
      </section>}
    </div>
  </main>;
}
