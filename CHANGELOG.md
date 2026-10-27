# Änderungen an Free My TV+

Jede Version steht hier oben; der Abschnitt der aktuellen Version wird beim Bauen automatisch als Text der
GitHub-Release übernommen.

## 1.2.0

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

- Welt-TV ohne 400er-Grenze, Suche, aufklappbare Kategorien, Free-TV-Listen, eigene Quellen, Zuletzt gesehen,
  Scrollleiste mit Buchstabensprung.
- EPG-Zeiten (vorher „NaN:NaN“), „Danach“ und Senderliste repariert.
- Quadratische Glas-Kacheln, Farbstimmungen nach Wetter und Tageszeit, 17 Hintergrundbilder, Foto hinter allen Menüs.
- Rückkehr-Dienst: holt Free My TV+ nach anderen Apps zurück.
- Die Bildschirmtastatur verschiebt das Bild nicht mehr.

## 1.0.0

Erste Version: Startbildschirm auf Basis von Free My TV mit Sat-Programm und Livebild, Welt-TV, Cybersecurity-News,
werbefreiem YouTube über TizenTube, Wetter-Foto-Streifen und Werbe- und Tracking-Sperre.
