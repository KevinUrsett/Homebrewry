import type { OutlineItem } from '../types';

type OutlinePanelProps = {
  outline: OutlineItem[];
};

export function OutlinePanel({ outline }: OutlinePanelProps) {
  const scrollToHeading = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <aside className="outline-panel side-panel" aria-label="Document outline">
      <div className="panel-heading">
        <span>Outline</span>
      </div>
      {outline.length > 0 ? (
        <nav className="outline-list">
          {outline.map((item) => (
            <button
              className="outline-item"
              key={item.id}
              onClick={() => scrollToHeading(item.id)}
              style={{ paddingInlineStart: `${(item.level - 1) * 12 + 10}px` }}
              type="button"
            >
              {item.text}
            </button>
          ))}
        </nav>
      ) : (
        <p className="empty-panel">Add Markdown headings to build an outline.</p>
      )}
    </aside>
  );
}
