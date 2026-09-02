import { createContext, useContext, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Compartment, EditorState, Facet } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import {
  Decoration,
  EditorView,
  MatchDecorator,
  WidgetType,
  type DecorationSet,
  ViewPlugin,
  type ViewUpdate
} from '@codemirror/view';
import { catalogueCategories, catalogueCategoryLabel, type CatalogueCategory, type CustomCatalogueCategory } from '../catalogue/types';
import { normalizeWorldbuildingName, worldbuildingKindLabels, worldbuildingKinds } from '../lib/worldbuilding';
import type { BrewAsset, CampaignMapRecord, WorldbuildingKind, WorldbuildingType } from '../types';

export type MarkdownEditorHandle = {
  getSelection: () => { start: number; end: number };
  focus: (position?: number) => void;
  scrollTo: (position: number) => void;
};

export const SpellcheckContext = createContext(true);

type MarkdownEditorProps = {
  content: string;
  onChange: (content: string) => void;
  onSelectionChange?: (selection: { start: number; end: number }) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  onCreateWorldbuildingReference?: (name: string, kind: WorldbuildingKind) => Promise<string | null> | string | null;
  onCreateCatalogueReference?: (name: string, category: CatalogueCategory) => Promise<string | null> | string | null;
  worldbuildingTypes?: readonly WorldbuildingType[];
  customCatalogueCategories?: readonly CustomCatalogueCategory[];
  ariaLabel?: string;
  compact?: boolean;
  spellcheckEnabled?: boolean;
  assets?: ReadonlyMap<string, BrewAsset>;
  onRotateImage?: (asset: BrewAsset) => void;
  onDeleteImage?: (asset: BrewAsset) => void;
  onOpenDungeonMap?: (title: string) => void;
  maps?: ReadonlyMap<string, CampaignMapRecord>;
  onOpenCampaignMap?: (mapId: string) => void;
  onOpenEncounter?: (encounterId: string) => void;
};

type ReferenceMenu = {
  name: string;
  from: number;
  to: number;
  x: number;
  y: number;
};

type MobileReferenceSelection = Pick<ReferenceMenu, 'name' | 'from' | 'to'>;

const emptyAssets = new Map<string, BrewAsset>();
const emptyMaps = new Map<string, CampaignMapRecord>();

class ReferenceChip extends WidgetType {
  constructor(private readonly label: string, private readonly kind: string, private readonly id: string) {
    super();
  }

  eq(other: ReferenceChip) {
    return other.label === this.label && other.kind === this.kind && other.id === this.id;
  }

  toDOM() {
    const element = document.createElement(this.kind === 'encounter' ? 'button' : 'span');
    element.className = this.kind === 'encounter' ? 'cm-reference-chip cm-encounter-reference-chip cm-encounter-reference-card' : 'cm-reference-chip cm-inline-reference';
    element.setAttribute('aria-label', `${this.kind} reference: ${this.label}`);
    element.title = this.kind === 'encounter' ? 'Open encounter editor' : `${this.kind} reference`;
    if (this.kind === 'encounter') {
      element.setAttribute('data-encounter-id', this.id);
      element.setAttribute('type', 'button');
      const eyebrow = document.createElement('span');
      eyebrow.textContent = 'Combat encounter';
      const name = document.createElement('strong');
      name.textContent = this.label;
      const hint = document.createElement('small');
      hint.textContent = 'Open encounter editor';
      element.append(eyebrow, name, hint);
      return element;
    }
    element.textContent = this.label;
    return element;
  }

  ignoreEvent() {
    return false;
  }
}

const referenceDecorator = new MatchDecorator({
  regexp: /\[\[([a-z][a-z0-9-]*):([0-9a-f-]+)(?:\|([^\]\r\n]+))?\]\]/gi,
  decoration: (match) => Decoration.replace({
    widget: new ReferenceChip(match[3]?.trim() || 'Reference', match[1], match[2]),
    inclusive: false
  })
});

type EncounterOpenHandler = (encounterId: string) => void;

const encounterOpenHandler = Facet.define<EncounterOpenHandler, EncounterOpenHandler | undefined>({
  combine: (handlers) => handlers[handlers.length - 1]
});
const encounterOpenHandlerCompartment = new Compartment();

const referenceDecorations = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = referenceDecorator.createDeco(view);
  }

  update(update: ViewUpdate) {
    this.decorations = referenceDecorator.updateDeco(update, this.decorations);
  }
}, {
  decorations: (value) => value.decorations,
  eventHandlers: {
    click: (event, view) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return false;
      const chip = target.closest<HTMLElement>('.cm-encounter-reference-chip[data-encounter-id]');
      const encounterId = chip?.dataset.encounterId;
      const openEncounter = view.state.facet(encounterOpenHandler);
      if (!encounterId || !openEncounter) return false;
      event.preventDefault();
      openEncounter(encounterId);
      return true;
    }
  }
});

type AssetLookup = (source: string) => BrewAsset | undefined;

const imageAssetLookup = Facet.define<AssetLookup, AssetLookup>({
  combine: (lookups) => lookups[lookups.length - 1] ?? (() => undefined)
});

const imageAssetLookupCompartment = new Compartment();
const markdownImagePattern = /!\[([^\]]*)\]\(([^\s)]+)(?:\s+["'][^"']*["'])?\)/g;

type DungeonImage = { title: string; markers: { number: string; x: number; y: number }[] };

class MarkdownImagePreview extends WidgetType {
  constructor(private readonly source: string, private readonly alt: string, private readonly asset?: BrewAsset, private readonly onRotate?: (asset: BrewAsset) => void, private readonly onDelete?: (asset: BrewAsset) => void, private readonly dungeon?: DungeonImage, private readonly onOpenDungeon?: (title: string) => void) {
    super();
  }

  eq(other: MarkdownImagePreview) {
    return other.source === this.source
      && other.alt === this.alt
      && other.asset?.updatedAt === this.asset?.updatedAt
      && other.asset?.blob === this.asset?.blob && other.dungeon?.title === this.dungeon?.title;
  }

  toDOM() {
    const figure = document.createElement('span');
    figure.className = 'cm-markdown-image-preview';
    const image = document.createElement('img');
    image.alt = this.alt || this.asset?.alt || 'Brew illustration';
    image.loading = 'lazy';

    if (this.source.startsWith('asset://')) {
      if (!this.asset) {
        figure.classList.add('is-missing');
        figure.textContent = 'Image unavailable on this device — sync with Drive to restore it.';
        return figure;
      }
      const objectUrl = URL.createObjectURL(this.asset.blob);
      figure.dataset.objectUrl = objectUrl;
      image.src = objectUrl;
    } else {
      image.src = this.source;
    }

    image.addEventListener('error', () => {
      figure.classList.add('is-missing');
      figure.replaceChildren(document.createTextNode('This image could not be displayed.'));
    }, { once: true });
    figure.append(image);
    if (this.dungeon) {
      figure.classList.add('is-dungeon-map');
      figure.title = 'Tap to edit dungeon rooms';
      figure.addEventListener('click', () => this.onOpenDungeon?.(this.dungeon!.title));
      for (const marker of this.dungeon.markers) {
        const pin = document.createElement('span');
        pin.className = 'cm-dungeon-room-marker';
        pin.style.left = `${marker.x}%`;
        pin.style.top = `${marker.y}%`;
        pin.textContent = marker.number;
        figure.append(pin);
      }
    }
    if (this.asset && this.onDelete) {
      const remove = document.createElement('button');
      remove.className = 'cm-image-delete-button';
      remove.setAttribute('aria-label', `Delete ${image.alt}`);
      remove.textContent = '×';
      remove.type = 'button';
      remove.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.onDelete?.(this.asset!);
      });
      figure.append(remove);
    }
    if (this.asset && this.onRotate) {
      const rotate = document.createElement('button');
      rotate.className = 'cm-image-rotate-button';
      rotate.setAttribute('aria-label', `Rotate ${image.alt}`);
      rotate.textContent = '↻';
      rotate.type = 'button';
      rotate.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.onRotate?.(this.asset!);
      });
      figure.append(rotate);
    }
    return figure;
  }

  destroy(dom: HTMLElement) {
    const objectUrl = dom.dataset.objectUrl;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }

  ignoreEvent() {
    return false;
  }
}

class MarkdownImageLabel extends WidgetType {
  constructor(private readonly label: string) {
    super();
  }

  eq(other: MarkdownImageLabel) {
    return other.label === this.label;
  }

  toDOM() {
    const element = document.createElement('span');
    element.className = 'cm-markdown-image-label';
    element.textContent = this.label || 'Brew illustration';
    return element;
  }

  ignoreEvent() {
    return false;
  }
}

class CampaignMapChip extends WidgetType {
  constructor(private readonly mapId: string, private readonly name: string, private readonly roomCount: number, private readonly onOpen?: (mapId: string) => void) { super(); }

  eq(other: CampaignMapChip) {
    return other.mapId === this.mapId && other.name === this.name && other.roomCount === this.roomCount;
  }

  toDOM() {
    const card = document.createElement('span');
    card.className = 'cm-campaign-map-chip';
    const details = document.createElement('span');
    const label = document.createElement('strong');
    label.textContent = this.name;
    const meta = document.createElement('small');
    meta.textContent = `${this.roomCount} numbered area${this.roomCount === 1 ? '' : 's'}`;
    details.append(label, meta);
    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = 'Edit map';
    open.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.onOpen?.(this.mapId);
    });
    card.append(details, open);
    return card;
  }

  ignoreEvent() { return false; }
}

function campaignMapDecorations(view: EditorView, maps: ReadonlyMap<string, CampaignMapRecord>, onOpen?: (mapId: string) => void): DecorationSet {
  const decorations = [];
  let position = 0;
  for (const line of view.state.doc.iterLines()) {
    const match = line.match(/^\s*:::map\s+([0-9a-f-]+)\s*$/i);
    if (match) {
      const mapId = match[1];
      const map = maps.get(mapId);
      decorations.push(Decoration.replace({ widget: new CampaignMapChip(mapId, map?.name || 'Map unavailable', map?.rooms.length || 0, onOpen), inclusive: false }).range(position, position + line.length));
    }
    position += line.length + 1;
  }
  return Decoration.set(decorations, true);
}

function campaignMapPreviews(maps: ReadonlyMap<string, CampaignMapRecord>, onOpen?: (mapId: string) => void) {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = campaignMapDecorations(view, maps, onOpen); }
    update(update: ViewUpdate) {
      if (update.docChanged || update.transactions.some((transaction) => transaction.reconfigured)) this.decorations = campaignMapDecorations(update.view, maps, onOpen);
    }
  }, { decorations: (value) => value.decorations });
}

function dungeonImageAt(doc: string, position: number, source: string): DungeonImage | undefined {
  const start = doc.lastIndexOf(':::', position);
  if (start < 0) return undefined;
  const lineEnd = doc.indexOf('\n', start);
  const header = doc.slice(start, lineEnd < 0 ? doc.length : lineEnd).match(/^:::(?:dungeon\s+)?(.+?)\s*$/i);
  if (!header || /^(note|warning|tip|descriptive|columns|wide|homebrewery|statblock|item|spell|pagebreak|columnbreak|spacer)(?:\s|$)/i.test(header[1])) return undefined;
  const close = doc.indexOf('\n:::', start + 3);
  if (close < position) return undefined;
  const body = doc.slice(lineEnd + 1, close < 0 ? doc.length : close);
  if (!body.includes(source)) return undefined;
  const image = [...body.matchAll(markdownImagePattern)].at(-1);
  if (!image || image[2] !== source) return undefined;
  return { title: header[1].trim(), markers: [...body.matchAll(/^::map-marker\s+(\S+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/gmi)].map((match) => ({ number: match[1], x: Number(match[2]), y: Number(match[3]) })) };
}

function imagePreviewDecorations(view: EditorView, onRotate?: (asset: BrewAsset) => void, onDelete?: (asset: BrewAsset) => void, onOpenDungeon?: (title: string) => void): DecorationSet {
  const lookup = view.state.facet(imageAssetLookup);
  const decorations = [];
  let position = 0;

  for (const line of view.state.doc.iterLines()) {
    markdownImagePattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = markdownImagePattern.exec(line))) {
      const source = match[2];
      const asset = source.startsWith('asset://') ? lookup(source) : undefined;
      const end = position + match.index + match[0].length;
      decorations.push(Decoration.replace({
        widget: new MarkdownImageLabel(match[1] || asset?.alt || 'Brew illustration'),
        inclusive: false
      }).range(position + match.index, end));
      decorations.push(Decoration.widget({
        side: 1,
        widget: new MarkdownImagePreview(source, match[1], asset, onRotate, onDelete, dungeonImageAt(view.state.doc.toString(), position + match.index, source), onOpenDungeon)
      }).range(end));
    }
    position += line.length + 1;
  }

  return Decoration.set(decorations, true);
}

function imagePreviews(onRotate?: (asset: BrewAsset) => void, onDelete?: (asset: BrewAsset) => void, onOpenDungeon?: (title: string) => void) {
  return ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = imagePreviewDecorations(view, onRotate, onDelete, onOpenDungeon);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.transactions.some((transaction) => transaction.reconfigured)) {
      this.decorations = imagePreviewDecorations(update.view, onRotate, onDelete, onOpenDungeon);
    }
  }
}, {
  decorations: (value) => value.decorations
  });
}

const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, color: '#7a2f27', fontWeight: '800' },
  { tag: tags.heading2, color: '#8a4a2c', fontWeight: '800' },
  { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], color: '#8b642f', fontWeight: '700' },
  { tag: tags.strong, color: '#4f2c25', fontWeight: '800' },
  { tag: tags.emphasis, color: '#6d4b72', fontStyle: 'italic' },
  { tag: tags.link, color: '#2f6473', textDecoration: 'underline' },
  { tag: tags.url, color: '#397b87' },
  { tag: tags.monospace, color: '#755326', backgroundColor: '#eadfca' },
  { tag: tags.quote, color: '#687547', fontStyle: 'italic' },
  { tag: [tags.list, tags.meta], color: '#a05a32' },
  { tag: tags.contentSeparator, color: '#a05a32', fontWeight: '700' }
]);

export function MarkdownEditor({
  content,
  onChange,
  onSelectionChange,
  onKeyDown,
  onCreateWorldbuildingReference,
  onCreateCatalogueReference,
  worldbuildingTypes = [],
  customCatalogueCategories = [],
  ariaLabel = 'Markdown source',
  compact = false,
  spellcheckEnabled,
  assets = emptyAssets,
  onRotateImage,
  onDeleteImage,
  onOpenDungeonMap,
  maps = emptyMaps,
  onOpenCampaignMap,
  onOpenEncounter,
  ref
}: MarkdownEditorProps & { ref?: Ref<MarkdownEditorHandle> }) {
  const inheritedSpellcheckEnabled = useContext(SpellcheckContext);
  const resolvedSpellcheckEnabled = spellcheckEnabled ?? inheritedSpellcheckEnabled;
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialContentRef = useRef(content);
  const assetsRef = useRef(assets);
  const imageRotationRef = useRef(onRotateImage);
  const imageDeletionRef = useRef(onDeleteImage);
  const dungeonOpenRef = useRef(onOpenDungeonMap);
  const latestRef = useRef({ onChange, onSelectionChange, onKeyDown, onCreateWorldbuildingReference, onCreateCatalogueReference });
  const [referenceMenu, setReferenceMenu] = useState<ReferenceMenu | null>(null);
  const [mobileReferenceSelection, setMobileReferenceSelection] = useState<MobileReferenceSelection | null>(null);
  const [mobileReferenceBottom, setMobileReferenceBottom] = useState(84);

  useEffect(() => {
    latestRef.current = { onChange, onSelectionChange, onKeyDown, onCreateWorldbuildingReference, onCreateCatalogueReference };
  }, [onChange, onCreateCatalogueReference, onCreateWorldbuildingReference, onKeyDown, onSelectionChange]);

  useEffect(() => {
    imageRotationRef.current = onRotateImage;
  }, [onRotateImage]);

  useEffect(() => {
    imageDeletionRef.current = onDeleteImage;
  }, [onDeleteImage]);
  useEffect(() => { dungeonOpenRef.current = onOpenDungeonMap; }, [onOpenDungeonMap]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: encounterOpenHandlerCompartment.reconfigure(onOpenEncounter ? encounterOpenHandler.of(onOpenEncounter) : [])
    });
  }, [onOpenEncounter]);

  useEffect(() => {
    assetsRef.current = assets;
    viewRef.current?.dispatch({
      effects: imageAssetLookupCompartment.reconfigure(imageAssetLookup.of((source) => assetsRef.current.get(source.slice('asset://'.length))))
    });
  }, [assets]);

  useImperativeHandle(ref, () => ({
    getSelection: () => {
      const selection = viewRef.current?.state.selection.main;
      return selection ? { start: selection.from, end: selection.to } : { start: 0, end: 0 };
    },
    focus: (position) => {
      const view = viewRef.current;
      if (!view) return;
      if (typeof position === 'number') view.dispatch({ selection: { anchor: position }, scrollIntoView: true });
      view.focus();
    },
    scrollTo: (position) => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({ effects: EditorView.scrollIntoView(position, { y: 'start', yMargin: 16 }) });
    }
  }), []);

  useEffect(() => {
    if (!parentRef.current) return undefined;
    const view = new EditorView({
      state: EditorState.create({
        doc: initialContentRef.current,
        extensions: [
          markdown(),
          syntaxHighlighting(markdownHighlightStyle),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            'aria-label': ariaLabel,
            spellcheck: resolvedSpellcheckEnabled ? 'true' : 'false',
            autocorrect: resolvedSpellcheckEnabled ? 'on' : 'off',
            writingsuggestions: resolvedSpellcheckEnabled ? 'true' : 'false'
          }),
          referenceDecorations,
          encounterOpenHandlerCompartment.of(onOpenEncounter ? encounterOpenHandler.of(onOpenEncounter) : []),
          imageAssetLookupCompartment.of(imageAssetLookup.of((source) => assetsRef.current.get(source.slice('asset://'.length)))),
          imagePreviews((asset) => imageRotationRef.current?.(asset), (asset) => imageDeletionRef.current?.(asset), (title) => dungeonOpenRef.current?.(title)),
          campaignMapPreviews(maps, onOpenCampaignMap),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) latestRef.current.onChange(update.state.doc.toString());
            if (update.selectionSet) {
              const selection = update.state.selection.main;
              latestRef.current.onSelectionChange?.({ start: selection.from, end: selection.to });
              if (selection.from === selection.to || !window.matchMedia('(pointer: coarse)').matches) {
                setMobileReferenceSelection(null);
              } else {
                const name = normalizeWorldbuildingName(update.state.sliceDoc(selection.from, selection.to));
                setMobileReferenceSelection(name ? { name, from: selection.from, to: selection.to } : null);
              }
            }
          }),
          EditorView.domEventHandlers({
            keydown: (event) => {
              latestRef.current.onKeyDown?.(event);
              return event.defaultPrevented;
            },
            contextmenu: (event, editor) => {
              if (!(event instanceof MouseEvent)) return false;
              if (!latestRef.current.onCreateWorldbuildingReference && !latestRef.current.onCreateCatalogueReference) return false;
              const selection = editor.state.selection.main;
              if (selection.from === selection.to) return false;
              const from = selection.from;
              const to = selection.to;
              const name = normalizeWorldbuildingName(editor.state.sliceDoc(from, to));
              if (!name) return false;
              event.preventDefault();
              setMobileReferenceSelection(null);
              setReferenceMenu({
                name,
                from,
                to,
                x: Math.max(12, Math.min(event.clientX, window.innerWidth - 242)),
                y: Math.max(12, Math.min(event.clientY, window.innerHeight - 430))
              });
              return true;
            },
            mousedown: () => {
              setReferenceMenu(null);
              setMobileReferenceSelection(null);
              return false;
            }
          })
        ]
      }),
      parent: parentRef.current
    });
    viewRef.current = view;
    const selection = view.state.selection.main;
    latestRef.current.onSelectionChange?.({ start: selection.from, end: selection.to });

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [ariaLabel]);

  useEffect(() => {
    const content = viewRef.current?.contentDOM;
    if (!content) return;
    content.spellcheck = resolvedSpellcheckEnabled;
    content.setAttribute('spellcheck', resolvedSpellcheckEnabled ? 'true' : 'false');
    content.setAttribute('autocorrect', resolvedSpellcheckEnabled ? 'on' : 'off');
    content.setAttribute('writingsuggestions', resolvedSpellcheckEnabled ? 'true' : 'false');
  }, [resolvedSpellcheckEnabled]);

  useEffect(() => {
    if (!mobileReferenceSelection) return undefined;

    const updatePosition = () => {
      const viewport = window.visualViewport;
      if (!viewport) {
        setMobileReferenceBottom(84);
        return;
      }

      const keyboardHeight = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setMobileReferenceBottom(keyboardHeight > 80 ? Math.ceil(keyboardHeight + 14) : 84);
    };

    updatePosition();
    window.visualViewport?.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.visualViewport?.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [mobileReferenceSelection]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || content === view.state.doc.toString()) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } });
  }, [content]);

  const insertReference = async (createReference: () => Promise<string | null> | string | null) => {
    const menu = referenceMenu;
    const view = viewRef.current;
    if (!menu || !view) return;

    try {
      const reference = await createReference();
      if (!reference) return;
      view.dispatch({
        changes: { from: menu.from, to: menu.to, insert: reference },
        selection: { anchor: menu.from + reference.length }
      });
      view.focus();
    } finally {
      setReferenceMenu(null);
    }
  };

  return (
    <>
      <div className={`markdown-editor ${compact ? 'reference-source-editor' : ''}`} ref={parentRef} />
      {mobileReferenceSelection && !referenceMenu && (
        <button
          className="mobile-reference-selection-action"
          style={{ bottom: mobileReferenceBottom }}
          onClick={() => {
            setReferenceMenu({ ...mobileReferenceSelection, x: 12, y: 12 });
            setMobileReferenceSelection(null);
          }}
          onMouseDown={(event) => event.preventDefault()}
          type="button"
        >
          Add “{mobileReferenceSelection.name}” as reference
        </button>
      )}
      {referenceMenu && (
        <div className="worldbuilding-context-menu" role="menu" style={{ left: referenceMenu.x, top: referenceMenu.y }}>
          <strong>Link “{referenceMenu.name}” as</strong>
          {onCreateWorldbuildingReference && (
            <>
              <p className="worldbuilding-context-menu-label">Worldbuilding</p>
              {[...worldbuildingKinds.map((kind) => ({ id: kind, name: worldbuildingKindLabels[kind] })), ...worldbuildingTypes].map((kind) => (
                <button
                  key={kind.id}
                  onClick={() => {
                    void insertReference(() => onCreateWorldbuildingReference(referenceMenu.name, kind.id));
                  }}
                  role="menuitem"
                  type="button"
                >
                  {kind.name}
                </button>
              ))}
            </>
          )}
          {onCreateCatalogueReference && (
            <>
              <p className="worldbuilding-context-menu-label">Catalogue</p>
              {[...catalogueCategories, ...customCatalogueCategories.map((category) => category.id)].map((category) => (
                <button
                  key={category}
                  onClick={() => {
                    void insertReference(() => onCreateCatalogueReference(referenceMenu.name, category));
                  }}
                  role="menuitem"
                  type="button"
                >
                  {catalogueCategoryLabel(category, customCatalogueCategories)}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
}
