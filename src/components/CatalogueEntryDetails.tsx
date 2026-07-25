import type { ReactNode } from 'react';
import {
  cataloguePlainText,
  dataRecord,
  dataRecords,
  dataString,
  entrySummary,
  speedText
} from '../catalogue/presentation';
import { catalogueCategoryLabels, type CatalogueEntry } from '../catalogue/types';

type CatalogueEntryDetailsProps = {
  entry: CatalogueEntry;
  compact?: boolean;
  actions?: ReactNode;
};

function TextBlock({ children }: { children: string }) {
  return <p className="catalogue-description">{cataloguePlainText(children)}</p>;
}

function FeatureList({ entries, title }: { entries: Record<string, unknown>[]; title: string }) {
  if (!entries.length) return null;
  return (
    <section className="catalogue-detail-section">
      <h3>{title}</h3>
      {entries.map((feature, index) => {
        const name = typeof feature.name === 'string' ? feature.name : `Entry ${index + 1}`;
        const usage = typeof feature.usage === 'string' ? feature.usage : '';
        const text = typeof feature.text === 'string' ? feature.text : '';
        return (
          <div className="catalogue-feature" key={`${name}-${index}`}>
            <strong>{name}{usage ? ` (${usage})` : ''}</strong>
            {text && <TextBlock>{text}</TextBlock>}
          </div>
        );
      })}
    </section>
  );
}

function MonsterDetails({ entry }: { entry: CatalogueEntry }) {
  const abilities = dataRecord(entry, 'abilities');
  const identity = [dataString(entry, 'size'), dataString(entry, 'type'), dataString(entry, 'alignment')].filter(Boolean).join(' ');
  const speed = speedText(entry);
  const traits = dataRecords(entry, 'traits');
  const actions = dataRecords(entry, 'actions');
  const bonusActions = dataRecords(entry, 'bonusActions');
  const reactions = dataRecords(entry, 'reactions');
  const legendaryActions = dataRecords(entry, 'legendaryActions');

  return (
    <>
      {identity && <p className="catalogue-monster-identity">{identity}</p>}
      <dl className="catalogue-stats">
        {dataString(entry, 'ac') && <><dt>Armor Class</dt><dd>{dataString(entry, 'ac')}</dd></>}
        {dataString(entry, 'hp') && <><dt>Hit Points</dt><dd>{dataString(entry, 'hp')}</dd></>}
        {speed && <><dt>Speed</dt><dd>{speed}</dd></>}
        {dataString(entry, 'cr') && <><dt>Challenge</dt><dd>{dataString(entry, 'cr')}</dd></>}
      </dl>
      {Object.keys(abilities).length > 0 && (
        <dl className="catalogue-abilities">
          {['str', 'dex', 'con', 'int', 'wis', 'cha'].map((ability) => (
            <div key={ability}>
              <dt>{ability.toUpperCase()}</dt>
              <dd>{typeof abilities[ability] === 'number' ? abilities[ability] : '—'}</dd>
            </div>
          ))}
        </dl>
      )}
      <FeatureList entries={traits} title="Traits" />
      <FeatureList entries={actions} title="Actions" />
      <FeatureList entries={bonusActions} title="Bonus actions" />
      <FeatureList entries={reactions} title="Reactions" />
      <FeatureList entries={legendaryActions} title="Legendary actions" />
    </>
  );
}

function TableDetails({ entry }: { entry: CatalogueEntry }) {
  if (!entry.columns?.length || !entry.rows?.length) return null;
  return (
    <div className="catalogue-table-wrap">
      <table className="catalogue-table">
        <thead><tr>{entry.columns.map((column) => <th key={column.name}>{column.name}</th>)}</tr></thead>
        <tbody>
          {entry.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

function GenericDetails({ entry }: { entry: CatalogueEntry }) {
  const features = dataRecords(entry, 'features');
  const traits = dataRecords(entry, 'traits');
  return (
    <>
      {entry.description && <TextBlock>{entry.description}</TextBlock>}
      <FeatureList entries={traits} title="Traits" />
      <FeatureList entries={features} title="Features" />
      <TableDetails entry={entry} />
    </>
  );
}

export function CatalogueEntryDetails({ entry, compact = false, actions }: CatalogueEntryDetailsProps) {
  const summary = entrySummary(entry);
  if (compact) {
    return (
      <span className="catalogue-tooltip-content">
        <strong>{entry.name}</strong>
        <span>{catalogueCategoryLabels[entry.category]}</span>
        {summary.map((line) => <span key={line}>{line}</span>)}
        {entry.description && <span>{cataloguePlainText(entry.description, 210)}</span>}
      </span>
    );
  }

  return (
    <article className={`catalogue-entry-detail catalogue-entry-${entry.category}`}>
      <header>
        <p className="eyebrow">{catalogueCategoryLabels[entry.category]} · {entry.ruleset} · {entry.source}</p>
        <h2>{entry.name}</h2>
        {entry.category !== 'monster' && summary.map((line) => <p className="catalogue-summary" key={line}>{line}</p>)}
      </header>
      {actions && <div className="catalogue-entry-actions">{actions}</div>}
      {entry.category === 'monster' ? <MonsterDetails entry={entry} /> : <GenericDetails entry={entry} />}
    </article>
  );
}
