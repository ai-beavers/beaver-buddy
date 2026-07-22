// Read-only, enumerated path discovery for usage logs (CLAUDE.md: "the
// specific coding-agent usage files the parser documents" — nothing
// else is ever read). No file content is touched here, only directory
// listings of the documented shapes.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type Platform = 'win32' | 'darwin' | 'linux';

export interface DiscoveredPaths {
  readonly claudeFiles: readonly string[];
  readonly codexFiles: readonly string[];
  readonly piFiles: readonly string[];
  readonly kimiFiles: readonly string[];
  readonly opencodeFiles: readonly string[];
}

// Subset of process.env this module reads — kept narrow and injectable so
// tests never need the operator's real environment or home directory.
export interface PathEnv {
  readonly CLAUDE_CONFIG_DIR?: string;
  readonly CODEX_HOME?: string;
  readonly LOCALAPPDATA?: string;
  readonly APPDATA?: string;
  readonly PI_AGENT_DIR?: string;
  readonly KIMI_DATA_DIR?: string;
  readonly OPENCODE_DATA_DIR?: string;
}

function safeReaddir(dir: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}


function splitConfiguredDirs(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
}

function findJsonLikeFiles(root: string, predicate: (fileName: string) => boolean = (fileName) => fileName.endsWith('.jsonl')): string[] {
  const files: string[] = [];
  for (const entry of safeReaddir(root)) {
    const entryPath = path.join(root, entry.name);
    if (entry.isFile() && predicate(entry.name)) {
      files.push(entryPath);
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...findJsonLikeFiles(entryPath, predicate));
    }
  }
  return files;
}

function normalizePlatform(platform: string): Platform {
  if (platform === 'win32' || platform === 'darwin' || platform === 'linux') return platform;
  // Defensive fallback: treat unknown platforms as linux so discovery keeps
  // working on BSD/WSL-like environments without a cast error.
  return 'linux';
}

function claudeConfigDirs(env: PathEnv, home: string, platform: Platform): string[] {
  const configured = env.CLAUDE_CONFIG_DIR;
  if (configured && configured.trim().length > 0) {
    // Comma is the documented separator; semicolon is additionally accepted
    // because it is the conventional PATH separator on Windows.
    return splitConfiguredDirs(configured);
  }

  const legacy = path.join(home, '.claude');

  if (platform === 'win32') {
    // Same Union semantics as Unix: both the XDG location and the legacy one
    // are used if present, since users who migrated or use WSL toolchains may
    // have data in either spot.
    const xdg = path.join(home, '.config', 'claude');
    return [xdg, legacy].filter((d) => fs.existsSync(d));
  }

  // No override on Unix-like systems: both the current XDG location and the
  // legacy one are used if present, since users who migrated may still have
  // data in the old spot.
  const xdg = path.join(home, '.config', 'claude');
  return [xdg, legacy].filter((d) => fs.existsSync(d));
}

// Enumerated Claude Code layouts: `projects/{project}/{session}.jsonl`,
// nested `projects/{project}/{session}/subagents/**/*.jsonl`, and Tokscale-
// observed wrapper transcripts at `transcripts/*.jsonl`. Nothing outside
// these shapes is read. Workflow `journal.jsonl` files under `subagents/` are
// orchestration metadata, not message transcripts, so they are skipped.
function findSubagentFiles(subagentsDir: string): string[] {
  const files: string[] = [];
  for (const entry of safeReaddir(subagentsDir)) {
    const entryPath = path.join(subagentsDir, entry.name);
    if (entry.isFile() && entry.name.endsWith('.jsonl') && entry.name !== 'journal.jsonl') {
      files.push(entryPath);
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...findSubagentFiles(entryPath));
    }
  }
  return files;
}

function findClaudeFiles(configDir: string): string[] {
  const projectsDir = path.join(configDir, 'projects');
  const transcriptsDir = path.join(configDir, 'transcripts');
  const files: string[] = [];

  for (const project of safeReaddir(projectsDir)) {
    if (!project.isDirectory()) continue;
    const projectDir = path.join(projectsDir, project.name);

    for (const entry of safeReaddir(projectDir)) {
      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        files.push(path.join(projectDir, entry.name));
        continue;
      }
      if (entry.isDirectory()) {
        files.push(...findSubagentFiles(path.join(projectDir, entry.name, 'subagents')));
      }
    }
  }

  for (const transcript of safeReaddir(transcriptsDir)) {
    if (transcript.isFile() && transcript.name.endsWith('.jsonl')) {
      files.push(path.join(transcriptsDir, transcript.name));
    }
  }

  return files;
}

// Enumerated Codex layout: `sessions/YYYY/MM/DD/rollout-*.jsonl`, plus the
// same shape under `archived_sessions/`. Returns relative-path -> absolute
// so a caller can prefer `sessions/` on a duplicate relative path.
function findCodexRolloutFiles(root: string): Map<string, string> {
  const byRelativePath = new Map<string, string>();

  for (const year of safeReaddir(root)) {
    if (!year.isDirectory()) continue;
    const yearDir = path.join(root, year.name);

    for (const month of safeReaddir(yearDir)) {
      if (!month.isDirectory()) continue;
      const monthDir = path.join(yearDir, month.name);

      for (const day of safeReaddir(monthDir)) {
        if (!day.isDirectory()) continue;
        const dayDir = path.join(monthDir, day.name);

        for (const file of safeReaddir(dayDir)) {
          if (!file.isFile() || !file.name.startsWith('rollout-') || !file.name.endsWith('.jsonl')) continue;
          const relative = path.join(year.name, month.name, day.name, file.name);
          byRelativePath.set(relative, path.join(dayDir, file.name));
        }
      }
    }
  }

  return byRelativePath;
}

function findCodexFiles(codexHome: string): Map<string, string> {
  // sessions/ wins on a duplicate relative path (documented Codex behavior).
  const winners = findCodexRolloutFiles(path.join(codexHome, 'sessions'));
  const archived = findCodexRolloutFiles(path.join(codexHome, 'archived_sessions'));
  for (const [relative, absolute] of archived) {
    if (!winners.has(relative)) winners.set(relative, absolute);
  }
  return winners;
}

// Union across every existing candidate root: on Windows a session-less
// candidate (e.g. the Codex desktop app's userData folder) must not hide CLI
// sessions elsewhere. On a duplicate relative path the earliest candidate
// wins (candidate order = priority), even if its copy comes from
// archived_sessions/; within one root sessions/ still beats
// archived_sessions/ (see findCodexFiles). With zero or one root this is
// result- and order-identical to the previous first-existing-wins behavior.
function findAllCodexFiles(roots: readonly string[]): string[] {
  const winners = new Map<string, string>();
  for (const root of roots) {
    for (const [relative, absolute] of findCodexFiles(root)) {
      if (!winners.has(relative)) winners.set(relative, absolute);
    }
  }
  return [...winners.values()];
}

function codexHomes(env: PathEnv, home: string, platform: Platform): string[] {
  const configured = env.CODEX_HOME;
  if (configured && configured.trim().length > 0) {
    return [configured];
  }

  if (platform === 'win32') {
    // Guard against set-but-empty (or whitespace-only) env vars:
    // path.join('', 'Codex') would resolve relative to the process CWD.
    const localAppData = env.LOCALAPPDATA?.trim();
    const appData = env.APPDATA?.trim();
    return [
      localAppData ? path.join(localAppData, 'Codex') : '',
      appData ? path.join(appData, 'Codex') : '',
      path.join(home, '.codex'),
    ].filter((d) => d.length > 0);
  }

  return [path.join(home, '.codex')];
}

function resolveCodexHomes(env: PathEnv, home: string, platform: Platform): string[] {
  // Union, not first-existing-wins: every existing candidate may hold sessions.
  return codexHomes(env, home, platform).filter((codexHome) => fs.existsSync(codexHome));
}

function configuredOrDefaultDirs(configured: string | undefined, defaults: readonly string[]): string[] {
  if (configured && configured.trim().length > 0) return splitConfiguredDirs(configured);
  return defaults.filter((d) => fs.existsSync(d));
}

function piSessionDirs(env: PathEnv, home: string): string[] {
  return configuredOrDefaultDirs(env.PI_AGENT_DIR, [path.join(home, '.pi', 'agent', 'sessions')]);
}

function kimiDataDirs(env: PathEnv, home: string): string[] {
  return configuredOrDefaultDirs(env.KIMI_DATA_DIR, [path.join(home, '.kimi'), path.join(home, '.kimi-code')]);
}

function opencodeDataDirs(env: PathEnv, home: string): string[] {
  return configuredOrDefaultDirs(env.OPENCODE_DATA_DIR, [path.join(home, '.local', 'share', 'opencode')]);
}

function findKimiFiles(root: string): string[] {
  return findJsonLikeFiles(path.join(root, 'sessions'), (fileName) => fileName === 'wire.jsonl');
}

function findPiFiles(sessionsDir: string): string[] {
  return findJsonLikeFiles(sessionsDir, (fileName) => fileName.endsWith('.jsonl') || fileName.endsWith('.json'));
}

function findOpenCodeFiles(dataDir: string): string[] {
  return findJsonLikeFiles(path.join(dataDir, 'session'), (fileName) => fileName.endsWith('.json'));
}

export function discoverPaths(
  env: PathEnv = process.env,
  home: string = os.homedir(),
  platform: Platform = normalizePlatform(process.platform),
): DiscoveredPaths {
  const claudeFiles = claudeConfigDirs(env, home, platform).flatMap(findClaudeFiles);

  const codexFiles = findAllCodexFiles(resolveCodexHomes(env, home, platform));
  const piFiles = piSessionDirs(env, home).flatMap(findPiFiles);
  const kimiFiles = kimiDataDirs(env, home).flatMap(findKimiFiles);
  const opencodeFiles = opencodeDataDirs(env, home).flatMap(findOpenCodeFiles);

  return { claudeFiles, codexFiles, piFiles, kimiFiles, opencodeFiles };
}
