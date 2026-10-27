# Free My TV+ (Samsung) – Anleitung · Guide

> 🇬🇧 **English version below** – [jump to English](#english)

Eine erweiterte Ausgabe von [Free My TV](https://github.com/simbasjungles/free-my-tv) (MIT-Lizenz) für Samsung-Fernseher ab 2017.
Free My TV+ wird als eigene App installiert und läuft neben dem normalen Free My TV. Was sich in jeder Version geändert hat,
steht in [CHANGELOG.md](CHANGELOG.md).

## Was anders ist als bei Free My TV

| Bereich | Free My TV | Free My TV+ |
|---|---|---|
| Mitte (Tabs) | Film- und Serientipps (TMDB-Schlüssel nötig) | **Jetzt im TV**: Livebild des Sat-Senders, laufende und nächste Sendung, Senderschalter, Programmführer · **Welt-TV**: freie Live-Sender aus aller Welt · **News** nach eigenen Themen |
| Schublade | Kryptokurse | Uhrzeit, Tageskarte, Wetter, Cybersecurity-Schlagzeilen, Mediaplayer, Licht (Govee), Werbefrei-Seite |
| YouTube | normale App mit Werbung | **werbefrei**: öffnet TizenTube in TizenBrew (fehlt TizenBrew, die normale App) |
| Hintergrund | hell | Foto passend zu Wetter und Tageszeit oder frei gewählt (Pexels), Farbstimmungen |
| App-Leiste | Netflix, YouTube, Prime … | Glaswürfel auf Holz, frei sortierbar, mit Logos (Simple Icons, CC0) |
| Werbung & Tracking | – | Selbsttest und Anleitung (Schublade → *Werbefrei*), Sperrlisten (`blocklist/`), Samsung-Werbe-Apps ausgeblendet |

Welt-TV nutzt die Senderlisten von [iptv-org](https://github.com/iptv-org/iptv) und [Free-TV/IPTV](https://github.com/Free-TV/IPTV),
dazu eigene M3U-Adressen. Manche Sender laufen nur zeitweise oder nur im Herkunftsland („Geo“); solche werden ausgeblendet.

## Installieren (ohne Tizen Studio)

1. Dieses Projekt als **eigenes, öffentliches Repository** auf GitHub anlegen (z. B. `dein-name/free-my-tv-plus`).
2. Auf GitHub: **Actions** → Workflows erlauben → **„Samsung-App bauen“** → **Run workflow**. Nach 1–2 Minuten liegt unter
   **Releases** die fertige, signierte `FreeMyTVPlus-tizen.wgt`.
3. Am Fernseher: Entwicklermodus an (Apps → `1 2 3 4 5`), **Host PC IP = IP vom PC**, Fernseher neu starten.
4. Am PC den **TizenBrew Installer** öffnen, mit dem TV verbinden (**IP vom TV**) und unter *Install from GitHub*
   `dein-name/free-my-tv-plus` eintippen.
5. Danach die **Host PC IP wieder auf `127.0.0.1`** stellen (sonst startet TizenBrew/TizenTube nicht) und neu starten.
6. Tipp: In den TV-Einstellungen **„Autom. Ausführung der letzten App“** einschalten, dann startet der Fernseher direkt in
   Free My TV+.

**Updates:** Workflow erneut starten, dann wieder über den TizenBrew Installer installieren. Das Autor-Zertifikat bleibt im
Actions-Cache (wird er nach langer Pause gelöscht, lehnt der TV das Update ab: dann die alte App am TV löschen und neu
installieren). Dauerhaft: Zertifikat als Secrets `TIZEN_AUTHOR_P12` (Base64) und `TIZEN_AUTHOR_PWD` hinterlegen.

**Falls die Installation mit einem Rechte-Fehler abbricht:** Manche Fernseher erlauben das Sat-Programm (`tv.channel`) für
Entwickler-Apps nicht. Dann im Workflow `python3 tizen/build.py --generic --no-channel` verwenden.

## Bedienung in Kürze

- **Startseite:** ▲ ▼ ◄ ► wählen, ◄ ► am Rand der Kacheln wechselt die Seite (Jetzt im TV, Welt-TV, News), OK öffnet, OK lang (oder rot) verschiebt App-Kacheln, ▼ öffnet die Schublade, P+/P−
  schaltet Sat-Sender um. Nach 20 s ohne Taste geht das Livebild ins Vollbild, jede Taste holt die Oberfläche zurück.
- **Programmführer** (OK auf der Senderkachel): ▲ ▼ Sender, P+/P− eine Seite, ◄ ► Zeitachse, OK Menü (Ansehen/Erinnern,
  Info, Aufnehmen), Info-Taste Info-Seite, rot EPG-Suchlauf (sammelt Programmdaten, schaltet dabei kurz durch die Sender).
- **Welt-TV-Player:** ▲ ▼ Sender, OK Menü über dem Bild, rot Aufnahme starten/beenden.
- **Unten rechts** steht auf jeder Seite, welche Tasten gerade gehen.

## Recorder

- **Welt-TV** (HLS-Streams): rote Taste im Player. Ziel im Mediaplayer wählen: **USB-Stick** (Ordner `FreeMyTV-Aufnahmen`,
  eine `.ts`-Datei, ab 3,9 GB eine neue) oder **Netzwerkspeicher per WebDAV** (z. B. `http://IP-vom-NAS:5005/aufnahmen/`,
  je Aufnahme ein Ordner mit Segmenten und `playlist.m3u8`, spielbar mit VLC oder im Mediaplayer). Benutzer und Passwort
  bleiben nur auf dem Fernseher. SMB- und NFS-Freigaben kann eine TV-Web-App nicht ansprechen; die meisten NAS bieten WebDAV
  als Zusatzdienst an. Verschlüsselte Streams lassen sich nicht aufnehmen.
- **Sat-TV:** Eine fremde App kann Sat-Sender nicht aufnehmen. „Aufnehmen“ schaltet um und öffnet das Fernsehbild, dort die
  REC-Taste drücken. Der Fernseher nimmt dafür nur auf eine **USB-Festplatte** auf (mind. 5.400 U/min), nicht auf
  USB-Sticks; seine Aufnahmen sind kopiergeschützt (DRM). HD+-Sender erlauben das teils nicht. Mit Twin-Tuner (Eingänge
  SATELLITE MAIN und SUB, Verbindungstyp „Dual“) nimmt er auf, während du einen anderen Sender schaust.

## Licht (Govee)

Schublade → **Licht**. Gesteuert wird über die offizielle Govee-Cloud-API (die LAN-Steuerung bräuchte UDP, das können
Samsung-Web-Apps nicht). Nötig:

1. Das Licht in der Govee-Home-App mit dem **WLAN** verbinden (nur Bluetooth reicht nicht).
2. In der Govee-Home-App: Profil → Einstellungen → **API-Schlüssel beantragen** (kommt per E-Mail, kostenlos).
3. Den Schlüssel einmal am TV eintippen. Er bleibt nur auf dem Fernseher.

Welche Regler erscheinen (Ein/Aus, Helligkeit, Farbe, Weißton, Szenen, DIY, Musik-Modus, Segmente, DreamView …), meldet
jedes Gerät selbst. Govee erlaubt 2 Befehle je Sekunde und Gerät; Regler senden deshalb erst, wenn die Taste ruht.

## Werbung, Tracking und Zustimmungs-Abfragen loswerden

Samsungs Werbung im Menü, das Zuschauer-Tracking (ACR) und Abfragen wie „Personalisierte Werbung zulassen?“ kommen aus der
Firmware des Fernsehers, nicht aus einer App. Was wirklich hilft, sind zwei Dinge; Schublade → **Werbefrei** zeigt die
Schritte am TV und prüft per Selbsttest, ob das Netzwerk die Samsung-Server sperrt.

1. **Schalter am TV:** Einstellungen → Unterstützung (Schild-Symbol) → *AGBs & Datenschutz* → Zustimmungen zu
   interessenbasierter Werbung, Zuschauerinformationen und Spracherkennung zurückziehen. Einstellungen → Allgemein →
   Smart-Funktionen → *Autom. Ausführung Smart Hub* aus, *Autom. Ausführung der letzten App* an. Wer keine Mediathek über
   den roten Knopf braucht: *HbbTV* aus.
2. **DNS-Filter** mit den Listen aus `blocklist/`.

| Datei | Sperrt | Risiko |
|---|---|---|
| `samsung-standard.txt` (Stufe 1, empfohlen) | Werbung, ACR-Tracking, Nutzungs- und Fehlerdaten | keins bekannt |
| `samsung-streng.txt` (Stufe 2, zusätzlich) | Hinweise, Nutzungsbedingungen, Zustimmungs-Abfragen, Promo-Dienste | kann Smart Hub, Konto oder App-Store stören |
| `*-adguard.txt` | dasselbe im AdGuard-Home-Format | |
| `pihole-regex.txt` | RegEx für Pi-hole | |

- **Ohne Zusatzgerät** (auch bei Routern ohne Filter): **AdGuard DNS** am TV. Netzwerk → Netzwerkstatus → IP-Einstellungen
  → DNS *Manuell eingeben* → `94.140.14.14` (Ausweich `94.140.15.15`). Meldet der Selbsttest danach noch „erreichbar“, am TV
  IPv6 ausschalten.
- **Pi-hole:** Adlists → `https://raw.githubusercontent.com/dein-name/free-my-tv-plus/main/blocklist/samsung-standard.txt`,
  dann *Gravity aktualisieren*; am TV DNS → `IP vom Pi-hole`.
- **AdGuard Home:** Filter → DNS-Sperrlisten → dieselbe Adresse mit `samsung-standard-adguard.txt`.
- **FRITZ!Box:** Internet → Filter → Listen → *Gesperrte Internetseiten* → Namen aus `samsung-standard.txt`, Zugangsprofil
  dem Fernseher zuweisen.

Absichtlich **nie gesperrt**: `samsungotn.net` (Firmware- und Sicherheitsupdates). Die Listen stammen aus
[Perflyst/PiHoleBlocklist](https://github.com/Perflyst/PiHoleBlocklist) (MIT, `blocklist/LICENSE-Perflyst.txt`).

## Grenzen, ehrlich

- **Fernsehbild:** Auf Samsung-Fernsehern liegt das Sat-Bild über der App. Text direkt auf dem laufenden Bild geht deshalb
  nicht, und das Bild lässt sich nicht ruckelfrei vergrößern (darum der Rahmen beim Übergang ins Vollbild).
- **EPG:** kommt vom Sat-Tuner. Er kennt nur Daten von Transpondern, auf denen er zuletzt war. Free My TV+ sammelt sie
  automatisch: über den 2. Empfänger im Hintergrund, wenn Samsung das der App erlaubt, sonst nachts (3–5 Uhr, wenn lange
  keine Taste gedrückt wurde; abschaltbar in den Start-Einstellungen). Die rote Taste im Programmführer startet es sofort.
  Einen direkten Zugriff aufs CI+-Modul gibt es für Apps nicht.
- **Home-Taste:** öffnet weiterhin Samsungs Leiste; der Rückkehr-Dienst holt Free My TV+ nach anderen Apps zurück.
- **Welt-TV:** freie Sender laufen nicht immer; Pay-TV-Sender wie ESPN gibt es nicht legal kostenlos und sind nicht drin.
- **Fotos, News, Wikipedia, Logos** kommen live aus dem Internet; fällt etwas aus, bleibt die Kachel schlicht.

## Datenschutz

Free My TV+ speichert alles nur auf dem Fernseher (Einstellungen, Themen, Zuletzt gesehen, Govee-Schlüssel,
Netzwerkspeicher-Zugang). Es gibt kein Konto und keine Auswertung. Abgerufen werden nur die genannten öffentlichen Dienste
(Open-Meteo, iptv-org/Free-TV, Bing/Google News, Wikipedia, Pexels, tv-logos, auf Wunsch Govee).

## Dateien

- `web/plus.js` – alles Neue: Sat-TV, Programmführer, Welt-TV mit Player und Recorder, News, Wetter, Mediaplayer, Licht
- `web/home.js`, `web/home.css`, `web/index.html` – Startseite, angepasst (markiert mit „Free My TV+“)
- `web/service/service.js` – Rückkehr-Dienst
- `web/topics.js`, `web/logos.js` – News-Themen und Namen der Senderlogos
- `blocklist/` – Sperrlisten für Pi-hole, AdGuard Home und FRITZ!Box
- `.github/workflows/tizen-release.yml` – signieren und Release ohne Tizen Studio

---

<a id="english"></a>

# English

An extended edition of [Free My TV](https://github.com/simbasjungles/free-my-tv) (MIT licence) for Samsung TVs from 2017.
Free My TV+ installs as an app of its own and runs alongside the regular Free My TV. The interface is in German. What changed
in each version is in [CHANGELOG.md](CHANGELOG.md).

## How it differs from Free My TV

| Area | Free My TV | Free My TV+ |
|---|---|---|
| Middle (tabs) | film and series picks (TMDB key needed) | **Jetzt im TV** (now on TV): live satellite picture, current and next programme, channel switcher, TV guide · **Welt-TV** (World TV): free live channels from around the world · **News** by your own topics |
| Drawer | crypto prices | time, day card, weather, cybersecurity headlines, media player, light (Govee), ad-free page |
| YouTube | regular app with ads | **ad-free**: opens TizenTube in TizenBrew (the regular app without TizenBrew) |
| Background | light | a photo matching weather and time of day, or one you pick (Pexels), colour moods |
| App bar | Netflix, YouTube, Prime … | glass cubes on wood, freely sortable, with logos (Simple Icons, CC0) |
| Ads & tracking | – | self-test and guide (drawer → *Werbefrei*), blocklists (`blocklist/`), Samsung promo apps hidden |

World TV uses the channel lists of [iptv-org](https://github.com/iptv-org/iptv) and [Free-TV/IPTV](https://github.com/Free-TV/IPTV),
plus your own M3U addresses. Some channels only run part-time or only in their home country ("geo"); those are hidden.

## Install (without Tizen Studio)

1. Put this project in a **repository of your own, public**, on GitHub (e.g. `your-name/free-my-tv-plus`).
2. On GitHub: **Actions** → allow workflows → **"Samsung-App bauen"** → **Run workflow**. After 1–2 minutes the signed
   `FreeMyTVPlus-tizen.wgt` is under **Releases**.
3. On the TV: Developer Mode on (Apps → `1 2 3 4 5`), **Host PC IP = IP of the PC**, restart the TV.
4. On the PC, open the **TizenBrew Installer**, connect to the TV (**IP of the TV**) and under *Install from GitHub* type
   `your-name/free-my-tv-plus`.
5. Then set **Host PC IP back to `127.0.0.1`** (TizenBrew/TizenTube won't start otherwise) and restart.
6. Tip: turn on **"Autorun Last App"** in the TV settings so the TV starts straight into Free My TV+.

**Updates:** run the workflow again, then install again with the TizenBrew Installer. The author certificate stays in the
Actions cache (if it's cleared after a long pause, the TV refuses the update: remove the old app on the TV and install again).
To keep it for good, store a certificate as the secrets `TIZEN_AUTHOR_P12` (Base64) and `TIZEN_AUTHOR_PWD`.

**If installing fails with a permission error:** some TVs don't allow satellite TV (`tv.channel`) for developer apps. Use
`python3 tizen/build.py --generic --no-channel` in the workflow.

## Controls in short

- **Home:** ▲ ▼ ◄ ► select, ◄ ► at the edge of the tiles changes the page (Jetzt im TV, Welt-TV, News), OK opens, long OK (or red) moves app tiles, ▼ opens the drawer, P+/P− changes satellite channels.
  After 20 s without a key the live picture goes full screen; any key brings the interface back.
- **TV guide** (OK on the channel tile): ▲ ▼ channels, P+/P− a page, ◄ ► timeline, OK menu (watch/remind, info, record), Info
  key info page, red EPG scan (collects programme data, briefly tuning through the channels).
- **World TV player:** ▲ ▼ channels, OK menu over the picture, red starts/stops recording.
- **Bottom right** every page shows which keys work right now.

## Recorder

- **World TV** (HLS streams): red button in the player. Pick the target in the media player: **USB stick** (folder
  `FreeMyTV-Aufnahmen`, one `.ts` file, a new one after 3.9 GB) or **network storage via WebDAV** (e.g.
  `http://IP-of-the-NAS:5005/recordings/`, one folder per recording with segments and `playlist.m3u8`, playable in VLC or the
  media player). User and password stay on the TV only. A TV web app can't reach SMB or NFS shares; most NAS offer WebDAV as an
  add-on. Encrypted streams can't be recorded.
- **Satellite TV:** a third-party app can't record satellite channels. "Record" tunes and opens the TV picture; press the TV's
  REC button there. The TV only records to a **USB hard drive** (at least 5,400 rpm), not to USB sticks; its
  recordings are copy-protected (DRM). Some HD+ channels don't allow it. With the twin tuner (inputs SATELLITE MAIN and SUB,
  connection type "Dual") it records while you watch another channel.

## Light (Govee)

Drawer → **Licht**. Controlled through Govee's official cloud API (LAN control would need UDP, which Samsung web apps can't
send). You need:

1. The light connected to **Wi-Fi** in the Govee Home app (Bluetooth alone isn't enough).
2. In the Govee Home app: profile → settings → **apply for an API key** (free, sent by e-mail).
3. Type the key once on the TV. It stays on the TV only.

Which controls appear (power, brightness, colour, white temperature, scenes, DIY, music mode, segments, DreamView …) is
reported by each device. Govee allows 2 commands per second per device, so controls only send once the key rests.

## Getting rid of ads, tracking and consent prompts

Samsung's menu ads, viewer tracking (ACR) and prompts like "Allow personalised ads?" come from the TV's firmware, not from an
app. Two things really help; drawer → **Werbefrei** shows the steps on the TV and self-tests whether your network blocks
Samsung's servers.

1. **TV settings:** Settings → Support (shield icon) → *Terms & Privacy* → withdraw consent for interest-based ads, viewing
   information and voice recognition. Settings → General → Smart Features → *Autorun Smart Hub* off, *Autorun Last App* on.
   If you don't need catch-up TV on the red button: *HbbTV* off.
2. **A DNS filter** with the lists in `blocklist/`.

| File | Blocks | Risk |
|---|---|---|
| `samsung-standard.txt` (level 1, recommended) | ads, ACR tracking, usage and error data | none known |
| `samsung-streng.txt` (level 2, extra) | notices, terms, consent prompts, promo services | may disturb Smart Hub, account or app store |
| `*-adguard.txt` | the same in AdGuard Home format | |
| `pihole-regex.txt` | RegEx for Pi-hole | |

- **No extra device** (also for routers without a filter): **AdGuard DNS** on the TV. Network → Network Status → IP Settings →
  DNS *Enter manually* → `94.140.14.14` (fallback `94.140.15.15`). If the self-test still says "reachable", turn off IPv6 on
  the TV.
- **Pi-hole:** Adlists → `https://raw.githubusercontent.com/your-name/free-my-tv-plus/main/blocklist/samsung-standard.txt`,
  then *Update Gravity*; on the TV set DNS → `IP of the Pi-hole`.
- **AdGuard Home:** Filters → DNS blocklists → the same address with `samsung-standard-adguard.txt`.
- **FRITZ!Box:** Internet → Filters → Lists → *Blocked websites* → the names from `samsung-standard.txt`, assign an access
  profile to the TV.

Deliberately **never blocked**: `samsungotn.net` (firmware and security updates). The lists come from
[Perflyst/PiHoleBlocklist](https://github.com/Perflyst/PiHoleBlocklist) (MIT, `blocklist/LICENSE-Perflyst.txt`).

## Limits, honestly

- **TV picture:** on Samsung TVs the satellite picture lies above the app, so text can't sit on the moving picture, and the
  picture can't be scaled smoothly (hence the frame for the full-screen transition).
- **EPG:** comes from the satellite tuner, which only knows data from transponders it was on recently. Free My TV+ collects it
  automatically: in the background over the second tuner if Samsung allows the app to use it, otherwise at night (3–5 am, after
  a long time without a key press; can be turned off in the home settings). The red button in the TV guide starts it at once.
  Apps have no direct access to the CI+ module.
- **Home button:** still opens Samsung's bar; the return service brings Free My TV+ back after other apps.
- **World TV:** free channels don't always run; pay-TV channels such as ESPN aren't legally free and aren't included.
- **Photos, news, Wikipedia, logos** come live from the internet; if something fails, the tile stays plain.

## Privacy

Free My TV+ keeps everything on the TV only (settings, topics, recently watched, Govee key, network storage login). No
account, no analytics. It only calls the public services named above (Open-Meteo, iptv-org/Free-TV, Bing/Google News,
Wikipedia, Pexels, tv-logos, Govee if you set it up).

## Files

- `web/plus.js` – everything new: satellite TV, TV guide, World TV with player and recorder, news, weather, media player, light
- `web/home.js`, `web/home.css`, `web/index.html` – the home screen, adapted (marked "Free My TV+")
- `web/service/service.js` – return service
- `web/topics.js`, `web/logos.js` – news topics and channel logo names
- `blocklist/` – blocklists for Pi-hole, AdGuard Home and FRITZ!Box
- `.github/workflows/tizen-release.yml` – signing and release without Tizen Studio
