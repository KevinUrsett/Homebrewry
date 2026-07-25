import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { catalogueReferenceFromUrl, entryFromReference, remarkCatalogueReferences } from '../catalogue/references';
import { getHeadingId } from '../lib/outline';
import { parseRendererBlocks, splitRendererPages, type RendererBlock } from '../renderer/blocks';
import type { CatalogueEntry } from '../catalogue/types';
import type { Brew, BrewAsset } from '../types';
import { CatalogueEntryDetails } from './CatalogueEntryDetails';

type BrewPreviewProps = {
  brew: Brew;
  assets?: ReadonlyMap<string, BrewAsset>;
  catalogue?: ReadonlyMap<string, CatalogueEntry>;
  onReferenceOpen?: (entry: CatalogueEntry) => void;
};

type MarkdownRendererProps = {
  content: string;
  getId: (children: ReactNode) => string;
  assets?: ReadonlyMap<string, BrewAsset>;
  catalogue?: ReadonlyMap<string, CatalogueEntry>;
  onReferenceOpen?: (entry: CatalogueEntry) => void;
};

function LocalAssetImage({ asset, alt }: { asset: BrewAsset; alt: string }) {
  const url = useMemo(() => URL.createObjectURL(asset.blob), [asset.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <figure className="brew-image"><img alt={alt} src={url} /><figcaption>{alt}</figcaption></figure>;
}

function CatalogueReferenceLink({
  children,
  entry,
  onOpen
}: {
  children: ReactNode;
  entry: CatalogueEntry;
  onOpen?: (entry: CatalogueEntry) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="catalogue-reference-wrap" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      <button
        aria-haspopup="dialog"
        className="catalogue-reference-link"
        onBlur={() => setVisible(false)}
        onClick={() => onOpen?.(entry)}
        onFocus={() => setVisible(true)}
        type="button"
      >
        {children}
      </button>
      {visible && <span className="catalogue-reference-tooltip" role="tooltip"><CatalogueEntryDetails compact entry={entry} /></span>}
    </span>
  );
}

function MarkdownRenderer({ content, getId, assets, catalogue, onReferenceOpen }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkCatalogueReferences]}
      components={{
        h1: ({ children }) => <h1 id={getId(children)}>{children}</h1>,
        h2: ({ children }) => <h2 id={getId(children)}>{children}</h2>,
        h3: ({ children }) => <h3 id={getId(children)}>{children}</h3>,
        h4: ({ children }) => <h4 id={getId(children)}>{children}</h4>,
        blockquote: ({ children }) => <blockquote>{children}</blockquote>,
        img: ({ src, alt }) => {
          if (src?.startsWith('asset://')) {
            const asset = assets?.get(src.slice('asset://'.length));
            return asset ? <LocalAssetImage alt={alt ?? asset.alt} asset={asset} /> : <span className="missing-asset">Image unavailable on this device</span>;
          }
          if (!src?.match(/^https?:\/\//i)) return null;
          return <figure className="brew-image"><img alt={alt ?? ''} loading="lazy" src={src} /><figcaption>{alt}</figcaption></figure>;
        },
        a: ({ href, children }) => {
          const reference = catalogueReferenceFromUrl(href);
          if (!reference) return <a href={href}>{children}</a>;
          const entry = catalogue && entryFromReference(catalogue, reference);
          return entry
            ? <CatalogueReferenceLink entry={entry} onOpen={onReferenceOpen}>{children}</CatalogueReferenceLink>
            : <span className="missing-reference">{children}</span>;
        }
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

function renderBlock(
  block: RendererBlock,
  getId: (children: ReactNode) => string,
  assets: ReadonlyMap<string, BrewAsset> | undefined,
  catalogue: ReadonlyMap<string, CatalogueEntry> | undefined,
  onReferenceOpen: ((entry: CatalogueEntry) => void) | undefined,
  key: string
) {
  if (block.type === 'markdown') return <MarkdownRenderer assets={assets} catalogue={catalogue} content={block.content} getId={getId} key={key} onReferenceOpen={onReferenceOpen} />;
  if (block.type === 'columns') return <section className="brew-columns" key={key}><MarkdownRenderer assets={assets} catalogue={catalogue} content={block.content} getId={getId} onReferenceOpen={onReferenceOpen} /></section>;
  if (block.type === 'callout') {
    return (
      <aside className={`brew-callout callout-${block.variant}`} key={key}>
        {block.title && <h4>{block.title}</h4>}
        <MarkdownRenderer assets={assets} catalogue={catalogue} content={block.content} getId={getId} onReferenceOpen={onReferenceOpen} />
      </aside>
    );
  }
  if (block.type === 'pagebreak') return null;
  return <CharacterBlock content={block.content} key={key} type={block.type} />;
}

export function BrewPreview({ brew, assets, catalogue, onReferenceOpen }: BrewPreviewProps) {
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
          {page.map((block, blockIndex) => renderBlock(block, getId, assets, catalogue, onReferenceOpen, `${pageIndex}-${blockIndex}`))}
        </article>
      ))}
    </div>
  );
}
