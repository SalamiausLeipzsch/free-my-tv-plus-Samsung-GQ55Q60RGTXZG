# Änderungen an Free My TV+ · Changes to Free My TV+

> 🇬🇧 **English below:** every version has an English section right after the German one.

Neueste Version oben. Jede Version beginnt mit einer kurzen Übersicht, danach folgen die Einzelheiten, dann dasselbe auf
Englisch. Der Abschnitt der aktuellen Version wird beim Bauen automatisch als Text der GitHub-Release übernommen.

*Newest version first. Each version starts with a short summary, then the details, then the same in English. The current
version's section becomes the GitHub release text automatically.*

## 1.6.0

**Kurz:** Vollbild-Übergang neu und flüssig (ein Rahmen wächst per GPU, das Fernsehbild springt nur einmal). Neu: Live-Vorschau
eines kostenlosen US-Sportsenders in Welt-TV, Senderlogos im Programmführer. Geändert: Programmführer mit größerer Schrift
(15 Zeilen), P+/P− andersherum, Fernsehbild läuft in der Info-Seite weiter, Livebild nach der Schublade nach 0,25 s.

- Vollbild: Das Fernsehbild selbst lässt sich nicht ruckelfrei vergrößern (jeder Schritt muss der Fernseher neu setzen).
  Jetzt wächst stattdessen ein schwarzer Rahmen stufenlos von der Vorschau zum Vollbild (1,2 s), die Oberfläche blendet
  dabei aus, und erst dann springt das Bild in einem einzigen Schritt auf Vollbild. Zurück genauso (0,8 s).
- Welt-TV: Die große Kachel zeigt live und ohne Ton einen kostenlosen US-Sportsender (CBS Sports Golazo, beIN SPORTS XTRA,
  Fubo Sports, NBC Sports NOW, Tennis Channel oder Willow, je nachdem, was gerade läuft). ESPN gibt es nicht legal kostenlos;
  Pay-TV-Kopien aus freien Listen werden bewusst nicht genommen. OK öffnet den Sender im Vollbild.
- Programmführer: 15 statt 21 Zeilen, dafür größere Schrift bei Sendern, Sendungen und Zeiten; Senderlogo zwischen Nummer und
  Name (aus dem Projekt tv-logo/tv-logos); P+ blättert eine Seite nach oben, P− nach unten; in der Info-Seite läuft das
  Fernsehbild rechts unten weiter.
- Das Livebild erscheint nach der Schublade 0,25 s später (vorher 0,75 s).

**English**

**Summary:** New, smooth full-screen transition (a frame grows on the GPU, the TV picture jumps only once). New: live preview
of a free US sports channel in World TV, channel logos in the TV guide. Changed: TV guide with larger text (15 rows),
P+/P− reversed, the TV picture keeps playing on the info page, the live picture returns 0.25 s after the drawer.

- Full screen: the TV's video plane can't be scaled smoothly (the TV has to place every step). Instead a black frame now grows
  smoothly from the preview to full screen (1.2 s) while the interface fades out, and only then the picture jumps to full
  screen in a single step. Back the same way (0.8 s).
- World TV: the large tile plays a free US sports channel live and muted (CBS Sports Golazo, beIN SPORTS XTRA, Fubo Sports,
  NBC Sports NOW, Tennis Channel or Willow, whichever is on air). ESPN isn't legally free; pay-TV copies from free lists are
  deliberately left out. OK opens the channel full screen.
- TV guide: 15 rows instead of 21 with larger text for channels, programmes and times; channel logo between number and name
  (from the tv-logo/tv-logos project); P+ pages up, P− pages down; the TV picture keeps playing bottom right on the info page.
- The live picture comes back 0.25 s after the drawer (was 0.75 s).

## 1.5.0

**Kurz:** Neu: Govee-Licht steuern (Ein/Aus, Helligkeit, Farben, Weißton, Szenen, DIY, Musik-Modus, Segmente, DreamView,
auf Wunsch beim Start an), Recorder für Welt-TV auf USB-Stick oder Netzwerkspeicher (WebDAV), Programmführer mit Menü
(Ansehen/Erinnern, Info, Aufnehmen), ausführlicher Info-Seite, Zeitachse, Seitensprung und EPG-Suchlauf. Geändert:
Vollbild-Zoom in 3 s, Hintergrundfoto über den ganzen Bildschirm, dünnerer Livebild-Rahmen ohne Überstände, Tageskarte aus
Glas. Behoben: Bildschirmschoner im laufenden Programm, Fernsehbild in der Welt-TV-Senderwahl.

- Startseite: Livebild-Rahmen halb so dick, fast eckige Ecken wie das Fernsehbild, die drei Kacheln rechts schließen oben und
  unten mit dem Rahmen ab. Hintergrundfoto über den ganzen Bildschirm.
- Das Livebild erscheint nach Programmführer oder Senderliste 0,25 s später, damit zuerst die Oberfläche steht. In der
  Welt-TV-Senderwahl und der Licht-Steuerung ist kein Fernsehbild mehr in der Ecke.
- Schublade: Tageskarte als durchsichtiges Glas. Neue Verknüpfung „Licht“.
- Bildschirmschoner nur noch, wo kein Fernsehbild läuft (Welt-TV- und News-Seite).
- Programmführer: ◄ ► wandert auf der Zeitachse (bis 48 Stunden voraus), P+/P− springt eine Seite, OK öffnet ein Menü mit
  „Programm ansehen“ (bei künftigen Sendungen „Erinnern“), „Info“ und „Aufnehmen“. Die Info-Seite zeigt groß Bild, Zeit,
  Sender, Genre, Mitwirkende, Regie, Beschreibung, weitere Termine und ähnliche Sendungen (Wikipedia). EPG frisch nach 1, 2
  und 3 Minuten, dann alle 5 Minuten. Rote Taste: EPG-Suchlauf, der je Transponder kurz einen Sender einschaltet.
- Recorder: rote Taste im Welt-TV-Player nimmt auf (HLS), auf den USB-Stick (Ordner FreeMyTV-Aufnahmen) oder in einen
  Netzwerkordner per WebDAV. Ziel, Adresse, Benutzer und Passwort im Mediaplayer; sie bleiben nur auf dem Fernseher.
  Sat-Aufnahmen macht der Fernseher selbst: „Aufnehmen“ schaltet um und öffnet das Fernsehbild für die REC-Taste.
- Licht (Govee, Cloud-API mit eigenem Schlüssel): Regler entstehen aus dem, was jedes Gerät meldet. Optional schaltet
  Free My TV+ das gewählte Licht beim Start an, mit DreamView, wo es das gibt.
- Neues Recht: Dateien schreiben (für Aufnahmen auf dem USB-Stick).

**English**

**Summary:** New: Govee light control (power, brightness, colours, white temperature, scenes, DIY, music mode, segments,
DreamView, optionally on at start), recorder for World TV to a USB stick or network storage (WebDAV), TV guide with a menu
(watch/remind, info, record), a detailed info page, timeline, page jumps and an EPG scan. Changed: 3 s full-screen zoom,
background photo across the whole screen, thinner live picture frame without overhangs, glass day card. Fixed: screensaver
during live TV, TV picture in the World TV channel picker.

- Home: live frame half as thick with nearly square corners like the TV picture; the three tiles on the right line up with
  the frame. Background photo across the whole screen.
- The live picture appears 0.25 s after the TV guide or channel list so the interface is in place first. No corner TV picture
  in the World TV picker and the light controls.
- Drawer: day card as clear glass. New shortcut "Licht" (light).
- Screensaver only where no TV picture is shown (World TV and News pages).
- TV guide: ◄ ► moves along the timeline (up to 48 hours ahead), P+/P− jumps a page, OK opens a menu with "watch" ("remind"
  for future programmes), "info" and "record". The info page shows a large picture, time, channel, genre, cast, director,
  description, more airings and similar shows (Wikipedia). EPG refresh after 1, 2 and 3 minutes, then every 5 minutes. Red
  button: EPG scan that briefly tunes one channel per transponder.
- Recorder: the red button in the World TV player records (HLS) to the USB stick (folder FreeMyTV-Aufnahmen) or a network
  folder via WebDAV. Target, address, user and password are set in the media player and stay on the TV only. Satellite
  recordings are done by the TV itself: "record" tunes and opens the TV picture for its REC button.
- Light (Govee cloud API with your own key): the controls come from what each device reports. Optionally Free My TV+ turns
  the chosen light on at start, with DreamView where available.
- New permission: write files (for recordings on the USB stick).

## 1.4.0

**Kurz:** Flüssiger: die App-Leiste ruckelt nicht mehr und reißt keine hellen Ecken mehr auf. Neu: das Livebild gleitet nach
20 s ohne Taste ins Vollbild und auf Tastendruck zurück, Bauchbinde mit Sender und Sendung im Livebild-Rahmen, Uhrzeit, Datum
und Tageskarte oben in der Schublade. Behoben: Free My TV+ schloss sich nach längerem Schauen, im Programmführer schaltete
▲ ▼ sofort um, EPG kam nur für wenige Sender.

- App-Leiste: Glaswürfel bleiben quadratisch und vergrößern sich im Fokus nur noch per GPU. Das Holz kommt einmal als
  CSS-Regel, der Filter im Glas ist weg (er ließ die runden Ecken eckig aufblitzen).
- Startseite: Kacheln neu ausgemittelt, Sender und Sendung als Bauchbinde im Rahmen des Livebilds, Suche mittig.
- Schublade: oben wieder Uhrzeit, Datum und Tageskarte, alles im gleichen Abstand.
- Programmführer: ▲ ▼ wählt nur aus, OK schaltet um; EPG wird nacheinander geladen.
- Absturzschutz: der Hintergrunddienst holt Free My TV+ zurück, wenn es im Vordergrund beendet wird. Welt-TV-Streams
  puffern nur noch kurz.

**English**

**Summary:** Smoother: the app bar no longer stutters or flashes bright corners. New: after 20 s without a key press the live
picture goes full screen and returns on any key, a caption with channel and programme in the live frame, time, date and day
card at the top of the drawer. Fixed: Free My TV+ closing after longer viewing, ▲ ▼ tuning immediately in the TV guide, EPG
for only a few channels.

- App bar: glass cubes stay square and only scale on the GPU when focused. The wood is set once as a CSS rule, the filter in
  the glass is gone (it made the rounded corners flash square).
- Home: tiles re-centred, channel and programme as a caption in the live frame, search centred.
- Drawer: time, date and day card back at the top, evenly spaced.
- TV guide: ▲ ▼ only selects, OK tunes; the EPG loads one request at a time.
- Crash guard: the background service brings Free My TV+ back if it is closed while in front. World TV streams only buffer
  briefly.

## 1.3.0

**Kurz:** Neu: TV-Vollbild ohne Taste, Programmführer, Mediaplayer (USB und Adressen), Tasten-Legende auf jeder Seite,
wählbare Farbe des Auswahlrahmens, über 2.500 News-Themen mit A–Z. Geändert: Foto-Streifen höher, App-Leiste als Glaswürfel
auf Holz in voller Breite, Schublade mit Wetter oben und Abendrot-Hintergrund, Fernsehbild klein in der Ecke über Menüs.

- Senderkachel: OK öffnet den Programmführer mit Zeitleiste und Infos.
- Legende unten rechts mit den Tasten der aktuellen Seite; Auswahlrahmen überall, Farbe wählbar.
- Schublade: Mediaplayer (USB-Speicher durchsuchen, Video, Musik und Bilder abspielen, Stream-Adressen).
- News: über 2.500 Themen (u. a. alle deutschen Städte ab etwa 50.000 Einwohnern), Auswahl über A–Z, Suche oder eigenes Thema.

**English**

**Summary:** New: full-screen TV after idle, TV guide, media player (USB and addresses), key legend on every page, selectable
focus frame colour, over 2,500 news topics with A–Z. Changed: taller photo band, app bar as glass cubes on wood at full width,
drawer with the weather on top and a sunset background, small TV picture in the corner over menus.

- Channel tile: OK opens the TV guide with a timeline and info.
- Legend bottom right with the keys of the current page; focus frame everywhere, colour selectable.
- Drawer: media player (browse USB storage, play video, music and pictures, stream addresses).
- News: over 2,500 topics (including every German city above about 50,000 inhabitants), picked via A–Z, search or your own.

## 1.2.0

**Kurz:** Neu: Senderkachel zum Umschalten, Suchkachel, Infofeld in der Senderliste, Länderkennung und Länderfilter in
Welt-TV, Welt-TV-Menü über dem laufenden Sender, News nach eigenen Themen, Wetterbericht. Behoben: Sendernummern
(„22.65534“), Geo-gesperrte Sender. Geändert: Uhrzeit statt „Für dich“, helle Glas-Kacheln, blauer Fokusrahmen.

- App-Kacheln verschieben: OK lange drücken (oder rote Taste), dann ← →, OK legt ab.
- Senderliste mit laufender Sendung und Infofeld (Beschreibung, Zeiten, danach, Bild und Text von Wikipedia).
- Welt-TV: Länderkennung, laufende Sendung, nur hier empfangbare Varianten, Länderfilter, halbdurchsichtiges Menü über dem
  Bild, die letzten 20 Sender.
- News: vier Kacheln mit eigenen Themen, blättern mit Bild aus der Quelle.
- Wetterbericht mit allen wichtigen Werten für 7 Tage.

**English**

**Summary:** New: channel switcher tile, search tile, info panel in the channel list, country codes and country filters in
World TV, World TV menu over the playing channel, news by your own topics, weather report. Fixed: channel numbers
("22.65534"), geo-blocked channels. Changed: clock instead of "For you", light glass tiles, blue focus frame.

- Move app tiles: long-press OK (or the red button), then ← →, OK drops it.
- Channel list with the current programme and an info panel (description, times, next, picture and text from Wikipedia).
- World TV: country codes, current programme, variants that play here, country filters, a translucent menu over the picture,
  the last 20 channels.
- News: four tiles with your own topics, paging with pictures from the source.
- Weather report with all the important values for 7 days.

## 1.1.0

**Kurz:** Neu: Welt-TV mit Suche, Kategorien, eigenen Quellen und Zuletzt gesehen, Farbstimmungen, Hintergrundbilder,
Rückkehr-Dienst. Behoben: EPG-Zeiten („NaN:NaN“), Senderliste, Bildschirmtastatur.

**English**

**Summary:** New: World TV with search, categories, custom sources and recently watched, colour moods, background pictures,
a return service. Fixed: EPG times ("NaN:NaN"), channel list, on-screen keyboard.

## 1.0.0

**Kurz:** Erste Version: Startbildschirm auf Basis von Free My TV mit Sat-Programm und Livebild, Welt-TV, Cybersecurity-News,
werbefreiem YouTube über TizenTube, Wetter-Foto-Streifen und Werbe- und Tracking-Sperre.

**English**

**Summary:** First version: a home screen based on Free My TV with satellite TV and live picture, World TV, cybersecurity
news, ad-free YouTube via TizenTube, a weather photo band and ad and tracking blocking.
