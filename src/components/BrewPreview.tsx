import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { catalogueReferenceFromUrl, entryFromReference, remarkCatalogueReferences } from '../catalogue/references';
import { encounterReferenceFromUrl, remarkEncounterReferences } from '../lib/encounterReferences';
import { worldbuildingReferenceFromUrl, remarkWorldbuildingReferences } from '../lib/worldbuildingReferences';
import { remarkAutoReferences } from '../lib/autoReferences';
import { getHeadingId } from '../lib/outline';
import { parseRendererBlocks, splitRendererPages, type RendererBlock } from '../renderer/blocks';
import { catalogueCategoryLabel, type CatalogueEntry, type CustomCatalogueCategory } from '../catalogue/types';
import type { Brew, BrewAsset, Encounter, WorldbuildingEntry, WorldbuildingType } from '../types';
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

type CharacterRendererBlock = {
  type: 'statblock' | 'item' | 'spell';
  content: string;
  classes?: string[];
};

function DungeonBlock({ block, assets }: { block: Extract<RendererBlock, { type: 'dungeon' }>; assets?: ReadonlyMap<string, BrewAsset> }) {
  const [open, setOpen] = useState(false);
  const assetId = block.mapSource?.startsWith('asset://') ? block.mapSource.slice('asset://'.length) : '';
  const asset = assetId ? assets?.get(assetId) : undefined;
  const mapUrl = useMemo(() => asset ? URL.createObjectURL(asset.blob) : block.mapSource, [asset?.blob, block.mapSource]);
  useEffect(() => () => { if (asset && mapUrl) URL.revokeObjectURL(mapUrl); }, [asset, mapUrl]);
  const openRoom = (number: string) => {
    setOpen(false);
    const target = [...document.querySelectorAll<HTMLElement>('.brew-book h1, .brew-book h2, .brew-book h3, .brew-book h4, .brew-book h5, .brew-book h6')]
      .find((heading) => new RegExp(`^\\s*${number.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}(?:[.:\\s-]|$)`).test(heading.textContent ?? ''));
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return <section className="brew-dungeon-card" data-dungeon-title={block.title}><header><div><small>Dungeon map</small><h3>{block.title}</h3></div><button disabled={!mapUrl} onClick={() => setOpen(true)} type="button">Map</button></header>{!mapUrl && <p>Add an image line inside this dungeon block to use the map.</p>}{open && <div className="dungeon-map-backdrop" onClick={() => setOpen(false)} role="presentation"><section aria-label={`${block.title} map`} className="dungeon-map-dialog" onClick={(event) => event.stopPropagation()}><header><h2>{block.title}</h2><button aria-label="Close map" onClick={() => setOpen(false)} type="button">×</button></header>{mapUrl && <img alt={`${block.title} map`} src={mapUrl} />}<div className="dungeon-room-ledger">{block.rooms.map((room) => <button key={room.number} onClick={() => openRoom(room.number)} type="button"><strong>{room.number}</strong>{room.title}</button>)}</div></section></div>}</section>;
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
  if (block.type === 'dungeon') return <DungeonBlock assets={assets} block={block} key={key} />;
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

export const BrewPreview = memo(function BrewPreview({ brew, assets, catalogue, catalogueCategories, onReferenceOpen, encounters, onEncounterOpen, worldbuilding, worldbuildingTypes, onWorldbuildingOpen, onOpenInWorldbuilding, onDeleteWorldbuildingReference, onAddWorldbuildingNote }: BrewPreviewProps) {
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
          {page.map((block, blockIndex) => renderBlock(block, getId, assets, catalogue, catalogueCategories, onReferenceOpen, encounters, onEncounterOpen, worldbuilding, worldbuildingTypes, onWorldbuildingOpen, onOpenInWorldbuilding, onDeleteWorldbuildingReference, onAddWorldbuildingNote, `page-${pageIndex}-block-${blockIndex}`))}
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
