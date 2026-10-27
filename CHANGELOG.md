# Änderungen an Free My TV+

Neueste Version oben. Jede Version beginnt mit einer kurzen Übersicht, danach folgen die Einzelheiten. Der Abschnitt der
aktuellen Version wird beim Bauen automatisch als Text der GitHub-Release übernommen.

## 1.3.0

**Kurz:** Neu: TV-Vollbild nach 10 s ohne Taste, Programmführer, Mediaplayer (USB und Adressen), Tasten-Legende auf jeder
Seite, wählbare Farbe des Auswahlrahmens, über 2.500 News-Themen mit A–Z. Geändert: Foto-Streifen bis 40 % der Höhe, App-Leiste
als Glaswürfel auf Holz in voller Breite, Schublade mit Wetter oben und Abendrot-Hintergrund, Fernsehbild klein in der Ecke
über Menüs und Suche.

**Startseite**
- Nach 10 Sekunden ohne Taste geht das Livebild auf Vollbild; jede Taste holt die Oberfläche zurück.
- Der Foto-Streifen reicht bis 40 % der Bildschirmhöhe und blendet auf weiteren 15 % sauber aus (alle drei Tabs).
- App-Leiste so breit wie die Kacheln darüber; die Leiste läuft ab etwa 60 % mit, erst am Ende bis ganz nach rechts.
- Kacheln als Glaswürfel auf warmem, altem Holz: Das Holz scheint durch das Glas, vergrößert und versetzt, und
  verschiebt sich beim Durchlaufen.
- Senderkachel: OK öffnet den Programmführer (10 Sender davor, der aktuelle, 10 danach mit Zeitleiste und Infos);
  dort schalten ▲ ▼ um, ◄ ► führen zum Fernsehbild, OK oder Zurück zur Startseite.

**Überall**
- Legende unten rechts mit den Tasten der aktuellen Seite.
- Auswahlrahmen auf jeder Seite, Farbe in den Start-Einstellungen wählbar.
- Über Menüs und Suche wandert das Fernsehbild klein nach rechts unten.

**Schublade**
- Wetter und News oben, Eingänge und Verknüpfungen unten; ▲ wählt das Wetter, OK öffnet den Wetterbericht.
- Abendrot-Foto statt weißem Hintergrund.
- Neu: Mediaplayer (USB-Speicher durchsuchen, Video, Musik und Bilder abspielen, Stream-Adressen eingeben).

**News**
- Über 2.500 Themen, darunter alle deutschen Städte ab etwa 50.000 Einwohnern, Länder, Extremsport und viele mehr;
  Auswahl über eine A–Z-Leiste, Suche oder eigenes Thema.

## 1.2.0

**Kurz:** Neu: Senderkachel zum Umschalten, Suchkachel, Infofeld in der Senderliste, Länderkennung und Länderfilter in
Welt-TV, Welt-TV-Menü über dem laufenden Sender, News nach eigenen Themen, Wetterbericht. Behoben: Sendernummern
(„22.65534“), Geo-gesperrte Sender. Geändert: Uhrzeit statt „Für dich“, helle Glas-Kacheln, blauer Fokusrahmen.

**Startseite**
- Oben links stehen wieder Uhrzeit, Wettersymbol und Datum.
- „Jetzt im TV“: Senderkachel zum direkten Umschalten (OK, dann ▲ ▼ schaltet live um; P+/P− geht überall auf der
  Startseite), darunter eine flache Suchkachel für Sat-Sender, laufende Sendungen, Welt-TV-Sender und Apps
  (z. B. Mediatheken). Die Kachel „Danach“ zeigt ein Bild zur nächsten Sendung, wenn Wikipedia eines hat.
- Sichtbarer Fokusrahmen (blau), helle Glas-Kacheln statt der dunklen, App-Leiste als Glaswürfel.
- App-Kacheln verschieben: OK lange drücken (oder rote Taste), dann ← →, OK legt ab.

**Sat-TV**
- Senderliste: Nummern korrigiert (vorher „22.65534“), laufende Sendung für jeden sichtbaren Sender, rechts ein
  Infofeld mit allem, was der Sender mitliefert (Beschreibung, Zeiten, danach), dazu Bild und Text von Wikipedia.
  ► oder die Info-Taste öffnet es, ▲ ▼ blättert.

**Welt-TV**
- Länderkennung hinter jedem Sender, z. B. „(DE)“, und darunter die Sendung, die gerade läuft, wenn der Sender auch
  über Satellit empfangen wird (aus dem EPG des Fernsehers), sonst seine Kategorie.
- Geo-Sperren: Doppelt gelistete Sender nehmen die Variante, die hier läuft; Sender, die nur im Ausland empfangbar
  sind, werden ausgeblendet (einblendbar in den Start-Einstellungen).
- Länderfilter über jeder Liste (z. B. bei „Sport“: Alle Länder, DE, AT, US …).
- Im laufenden Sender öffnet OK oder ◄ ► das Welt-TV-Menü halb durchsichtig über dem Bild: weiter suchen und
  umschalten, ohne dass das Bild weg ist.
- „Zuletzt gesehen“ zeigt die letzten 20 Sender.

**News**
- Vier Kacheln mit je einem eigenen Thema aus 564 Themen (alphabetisch, mit Suche, oder eigenes eintippen).
  Jede Kachel blättert alle 9 Sekunden zum nächsten Artikel, mit Bild aus der Quelle (Bing News, sonst Google News).
  „Themen wählen“ unten rechts.

**Wetter**
- Neuer Wetterbericht (Schublade → Wetterbericht): jetzt mit gefühlter Temperatur, Luftfeuchte, Taupunkt, Druck,
  Wind, Böen, Sicht, UV; 7 Tage mit Höchst-/Tiefstwerten, gefühlt, Regenmenge und -wahrscheinlichkeit, Wind,
  Böen, UV, Sonnenstunden, Feuchte, Druck, Wolken, Sonnenauf- und -untergang.

## 1.1.0

**Kurz:** Neu: Welt-TV mit Suche, Kategorien, eigenen Quellen und Zuletzt gesehen, Farbstimmungen, Hintergrundbilder,
Rückkehr-Dienst. Behoben: EPG-Zeiten („NaN:NaN“), Senderliste, Bildschirmtastatur.

- Welt-TV ohne 400er-Grenze, Suche, aufklappbare Kategorien, Free-TV-Listen, eigene Quellen, Zuletzt gesehen,
  Scrollleiste mit Buchstabensprung.
- EPG-Zeiten (vorher „NaN:NaN“), „Danach“ und Senderliste repariert.
- Quadratische Glas-Kacheln, Farbstimmungen nach Wetter und Tageszeit, 17 Hintergrundbilder, Foto hinter allen Menüs.
- Rückkehr-Dienst: holt Free My TV+ nach anderen Apps zurück.
- Die Bildschirmtastatur verschiebt das Bild nicht mehr.

## 1.0.0

**Kurz:** Erste Version.

Erste Version: Startbildschirm auf Basis von Free My TV mit Sat-Programm und Livebild, Welt-TV, Cybersecurity-News,
werbefreiem YouTube über TizenTube, Wetter-Foto-Streifen und Werbe- und Tracking-Sperre.
