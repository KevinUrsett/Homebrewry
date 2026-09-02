import type { ReactNode } from 'react';
import {
  cataloguePlainText,
  dataRecord,
  dataRecords,
  dataString,
  entrySummary,
  speedText
} from '../catalogue/presentation';
import {
  magicWeaponForItem,
  monsterEquipment,
  monsterStatBlockModifiersForItem,
  monsterStatChangeDefinitions,
  resolvedEncounterMonsterStatBlock,
  resolvedMonsterActions,
  resolvedMonsterEquipment,
  resolvedMonsterWeaponActions,
  weaponActionText,
  type MonsterEquipment
} from '../catalogue/magicItems';
import { catalogueCategoryLabel, type CatalogueEntry } from '../catalogue/types';
import { ReferenceContent, type ReferenceContentProps } from './ReferenceContent';

type CatalogueEntryDetailsProps = {
  entry: CatalogueEntry;
  compact?: boolean;
  actions?: ReactNode;
  categoryLabel?: string;
  references?: Omit<ReferenceContentProps, 'content' | 'className'>;
  /** A temporary encounter-only equipment overlay for a monster stat block. */
  equipment?: MonsterEquipment[];
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

function EncounterStatBlockModifiers({ entry }: { entry: CatalogueEntry }) {
  const modifiers = monsterStatBlockModifiersForItem(entry);
  if (!modifiers) return null;
  return (
    <div className="catalogue-magic-item-effect">
      <strong>Encounter stat block changes.</strong>
      {modifiers.changes.length > 0 && (
        <ul>
          {modifiers.changes.map((change, index) => {
            const definition = monsterStatChangeDefinitions.find((item) => item.field === change.field);
            const value = typeof change.value === 'number' && change.operation === 'add' && change.value >= 0 ? `+${change.value}` : change.value;
            return <li key={`${change.field}-${index}`}>{definition?.label ?? change.field}: {change.operation === 'add' ? value : `set to ${value}`}</li>;
          })}
        </ul>
      )}
      {modifiers.traits.length > 0 && <p>{modifiers.traits.length} additional stat block trait{modifiers.traits.length === 1 ? '' : 's'}.</p>}
    </div>
  );
}

function MonsterEquipmentDetails({ entry, equipment, references }: { entry: CatalogueEntry; equipment?: MonsterEquipment[]; references?: Omit<ReferenceContentProps, 'content' | 'className'> }) {
  const equipped = equipment ?? monsterEquipment(entry);
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
            <strong>{item?.name ?? 'Missing magic item'}</strong>
            {weapon?.shortDescription && <TextBlock references={references}>{weapon.shortDescription}</TextBlock>}
            {weapon?.effectText && <div className="catalogue-magic-item-effect"><strong>What it does.</strong><TextBlock references={references}>{weapon.effectText}</TextBlock></div>}
            {item && <EncounterStatBlockModifiers entry={item} />}
            {!item && <p className="catalogue-description">The linked campaign item is unavailable.</p>}
          </div>
        );
      })}
    </section>
  );
}

function MonsterDetails({ entry, equipment, references }: { entry: CatalogueEntry; equipment?: MonsterEquipment[]; references?: Omit<ReferenceContentProps, 'content' | 'className'> }) {
  const catalogue = references?.catalogue ?? new Map<string, CatalogueEntry>();
  const resolvedEquipment = equipment === undefined ? monsterEquipment(entry) : resolvedMonsterEquipment(entry, equipment);
  const statBlock = equipment === undefined ? entry : resolvedEncounterMonsterStatBlock(entry, catalogue, equipment);
  const abilities = dataRecord(statBlock, 'abilities');
  const identity = [dataString(statBlock, 'size'), dataString(statBlock, 'type'), dataString(statBlock, 'alignment')].filter(Boolean).join(' ');
  const speed = speedText(statBlock);
  const traits = dataRecords(statBlock, 'traits');
  const actions = resolvedMonsterActions(entry, catalogue, resolvedEquipment);
  const bonusActions = dataRecords(entry, 'bonusActions');
  const reactions = dataRecords(entry, 'reactions');
  const legendaryActions = dataRecords(entry, 'legendaryActions');
  const weaponActions = resolvedMonsterWeaponActions(entry, catalogue, resolvedEquipment)
    .map((action) => ({ name: action.name, text: weaponActionText(action) }));

  return (
    <>
      {entry.description && <TextBlock references={references}>{entry.description}</TextBlock>}
      {identity && <p className="catalogue-monster-identity">{identity}</p>}
      <dl className="catalogue-stats">
        {dataString(statBlock, 'ac') && <><dt>Armor Class</dt><dd>{dataString(statBlock, 'ac')}</dd></>}
        {dataString(statBlock, 'hp') && <><dt>Hit Points</dt><dd>{dataString(statBlock, 'hp')}</dd></>}
        {speed && <><dt>Speed</dt><dd>{speed}</dd></>}
        {dataString(statBlock, 'initiativeBonus') && <><dt>Initiative bonus</dt><dd>{dataString(statBlock, 'initiativeBonus')}</dd></>}
        {dataString(statBlock, 'cr') && <><dt>Challenge</dt><dd>{dataString(statBlock, 'cr')}</dd></>}
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
      <MonsterEquipmentDetails entry={entry} equipment={resolvedEquipment} references={references} />
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
      <EncounterStatBlockModifiers entry={entry} />
      <FeatureList entries={traits} references={references} title="Traits" />
      <FeatureList entries={features} references={references} title="Features" />
      <TableDetails entry={entry} />
    </>
  );
}

export function CatalogueEntryDetails({ entry, compact = false, actions, categoryLabel, references, equipment }: CatalogueEntryDetailsProps) {
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
      {entry.category === 'monster' ? <MonsterDetails entry={entry} equipment={equipment} references={references} /> : <GenericDetails entry={entry} references={references} />}
    </article>
  );
}
