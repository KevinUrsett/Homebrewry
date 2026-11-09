const cardPattern = /^ {0,3}\[\[dungeon:([0-9a-f-]+)(?:\|([^\]\r\n]+))?\]\]\s*$/i;
const legacyPattern = /^\s*:::map\s+([0-9a-f-]+)\s*$/i;

export function formatDungeonReference(dungeon: { id: string; name: string }): string {
  const label = dungeon.name.replace(/[\]|\r\n]/g, ' ').trim() || 'Untitled dungeon';
  return `[[dungeon:${dungeon.id}|${label}]]`;
}

export function dungeonReferenceLine(line: string): { id: string; label: string } | null {
  const match = line.match(cardPattern);
  return match ? { id: match[1].toLowerCase(), label: match[2]?.trim() || 'Dungeon' } : null;
}

export function legacyMapId(line: string): string | null {
  return line.match(legacyPattern)?.[1].toLowerCase() ?? null;
}
