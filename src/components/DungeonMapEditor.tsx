import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { BrewAsset } from '../types';

export type DungeonMapEditorProps = {
  title: string;
  mapSource?: string;
  rooms: { number: string; title: string }[];
  markers: { number: string; x: number; y: number }[];
  assets?: ReadonlyMap<string, BrewAsset>;
  onClose: () => void;
  onAddMarker: (marker: { number: string; x: number; y: number }) => void;
  onMoveMarker: (marker: { number: string; x: number; y: number }) => void;
  onRenameRoom: (number: string, title: string) => void;
  onRemoveRoom: (number: string) => void;
};

export function DungeonMapEditor({ title, mapSource, rooms, markers, assets, onClose, onAddMarker, onMoveMarker, onRenameRoom, onRemoveRoom }: DungeonMapEditorProps) {
  const [placing, setPlacing] = useState(false);
  const [dragging, setDragging] = useState<{ number: string; x: number; y: number } | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const asset = mapSource?.startsWith('asset://') ? assets?.get(mapSource.slice(8)) : undefined;
  const url = useMemo(() => asset ? URL.createObjectURL(asset.blob) : mapSource, [asset?.blob, mapSource]);
  useEffect(() => () => { if (asset && url) URL.revokeObjectURL(url); }, [asset, url]);
  const next = String(Math.max(0, ...[...rooms, ...markers].map((item) => Number.parseInt(item.number, 10)).filter(Number.isFinite)) + 1);
  const point = (x: number, y: number) => { const rect = canvas.current?.getBoundingClientRect(); return rect ? { x: Math.max(0, Math.min(100, (x - rect.left) / rect.width * 100)), y: Math.max(0, Math.min(100, (y - rect.top) / rect.height * 100)) } : null; };
  const place = (event: MouseEvent<HTMLDivElement>) => { if (!placing) return; const position = point(event.clientX, event.clientY); if (position) onAddMarker({ number: next, ...position }); setPlacing(false); };
  return <div className="dungeon-map-backdrop" onClick={onClose} role="presentation"><section aria-label={`${title} map editor`} className="dungeon-map-dialog" onClick={(event) => event.stopPropagation()}><header><div><small>Edit dungeon map</small><h2>{title}</h2></div><button aria-label="Close map editor" onClick={onClose} type="button">×</button></header>{url ? <div className={`dungeon-map-canvas${placing ? ' is-placing' : ''}`} onClick={place} ref={canvas}><img alt={`${title} map`} src={url} />{markers.map((marker) => <button className="dungeon-room-marker" key={marker.number} onClick={(event) => event.stopPropagation()} onPointerDown={(event) => { moved.current = false; event.currentTarget.setPointerCapture(event.pointerId); setDragging(marker); }} onPointerMove={(event) => { if (dragging?.number !== marker.number) return; const position = point(event.clientX, event.clientY); if (position) { moved.current = true; setDragging({ number: marker.number, ...position }); } }} onPointerUp={(event) => { if (dragging?.number !== marker.number) return; const position = point(event.clientX, event.clientY); if (position) onMoveMarker({ number: marker.number, ...position }); setDragging(null); }} style={{ left: `${dragging?.number === marker.number ? dragging.x : marker.x}%`, top: `${dragging?.number === marker.number ? dragging.y : marker.y}%` }} type="button">{marker.number}</button>)}</div> : <p>Add an image inside this dungeon block first.</p>}<div className="dungeon-map-actions"><button disabled={!url} onClick={() => setPlacing(true)} type="button">Add room {next}</button>{placing && <span className="dungeon-map-placement-help">Tap the map to place it</span>}</div><div className="dungeon-room-ledger">{rooms.map((room) => <label className="dungeon-room-list-item" key={room.number}><span>{room.number}</span><input aria-label={`Room ${room.number} name`} defaultValue={room.title} onBlur={(event) => onRenameRoom(room.number, event.currentTarget.value.trim() || `Room ${room.number}`)} /><button aria-label={`Remove room ${room.number}`} className="dungeon-room-remove" onClick={() => onRemoveRoom(room.number)} type="button">×</button></label>)}</div></section></div>;
}
