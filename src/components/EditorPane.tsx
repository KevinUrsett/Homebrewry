import { type KeyboardEvent, type RefObject, useRef } from 'react';

type EditorPaneProps = {
  title: string;
  content: string;
  editorRef: RefObject<HTMLTextAreaElement | null>;
  findVisible: boolean;
  findValue: string;
  replaceValue: string;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onInsert: (before: string, after?: string) => void;
  onImageUpload: (file: File) => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleFind: () => void;
  onFindChange: (value: string) => void;
  onReplaceChange: (value: string) => void;
  onReplaceAll: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
};

export function EditorPane({
  title,
  content,
  editorRef,
  findVisible,
  findValue,
  replaceValue,
  onTitleChange,
  onContentChange,
  onInsert,
  onImageUpload,
  onUndo,
  onRedo,
  onToggleFind,
  onFindChange,
  onReplaceChange,
  onReplaceAll,
  onKeyDown
}: EditorPaneProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="editor-pane" aria-label="Brew editor">
      <div className="editor-toolbar" aria-label="Editor tools">
        <button onClick={() => onInsert('## ')} type="button">H2</button>
        <button onClick={() => onInsert('**', '**')} type="button"><strong>B</strong></button>
        <button onClick={() => onInsert('_', '_')} type="button"><em>I</em></button>
        <button onClick={() => onInsert('[', '](https://)')} type="button">Link</button>
        <button onClick={() => onInsert('\n:::note Note\n', '\n:::\n')} type="button">Note</button>
        <button onClick={() => onInsert('\n```statblock\n', '\n```\n')} type="button">Stat block</button>
        <button onClick={() => onInsert('\n```item\n', '\n```\n')} type="button">Item</button>
        <button onClick={() => onInsert('\n```spell\n', '\n```\n')} type="button">Spell</button>
        <button onClick={() => onInsert('\n:::pagebreak\n')} type="button">Page</button>
        <button onClick={() => imageInputRef.current?.click()} type="button">Image</button>
        <span className="toolbar-spacer" />
        <button onClick={onUndo} type="button">Undo</button>
        <button onClick={onRedo} type="button">Redo</button>
        <button onClick={onToggleFind} type="button">Find</button>
      </div>
      <input
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="visually-hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onImageUpload(file);
          event.target.value = '';
        }}
        ref={imageInputRef}
        type="file"
      />
      {findVisible && (
        <div className="find-replace" role="search">
          <input aria-label="Find text" onChange={(event) => onFindChange(event.target.value)} placeholder="Find" value={findValue} />
          <input aria-label="Replace text" onChange={(event) => onReplaceChange(event.target.value)} placeholder="Replace with" value={replaceValue} />
          <button disabled={!findValue} onClick={onReplaceAll} type="button">Replace all</button>
        </div>
      )}
      <label className="visually-hidden" htmlFor="brew-title">Brew title</label>
      <input
        className="title-input"
        id="brew-title"
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="Untitled Brew"
        value={title}
      />
      <label className="visually-hidden" htmlFor="brew-content">Markdown content</label>
      <textarea
        className="markdown-editor"
        id="brew-content"
        onChange={(event) => onContentChange(event.target.value)}
        onKeyDown={onKeyDown}
        ref={editorRef}
        spellCheck
        value={content}
      />
    </section>
  );
}
