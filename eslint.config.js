// @ts-check
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  {
    ignores: ['dist/**', 'release/**', 'node_modules/**', '.worktrees/**', '.context/**'],
  },
  {
    files: ['src/main/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: './tsconfig.json' },
      globals: { console: 'readonly', process: 'readonly', __dirname: 'readonly', module: 'readonly', require: 'readonly' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // PixiJS is dev-time authoring tooling only (ADR 003); the shipped
      // app runtime must never import it.
      'no-restricted-imports': ['error', { paths: [{ name: 'pixi.js', message: 'PixiJS is dev-time tooling only (docs/adr/003-pixijs-authoring.md) — never shipped in the app runtime.' }] }],
    },
  },
  {
    files: ['src/renderer/**/*.ts'],
    ignores: ['src/renderer/**/*.test.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: './src/renderer/tsconfig.json' },
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        fetch: 'readonly',
        Image: 'readonly',
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
    },
  },
  {
    // Renderer tests are excluded from src/renderer/tsconfig.json (so they
    // don't land in dist/renderer), which means they can't be parsed against
    // that project — parse them standalone. The recommended rule set is not
    // type-aware, so no rules are lost.
    files: ['src/renderer/**/*.test.ts'],
    languageOptions: {
      parser: tsParser,
      globals: { window: 'readonly', document: 'readonly', console: 'readonly' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
    },
  },
  {
    files: ['scripts/gen-sprites/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: './scripts/gen-sprites/tsconfig.json' },
      globals: { console: 'readonly' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
    },
  },
  {
    files: ['tools/puppet-studio/**/*.ts'],
    ignores: ['tools/puppet-studio/**/*.test.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: './tools/puppet-studio/tsconfig.json' },
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
    },
  },
  {
    // Same situation as renderer tests: tools tests are excluded from the
    // tools tsconfig, so parse them standalone.
    files: ['tools/puppet-studio/**/*.test.ts'],
    languageOptions: {
      parser: tsParser,
      globals: { console: 'readonly' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
    },
  },
];
