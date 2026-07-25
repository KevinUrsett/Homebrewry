import type { CSSProperties, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getHeadingId } from '../lib/outline';
import type { Brew } from '../types';

type BrewPreviewProps = {
  brew: Brew;
};

export function BrewPreview({ brew }: BrewPreviewProps) {
  const headingOccurrences = new Map<string, number>();

  const getId = (children: ReactNode) => {
    const text = String(children);
    const occurrence = headingOccurrences.get(text) ?? 0;
    headingOccurrences.set(text, occurrence + 1);
    return getHeadingId(text, occurrence);
  };

  return (
    <article
      className={`brew-preview tone-${brew.rendererSettings.parchmentTone}`}
      style={{ '--brew-accent': brew.rendererSettings.accentColor } as CSSProperties}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 id={getId(children)}>{children}</h1>,
          h2: ({ children }) => <h2 id={getId(children)}>{children}</h2>,
          h3: ({ children }) => <h3 id={getId(children)}>{children}</h3>,
          h4: ({ children }) => <h4 id={getId(children)}>{children}</h4>,
          blockquote: ({ children }) => <blockquote>{children}</blockquote>,
          code: ({ className, children, ...props }) => {
            if (className?.includes('language-statblock')) {
              return <pre className="statblock">{String(children).trim()}</pre>;
            }
            return <code className={className} {...props}>{children}</code>;
          }
        }}
      >
        {brew.content}
      </ReactMarkdown>
    </article>
  );
}
