import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { roomNumber } from '../lib/dungeons';
import type { BrewAsset, CampaignMapRoom, DungeonArea, DungeonRoomTextField } from '../types';

export function DungeonRoomMap({ area, asset, label, activeRoom, editable = false, placing = false, empty, onPlace, onSelect, onMove }: {
  area: DungeonArea;
  asset?: BrewAsset;
  label?: string;
  activeRoom?: CampaignMapRoom;
  editable?: boolean;
  placing?: boolean;
  empty?: (unavailable: boolean) => ReactNode;
  onPlace?: (point: { x: number; y: number }) => void;
  onSelect: (roomId: string, trigger: HTMLButtonElement) => void;
  onMove?: (roomId: string, point: { x: number; y: number }) => void;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const ignoreClick = useRef(false);
  const source = area.imageSource;
  const blob = asset?.blob;
  const remoteUrl = source?.startsWith('https://') ? source : undefined;
  const imageSource = blob ?? remoteUrl;
  const [failedImage, setFailedImage] = useState<Blob | string>();
  useLayoutEffect(() => {
    if (!blob || !image.current) return;
    const url = URL.createObjectURL(blob);
    image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  if (!imageSource || imageSource === failedImage) {
    return empty?.(Boolean(source)) ?? null;
  }

  const pointAt = (event: { clientX: number; clientY: number }) => {
    const rect = canvas.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    return {
      x: Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)),
      y: Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100))
    };
  };
  const roomsById = new Map(area.rooms.map((room) => [room.id, room]));

  return (
    <div className={`maps-canvas dungeon-map-canvas${placing ? ' is-placing' : ''}`} onClick={(event) => {
      if (!placing || event.detail === 0) return;
      const point = pointAt(event);
      if (point) onPlace?.(point);
    }} ref={canvas}>
      <img alt={label || area.name || 'Dungeon map'} draggable={false} onError={() => setFailedImage(imageSource)} ref={image} src={remoteUrl} />
      {area.markers.map((pin) => {
        const room = roomsById.get(pin.roomId);
        if (!room) return null;
        return (
          <button aria-label={`Map pin ${roomNumber(room)}, ${room.name || 'Untitled room'}`} aria-pressed={activeRoom ? activeRoom.id === room.id : undefined} className={`map-number-pin${editable && !placing ? ' is-draggable' : ''}`} key={pin.roomId}
            onClick={(event) => {
              if (placing) return;
              if (event.detail === 0 || !ignoreClick.current) onSelect(room.id, event.currentTarget);
              ignoreClick.current = false;
            }}
            onPointerDown={(event) => {
              ignoreClick.current = false;
              if (!editable || placing || event.button !== 0) return;
              dragStart.current = { x: event.clientX, y: event.clientY };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerCancel={() => { dragStart.current = null; }}
            onPointerUp={(event) => {
              const start = dragStart.current;
              dragStart.current = null;
              if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5) return;
              const point = pointAt(event);
              if (point) {
                ignoreClick.current = true;
                onMove?.(pin.roomId, point);
              }
            }}
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }} type="button"
          >{roomNumber(room)}</button>
        );
      })}
    </div>
  );
}

function RoomTextField({ label, value, placeholder, onChange }: {
  label: string;
  value: string;
  placeholder: string;
  onChange?: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const pendingSave = useRef<(() => void) | null>(null);
  const markdown = useMemo(() => <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{value}</ReactMarkdown>, [value]);
  const saveDraft = useCallback(() => {
    const save = pendingSave.current;
    pendingSave.current = null;
    save?.();
  }, []);

  useLayoutEffect(() => {
    if (!editing) return;
    const saveWhenHidden = () => {
      if (document.visibilityState === 'hidden') saveDraft();
    };
    document.addEventListener('visibilitychange', saveWhenHidden);
    window.addEventListener('pagehide', saveDraft);
    return () => {
      document.removeEventListener('visibilitychange', saveWhenHidden);
      window.removeEventListener('pagehide', saveDraft);
      saveDraft();
    };
  }, [editing, saveDraft]);

  if (!onChange) return markdown;

  return <div className="dungeon-room-text-field">
    {editing ? (
      <textarea aria-label={label} onBlur={() => {
        saveDraft();
        setEditing(false);
      }} onChange={(event) => {
        // Keep the draft in the textarea until the user leaves the field.
        const text = event.currentTarget.value;
        pendingSave.current = () => onChange(text);
      }} defaultValue={value} placeholder={placeholder} ref={input} rows={4} />
    ) : (
      <>
        <button aria-label={`Edit ${label}`} className="dungeon-room-edit-text" onClick={() => {
          // Focus within the tap so iOS opens the keyboard for this field.
          flushSync(() => setEditing(true));
          input.current?.focus();
        }} onMouseDown={(event) => event.preventDefault()} title={`Edit ${label}`} type="button" />
        <div className="dungeon-room-formatted-text">{value.trim() ? markdown : <p className="dungeon-empty-note">{placeholder}</p>}</div>
      </>
    )}
  </div>;
}

export const DungeonRoomText = memo(function DungeonRoomText({ room, heading: Heading = 'h3', onTextChange }: {
  room: CampaignMapRoom;
  heading?: 'h3' | 'h4';
  onTextChange?: (field: DungeonRoomTextField, value: string) => void;
}) {
  return (
    <>
      {(room.readAloud || onTextChange) && <div aria-label="Read aloud" className="dungeon-read-aloud" role="group">
        <RoomTextField label="Read aloud" onChange={onTextChange && ((value) => onTextChange('readAloud', value))}
          placeholder="Add read-aloud text…" value={room.readAloud} />
      </div>}
      {(room.notes || onTextChange) && <div className="dungeon-room-notes">
        <Heading>GM notes</Heading>
        <RoomTextField label="GM notes" onChange={onTextChange && ((value) => onTextChange('notes', value))}
          placeholder="Add GM notes…" value={room.notes} />
      </div>}
      {!onTextChange && !room.readAloud && !room.notes && <p className="dungeon-empty-note">No notes for this room yet.</p>}
    </>
  );
});
