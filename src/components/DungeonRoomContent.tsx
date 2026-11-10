import { memo, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { roomNumber } from '../lib/dungeons';
import type { BrewAsset, CampaignMapRoom, DungeonArea } from '../types';

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

export const DungeonRoomText = memo(function DungeonRoomText({ room, heading: Heading = 'h3' }: {
  room: CampaignMapRoom;
  heading?: 'h3' | 'h4';
}) {
  return (
    <>
      {room.readAloud && <div aria-label="Read aloud" className="dungeon-read-aloud" role="group"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{room.readAloud}</ReactMarkdown></div>}
      {room.notes && <div className="dungeon-room-notes"><Heading>GM notes</Heading><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{room.notes}</ReactMarkdown></div>}
      {!room.readAloud && !room.notes && <p className="dungeon-empty-note">No notes for this room yet.</p>}
    </>
  );
});
