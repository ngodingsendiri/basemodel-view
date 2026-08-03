import { describe, it, expect } from 'vitest';
import { parseSortKey, parseBoolean, rankBenchmarkFromKey } from './filters';

describe('filter parsers', () => {
  it('parseSortKey validates allowed keys and defaults to name', () => {
    expect(parseSortKey('context')).toBe('context');
    expect(parseSortKey('date')).toBe('date');
    expect(parseSortKey('price')).toBe('price');
    expect(parseSortKey('name')).toBe('name');
    expect(parseSortKey('bogus')).toBe('name');
    expect(parseSortKey(null)).toBe('name');
    expect(parseSortKey('rank:')).toBe('name');
    expect(parseSortKey('rank:code')).toBe('rank:code');
    expect(parseSortKey('rank:math-lvl-5')).toBe('rank:math-lvl-5');
  });

  it('rankBenchmarkFromKey extracts the benchmark name from rank keys', () => {
    expect(rankBenchmarkFromKey('rank:code')).toBe('code');
    expect(rankBenchmarkFromKey('rank:bbh')).toBe('bbh');
    expect(rankBenchmarkFromKey('name')).toBeNull();
    expect(rankBenchmarkFromKey('context')).toBeNull();
  });

  it('parseBoolean treats only literal "true" as truthy', () => {
    expect(parseBoolean('true')).toBe(true);
    expect(parseBoolean('false')).toBe(false);
    expect(parseBoolean(null)).toBe(false);
    expect(parseBoolean('1')).toBe(false);
  });
});
