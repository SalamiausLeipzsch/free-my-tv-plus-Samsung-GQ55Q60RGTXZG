# Änderungen an Free My TV+

Neueste Version oben. Jede Version beginnt mit einer kurzen Übersicht, danach folgen die Einzelheiten. Der Abschnitt der
aktuellen Version wird beim Bauen automatisch als Text der GitHub-Release übernommen.

## 1.5.0

**Kurz:** Neu: Govee-Licht steuern (Ein/Aus, Helligkeit, Farben, Weißton, Szenen, DIY, Musik-Modus, Segmente, DreamView,
auf Wunsch beim Start an), Recorder für Welt-TV auf USB-Stick oder Netzwerkspeicher (WebDAV), Programmführer mit Menü
(Ansehen/Erinnern, Info, Aufnehmen), ausführlicher Info-Seite, Zeitachse, Seitensprung und EPG-Suchlauf. Geändert:
Vollbild-Zoom in 3 s und ruhiger, Hintergrundfoto über den ganzen Bildschirm, dünnerer Livebild-Rahmen ohne Überstände,
Tageskarte aus Glas. Behoben: Bildschirmschoner im laufenden Programm, Fernsehbild in der Welt-TV-Senderwahl.

- Startseite: Livebild-Rahmen halb so dick, fast eckige Ecken wie das Fernsehbild (keine Überstände mehr beim Fokus), die drei
  Kacheln rechts schließen oben und unten mit dem Rahmen ab. Hintergrundfoto über den ganzen Bildschirm.
- Vollbild: in 3 s hinein, 1 s zurück; der Fernseher bekommt nur noch Schritte, die sich wirklich ändern, und die Oberfläche
  liegt auf eigenen Grafikebenen.
- Das Livebild erscheint nach der Schublade 0,75 s und nach Programmführer oder Senderliste 0,25 s später, damit zuerst die
  Oberfläche steht. In der Welt-TV-Senderwahl und der Licht-Steuerung ist kein Fernsehbild mehr in der Ecke.
- Schublade: Tageskarte als durchsichtiges Glas, Schrift wie Uhrzeit und Datum. Neue Verknüpfung „Licht“.
- Bildschirmschoner nur noch, wo kein Fernsehbild läuft (Welt-TV- und News-Seite), nie im laufenden Programm.
- Programmführer: ◄ ► wandert auf der Zeitachse (bis 48 Stunden voraus), P+/P− springt eine Seite (21 Sender), OK öffnet
  ein Menü mit „Programm ansehen“ (bei künftigen Sendungen „Erinnern“), „Info“ und „Aufnehmen“. Die Info-Seite zeigt groß
  Bild, Zeit, Sender, Genre, Mitwirkende, Regie, Beschreibung, weitere Termine und ähnliche Sendungen (Wikipedia). Das kurze
  Infofeld rechts endet über dem Fernsehbild. EPG frisch nach 1, 2 und 3 Minuten, dann alle 5 Minuten. Rote Taste:
  EPG-Suchlauf, der je Transponder kurz einen Sender einschaltet, damit der Tuner dessen Programmdaten einsammelt.
- Recorder: rote Taste im Welt-TV-Player nimmt auf (HLS), auf den USB-Stick (Ordner FreeMyTV-Aufnahmen) oder in einen
  Netzwerkordner per WebDAV (Segmente und Wiedergabeliste). Ziel, Adresse, Benutzer und Passwort im Mediaplayer; sie bleiben
  nur auf dem Fernseher. Aufnahmen sind im Mediaplayer abspielbar. Sat-Aufnahmen macht der Fernseher selbst: „Aufnehmen“
  schaltet um und öffnet das Fernsehbild für die REC-Taste, „Aufnahme planen“ und „Erinnern“ schalten zur Startzeit um.
- Licht (Govee, Cloud-API mit eigenem Schlüssel): Geräte und Regler entstehen aus dem, was jedes Gerät meldet; Regler senden
  erst, wenn die Taste ruht (Govee erlaubt 2 Befehle je Sekunde). Optional schaltet Free My TV+ das gewählte Licht beim Start
  an, mit DreamView, wo es das gibt.
- Neues Recht: Dateien schreiben (für Aufnahmen auf dem USB-Stick).

## 1.4.0

**Kurz:** Flüssiger: die App-Leiste ruckelt nicht mehr und reißt keine hellen Ecken mehr auf. Neu: das Livebild gleitet nach
20 s ohne Taste stufenlos ins Vollbild und auf Tastendruck zurück, Bauchbinde mit Sender und Sendung im Livebild-Rahmen,
Uhrzeit, Datum und Tageskarte oben in der Schublade. Behoben: Free My TV+ schloss sich nach längerem Schauen, im
Programmführer schaltete ▲ ▼ sofort um, EPG kam nur für wenige Sender.

- App-Leiste: Glaswürfel bleiben quadratisch und vergrößern sich im Fokus nur noch per GPU (transform). Das Holz kommt einmal
  als CSS-Regel statt bei jedem Schritt auf jede Kachel, der Filter im Glas ist weg (er ließ die runden Ecken beim Bewegen
  eckig und hell aufblitzen), nur sichtbare Kacheln werden angefasst.
- TV-Vollbild: nach 20 s ohne Taste wächst die Vorschau in 5 s stufenlos zum Vollbild, die Oberfläche dimmt dabei aus. Eine
  Taste dimmt sie in 1 s wieder auf und zieht das Bild zurück in die Vorschau.
- Startseite: Kacheln neu ausgemittelt (gleiche Abstände, Block mittig zwischen Tabs und Leiste), Sender und Sendung als
  Bauchbinde im Rahmen des Livebilds (schwarze Schrift mit zartem weißem Rand), Suche mit Lupe mittig.
- Schublade: oben wieder Uhrzeit, Datum und Tageskarte (heute Tiefst/Höchst, Sonnenzeiten), App-Leiste etwas höher, alles
  im gleichen Abstand.
- Hintergrundfoto auf allen Seiten bis 50 % der Höhe, dann sauber über 15 % ausgeblendet.
- Wetterbericht und Themenwahl ohne Fernsehbild in der Ecke.
- Start-Einstellungen: der Auswahlrahmen wird links und rechts nicht mehr abgeschnitten.
- Programmführer: ▲ ▼ wählt nur aus, OK schaltet um (OK auf dem laufenden Sender: zurück), P+/P− schaltet sofort. Der
  laufende Sender hat einen roten Strich. EPG wird nacheinander geladen: erst alle sichtbaren Sender im sichtbaren
  Zeitfenster, dann dieselben Sender bis Tagesende, danach die übrigen. Fernsehbild 10 % kleiner und über der Legende.
- Absturzschutz: der Hintergrunddienst holt Free My TV+ sofort zurück, wenn es im Vordergrund beendet wird (etwa weil der
  Speicher voll ist). Welt-TV-Streams halten nicht mehr alles Gesehene im Speicher (hls.js puffert nur noch kurz).

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
