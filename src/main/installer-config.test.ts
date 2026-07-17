import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Flight plan #5 — installer localization. Text/regex assertions against
// electron-builder.yml on purpose: no YAML parser dependency may be added
// just for this test.

const configPath = path.resolve(__dirname, '../../electron-builder.yml');
const config = fs.readFileSync(configPath, 'utf8');

function nsisSection(): string {
  const match = config.match(/^nsis:\r?\n((?: {2}.+(?:\r?\n|$))+)/m);
  expect(match, 'electron-builder.yml must contain a top-level nsis: section').toBeTruthy();
  return match![1];
}

describe('electron-builder.yml — NSIS installer localization', () => {
  it('defines installerLanguages under nsis:', () => {
    expect(nsisSection()).toMatch(/installerLanguages:/);
  });

  it('lists en_US before de_DE (fallback order: English first)', () => {
    // Support both inline list [en_US, de_DE] and block list:
    // installerLanguages:
    //   - en_US
    //   - de_DE
    const inlineMatch = nsisSection().match(/installerLanguages:\s*\[([^\]]*)\]/);
    if (inlineMatch) {
      const languages = inlineMatch[1].split(',').map((lang) => lang.trim());
      expect(languages).toContain('en_US');
      expect(languages).toContain('de_DE');
      expect(languages.indexOf('en_US')).toBeLessThan(languages.indexOf('de_DE'));
    } else {
      const blockMatch = nsisSection().match(/installerLanguages:\r?\n((?:\s+-\s+.+\r?\n?)+)/);
      expect(blockMatch, 'installerLanguages must be an inline or block list').toBeTruthy();
      const languages = blockMatch![1]
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s+-\s+/, '').trim())
        .filter((lang) => lang.length > 0);
      expect(languages).toContain('en_US');
      expect(languages).toContain('de_DE');
      expect(languages.indexOf('en_US')).toBeLessThan(languages.indexOf('de_DE'));
    }
  });

  it('does not disable the multi-language installer', () => {
    expect(config).not.toMatch(/multiLanguageInstaller:\s*false/);
  });

  it('does not disable unicode installers', () => {
    expect(config).not.toMatch(/unicode:\s*false/);
  });

  it('does not permanently enable the language selector dialog', () => {
    // displayLanguageSelector: true is only allowed temporarily while
    // testing localized installers, never committed to the config.
    expect(config).not.toMatch(/displayLanguageSelector:\s*true/);
  });
});
