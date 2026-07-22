# XP/Level Model — Detail Spec (M4/P2)

> Owner decision 2026-07-21: **XP and lifetime remain separate for now.**
> Main logic: **XP points → level** (level N from X XP). Lifetime is tracked separately
> and can later be converted into an additional XP source (conversion ≠ V1).

## 1. XP Sources

| Source | V1 (C1) | Later |
|---|---|---|
| **Tokens** (input + output, **without cache**, per model, daily-aggregated from M4/P1) | ✅ only XP source, **weighted by model intelligence** (see §1a) | Re-weighting on leaderboard updates |
| **Lifetime** (visible screen time + total lifetime) | ❌ tracking only, no XP | Conversion rule (e.g. X XP per active hour) — separate owner decision |

**XP constant (initial):** `XP_PER_1K_TOKENS = 5` → 5 XP per 1,000 tokens, multiplied
by the model weight.

> **Important (owner 2026-07-21): Only real input and output tokens count. NO cache —
> neither cache creation nor cache read nor anything similar.**
> This changes the order of magnitude significantly: cache shares typically make up
> 80–95% of total consumption in agent logs. The reference calculation is therefore
> based on **~400k real input+output tokens/day** (heavy user), not on millions:
> 400k ÷ 1,000 × 5 XP × weight ~1.0 = **2,000 XP/day** → L32 on day 60.

→ **Calibration:** after 1 week of real M4/P1 data, adjust `XP_PER_1K_TOKENS` so that
an active reference user reaches level 32 in ~60 days (meeting target "2 months").
The curve shape is unaffected.

## 1a. Model weighting via Artificial Analysis Intelligence Index (owner decision 2026-07-21)

> **Principle: it is not the token price that counts, but the intelligence of the model.**
> Tokens from a smarter model are worth more XP. Source of the index values:
> <https://artificialanalysis.ai/models#intelligence>

**Formula (final, owner decision 2026-07-21: γ = 2):**
```
weight[model]      = (intelligenceIndex[model] / REFERENCE_INDEX)^2
XP_per_1k[model]   = XP_PER_1K_TOKENS × weight[model]   (clamped to 0.5–2.0)
```
- `REFERENCE_INDEX` = median of the supported models → midfield model ≈ 1.0× XP.
- **γ = 2 (quadratic, owner's choice):** smart models are rewarded disproportionately
  (top ≈ 1.78×), an incentive for quality. `γ` remains a data field → adjustable later
  without code.
- **Clamp 0.5–2.0:** models below index ~32 land on the 0.5 floor (deliberately
  accepted); no model yields "nothing". Reviewed during calibration.
- Cache tokens (creation + read) are always excluded (applies per model).

**Data storage:** The index values live as a **data table in the character map (M4/P4)**
(`models: { name, intelligenceIndex, weight }`) — updating the values = data change,
no code change. We update the table on major leaderboard releases.

**Seed data (as of 2026-07-21, owner screenshot, <https://artificialanalysis.ai/models#intelligence>):**
`REFERENCE_INDEX = 45` (median of the 26 listed models) · `weight = (index/45)²` (**γ=2**), clamp 0.5–2.0

| Model | Index | Weight | | Model | Index | Weight |
|---|---|---|---|---|---|---|
| Claude Fable 5 (w. fallback) | 60 | **1,78** | | MiniMax-M3 | 44 | 0,96 |
| GPT-5.6 Sol (max) | 59 | **1,72** | | DeepSeek V4 Pro (max) | 44 | 0,96 |
| Kimi K3 | 57 | **1,61** | | MiMo-V2.5-Pro | 42 | 0,87 |
| Claude Opus 4.8 (max) | 56 | **1,55** | | Inkling | 41 | 0,83 |
| GPT-5.6 Terra (max) | 55 | **1,49** | | DeepSeek V4 Flash (max) | 40 | 0,79 |
| Grok 4.5 (high) | 54 | **1,44** | | Nemotron 3 Ultra | 38 | 0,71 |
| Claude Sonnet 5 (max) | 53 | **1,39** | | Gemini 3.5 Flash-Lite | 36 | 0,64 |
| GPT-5.6 Luna (max) | 51 | 1,28 | | Mistral Medium 3.5 | 30 | 0,44 → **0,50** (floor) |
| GLM-5.2 (max) | 51 | 1,28 | | Claude 4.5 Haiku | 30 | 0,44 → **0,50** (floor) |
| Muse Spark 1.1 (xhigh) | 51 | 1,28 | | Gemma 4 31B | 29 | 0,42 → **0,50** (floor) |
| Gemini 3.6 Flash | 50 | 1,23 | | gpt-oss-120b (high) | 24 | 0,28 → **0,50** (floor) |
| Gemini 3.1 Pro Preview | 46 | 1,05 | | Command A+ | 23 | 0,26 → **0,50** (floor) |
| Qwen3.7 Max | 46 | 1,05 | | K2 Think V2 | 17 | 0,14 → **0,50** (floor) |

- **Effect (γ=2):** the top model earns ~3.6× as much XP per token as a floor model;
  midfield (index ~45) stays ~1.0×. Models below index ~32 sit on the floor.
- Mapping log model name → table model in M4/P1; unknown models = 1.0 (neutral).
- Maintenance: update the table on leaderboard updates (task in NOTE.md).

## 1b. Token data source: TokScale logic (owner decision 2026-07-21, corrected)

> We use **TokScale's logic** — i.e. its approach to **finding and reading the locally
> stored token logs** — as the template for our own calculation. **No TokScale as a
> tool/dependency in the app**; M4/P1 implements its own reader that uses the same log
> paths/formats. Since TokScale's fetch logic can be adopted 1:1, this applies to
> **all coding-agent harnesses: Claude Code, Codex, pi and others**
> (owner decision 2026-07-21).

- Task in M4/P1: analyze the TokScale approach (where are the logs? what format?
  how are models distinguished?) → own reader: log files → daily aggregate per model
  (date, model, input, output tokens, without cache).
- Advantage: no external runtime dependency, full format understanding in our own
  code, testable against fixture logs.

## 2. Level Curve

- **Shape:** cumulative quadratic — early levels fast (engagement, meeting 01:13:51), increasingly expensive later.
- **Formula:** `cumXP(L) = round(TOTAL × L² / 32²)` with `TOTAL = 120.000 XP` (reference: ~400k real input+output tokens/day × 5 XP/1k ≈ 2,000 XP/day → L32 on day 60).
- **Implementation:** table (below) as data, not as a formula in code → recalibratable at any time without logic changes.

## 3. Level Table (V1 proposal, calibratable)

| Level | cum. XP | ≈ Day* | Stage | Unlock |
|---|---|---|---|---|
| 1 | 0 | 0 | 🍼 Baby | Start (naming) |
| 2 | 469 | <1 | Baby | |
| 3 | 1.055 | <1 | Baby | |
| 4 | 1.875 | 1 | Baby | |
| 5 | 2.930 | 1,5 | 🐣 **young baby** | Evolution Baby→young baby |
| 6 | 4.219 | 2 | young baby | |
| 7 | 5.742 | 3 | young baby | |
| 8 | 7.500 | 4 | young baby | **First interactions** (meeting: "from level 8") |
| 9 | 9.492 | 5 | 🧒 **teen** | Evolution → teen |
| 10 | 11.719 | 6 | teen | |
| 11 | 14.180 | 7 | teen | |
| 12 | 16.875 | 8 | teen | |
| 13 | 19.805 | 10 | teen | |
| 14 | 22.969 | 11 | teen | |
| 15 | 26.367 | 13 | teen | |
| 16 | 30.000 | 15 | teen | End of "Phase 1" (meeting: 1–16) |
| 17 | 33.867 | 17 | 🧑 **older teen** | Evolution |
| 18 | 37.969 | 19 | older teen | |
| 20 | 46.875 | 23 | older teen | |
| 22 | 56.719 | 28 | older teen | |
| 24 | 67.500 | 34 | older teen | |
| 25 | 73.242 | 37 | 🦫 **adult** | Evolution → final stage |
| 26 | 79.219 | 40 | adult | |
| 28 | 91.875 | 46 | adult | |
| 30 | 105.469 | 53 | adult | |
| 31 | 112.617 | 56 | adult | |
| 32 | 120.000 | 60 | adult | **Cap** → Prestige (post-C1) |

\* Reference user 2,000 XP/day (≈ 400k real input+output tokens/day, cache excluded); the full table (every level) is maintained as JSON in the character map (M4/P4).

## 4. Stage Mapping (5 life stages — owner decision 2026-07-21)

- **Baby:** levels 1–4 · **young baby:** 5–8 · **teen:** 9–16 ·
  **older teen:** 17–24 · **adult:** 25–32
- Rationale: the meeting's "levels 1–16 = development stage Baby→Teen" is preserved;
  interactions from L8 coincide with the young baby→teen transition; the two
  additional stages provide more visible progress moments (4 evolutions instead of 2).
- Stage boundaries are owner-adjustable — they live in the character map, not in code.
- **Asset consequence (M5):** **5 stage sprite sets** are needed; existing: baby ✅,
  teen ✅, adult only as placeholder ⚠️. **To be built: young baby, older teen,
  adult (final)** → M5/P12 becomes the stage art package; C1 classification: adult art
  at the latest by the time users reach L25 (~day 37 for the reference user) → pull
  into C1 scope.

## 5. Lifetime Tracking (separate, V1)

- Two counters in the profile (M4/P3): `screenVisibleSeconds` (beaver visible) + `lifetimeSeconds` (total).
- Used for achievements (7/30 days) — **no XP conversion in V1**.
- Schema reserves `lifetimeXpRule: null` → later conversion without migration.

## 6. Level-Up Events

- `level:up` event (new level, stage change yes/no) → animation/quip from M5 or evolution flash.
- Unlocks are read from the character map (no hardcoded level switch).

## Open Calibration Points (after M4/P1 data)
1. Set `XP_PER_1K_TOKENS` (initial 5) against real daily volumes of **real input+output
   tokens** (filter out cache shares — they are the largest part of the raw logs!).
2. Check `TOTAL` (60-day target).
3. ~~Pull intelligence index values live~~ ✅ seed table added (screenshot
   2026-07-21, 26 models, REF = 45). Remaining: mapping log model name → table model
   in M4/P1 + periodic maintenance (NOTE.md).
