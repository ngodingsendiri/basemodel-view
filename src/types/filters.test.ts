import { describe, it, expect } from 'vitest';
import { parseSortKey, parseBoolean } from './filters';

describe('filter parsers', () => {
  it('parseSortKey validates allowed keys and defaults to name', () => {
    expect(parseSortKey('context')).toBe('context');
    expect(parseSortKey('date')).toBe('date');
    expect(parseSortKey('name')).toBe('name');
    expect(parseSortKey('bogus')).toBe('name');
    expect(parseSortKey(null)).toBe('name');
  });

  it('parseBoolean treats only literal "true" as truthy', () => {
    expect(parseBoolean('true')).toBe(true);
    expect(parseBoolean('false')).toBe(false);
    expect(parseBoolean(null)).toBe(false);
    expect(parseBoolean('1')).toBe(false);
  });
});
