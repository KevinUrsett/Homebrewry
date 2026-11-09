import type { CampaignDataSnapshot, DungeonArea, DungeonPosition, DungeonRecord, DungeonRoomStatus } from '../types';

export function campaignDungeons(data: Pick<CampaignDataSnapshot, 'dungeons' | 'maps'>): DungeonRecord[] {
  return data.dungeons ?? (data.maps ?? []).map((map) => ({
    id: map.id,
    name: map.name,
    areas: [{ id: map.id, name: map.name, imageSource: map.imageSource, rooms: map.rooms, markers: map.markers }],
    createdAt: map.createdAt,
    updatedAt: map.updatedAt,
    version: map.version
  }));
}

export function createDungeonArea(name: string): DungeonArea {
  return { id: crypto.randomUUID(), name, rooms: [], markers: [] };
}

export function createDungeon(name = 'New dungeon'): DungeonRecord {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), name, areas: [createDungeonArea('Area 1')], createdAt: now, updatedAt: now, version: 1 };
}

export function updateDungeonArea(dungeon: DungeonRecord, areaId: string, update: (area: DungeonArea) => DungeonArea): DungeonRecord {
  return { ...dungeon, areas: dungeon.areas.map((area) => area.id === areaId ? update(area) : area) };
}

export function updateDungeonProgress(dungeon: DungeonRecord, position: DungeonPosition, status?: DungeonRoomStatus | 'unvisited'): DungeonRecord {
  const area = dungeon.areas.find((item) => item.id === position.areaId);
  if (!area || (position.roomId !== null && !area.rooms.some((room) => room.id === position.roomId))) return dungeon;
  const previous = dungeon.progress;
  const roomStatuses = { ...previous?.roomStatuses };
  if (position.roomId && status) {
    if (status === 'unvisited') delete roomStatuses[position.roomId];
    else roomStatuses[position.roomId] = status;
  }
  if (previous?.areaId === position.areaId && previous.roomId === position.roomId
    && (!position.roomId || previous.roomStatuses[position.roomId] === roomStatuses[position.roomId])) return dungeon;
  return { ...dungeon, progress: { ...position, roomStatuses } };
}

/** Drop saved positions and statuses for rooms removed during preparation. */
export function cleanDungeonProgress(dungeon: DungeonRecord): DungeonRecord {
  if (!dungeon.progress) return dungeon;
  const area = dungeon.areas.find((item) => item.id === dungeon.progress?.areaId) ?? dungeon.areas[0];
  const roomId = area?.rooms.find((room) => room.id === dungeon.progress?.roomId)?.id ?? null;
  const roomIds = new Set(dungeon.areas.flatMap((item) => item.rooms.map((room) => room.id)));
  const roomStatuses = Object.fromEntries(Object.entries(dungeon.progress.roomStatuses).filter(([id]) => roomIds.has(id)));
  return { ...dungeon, progress: area ? { areaId: area.id, roomId, roomStatuses } : undefined };
}
