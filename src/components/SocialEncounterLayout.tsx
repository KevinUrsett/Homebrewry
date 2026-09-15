import { useState } from 'react';
import { isLocalPreviewMode } from '../lib/runtimeMode';

type LayoutCharacter = {
  id: string;
  name: string;
  role: string;
  notes: string;
};

const previewCharacters: LayoutCharacter[] = [
  {
    id: 'social-layout-talon',
    name: 'Talon Bloodwing',
    role: 'NPC',
    notes: 'A guarded military leader who expects careful words and a clear purpose.'
  },
  {
    id: 'social-layout-orren',
    name: 'Orren Vey',
    role: 'NPC',
    notes: 'An obsessive scholar searching for secrets concerning the Soul Boxes.'
  },
  {
    id: 'social-layout-adgjal',
    name: 'Adgjal Tanner',
    role: 'NPC',
    notes: 'A practical officer who prefers direct answers and actionable information.'
  }
];

export function SocialEncounterLayout() {
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const characters = isLocalPreviewMode() ? previewCharacters : [];
  const selectedCharacter = characters.find((character) => character.id === selectedCharacterId) ?? null;

  return (
    <section aria-label="Social encounter layout" className="social-encounter-layout">
      <aside className="social-encounter-library">
        <header><span>Social encounters</span><b>1</b></header>
        <button aria-current="page" className="is-selected" type="button">
          <strong>New social encounter</strong>
          <small>{characters.length} NPC{characters.length === 1 ? '' : 's'}</small>
        </button>
      </aside>

      <div className="social-encounter-stage">
        <header className="social-encounter-heading">
          <div><p className="eyebrow">Social encounter</p><h2>New social encounter</h2></div>
          <button disabled type="button">Add NPC</button>
        </header>
        <p className="social-encounter-guidance">Select an NPC to open their information.</p>

        {selectedCharacter && (
          <article className="social-character-overview">
            <header>
              <span aria-hidden="true">{selectedCharacter.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}</span>
              <div><small>{selectedCharacter.role}</small><h3>{selectedCharacter.name}</h3></div>
              <button aria-label={`Close ${selectedCharacter.name} overview`} onClick={() => setSelectedCharacterId(null)} type="button">×</button>
            </header>
            <div>
              <section><span>Overview</span><p>{selectedCharacter.notes}</p></section>
              <section><span>Worldbuilding information</span><p>Personality, goals, knowledge, status, and notes will appear here.</p></section>
            </div>
            <button disabled type="button">Open Worldbuilding entry</button>
          </article>
        )}

        <div className="social-character-grid">
          {characters.map((character) => {
            const expanded = selectedCharacterId === character.id;
            return (
              <article className={`social-character-card${expanded ? ' is-selected' : ''}`} key={character.id}>
                <button
                  aria-expanded={expanded}
                  className="social-character-card-button"
                  onClick={() => setSelectedCharacterId((current) => current === character.id ? null : character.id)}
                  type="button"
                >
                  <span aria-hidden="true">{character.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}</span>
                  <strong>{character.name}</strong>
                  <small>{character.role}</small>
                  <b aria-hidden="true">{expanded ? '−' : '+'}</b>
                </button>
              </article>
            );
          })}

          {!characters.length && (
            <div className="social-character-empty">
              <div aria-hidden="true" className="social-character-placeholder"><span>+</span><small>NPC</small></div>
              <div><strong>No NPCs added</strong><p>NPC cards will appear here.</p></div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
