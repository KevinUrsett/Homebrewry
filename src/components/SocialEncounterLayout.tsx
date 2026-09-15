import { useEffect, useMemo, useState } from 'react';
import type { SocialEncounter, WorldbuildingEntry } from '../types';
import { searchSocialNpcs, socialNpcCandidates, type SocialNpcDetails, type SocialNpcSearchResult } from '../lib/socialNpcSearch';

type Props = {
  encounters: SocialEncounter[];
  worldbuildingEntries: WorldbuildingEntry[];
  onCreateNpc: (name: string, details?: SocialNpcDetails) => WorldbuildingEntry;
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
  const selectedEncounter = encounters.find((encounter) => encounter.id === selectedEncounterId) ?? encounters[0] ?? null;

  useEffect(() => {
    if (!selectedEncounter && encounters[0]) setSelectedEncounterId(encounters[0].id);
    if (selectedEncounterId && !encounters.some((encounter) => encounter.id === selectedEncounterId)) setSelectedEncounterId(encounters[0]?.id ?? null);
  }, [encounters, selectedEncounter, selectedEncounterId]);

  const characters = useMemo(() => selectedEncounter?.npcEntryIds
    .map((id) => worldbuildingEntries.find((entry) => entry.id === id))
    .filter((entry): entry is WorldbuildingEntry => Boolean(entry)) ?? [], [selectedEncounter, worldbuildingEntries]);
  const selectedCharacter = characters.find((character) => character.id === selectedCharacterId) ?? null;
  const candidates = useMemo(() => socialNpcCandidates(worldbuildingEntries), [worldbuildingEntries]);
  const matchingCharacters = useMemo(() => searchSocialNpcs(candidates, searchQuery), [candidates, searchQuery]);
  const canCreateNpc = Boolean(searchQuery.trim()) && matchingCharacters.length === 0;

  const closePicker = () => {
    setPickerOpen(false);
    setSearchQuery('');
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
    const name = searchQuery.trim();
    if (canCreateNpc) addCharacter(onCreateNpc(name));
  };
  const addSearchResult = (result: SocialNpcSearchResult) => {
    addCharacter(result.entry);
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
                  <label htmlFor="social-npc-search">Search NPCs</label>
                  <input
                    id="social-npc-search"
                    aria-label="Search NPCs"
                    aria-describedby="social-npc-search-status"
                    autoFocus
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by name or alias…"
                    type="search"
                    value={searchQuery}
                  />
                </div>
                <p className="social-npc-search-status" id="social-npc-search-status" role="status">
                  {matchingCharacters.length
                    ? `${matchingCharacters.length} NPC${matchingCharacters.length === 1 ? '' : 's'} found · Select a result to add`
                    : searchQuery.trim() ? 'No matching NPCs. Create one with this name below.' : 'Search your Worldbuilding entries and campaign references.'}
                </p>
                <div className="social-npc-search-results">
                  {matchingCharacters.map((result) => {
                    const added = result.source === 'worldbuilding' && selectedEncounter.npcEntryIds.includes(result.entry.id);
                    return (
                      <button aria-label={`${added ? 'Already added' : 'Add'} ${result.entry.name}`} className="social-npc-add-result" disabled={added} key={result.key} onClick={() => addSearchResult(result)} type="button">
                        <span><strong>{result.entry.name}</strong><small>Worldbuilding · {kindLabel(result.entry.kind)}{result.entry.aliases.length ? ` · ${result.entry.aliases.join(', ')}` : ''}</small></span>
                        <b aria-hidden="true">{added ? 'Added' : 'Add'}</b>
                      </button>
                    );
                  })}
                  {canCreateNpc && (
                    <button className="social-npc-create-result" onClick={createNpc} type="button">
                      <span><strong>Create “{searchQuery.trim()}”</strong><small>New Worldbuilding NPC</small></span><b aria-hidden="true">+</b>
                    </button>
                  )}
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
