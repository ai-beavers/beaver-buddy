# Herdr Integration Plan

**Status:** proposed; blocked on owner/dependency decision  
**Basis:** [`herdr-evaluation.md`](herdr-evaluation.md) and Herdr 0.7.5 / protocol 17

## Recommendation

Implement M3/P1 WAVE-2 as an **optional, read-only adapter to a user-installed and already-running Herdr default session**. Do not install, update, launch, bundle, vendor, or add Herdr to `package.json`. If the owner requires Beaver Buddy to work without a separate Herdr installation, stop: that distribution choice needs explicit dependency approval and a revised plan.

The adapter should use Node's built-in `net` module to connect to Herdr's local Unix socket or Windows named pipe. This adds no dependency. It should consume only:

1. `session.snapshot` for bootstrap/reconciliation;
2. `events.subscribe` for `pane.agent_detected`, `pane.agent_status_changed`, `pane.exited`, and `pane.closed`;
3. `ping` only for compatibility/health if the snapshot does not already establish it.

It must never call output-reading, input-sending, process-info, integration-install, update, plugin, or control methods.

## Product contract

The proposed normalized contract reflects states Herdr actually exposes:

```ts
export type AgentKind =
  | 'claude-code'
  | 'codex'
  | 'pi'
  | 'kimi-code'
  | 'opencode'
  | 'unknown';

export type AgentState =
  | 'working'
  | 'needs-attention'
  | 'done'
  | 'idle'
  | 'unknown'
  | 'offline';

export interface AgentStatusEvent {
  readonly instanceId: string;
  readonly agentKind: AgentKind;
  readonly state: AgentState;
  readonly observedAt: number;
}
```

Mapping:

- Herdr `blocked` → Beaver Buddy `needs-attention`.
- Herdr `working`, `done`, `idle`, `unknown` map one-to-one.
- Adapter disconnect/reconciliation → Beaver Buddy `offline`.
- There is no `question` state. Animation or copy may express generic attention, never “the agent asked a question” unless a future authoritative Herdr protocol adds that distinction.

`instanceId` should be an opaque, session-scoped value derived from validated `pane_id`, prefixed with the adapter source (for example `herdr:w1:p1`). Do not expose workspace labels, terminal IDs, session IDs, cwd, or other metadata. `observedAt` is `Date.now()` at validated receipt because Herdr status events have no timestamp.

## Module design

Proposed files:

```text
src/main/agent-status/
  types.ts                 normalized public domain contract
  service.ts               lifecycle, reconciliation, subscribers, dedupe
  herdr-protocol.ts        narrow runtime validators and state/kind mapping
  herdr-transport.ts       newline framing over injected Node socket
  herdr-endpoint.ts        default endpoint resolution, no broad filesystem scan
  config.ts                protocol/version limits and reconnect bounds
  *.test.ts                synthetic sockets/envelopes only
```

Responsibilities:

- `types.ts` knows nothing about Herdr.
- `herdr-protocol.ts` accepts `unknown`, validates exact size/type/enum limits, and returns only normalized fields. It never returns raw envelopes or paths.
- `herdr-transport.ts` owns connect, newline framing, request IDs, snapshot/subscription handshake, maximum line/buffer sizes, EOF, and teardown. It receives an injected socket factory and clock for tests.
- `service.ts` maintains `Map<instanceId, lastState>`, deduplicates unchanged state, publishes immutable normalized events, reconciles a fresh snapshot after reconnect, and emits `offline` once for vanished instances.
- `herdr-endpoint.ts` resolves only the documented default-session endpoint for the current platform. It must not recursively search user directories. An explicit, locally persisted endpoint override may be added later only through a validated Settings design.

The service is a deep main-process module. `main.ts` should only construct/start it after Electron is ready, subscribe the later M3 coordinator, and stop it during shutdown/suspend. No Herdr object crosses preload IPC.

## Endpoint and compatibility policy

1. Support Herdr **0.7.5+ with protocol 17** initially. Read `version` and `protocol` from the snapshot before accepting agents.
2. A missing endpoint is normal: report adapter unavailable without an error dialog or retry loop.
3. Use exponential reconnect with a low cap and jitter, pause reconnects during system suspend, and `unref()` retry timers. Reset delay after a successful snapshot + subscription.
4. On EOF or protocol failure, clear raw buffers and reconcile known instances to `offline` once.
5. Reject oversized lines, excessive agents, invalid IDs, unknown status values, duplicate JSON keys if the chosen parser can detect them, and response IDs that do not match outstanding requests.
6. Subscribe only after the bootstrap snapshot on the same connection. Because a snapshot/subscription gap can race, immediately request one second snapshot after subscription and reconcile it; alternatively use an upstream atomic bootstrap feature if Herdr adds one.
7. Default-session-only is deliberate Cycle-1 scope. Named-session enumeration would expand filesystem/socket access and conflict resolution.

Exact Windows named-pipe and Unix endpoint derivation must be verified against Herdr 0.7.5 source and clean-machine tests before implementation acceptance. Do not shell out to parse human-readable `herdr status` output as the production protocol.

## State and event behavior

| Situation | Required behavior |
| --- | --- |
| Initial snapshot has two agents | Emit at most one current event per validated pane after compatibility succeeds. |
| Same state repeats | Suppress duplicate downstream event. |
| `blocked` arrives | Emit `needs-attention`; downstream config chooses animation/sound identifiers. |
| Unseen `idle` is represented as `done` | Preserve Herdr's returned `done`; do not reinterpret it. |
| Agent becomes seen and Herdr returns `idle` | Emit `idle`; do not replay a completion notification. |
| Pane exits/closes | Emit `offline` once and delete cached runtime state after downstream receipt. |
| Socket drops | Mark all cached instances `offline` once, reconnect, then reconcile snapshot. |
| Pane ID is reused after a cold server start | Treat it as a new runtime observation; do not persist instance history across Beaver Buddy restarts. |
| Unknown agent label | Map kind to `unknown`; keep raw label out of logs and renderer payloads. |
| Invalid/oversized message | Close connection, emit a redacted diagnostic category, back off. |

## Animation and sound boundary

M3/P1 must stop at normalized events. A later coordinator owns configurable mappings:

```ts
interface AgentCueMapping {
  readonly animationId?: string;
  readonly soundId?: string;
}

type AgentCueConfig = Readonly<
  Partial<Record<AgentState, AgentCueMapping>>
>;
```

The coordinator looks up a cue after receiving a normalized event. The Herdr adapter must never import renderer, sprite, audio, quip, tray, or animation modules. Configuration contains allowlisted asset identifiers, not file paths. Missing mappings are valid and silent.

## Privacy and security controls

- Parse snapshot agents from an explicit allowlist of keys; discard `cwd`, `foreground_cwd`, terminal title, session data, labels, tokens, messages, and unknown fields immediately.
- Subscribe only to the four required event types. Never request terminal output.
- Do not log raw JSON, socket endpoint, pane/workspace IDs, agent labels, paths, titles, or counts tied to identities. Allowed diagnostics are coarse categories such as `unavailable`, `incompatible-protocol`, `malformed-message`, and `disconnected`.
- Limit line length, buffered bytes, record count, and string length before storing anything.
- Treat Herdr reports as same-user advisory data, not authenticated security events. M3/P3 must prevent renderer/manual IPC from synthesizing trusted agent events.
- Beaver Buddy must not launch Herdr or cause Herdr network activity. Setup documentation must require Herdr update/manifest checks to comply with the owner's offline policy, pending verification of the exact configuration.
- Tests use synthetic generic paths only and assert that sensitive input fields never appear in normalized output, errors, or captured logs.

## Implementation waves

### WAVE-2A — Contract and pure protocol layer

- Add normalized types and Herdr-to-domain mappings.
- Add bounded validators for snapshot, subscription acknowledgement, and four event types.
- Document protocol/version support and the `blocked` limitation.
- Unit-test malformed, oversized, unknown, and privacy-sensitive inputs.

**Done when:** no transport or renderer code is needed to prove every accepted input yields only the normalized four-field event.

### WAVE-2B — Local transport and reconciliation

- Add injected Unix-socket/named-pipe transport using built-in Node APIs.
- Implement snapshot → subscribe → reconciliation snapshot handshake.
- Add dedupe, concurrent instance tracking, exit/close handling, reconnect/backoff, and cleanup.
- Test with an in-process synthetic socket server; add no Herdr fixture binary.

**Done when:** tests cover two concurrent agents, all supported states, duplicate/out-of-order messages, disconnect, restart, stale/replaced panes, malformed framing, and bounded shutdown.

### WAVE-2C — Main-process lifecycle and manual compatibility QA

- Start/stop the service from `main.ts`; pause/reconnect safely around suspend/resume.
- Add coarse non-sensitive diagnostics only.
- Run a Linux/macOS smoke test against user-installed Herdr 0.7.5.
- Run the required Windows beta test for named pipe, descendant-process detection, two concurrent real agents, approval/question UI, completion, terminal closure, and server restart.
- Record setup/teardown and observed limitations without screenshots containing terminal content.

**Done when:** Beaver Buddy remains fully functional when Herdr is absent; compatible Herdr sessions generate normalized events; no renderer/animation wiring exists yet.

## Test plan

Automated tests:

- Canonical kind mapping for Claude, Codex, Pi, Kimi, and OpenCode labels.
- State mapping, especially `blocked → needs-attention` and absence of `question`.
- Snapshot allowlist strips paths, titles, sessions, labels, tokens, and extra fields.
- NDJSON split/coalesced chunks, blank lines, invalid UTF-8 policy, maximum line length, and truncated EOF.
- Request/response correlation and subscription acknowledgement.
- Bootstrap race reconciliation.
- Two or more concurrent panes with independent transitions.
- Unchanged-state dedupe and monotonically handled local sequence.
- Exit, close, EOF, reconnect, restart, and stale instance cleanup.
- Missing socket and incompatible protocol degrade silently.
- Timers and sockets are released on stop/suspend.
- Captured logs contain no input payload or identifiers.

Manual compatibility matrix:

| Platform | Required agents | Required transitions |
| --- | --- | --- |
| Windows (primary) | Claude Code, Codex, plus one lifecycle-authority agent if available | working, visible approval/question → needs-attention, finished unseen → done, viewed → idle, pane close, server restart, two concurrent instances |
| macOS or Linux | Claude Code and one lifecycle-authority agent | same transitions; Unix socket reconnect and detach/reattach |

If Herdr cannot reproduce a required transition, record it as upstream limitation. Do not add a custom screen or process detector.

## Rollback

The feature is optional and isolated. Rollback consists of disabling construction of `AgentStatusService` (or a feature flag during rollout) and removing the agent-status directory. No persisted domain state or renderer contract is required in WAVE-2, so rollback has no migration. A Herdr disconnect must never stop XP tracking, overlay rendering, tray behavior, or app shutdown.

## Risks

| Risk | Mitigation |
| --- | --- |
| Dependency/distribution policy unresolved | Require user-installed Herdr for the first adapter, or stop for explicit approval. |
| Question vs generic blocked cannot be distinguished | Use `needs-attention`; never infer or inspect prompt text. |
| Screen-manifest drift misses Claude/Codex prompts | Expose unknown/idle faithfully, pin minimum version, test real releases, report upstream. |
| Snapshot leaks paths | Strict allowlist at parse boundary; no raw logs or renderer payloads. |
| Herdr performs runtime update checks | Document/verify disabled configuration before release; Beaver Buddy never invokes updates. |
| Windows beta differs from Unix | Windows acceptance gate before shipping. |
| Socket protocol changes | Protocol/version gate and redacted incompatible state. |
| Same-user process spoofs Herdr reports | Treat events as advisory; security hardening remains M3/P3. |
| Multiple named sessions | Default session only for Cycle 1. |

## Owner gate

Before WAVE-2 starts, approve or revise all three decisions:

1. **Distribution:** Herdr is a separately installed/running prerequisite; Beaver Buddy does not install or bundle it.
2. **State language:** `blocked` becomes generic `needs-attention`; there is no separate `question` claim.
3. **Scope:** default Herdr session only, with agents required to run inside Herdr panes.

If these are approved, WAVE-2A and WAVE-2B are technically ready and require no new npm dependency. WAVE-2C remains gated on successful Windows beta verification.
