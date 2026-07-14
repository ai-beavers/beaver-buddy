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
];
