Juli 21, 2026
Besprechung am 21. Juli 2026 um 18:36 CEST
Besprechungsaufzeichnungen Transkript 


Zusammenfassung
Projektentwicklung fokussiert auf ein gamifiziertes Charakter System zur Steigerung der Nutzerbindung durch Token Verbrauchsmetriken und visuelle Animationen.

Level Mechanik und Tracking
Das System basiert auf Token Verbrauch zur Level Steigerung bis 32. Daten werden aggregiert gespeichert zur Wahrung der Skalierbarkeit.

Architektur und Charakter Design
PixiJS ermöglicht die Animation von Charakteren basierend auf JSON Konfigurationen. Eine flexible Schichten Struktur stellt die visuelle Konsistenz über Altersstufen sicher.

Strategie und Monetarisierung
Die Plattform etabliert eine Marke mit einem Prestige System für Langzeitmotivation. Es wurde beschlossen, keine klassische Werbung einzubinden, sondern kosmetische Assets anzubieten.


Nächste Schritte
Benchmark recherchieren: Recherchieren, ob Intelligenzindizes als Metrik für die Experience Point Berechnung verwendet werden können.
Datenmodell Prototyp: Entwickeln eines Prototyps für die Token und Intelligenzindex basierte Datenstruktur.
Level Design Tabelle: Erstellen einer Tabelle für das Level Design inklusive Sprite Sets, Animationen und Triggern.
Altersstufen definieren: Entwickeln Sie Referenzbilder für die Stadien Baby, Teenager und Erwachsener. Zerlegen Sie diese in einzelne Körperteile für die Animation.
Level definieren: Legen Sie die Spielmechanik und den Fortschritt für die 32 Level fest. Definieren Sie die Bedingungen für das Wachstum der Charaktere.
Animationsprototypen erstellen: Entwickeln Sie technische Konzepte mit Pixi JS für die Sprite-Animationen. Testen Sie die Kombination verschiedener Assets für die Charaktere.
XP-Berechnung entwickeln: Entwerfen Sie eine Methode zur Berechnung der Erfahrungspunkte und des Levels. Integrieren Sie ein Intelligence Index Modell für das Ranking.
Asset-Workflow optimieren: Passen Sie den Comfy UI Prozess an, damit alle Bestandteile als getrennte Ebenen generiert werden. Stellen Sie sicher, dass Körperteile für konsistente Animationen korrekt übereinandergelegt werden.
Dokumentation erstellen: Dokumentieren Sie die Plattform und die Prozesse, um Contribution Readiness für externe Mitarbeiter zu gewährleisten. Bereiten Sie alle Aufgaben für die interne Zusammenarbeit auf.
Datenspeicherung implementieren: Konfigurieren Sie die lokale Speicherung von Profildaten in einer Konfigurationsdatei. Bereiten Sie die Infrastruktur für eine spätere Migration zur Nutzer-Authentifizierung vor.
Biber-Sticker erstellen: Entwerfen Sie Sticker für das Projekt mithilfe der verfügbaren Charakterbilder. Nutzen Sie Cloud oder Bildgenerierungstools für diesen Prozess.
Sicherheitsmechanismus entwickeln: Entwicklung eines Sicherheitsmechanismus zur externen Steuerung von Animationen, um eine unbefugte manuelle Aktivierung durch Nutzer zu verhindern.
Namensgebung implementieren: Implementierung einer Funktion, die es Nutzern erlaubt, ihrem Biber zu Beginn der Anwendung einen individuellen Namen zu geben.
Easter Egg Animation: Erstellung einer speziellen Animation, bei der der Biber mit dem offiziellen Logo interagiert.
Statuserkennung integrieren: Integration der Hörder-Logik zur automatischen Erkennung, wann ein Coding-Agent seine Arbeit abgeschlossen hat.
Account Verknüpfung: Entwicklung der Verknüpfungsfunktion, um den lokalen Biber mit einem AI Beavers Web-Profil zu verbinden und Achievements sowie XP zu synchronisieren.
API Dokumentation erstellen: Erstellung einer technischen Dokumentation, die Contributoren den Workflow des Asset-Builders und die notwendigen Pixy JS Skills erläutert.


Details
Festlegung der Level-Mechanik: Es wurde entschieden, das Level-System des Projekts auf der Anzahl der verbrauchten Tokens zu basieren, anstatt auf Zeit oder anderen Metriken, um eine klare V1-Version zu starten. Das Ziel ist ein stufenweiser Fortschritt bis Level 32, wobei der Aufwand zum Erreichen der höheren Level kontinuierlich steigen soll (00:54:38).
Datenerfassung und Tracking: Es wurde diskutiert, die Token-Verbräuche der verschiedenen Modelle zu erfassen. Dabei wurde festgehalten, dass eine tägliche und aggregierte Speicherung der Daten notwendig ist, wobei zwischen verschiedenen Modellen differenziert wird (00:54:57) (00:58:57).
Technische Implementierung des Trackings: Es wurde geklärt, dass `npx` für die Nutzung von Token-Scale in Betracht gezogen wird, um eine einfache Installation und Nutzung zu ermöglichen, wobei die Versionen sicher verwaltet werden müssen (01:00:15) (01:01:01).
Modellauswahl und Token-Berechnung: Es wurde vereinbart, für die Berechnung der Experience Points (XP) primär Input- und Output-Tokens aller gängigen Modelle zu nutzen, während Cache-Daten ausgeschlossen werden, um eine doppelte Zählung zu vermeiden (01:03:06).
Strukturierung des Fortschritts: Das Level-System wurde grob definiert: Level 1 bis 16 repräsentieren eine Entwicklungsphase (z. B. "Baby" bis "Teenager"), wobei die Fortschrittsgeschwindigkeit anfangs hoch sein soll, um die Nutzerbindung zu stärken (01:04:16) (01:13:51).
Spielerische Elemente und Easter Eggs: Es wurde die Idee diskutiert, spielerische Elemente wie eine Steuerung eines Charakters (ähnlich dem Google Dino-Spiel) als Easter Egg für höhere Level zu integrieren, um den Unterhaltungswert zu steigern (01:06:21).
Datenspeicherung und Skalierbarkeit: Um die Datenbank nicht zu überlasten, wurde beschlossen, keine riesigen Rohdatenmengen zu speichern, sondern lediglich das Datum und die aggregierten Token-Werte (Input/Output) pro Tag und Modell zu erfassen (01:10:50).
Visuelle Interaktion und Animation: Um die Nutzerbindung zu erhöhen, sollen bereits früh (ab Level 8) kleine visuelle Veränderungen oder Interaktionen stattfinden, wie etwa ein Klick-Trigger, der eine Animation auslöst (01:12:08) (01:18:00).
Technischer Stack für Animationen: Für die visuelle Umsetzung wurde PixiJS als geeignete Engine identifiziert, da sie das Rendern von Sprites und die Handhabung von Animationen sowie Kollisionen unterstützt (01:15:27) (01:37:51).
Zukünftige Monetarisierung: Es wurde die Möglichkeit erörtert, in Zukunft besondere Assets gegen Beiträge oder Spenden anzubieten, wobei der Fokus aktuell auf der Erreichung einer signifikanten Nutzerbasis von etwa 1.000 aktiven Nutzern liegt (01:38:58) (01:40:24).
Character Map und JSON-Struktur: Es wurde beschlossen, eine JSON-basierte Struktur ("Character Map") zu verwenden, um Level, zugehörige Sprites und Animationen zu definieren, was eine flexible Erweiterbarkeit ermöglicht (01:30:53) (01:32:48).
Benchmarking der Modell-Intelligenz: Es wurde diskutiert, wie verschiedene Modelle basierend auf ihrem Preis-Leistungs-Verhältnis und Intelligenz-Benchmarks gewichtet werden könnten, um eine faire XP-Vergabe zu gewährleisten (01:23:57) (01:29:09).
Ereignis-Trigger: Neben dem Fortschritt durch Token-Verbrauch wurden verschiedene Trigger für Animationen definiert, darunter Drag-and-Drop-Interaktionen, zeitgesteuerte Events (z. B. Mitternacht) oder Benachrichtigungen (01:32:03) (01:32:48).
Projekt-Roadmap und Meilensteine (Zyklus 1): Der erste Zyklus wurde definiert, wobei als Hauptziele eine funktionierende, herunterladbare App, 100 Downloads und die Gewinnung von 7 zusätzlichen Mitwirkenden festgelegt wurden, um den Status von Zyklus 1 abzuschließen (01:53:08) (01:54:39).
Entwicklungszeitplan und Level-Definition: Als zeitlicher Maßstab für das Erreichen von Level 32 werden zwei Monate angesetzt (01:55:35). Es besteht die Notwendigkeit, diesen Durchschnittswert zu definieren, um die Entwicklungsgeschwindigkeit und den Arbeitsaufwand entsprechend zu planen (01:55:59).
Erweiterbarkeit der Plattform: Um zukünftige Updates ohne Neuprogrammierung der Anwendung zu ermöglichen, soll das Projekt so gestaltet werden, dass Animationen und Sprites über externe Konfigurationsdateien, wie beispielsweise JSON-Dateien, hinzugefügt werden können (01:59:56).
Hauptfunktionen für Zyklus 1: Als zentrales Feature für den ersten Zyklus wurde ein "Recording Agent" identifiziert (02:01:30). Zusätzlich soll eine Benachrichtigungsfunktion implementiert werden, die auf externe Ereignisse reagiert, etwa wenn eine Eingabe durch einen Coding-Agenten erforderlich ist (02:02:01).
Trennung von Ereignislogik und Charakteranimation: Die Architektur soll so aufgebaut werden, dass ein Modul die Überwachung externer Agenten übernimmt, während ein separates Modul die entsprechende Charakteranimation steuert (02:05:22). Die Logik zur Erkennung von Zuständen, wie etwa ein wartender Terminal-Input, soll dabei beispielsweise von vorhandenen Modellen wie Hörder übernommen werden (02:06:13).
Prototyping für XP-Berechnung und Animation: Zur Validierung der technischen Machbarkeit sollen Prototypen für die XP-Berechnung sowie für die saubere Implementierung von Animationen erstellt werden (02:07:16). Diese dienen als wichtige Meilensteine vor der weiteren Skalierung des Projekts (02:08:42).
Datenspeicherung und Authentifizierung: Für den ersten Zyklus ist die Speicherung von Daten in einer lokalen Konfigurationsdatei vorgesehen, um ohne Nutzerauthentifizierung auszukommen (02:11:46). Eine spätere Implementierung einer Authentifizierung (z. B. via Google oder AI-Account) sowie die Datenmigration in eine Datenbank sind als zukünftige Erweiterung geplant (02:10:25) (02:12:37).
Meilensteinplanung und Dokumentation: Die Planung umfasst eine Priorisierung der Aufgaben in Meilensteine, beginnend mit der Vorbereitung für externe Contributions (02:13:41). Die Dokumentation soll sicherstellen, dass interne Coding-Agenten effizient am Projekt weiterarbeiten können (02:14:20).
Charakterstufen und Visualisierung: Es wurde festgelegt, den Charakter in verschiedene Altersstufen zu unterteilen (z. B. Baby, Teenager, Erwachsen), um das Wachstum abzubilden (00:02:17). Hierfür sind Referenzbilder der Charaktere aus verschiedenen Perspektiven (vorne, Seite, hinten) in Pixelart-Qualität erforderlich (00:02:37) (00:03:35).
Asset-Generierung und Layering: Die Charakter-Assets sollen zunächst in einer "nackten" Basisform erstellt werden, auf die weitere Elemente wie Kleidung oder Accessoires als Layer aufgesetzt werden können (00:04:45) (00:06:39). Dies gewährleistet Konsistenz über verschiedene Altersstufen und Betriebssysteme hinweg (00:05:22).
Automatisierte Animation: Anstatt komplette Szenen zu generieren, sollen einzelne Körperteile als Assets erstellt werden, um die Animation durch gezieltes Zusammenfügen und Überlagern der Layer zu vereinfachen (00:07:40) (00:08:53). Für diesen Prozess sollen Anpassungen am Prompt-Workflow in Tools wie ComfyUI vorgenommen werden (00:12:47).
Namen und Identität des Charakters: Es wurde vereinbart, dass Nutzer dem Charakter zu Beginn einen eigenen Namen geben können, ähnlich dem Konzept bei Pokémon (00:21:51). Dies dient der persönlichen Bindung, wobei die Marke "AI Beaver" als übergeordnetes Branding erhalten bleiben soll (00:21:11).
Spezielle Animationen und Easter Eggs: Es wurde die Idee diskutiert, besondere Animationen einzubauen, die beispielsweise bei bestimmten Ereignissen oder durch zufällige Wahrscheinlichkeiten ausgelöst werden (00:22:28) (00:27:43). Dies umfasst komplexe Darstellungen wie etwa den Charakter, der mit einem Flugzeug und einem Banner erscheint (00:23:01) (00:26:20).
Schnittstelle zu externen Agenten: Die Anwendung soll logisch mit externen Coding-Agenten verknüpft werden, um den Benutzer über Zustände wie "Input benötigt" zu informieren. Diese Benachrichtigungen sollen direkt visuell durch den Charakter erfolgen, etwa durch das Hochhalten eines Schildes (00:23:57) (00:25:35).
Benutzerinteraktion und Design: Es wurde über die Benutzerfreundlichkeit (UX) diskutiert, insbesondere über die Funktionalität des Verschiebens des Charakters via Drag-and-Drop (00:33:23) (00:34:26). Ziel ist eine intuitive Steuerung, bei der das Fenster trotz Overlay-Charakter interaktiv unterhalb des Charakters bedienbar bleibt (00:34:43).
AI Biber Branding und Monetarisierung: Das Projekt soll als starke Marke etabliert werden, wobei Nutzer die Möglichkeit erhalten, Kleidung und kosmetische Artikel gegen geringe Beträge zu erwerben (00:36:20). Es wurde betont, dass es sich hierbei nicht um "Pay-to-Win" handelt, da diese Gegenstände auch durch Fortschritte im Levelsystem freigeschaltet werden können (00:36:48). Zusätzlich wurde die Möglichkeit erörtert, physische Merchandise-Artikel wie T-Shirts zu produzieren und zu verkaufen (00:37:04).
Launch-Strategie und Nutzungsstatistiken: Nach dem Launch soll das System beobachtet werden, um die Resonanz und Nutzerzahlen zu evaluieren (00:37:38). Es wird angestrebt, nicht nur die Installation des Programms zu erfassen, sondern die tatsächlich aktive Nutzungszeit bei geöffnetem Laptop zu tracken, um die Zeit als messbaren Wert für das System zu nutzen (00:37:59).
Gamification und Achievement-System: Es ist geplant, Zeit in Erfahrungspunkte (XP) umzuwandeln, wobei die Lebenszeit genutzt werden soll, um besondere Assets oder Fortschritte freizuschalten (00:38:21). Ein zusätzliches Achievement-System für Meilensteine, wie beispielsweise "7 Tage" oder "30 Tage" aktiver Zeit, wurde diskutiert, um die Nutzerbindung zu fördern (00:38:52).
Profil-System und Landing Page: Die Webseite ai-bibers.com soll als zentrale Plattform für den "Biber Buddy" dienen, auf der Nutzer ihre lokalen Daten mit ihrem Account verknüpfen können (00:39:59). Durch diese Verknüpfung können Profile erstellt werden, die XP, Achievements und den Fortschritt des Charakters anzeigen. Eine lokale Nutzung ohne Account-Verknüpfung soll ebenfalls möglich bleiben (00:40:50).
In-App Marketing-Konzept: Anstatt traditioneller Werbeformen ist geplant, den "Biber Buddy" als Interaktionsmedium zu nutzen. Durch Sprechblasen kann der Charakter auf Angebote oder Perks hinweisen, ohne dass dies als klassische Werbung wahrgenommen wird (00:41:08).
Aktueller Entwicklungsstatus: Derzeit erfordert die Nutzung des Programms einen Start über die Konsole, was die Zugänglichkeit für normale Nutzer einschränkt. Das Ziel ist eine nutzerfreundliche Anwendung, die direkt geöffnet werden kann (00:42:07).
Level-System und Prestige-Konzept: Die Level-Struktur ist bis zu einem Cap bei Level 32 konzipiert, wobei Fortschritte durch Tokens oder Zeit erzielt werden (00:42:28). Ein Prestige-System wurde vorgeschlagen, bei dem Nutzer ab Level 32 wieder bei Level 1 beginnen können, um visuelle Markierungen wie Sterne zu erhalten und inkrementell saisonale Inhalte freizuschalten (00:42:45) (00:43:32).
Skalierungsstrategie für Beitragende: Um die Weiterentwicklung durch eine Community zu ermöglichen, soll eine solide technische Basis mit einer API-Schnittstelle, Datenbankanbindung und Benutzerkonten geschaffen werden. Sobald dieses Grundgerüst steht, können Entwickler eigene Ideen einbringen, die über einen Review-Prozess (Pull Requests) qualitätsgesichert integriert werden (00:45:08) (00:46:17).
Technischer Asset Builder und Dokumentation: Für die Erweiterung von Assets, wie neuen Charakter-Modellen oder Animationen, soll ein "Asset Builder" entwickelt werden. Die technischen Anforderungen, wie der Einsatz von Pixy JS und Compilern, wurden bereits in einer Dokumentation (Readme-Datei) festgehalten, um Beitragenden den Einstieg in die Entwicklung zu erleichtern (00:47:20) (00:48:03).


Überprüfen Sie die Notizen von Gemini, um sicherzustellen, dass sie korrekt sind. Hier finden Sie Tipps und erfahren, wie Gemini Notizen erstellt.
Wie bewerten Sie die Qualität dieser Notizen? Nehmen Sie an einer kurzen Umfrage teil und geben Sie uns Feedback – zum Beispiel dazu, wie hilfreich diese Notizen waren.
