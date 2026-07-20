// Studio entry point: loads a rig, builds the PixiJS stage, and wires the UI
// (rig/animation selection, play loop, bake + save via serve.mjs). Runs only
// in the local dev browser — never shipped (ADR 003).

import { Application, Assets, Texture } from 'pixi.js';
import { recipesForRig } from './anims/index.js';
import { bakeRecipes, type BakedOutput } from './bake.js';
import type { AnimRecipe } from './keyframes.js';
import { applyPose, buildRigStage, type RigStage } from './puppet.js';
import { validateRig, type Rig } from './rig.js';

const STAGE_ZOOM = 4; // CSS-only magnification; backing store stays 1x.

function mustElement<T extends HTMLElement>(id: string, ctor: { new (...args: never[]): T }): T {
  const el = document.getElementById(id);
  if (!(el instanceof ctor)) {
    throw new Error(`missing #${id}`);
  }
  return el;
}

const rigSelect = mustElement('rig-select', HTMLSelectElement);
const animSelect = mustElement('anim-select', HTMLSelectElement);
const playButton = mustElement('play-button', HTMLButtonElement);
const bakeButton = mustElement('bake-button', HTMLButtonElement);
const statusEl = mustElement('status', HTMLDivElement);
const stageHost = mustElement('stage-host', HTMLDivElement);

function setStatus(message: string): void {
  statusEl.textContent = message;
}

interface Session {
  app: Application;
  rig: Rig;
  stage: RigStage;
  recipes: readonly AnimRecipe[];
}

let session: Session | null = null;
let playing = false;
let playTimeS = 0;

// The recipe currently selected in the UI (fallback: the rig's first recipe).
function selectedRecipe(): AnimRecipe | undefined {
  if (!session || session.recipes.length === 0) {
    return undefined;
  }
  return session.recipes.find((r) => r.name === animSelect.value) ?? session.recipes[0];
}

// Re-applies the selected animation's first frame. Runs when the animation
// changes while paused and after every bake, so a stale pose from another
// recipe never lingers on stage — the parachute canopy once stayed visible
// above the beaver because "bake & save" left the last parachute frame frozen.
function showRestPose(): void {
  const recipe = selectedRecipe();
  if (!session || !recipe) {
    return;
  }
  playTimeS = 0;
  applyPose(session.stage, session.rig, recipe, 0);
  session.app.render();
}

async function loadRig(rigName: string): Promise<void> {
  setStatus(`loading rig "${rigName}"…`);
  const response = await fetch(`/rigs/${rigName}.json`);
  if (!response.ok) {
    throw new Error(`failed to load rig ${rigName}: ${response.status}`);
  }
  const rig = (await response.json()) as Rig;
  const errors = validateRig(rig);
  if (errors.length > 0) {
    throw new Error(`invalid rig ${rigName}:\n${errors.join('\n')}`);
  }

  if (session) {
    session.app.destroy(true);
    session = null;
  }

  const app = new Application();
  try {
    await app.init({
      width: rig.tile,
      height: rig.tile,
      backgroundAlpha: 0,
      resolution: 1,
      antialias: false,
    });
    app.canvas.style.width = `${rig.tile * STAGE_ZOOM}px`;
    app.canvas.style.height = `${rig.tile * STAGE_ZOOM}px`;
    app.canvas.style.imageRendering = 'pixelated';
    stageHost.replaceChildren(app.canvas);

    const textures = new Map<string, Texture>();
    for (const part of rig.parts) {
      textures.set(part.id, await Assets.load(`/parts/${rig.name}/${part.src}`));
    }

    const stage = buildRigStage(rig, textures);
    app.stage.addChild(stage.root);
    session = { app, rig, stage, recipes: recipesForRig(rig.name) };
  } catch (error) {
    // Without this the half-initialized app (canvas + GPU textures) leaks on
    // every failed rig switch, because `session` only takes ownership at the
    // end of the happy path.
    app.destroy(true);
    throw error;
  }

  animSelect.replaceChildren();
  for (const recipe of session.recipes) {
    const option = document.createElement('option');
    option.value = recipe.name;
    option.textContent = recipe.name;
    animSelect.appendChild(option);
  }

  app.ticker.add((ticker) => {
    if (!playing || !session || session.recipes.length === 0) {
      return;
    }
    const recipe = session.recipes.find((r) => r.name === animSelect.value) ?? session.recipes[0];
    playTimeS = (playTimeS + ticker.deltaMS / 1000) % recipe.durationS;
    applyPose(session.stage, session.rig, recipe, playTimeS);
  });

  playing = false;
  playButton.textContent = 'play';
  const firstRecipe = session.recipes[0];
  if (firstRecipe) {
    applyPose(session.stage, session.rig, firstRecipe, 0);
  }
  setStatus(`rig "${rigName}" loaded — ${rig.parts.length} parts, ${session.recipes.length} recipes`);
}

async function bakeAndSave(): Promise<void> {
  if (!session) {
    return;
  }
  playing = false;
  playButton.textContent = 'play';
  setStatus('baking…');
  const output: BakedOutput = bakeRecipes(session.app, session.rig, session.stage, session.recipes);
  showRestPose();
  setStatus(`baked ${output.meta.rows.length} rows (${output.meta.sheetWidth}×${output.meta.sheetHeight}) — saving…`);

  const response = await fetch('/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: session.rig.name,
      sheet: output.sheetDataUrl,
      meta: output.meta,
      frames: output.frames,
    }),
  });
  if (!response.ok) {
    throw new Error(`save failed: ${response.status} ${await response.text()}`);
  }
  const result = (await response.json()) as { written: string[] };
  setStatus(`saved ${result.written.length} files under assets-src/baked/${session.rig.name}/`);
}

async function main(): Promise<void> {
  const rigs = (await (await fetch('/api/rigs')).json()) as string[];
  for (const rigName of rigs) {
    const option = document.createElement('option');
    option.value = rigName;
    option.textContent = rigName;
    rigSelect.appendChild(option);
  }
  rigSelect.addEventListener('change', () => {
    loadRig(rigSelect.value).catch((error: unknown) => setStatus(String(error)));
  });
  playButton.addEventListener('click', () => {
    playing = !playing;
    playButton.textContent = playing ? 'pause' : 'play';
  });
  animSelect.addEventListener('change', () => {
    // While playing, the ticker picks the new recipe up on the next tick;
    // while paused, the stage must be re-posed explicitly or the previous
    // animation's last frame (e.g. a visible parachute canopy) stays frozen.
    if (!playing) {
      showRestPose();
    }
  });
  bakeButton.addEventListener('click', () => {
    bakeAndSave().catch((error: unknown) => setStatus(String(error)));
  });
  if (rigs.length > 0) {
    await loadRig(rigs[0]);
  } else {
    setStatus('no rigs found under tools/puppet-studio/rigs/');
  }
}

main().catch((error: unknown) => setStatus(String(error)));
