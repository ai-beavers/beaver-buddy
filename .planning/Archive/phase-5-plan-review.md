# Kritisches Review: Phase-5-Plan (`phase-5-plan.md`)

**Review-Agent:** Kimi Code CLI  
**Datum:** 2026-07-15  
**Geprüfter Plan:** `.flightplan/Archive/phase-5-plan.md`  
**Basis:** `.flightplan/Archive/WINDOWS_PORT_PLAN.md`, Stand 2026-07-15  
**Validierte Quelldateien:**
- `src/main/mrr/keychain.ts`
- `src/main/mrr/keychain.test.ts`
- `src/main/mrr/mrr-config.ts`
- `src/main/mrr/redact.ts`
- `src/main/atomic-file.ts`
- `src/main/usage/paths.ts`

---

## 1. Zusammenfassung des geprüften Plans

Der Phase-5-Plan dokumentiert korrekt, dass es sich um eine **Dokumentations- und Recherchephase** ohne Source-Änderungen handelt. Die drei zurückgestellten Build-Items (BL-WIN-6 Secret-Store, BL-WIN-7 atomares Schreiben, Codex-Tracking) werden mit ihren externen Blockern (Administrator-Entscheidung, Recherche) erfasst, und die App wird als auf Windows voll funktionsfähig beschrieben.

Die Struktur ist verständlich: pro Item Status, Begründung, Optionen, nächste Schritte und Akzeptanzkriterien. Die Risiken und die empfohlene Reihenfolge sind grundsätzlich nachvollziehbar.

**Kernproblem:** Der Plan enthält mehrere **technische Ungenauigkeiten und Lücken**, die einen Implementierungs-Agenten in die Irre führen oder zu unzulänglichen Lösungen führen können. Besonders bei BL-WIN-6 und BL-WIN-7 sind die vorgeschlagenen Ansätze teils unpräzise, teils technisch problematisch.

---

## 2. Gefundene Probleme / Lücken / Fehler

### BL-WIN-6: Windows Secret-Store / MRR-Mode

#### 2.1 `cmdkey.exe` als Leselösung ist praktisch unbrauchbar *(Schwere: Hoch)*

Der Plan nennt unter Option A (`src/main/mrr/keychain.ts` / `keychain-win32.ts`) drei Varianten für den Windows Credential Manager:

- PowerShell `CredentialManager`-Modul
- `cmdkey.exe` zum Schreiben, „Lesen allerdings eingeschränkt"
- Kleiner Native-Addon mit `CredWriteW` / `CredReadW` / `CredDeleteW`

**Kritik:** „Eingeschränkt" trifft es nicht. `cmdkey.exe` kann **keine** generischen Credentials lesen, die über die Win32-Credential-API geschrieben wurden. Es verwaltet ausschließlich Anmeldeinformationen für Netzwerkressourcen (z. B. Remote-Desktops, UNC-Pfade). Eine Leseoperation via `cmdkey /list` zeigt nur diese Netzwerk-Credentials an, nicht die generischen Credentials, die ein Credential-Manager-Adapter bräuchte. Die Planung suggeriert fälschlich, `cmdkey.exe` sei eine halbwegs brauchbare Option.

**Empfohlene Korrektur:** `cmdkey.exe` entweder ganz streichen oder als „nicht für generische Credentials geeignet" kennzeichnen. Für Option A bleiben nur:

- PowerShell-CredentialManager-Modul (fragil, nicht standardmäßig installiert)
- Native Addon mit `CredWriteW` / `CredReadW` / `CredDeleteW`

#### 2.2 PowerShell-CredentialManager-Modul ist keine seriöse Default-Lösung *(Schwere: Hoch)*

Der Plan nennt das PowerShell-Modul `CredentialManager` als erste Unteroption. Das Modul ist **nicht standardmäßig in Windows installiert**; es muss aus dem PSGallery nachinstalliert werden. Das würde bedeuten, dass die App auf einem frischen Windows-System nicht funktioniert, bis der Nutzer oder ein Installer ein PowerShell-Modul installiert. Für einen MRR-Mode, der für Endnutzer funktionieren soll, ist das inakzeptabel.

**Empfohlene Korrektur:** Das PowerShell-Modul als „nur für lokale Entwickler-POCs geeignet, nicht für Shipping" markieren.

#### 2.3 Native Addon widerspricht `CLAUDE.md`-Dependency-Richtlinie *(Schwere: Mittel-Hoch)*

Der Plan erwähnt zwar, dass ein Native-Addon ggf. gegen `CLAUDE.md`-Restriktionen verstößt, behandelt es aber dennoch als ernsthafte Option. Ein `node-gyp`-basiertes Addon würde:

- Build-Komplexität auf Windows, macOS und Linux erhöhen (auch wenn nur Windows Ziel ist, muss es in der CI überall bauen oder vorkompilierte Binaries verteilt werden)
- Lizenz- und Sicherheitsreview erfordern
- Electron-Version-Upgrades erschweren (ABI-Abhängigkeit)

**Empfohlene Korrektur:** Option A als „nur mit Administrator-Entscheidung und explizitem ADR zu neuen Native-Dependencies" kennzeichnen.

#### 2.4 `electron.safeStorage` erfordert Ready-State-Berücksichtigung *(Schwere: Mittel)*

Option B (`electron.safeStorage`) wird als einfacher Fallback dargestellt. Unterschlagen wird, dass `safeStorage` in Electron **erst nach `app.whenReady()`** verwendet werden sollte. Wenn MRR-Credentials sehr früh geladen werden (z. B. beim App-Start vor Window-Creation), kann `safeStorage` noch nicht bereit sein.

**Empfohlene Korrektur:** Hinweis auf Initialisierungszeitpunkt und ggf. Lazy-Loading der Credentials ergänzen.

#### 2.5 Aktueller Codeexport ist funktionsbasiert, nicht interfacebasiert *(Schwere: Mittel)*

Der Plan spricht von einem „Adapter-Pattern" mit `keychain.ts` als Interface + Factory und `keychain-darwin.ts` / `keychain-win32.ts`. Die aktuelle Datei `src/main/mrr/keychain.ts` exportiert jedoch direkt:

```ts
export async function setKeychainSecret(...)
export async function getKeychainSecret(...)
export async function deleteKeychainSecret(...)
export function isValidKeychainService(...)
```

Es gibt **kein Interface**, keine Factory und keine Injektion. Der Refactor-Aufwand ist daher größer als der Plan suggeriert. Alle Aufrufer (z. B. `src/main/mrr/mrr-config.ts`, ggf. `mrr-engine.ts`) müssen angepasst werden.

**Empfohlene Korrektur:** Explizit notieren, dass `keychain.ts` zunächst in ein Interface + Implementierungen aufgeteilt werden muss, und die Aufrufer auf DI oder Factory umgestellt werden.

#### 2.6 `--keychain-service` QA-Flag ist im Plan unzureichend erfasst *(Schwere: Mittel)*

Das Flag wird in `src/main/main.ts:91-99` geparst und in `src/main/mrr/mrr-config.ts:19` als `DEFAULT_KEYCHAIN_SERVICE = 'beaver-buddy'` definiert. Der Plan erwähnt das Flag mehrfach, aber nicht:

- wo es aktuell implementiert ist
- dass es nicht nur ein „QA-Flag" ist, sondern der Service-Name-Override für die gesamte Keychain-Implementierung
- dass `isValidKeychainService` aus `src/main/mrr/keychain.ts:27` auf Windows weiterhin verwendet werden muss, um Injection in Service-Namen zu verhindern

**Empfohlene Korrektur:** Code-Bezüge zu `main.ts:91-99` und `mrr-config.ts:17-25` ergänzen.

#### 2.7 Keine klare Entscheidungsempfehlung *(Schwere: Mittel)*

Der Plan präsentiert Option A als „primärer Prüfkandidat" und Option B als „dokumentierter Fallback", ohne klar zu sagen: **Unter den gegebenen Restriktionen (`CLAUDE.md`, keine neuen Dependencies) ist Option B wahrscheinlich die einzige realistische Shipping-Lösung.**

**Empfohlene Korrektur:** Empfehlung schärfen: Option B als präferierte Standardlösung, Option A nur bei expliziter Admin-Entscheidung für Credential Manager inklusive Native-Addon.

---

### BL-WIN-7: Atomares Schreiben Windows-nativ

#### 3.1 Option A (`setTimeout`-Backoff in synchroner Funktion) ist technisch unmöglich *(Schwere: Kritisch)*

Unter Option A schlägt der Plan vor:

> „In `atomicWriteFile` wird `fs.renameSync` in einer Schleife mit kurzem `setTimeout`-Backoff wiederholt"

`src/main/atomic-file.ts:12` definiert `atomicWriteFile` als **synchrone** Funktion. `setTimeout` ist asynchron; innerhalb einer synchronen Funktion kann damit kein Retry realisiert werden. Der Plan beschreibt hier einen nicht funktionierenden Ansatz.

**Empfohlene Korrektur:** Entweder
- `atomicWriteFile` asynchron machen (`async` + `fs.promises` + `setTimeout`), oder
- synchronen Retry ohne Verzögerung (busy-wait mit `Atomics.wait`/`sleep`-Variante) als bewussten Kompromiss dokumentieren, oder
- Retry mit `Atomics.wait` aus `node:buffer` / `node:timers` prüfen.

#### 3.2 Fehlerklassifikation fehlt *(Schwere: Mittel)*

Der aktuelle Code in `src/main/atomic-file.ts:18` wirft einfach den `renameSync`-Fehler weiter. Der Plan fragt zwar, welche Fehler abgefangen werden sollen (`EPERM`, `EACCES`, `EBUSY`), gibt aber keine klare Antwort.

**Empfohlene Korrektur:** Explizit festlegen, dass `EPERM` und `EBUSY` retriable sind, `EACCES` dagegen ein dauerhaftes Berechtigungsproblem darstellt und nicht retriert werden sollte (oder nur sehr kurz).

#### 3.3 Temporärdatei liegt bereits korrekt im Zielverzeichnis *(Schwere: Niedrig-Mittel)*

Option D erwähnt:

> „Temporäre Datei wird außerhalb des Zielverzeichnisses erstellt (auf gleichem Volume), um Fragmentierung zu vermeiden."

Das ist irreführend: `atomic-file.ts:15` erzeugt die Temp-Datei bereits im **gleichen Verzeichnis** wie die Zieldatei (`${filePath}.tmp-...`). Das ist korrekt, denn `rename` ist nur auf demselben Filesystem atomar, und `userData` liegt auf einem Volume. „Fragmentierung" ist hier kein relevantes Problem; die wichtige Eigenschaft ist Same-Volume-Rename.

**Empfohlene Korrektur:** Option D überarbeiten: Temp-Datei im Zielverzeichnis beibehalten, aber Retry-Logik und robusteres Cleanup ergänzen.

#### 3.4 Keine Abbruchkriterien für die Recherche *(Schwere: Mittel)*

Der Plan sagt „Recherche nach besserem Pattern", ohne zu definieren, wann die Recherche als erfolglos gilt und Option A/D als Default gewählt wird.

**Empfohlene Korrektur:** Zeitbox (z. B. 4 Stunden) und Abbruchkriterien ergänzen.

---

### Codex-Tracking: Windows-Log-Pfade

#### 4.1 `Platform`-Typcast in `discoverPaths` ist latent fehlerhaft *(Schwere: Mittel)*

`src/main/usage/paths.ts:129`:

```ts
platform: Platform = process.platform as Platform,
```

Der Typ `Platform` ist auf `'win32' | 'darwin' | 'linux'` beschränkt. Auf `freebsd`, `openbsd` etc. ist der Cast falsch. Der Hauptplan erwähnt das zwar in den verbleibenden Hinweisen, der Phase-5-Plan nicht.

**Empfohlene Korrektur:** Hinweis ergänzen, dass `discoverPaths` nur mit den drei definierten `Platform`-Werten aufgerufen werden sollte, oder ein Fallback auf `linux` für unbekannte Plattformen in Betracht ziehen.

#### 4.2 Unklar, ob Codex überhaupt offiziell Windows unterstützt *(Schwere: Mittel)*

Der Plan geht davon aus, dass Codex auf Windows läuft und nur der Pfad unklar ist. Es wird nicht erwähnt, dass die Codex-CLI von OpenAI möglicherweise **noch keine stabile Windows-Unterstützung** hat oder ihr Windows-Verhalten sich schnell ändert.

**Empfohlene Korrektur:** Als Risiko ergänzen: „Codex-Windows-Support selbst ist möglicherweise experimentell; Pfad kann sich zwischen Versionen ändern."

#### 4.3 Option B fehlt klare Pfadpriorisierung *(Schwere: Niedrig-Mittel)*

Die Option B listet mehrere Kandidatenpfade auf (`~/.codex`, `%LOCALAPPDATA%\Codex`, `%APPDATA%\Codex`), ohne zu sagen, welcher zuerst geprüft werden soll.

**Empfohlene Korrektur:** Reihenfolge festlegen, z. B.:
1. `CODEX_HOME` (Override)
2. `%LOCALAPPDATA%\Codex` (modernster Windows-AppData-Pfad)
3. `%APPDATA%\Codex`
4. `~/.codex` (Legacy / WSL-ähnliche Umgebungen)

---

### Querschnittliche Lücken

#### 5.1 Fehlende Bezüge zu bestehenden Testdateien *(Schwere: Mittel)*

Der Plan nennt keine bestehenden Tests, die bei der Umsetzung angepasst werden müssen:

- `src/main/mrr/keychain.test.ts` (muss bei Adapter-Refactor komplett umgebaut werden)
- `src/main/usage/paths.test.ts` (muss um Windows-Codex-Szenarien erweitert werden)
- `src/main/atomic-file.ts` hat **keine eigene Testdatei** (Glob `src/main/*atomic*.test.ts` liefert nichts)

**Empfohlene Korrektur:** Testaufwand explizit erwähnen, insbesondere dass für BL-WIN-7 neue Tests geschrieben werden müssen.

#### 5.2 `redact.ts` wird nicht erwähnt *(Schwere: Niedrig-Mittel)*

`src/main/mrr/keychain.ts:17` importiert `logRedacted` aus `./redact`. Eine Windows-Implementierung muss dieselbe Redaktion verwenden. Der Plan erwähnt diesen wichtigen Security-Aspekt nicht.

**Empfohlene Korrektur:** Hinweis ergänzen, dass `keychain-win32.ts` ebenfalls `logRedacted` nutzen muss.

#### 5.3 Finales Master-Icon / Design-Pass fehlt im Phase-5-Plan *(Schwere: Niedrig)*

Der Hauptplan (`WINDOWS_PORT_PLAN.md:511-513` und „Verschobene Aufgaben" Abschnitt 8) listet das **finale Master-Icon / Design-Pass** als zurückgestellten Punkt. Der Phase-5-Plan erwähnt dieses Item nicht.

**Empfohlene Korrektur:** Entweder ins Inhaltsverzeichnis aufnehmen oder explizit als „nicht Teil von Phase 5" begründen.

#### 5.4 Keine klare „Definition of Done" für die Planungsphase *(Schwere: Niedrig-Mittel)*

Der Plan endet mit „Sobald die externen Klärungen vorliegen, sollten die Items umgesetzt werden". Es fehlt ein klares Kriterium, wann dieser Plan selbst als abgeschlossen gilt (z. B.: „Alle drei Entscheidungsfragen beantwortet oder Eskalationspfad definiert").

---

## 3. Konkrete Verbesserungsvorschläge

| # | Thema | Vorschlag | Bezug |
|---|-------|-----------|-------|
| 1 | BL-WIN-6 Option A | `cmdkey.exe` als nicht für generische Credentials geeignet kennzeichnen oder entfernen. | `phase-5-plan.md:3.3 Option A` |
| 2 | BL-WIN-6 Option A | PowerShell `CredentialManager`-Modul als „nur für lokale POCs, nicht für Shipping" markieren. | `phase-5-plan.md:3.3 Option A` |
| 3 | BL-WIN-6 Option A | Native-Addon explizit als „nur mit Admin-Entscheidung + ADR für neue Native-Dependency" kennzeichnen. | `phase-5-plan.md:3.3 Option A`, `CLAUDE.md` |
| 4 | BL-WIN-6 Option B | Hinweis ergänzen: `electron.safeStorage` erst nach `app.whenReady()` nutzbar; ggf. Lazy-Loading. | `phase-5-plan.md:3.3 Option B` |
| 5 | BL-WIN-6 Architektur | Notieren, dass `src/main/mrr/keychain.ts` aktuell funktionsbasiert ist und in Interface + Factory + zwei Implementierungen refactored werden muss. | `src/main/mrr/keychain.ts`, `src/main/mrr/mrr-config.ts` |
| 6 | BL-WIN-6 QA-Flag | Code-Bezüge zu `--keychain-service` ergänzen (`src/main/main.ts:91-99`, `src/main/mrr/mrr-config.ts:17-25`). | `src/main/main.ts:91-99` |
| 7 | BL-WIN-6 Empfehlung | Empfehlung schärfen: Option B als Default, Option A nur bei Admin-Entscheidung. | `phase-5-plan.md:3.3` |
| 8 | BL-WIN-7 Option A | `setTimeout`-Retry in synchroner Funktion korrigieren: entweder Funktion asynchron machen oder alternativen synchronen Retry dokumentieren. | `src/main/atomic-file.ts:12`, `phase-5-plan.md:3.3 Option A` |
| 9 | BL-WIN-7 Fehlerklassen | Klar festlegen: `EPERM`/`EBUSY` retriable, `EACCES` nicht retriable (oder nur kurz). | `phase-5-plan.md:3.2` |
| 10 | BL-WIN-7 Option D | Irreführenden Hinweis zur Temp-Datei außerhalb des Zielverzeichnisses korrigieren. | `phase-5-plan.md:3.3 Option D` |
| 11 | BL-WIN-7 Recherche | Zeitbox und Abbruchkriterien für Recherche definieren. | `phase-5-plan.md:3.4` |
| 12 | Codex-Tracking | Latenten `Platform`-Cast in `discoverPaths` erwähnen. | `src/main/usage/paths.ts:129` |
| 13 | Codex-Tracking | Risiko ergänzen: Codex-Windows-Support selbst kann instabil sein. | `phase-5-plan.md:4` |
| 14 | Codex-Tracking | Klare Priorisierung der Kandidatenpfade in Option B festlegen. | `phase-5-plan.md:4.3 Option B` |
| 15 | Tests | Bestehende Testdateien (`keychain.test.ts`, `paths.test.ts`) und fehlende `atomic-file.test.ts` erwähnen. | `src/main/mrr/keychain.test.ts`, `src/main/usage/paths.test.ts` |
| 16 | Security | Hinweis ergänzen, dass `keychain-win32.ts` `logRedacted` aus `src/main/mrr/redact.ts` wiederverwenden muss. | `src/main/mrr/redact.ts` |
| 17 | Vollständigkeit | Master-Icon / Design-Pass entweder aufnehmen oder ausgrenzen. | `WINDOWS_PORT_PLAN.md:511-513` |
| 18 | DoD | Klare „Definition of Done" für diese Planungsphase ergänzen. | `phase-5-plan.md:8` |

---

## 4. GO / NO-GO Empfehlung

**Empfehlung: GO mit MAJOR REVISIONS (bedingtes GO für Dokumentation/Forschung)**

Der Plan darf als Planungsdokument genutzt werden, **muss aber vor Weitergabe an einen Implementierungs-Agenten überarbeitet werden**. Die gravierendsten Fehler (`setTimeout` in synchroner Funktion, `cmdkey.exe` als Leselösung) müssen korrigiert werden, bevor der Plan als Handlungsanweisung dient.

Das grundsätzliche Konzept (drei zurückgestellte Items, externe Blocker, Recherchephase) ist korrekt und vollständig genug, um das weitere Vorgehen zu steuern.

---

## 5. Wichtige Hinweise für den Implementierungs-Agenten

Falls der Plan nach Korrektur als Basis für die Umsetzung dient:

### BL-WIN-6
- **Bevorzuge Option B (`electron.safeStorage` + verschlüsselte JSON in `userData`)**, es sei denn, der Administrator entscheidet ausdrücklich für Windows Credential Manager mit Native-Addon.
- Refactore `src/main/mrr/keychain.ts` in ein Interface + Factory; extrahiere die bestehende `security`-CLI-Logik nach `keychain-darwin.ts`.
- Stelle sicher, dass `isValidKeychainService` weiterhin exportiert wird und von `src/main/main.ts:91-99` genutzt wird.
- Verwende in `keychain-win32.ts` zwingend `logRedacted` aus `src/main/mrr/redact.ts`, damit Secrets niemals im Log landen.
- Aktiviere den MRR-Mode auf Windows erst, nachdem ein vollständiger Write/Read/Delete-Zyklus getestet ist.

### BL-WIN-7
- **Mache `atomicWriteFile` asynchron** (`async function atomicWriteFile(...)`), wenn du Retry mit Backoff implementieren möchtest. Verwende `fs.promises.writeFile` + `fs.promises.rename` + `setTimeout`.
- Falls Synchronität zwingend erforderlich ist, dokumentiere den Grund und implementiere einen synchronen Retry (z. B. mit `Atomics.wait` oder einem synchronen Sleep), nicht `setTimeout`.
- Klassifiziere Fehler klar: `EPERM` und `EBUSY` retriable, `EACCES` nur mit sehr kurzer Retry-Grenze.
- Behält die Temp-Datei im Zielverzeichnis bei (`${filePath}.tmp-...`), um Same-Volume-Rename zu garantieren.
- Schreibe eine neue Testdatei `src/main/atomic-file.test.ts`; es gibt aktuell keine.

### Codex-Tracking
- Prüfe zuerst empirisch auf Windows, ob Codex überhaupt läuft und welche Verzeichnisse angelegt werden.
- Implementiere die Pfadsuche in dieser Priorität: `CODEX_HOME` > `%LOCALAPPDATA%\Codex` > `%APPDATA%\Codex` > `~/.codex`.
- Erweitere `src/main/usage/paths.test.ts` um Windows-Codex-Szenarien.
- Behandle unbekannte `process.platform`-Werte defensiv (z. B. Fallback auf `linux`-Verhalten), anstatt blind `as Platform` zu casten.

### Allgemein
- Keine neuen Dependencies ohne explizite Begründung und ADR (vgl. `CLAUDE.md`).
- Halte den Plan nach jeder Entscheidung / Recherche aktuell; er soll ein „lebendes Dokument" bleiben.
