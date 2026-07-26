import { useState, type ReactNode } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cataloguePlainText, entrySummary } from '../catalogue/presentation';
import { catalogueReferenceFromUrl, entryFromReference, remarkCatalogueReferences } from '../catalogue/references';
import { catalogueCategoryLabel, type CatalogueEntry, type CustomCatalogueCategory } from '../catalogue/types';
import { worldbuildingReferenceFromUrl, remarkWorldbuildingReferences } from '../lib/worldbuildingReferences';
import type { WorldbuildingEntry, WorldbuildingType } from '../types';
import { WorldbuildingReferenceDetails } from './WorldbuildingReferenceDetails';

export type ReferenceContentProps = {
  content: string;
  className?: string;
  catalogue?: ReadonlyMap<string, CatalogueEntry>;
  catalogueCategories?: readonly CustomCatalogueCategory[];
  onReferenceOpen?: (entry: CatalogueEntry) => void;
  worldbuilding?: ReadonlyMap<string, WorldbuildingEntry>;
  worldbuildingTypes?: readonly WorldbuildingType[];
  onWorldbuildingOpen?: (entry: WorldbuildingEntry) => void;
};

function referenceUrlTransform(url: string): string {
  return catalogueReferenceFromUrl(url) || worldbuildingReferenceFromUrl(url) ? url : defaultUrlTransform(url);
}

function CatalogueTooltip({ entry, categories }: { entry: CatalogueEntry; categories?: readonly CustomCatalogueCategory[] }) {
  const summary = entrySummary(entry);
  return (
    <span className="catalogue-tooltip-content">
      <strong>{entry.name}</strong>
      <span>{catalogueCategoryLabel(entry.category, categories)}</span>
      {summary.map((line) => <span key={line}>{line}</span>)}
      {entry.description && <span>{cataloguePlainText(entry.description, 210)}</span>}
    </span>
  );
}

function CatalogueReferenceLink({ children, entry, categories, onOpen }: {
  children: ReactNode;
  entry: CatalogueEntry;
  categories?: readonly CustomCatalogueCategory[];
  onOpen?: (entry: CatalogueEntry) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="catalogue-reference-wrap" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      <button aria-haspopup="dialog" className="catalogue-reference-link" onBlur={() => setVisible(false)} onClick={() => onOpen?.(entry)} onFocus={() => setVisible(true)} type="button">
        {children}
      </button>
      {visible && <span className="catalogue-reference-tooltip" role="tooltip"><CatalogueTooltip categories={categories} entry={entry} /></span>}
    </span>
  );
}

function WorldbuildingReferenceLink({ children, entry, types, onOpen }: {
  children: ReactNode;
  entry: WorldbuildingEntry;
  types?: readonly WorldbuildingType[];
  onOpen?: (entry: WorldbuildingEntry) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="worldbuilding-reference-wrap" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      <button aria-haspopup="dialog" className="worldbuilding-reference-link" onBlur={() => setVisible(false)} onClick={() => onOpen?.(entry)} onFocus={() => setVisible(true)} type="button">
        {children}
      </button>
      {visible && <span className="worldbuilding-reference-tooltip" role="tooltip"><WorldbuildingReferenceDetails compact entry={entry} types={types} /></span>}
    </span>
  );
}

/** Safe Markdown content that resolves stable catalogue and Worldbuilding links. */
export function ReferenceContent({ content, className, catalogue, catalogueCategories, onReferenceOpen, worldbuilding, worldbuildingTypes, onWorldbuildingOpen }: ReferenceContentProps) {
  return (
    <div className={className ?? 'reference-content'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCatalogueReferences, remarkWorldbuildingReferences]}
        urlTransform={referenceUrlTransform}
        components={{
          a: ({ href, children }) => {
            const worldReference = worldbuildingReferenceFromUrl(href);
            if (worldReference) {
              const entry = worldbuilding?.get(worldReference.id);
              return entry
                ? <WorldbuildingReferenceLink entry={entry} onOpen={onWorldbuildingOpen} types={worldbuildingTypes}>{children}</WorldbuildingReferenceLink>
                : <span className="missing-reference">{children}</span>;
            }

            const catalogueReference = catalogueReferenceFromUrl(href);
            if (!catalogueReference) return <a href={href}>{children}</a>;
            const entry = catalogue && entryFromReference(catalogue, catalogueReference);
            return entry
              ? <CatalogueReferenceLink categories={catalogueCategories} entry={entry} onOpen={onReferenceOpen}>{children}</CatalogueReferenceLink>
              : <span className="missing-reference">{children}</span>;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
