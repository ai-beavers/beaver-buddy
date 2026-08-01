# PLAN — pi-agent Token-Counter Fix

> Datum: 2026-07-23 · Kontext: Aus NOTE.md Task „pi-agent token counter zeigt falsche Werte"
> & STATE.md Next-Step ② · Debug-Session für den generischen Parser, der pi-Sessions nicht korrekt parst.

---

## Root-Cause-Analyse

Pi speichert Sitzungsdaten in `~/.pi/agent/sessions/{project}/...jsonl`. Jede Zeile ist ein JSON-Objekt.
Assistant-Messages enthalten usage-Daten VERSCHACHTELT unter `message.usage` und das Model unter
`message.model`:

```json
{"type":"message","id":"e543b73e","timestamp":"2026-07-23T17:44:17.902Z","message":{
  "role":"assistant",
  "model":"deepseek-v4-pro",
  "usage":{"input":7216,"output":89,"cacheRead":0,"cacheWrite":0,"reasoning":19,"totalTokens":7305}
}}
```

Der generische Parser (`generic-parser.ts`) erwartet diese Felder jedoch auf TOP-LEVEL:

| Feld | Parser erwartet (top-level) | Pi liefert (nested) |
|---|---|---|
| `usage` | `record.usage` | `record.message.usage` |
| `model` | `record.model` / `record.modelName` | `record.message.model` |
| `cacheRead` (Feldname) | `cacheReadTokens` (u.a.) | `cacheRead` |
| `cacheWrite` (Feldname) | `cacheCreationTokens` (u.a.) | `cacheWrite` |

**Folge:** `findUsageObject()` findet weder usage-Objekt noch model → `parseJsonObject()` returned `[]`
für jede pi-Assistant-Message → **0 Tokens gezählt.** Damit erklärt sich der Bug vollständig.

Zusätzlich nutzt Pi das Feld `reasoning` (Reasoning-Tokens), das vom Parser nicht erfasst wird.
Das ist ein sekundärer Datenverlust — die Haupt-Tokenzahlen (input/output/cache) fehlen komplett.

---

## Fix-Strategie

### Schritt 1 — Generic-Parser erweitern (minimal-invasiv)

In `src/main/usage/generic-parser.ts`:

**1a) `findUsageObject` — nested `message`-Fallback ergänzen:**

```ts
function findUsageObject(value: unknown): { readonly usage: NormalizedUsage | null; readonly model: string | undefined } {
  if (!value || typeof value !== 'object') return { usage: null, model: undefined };
  const record = value as Record<string, unknown>;
  const message = record.message as Record<string, unknown> | undefined;

  const model =
    (typeof record.model === 'string' ? record.model : undefined) ??
    (typeof record.modelName === 'string' ? record.modelName : undefined) ??
    (typeof message?.model === 'string' ? message.model : undefined) ??
    (typeof message?.modelName === 'string' ? message.modelName : undefined);

  const usage =
    normalizeUsage(record.usage) ??
    normalizeUsage(record.token_usage) ??
    normalizeUsage(record.tokenUsage) ??
    normalizeUsage(message?.usage) ??
    normalizeUsage(message?.token_usage) ??
    normalizeUsage(message?.tokenUsage);

  return { usage, model };
}
```

- Top-Level hat Priorität (breaking-change-frei für Kimi, OpenCode)
- `message.*` nur als Fallback — keine Doppel-Erfassung

**1b) `normalizeUsage` — pi-Feldnamen ergänzen:**

- In `cacheRead`-Keys: `'cacheRead'` hinzufügen
- In `cacheCreation`-Keys: `'cacheWrite'` hinzufügen

### Schritt 2 — Tests

In `src/main/usage/generic-parser.test.ts`:

- **Neuer Test: „parst pi-agent nested message.usage mit model in message"**
  - JSONL-Zeile im Pi-Format (nested `message.usage`, `message.model`, Felder `input`/`output`/`cacheRead`/`cacheWrite`)
  - Assert: `inputTokens: 7216, outputTokens: 89, cacheReadTokens: 0, cacheWriteTokens → cacheCreationTokens: 0, model: 'deepseek-v4-pro'`
- **Neuer Test: „parst pi mit cacheRead > 0 korrekt ohne inputAlreadyFresh"**
  - Zweite Zeile mit `input:1490, cacheRead:7296` → Assert `inputTokens: 1490` (nicht `1490 - 7296 = -5806` — `inputAlreadyFresh` ist hier `false`, weil kein `input_other`/`inputOther` im Pi-usage-Objekt)
- **Bestehende Tests:** müssen weiter grün bleiben (Kimi, camelCase, modelName-Fallback)

### Schritt 3 — Manueller Verifikationstest

Nach Build + Start:
- Settings → Pi Agent aktivieren → Beaver Status prüfen
- `lastSeenByModel` sollte jetzt `deepseek-v4-pro` (oder ähnliche Pi-Modelle) mit Token-Zahlen enthalten
- XP sollte nach einem Refresh mit Pi-Tokens steigen (wo vorher 0 war)

### Schritt 4 — Reason-Tokens (optional, als Note)

Pi's `reasoning`-Feld wird aktuell nicht erfasst. Da `input` bei Pi bereits die reinen Input-Tokens
ohne Cache enthält und `totalTokens` = `input + output + cacheRead`, sind Reasoning-Tokens in
`input` enthalten und werden indirekt mitgezählt. Ein separates Reasoning-Feld im `UsageEntry` wäre
späteres Enhancement — jetzt reicht die korrekte Basis-Erfassung.

---

## Out of Scope

- Reasoning-Tokens als separates Feld im UsageEntry (späteres Enhancement)
- Dedizierter pi-parser.ts (over-engineered für diesen Fix — generischer Parser reicht)
- Token-Cursor im Profil / 24h-Start-Konzept (eigene Aufgabe)
- Settings-UI-Rework (Wave F2, wartet auf Owner-Transkript)

## Akzeptanzkriterien

- `parseGenericUsageFile` returned non-empty `UsageEntry[]` für pi-Session-JSONL-Dateien
- `model` ist korrekt gesetzt (z.B. `"deepseek-v4-pro"`)
- `inputTokens` / `outputTokens` / `cacheReadTokens` / `cacheCreationTokens` korrekt gemappt
- Bestehende Tests für Kimi/OpenCode/camelCase brechen nicht
- `typecheck` + `lint` + `test` grün
- Manuell: Pi-Tokens erscheinen im Beaver-Status und XP steigt

## Risiken

1. **OpenCode-Format unbekannt:** Falls OpenCode ebenfalls ein `message`-Wrapper nutzt, könnte
   der `message.*`-Fallback unbeabsichtigt greifen. Da aber Top-Level vorrang hat (`??`-Kette),
   wird existierendes Verhalten nicht verändert — nur Fälle, die vorher `null` returned haben,
   bekommen eine zweite Chance. Sicher.
2. **Pi `input` Semantik:** Pi's `input`-Feld enthält NUR frische Input-Tokens (ohne Cache).
   Das ist korrekt für `inputAlreadyFresh = false` → `input - cacheRead` würde doppelt abziehen.
   Aktuell ist `inputAlreadyFresh` false (kein `input_other`/`inputOther`), also `inputTokens = input - cacheRead`
   → `inputTokens = 7216 - 0 = 7216` ✅. ABER Fall mit cacheRead:
   `inputTokens = 1490 - 7296 = -5806` ❌. 
   **Lösung:** Pi-Nutzungsobjekte haben NICHT `input_other`/`inputOther`, also ist `inputAlreadyFresh`
   IMMER false. CacheRead wird via `Math.min(cacheRead, input)` gekappt. Bei Pi wäre das
   `Math.min(7296, 1490) = 1490` — das ist falsch, weil Pi's `input` bereits netto ist.
   
   **Korrektur:** Für Pi müsste `inputAlreadyFresh = true` sein. Das erkennen wir daran,
   dass das usage-Objekt das Feld `totalTokens` enthält (Pi-spezifisch) oder dass es kein
   `input_other`/`inputOther` aber dafür `cacheRead`/`cacheWrite` (nicht die langen Varianten) hat.
   
   **Einfachste Lösung:** `inputAlreadyFresh` auch auf `true` setzen, wenn das usage-Objekt
   die kurzen Feldnamen `cacheRead` oder `cacheWrite` enthält (Pi-Indikator).
   
   ODER noch einfacher: `inputAlreadyFresh` generell auf `true` setzen, wenn
   `input` verwendet wird (wie Pi es tut), denn `input` ist ein generischer Name und könnte
   je nach Quelle Netto- oder Brutto-Input sein. Das ist riskant für andere Quellen.
   
   **Sicherste Lösung:** Pi-Indikator: `'cacheRead' in record || 'cacheWrite' in record` → `inputAlreadyFresh = true`.
   
   Das implementieren wir in `normalizeUsage`.

3. **Felder-Priorität:** `record.message?.usage` hat niedrigste Priorität — falls Kimi oder OpenCode
   jemals ein `message`-Wrapper-Objekt OHNE top-level usage bekommen, würden deren Werte plötzlich
   geparst. Unwahrscheinlich und selbst dann korrekt (besser als 0).
