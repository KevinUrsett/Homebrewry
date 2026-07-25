import type { CSSProperties, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getHeadingId } from '../lib/outline';
import { parseRendererBlocks, splitRendererPages, type RendererBlock } from '../renderer/blocks';
import type { Brew } from '../types';

type BrewPreviewProps = { brew: Brew };

type MarkdownRendererProps = {
  content: string;
  getId: (children: ReactNode) => string;
};

function MarkdownRenderer({ content, getId }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 id={getId(children)}>{children}</h1>,
        h2: ({ children }) => <h2 id={getId(children)}>{children}</h2>,
        h3: ({ children }) => <h3 id={getId(children)}>{children}</h3>,
        h4: ({ children }) => <h4 id={getId(children)}>{children}</h4>,
        blockquote: ({ children }) => <blockquote>{children}</blockquote>
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function CharacterBlock({ type, content }: { type: 'statblock' | 'item' | 'spell'; content: string }) {
  const [title, ...body] = content.split('\n');
  return (
    <section className={`brew-${type}`}>
      <h3>{title || (type === 'statblock' ? 'Untitled creature' : `Untitled ${type}`)}</h3>
      <div className="brew-rule" />
      {body.length > 0 && <div className="brew-block-content">{body.join('\n')}</div>}
    </section>
  );
}

function renderBlock(block: RendererBlock, getId: (children: ReactNode) => string, key: string) {
  if (block.type === 'markdown') return <MarkdownRenderer content={block.content} getId={getId} key={key} />;
  if (block.type === 'columns') return <section className="brew-columns" key={key}><MarkdownRenderer content={block.content} getId={getId} /></section>;
  if (block.type === 'callout') {
    return (
      <aside className={`brew-callout callout-${block.variant}`} key={key}>
        {block.title && <h4>{block.title}</h4>}
        <MarkdownRenderer content={block.content} getId={getId} />
      </aside>
    );
  }
  if (block.type === 'pagebreak') return null;
  return <CharacterBlock content={block.content} key={key} type={block.type} />;
}

export function BrewPreview({ brew }: BrewPreviewProps) {
  const headingOccurrences = new Map<string, number>();
  const getId = (children: ReactNode) => {
    const text = String(children);
    const occurrence = headingOccurrences.get(text) ?? 0;
    headingOccurrences.set(text, occurrence + 1);
    return getHeadingId(text, occurrence);
  };
  const pages = splitRendererPages(parseRendererBlocks(brew.content));

  return (
    <div
      className={`brew-book tone-${brew.rendererSettings.parchmentTone}`}
      style={{ '--brew-accent': brew.rendererSettings.accentColor } as CSSProperties}
    >
      {pages.map((page, pageIndex) => (
        <article className="brew-preview" key={`page-${pageIndex}`}>
          <div className="brew-page-number" aria-hidden>{pageIndex + 1}</div>
          {page.map((block, blockIndex) => renderBlock(block, getId, `${pageIndex}-${blockIndex}`))}
        </article>
      ))}
    </div>
  );
}
