# Herdr Evaluation

**Research date:** 2026-07-26  
**Evaluated release:** Herdr 0.7.5, protocol 17  
**Upstream revision inspected:** [`e536bd8`](https://github.com/ogulcancelik/herdr/commit/e536bd8bd99de975cb2d15bb384e6e35f88ef88e)

## Decision summary

Herdr can be a useful **optional external event source** for Beaver Buddy when coding agents run inside Herdr panes. Its local socket API supplies an initial session snapshot and a long-lived `pane.agent_status_changed` event stream. The stream carries an agent label, a pane identifier, a workspace identifier, and one of Herdr's semantic states.

WAVE-2 is **not build-ready without an owner decision**. Beaver Buddy's dependency rules do not permit bundling Herdr, adding it to `package.json`, or installing it for the user. The owner must choose whether M3 may require a separately installed/running Herdr 0.7.5+ instance, or separately approve a distribution model. A user-installed-only adapter needs no new project package.

There is also a product-model limitation: Herdr exposes `blocked`, not separate `waiting-for-input` and `question` states. A question, approval request, or decision prompt all become `blocked`. Beaver Buddy must not claim more precision or infer prompt content.

## Sources and method

Primary sources:

- [Herdr repository and README at v0.7.5](https://github.com/ogulcancelik/herdr/tree/v0.7.5)
- [Concepts: canonical agent states](https://github.com/ogulcancelik/herdr/blob/e536bd8bd99de975cb2d15bb384e6e35f88ef88e/docs/versions/0.7.5/website/src/content/docs/concepts.mdx)
- [Agents: detection and status-authority model](https://github.com/ogulcancelik/herdr/blob/e536bd8bd99de975cb2d15bb384e6e35f88ef88e/docs/versions/0.7.5/website/src/content/docs/agents.mdx)
- [Integrations: per-agent lifecycle/session behavior](https://github.com/ogulcancelik/herdr/blob/e536bd8bd99de975cb2d15bb384e6e35f88ef88e/docs/versions/0.7.5/website/src/content/docs/integrations.mdx)
- [Socket API: snapshot and subscriptions](https://github.com/ogulcancelik/herdr/blob/e536bd8bd99de975cb2d15bb384e6e35f88ef88e/docs/versions/0.7.5/website/src/content/docs/socket-api.mdx)
- [Windows beta limitations](https://github.com/ogulcancelik/herdr/blob/e536bd8bd99de975cb2d15bb384e6e35f88ef88e/docs/versions/0.7.5/website/src/content/docs/windows-beta.mdx)
- [Apache-2.0 license](https://github.com/ogulcancelik/herdr/blob/v0.7.5/LICENSE)

The official `herdr-linux-x86_64` v0.7.5 release binary was downloaded to `/tmp`, marked executable, and run with an isolated temporary `HOME`, `XDG_CONFIG_HOME`, and `XDG_STATE_HOME`. No Herdr files or dependencies were added to Beaver Buddy. Background update and manifest checks were disabled for the experiment. The test used synthetic workspaces and the public `pane report-agent` API; it did not inspect real prompts or run authenticated coding-agent sessions.

## Install, run, and remove

Official installation choices are a shell installer, Homebrew, Mise, downloadable macOS/Linux binaries, and a Windows beta PowerShell installer. The repository describes Herdr as one Rust binary. The latest GitHub release API returned macOS and Linux assets for v0.7.5; Windows installation is documented separately as beta rather than published as one of those four release assets.

Reproducible isolated Linux evaluation:

```bash
mkdir -p /tmp/herdr-eval/bin /tmp/herdr-eval/home/config/herdr
curl -fsSL \
  https://github.com/ogulcancelik/herdr/releases/download/v0.7.5/herdr-linux-x86_64 \
  -o /tmp/herdr-eval/bin/herdr
chmod +x /tmp/herdr-eval/bin/herdr
cat >/tmp/herdr-eval/home/config/herdr/config.toml <<'EOF'
[update]
check = false
manifest_check = false

[notifications]
delivery = "off"
EOF
HOME=/tmp/herdr-eval/home \
XDG_CONFIG_HOME=/tmp/herdr-eval/home/config \
XDG_STATE_HOME=/tmp/herdr-eval/home/state \
HERDR_DISABLE_SOUND=1 \
  /tmp/herdr-eval/bin/herdr server
```

In another shell with the same environment:

```bash
herdr status server
herdr api snapshot
herdr server stop
rm -rf /tmp/herdr-eval
```

Observed startup reported `version: 0.7.5`, `protocol: 17`, and a Unix socket below the isolated config directory. Herdr uses a Unix-domain socket on Unix and a named pipe on Windows. It persists session state and logs under its config directory. The test did not require elevated privileges or a network service after downloading the binary.

## Supported-agent matrix

“Detected” and “authoritative lifecycle state” are different capabilities in Herdr.

| Beaver Buddy kind | Herdr detection at v0.7.5 | State authority | Evidence level | Consequence |
| --- | --- | --- | --- | --- |
| `claude-code` | Automatic process + screen manifest | Screen manifest; hook supplies session identity only | Officially documented; no live authenticated session tested here | Can produce Herdr states, but unfamiliar prompts may fall back to `idle` instead of `blocked`. |
| `codex` | Automatic process + screen manifest | Screen manifest; hook supplies session identity only | Officially documented; no live authenticated session tested here | Same limitation as Claude Code. |
| `pi` | Automatic; screen manifest fallback | Lifecycle hook when installed | Officially documented; synthetic socket lifecycle tested | Rich state is available only when the Herdr integration is installed and reporting. |
| `kimi-code` | Automatic; screen manifest fallback | Lifecycle hook when installed | Officially documented; synthetic socket lifecycle tested | Rich state is available only with the integration. |
| `opencode` | Automatic; screen manifest fallback | Lifecycle plugin when installed | Officially documented; synthetic socket lifecycle tested | Rich state is available only with the plugin. |
| `unknown` | Unsupported agents still run | None unless a custom integration reports state | Officially documented | Do not present unsupported processes as recognized agents. |

Herdr also officially lists OMP, GitHub Copilot CLI, Devin CLI, Hermes Agent, Qoder CLI, Droid, Kilo Code CLI, MastraCode, Cursor Agent CLI, Amp, Grok CLI, Antigravity CLI, Kiro CLI, and Maki. Gemini CLI and Cline are described as detected but less thoroughly tested. These do not currently need Beaver Buddy enum entries; preserve unknown labels without exposing them to the renderer until product support is approved.

## Observable states

Herdr's public state set is:

| Herdr state | Meaning | Safe Beaver Buddy normalization |
| --- | --- | --- |
| `working` | Agent is actively running. | `working` |
| `blocked` | Agent needs input, approval, or a decision. | `needs-attention` |
| `done` | Agent finished and has not been viewed yet. | `done` |
| `idle` | Agent is finished or waiting and has been seen. | `idle` |
| `unknown` | Herdr cannot classify confidently. | `unknown` |

Important semantics verified in the synthetic run:

- Reporting `idle` for an unfocused/unseen agent was surfaced by `agent list` and the event stream as `done`. “Done” therefore includes Herdr's attention/seen semantics; it is not a raw lifecycle report accepted by `pane report-agent`, whose CLI accepts only `idle`, `working`, `blocked`, and `unknown`.
- A focused agent can be `working` or `blocked`; focus is separate from lifecycle state.
- `question` is not in the v0.7.5 schema. Screen detection intentionally folds visible approvals, questions, and permission UI into `blocked`.
- For known screen-manifest agents, an unrecognized prompt falls back to `idle`, not `blocked`. This can miss attention requests until Herdr's manifest learns the screen shape.
- Herdr can update detection manifests from herdr.dev by default. Beaver Buddy's no-runtime-network invariant means deployment must document disabling `[update].manifest_check`, or the owner must explicitly approve this Herdr-side behavior. Beaver Buddy itself must never trigger the update command.

## Interface and experiment results

### Initial snapshot

`herdr api snapshot` returned an envelope containing `version`, `protocol`, focused resource IDs, workspaces, tabs, panes, layouts, and agents. Two synthetic panes appeared concurrently with distinct `pane_id` and `terminal_id` values. After reports, the agent records contained:

- `agent`
- `agent_status`
- `pane_id`, `tab_id`, `workspace_id`, `terminal_id`
- `focused`
- `state_change_seq`
- `cwd` and `foreground_cwd`

This is sufficient to bootstrap active instances, but it also proves that snapshots contain sensitive paths. The adapter must extract only approved fields and immediately discard the raw envelope.

### Event subscription

A newline-delimited JSON request over the local socket successfully subscribed to two panes:

```json
{"id":"sub","method":"events.subscribe","params":{"subscriptions":[{"type":"pane.agent_status_changed","pane_id":"w1:p1"},{"type":"pane.agent_status_changed","pane_id":"w2:p1"}]}}
```

The server acknowledged with `subscription_started`, then emitted independent events such as:

```json
{"data":{"agent":"claude","agent_status":"blocked","pane_id":"w1:p1","workspace_id":"w1"},"event":"pane.agent_status_changed"}
```

The tested status event did not include terminal output, prompts, cwd, usernames, or account identifiers. It also did not include a timestamp; Beaver Buddy must timestamp validated events when received.

### Ordering, duplicates, and concurrency

- Two workspaces and two agents were represented independently in one snapshot and one subscription.
- `state_change_seq` increased globally across observed state changes in agent records.
- Source reports support an optional per-source `seq`. Herdr documents that reports with a sequence less than or equal to the last accepted sequence are acknowledged but ignored, which protects hook updates from reordering.
- A reconnecting client must obtain a fresh `session.snapshot` and then resubscribe. The API documentation explicitly says snapshots are not subscriptions.
- The socket connection closing is observable by EOF/error. Treat all prior instances as stale and emit one `offline` reconciliation per instance only after a bounded reconnect attempt; do not keep displaying the last state indefinitely.
- Pane exit and close have dedicated events. A replacement pane must not inherit the old instance. `pane_id` is the correct runtime key within a server session; cold-session durability is neither required nor evidenced.

### Latency

Synthetic `pane report-agent` transitions produced subscription events immediately within the command round trip in this environment. No meaningful cross-platform or screen-manifest latency distribution was measured. WAVE-2 tests should assert ordering and bounded local delivery, but product copy must not promise a specific millisecond SLA until Windows and real-agent measurements exist.

## Privacy and security findings

1. **Local transport:** the API is a local Unix socket or Windows named pipe, not an HTTP service.
2. **Raw paths exist:** snapshot agent/pane records include `cwd` and `foreground_cwd`; process and read APIs expose still more sensitive material. The adapter must use a schema allowlist and never call pane/agent read or process-info methods.
3. **Events are safer:** the tested status event carried only agent label, status, and Herdr resource IDs. Validate every field and drop unknown keys before any logging or downstream delivery.
4. **No raw diagnostics:** never log raw socket lines, snapshot envelopes, Herdr log content, terminal titles, metadata tokens, messages, errors containing paths, or agent output.
5. **Local trust boundary:** any same-user process that can reach the Herdr socket may be able to report custom state. M3/P3 must define the security gate; M3/P1 should treat Herdr as a local advisory source, not an authenticated authority.
6. **Network behavior:** Herdr checks for updates and remote manifest updates by default. The isolated evaluation attempted an update check even with the tested config, and it failed harmlessly. This is external-tool behavior, but it conflicts with a strict “offline stack” expectation and requires an explicit setup requirement and verification.
7. **Windows is beta:** Windows uses descendant-process scanning instead of Unix foreground process-group detection. Real Windows tests at the supported Herdr version are mandatory before release acceptance.

## Unknowns and required follow-ups

- Real Claude Code/Codex screen transitions were not exercised, so prompt-shape accuracy and latency remain upstream claims rather than reproduced results.
- Real Pi/Kimi/OpenCode integrations were not installed because doing so would modify agent homes; their lifecycle authority is documented but not end-to-end reproduced here.
- Windows named-pipe discovery, ACL behavior, reconnects, and descendant-process detection need a clean Windows test fixture.
- Herdr's configuration semantics for fully suppressing every update check need confirmation; `[update].manifest_check = false` covers manifests, but the isolated server still logged an attempted binary update check.
- Named Herdr sessions have separate sockets. Cycle-1 should support the default session only unless the owner explicitly expands scope.
- The product must decide whether “agent used outside Herdr” is out of scope. Herdr cannot observe an arbitrary coding-agent terminal it does not manage.

