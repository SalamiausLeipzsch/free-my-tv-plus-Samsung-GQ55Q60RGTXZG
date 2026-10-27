# Free My TV+ (Samsung)

Eine erweiterte Ausgabe von [Free My TV](https://github.com/simbasjungles/free-my-tv) (MIT-Lizenz) für Samsung-Fernseher ab 2017.
Free My TV+ wird als eigene App installiert und läuft neben dem normalen Free My TV.

## Was anders ist als bei Free My TV

| Bereich | Free My TV | Free My TV+ |
|---|---|---|
| Mitte (Tabs) | Film- und Serientipps (TMDB-Schlüssel nötig) | **Jetzt im TV**: Livebild des Sat-Senders, laufende und nächste Sendung aus dem EPG des Fernsehers, Senderliste mit dem aktuellen Programm · **Welt-TV**: freie Live-Sender aus aller Welt · **News** |
| Oben rechts und Schublade | Kryptokurse | **Cybersecurity-Schlagzeilen** (heise Security, heise Warnungen, Golem Security) |
| YouTube | normale App mit Werbung | **werbefrei**: öffnet TizenTube in TizenBrew (fehlt TizenBrew, die normale App) |
| Oben | heller Hintergrund | **Foto-Streifen** über die ganze Breite, passend zu Wetter und Tageszeit (Sonnenaufgang, Tag, Regen, Schnee, Nebel, Gewitter, Sonnenuntergang, blaue Stunde, Sternennacht …). Freie Pexels-Fotos, ohne Internet eine gezeichnete Szene |
| App-Leiste | Netflix, YouTube, Prime … | zusätzlich Twitch, Spotify, WOW/Sky, HD+, Samsung TV Plus, ZDF, ARD, Joyn, RTL+, DAZN, mit Logos (Simple Icons, CC0) |
| Bildschirmschoner | Fotos der Tipps | das Wetter-Foto in voller Größe |
| Werbung & Tracking | – | **Selbsttest und Anleitung** (Schublade → *Werbefrei*), **Sperrlisten** für Samsungs Werbe-, Tracking- und Zustimmungs-Server (`blocklist/`), Samsung-Werbe-Apps in Leiste und *Alle Apps* ausgeblendet |

Welt-TV nutzt die Senderlisten von [iptv-org](https://github.com/iptv-org/iptv), dieselbe Quelle wie tvgarden.world:
Deutsch, Deutschland, Österreich, Schweiz, Englisch, UK, USA, Nachrichten, Dokus, Musik, Kinder. Im Player schaltest du mit
▲ ▼ oder Programm +/- um, Zurück bringt dich zur Senderliste. Manche Sender laufen nur zeitweise oder nur im Herkunftsland („Geo“).

## Installieren (ohne Tizen Studio)

1. Dieses Projekt als **eigenes, öffentliches Repository** auf GitHub hochladen (z. B. `deinname/free-my-tv-plus`).
2. Auf GitHub: **Actions** → einmal Workflows erlauben → **„Samsung-App bauen“** → **Run workflow**. Nach 1–2 Minuten liegt
   unter **Releases** die fertige, signierte `FreeMyTVPlus-tizen.wgt`.
3. Am Fernseher: Entwicklermodus an (Apps → `1 2 3 4 5`), **Host PC IP = IP deines PCs**, Fernseher neu starten.
4. Am PC den **TizenBrew Installer** öffnen, mit dem TV verbinden und `deinname/free-my-tv-plus` eintippen.
5. Danach die **Host PC IP wieder auf `127.0.0.1`** stellen (sonst startet TizenBrew/TizenTube nicht) und neu starten.
6. Tipp: In den TV-Einstellungen **„Letzte App automatisch starten“** einschalten, dann startet der Fernseher direkt in Free My TV+.

**Updates:** Workflow erneut starten, dann wieder über den TizenBrew Installer installieren. Das Autor-Zertifikat bleibt im
Actions-Cache (wird er nach langer Pause gelöscht, lehnt der TV das Update ab: dann die alte App am TV löschen und neu installieren).
Wer das vermeiden will, hinterlegt ein Zertifikat dauerhaft als Secrets `TIZEN_AUTHOR_P12` (Base64) und `TIZEN_AUTHOR_PWD`.

**Falls die Installation mit einem Rechte-Fehler abbricht:** Manche Fernseher erlauben das Sat-Programm (`tv.channel`) für
Entwickler-Apps nicht. Dann in der Workflow-Datei `python3 tizen/build.py --generic` durch
`python3 tizen/build.py --generic --no-channel` ersetzen. Ohne das Recht zeigt „Jetzt im TV“ eine Live-TV-Kachel und Welt-TV-Sender.

## Werbung, Tracking und Zustimmungs-Abfragen loswerden

Samsungs Werbung im Menü, das Zuschauer-Tracking (ACR) und Abfragen wie „Personalisierte Werbung zulassen?“ kommen aus der
Firmware des Fernsehers, nicht aus einer App. Keine App kann sie abschalten. Was wirklich hilft, sind zwei Dinge, und
Free My TV+ hilft bei beiden: Schublade (▼) → **Werbefrei** zeigt die Schritte am TV und prüft per Selbsttest, ob dein
Netzwerk die Samsung-Server sperrt.

1. **Schalter am TV** (einmalig): Einstellungen → Support → Nutzungsbedingungen & Datenschutz → *Interessenbasierte Werbung*,
   *Dienste für Zuschauerinformationen* und *Spracherkennungsdienste* aus. Einstellungen → Allgemein → Smart-Funktionen →
   *Autom. Ausführung Smart Hub* aus, *Autom. Ausführung der letzten App* an. Wer keine Mediathek über den roten Knopf braucht:
   Einstellungen → Übertragung → Experteneinstellungen → *HbbTV* aus, das entfernt die Werbe-Einblendungen der Sat-Sender.
2. **DNS-Filter im Heimnetz** mit den Listen aus `blocklist/`. Damit erreicht der Fernseher die Server nicht mehr: Die Werbung
   bleibt leer, die Zustimmungs-Abfragen können nicht geladen werden.

| Datei | Sperrt | Risiko |
|---|---|---|
| `samsung-standard.txt` (Stufe 1, empfohlen) | Werbung, ACR-Tracking, Nutzungs- und Fehlerdaten | keins bekannt: Apps, Smart Hub und Updates laufen |
| `samsung-streng.txt` (Stufe 2, zusätzlich) | Hinweise, Nutzungsbedingungen, Zustimmungs-Abfragen, Promo- und Empfehlungsdienste | kann Smart-Hub-Funktionen, das Samsung-Konto oder den App-Store stören |
| `*-adguard.txt` | dasselbe im AdGuard-Home-Format (`\|\|domain^`, mit allen Unterdomains) | |
| `pihole-regex.txt` | RegEx für Pi-hole, sperrt alle Unterdomains der Werbe-Domains | |

Eintragen, je nachdem was du hast:

- **Am einfachsten, ohne Zusatzgerät** (auch für Router ohne Filter, z. B. Vodafone Station): **AdGuard DNS** direkt am TV.
  Einstellungen → Allgemein → Netzwerk → Netzwerkstatus → IP-Einstellungen → IP-Einstellung *Automatisch* lassen,
  DNS-Einstellung *Manuell eingeben* → `94.140.14.14` (Ausweich: `94.140.15.15`; öffentliche, kostenlose Server von AdGuard,
  kein Konto). Sperrt Werbung und Tracking nach AdGuards eigener Liste, nicht nach `blocklist/`; ob die Zustimmungs-Abfragen
  verschwinden, zeigt der Selbsttest. Datenschutz: AdGuard sieht, welche Namen der TV abfragt. Meldet der Test danach noch
  „erreichbar“, am TV IPv6 ausschalten (Netzwerk → Experteneinstellungen), sonst fragt der TV über IPv6 am Filter vorbei.
- **Pi-hole:** Adlists → Adresse `https://raw.githubusercontent.com/<dein-name>/free-my-tv-plus/main/blocklist/samsung-standard.txt`
  (bei Bedarf auch `samsung-streng.txt`), dann *Gravity aktualisieren*.
- **AdGuard Home:** Filter → DNS-Sperrlisten → Sperrliste hinzufügen → dieselbe Adresse mit `samsung-standard-adguard.txt`.
- **FRITZ!Box ohne Zusatzgerät:** Internet → Filter → Listen → *Gesperrte Internetseiten* → die Namen aus
  `samsung-standard.txt` eintragen; dann ein Zugangsprofil mit dieser Liste anlegen und dem Fernseher zuweisen.
- Danach am TV: Einstellungen → Allgemein → Netzwerk → Netzwerkstatus → IP-Einstellungen → DNS „Manuell eingeben“ → `IP vom Pi-hole`
  (bei der FRITZ!Box nicht nötig).

Absichtlich **nie gesperrt**: `samsungotn.net` (Firmware- und Sicherheitsupdates) und die Namen, bei denen die
Perflyst-Liste vor Störungen warnt. Die Listen stammen aus [Perflyst/PiHoleBlocklist](https://github.com/Perflyst/PiHoleBlocklist)
(MIT-Lizenz, `blocklist/LICENSE-Perflyst.txt`), für Free My TV+ in zwei Stufen sortiert.

Free My TV+ blendet außerdem Samsungs Werbe- und Promo-Apps (Samsung Health, Universal Guide, Promotion, Art Store,
Samsung Daily+, Gaming Hub …) in der Leiste und unter *Alle Apps* aus. Gelöscht werden sie nicht, das geht ohne Root nicht.
Abschalten: Start-Einstellungen → *Samsung-Werbe-Apps ausblenden*.

## Grenzen, ehrlich

- Getestet ist alles im Browser mit nachgebauten Samsung-Schnittstellen, noch nicht auf einem echten Fernseher.
- **Livebild in der Karte:** Samsung zeichnet das Fernsehbild unter die App; Free My TV+ spart die Stelle aus. Ob das auf jedem
  Modell klappt, zeigt erst der TV.
- **EPG:** kommt vom Sender selbst über Satellit. Manche Sender liefern nur „jetzt“ und „danach“, manche gar nichts.
- **YouTube werbefrei** braucht TizenBrew mit dem Modul TizenTube. Läuft TizenBrew schon im Hintergrund, öffnet sich eventuell
  nur TizenBrew statt direkt YouTube.
- **Fotos:** kommen live von Pexels. Fällt ein Foto aus, wird das nächste oder die gezeichnete Szene genommen.
- **News-Feeds:** werden direkt geladen; erlaubt ein Server das nicht, über die freien Dienste rss2json.com oder allorigins.win.
- **Selbsttest „Werbefrei“:** fragt die Samsung-Server direkt an. Ein „gesperrt“ heißt: Der Fernseher erreicht sie nicht
  (DNS-Filter wirkt, oder der Server ist gerade weg). Im PC-Browser zeigt er „nicht prüfbar“.
- **Stufe 2** ist ein Kompromiss: Samsung baut Hinweise und Konto-Dienste immer wieder um. Klemmt nach dem Eintragen etwas
  (App-Store lädt nicht, Anmeldung scheitert), Stufe 2 wieder entfernen.
- Die Signatur-Pipeline (GitHub Actions) konnte hier nicht ausprobiert werden, weil download.tizen.org nur dort erreichbar ist.

## Dateien

- `web/plus.js` – alles Neue: News, TizenTube-Start, Sat-EPG und Livebild, Welt-TV mit Player, Foto-Streifen, Werbefrei-Seite
- `blocklist/` – Sperrlisten für Pi-hole, AdGuard Home und FRITZ!Box
- `web/scene.js` – gezeichnete Ersatz-Szene für den Foto-Streifen
- `web/home.js`, `web/home.css`, `web/tv.js`, `web/index.html` – angepasst (markiert mit „Free My TV+“)
- `tools/sign_tizen.js`, `.github/workflows/tizen-release.yml` – signieren und Release ohne Tizen Studio
