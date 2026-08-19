import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { catalogueReferenceFromUrl, entryFromReference, remarkCatalogueReferences } from '../catalogue/references';
import { encounterReferenceFromUrl, remarkEncounterReferences } from '../lib/encounterReferences';
import { worldbuildingReferenceFromUrl, remarkWorldbuildingReferences } from '../lib/worldbuildingReferences';
import { remarkAutoReferences } from '../lib/autoReferences';
import { getHeadingId } from '../lib/outline';
import { parseRendererBlocks, splitRendererPages, type RendererBlock } from '../renderer/blocks';
import { catalogueCategoryLabel, type CatalogueEntry, type CustomCatalogueCategory } from '../catalogue/types';
import type { Brew, BrewAsset, CampaignMapRecord, Encounter, WorldbuildingEntry, WorldbuildingType } from '../types';
import { CatalogueEntryDetails } from './CatalogueEntryDetails';
import { WorldbuildingReferenceDetails } from './WorldbuildingReferenceDetails';
import '../homebrewery-theme.css';

type BrewPreviewProps = {
  brew: Brew;
  assets?: ReadonlyMap<string, BrewAsset>;
  catalogue?: ReadonlyMap<string, CatalogueEntry>;
  catalogueCategories?: readonly CustomCatalogueCategory[];
  onReferenceOpen?: (entry: CatalogueEntry) => void;
  encounters?: ReadonlyMap<string, Encounter>;
  onEncounterOpen?: (encounter: Encounter) => void;
  worldbuilding?: ReadonlyMap<string, WorldbuildingEntry>;
  worldbuildingTypes?: readonly WorldbuildingType[];
  onWorldbuildingOpen?: (entry: WorldbuildingEntry) => void;
  onOpenInWorldbuilding?: (entry: WorldbuildingEntry) => void;
  onDeleteWorldbuildingReference?: (entry: WorldbuildingEntry) => void;
  onAddWorldbuildingNote?: (entry: WorldbuildingEntry, note: string) => void;
  onAddDungeonMarker?: (title: string, marker: { number: string; x: number; y: number }) => void;
  onMoveDungeonMarker?: (title: string, marker: { number: string; x: number; y: number }) => void;
  onRenameDungeonRoom?: (title: string, number: string, roomTitle: string) => void;
  onRemoveDungeonRoom?: (title: string, number: string) => void;
  maps?: ReadonlyMap<string, CampaignMapRecord>;
};

type MarkdownRendererProps = {
  content: string;
  getId: (children: ReactNode) => string;
  assets?: ReadonlyMap<string, BrewAsset>;
  catalogue?: ReadonlyMap<string, CatalogueEntry>;
  catalogueCategories?: readonly CustomCatalogueCategory[];
  onReferenceOpen?: (entry: CatalogueEntry) => void;
  encounters?: ReadonlyMap<string, Encounter>;
  onEncounterOpen?: (encounter: Encounter) => void;
  worldbuilding?: ReadonlyMap<string, WorldbuildingEntry>;
  worldbuildingTypes?: readonly WorldbuildingType[];
  onWorldbuildingOpen?: (entry: WorldbuildingEntry) => void;
  onOpenInWorldbuilding?: (entry: WorldbuildingEntry) => void;
  onDeleteWorldbuildingReference?: (entry: WorldbuildingEntry) => void;
  onAddWorldbuildingNote?: (entry: WorldbuildingEntry, note: string) => void;
};

type RenderDependencies = Omit<MarkdownRendererProps, 'content' | 'getId'>;

function MapBlock({ map, brew, assets, encounters }: { map?: CampaignMapRecord; brew: Brew; assets?: ReadonlyMap<string, BrewAsset>; encounters?: ReadonlyMap<string, Encounter> }) {
  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const asset = map?.imageSource?.startsWith('asset://') ? assets?.get(map.imageSource.slice(8)) : undefined;
  const mapUrl = useMemo(() => asset ? URL.createObjectURL(asset.blob) : map?.imageSource, [asset?.blob, map?.imageSource]);
  useEffect(() => () => { if (asset && mapUrl) URL.revokeObjectURL(mapUrl); }, [asset, mapUrl]);
  const room = map?.rooms.find((item) => item.id === roomId) ?? null;
  const jump = () => {
    if (!room?.brewSectionId) return;
    const [brewId, sectionId] = room.brewSectionId.split(':');
    if (brewId !== brew.id || !sectionId) return;
    setOpen(false);
    window.setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };
  if (!map) return <section className="brew-map-card is-missing"><small>Map</small><strong>Map unavailable</strong><p>This map may not yet exist on this device.</p></section>;
  return <section className="brew-map-card"><header><div><small>Campaign map</small><h3>{map.name}</h3><p>{map.rooms.length} numbered area{map.rooms.length === 1 ? '' : 's'}</p></div><button disabled={!mapUrl} onClick={() => setOpen(true)} type="button">Open map</button></header>{open && <div className="dungeon-map-backdrop" onClick={() => setOpen(false)} role="presentation"><section aria-label={`${map.name} map`} className="dungeon-map-dialog map-preview-dialog" onClick={(event) => event.stopPropagation()}><header><div><small>Campaign map</small><h2>{map.name}</h2></div><button aria-label="Close map" onClick={() => setOpen(false)} type="button">×</button></header>{mapUrl ? <div className="dungeon-map-canvas"><img alt={`${map.name} map`} src={mapUrl} />{map.markers.map((marker) => { const item = map.rooms.find((candidate) => candidate.id === marker.roomId); return item ? <button aria-label={`Open ${item.name}`} className="dungeon-room-marker" key={item.id} onClick={() => setRoomId(item.id)} style={{ left: `${marker.x}%`, top: `${marker.y}%` }} type="button">{item.number}</button> : null; })}</div> : <p>Map image unavailable on this device.</p>}{room && <section className="map-preview-room"><header><h3>{room.number}. {room.name}</h3><button onClick={() => setRoomId(null)} type="button">Back to map</button></header>{room.readAloud && <blockquote>{room.readAloud}</blockquote>}{room.notes && <p className="map-preview-notes">{room.notes}</p>}{room.encounterIds.length > 0 && <div className="map-preview-encounters">{room.encounterIds.map((id) => encounters?.get(id)).filter((item): item is Encounter => Boolean(item)).map((encounter) => <span key={encounter.id}>{encounter.name || 'Untitled encounter'}</span>)}</div>}{room.brewSectionId?.startsWith(`${brew.id}:`) && <button className="primary-button" onClick={jump} type="button">Go to room in brew</button>}</section>}</section></div>}</section>;
}

type CharacterRendererBlock = {
  type: 'statblock' | 'item' | 'spell';
  content: string;
  classes?: string[];
};

function DungeonBlock({ block, assets, onAddMarker, onMoveMarker, onRenameRoom, onRemoveRoom }: { block: Extract<RendererBlock, { type: 'dungeon' }>; assets?: ReadonlyMap<string, BrewAsset>; onAddMarker?: (title: string, marker: { number: string; x: number; y: number }) => void; onMoveMarker?: (title: string, marker: { number: string; x: number; y: number }) => void; onRenameRoom?: (title: string, number: string, roomTitle: string) => void; onRemoveRoom?: (title: string, number: string) => void }) {
  const [open, setOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [draftMarker, setDraftMarker] = useState<{ number: string; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState<{ number: string; x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const markerMovedRef = useRef(false);
  const assetId = block.mapSource?.startsWith('asset://') ? block.mapSource.slice('asset://'.length) : '';
  const asset = assetId ? assets?.get(assetId) : undefined;
  const mapUrl = useMemo(() => asset ? URL.createObjectURL(asset.blob) : block.mapSource, [asset?.blob, block.mapSource]);
  useEffect(() => () => { if (asset && mapUrl) URL.revokeObjectURL(mapUrl); }, [asset, mapUrl]);
  useEffect(() => { setDraftMarker(null); setDragging(null); }, [block.markers]);
  const openRoom = (number: string) => {
    setOpen(false);
    const target = [...document.querySelectorAll<HTMLElement>('.brew-book h1, .brew-book h2, .brew-book h3, .brew-book h4, .brew-book h5, .brew-book h6')]
      .find((heading) => new RegExp(`^\\s*${number.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}(?:[.:\\s-]|$)`).test(heading.textContent ?? ''));
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const nextNumber = String(Math.max(0, ...[...block.rooms, ...block.markers].map((item) => Number.parseInt(item.number, 10)).filter(Number.isFinite)) + 1);
  const placeMarker = (event: MouseEvent<HTMLDivElement>) => {
    if (!placing || !onAddMarker) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const marker = { number: nextNumber, x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 };
    setDraftMarker(marker);
    onAddMarker(block.title, marker);
    setPlacing(false);
  };
  const markerPosition = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return rect && rect.width && rect.height ? { x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)), y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)) } : null;
  };
  const markers = (draftMarker ? [...block.markers, draftMarker] : block.markers).map((marker) => dragging?.number === marker.number ? dragging : marker);
  return <section className="brew-dungeon-card" data-dungeon-title={block.title}><header><div><small>Dungeon map</small><h3>{block.title}</h3></div><button disabled={!mapUrl} onClick={() => setOpen(true)} type="button">Map</button></header>{!mapUrl && <p>Add an image line inside this dungeon block to use the map.</p>}{open && <div className="dungeon-map-backdrop" onClick={() => setOpen(false)} role="presentation"><section aria-label={`${block.title} map`} className="dungeon-map-dialog" onClick={(event) => event.stopPropagation()}><header><h2>{block.title}</h2><button aria-label="Close map" onClick={() => setOpen(false)} type="button">×</button></header>{mapUrl && <div className={`dungeon-map-canvas${placing ? ' is-placing' : ''}`} onClick={placeMarker} ref={canvasRef}><img alt={`${block.title} map`} src={mapUrl} />{markers.map((marker) => <button aria-label={`Open room ${marker.number}`} className="dungeon-room-marker" key={marker.number} onClick={(event) => { event.stopPropagation(); if (markerMovedRef.current) { markerMovedRef.current = false; return; } openRoom(marker.number); }} onPointerDown={(event) => { event.stopPropagation(); if (!onMoveMarker) return; markerMovedRef.current = false; event.currentTarget.setPointerCapture(event.pointerId); setDragging(marker); }} onPointerMove={(event) => { if (!dragging || dragging.number !== marker.number) return; const position = markerPosition(event.clientX, event.clientY); if (position) { markerMovedRef.current = true; setDragging({ number: marker.number, ...position }); } }} onPointerUp={(event) => { if (!dragging || dragging.number !== marker.number) return; const position = markerPosition(event.clientX, event.clientY); if (position) onMoveMarker?.(block.title, { number: marker.number, ...position }); setDragging(null); }} style={{ left: `${marker.x}%`, top: `${marker.y}%` }} type="button">{marker.number}</button>)}</div>}<div className="dungeon-map-actions">{onAddMarker && <button disabled={!mapUrl} onClick={() => setPlacing((current) => !current)} type="button">{placing ? 'Tap the map to place it' : `Add room ${nextNumber}`}</button>}{placing && <span className="dungeon-map-placement-help">Tap the room’s position</span>}<div className="dungeon-room-ledger">{block.rooms.map((room) => <label className="dungeon-room-list-item" key={room.number}><button aria-label={`Open room ${room.number}`} onClick={() => openRoom(room.number)} type="button">{room.number}</button><input aria-label={`Name for room ${room.number}`} defaultValue={room.title} onBlur={(event) => onRenameRoom?.(block.title, room.number, event.currentTarget.value.trim() || `Room ${room.number}`)} /><button aria-label={`Remove room ${room.number} from map`} className="dungeon-room-remove" onClick={() => onRemoveRoom?.(block.title, room.number)} type="button">×</button></label>)}</div></div></section></div>}</section>;
}

function LocalAssetImage({ asset, alt }: { asset: BrewAsset; alt: string }) {
  const url = useMemo(() => URL.createObjectURL(asset.blob), [asset.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <figure className="brew-image"><img alt={alt} src={url} /><figcaption>{alt}</figcaption></figure>;
}

function previewUrlTransform(url: string): string {
  return catalogueReferenceFromUrl(url) || encounterReferenceFromUrl(url) || worldbuildingReferenceFromUrl(url) ? url : defaultUrlTransform(url);
}

// Custom references use a pipe between their stable id and display label. In a
// GFM table that pipe is otherwise treated as another table-cell boundary
// before the custom reference plugins get a chance to process it.
function escapeReferenceSeparators(content: string): string {
  return content.replace(/\[\[([a-z][a-z0-9-]*:[0-9a-f-]+)\\?\|([^\]\r\n]+)\]\]/gi, '[[\$1\\|\$2]]');
}

function CatalogueReferenceLink({
  children,
  entry,
  categories,
  onOpen
}: {
  children: ReactNode;
  entry: CatalogueEntry;
  categories?: readonly CustomCatalogueCategory[];
  onOpen?: (entry: CatalogueEntry) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="catalogue-reference-wrap" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      <button
        aria-haspopup="dialog"
        className="catalogue-reference-link"
        onBlur={() => setVisible(false)}
        onClick={() => onOpen?.(entry)}
        onFocus={() => setVisible(true)}
        type="button"
      >
        {children}
      </button>
      {visible && <span className="catalogue-reference-tooltip" role="tooltip"><CatalogueEntryDetails categoryLabel={catalogueCategoryLabel(entry.category, categories)} compact entry={entry} /></span>}
    </span>
  );
}

function EncounterReferenceLink({
  children,
  encounter,
  onOpen
}: {
  children: ReactNode;
  encounter: Encounter;
  onOpen?: (encounter: Encounter) => void;
}) {
  return (
    <button className="brew-encounter-reference" onClick={() => onOpen?.(encounter)} type="button">
      <span>Combat encounter</span>
      <strong>{encounter.name || children}</strong>
      <small>{encounter.participants.length} combatant{encounter.participants.length === 1 ? '' : 's'} · {encounter.status}</small>
    </button>
  );
}

function WorldbuildingReferenceLink({
  children,
  entry,
  types,
  onOpen,
  onOpenInWorldbuilding,
  onDelete,
  onAddNote
}: {
  children: ReactNode;
  entry: WorldbuildingEntry;
  types?: readonly WorldbuildingType[];
  onOpen?: (entry: WorldbuildingEntry) => void;
  onOpenInWorldbuilding?: (entry: WorldbuildingEntry) => void;
  onDelete?: (entry: WorldbuildingEntry) => void;
  onAddNote?: (entry: WorldbuildingEntry, note: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [note, setNote] = useState('');
  const closeTimer = useRef<number | null>(null);
  const keepOpen = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    setVisible(true);
  };
  const closeLater = () => {
    closeTimer.current = window.setTimeout(() => setVisible(false), 140);
  };
  const addNote = () => {
    const value = note.trim();
    if (!value) return;
    onAddNote?.(entry, value);
    setNote('');
  };
  return (
    <span className="worldbuilding-reference-wrap" onMouseEnter={keepOpen} onMouseLeave={closeLater}>
      <button
        aria-haspopup="dialog"
        className="worldbuilding-reference-link"
        onBlur={closeLater}
        onClick={() => onOpen?.(entry)}
        onFocus={keepOpen}
        type="button"
      >
        {children}
      </button>
      {visible && (
        <span className="worldbuilding-reference-tooltip reference-popover" onMouseEnter={keepOpen} onMouseLeave={closeLater} role="dialog" aria-label={`${entry.name} reference`}>
          <WorldbuildingReferenceDetails compact entry={entry} types={types} />
          <label className="reference-quick-note">Quick note<textarea onChange={(event) => setNote(event.target.value)} placeholder="Add a comment…" value={note} /></label>
          <span className="reference-popover-actions"><button disabled={!note.trim()} onClick={addNote} type="button">Add note</button><button onClick={() => onOpenInWorldbuilding?.(entry)} type="button">Open</button><button className="reference-remove" onClick={() => onDelete?.(entry)} type="button">Delete reference</button></span>
        </span>
      )}
    </span>
  );
}

function MarkdownRenderer({ content, getId, assets, catalogue, catalogueCategories, onReferenceOpen, encounters, onEncounterOpen, worldbuilding, worldbuildingTypes, onWorldbuildingOpen, onOpenInWorldbuilding, onDeleteWorldbuildingReference, onAddWorldbuildingNote }: MarkdownRendererProps) {
  const autoReferences = useMemo(
    () => remarkAutoReferences({ catalogue, encounters, worldbuilding }),
    [catalogue, encounters, worldbuilding]
  );

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkCatalogueReferences, remarkEncounterReferences, remarkWorldbuildingReferences, autoReferences]}
      urlTransform={previewUrlTransform}
      components={{
        h1: ({ children }) => <h1 id={getId(children)}>{children}</h1>,
        h2: ({ children }) => <h2 id={getId(children)}>{children}</h2>,
        h3: ({ children }) => <h3 id={getId(children)}>{children}</h3>,
        h4: ({ children }) => <h4 id={getId(children)}>{children}</h4>,
        h5: ({ children }) => <h5 id={getId(children)}>{children}</h5>,
        h6: ({ children }) => <h6 id={getId(children)}>{children}</h6>,
        blockquote: ({ children }) => <blockquote>{children}</blockquote>,
        img: ({ src, alt }) => {
          if (src?.startsWith('asset://')) {
            const asset = assets?.get(src.slice('asset://'.length));
            return asset ? <LocalAssetImage alt={alt ?? asset.alt} asset={asset} /> : <span className="missing-asset">Image unavailable on this device</span>;
          }
          if (!src?.match(/^https?:\/\//i)) return null;
          return <figure className="brew-image"><img alt={alt ?? ''} loading="lazy" src={src} /><figcaption>{alt}</figcaption></figure>;
        },
        a: ({ href, children }) => {
          const encounterReference = encounterReferenceFromUrl(href);
          if (encounterReference) {
            const encounter = encounters?.get(encounterReference.id);
            return encounter
              ? <EncounterReferenceLink encounter={encounter} onOpen={onEncounterOpen}>{children}</EncounterReferenceLink>
              : <span className="missing-reference">{children}</span>;
          }
          const worldbuildingReference = worldbuildingReferenceFromUrl(href);
          if (worldbuildingReference) {
            const entry = worldbuilding?.get(worldbuildingReference.id);
            return entry
              ? <WorldbuildingReferenceLink entry={entry} onAddNote={onAddWorldbuildingNote} onDelete={onDeleteWorldbuildingReference} onOpen={onWorldbuildingOpen} onOpenInWorldbuilding={onOpenInWorldbuilding} types={worldbuildingTypes}>{children}</WorldbuildingReferenceLink>
              : <span className="missing-reference">{children}</span>;
          }
          const reference = catalogueReferenceFromUrl(href);
          if (!reference) return <a href={href}>{children}</a>;
          const entry = catalogue && entryFromReference(catalogue, reference);
          return entry
            ? <CatalogueReferenceLink categories={catalogueCategories} entry={entry} onOpen={onReferenceOpen}>{children}</CatalogueReferenceLink>
            : <span className="missing-reference">{children}</span>;
        }
      }}
    >
      {escapeReferenceSeparators(content)}
    </ReactMarkdown>
  );
}

function CharacterBlock({ block, getId, ...dependencies }: { block: CharacterRendererBlock; getId: (children: ReactNode) => string } & RenderDependencies) {
  const [title, ...body] = block.content.split('\n');
  const fallbackTitle = block.type === 'statblock' ? 'Untitled creature' : `Untitled ${block.type}`;
  const className = [`brew-${block.type}`, ...(block.classes ?? [])].join(' ');
  return (
    <section className={className}>
      <h3>{title || fallbackTitle}</h3>
      <div className="brew-rule" />
      {body.length > 0 && (
        <div className="brew-block-content">
          <MarkdownRenderer content={body.join('\n')} getId={getId} {...dependencies} />
        </div>
      )}
    </section>
  );
}

function renderBlock(
  block: RendererBlock,
  getId: (children: ReactNode) => string,
  assets: ReadonlyMap<string, BrewAsset> | undefined,
  catalogue: ReadonlyMap<string, CatalogueEntry> | undefined,
  catalogueCategories: readonly CustomCatalogueCategory[] | undefined,
  onReferenceOpen: ((entry: CatalogueEntry) => void) | undefined,
  encounters: ReadonlyMap<string, Encounter> | undefined,
  onEncounterOpen: ((encounter: Encounter) => void) | undefined,
  worldbuilding: ReadonlyMap<string, WorldbuildingEntry> | undefined,
  worldbuildingTypes: readonly WorldbuildingType[] | undefined,
  onWorldbuildingOpen: ((entry: WorldbuildingEntry) => void) | undefined,
  onOpenInWorldbuilding: ((entry: WorldbuildingEntry) => void) | undefined,
  onDeleteWorldbuildingReference: ((entry: WorldbuildingEntry) => void) | undefined,
  onAddWorldbuildingNote: ((entry: WorldbuildingEntry, note: string) => void) | undefined,
  onAddDungeonMarker: ((title: string, marker: { number: string; x: number; y: number }) => void) | undefined,
  onMoveDungeonMarker: ((title: string, marker: { number: string; x: number; y: number }) => void) | undefined,
  onRenameDungeonRoom: ((title: string, number: string, roomTitle: string) => void) | undefined,
  onRemoveDungeonRoom: ((title: string, number: string) => void) | undefined,
  maps: ReadonlyMap<string, CampaignMapRecord> | undefined,
  brew: Brew,
  key: string
) {
  const dependencies: RenderDependencies = {
    assets,
    catalogue,
    catalogueCategories,
    onReferenceOpen,
    encounters,
    onEncounterOpen,
    worldbuilding,
    worldbuildingTypes,
    onWorldbuildingOpen,
    onOpenInWorldbuilding,
    onDeleteWorldbuildingReference,
    onAddWorldbuildingNote
  };

  if (block.type === 'markdown') return <MarkdownRenderer content={block.content} getId={getId} key={key} {...dependencies} />;
  if (block.type === 'columns') return <section className="brew-columns" key={key}><MarkdownRenderer content={block.content} getId={getId} {...dependencies} /></section>;
  if (block.type === 'wide') return <section className="brew-wide" key={key}><MarkdownRenderer content={block.content} getId={getId} {...dependencies} /></section>;
  if (block.type === 'homebrewery') {
    return <section className={['brew-homebrewery', ...block.classes].join(' ')} key={key}><MarkdownRenderer content={block.content} getId={getId} {...dependencies} /></section>;
  }
  if (block.type === 'dungeon') return <DungeonBlock assets={assets} block={block} key={key} onAddMarker={onAddDungeonMarker} onMoveMarker={onMoveDungeonMarker} onRemoveRoom={onRemoveDungeonRoom} onRenameRoom={onRenameDungeonRoom} />;
  if (block.type === 'map') return <MapBlock assets={assets} brew={brew} encounters={encounters} key={key} map={maps?.get(block.mapId)} />;
  if (block.type === 'callout') {
    return (
      <aside className={`brew-callout callout-${block.variant}`} key={key}>
        {block.title && <h4>{block.title}</h4>}
        <MarkdownRenderer content={block.content} getId={getId} {...dependencies} />
      </aside>
    );
  }
  if (block.type === 'pagebreak') return null;
  if (block.type === 'columnbreak') return <div aria-label="Column break" className="brew-column-break" key={key} role="separator" />;
  if (block.type === 'spacer') {
    return <div aria-hidden className="brew-spacer" key={key} style={{ '--brew-spacer-size': block.size } as CSSProperties} />;
  }
  return <CharacterBlock block={block} getId={getId} key={key} {...dependencies} />;
}

export const BrewPreview = memo(function BrewPreview({ brew, assets, catalogue, catalogueCategories, onReferenceOpen, encounters, onEncounterOpen, worldbuilding, worldbuildingTypes, onWorldbuildingOpen, onOpenInWorldbuilding, onDeleteWorldbuildingReference, onAddWorldbuildingNote, onAddDungeonMarker, onMoveDungeonMarker, onRenameDungeonRoom, onRemoveDungeonRoom, maps }: BrewPreviewProps) {
  const headingOccurrences = new Map<string, number>();
  const getId = (children: ReactNode) => {
    const text = String(children);
    const occurrence = headingOccurrences.get(text) ?? 0;
    headingOccurrences.set(text, occurrence + 1);
    return getHeadingId(text, occurrence);
  };
  const blocks = parseRendererBlocks(brew.content);
  const pages = splitRendererPages(blocks);

  return (
    <div
      className={`brew-book tone-${brew.rendererSettings.parchmentTone}`}
      style={{ '--brew-accent': brew.rendererSettings.accentColor } as CSSProperties}
    >
      {pages.map((page, pageIndex) => (
        <article className="brew-preview brew-continuous" key={`page-${pageIndex}`}>
          {page.map((block, blockIndex) => renderBlock(block, getId, assets, catalogue, catalogueCategories, onReferenceOpen, encounters, onEncounterOpen, worldbuilding, worldbuildingTypes, onWorldbuildingOpen, onOpenInWorldbuilding, onDeleteWorldbuildingReference, onAddWorldbuildingNote, onAddDungeonMarker, onMoveDungeonMarker, onRenameDungeonRoom, onRemoveDungeonRoom, maps, brew, `page-${pageIndex}-block-${blockIndex}`))}
          <span aria-hidden className="brew-page-number">{pageIndex + 1}</span>
        </article>
      ))}
    </div>
  );
}, (previous, next) =>
  previous.brew === next.brew
  && previous.assets === next.assets
  && previous.catalogue === next.catalogue
  && previous.catalogueCategories === next.catalogueCategories
  && previous.encounters === next.encounters
  && previous.worldbuilding === next.worldbuilding
  && previous.worldbuildingTypes === next.worldbuildingTypes
);
