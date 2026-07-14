import { defineConfig } from 'vitest/config';

// tsc's compiled test output also lands in dist/ (single tsconfig, no
// separate build exclude) — keep vitest scoped to source so it doesn't
// double-run the compiled CommonJS copy.
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', 'dist/**', '.worktrees/**', '.context/**'],
  },
});
