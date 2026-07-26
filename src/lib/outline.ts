import type { OutlineItem } from '../types';

const slugify = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || 'section';

type OutlineLocation = OutlineItem & {
  from: number;
};

function getOutlineLocations(markdown: string): OutlineLocation[] {
  const counts = new Map<string, number>();
  let from = 0;

  return markdown.split('\n').flatMap((line) => {
    const match = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
    const lineStart = from;
    from += line.length + 1;
    if (!match) return [];

      const level = match[1].length;
      const text = match[2].replace(/[*_`]/g, '').trim();
      const baseId = slugify(text);
      const count = counts.get(baseId) ?? 0;
      counts.set(baseId, count + 1);

      return {
        id: count === 0 ? baseId : `${baseId}-${count + 1}`,
        level,
        text,
        from: lineStart
      };
    });
}

export function getOutline(markdown: string): OutlineItem[] {
  return getOutlineLocations(markdown).map((item) => ({
    id: item.id,
    level: item.level,
    text: item.text
  }));
}

export function getHeadingId(text: string, occurrence: number): string {
  const baseId = slugify(text.replace(/[*_`]/g, '').trim());
  return occurrence === 0 ? baseId : `${baseId}-${occurrence + 1}`;
}

export function insertAtOutlineSectionEnd(markdown: string, outlineId: string | null, insertion: string): string {
  const headings = getOutlineLocations(markdown);
  const targetIndex = outlineId ? headings.findIndex((heading) => heading.id === outlineId) : -1;
  const target = targetIndex >= 0 ? headings[targetIndex] : null;
  const nextHeading = target
    ? headings.slice(targetIndex + 1).find((heading) => heading.level <= target.level)
    : null;
  const position = nextHeading?.from ?? markdown.length;
  const before = markdown.slice(0, position);
  const after = markdown.slice(position);
  const prefix = before.length === 0 || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const suffix = !after || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  return `${before}${prefix}${insertion}${suffix}${after}`;
}
