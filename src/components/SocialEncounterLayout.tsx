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
  },
  {
    id: 'social-layout-hujin',
    name: 'Hujin Juunat',
    role: 'NPC',
    notes: 'An old scholar whose work still shapes the secrets beneath Sund.'
  },
  {
    id: 'social-layout-canein',
    name: 'Canein Ilvur',
    role: 'NPC',
    notes: 'A wizard associated with forbidden research and unfinished plans.'
  }
];

export function SocialEncounterLayout() {
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [characters, setCharacters] = useState<LayoutCharacter[]>(() => isLocalPreviewMode() ? previewCharacters.slice(0, 3) : []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingNpc, setCreatingNpc] = useState(false);
  const [newNpcName, setNewNpcName] = useState('');
  const selectedCharacter = characters.find((character) => character.id === selectedCharacterId) ?? null;
  const availableCharacters = (isLocalPreviewMode() ? previewCharacters : []).filter((character) => (
    !characters.some((added) => added.id === character.id)
    && character.name.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase())
  ));

  const closePicker = () => {
    setPickerOpen(false);
    setCreatingNpc(false);
    setSearchQuery('');
    setNewNpcName('');
  };

  const createNpc = () => {
    const name = newNpcName.trim();
    if (!name) return;
    setCharacters((current) => [...current, { id: `social-draft-${Date.now()}`, name, role: 'NPC', notes: 'No information added yet.' }]);
    closePicker();
  };

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
        </header>
        <p className="social-encounter-guidance">Select an NPC to open their information.</p>

        {pickerOpen && (
          <section aria-label="Add NPC" className="social-npc-picker">
            <header><div><p className="eyebrow">Characters</p><h3>Add an NPC</h3></div><button aria-label="Close NPC picker" onClick={closePicker} type="button">×</button></header>
            <div className="social-npc-picker-actions">
              <input aria-label="Search NPCs" autoFocus onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search Worldbuilding NPCs" type="search" value={searchQuery} />
              <button onClick={() => setCreatingNpc((current) => !current)} type="button">Create new NPC</button>
            </div>
            {creatingNpc && (
              <div className="social-npc-create-row">
                <input aria-label="New NPC name" onChange={(event) => setNewNpcName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') createNpc(); }} placeholder="NPC name" value={newNpcName} />
                <button disabled={!newNpcName.trim()} onClick={createNpc} type="button">Create and add</button>
              </div>
            )}
            <div className="social-npc-search-results">
              {availableCharacters.map((character) => <button key={character.id} onClick={() => { setCharacters((current) => [...current, character]); closePicker(); }} type="button"><span><strong>{character.name}</strong><small>{character.role}</small></span><b aria-hidden="true">+</b></button>)}
              {!availableCharacters.length && <p>{searchQuery.trim() ? 'No NPCs match that search.' : 'No other Worldbuilding NPCs are available.'}</p>}
            </div>
          </section>
        )}

        {!pickerOpen && selectedCharacter && (
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

          <button
            aria-label="Add NPC"
            className="social-character-add-card"
            onClick={() => { setSelectedCharacterId(null); setPickerOpen(true); }}
            type="button"
          >
            <span aria-hidden="true">+</span>
            <strong>Add NPC</strong>
          </button>

        </div>
      </div>
    </section>
  );
}
