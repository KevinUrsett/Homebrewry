import { describe, expect, it } from 'vitest';
import { compareBelentorDates, formatBelentorDate, isBelentorDate } from './belentorCalendar';

describe('Belentor calendar', () => {
  it('formats valid shared-calendar dates', () => {
    expect(formatBelentorDate({ era: 'AA', year: 613, month: 'Din', day: 13 })).toBe('13 Din 613 AA');
  });

  it('allows only the twelve 30-day months', () => {
    expect(isBelentorDate({ era: 'AA', year: 641, month: 'Eryl', day: 30 })).toBe(true);
    expect(isBelentorDate({ era: 'AA', year: 641, month: 'Eryl', day: 31 })).toBe(false);
    expect(isBelentorDate({ era: 'AA', year: 641, month: 'Not a month', day: 1 })).toBe(false);
  });

  it('orders BA dates before AA dates around Ascension', () => {
    expect(compareBelentorDates({ era: 'BA', year: 1, month: 'Trin', day: 30 }, { era: 'AA', year: 1, month: 'Quen', day: 1 })).toBeLessThan(0);
  });
});
