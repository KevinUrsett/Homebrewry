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
});
