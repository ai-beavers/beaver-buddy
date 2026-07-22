export const USAGE_SOURCE_IDS = ['claude', 'codex', 'pi', 'kimi', 'opencode'] as const;

export type UsageSourceId = (typeof USAGE_SOURCE_IDS)[number];

export const USAGE_SOURCE_LABELS: Record<UsageSourceId, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  pi: 'Pi Agent',
  kimi: 'Kimi Code',
  opencode: 'OpenCode',
};

export function emptyEnabledSources(): Record<UsageSourceId, boolean> {
  return Object.fromEntries(USAGE_SOURCE_IDS.map((source) => [source, false])) as Record<UsageSourceId, boolean>;
}
