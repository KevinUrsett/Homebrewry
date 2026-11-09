import type { Brew, CampaignMapRoom, DungeonRecord } from '../types';
import { parseRendererBlocks, type RendererBlock } from '../renderer/blocks';
import { dungeonReferenceLine, formatDungeonReference, legacyMapId } from './dungeonReferences';
import { createDungeon } from './dungeons';
import { encounterReferenceMatches } from './encounterReferences';
import { getOutlineLocations } from './outline';

export type DungeonRoomMove = {
  roomId: string;
  heading: string;
  from: number;
  to: number;
  source: string;
};

type InlineDungeon = Extract<RendererBlock, { type: 'dungeon' }>;

export function prepareInlineDungeonMove(brew: Brew, block: InlineDungeon) {
  const lines = brew.content.split('\n');
  const candidates = [];
  let from = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith(':::') && line.trim() !== ':::') {
      const closing = lines.findIndex((part, position) => position > index && part.trim() === ':::');
      if (closing >= 0) {
        const source = lines.slice(index, closing + 1).join('\n');
        const [parsed] = parseRendererBlocks(source);
        if (parsed?.type === 'dungeon' && JSON.stringify(parsed) === JSON.stringify(block)) candidates.push({ from, source });
      }
    }
    from += line.length + 1;
  }
  if (candidates.length !== 1) throw new Error('Choose a uniquely named inline dungeon before moving it.');
  const candidate = candidates[0];
  const dungeon = createDungeon(block.title);
  const headings = getOutlineLocations(brew.content);
  const roomNames = new Map(block.rooms.map((room) => [room.number, room.title]));
  for (const marker of block.markers) {
    if (!roomNames.has(marker.number)) roomNames.set(marker.number, `Room ${marker.number}`);
  }
  const rooms = new Map<string, CampaignMapRoom>();
  for (const [label, name] of roomNames) {
    const parsedNumber = Number.parseInt(label, 10);
    const number = Number.isSafeInteger(parsedNumber) && parsedNumber > 0 ? parsedNumber : rooms.size + 1;
    const linked = headings.filter((heading) => heading.text === `${label}. ${name}`);
    rooms.set(label, {
      id: crypto.randomUUID(), number, ...(String(number) === label ? {} : { numberLabel: label }),
      name, notes: '', readAloud: '', encounterIds: [], updatedAt: dungeon.updatedAt,
      ...(linked.length === 1 ? { brewSectionId: `${brew.id}:${linked[0].id}` } : {})
    });
  }
  const notes = candidate.source.split('\n').slice(1, -1).filter((line) => {
    const image = line.match(/^\s*(?:!\[[^\]]*\]\(|map:\s*)([^\s)]+)/i);
    const room = line.match(/^\s*(\d+[A-Za-z]?)\s*[|.:-]\s*(.+?)\s*$/);
    return !(image && image[1] === block.mapSource) && !/^::map-marker\s/i.test(line) && !(room && roomNames.get(room[1]) === room[2]);
  }).join('\n').trim();
  const areaRooms = [...rooms.values()];
  if (notes) {
    areaRooms.push({
      id: crypto.randomUUID(), number: Math.max(0, ...areaRooms.map((room) => room.number)) + 1,
      name: 'Map notes', notes, readAloud: '', encounterIds: [], updatedAt: dungeon.updatedAt
    });
  }
  const area = {
    ...dungeon.areas[0], name: block.title, imageSource: block.mapSource, rooms: areaRooms,
    markers: [...new Map(block.markers.map((marker) => [marker.number, marker])).values()]
      .map((marker) => ({ roomId: rooms.get(marker.number)!.id, x: marker.x, y: marker.y }))
  };
  const content = brew.content.slice(0, candidate.from) + formatDungeonReference(dungeon) + brew.content.slice(candidate.from + candidate.source.length);
  return { dungeon: { ...dungeon, areas: [area] }, source: candidate.source, content };
}

export function dungeonRoomMoves(brew: Brew, dungeon: DungeonRecord): DungeonRoomMove[] {
  const headings = getOutlineLocations(brew.content);
  const candidates = dungeon.areas.flatMap((area) => area.rooms.flatMap((room) => {
    if (!room.brewSectionId?.startsWith(`${brew.id}:`)) return [];
    const sectionId = room.brewSectionId.slice(brew.id.length + 1);
    const index = headings.findIndex((heading) => heading.id === sectionId);
    if (index < 0) return [];
    const heading = headings[index];
    const to = headings.slice(index + 1).find((item) => item.level <= heading.level)?.from ?? brew.content.length;
    const source = brew.content.slice(heading.from, to);
    if (source.split('\n').some((line) => legacyMapId(line) || dungeonReferenceLine(line))) return [];
    return [{ roomId: room.id, heading: heading.text, from: heading.from, to, source }];
  }));
  return candidates.filter((move) => !candidates.some((other) => other !== move && other.from < move.to && other.to > move.from));
}

function moveRoomText(room: CampaignMapRoom, move: DungeonRoomMove, timestamp: string): CampaignMapRoom {
  const body = move.source.split('\n').slice(1).join('\n').trim();
  const readAloudBlock = body.match(/^(?:>[^\n]*(?:\n|$))+/)?.[0];
  const encounterIds = new Set(room.encounterIds);
  const notes = (readAloudBlock ? body.slice(readAloudBlock.length) : body).split('\n').filter((line) => {
    const content = line.trim();
    const [match] = encounterReferenceMatches(content);
    if (!match || match.from !== 0 || match.to !== content.length) return true;
    encounterIds.add(match.id);
    return false;
  }).join('\n').trim();
  return {
    ...room,
    readAloud: readAloudBlock?.trimEnd().split('\n').map((line) => line.replace(/^> ?/, '')).join('\n') ?? room.readAloud,
    notes,
    encounterIds: [...encounterIds],
    brewSectionId: undefined,
    updatedAt: timestamp
  };
}

export function moveDungeonRooms(brew: Brew, dungeon: DungeonRecord, reviewed: DungeonRoomMove[], timestamp: string) {
  const candidates = dungeonRoomMoves(brew, dungeon);
  const moves = new Map(reviewed.map((move) => [move.roomId, move]));
  if (!moves.size || reviewed.some((move) => !candidates.some((candidate) => candidate.roomId === move.roomId && candidate.from === move.from && candidate.source === move.source))) {
    throw new Error('The selected room sections changed. Reopen the review and try again.');
  }
  const updated = {
    ...dungeon,
    areas: dungeon.areas.map((area) => ({
      ...area,
      rooms: area.rooms.map((room) => {
        const move = moves.get(room.id);
        return move ? moveRoomText(room, move, timestamp) : room;
      })
    })),
    updatedAt: timestamp,
    version: dungeon.version + 1
  };
  const edits = [...moves.values()].map(({ from, to }) => ({ from, to, replacement: '' })).sort((left, right) => left.from - right.from);
  const reference = formatDungeonReference(dungeon);
  let offset = 0;
  let legacyCard: { from: number; to: number; replacement: string } | undefined;
  let hasDungeonCard = false;
  for (const line of brew.content.split('\n')) {
    if (dungeonReferenceLine(line)?.id === dungeon.id) hasDungeonCard = true;
    if (!legacyCard && legacyMapId(line) === dungeon.id) legacyCard = { from: offset, to: offset + line.length, replacement: reference };
    offset += line.length + 1;
  }
  if (!hasDungeonCard) {
    if (legacyCard) edits.push(legacyCard);
    else edits[0].replacement = reference + '\n\n';
  }
  const content = edits.sort((left, right) => right.from - left.from)
    .reduce((source, edit) => source.slice(0, edit.from) + edit.replacement + source.slice(edit.to), brew.content);
  return { dungeon: updated, content };
}
