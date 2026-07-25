import type { OutlineItem } from '../types';

const slugify = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || 'section';

export function getOutline(markdown: string): OutlineItem[] {
  const counts = new Map<string, number>();

  return markdown
    .split('\n')
    .map((line) => line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => {
      const level = match[1].length;
      const text = match[2].replace(/[*_`]/g, '').trim();
      const baseId = slugify(text);
      const count = counts.get(baseId) ?? 0;
      counts.set(baseId, count + 1);

      return {
        id: count === 0 ? baseId : `${baseId}-${count + 1}`,
        level,
        text
      };
    });
}

export function getHeadingId(text: string, occurrence: number): string {
  const baseId = slugify(text.replace(/[*_`]/g, '').trim());
  return occurrence === 0 ? baseId : `${baseId}-${occurrence + 1}`;
}
