import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import {
  Decoration,
  EditorView,
  MatchDecorator,
  type DecorationSet,
  hoverTooltip,
  ViewPlugin,
  type Tooltip,
  type ViewUpdate
} from '@codemirror/view';
import {
  catalogueReferenceAt,
  entryFromReference
} from '../catalogue/references';
import { catalogueCategoryLabels, type CatalogueEntry } from '../catalogue/types';
import { cataloguePlainText, entrySummary } from '../catalogue/presentation';

export type MarkdownEditorHandle = {
  getSelection: () => { start: number; end: number };
  focus: (position?: number) => void;
};

type MarkdownEditorProps = {
  content: string;
  catalogue: ReadonlyMap<string, CatalogueEntry>;
  onChange: (content: string) => void;
  onSelectionChange: (selection: { start: number; end: number }) => void;
  onReferenceOpen: (entry: CatalogueEntry) => void;
  onKeyDown: (event: KeyboardEvent) => void;
};

const referenceDecorator = new MatchDecorator({
  regexp: /\[\[[a-z]+:[0-9a-f-]+(?:\|[^\]\r\n]+)?\]\]/gi,
  decoration: Decoration.mark({ class: 'cm-catalogue-reference' })
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

function tooltipDom(entry: CatalogueEntry, onOpen: (entry: CatalogueEntry) => void): HTMLElement {
  const dom = document.createElement('div');
  dom.className = 'cm-catalogue-tooltip';

  const title = document.createElement('strong');
  title.textContent = entry.name;
  dom.append(title);

  const category = document.createElement('span');
  category.textContent = catalogueCategoryLabels[entry.category];
  dom.append(category);

  for (const summary of entrySummary(entry)) {
    const line = document.createElement('span');
    line.textContent = summary;
    dom.append(line);
  }

  if (entry.description) {
    const description = document.createElement('p');
    description.textContent = cataloguePlainText(entry.description, 230);
    dom.append(description);
  }

  const open = document.createElement('button');
  open.type = 'button';
  open.textContent = 'Open reference';
  open.addEventListener('click', () => onOpen(entry));
  dom.append(open);
  return dom;
}

export function MarkdownEditor({
  content,
  catalogue,
  onChange,
  onSelectionChange,
  onReferenceOpen,
  onKeyDown,
  ref
}: MarkdownEditorProps & { ref: Ref<MarkdownEditorHandle> }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialContentRef = useRef(content);
  const latestRef = useRef({ catalogue, onChange, onReferenceOpen, onSelectionChange, onKeyDown });

  useEffect(() => {
    latestRef.current = { catalogue, onChange, onReferenceOpen, onSelectionChange, onKeyDown };
  }, [catalogue, onChange, onKeyDown, onReferenceOpen, onSelectionChange]);

  useImperativeHandle(ref, () => ({
    getSelection: () => {
      const selection = viewRef.current?.state.selection.main;
      return selection ? { start: selection.from, end: selection.to } : { start: 0, end: 0 };
    },
    focus: (position) => {
      const view = viewRef.current;
      if (!view) return;
      if (typeof position === 'number') view.dispatch({ selection: { anchor: position } });
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
          EditorView.contentAttributes.of({ 'aria-label': 'Brew Markdown source' }),
          referenceDecorations,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) latestRef.current.onChange(update.state.doc.toString());
            if (update.selectionSet) {
              const selection = update.state.selection.main;
              latestRef.current.onSelectionChange({ start: selection.from, end: selection.to });
            }
          }),
          EditorView.domEventHandlers({
            keydown: (event) => {
              latestRef.current.onKeyDown(event);
              return event.defaultPrevented;
            }
          }),
          hoverTooltip((editor, position): Tooltip | null => {
            const reference = catalogueReferenceAt(editor.state.doc.toString(), position);
            if (!reference) return null;
            const entry = entryFromReference(latestRef.current.catalogue, reference);
            if (!entry) return null;
            return {
              pos: reference.from,
              end: reference.to,
              above: true,
              arrow: true,
              create: () => ({ dom: tooltipDom(entry, latestRef.current.onReferenceOpen) })
            };
          }, { hoverTime: 180, hideOnChange: true })
        ]
      }),
      parent: parentRef.current
    });
    viewRef.current = view;
    const selection = view.state.selection.main;
    latestRef.current.onSelectionChange({ start: selection.from, end: selection.to });

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || content === view.state.doc.toString()) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } });
  }, [content]);

  return <div className="markdown-editor" ref={parentRef} />;
}
