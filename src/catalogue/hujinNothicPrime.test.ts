import { describe, expect, it } from 'vitest';
import { normaliseCustomCatalogueEntry } from './customEntries';
import { createHujinNothicPrime, HUJIN_NOTHIC_PRIME_ID } from './hujinNothicPrime';

describe("Hujin'Nothic Prime custom monster", () => {
  it('imports as a valid, editable campaign-owned monster with a stable ID', () => {
    const entry = normaliseCustomCatalogueEntry(createHujinNothicPrime('2026-10-30T20:00:00.000Z'));
    expect(entry).toMatchObject({
      id: HUJIN_NOTHIC_PRIME_ID,
      name: "Hujin'Nothic Prime",
      source: 'Custom',
      category: 'monster',
      data: { ac: '16', cr: '7', abilities: { int: 20 } }
    });
  });

  it('provides the four Orbs of Order without an independent Order orb', () => {
    const entry = createHujinNothicPrime('2026-10-30T20:00:00.000Z');
    const allFeatures = [
      ...(entry.data.traits as { name: string }[]),
      ...(entry.data.bonusActions as { name: string }[]),
      ...(entry.data.reactions as { name: string }[])
    ];
    expect(allFeatures.map(({ name }) => name).join(' ')).toContain('Creation');
    expect(allFeatures.map(({ name }) => name).join(' ')).toContain('Anchorage');
    expect(allFeatures.map(({ name }) => name).join(' ')).toContain('Destruction');
    expect(allFeatures.map(({ name }) => name).join(' ')).toContain('Persistence');
    expect(allFeatures.filter(({ name }) => name === 'Order')).toHaveLength(0);
  });
});