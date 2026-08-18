import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
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
import type { BrewAsset, WorldbuildingKind, WorldbuildingType } from '../types';
import type { ImageOrientation } from '../lib/assetStore';

export type MarkdownEditorHandle = {
  getSelection: () => { start: number; end: number };
  focus: (position?: number) => void;
  scrollTo: (position: number) => void;
};

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
  onChangeImageOrientation?: (asset: BrewAsset, orientation: ImageOrientation) => void;
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

class ReferenceChip extends WidgetType {
  constructor(private readonly label: string, private readonly kind: string) {
    super();
  }

  eq(other: ReferenceChip) {
    return other.label === this.label && other.kind === this.kind;
  }

  toDOM() {
    const element = document.createElement('span');
    element.className = this.kind === 'encounter' ? 'cm-reference-chip cm-encounter-reference-chip' : 'cm-reference-chip cm-inline-reference';
    element.setAttribute('aria-label', `${this.kind} reference: ${this.label}`);
    element.title = `${this.kind} reference`;
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
    widget: new ReferenceChip(match[3]?.trim() || 'Reference', match[1]),
    inclusive: false
  })
});

const referenceDecorations = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = referenceDecorator.createDeco(view);
  }

  update(update: ViewUpdate) {
    this.decorations = referenceDecorator.updateDeco(update, this.decorations);
  }
}, {
  decorations: (value) => value.decorations
});

type AssetLookup = (source: string) => BrewAsset | undefined;

const imageAssetLookup = Facet.define<AssetLookup, AssetLookup>({
  combine: (lookups) => lookups[lookups.length - 1] ?? (() => undefined)
});

const imageAssetLookupCompartment = new Compartment();
const markdownImagePattern = /!\[([^\]]*)\]\(([^\s)]+)(?:\s+["'][^"']*["'])?\)/g;

class MarkdownImagePreview extends WidgetType {
  constructor(private readonly source: string, private readonly alt: string, private readonly asset?: BrewAsset, private readonly onChangeOrientation?: (asset: BrewAsset, orientation: ImageOrientation) => void) {
    super();
  }

  eq(other: MarkdownImagePreview) {
    return other.source === this.source
      && other.alt === this.alt
      && other.asset?.updatedAt === this.asset?.updatedAt
      && other.asset?.blob === this.asset?.blob;
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
    if (this.asset && this.onChangeOrientation) {
      const edit = document.createElement('button');
      edit.className = 'cm-image-edit-button';
      edit.setAttribute('aria-label', `Change orientation for ${image.alt}`);
      edit.textContent = '✎';
      edit.type = 'button';
      const menu = document.createElement('span');
      menu.className = 'cm-image-orientation-menu';
      menu.hidden = true;
      for (const orientation of ['portrait', 'landscape'] as const) {
        const option = document.createElement('button');
        option.type = 'button';
        option.textContent = orientation === 'portrait' ? 'Portrait' : 'Landscape';
        option.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.onChangeOrientation?.(this.asset!, orientation);
          menu.hidden = true;
        });
        menu.append(option);
      }
      edit.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        menu.hidden = !menu.hidden;
      });
      figure.append(edit, menu);
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

function imagePreviewDecorations(view: EditorView, onChangeOrientation?: (asset: BrewAsset, orientation: ImageOrientation) => void): DecorationSet {
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
        widget: new MarkdownImagePreview(source, match[1], asset, onChangeOrientation)
      }).range(end));
    }
    position += line.length + 1;
  }

  return Decoration.set(decorations, true);
}

function imagePreviews(onChangeOrientation?: (asset: BrewAsset, orientation: ImageOrientation) => void) {
  return ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = imagePreviewDecorations(view, onChangeOrientation);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.transactions.some((transaction) => transaction.reconfigured)) {
      this.decorations = imagePreviewDecorations(update.view, onChangeOrientation);
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
  spellcheckEnabled = true,
  assets = emptyAssets,
  onChangeImageOrientation,
  ref
}: MarkdownEditorProps & { ref?: Ref<MarkdownEditorHandle> }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialContentRef = useRef(content);
  const assetsRef = useRef(assets);
  const imageOrientationRef = useRef(onChangeImageOrientation);
  const latestRef = useRef({ onChange, onSelectionChange, onKeyDown, onCreateWorldbuildingReference, onCreateCatalogueReference });
  const [referenceMenu, setReferenceMenu] = useState<ReferenceMenu | null>(null);
  const [mobileReferenceSelection, setMobileReferenceSelection] = useState<MobileReferenceSelection | null>(null);
  const [mobileReferenceBottom, setMobileReferenceBottom] = useState(84);

  useEffect(() => {
    latestRef.current = { onChange, onSelectionChange, onKeyDown, onCreateWorldbuildingReference, onCreateCatalogueReference };
  }, [onChange, onCreateCatalogueReference, onCreateWorldbuildingReference, onKeyDown, onSelectionChange]);

  useEffect(() => {
    imageOrientationRef.current = onChangeImageOrientation;
  }, [onChangeImageOrientation]);

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
          EditorView.contentAttributes.of({ 'aria-label': ariaLabel, spellcheck: spellcheckEnabled ? 'true' : 'false' }),
          referenceDecorations,
          imageAssetLookupCompartment.of(imageAssetLookup.of((source) => assetsRef.current.get(source.slice('asset://'.length)))),
          imagePreviews((asset, orientation) => imageOrientationRef.current?.(asset, orientation)),
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
    viewRef.current?.contentDOM.setAttribute('spellcheck', spellcheckEnabled ? 'true' : 'false');
  }, [spellcheckEnabled]);

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
