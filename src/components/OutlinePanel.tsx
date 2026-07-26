import type { OutlineItem } from '../types';

type OutlinePanelProps = {
  outline: OutlineItem[];
  insertionLabel?: string | null;
  onCancelInsertion?: () => void;
  onInsertAtSection?: (item: OutlineItem | null) => void;
};

export function OutlinePanel({ outline, insertionLabel, onCancelInsertion, onInsertAtSection }: OutlinePanelProps) {
  const scrollToHeading = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <aside className="outline-panel side-panel" aria-label="Document outline">
      <div className="panel-heading">
        <span>Outline</span>
        {insertionLabel && <button className="outline-cancel" onClick={onCancelInsertion} type="button">Cancel</button>}
      </div>
      {insertionLabel && <p className="outline-insert-help">Choose where to insert “{insertionLabel}”.</p>}
      {outline.length > 0 ? (
        <nav className="outline-list">
          {outline.map((item) => (
            <button
              className={`outline-item ${insertionLabel ? 'is-insertion-target' : ''}`}
              key={item.id}
              onClick={() => insertionLabel ? onInsertAtSection?.(item) : scrollToHeading(item.id)}
              style={{ paddingInlineStart: `${(item.level - 1) * 12 + 10}px` }}
              type="button"
            >
              <span>{item.text}</span>
              {insertionLabel && <small>Insert here</small>}
            </button>
          ))}
          {insertionLabel && <button className="outline-document-end" onClick={() => onInsertAtSection?.(null)} type="button">Insert at document end</button>}
        </nav>
      ) : (
        <div>
          <p className="empty-panel">Add Markdown headings to build an outline.</p>
          {insertionLabel && <button className="outline-document-end" onClick={() => onInsertAtSection?.(null)} type="button">Insert at document end</button>}
        </div>
      )}
    </aside>
  );
}
