# Animation Authoring

How we create new character animations and stage variants for Beaver Buddy.

This is a **contributor / coding-agent** guide. End-users do not generate
assets; the app consumes baked PNG sprite sheets produced by this build-time
pipeline.

## Pipeline at a glance

1. **Generate parts** in ComfyUI (Comfy Cloud) — one run per character/stage
   using the `PixelArt Parts Builder` workflow.
2. **Rig** the parts in `tools/puppet-studio/rigs/<name>.json` — pivot,
   rest position, z-order, parent.
3. **Write recipes** in `tools/puppet-studio/anims/*.ts` — pure keyframe data.
4. **Bake** at 8 fps into 96×96 tiles, matching the app sheet format
   (`sheet.png` + `sheet.json`).
5. **Review & intake** into `assets/sprites/` after the design gate and
   [`assets/STYLE.md`](../assets/STYLE.md).

Details:

- ComfyUI workflow inventory: [`docs/comfyui-avatar-generation.md`](comfyui-avatar-generation.md)
- Puppet studio usage: [`tools/puppet-studio/README.md`](../tools/puppet-studio/README.md)
- ADR: [`docs/adr/003-pixijs-authoring.md`](adr/003-pixijs-authoring.md)

## Prerequisites

- macOS 14+ or Windows 10/11
- Node 24.x (see `README.md`)
- Repo clone + `npm ci`

All commands below use POSIX-style paths; on Windows use PowerShell and adjust
slashes where appropriate.

## Tool 1: ComfyUI / Comfy Cloud

Primary path is Comfy Cloud (no local ComfyUI install required). The parts
workflow is the `PixelArt Parts Builder` template; see
[`docs/comfyui-avatar-generation.md`](comfyui-avatar-generation.md) for the
workflow inventory and parameters.

### Comfy Cloud MCP setup

The Comfy Cloud MCP gives agents/clients access to model search, template
search, and workflow execution.

**Claude Code plugin (recommended for Claude Code):**

```text
/plugin marketplace add Comfy-Org/comfy-skills
/plugin install comfy-cloud@comfy-skills
/mcp
```

Then complete OAuth sign-in in the `/mcp` prompt.

**Other clients (Kimi, Codex, pi, Claude Desktop, etc.):**

Use the hosted MCP server at `https://cloud.comfy.org/mcp` with OAuth. Follow
the official client-specific configuration at
https://docs.comfy.org/cloud/mcp — do **not** invent client-specific JSON
here.

### Useful comfy-skills commands

Namespaced commands provided by the plugin include:

- `/comfy-cloud:generate-image`, `/comfy-cloud:generate-video`,
  `/comfy-cloud:generate-audio`, `/comfy-cloud:generate-3d`
- `/comfy-cloud:search-models`, `/comfy-cloud:search-templates`
- `/comfy-cloud:remove-background`, `/comfy-cloud:upscale-image`
- `/comfy-cloud:help`

Run `/comfy-cloud:help` for the current list.

### Local ComfyUI alternative

You can run a self-hosted ComfyUI instead of Comfy Cloud; adapt the workflow
JSON and output paths accordingly. This repo does not document a full local
install.

## Tool 2: PixiJS Puppet Studio

The dev-time studio rigs the ComfyUI parts and bakes animations.

```bash
npm run studio              # http://localhost:8377/
npm run studio:parts        # regenerate placeholder parts (optional)
```

With real ComfyUI parts:

```bash
node tools/puppet-studio/ingest-parts.mjs <runDir> <rigName>
# e.g. node tools/puppet-studio/ingest-parts.mjs \
#        assets-src/comfyui/parts-run-1 beaver-baby
```

Open the studio, pick a rig + animation, preview, then **bake & save** to
`assets-src/baked/<rig>/`. Review the frames and contact sheet, then copy the
approved output to `assets/sprites/<name>.png` and `.json`.

Full docs: [`tools/puppet-studio/README.md`](../tools/puppet-studio/README.md).

## For coding agents

- Load PixiJS skills from the repo first: start with the routing skill
  `.agents/skills/pixijs/SKILL.md`, then follow the topic skill it routes to.
- Comfy Cloud skills come from the `comfy-cloud@comfy-skills` plugin
  (setup above).
- PixiJS is **dev-time only** — see
  [ADR 003](adr/003-pixijs-authoring.md). Never import `pixi.js` under `src/`.
- Guardrails:
  - No API keys, secrets, or `.env` files in the repo.
  - Generated assets enter the repo only as PNG files.
  - Every new asset must pass the design gate and follow
    [`assets/STYLE.md`](../assets/STYLE.md).

## Further reading

- [ComfyUI parts pipeline](comfyui-avatar-generation.md)
- [Puppet studio README](../tools/puppet-studio/README.md)
- [ADR 003: PixiJS dev-time only](adr/003-pixijs-authoring.md)
- [Sprite style guide](../assets/STYLE.md)
- [Docs index](README.md)
