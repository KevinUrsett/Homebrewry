import { describe, expect, it } from 'vitest';
import { importHomebrewerySource, titleFromImportedSource } from './importer';

describe('Homebrewery import', () => {
  it('converts page commands while preserving normal Markdown', () => {
    const imported = importHomebrewerySource('# Ashen Road\n\n\\page\n\n## Next');
    expect(imported.content).toContain(':::pagebreak');
    expect(imported.notices).toContain('Converted \\page commands to page breaks.');
    expect(titleFromImportedSource(imported.content)).toBe('Ashen Road');
  });

  it('removes scripts rather than running or retaining them', () => {
    const imported = importHomebrewerySource('# Safe\n<script>alert(1)</script>');
    expect(imported.content).not.toContain('alert');
    expect(imported.notices).toContain('Removed script tags for safety.');
  });

  it('converts complete Homebrewery descriptive and note wrappers into safe callouts', () => {
    const imported = importHomebrewerySource('# Arrival\n\n{{descriptive\nThe old road is warm beneath your feet.\n}}\n\n{{note\n##### GM note\nKeep the guide secret.\n}}');

    expect(imported.content).toContain(':::descriptive\nThe old road is warm beneath your feet.\n:::');
    expect(imported.content).toContain(':::note\n##### GM note\nKeep the guide secret.\n:::');
    expect(imported.content).not.toContain('{{descriptive');
    expect(imported.notices).toContain('Converted 1 descriptive block to read-aloud callouts.');
    expect(imported.notices).toContain('Converted 1 note block to note callouts.');
  });

  it('retains an incomplete wrapper rather than guessing at user content', () => {
    const imported = importHomebrewerySource('# Arrival\n\n{{descriptive\nThe source is unfinished.');

    expect(imported.content).toContain('{{descriptive');
    expect(imported.notices).toContain('An incomplete descriptive block was retained as source for review.');
  });
});
