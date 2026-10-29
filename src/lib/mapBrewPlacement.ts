import type { Brew, CampaignMapRecord, Encounter } from '../types';
import { formatEncounterReference } from './encounterReferences';
import { getOutlineLocations, insertAtOutlineSectionEnd } from './outline';

const headingText = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();

/** Place authored room text in the brew; never replace existing room prose. */
export function placeMapInBrew(brew: Brew, map: CampaignMapRecord, sectionId: string | null, encounters: readonly Encounter[], now = new Date().toISOString()) {
  const headings = getOutlineLocations(brew.content);
  const selected = sectionId ? headings.find((heading) => heading.id === sectionId) : null;
  if (sectionId && !selected) throw new Error('That section no longer exists. Choose a section again.');
  const existingMap = [...brew.content.matchAll(/^[ \t]*:::map[ \t]+([0-9a-f-]+)[ \t]*$/gmi)].find((match) => match[1] === map.id);
  const parent = existingMap ? headings.filter((heading) => heading.from < existingMap.index!).at(-1) : selected;
  const mapLevel = Math.min((parent?.level ?? 0) + 1, 5);
  const roomLevel = existingMap ? Math.min((parent?.level ?? 1) + 1, 6) : mapLevel + 1;
  const destination = existingMap ? parent?.id ?? null : sectionId;
  const targetIndex = destination ? headings.findIndex((heading) => heading.id === destination) : -1;
  const target = headings[targetIndex];
  const position = target ? headings.slice(targetIndex + 1).find((heading) => heading.level <= target.level)?.from ?? brew.content.length : brew.content.length;
  const knownHeadingIds = new Set(headings.map((heading) => `${brew.id}:${heading.id}`));
  const rooms = [...map.rooms].sort((left, right) => left.number - right.number).filter((room) => !existingMap || !room.brewSectionId || !knownHeadingIds.has(room.brewSectionId));
  let insertion = existingMap ? '' : `${'#'.repeat(mapLevel)} ${headingText(map.name) || 'Untitled map'}\n\n:::map ${map.id}\n`;
  const roomOffsets = new Map<string, number>();
  for (const room of rooms) {
    if (insertion) insertion += '\n';
    roomOffsets.set(room.id, insertion.length);
    insertion += `${'#'.repeat(roomLevel)} ${room.number}. ${headingText(room.name) || `Room ${room.number}`}\n`;
    if (room.readAloud.trim()) insertion += `\n${room.readAloud.trim().split('\n').map((line) => `> ${line}`).join('\n')}\n`;
    if (room.notes.trim()) insertion += `\n${room.notes.trim()}\n`;
    for (const id of room.encounterIds) {
      const encounter = encounters.find((item) => item.id === id);
      if (encounter) insertion += `\n${formatEncounterReference(encounter)}\n`;
    }
  }
  const content = insertion ? insertAtOutlineSectionEnd(brew.content, destination, insertion) : brew.content;
  const insertedAt = insertion ? content.indexOf(insertion, position) : -1;
  const insertedHeadings = new Map(getOutlineLocations(content).map((heading) => [heading.from, heading.id]));
  const updatedMap: CampaignMapRecord = {
    ...map,
    linkedBrewIds: [...new Set([...map.linkedBrewIds, brew.id])],
    rooms: map.rooms.map((room) => {
      const offset = roomOffsets.get(room.id);
      const id = offset === undefined ? undefined : insertedHeadings.get(insertedAt + offset);
      return id ? { ...room, brewSectionId: `${brew.id}:${id}`, updatedAt: now } : room;
    }),
    updatedAt: now,
    version: map.version + 1
  };
  return { content, map: updatedMap, roomsAdded: rooms.length };
}
