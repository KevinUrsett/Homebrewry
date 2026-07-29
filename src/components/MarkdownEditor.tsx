import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
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
import type { WorldbuildingKind, WorldbuildingType } from '../types';

export type MarkdownEditorHandle = {
  getSelection: () => { start: number; end: number };
  focus: (position?: number) => void;
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
};

type ReferenceMenu = {
  name: string;
  from: number;
  to: number;
  x: number;
  y: number;
};

class ReferenceChip extends WidgetType {
  constructor(private readonly label: string, private readonly kind: string) {
    super();
  }

  eq(other: ReferenceChip) {
    return other.label === this.label && other.kind === this.kind;
  }

  toDOM() {
    const element = document.createElement('span');
    element.className = 'cm-reference-chip';
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
  ref
}: MarkdownEditorProps & { ref?: Ref<MarkdownEditorHandle> }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialContentRef = useRef(content);
  const latestRef = useRef({ onChange, onSelectionChange, onKeyDown, onCreateWorldbuildingReference, onCreateCatalogueReference });
  const [referenceMenu, setReferenceMenu] = useState<ReferenceMenu | null>(null);

  useEffect(() => {
    latestRef.current = { onChange, onSelectionChange, onKeyDown, onCreateWorldbuildingReference, onCreateCatalogueReference };
  }, [onChange, onCreateCatalogueReference, onCreateWorldbuildingReference, onKeyDown, onSelectionChange]);

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
    }
  }), []);

  useEffect(() => {
    if (!parentRef.current) return undefined;
    const view = new EditorView({
      state: EditorState.create({
        doc: initialContentRef.current,
        extensions: [
          markdown(),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
          referenceDecorations,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) latestRef.current.onChange(update.state.doc.toString());
            if (update.selectionSet) {
              const selection = update.state.selection.main;
              latestRef.current.onSelectionChange?.({ start: selection.from, end: selection.to });
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
              let from = selection.from;
              let to = selection.to;
              if (from === to) {
                const position = editor.posAtCoords({ x: event.clientX, y: event.clientY });
                const word = position === null ? null : editor.state.wordAt(position);
                if (!word) return false;
                from = word.from;
                to = word.to;
                // A right-clicked word is a selection too. This keeps the
                // reference replacement anchored to the word rather than
                // inserting a token at the old cursor position.
                editor.dispatch({ selection: { anchor: from, head: to } });
              }
              const name = normalizeWorldbuildingName(editor.state.sliceDoc(from, to));
              if (!name) return false;
              event.preventDefault();
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
