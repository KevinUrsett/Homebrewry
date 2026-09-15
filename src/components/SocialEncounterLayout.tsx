import { useEffect, useMemo, useState } from 'react';
import type { SocialEncounter, WorldbuildingEntry } from '../types';

type Props = {
  encounters: SocialEncounter[];
  worldbuildingEntries: WorldbuildingEntry[];
  onCreateNpc: (name: string) => WorldbuildingEntry;
  onDeleteEncounter: (encounter: SocialEncounter) => void;
  onOpenWorldbuildingEntry: (entry: WorldbuildingEntry) => void;
  onUpdateEncounter: (encounter: SocialEncounter) => void;
};

function createSocialEncounter(): SocialEncounter {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), name: 'New social encounter', npcEntryIds: [], createdAt: now, updatedAt: now, version: 1 };
}

function updateEncounter(encounter: SocialEncounter, changes: Partial<Pick<SocialEncounter, 'name' | 'npcEntryIds'>>): SocialEncounter {
  return { ...encounter, ...changes, updatedAt: new Date().toISOString(), version: encounter.version + 1 };
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase() || '?';
}

function kindLabel(kind: string): string {
  return kind.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

export function SocialEncounterLayout({ encounters, worldbuildingEntries, onCreateNpc, onDeleteEncounter, onOpenWorldbuildingEntry, onUpdateEncounter }: Props) {
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(encounters[0]?.id ?? null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingNpc, setCreatingNpc] = useState(false);
  const [newNpcName, setNewNpcName] = useState('');
  const selectedEncounter = encounters.find((encounter) => encounter.id === selectedEncounterId) ?? encounters[0] ?? null;

  useEffect(() => {
    if (!selectedEncounter && encounters[0]) setSelectedEncounterId(encounters[0].id);
    if (selectedEncounterId && !encounters.some((encounter) => encounter.id === selectedEncounterId)) setSelectedEncounterId(encounters[0]?.id ?? null);
  }, [encounters, selectedEncounter, selectedEncounterId]);

  const characters = useMemo(() => selectedEncounter?.npcEntryIds
    .map((id) => worldbuildingEntries.find((entry) => entry.id === id))
    .filter((entry): entry is WorldbuildingEntry => Boolean(entry)) ?? [], [selectedEncounter, worldbuildingEntries]);
  const selectedCharacter = characters.find((character) => character.id === selectedCharacterId) ?? null;
  const availableCharacters = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    const addedIds = new Set(selectedEncounter?.npcEntryIds ?? []);
    return worldbuildingEntries.filter((entry) => {
      if (addedIds.has(entry.id) || (entry.kind !== 'npc' && entry.kind !== 'character')) return false;
      return !query || [entry.name, ...entry.aliases, entry.notes].some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [searchQuery, selectedEncounter, worldbuildingEntries]);

  const closePicker = () => {
    setPickerOpen(false);
    setCreatingNpc(false);
    setSearchQuery('');
    setNewNpcName('');
  };
  const selectEncounter = (id: string) => {
    setSelectedEncounterId(id);
    setSelectedCharacterId(null);
    closePicker();
  };
  const addCharacter = (character: WorldbuildingEntry) => {
    if (!selectedEncounter || selectedEncounter.npcEntryIds.includes(character.id)) return;
    onUpdateEncounter(updateEncounter(selectedEncounter, { npcEntryIds: [...selectedEncounter.npcEntryIds, character.id] }));
    setSelectedCharacterId(character.id);
    closePicker();
  };
  const createNpc = () => {
    const name = newNpcName.trim();
    if (name) addCharacter(onCreateNpc(name));
  };
  const startEncounter = () => {
    const encounter = createSocialEncounter();
    onUpdateEncounter(encounter);
    setSelectedEncounterId(encounter.id);
    setSelectedCharacterId(null);
    closePicker();
  };

  return (
    <section aria-label="Social encounter layout" className="social-encounter-layout">
      <aside className="social-encounter-library">
        <header><span>Social encounters</span><b>{encounters.length}</b></header>
        <button className="social-encounter-new" onClick={startEncounter} type="button"><span aria-hidden="true">+</span> New encounter</button>
        {encounters.map((encounter) => (
          <button aria-current={selectedEncounter?.id === encounter.id ? 'page' : undefined} className={selectedEncounter?.id === encounter.id ? 'is-selected' : ''} key={encounter.id} onClick={() => selectEncounter(encounter.id)} type="button">
            <strong>{encounter.name || 'Untitled social encounter'}</strong>
            <small>{encounter.npcEntryIds.length} NPC{encounter.npcEntryIds.length === 1 ? '' : 's'}</small>
          </button>
        ))}
      </aside>

      <div className="social-encounter-stage">
        {!selectedEncounter ? (
          <div className="social-encounter-welcome">
            <span aria-hidden="true">+</span><h2>Create a social encounter</h2>
            <p>Add NPCs from Worldbuilding and keep their information ready during the scene.</p>
            <button onClick={startEncounter} type="button">New social encounter</button>
          </div>
        ) : (
          <>
            <header className="social-encounter-heading">
              <div>
                <p className="eyebrow">Social encounter</p>
                <input aria-label="Social encounter name" defaultValue={selectedEncounter.name} key={selectedEncounter.id} onBlur={(event) => { const name = event.currentTarget.value.trim() || 'Untitled social encounter'; if (name !== selectedEncounter.name) onUpdateEncounter(updateEncounter(selectedEncounter, { name })); }} />
              </div>
              <button onClick={() => onDeleteEncounter(selectedEncounter)} type="button">Delete</button>
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
                  {availableCharacters.map((character) => <button key={character.id} onClick={() => addCharacter(character)} type="button"><span><strong>{character.name}</strong><small>{kindLabel(character.kind)}{character.aliases.length ? ` · ${character.aliases.join(', ')}` : ''}</small></span><b aria-hidden="true">+</b></button>)}
                  {!availableCharacters.length && <p>{searchQuery.trim() ? 'No NPCs match that search.' : 'No other Worldbuilding NPCs are available.'}</p>}
                </div>
              </section>
            )}

            {!pickerOpen && selectedCharacter && (
              <article className="social-character-overview">
                <header>
                  <span aria-hidden="true">{initials(selectedCharacter.name)}</span>
                  <div><small>{kindLabel(selectedCharacter.kind)}</small><h3>{selectedCharacter.name}</h3>{selectedCharacter.aliases.length > 0 && <p>Also known as {selectedCharacter.aliases.join(', ')}</p>}</div>
                  <button aria-label={`Close ${selectedCharacter.name} overview`} onClick={() => setSelectedCharacterId(null)} type="button">×</button>
                </header>
                <section><span>Information</span><p className={selectedCharacter.notes.trim() ? '' : 'is-empty'}>{selectedCharacter.notes.trim() || 'No information has been added yet.'}</p></section>
                <footer>
                  <button onClick={() => onOpenWorldbuildingEntry(selectedCharacter)} type="button">Open Worldbuilding entry</button>
                  <button className="is-danger" onClick={() => { onUpdateEncounter(updateEncounter(selectedEncounter, { npcEntryIds: selectedEncounter.npcEntryIds.filter((id) => id !== selectedCharacter.id) })); setSelectedCharacterId(null); }} type="button">Remove from encounter</button>
                </footer>
              </article>
            )}

            <div className="social-character-grid">
              {characters.map((character) => {
                const expanded = selectedCharacterId === character.id;
                return (
                  <article className={`social-character-card${expanded ? ' is-selected' : ''}`} key={character.id}>
                    <button aria-expanded={expanded} className="social-character-card-button" onClick={() => { closePicker(); setSelectedCharacterId((current) => current === character.id ? null : character.id); }} type="button">
                      <span aria-hidden="true">{initials(character.name)}</span><strong>{character.name}</strong><small>{kindLabel(character.kind)}</small><b aria-hidden="true">{expanded ? '−' : '+'}</b>
                    </button>
                  </article>
                );
              })}
              <button aria-label="Add NPC" className="social-character-add-card" onClick={() => { setSelectedCharacterId(null); setPickerOpen(true); }} type="button"><span aria-hidden="true">+</span><strong>Add NPC</strong></button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
