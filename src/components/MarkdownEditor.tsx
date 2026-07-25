import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import {
  Decoration,
  EditorView,
  MatchDecorator,
  type DecorationSet,
  ViewPlugin,
  type ViewUpdate
} from '@codemirror/view';

export type MarkdownEditorHandle = {
  getSelection: () => { start: number; end: number };
  focus: (position?: number) => void;
};

type MarkdownEditorProps = {
  content: string;
  onChange: (content: string) => void;
  onSelectionChange: (selection: { start: number; end: number }) => void;
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

export function MarkdownEditor({
  content,
  onChange,
  onSelectionChange,
  onKeyDown,
  ref
}: MarkdownEditorProps & { ref: Ref<MarkdownEditorHandle> }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialContentRef = useRef(content);
  const latestRef = useRef({ onChange, onSelectionChange, onKeyDown });

  useEffect(() => {
    latestRef.current = { onChange, onSelectionChange, onKeyDown };
  }, [onChange, onKeyDown, onSelectionChange]);

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
          })
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
