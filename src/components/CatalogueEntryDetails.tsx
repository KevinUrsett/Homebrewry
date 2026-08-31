import type { ReactNode } from 'react';
import {
  cataloguePlainText,
  dataRecord,
  dataRecords,
  dataString,
  entrySummary,
  speedText
} from '../catalogue/presentation';
import { magicWeaponForItem, monsterEquipment, resolvedMonsterActions, resolvedMonsterWeaponActions, weaponActionText } from '../catalogue/magicItems';
import { catalogueCategoryLabel, type CatalogueEntry } from '../catalogue/types';
import { ReferenceContent, type ReferenceContentProps } from './ReferenceContent';

type CatalogueEntryDetailsProps = {
  entry: CatalogueEntry;
  compact?: boolean;
  actions?: ReactNode;
  categoryLabel?: string;
  references?: Omit<ReferenceContentProps, 'content' | 'className'>;
};

function TextBlock({ children, references }: { children: string; references?: Omit<ReferenceContentProps, 'content' | 'className'> }) {
  if (!references) return <p className="catalogue-description">{cataloguePlainText(children)}</p>;
  return <div className="catalogue-description"><ReferenceContent {...references} content={children} /></div>;
}

function FeatureList({ entries, title, references }: { entries: Record<string, unknown>[]; title: string; references?: Omit<ReferenceContentProps, 'content' | 'className'> }) {
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
            {text && <TextBlock references={references}>{text}</TextBlock>}
          </div>
        );
      })}
    </section>
  );
}

function MagicWeaponDetails({ entry, references }: { entry: CatalogueEntry; references?: Omit<ReferenceContentProps, 'content' | 'className'> }) {
  const weapon = magicWeaponForItem(entry);
  if (!weapon) return null;
  return (
    <section className="catalogue-detail-section catalogue-magic-item-details">
      <h3>Magic weapon</h3>
      {weapon.shortDescription && <TextBlock references={references}>{weapon.shortDescription}</TextBlock>}
      {weapon.effectText && <div className="catalogue-magic-item-effect"><strong>What it does.</strong><TextBlock references={references}>{weapon.effectText}</TextBlock></div>}
      <dl className="catalogue-magic-item-modifiers">
        <dt>Attack bonus</dt><dd>{weapon.attackBonus >= 0 ? `+${weapon.attackBonus}` : weapon.attackBonus}</dd>
        <dt>Damage bonus</dt><dd>{weapon.damageBonus >= 0 ? `+${weapon.damageBonus}` : weapon.damageBonus}</dd>
        {weapon.extraDamageDice && <><dt>Extra damage</dt><dd>{weapon.extraDamageDice}{weapon.extraDamageType ? ` ${weapon.extraDamageType}` : ''}</dd></>}
      </dl>
    </section>
  );
}

function MonsterEquipmentDetails({ entry, references }: { entry: CatalogueEntry; references?: Omit<ReferenceContentProps, 'content' | 'className'> }) {
  const equipped = monsterEquipment(entry);
  if (!equipped.length) return null;
  const catalogue = references?.catalogue ?? new Map<string, CatalogueEntry>();
  return (
    <section className="catalogue-detail-section catalogue-monster-equipment">
      <h3>Equipment</h3>
      {equipped.map(({ itemId }) => {
        const item = catalogue.get(`item:${itemId}`);
        const weapon = magicWeaponForItem(item);
        return (
          <div className="catalogue-feature" key={itemId}>
            <strong>{item?.name ?? 'Missing magic weapon'}</strong>
            {weapon?.shortDescription && <TextBlock references={references}>{weapon.shortDescription}</TextBlock>}
            {weapon?.effectText && <div className="catalogue-magic-item-effect"><strong>What it does.</strong><TextBlock references={references}>{weapon.effectText}</TextBlock></div>}
            {!item && <p className="catalogue-description">The linked campaign item is unavailable.</p>}
          </div>
        );
      })}
    </section>
  );
}

function MonsterDetails({ entry, references }: { entry: CatalogueEntry; references?: Omit<ReferenceContentProps, 'content' | 'className'> }) {
  const abilities = dataRecord(entry, 'abilities');
  const identity = [dataString(entry, 'size'), dataString(entry, 'type'), dataString(entry, 'alignment')].filter(Boolean).join(' ');
  const speed = speedText(entry);
  const traits = dataRecords(entry, 'traits');
  const catalogue = references?.catalogue ?? new Map<string, CatalogueEntry>();
  const actions = resolvedMonsterActions(entry, catalogue);
  const bonusActions = dataRecords(entry, 'bonusActions');
  const reactions = dataRecords(entry, 'reactions');
  const legendaryActions = dataRecords(entry, 'legendaryActions');
  const weaponActions = resolvedMonsterWeaponActions(entry, catalogue)
    .map((action) => ({ name: action.name, text: weaponActionText(action) }));

  return (
    <>
      {entry.description && <TextBlock references={references}>{entry.description}</TextBlock>}
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
      <MonsterEquipmentDetails entry={entry} references={references} />
      <FeatureList entries={traits} references={references} title="Traits" />
      <FeatureList entries={[...actions, ...weaponActions]} references={references} title="Actions" />
      <FeatureList entries={bonusActions} references={references} title="Bonus actions" />
      <FeatureList entries={reactions} references={references} title="Reactions" />
      <FeatureList entries={legendaryActions} references={references} title="Legendary actions" />
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

function GenericDetails({ entry, references }: { entry: CatalogueEntry; references?: Omit<ReferenceContentProps, 'content' | 'className'> }) {
  const features = dataRecords(entry, 'features');
  const traits = dataRecords(entry, 'traits');
  return (
    <>
      {entry.description && <TextBlock references={references}>{entry.description}</TextBlock>}
      <MagicWeaponDetails entry={entry} references={references} />
      <FeatureList entries={traits} references={references} title="Traits" />
      <FeatureList entries={features} references={references} title="Features" />
      <TableDetails entry={entry} />
    </>
  );
}

export function CatalogueEntryDetails({ entry, compact = false, actions, categoryLabel, references }: CatalogueEntryDetailsProps) {
  const summary = entrySummary(entry);
  const label = categoryLabel ?? catalogueCategoryLabel(entry.category);
  if (compact) {
    return (
      <span className="catalogue-tooltip-content">
        <strong>{entry.name}</strong>
        <span>{label}</span>
        {summary.map((line) => <span key={line}>{line}</span>)}
        {entry.description && <span>{cataloguePlainText(entry.description, 210)}</span>}
      </span>
    );
  }

  return (
    <article className={`catalogue-entry-detail catalogue-entry-${entry.category}`}>
      <header>
        <p className="eyebrow">{label} · {entry.ruleset} · {entry.source}</p>
        <h2>{entry.name}</h2>
        {entry.category !== 'monster' && summary.map((line) => <p className="catalogue-summary" key={line}>{line}</p>)}
      </header>
      {actions && <div className="catalogue-entry-actions">{actions}</div>}
      {entry.category === 'monster' ? <MonsterDetails entry={entry} references={references} /> : <GenericDetails entry={entry} references={references} />}
    </article>
  );
}
