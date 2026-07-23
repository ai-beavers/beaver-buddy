import { describe, expect, it } from 'vitest';
import { weightForModel } from './weights';

describe('weightForModel', () => {
  it('returns the top-model weight for Claude Fable 5 (1.78)', () => {
    expect(weightForModel('Claude Fable 5 (w. fallback)')).toBe(1.78);
  });

  it('returns the floor weight for a low-index model (0.50)', () => {
    expect(weightForModel('K2 Think V2')).toBe(0.5);
  });

  it('returns unknown weight (1.0) for an unrecognized model', () => {
    expect(weightForModel('some-uncatalogued-model')).toBe(1.0);
  });

  it('returns unknown weight for undefined/empty input', () => {
    expect(weightForModel(undefined)).toBe(1.0);
    expect(weightForModel('')).toBe(1.0);
    expect(weightForModel('   ')).toBe(1.0);
  });

  it('normalizes case and whitespace before lookup', () => {
    expect(weightForModel('  claude fable 5 (w. fallback)  ')).toBe(1.78);
    expect(weightForModel('K2 THINK V2')).toBe(0.5);
  });

  it('maps log model names to table entries via the mapping table', () => {
    expect(weightForModel('claude-opus-4-8')).toBe(1.55);
    expect(weightForModel('claude-sonnet-5')).toBe(1.39);
    expect(weightForModel('gpt-5.6-sol')).toBe(1.72);
  });

  it('maps are case-insensitive', () => {
    expect(weightForModel('CLAUDE-OPUS-4-8')).toBe(1.55);
    expect(weightForModel('GPT-5.6-SOL')).toBe(1.72);
  });

  it('direct table lookup works when no mapping entry exists', () => {
    expect(weightForModel('Gemini 3.6 Flash')).toBe(1.23);
    expect(weightForModel('deepseek v4 pro (max)')).toBe(0.96);
  });
});
