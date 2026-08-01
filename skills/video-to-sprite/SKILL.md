---
name: video-to-sprite
description: "Use this skill to regenerate an existing beaver-adult sprite row from an AI-generated loop video instead of static frame-by-frame ComfyUI art. Covers the full pipeline: reference-canvas compositing, Seedance 2.0 first-last-frame video generation via Comfy Cloud MCP, mandatory video-preview approval, frame extraction, and baking into a reviewable sprite sheet. Triggers on: video-to-sprite, generate animation from video, Seedance sprite row, regenerate a sprite row from video, video loop to sprite sheet, ByteDance2FirstLastFrameNode."
license: MIT
---

Regenerates one row of `assets/sprites/beaver-adult.png` by turning its
existing frame 0 into a short looping video (Seedance 2.0 via Comfy Cloud),
then sampling the video back down onto the original 96x96 art grid. This
recovers clean in-between motion without hand-drawing every frame — proven
end-to-end for the `brainrot` row.

**Scope:** adult stage only, 96px-tall rows only, and only rows that already
exist in `assets/sprites/beaver-adult.json` with a committed frame 0 (the loop
anchor). Any row whose JSON entry carries a custom `"height"` (currently
`parachute-wind`, `exercise`, `toilet`) is a non-96px row — unsupported, the
bake script errors on it. Adding a brand-new row with no committed anchor
frame is out of scope; that needs a first frame from the existing ComfyUI
still-image pipeline before this skill can touch it (see
`docs/dev-guardrails.md` "ComfyUI sprite generation").

## Pipeline

### 1. Inputs

Get from the user: a description of the desired beaver behavior, and the
target row name. Confirm the row exists in `assets/sprites/beaver-adult.json`
and is not one of the 128px rows above.

Every scratch file of the run — reference canvas, downloaded mp4, strips,
preview GIFs — lives under `tmp/<rowName>-video/` (gitignored at the repo
root). Never write the upload command or its bearer token into a file, there
or anywhere: a public repo plus one careless `git add .` is how tokens leak.

### 2. Build the reference canvas (ffmpeg)

The video model needs a first/last frame image at a fixed, known scale and
position so the baked output can be sampled back onto the exact art grid.
These constants are exported from `scripts/gen-sprites/ingest-video-frames.mjs`
as `CANVAS`, `SPRITE_SCALE`, `OFFSET` — the ffmpeg command below MUST use the
same numbers; if you change one, change it in both places.

Compute the row's y-offset in the sheet PNG by summing the `height` (default
`TILE` = 96, from `ingest-images.mjs`) of every row listed before it in
`beaver-adult.json`'s `rows` array:

```bash
node -e "const j=require('./assets/sprites/beaver-adult.json');let y=0;for(const r of j.rows){if(r.name===process.argv[1])break;y+=r.height??j.tile}console.log(y)" <rowName>
```

Example from the proven session: the `brainrot` row sits at y=1408.

```bash
ffmpeg -y -f lavfi -i color=c=0x00FF00:s=1080x1080 \
  -i assets/sprites/beaver-adult.png \
  -filter_complex "[1:v]crop=96:96:0:<rowY>,scale=960:960:flags=neighbor[spr];[0:v][spr]overlay=60:60:format=auto" \
  -frames:v 1 tmp/<rowName>-video/ref-green.png
```

`s=1080x1080` is `CANVAS`, `scale=960:960` is 96 * `SPRITE_SCALE` (10x
nearest-neighbor upscale — `flags=neighbor` keeps pixel art crisp), and
`overlay=60:60` is `OFFSET`. `0:00FF00` is the chroma-key green the bake step
keys back out.

### 3. Generate

Submitting a Comfy job spends real Comfy Cloud credits. Invoking this skill
IS the user's spend consent (owner decision, 2026-08-01): the user knows
generation costs credits, so do not ask a separate yes/no before submitting —
pass `confirm: true` to the spend-gated submit tool on the strength of the
skill invocation. This consent covers the generations needed within the
invocation, including regenerations after a rejected preview.

1. `mcp__comfy__upload_file` on `ref-green.png` — it returns a curl command;
   run it to actually upload. The embedded bearer token lives ~15 minutes:
   run the command immediately in the same step, never save it to a script
   or defer it. On HTTP 401, don't debug — call `upload_file` again for a
   fresh command and rerun. The success JSON's `name` field may be a hashed
   filename, not the name you sent — always use the returned `name` verbatim
   in the `LoadImage` nodes below.
2. Submit the `api_seedance2_0_flf2v` template in API format with a
   `ByteDance2FirstLastFrameNode`. The dotted names below (`model.prompt`,
   `model.resolution`, …) are **literal flat JSON keys** — Comfy's
   dynamic-combo convention — not a nested `model` object:

   ```json
   {
     "1": {
       "class_type": "ByteDance2FirstLastFrameNode",
       "inputs": {
         "model": "Seedance 2.0",
         "model.prompt": "<user's described behavior>, completely static camera, no zoom, no pan, flat solid uniform chroma-key green background (#00FF00), no shadows, no floor, keep the exact pixel-art style, colors, thick dark outlines and proportions of the input image unchanged, seamless loop: ends in exactly the same pose as the first frame",
         "model.resolution": "720p",
         "model.ratio": "1:1",
         "model.duration": 5,
         "model.generate_audio": false,
         "seed": 0,
         "watermark": false,
         "first_frame": ["3", 0],
         "last_frame": ["4", 0]
       }
     },
     "3": { "class_type": "LoadImage", "inputs": { "image": "ref-green.png" } },
     "4": { "class_type": "LoadImage", "inputs": { "image": "ref-green.png" } },
     "2": { "class_type": "SaveVideo", "inputs": { "video": ["1", 0] } }
   }
   ```

   `watermark` is a top-level required input of the node itself, not nested
   under `model`. Nodes `3` and `4` (`LoadImage`) both load the **same**
   uploaded filename — that's what makes the video loop back to the exact
   starting pose. Use a real random `seed` per submission, not a fixed `0`.
3. Poll with `mcp__comfy__wait_for_job` / `mcp__comfy__get_output`.

### 4. HARD GATE #1 — MANDATORY VIDEO CHECKPOINT (never skip)

Before any further processing:

1. Download the resulting mp4 to `tmp/<rowName>-video/output.mp4`.
2. Probe the frame count (see step 5), pick 5 evenly spaced indices across
   it (e.g. `0, N/4, N/2, 3N/4, N-1`, rounded), and render exactly those into
   one strip — the `select` expression and `tile` filter must agree on the
   count:
   ```bash
   ffmpeg -y -i output.mp4 \
     -vf "select='eq(n\,0)+eq(n\,30)+eq(n\,60)+eq(n\,90)+eq(n\,120)',tile=5x1,format=rgba" \
     -vsync vfr -frames:v 1 strip.png
   ```
   (replace the 5 indices with the ones computed for the actual frame count.)
3. Show the strip to the user AND open the video itself
   (`open tmp/<rowName>-video/output.mp4`; suggest loop playback, Cmd+L in
   QuickTime) — motion is judged from the playing video, the strip alone
   is not enough. Then STOP. Get explicit approval before extracting
   frames or baking anything.
4. If rejected: iterate on the prompt and regenerate (no separate spend
   approval needed — the skill invocation covers it). Never bake a rejected
   video.

### 5. Extract loop frames

Probe the frame count first — Seedance's exact output count varies run to
run, so never hard-code an index list:

```bash
ffprobe -v error -select_streams v:0 -count_frames \
  -show_entries stream=nb_read_frames -of csv=p=0 output.mp4
```

The video's last frame duplicates its first frame (that's the loop), so with
`N` total frames use `index_i = floor(i * (N - 1) / 8)` for `i = 0..7` — a
single rounding at the end, not a pre-rounded per-step spacing, which drifts
when `N` isn't of the form `8k + 1`. Example from the proven session: `N=121`
gives indices `0,15,30,45,60,75,90,105`.

Tile the 8 frames into a 4x2 grid and force RGBA output — the repo's PNG
decoder rejects plain RGB:

```bash
ffmpeg -y -i output.mp4 \
  -vf "select='eq(n\,0)+eq(n\,15)+eq(n\,30)+eq(n\,45)+eq(n\,60)+eq(n\,75)+eq(n\,90)+eq(n\,105)',tile=4x2,format=rgba" \
  -vsync vfr -frames:v 1 -pix_fmt rgba \
  assets-src/comfyui/<rowName>-video/sheet.png
```

Replace the `eq(n\,...)` list with the indices actually computed above.
`assets-src/comfyui/` is gitignored — this is a raw working dump, not a
committed asset.

### 6. Bake

```bash
node scripts/gen-sprites/ingest-video-frames.mjs <rowName> [<rowName>-video]
```

Writes `assets-src/baked/<rowName>-video/sheet.png` + `sheet.json` — never
touches `assets/sprites/` directly. The script samples each video grid cell
back onto the 96x96 art grid using the same `CANVAS` / `SPRITE_SCALE` /
`OFFSET` constants from step 2, snaps colors to the committed row's palette,
normalizes the outline, and grounds every frame. Frame 0's art always comes
from the committed anchor tile, never the video — but the anchor is first
stripped of legacy green edge fringe (`dropGreenFringe`) and run through the
same palette/outline/ground finishing, so pre-existing chroma spill on the
committed row (or a green-polluted palette harvested from it) can't re-ship. It errors clearly on an
unknown row name, a 128px-tall row, or a missing grid sheet — read the error
rather than retrying blindly.

### 7. Design gate, then HARD GATE #2 — never promote without a fresh yes

Render a preview GIF of the baked row and a side-by-side strip comparing it
against the currently-committed row, and show both to the user:

```bash
R=tmp/<rowName>-video   # <rowY> = the row y-offset computed in step 2
ffmpeg -y -i assets-src/baked/<rowName>-video/sheet.png -vf "crop=768:96:0:<rowY>" $R/baked-row.png
ffmpeg -y -i assets/sprites/beaver-adult.png -vf "crop=768:96:0:<rowY>" $R/committed-row.png
ffmpeg -y -i $R/committed-row.png -i $R/baked-row.png \
  -filter_complex "[0][1]vstack,scale=iw*3:ih*3:flags=neighbor" $R/compare.png
ffmpeg -y -i $R/baked-row.png \
  -vf "untile=8x1,setpts=N/8/TB,scale=iw*3:ih*3:flags=neighbor" $R/preview.gif
```

`compare.png` stacks committed (top) over baked (bottom) at 3x
nearest-neighbor. `preview.gif` plays the 8 baked frames at 8 fps
(`setpts=N/8/TB`); open it in a browser (`open -a Safari …`) — macOS
Preview shows GIF frames as static pages instead of animating.

Promotion — copying the baked `sheet.png`/`sheet.json` over
`assets/sprites/beaver-adult.*` — MUST NOT happen automatically. Never copy
`assets-src/baked/` output over `assets/sprites/` without a fresh, explicit
user yes on the specific baked result just shown, per this repo's asset
review rules (`assets/STYLE.md`). If the user hasn't said yes to promotion,
stop after showing the preview.

## Known limitations

- **Quality ceiling:** Seedance re-renders the reference frame rather than
  copying it pixel-for-pixel, and its 720p source is soft — expect color
  drift and edge fuzz even after palette-snapping and outline normalization.
  4k-resolution generation is the known next lever to try if quality needs to
  improve; it is not implemented here.
- **New rows without a committed anchor** are not supported — this pipeline
  regenerates existing rows only. Adding a genuinely new animation row still
  needs a first still frame from the standard ComfyUI still-image pipeline.
- **Non-96px rows** (any row whose JSON entry sets a custom `"height"` —
  currently `parachute-wind`, `exercise`, `toilet`) are unsupported; the
  reference-canvas math assumes a square 96px tile.
- The video-checkpoint gate and the promotion gate are
  **prose gates** — nothing in the code stops a submission, a bake, or a
  promotion from happening without approval. Obey them anyway; this is repo
  precedent for other spend-gated and design-gated tools.
- **Green art breaks the chroma key:** this pipeline only works for sprites
  without green in the art itself — a beaver holding something green would
  get eaten by the same key that removes the background.
- **Airborne poses get flattened:** every baked frame is grounded to the tile
  bottom (matches the committed grid pipeline's convention), so a hop or
  jump mid-air in the source video collapses onto the ground line in the
  baked sheet — by design, not a bug.
- **Always re-extract before baking:** the bake script trusts whatever
  `sheet.png` is sitting in the gitignored `assets-src/comfyui/<row>-video/`
  dump directory. Re-run frame extraction fresh for every generation attempt
  — never bake against a stale sheet left over from a previous run.
