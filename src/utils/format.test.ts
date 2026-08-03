import { describe, it, expect } from 'vitest';
import { formatCtx, formatReleaseDate, formatCost } from './format';

describe('formatCtx', () => {
  it('formats millions', () => {
    expect(formatCtx(1_000_000)).toBe('1.0M');
    expect(formatCtx(2_500_000)).toBe('2.5M');
    expect(formatCtx(128_000)).toBe('128k');
  });

  it('formats thousands', () => {
    expect(formatCtx(1000)).toBe('1k');
    expect(formatCtx(4096)).toBe('4k');
    expect(formatCtx(32768)).toBe('32k');
  });

  it('formats small numbers', () => {
    expect(formatCtx(512)).toBe('512');
    expect(formatCtx(0)).toBe('0');
  });
});

describe('formatReleaseDate', () => {
  it('formats valid date strings', () => {
    const result = formatReleaseDate('2024-01-15');
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/2024/);
  });

  it('returns null for undefined', () => {
    expect(formatReleaseDate(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(formatReleaseDate('')).toBeNull();
  });
});

describe('formatCost', () => {
  it('returns em dash for unknown cost', () => {
    expect(formatCost(undefined)).toBe('—');
  });

  it('formats zero cost numerically', () => {
    expect(formatCost(0)).toBe('$0.00');
  });

  it('formats whole-dollar costs', () => {
    expect(formatCost(10)).toBe('$10.00');
    expect(formatCost(1.25)).toBe('$1.25');
  });

  it('formats sub-dollar costs with extra precision', () => {
    expect(formatCost(0.5)).toBe('$0.50');
    expect(formatCost(0.0015)).toBe('$0.0015');
  });
});