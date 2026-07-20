import { describe, expect, it } from 'vitest';
import { hasMrrPollNowFlag, parseInjectXp, parseKeychainService, parseQuipFlags } from './flags';

describe('parseQuipFlags', () => {
  it('returns an empty array for empty argv', () => {
    expect(parseQuipFlags([])).toEqual([]);
  });

  it('collects valid quip triggers', () => {
    expect(parseQuipFlags(['--quip', 'appStart', '--quip', 'evolution'])).toEqual(['appStart', 'evolution']);
  });

  it('ignores invalid triggers and keeps the valid ones', () => {
    expect(parseQuipFlags(['--quip', 'notAQuip', '--quip', 'idle'])).toEqual(['idle']);
  });

  it('handles a missing value after --quip', () => {
    expect(parseQuipFlags(['--quip'])).toEqual([]);
  });

  it('handles mixed valid, invalid, and missing triggers', () => {
    expect(parseQuipFlags(['--quip', 'appStart', '--quip', 'bogus', '--quip', 'idle'])).toEqual([
      'appStart',
      'idle',
    ]);
  });
});

describe('parseInjectXp', () => {
  it('returns null for empty argv', () => {
    expect(parseInjectXp([])).toBeNull();
  });

  it('parses a positive integer', () => {
    expect(parseInjectXp(['--inject-xp=100'])).toBe(100);
  });

  it('parses a positive float', () => {
    expect(parseInjectXp(['--inject-xp=123.45'])).toBe(123.45);
  });

  it('rejects zero and returns null', () => {
    expect(parseInjectXp(['--inject-xp=0'])).toBeNull();
  });

  it('rejects negative numbers and returns null', () => {
    expect(parseInjectXp(['--inject-xp=-50'])).toBeNull();
  });

  it('rejects non-numeric values and returns null', () => {
    expect(parseInjectXp(['--inject-xp=abc'])).toBeNull();
  });

  it('rejects an empty value and returns null', () => {
    expect(parseInjectXp(['--inject-xp='])).toBeNull();
  });

  it('parses very large finite values', () => {
    expect(parseInjectXp(['--inject-xp=1e15'])).toBe(1e15);
  });

  it('rejects Infinity and returns null', () => {
    expect(parseInjectXp(['--inject-xp=Infinity'])).toBeNull();
  });
});

describe('parseKeychainService', () => {
  it('returns the default service for empty argv', () => {
    expect(parseKeychainService([])).toBe('beaver-buddy');
  });

  it('returns a valid override', () => {
    expect(parseKeychainService(['--keychain-service', 'my-service'])).toBe('my-service');
  });

  it('falls back to the default when the value is missing', () => {
    expect(parseKeychainService(['--keychain-service'])).toBe('beaver-buddy');
  });

  it('falls back to the default for an invalid service name', () => {
    expect(parseKeychainService(['--keychain-service', '-bad'])).toBe('beaver-buddy');
  });
});

describe('hasMrrPollNowFlag', () => {
  it('returns true when the flag is present', () => {
    expect(hasMrrPollNowFlag(['--mrr-poll-now'])).toBe(true);
  });

  it('returns false when the flag is absent', () => {
    expect(hasMrrPollNowFlag(['--quip', 'appStart'])).toBe(false);
  });

  it('returns false for empty argv', () => {
    expect(hasMrrPollNowFlag([])).toBe(false);
  });
});
