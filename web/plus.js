/*
 * Free My TV+ (Erweiterung): alles, was diese Ausgabe zur normalen Free My TV dazubringt.
 *  - Cybersecurity-News statt Kryptokursen (RSS/Atom, heise Security und Golem)
 *  - YouTube werbefrei: oeffnet TizenTube ueber TizenBrew statt der normalen YouTube-App
 *  - "Jetzt im TV": das laufende Sat-Programm (EPG des Fernsehers) mit Livebild in der grossen Karte
 *  - Welt-TV: frei empfangbare Live-Sender aus der iptv-org-Liste (dieselbe Quelle wie tvgarden.world)
 *  - der Foto-Streifen oben, passend zu Wetter und Tageszeit (freie Pexels-Fotos, sonst eine gezeichnete Szene)
 * ES5 wie der Rest von web/: aeltere TVs (Tizen 3 bis 5) laufen mit einem Chromium von 2015 bis 2018.
 */
var Plus = (function () {
  'use strict';

  var samsung = typeof window.tizen !== 'undefined' && !!window.tizen.application;
  var listeners = [];
  function changed() { for (var i = 0; i < listeners.length; i++) { try { listeners[i](); } catch (e) {} } }

  function store(key, value) { try { localStorage.setItem('fmtvplus.' + key, JSON.stringify(value)); } catch (e) {} }
  function stored(key) { try { return JSON.parse(localStorage.getItem('fmtvplus.' + key)); } catch (e) { return null; } }

  /** GET as text; done(error, text). */
  function getText(url, done, timeout) {
    var x = new XMLHttpRequest(), over = false;
    try { x.open('GET', url, true); } catch (e) { done(e); return; }
    x.timeout = timeout || 12000;
    x.onreadystatechange = function () {
      if (x.readyState !== 4 || over) return;
      over = true;
      if (x.status !== 200 || !x.responseText) { done(new Error('HTTP ' + x.status)); return; }
      done(null, x.responseText);
    };
    x.ontimeout = x.onerror = function () { if (!over) { over = true; done(new Error('no connection')); } };
    try { x.send(); } catch (e2) { if (!over) { over = true; done(e2); } }
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hm(ms) { var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function ago(ms) {
    if (!ms) return '';
    var m = Math.round((Date.now() - ms) / 60000);
    if (m < 1) return 'gerade eben';
    if (m < 60) return 'vor ' + m + ' Min.';
    var h = Math.round(m / 60);
    if (h < 24) return 'vor ' + h + ' Std.';
    var d = Math.round(h / 24);
    return d === 1 ? 'gestern' : 'vor ' + d + ' Tagen';
  }
  function decode(s) { var t = document.createElement('textarea'); t.innerHTML = s; return t.value; }

  // MARK: - Andere Apps oeffnen

  function openUrl(url, fail) {
    try {
      var ac = new window.tizen.ApplicationControl('http://tizen.org/appcontrol/operation/view', url, null, null, null);
      window.tizen.application.launchAppControl(ac, null, function () {}, function () {
        try { window.tizen.application.launchAppControl(ac, 'org.tizen.browser', function () {}, fail); } catch (e2) { if (fail) fail(); }
      });
    } catch (e) {
      if (!samsung) { try { window.open(url, '_blank'); return; } catch (e3) {} }
      if (fail) fail();
    }
  }

  // MARK: - YouTube werbefrei (TizenTube in TizenBrew)

  var TIZENBREW = 'xvvl3S1bvH.TizenBrewStandalone';
  var TIZENTUBE = {moduleName: '@foxreis/tizentube', moduleType: 'npm'};

  /** True, wenn das die YouTube-App ist, die durch TizenTube ersetzt wird. */
  function isYouTube(app) {
    return !!app && (app.id === '111299001912' || /^youtube$/i.test(app.title || '') || /youtube\.leanback/i.test(app.id));
  }

  /**
   * Startet TizenBrew mit dem Wunsch, gleich TizenTube zu oeffnen (TizenBrew liest das aus den AppControl-Daten).
   * fallback(): TizenBrew fehlt oder lehnt ab, dann die normale App.
   */
  function youtube(fallback) {
    if (!samsung) { if (fallback) fallback(); return; }
    try {
      var data = new window.tizen.ApplicationControlData('module', [JSON.stringify(TIZENTUBE)]);
      var ac = new window.tizen.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null, [data]);
      window.tizen.application.launchAppControl(ac, TIZENBREW, function () {}, function () { if (fallback) fallback(); });
    } catch (e) { if (fallback) fallback(); }
  }

  // MARK: - Cybersecurity-News

  var FEEDS = (window.CONFIG && CONFIG.newsFeeds && CONFIG.newsFeeds.length) ? CONFIG.newsFeeds : [
    {name: 'heise Security', url: 'https://www.heise.de/security/rss/news-atom.xml'},
    {name: 'heise Warnung', url: 'https://www.heise.de/security/rss/alert-news-atom.xml'},
    {name: 'Golem Security', url: 'https://rss.golem.de/rss.php?tp=sec&feed=RSS2.0'}
  ];
  var news = (stored('news') || {}).items || [], newsAt = (stored('news') || {}).at || 0, fetchingNews = false;

  function firstText(node, names) {
    for (var i = 0; i < names.length; i++) {
      var n = node.getElementsByTagName(names[i]);
      if (n.length && n[0].textContent) return n[0].textContent.replace(/^\s+|\s+$/g, '');
    }
    return '';
  }

  function parseFeed(text, source) {
    var doc = new DOMParser().parseFromString(text, 'text/xml');
    var nodes = doc.getElementsByTagName('item');
    if (!nodes.length) nodes = doc.getElementsByTagName('entry');
    var out = [];
    for (var i = 0; i < nodes.length && i < 20; i++) {
      var title = firstText(nodes[i], ['title']);
      var link = firstText(nodes[i], ['link']);
      if (!link) {
        var l = nodes[i].getElementsByTagName('link');
        if (l.length) link = l[0].getAttribute('href') || '';
      }
      var date = firstText(nodes[i], ['pubDate', 'updated', 'published', 'dc:date']);
      if (title) out.push({title: decode(title), link: link, at: Date.parse(date) || 0, source: source});
    }
    return out;
  }

  /** Direkt; erlaubt der Server das nicht, ueber zwei freie Feed-Dienste. done(list). */
  function fetchFeed(feed, done) {
    var enc = encodeURIComponent(feed.url);
    getText(feed.url, function (err, text) {
      var list = err ? [] : parseFeed(text, feed.name);
      if (list.length) return done(list);
      getText('https://api.rss2json.com/v1/api.json?rss_url=' + enc, function (err2, t2) {
        var out = [];
        try {
          var j = JSON.parse(t2);
          for (var i = 0; j.status === 'ok' && i < j.items.length; i++) {
            out.push({title: decode(j.items[i].title || ''), link: j.items[i].link || '', source: feed.name,
              at: Date.parse((j.items[i].pubDate || '').replace(' ', 'T') + 'Z') || 0});
          }
        } catch (e) {}
        if (out.length) return done(out);
        getText('https://api.allorigins.win/raw?url=' + enc, function (err3, t3) {
          done(err3 ? [] : parseFeed(t3, feed.name));
        });
      });
    });
  }

  function refreshNews() {
    if (fetchingNews || Date.now() - newsAt < 20 * 60000) return;
    fetchingNews = true;
    var all = [], left = FEEDS.length;
    if (!left) { fetchingNews = false; return; }
    for (var f = 0; f < FEEDS.length; f++) {
      fetchFeed(FEEDS[f], function (list) {
        all = all.concat(list);
        if (--left) return;
        fetchingNews = false;
        all.sort(function (a, b) { return b.at - a.at; });
        var seen = {}, out = [];
        for (var i = 0; i < all.length && out.length < 15; i++) {
          var k = all[i].title.toLowerCase();
          if (seen[k] || (all[i].at && Date.now() - all[i].at > 4 * 86400000)) continue;
          seen[k] = true;
          out.push(all[i]);
        }
        if (out.length) {
          news = out;
          newsAt = Date.now();
          store('news', {items: news, at: newsAt});
          changed();
        }
      });
    }
  }

  // MARK: - Sat-TV: das laufende Programm aus dem EPG des Fernsehers

  var tv = window.tizen && window.tizen.tvchannel, tvw = window.tizen && window.tizen.tvwindow;
  var sat = {now: null, next: null, channel: null, list: [], programs: {}, at: 0, ok: !!tv};

  /** Samsungs EPG liefert TZDate statt Date: ohne getTime, also aus den Einzelteilen (sonst stand "NaN:NaN" da). */
  function tzMs(t) {
    if (!t) return 0;
    if (typeof t === 'number') return t;
    var v = NaN;
    try { if (typeof t.getTime === 'function') v = +t.getTime(); } catch (e) {}
    if (isNaN(v) || !v) {
      try { v = new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), t.getMinutes(), t.getSeconds ? t.getSeconds() : 0).getTime(); } catch (e2) { v = NaN; }
    }
    if (isNaN(v)) { try { v = Date.parse(String(t).replace(/\s*\(.*\)\s*$/, '')); } catch (e3) {} }
    return isNaN(v) ? 0 : v;
  }

  function program(p) {
    if (!p) return null;
    var start = tzMs(p.startTime), dur = (p.duration || 0) * 1000;
    return {title: p.title || '', start: start, end: dur ? start + dur : 0, text: p.detailedDescription || p.description || '',
      lang: p.language || '', rating: p.rating || ''};
  }

  function channelName(c) { return c ? (c.channelName || c.programName || ('Kanal ' + c.major)) : ''; }

  function refreshSat() {
    if (!tv) return;
    var ch = null;
    try { ch = tv.getCurrentChannel(); } catch (e) { sat.ok = false; return; }
    sat.ok = true;
    sat.channel = ch;
    try { sat.now = program(tv.getCurrentProgram()); } catch (e2) { sat.now = null; }
    try {
      var start = new window.tizen.TZDate();
      tv.getProgramList(ch, start, function (list) {
        var now = Date.now();
        sat.next = null;
        for (var i = 0; list && i < list.length; i++) {
          var p = program(list[i]);
          if (!sat.now && p.start <= now && (!p.end || p.end > now)) sat.now = p;
          if (p.start > now && (!sat.next || p.start < sat.next.start)) sat.next = p;
        }
        changed();
      }, function () {}, 6);
    } catch (e3) {}
    if (!sat.list.length) loadChannels(0);
    sat.at = Date.now();
  }

  // Die Senderliste: erst alle, dann nur digitale, dann Favoriten (je nach Firmware antwortet nur eine Variante)
  var CHANNEL_MODES = ['ALL', 'DIGITAL', 'FAVORITE'];
  function loadChannels(i) {
    if (i >= CHANNEL_MODES.length * 2 || sat.list.length) return;
    var mode = CHANNEL_MODES[i % CHANNEL_MODES.length], withRange = i < CHANNEL_MODES.length;
    function ok(list) {
      list = (list || []).filter(function (c) { return c && (c.channelName || c.major); });
      if (!list.length) return loadChannels(i + 1);
      sat.list = list.slice(0, 2000);
      satByName = null;
      changed();
    }
    try {
      if (withRange) tv.getChannelList(ok, function () { loadChannels(i + 1); }, mode, 0, 2000);
      else tv.getChannelList(ok, function () { loadChannels(i + 1); }, mode);
    } catch (e) { loadChannels(i + 1); }
  }

  /** Das jetzt laufende Programm eines Senders (fuer die Senderliste). done(program|null). */
  function nowOn(ch, done) {
    var key = ch.major + '.' + ch.minor;
    var c = sat.programs[key];
    if (c && c.end > Date.now()) return done(c);
    try {
      var from;
      try { from = new window.tizen.TZDate(new Date(Date.now() - 3 * 3600000)); } catch (eT) { from = new window.tizen.TZDate(); }
      tv.getProgramList(ch, from, function (list) {
        var now = Date.now(), hit = null, nxt = null;
        for (var i = 0; list && i < list.length; i++) {
          var p = program(list[i]);
          if (!hit && p.start <= now && (!p.end || p.end > now)) hit = p;
          else if (p.start > now && (!nxt || p.start < nxt.start)) nxt = p;
        }
        sat.nexts = sat.nexts || {};
        sat.nexts[key] = nxt;
        sat.programs[key] = hit;
        done(hit);
      }, function () { done(null); }, 9);
    } catch (e) { done(null); }
  }

  var liveShown = false, liveRect = '', liveHook = null;
  function liveState(on) { liveShown = on; if (liveHook) liveHook(on); }

  // Free My TV+ 1.4: das Livebild stufenlos von einem Rechteck ins andere ziehen. Der naechste Schritt kommt erst,
  // wenn der Fernseher den letzten gezeigt hat: so passt sich die Bildrate dem Geraet an und nichts staut sich.
  var morph = null;
  function liveMorph(to, ms, done) {
    if (!tvw) { if (done) done(); return; }
    var from = liveRect ? liveRect.split(',') : null, token = {};
    for (var f = 0; from && f < 4; f++) from[f] = parseFloat(from[f]);
    if (!from || from.length !== 4) { morph = null; live(to); if (done) done(); return; }
    morph = token;
    var t0 = Date.now();
    function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
    function step() {
      if (morph !== token) return;
      var k = Math.min(1, (Date.now() - t0) / ms), e = ease(k), r = [];
      // gerade Pixelwerte: der Videoplan des Fernsehers springt sonst zwischen Halbbildern
      for (var i = 0; i < 4; i++) r.push(Math.round((from[i] + (to[i] - from[i]) * e) / 2) * 2);
      if (k < 1 && r.join(',') === liveRect) { setTimeout(step, 8); return; }
      liveRect = r.join(',');
      var next = function () { if (morph !== token) return; if (k >= 1) { morph = null; if (done) done(); } else setTimeout(step, 0); };
      try { tvw.show(function () { liveState(true); next(); }, function () { next(); }, [r[0] + 'px', r[1] + 'px', r[2] + 'px', r[3] + 'px'], 'MAIN'); }
      catch (e2) { morph = null; if (done) done(); }
    }
    step();
  }

  /** Das Livebild des Fernsehers in einem Rechteck (Bildschirmpixel), oder aus. */
  function live(rect) {
    if (!tvw) return;
    if (morph) { if (rect) return; morph = null; }   // waehrend des Ziehens bestimmt liveMorph das Rechteck
    var key = rect ? rect.join(',') : '';
    if (key === liveRect) return;
    liveRect = key;
    try {
      if (!rect) { if (liveShown) tvw.hide(function () {}, function () {}, 'MAIN'); liveState(false); return; }
      tvw.show(function () { liveState(true); }, function () { liveState(false); },
        [rect[0] + 'px', rect[1] + 'px', rect[2] + 'px', rect[3] + 'px'], 'MAIN');
    } catch (e) { liveState(false); }
  }

  /** Naechster/vorheriger Sat-Sender (P+/P- auf der Startseite und in der Senderkachel). */
  function zap(dir) {
    if (!sat.list.length) return;
    var cur = sat.channel, at = 0;
    for (var i = 0; i < sat.list.length; i++) if (cur && sat.list[i].major === cur.major && sat.list[i].minor === cur.minor) at = i;
    var next = sat.list[(at + dir + sat.list.length) % sat.list.length];
    sat.channel = next; sat.now = null; sat.next = null;
    changed();
    tune(next, function () { changed(); });
  }

  function tune(ch, done) {
    try {
      tv.tune({major: ch.major, minor: ch.minor}, {
        onsuccess: function () { refreshSat(); if (done) done(true); },
        onnosignal: function () { if (done) done(false); },
        onprograminforeceived: function () { refreshSat(); }
      }, function () { if (done) done(false); }, 'MAIN');
    } catch (e) { if (done) done(false); }
  }

  // MARK: - Welt-TV: Quellen (iptv-org, Free-TV, eigene)

  var WTV_BASE = 'https://iptv-org.github.io/iptv/';
  var FREETV = 'https://raw.githubusercontent.com/Free-TV/IPTV/master/';
  var INDEX = {label: 'Weltweit (alle)', path: 'index.m3u'};

  function lang(code, label) { return {label: label, path: 'languages/' + code + '.m3u'}; }
  function country(code, label) { return {label: label, path: 'countries/' + code + '.m3u'}; }
  function cat(code, label) { return {label: label, path: 'categories/' + code + '.m3u'}; }
  function named(label, re) { return {label: label, filter: re}; }
  function freetv(file, label) { return {label: label, url: FREETV + 'playlists/playlist_' + file + '.m3u8'}; }

  // Aufklappbare Gruppen der Seitenleiste. Gruppen mit "open" sind beim ersten Start aufgeklappt.
  var WTV_GROUPS = [
    {label: 'Sprachen', open: true, items: [lang('deu', 'Deutsch'), lang('eng', 'Englisch'), lang('fra', 'Französisch'),
      lang('spa', 'Spanisch'), lang('ita', 'Italienisch'), lang('nld', 'Niederländisch'), lang('pol', 'Polnisch'),
      lang('tur', 'Türkisch'), lang('por', 'Portugiesisch'), lang('ara', 'Arabisch'), lang('rus', 'Russisch')]},
    {label: 'Länder', items: [country('de', 'Deutschland'), country('at', 'Österreich'), country('ch', 'Schweiz'),
      country('uk', 'Großbritannien'), country('us', 'USA'), country('fr', 'Frankreich'), country('it', 'Italien'),
      country('es', 'Spanien'), country('nl', 'Niederlande'), country('be', 'Belgien'), country('pl', 'Polen'),
      country('tr', 'Türkei'), country('se', 'Schweden'), country('no', 'Norwegen'), country('dk', 'Dänemark'),
      country('pt', 'Portugal'), country('gr', 'Griechenland'), country('ca', 'Kanada'), country('au', 'Australien'),
      country('in', 'Indien'), country('jp', 'Japan'), country('kr', 'Südkorea'), country('br', 'Brasilien'),
      country('mx', 'Mexiko'), country('ar', 'Argentinien')]},
    {label: 'Themen', items: [cat('news', 'Nachrichten'), cat('sports', 'Sport'), cat('cooking', 'Kochen'),
      named('Gaming', /gam(e|es|ing)\b|e-?sport|gamer|twitch|\bign\b|nintendo|playstation|xbox/i),
      named('Haus & Garten', /garden|garten|\bhaus\b|home|hgtv|\bdiy\b|wohn|immobil|bauen|heimwerk|interior/i),
      cat('movies', 'Filme'), cat('series', 'Serien'), cat('documentary', 'Dokus'), cat('music', 'Musik'),
      cat('kids', 'Kinder'), cat('family', 'Familie'), cat('comedy', 'Comedy'), cat('entertainment', 'Unterhaltung'),
      cat('lifestyle', 'Lifestyle'), cat('travel', 'Reisen'), cat('outdoor', 'Natur & Outdoor'), cat('science', 'Wissenschaft'),
      cat('education', 'Bildung'), cat('culture', 'Kultur'), cat('business', 'Wirtschaft'), cat('auto', 'Auto & Motor'),
      cat('animation', 'Animation'), cat('classic', 'Klassiker'), cat('relax', 'Entspannung'), cat('weather', 'Wetter'),
      cat('legislative', 'Politik & Parlament'), cat('shop', 'Shopping'), cat('religious', 'Religion')]},
    {label: 'Gratis-Anbieter (Free-TV)', items: [freetv('germany', 'Free-TV Deutschland'), freetv('austria', 'Free-TV Österreich'),
      freetv('switzerland', 'Free-TV Schweiz'), freetv('uk', 'Free-TV UK'), freetv('usa', 'Free-TV USA'),
      freetv('france', 'Free-TV Frankreich'), freetv('italy', 'Free-TV Italien'), freetv('spain', 'Free-TV Spanien'),
      {label: 'Free-TV alle Länder', url: FREETV + 'playlist.m3u8'}]},
    {label: 'Eigene Quellen', custom: true, items: []},
    {label: 'Alles', open: true, items: [INDEX]}
  ];
  var WTV_SOURCES = [];   // flach: alle Quellen (fuer die Karten und als Nummer im Speicher)
  for (var gi = 0; gi < WTV_GROUPS.length; gi++) WTV_SOURCES = WTV_SOURCES.concat(WTV_GROUPS[gi].items);
  var wtvCache = {};
  var ADULT = /xxx|adult|erotic|porn/i;

  function customSources() { return stored('wtvCustom') || []; }
  function syncCustom() {
    for (var i = 0; i < WTV_GROUPS.length; i++) if (WTV_GROUPS[i].custom) WTV_GROUPS[i].items = customSources().slice();
  }

  function parseM3U(text) {
    var lines = text.split(/\r?\n/), out = [], seen = {}, cur = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/^\s+|\s+$/g, '');
      if (!line) continue;
      if (line.indexOf('#EXTINF') === 0) {
        var attrs = {}, re = /([a-zA-Z-]+)="([^"]*)"/g, m;
        while ((m = re.exec(line)) !== null) attrs[m[1]] = m[2];
        var cut = line.lastIndexOf('",');
        var name = line.slice(cut >= 0 ? cut + 2 : line.indexOf(',') + 1);
        var tags = [];
        name = name.replace(/\[([^\]]+)\]/g, function (all, t) { tags.push(t); return ''; });
        if (name.indexOf('Ⓖ') >= 0) tags.push('Geo-blocked');   // Free-TV: (G) = nur im Land
        name = name.replace(/[Ⓐ-ⓩ]/g, '');
        var q = '';
        name = name.replace(/\((\d{3,4}[pi])\)/, function (all, t) { q = t; return ''; }).replace(/^\s+|\s+$/g, '');
        var idm = /\.([a-z]{2})(@|$)/i.exec(attrs['tvg-id'] || '');
        var cc = (attrs['tvg-country'] || (idm ? idm[1] : '')).split(/[;,]/)[0].toUpperCase();
        cur = {name: name, logo: attrs['tvg-logo'] || '', group: attrs['group-title'] || '', quality: q, tags: tags, cc: cc};
      } else if (line.charAt(0) !== '#' && cur) {
        cur.url = line;
        var key = cur.name.toLowerCase();
        if (cur.name && !ADULT.test(cur.group)) {
          // Doppelte Sender: die Variante behalten, die hier laeuft (ohne Geo-Sperre)
          if (seen[key] === undefined) { seen[key] = out.length; out.push(cur); }
          else if (!geoOk(out[seen[key]]) && geoOk(cur)) out[seen[key]] = cur;
        }
        cur = null;
      }
    }
    out.sort(function (a, b) { var x = a.name.toLowerCase(), y = b.name.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; });
    return out;
  }

  function srcUrl(src) { return src.url || WTV_BASE + src.path; }

  // Geo-Sperre: der Sender sendet nur in sein eigenes Land. In dem Land laeuft er, sonst nicht (ohne VPN).
  var HOME_CC = ((window.Place && Place.country) || 'DE').toUpperCase().replace('GB', 'UK');
  function isGeo(ch) { return (ch.tags || []).indexOf('Geo-blocked') >= 0; }
  function geoOk(ch) { return !isGeo(ch) || !ch.cc || ch.cc.replace('GB', 'UK') === HOME_CC; }
  function hideGeo() { try { return !(window.Prefs && Prefs.showGeo && Prefs.showGeo()); } catch (e) { return true; } }
  function usable(list) { return hideGeo() ? list.filter(geoOk) : list; }

  // Sat-Abgleich: laeuft der Welt-TV-Sender auch ueber Satellit, kommt "Jetzt laeuft" aus dem EPG des Fernsehers
  function norm(n) { return (n || '').toLowerCase().replace(/\(.*?\)|\b(hd|uhd|sd|fhd|deutschland|germany|de)\b|[^a-z0-9]/g, ''); }
  var satByName = null;
  function satFor(name) {
    if (!sat.list.length) return null;
    if (!satByName) { satByName = {}; for (var i = 0; i < sat.list.length; i++) { var k = norm(channelName(sat.list[i])); if (k && !satByName[k]) satByName[k] = sat.list[i]; } }
    return satByName[norm(name)] || null;
  }

  function loadList(src, done) {
    if (src.filter) {
      return loadList(INDEX, function (all) {
        done(all ? usable(all).filter(function (c) { return src.filter.test(c.name) || src.filter.test(c.group); }) : null);
      });
    }
    var url = srcUrl(src);
    if (wtvCache[url]) return done(usable(wtvCache[url]));
    getText(url, function (err, text) {
      if (err) return done(null);
      wtvCache[url] = parseM3U(text);
      done(usable(wtvCache[url]));
    }, 30000);
  }

  var extApps = [], extLaunch = null;   // die Apps des Fernsehers (von home.js), fuer die Suche

  // Zuletzt gesehen: die letzten 20 Sender, die in Welt-TV liefen
  function recent() { return stored('wtvRecent') || []; }
  function remember(ch) {
    var list = recent().filter(function (c) { return c.url !== ch.url; });
    list.unshift({name: ch.name, url: ch.url, logo: ch.logo, quality: ch.quality, tags: ch.tags || [], cc: ch.cc || ''});
    store('wtvRecent', list.slice(0, 20));
  }

  // Fuer die Karte in "Welt-TV": ein bekannter frei empfangbarer Sender, sonst der erste mit Logo
  var FEATURED = /^(3sat|tagesschau24|phoenix|ZDFinfo|DW|Welt|ntv|n-tv|euronews|arte)/i;
  var featured = [];
  function loadFeatured() {
    loadList(WTV_SOURCES[0], function (list) {
      if (!list) return;
      var pick = list.filter(function (c) { return c.logo && FEATURED.test(c.name) && c.tags.indexOf('Geo-blocked') < 0; });
      if (pick.length < 3) pick = pick.concat(list.filter(function (c) { return c.logo && pick.indexOf(c) < 0; }));
      featured = pick.slice(0, 6);
      changed();
    });
  }

  // Free My TV+ 1.6: Live-Vorschau eines kostenlosen US-Sportsenders in der grossen Welt-TV-Kachel.
  // ESPN und Co. gibt es nicht legal kostenlos (die Eintraege in freien Listen sind Pay-TV-Kopien): genommen werden nur
  // offizielle Gratis-Sender der Anbieter selbst, und nie Adressen, die nur eine nackte IP sind.
  var SPORT_PREF = [/^CBS Sports Golazo/i, /^beIN SPORTS XTRA(?! en)/i, /^Fubo Sports/i, /^NBC Sports NOW/i, /^Tennis Channel(?! 2)/i, /^Willow/i];
  var sportCh = stored('sportCh') || null, sportBusy = false, sportTried = {};
  function loadSport() {
    if (sportBusy || (sportCh && !sportTried[sportCh.url])) return;
    sportBusy = true;
    loadList(country('us', 'USA'), function (list) {
      sportBusy = false;
      if (!list) return;
      for (var p = 0; p < SPORT_PREF.length; p++) for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (!SPORT_PREF[p].test(c.name) || sportTried[c.url] || /^https?:\/\/\d+\.\d+\.\d+\.\d+/.test(c.url) || /Not 24\/7/i.test(c.name)) continue;
        sportCh = {name: c.name, url: c.url, logo: c.logo, quality: c.quality, tags: c.tags || [], cc: c.cc || 'US'};
        store('sportCh', sportCh);
        changed();
        return;
      }
    });
  }
  var pv = {video: null, hls: null, url: ''};
  function stopPreview() {
    if (pv.hls) { try { pv.hls.destroy(); } catch (e) {} }
    if (pv.video) { try { pv.video.pause(); pv.video.removeAttribute('src'); pv.video.load(); } catch (e) {} if (pv.video.parentNode) pv.video.parentNode.removeChild(pv.video); }
    pv = {video: null, hls: null, url: ''};
  }
  function drawSport(box) {
    stopPreview();
    var ch = sportCh;
    box.innerHTML = '';
    if (!ch) return;
    var v = document.createElement('video');
    v.className = 'pvideo';
    v.muted = false;   // 1.7: mit Ton
    v.setAttribute('playsinline', '');
    v.autoplay = true;
    box.appendChild(v);
    el('div', 'kicker pvk', box, 'Live  ·  US-Sport  ·  kostenlos');
    el('div', 'big pvb', box, ch.name.replace(/\s*\(\d+p\)/, ''));
    pv.video = v;
    pv.url = ch.url;
    var bad = setTimeout(function () { if (pv.video === v && v.readyState < 2) { sportTried[ch.url] = true; sportCh = null; store('sportCh', null); stopPreview(); loadSport(); } }, 20000);
    v.onplaying = function () { clearTimeout(bad); };
    // 1.7: schneller Start: hls.js (schon vorgeladen) beginnt mit der kleinsten Qualitaet und steigert dann
    loadHls(function () {
      if (pv.video !== v) return;
      if (!window.Hls || !window.Hls.isSupported()) { v.src = ch.url; try { var pr = v.play(); if (pr && pr['catch']) pr['catch'](function () {}); } catch (e) {} return; }
      pv.hls = new window.Hls({startLevel: 0, maxBufferLength: 6, maxMaxBufferLength: 10, backBufferLength: 4, maxBufferSize: 8 * 1000 * 1000,
        liveSyncDurationCount: 2, startFragPrefetch: true, capLevelToPlayerSize: true, manifestLoadingTimeOut: 6000, fragLoadingTimeOut: 8000});
      pv.hls.loadSource(ch.url);
      pv.hls.attachMedia(v);
      try { var pr2 = v.play(); if (pr2 && pr2['catch']) pr2['catch'](function () {}); } catch (e) {}
    });
  }

  // MARK: - Welt-TV: Senderliste (eigene Ebene) und Vollbild-Player

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, parent, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function setClass(e, c, on) {
    if (!e) return;
    var has = (' ' + e.className + ' ').indexOf(' ' + c + ' ') >= 0;
    if (on && !has) e.className = (e.className + ' ' + c).replace(/^\s+/, '');
    else if (!on && has) e.className = (' ' + e.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\s+|\s+$/g, '');
  }

  var ui = {open: null, zone: 'side', side: 0, item: 0, scroll: 0, list: [], source: null, label: '', playing: -1, hls: null,
    osdTimer: 0, watchdog: 0, onClose: null, playList: null, nodes: {}, mode: 'search', letterTimer: 0};
  var COLS = 5, CW = 276, RH = 210, VIS = 4;
  var expanded = stored('wtvOpen') || (function () { var o = {}; for (var i = 0; i < WTV_GROUPS.length; i++) o[WTV_GROUPS[i].label] = !!WTV_GROUPS[i].open; return o; })();

  /** Die Zeilen der Seitenleiste: Suche, Zuletzt gesehen, dann Gruppen (aufgeklappt mit ihren Quellen). */
  function sideRows() {
    var rows = [{kind: 'search', label: 'Suchen'}, {kind: 'recent', label: 'Zuletzt gesehen'}];
    for (var g = 0; g < WTV_GROUPS.length; g++) {
      var grp = WTV_GROUPS[g];
      rows.push({kind: 'group', label: grp.label, group: grp, open: !!expanded[grp.label]});
      if (!expanded[grp.label]) continue;
      for (var i = 0; i < grp.items.length; i++) rows.push({kind: 'src', label: grp.items[i].label, src: grp.items[i], custom: grp.custom, index: i});
      if (grp.custom) rows.push({kind: 'add', label: '+ Eigene Quelle hinzufügen'});
    }
    return rows;
  }

  function openWorld(how) {
    var w = $('wtv');
    if (!w) return;
    syncCustom();
    ui.open = 'wtv';
    setClass(w, 'open', true);
    ui.nodes = {};
    $('wtv-grid').innerHTML = '';
    if (document.activeElement !== field()) field().placeholder = 'Sendername suchen (OK drücken zum Tippen)';
    if (how === 'search') { showRecent(); ui.zone = 'search'; paintWorld(); startTyping('search'); return; }
    var last = stored('wtvSourceLabel'), rows = sideRows(), at = -1;
    for (var i = 0; i < rows.length; i++) if (rows[i].kind === 'src' && rows[i].label === last) at = i;
    if (at < 0) { for (i = 0; i < rows.length; i++) if (rows[i].kind === 'src') { at = i; break; } }
    ui.side = Math.max(0, at);
    if (rows[ui.side] && rows[ui.side].src) pickSource(rows[ui.side].src); else showRecent();
    ui.zone = 'side';
    paintWorld();
  }

  /** Laenderfilter ueber dem Raster: die haeufigsten Laender der Liste, "Alle" vorne. */
  function filters(list) {
    var count = {}, out = [];
    for (var i = 0; i < list.length; i++) { var c = list[i].cc || '?'; count[c] = (count[c] || 0) + 1; }
    for (var k in count) if (count.hasOwnProperty(k) && k !== '?') out.push(k);
    out.sort(function (a, b) { return (b === HOME_CC) - (a === HOME_CC) || count[b] - count[a]; });
    return out.length > 1 ? ['Alle'].concat(out.slice(0, 11)) : [];
  }
  function applyFilter(i) {
    ui.fi = i;
    var f = ui.filters[i];
    ui.list = !f || f === 'Alle' ? ui.base : ui.base.filter(function (c) { return c.cc === f; });
    ui.item = 0; ui.scroll = 0; ui.nodes = {}; $('wtv-grid').innerHTML = '';
    paintFilters();
  }
  function paintFilters() {
    var box = $('wtv-filter');
    box.innerHTML = '';
    for (var i = 0; i < ui.filters.length; i++) {
      var c = el('div', 'fchip', box, ui.filters[i] === 'Alle' ? 'Alle Länder' : ui.filters[i]);
      setClass(c, 'on', i === ui.fi);
      setClass(c, 'focus', ui.zone === 'filter' && i === ui.fc);
    }
  }

  function setList(list, label, info) {
    ui.base = list;
    ui.filters = filters(list);
    ui.fi = 0; ui.fc = 0;
    ui.list = list;
    ui.label = label;
    ui.item = 0;
    ui.scroll = 0;
    ui.nodes = {};
    $('wtv-grid').innerHTML = '';
    $('wtv-info').textContent = info || (list.length + ' Sender  ·  ' + label + '  ·  OK: ansehen  ·  rechte Leiste: nach Buchstaben springen  ·  P+/P−: blättern' +
      (hideGeo() ? '  ·  nur Sender, die hier empfangbar sind' : ''));
    paintFilters();
    paintWorld();
  }

  function showRecent() {
    var list = recent();
    setList(list, 'Zuletzt gesehen', list.length ? list.length + ' zuletzt gesehene Sender  ·  OK: ansehen' : 'Noch nichts angesehen. Such dir links eine Liste aus.');
  }

  function pickSource(src) {
    ui.source = src;
    store('wtvSourceLabel', src.label);
    setList([], src.label, 'Senderliste „' + src.label + '“ wird geladen …' + (src === INDEX || src.filter ? ' (die große Liste braucht ein paar Sekunden)' : ''));
    loadList(src, function (list) {
      if (ui.source !== src || ui.open !== 'wtv') return;
      if (!list) { $('wtv-info').textContent = 'Senderliste konnte nicht geladen werden. Internetverbindung oder Adresse prüfen.'; return; }
      setList(list, src.label);
    });
  }

  // Suche: in allem, was schon geladen ist, und in der weltweiten Liste
  var searchTimer = 0;
  function runSearch(q) {
    q = (q || '').replace(/^\s+|\s+$/g, '');
    if (q.length < 2) { if (!q) showRecent(); return; }
    ui.source = null;
    $('wtv-info').textContent = 'Suche „' + q + '“ …';
    loadList(INDEX, function () {
      var needle = q.toLowerCase(), seen = {}, out = [];
      for (var url in wtvCache) {
        if (!wtvCache.hasOwnProperty(url)) continue;
        var list = wtvCache[url];
        for (var i = 0; i < list.length; i++) {
          var c = list[i], key = c.name.toLowerCase();
          if (key.indexOf(needle) >= 0 && !seen[key]) { seen[key] = true; out.push(c); }
        }
      }
      out.sort(function (a, b) {   // Treffer am Anfang des Namens zuerst
        var x = a.name.toLowerCase().indexOf(needle) === 0 ? 0 : 1, y = b.name.toLowerCase().indexOf(needle) === 0 ? 0 : 1;
        return x - y || (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1);
      });
      // Vorne: Apps (z. B. Mediatheken), Sat-Sender und was dort gerade laeuft
      var front = [];
      for (var a = 0; a < extApps.length; a++) {
        if ((extApps[a].title || '').toLowerCase().indexOf(needle) >= 0) front.push({name: extApps[a].title, logo: extApps[a].icon || '', app: extApps[a], tags: [], cc: '', group: 'App auf dem Fernseher'});
      }
      for (var sI = 0; sI < sat.list.length; sI++) {
        var ch = sat.list[sI], nm = channelName(ch), pr = sat.programs[ch.major + '.' + ch.minor];
        if (nm.toLowerCase().indexOf(needle) >= 0 || (pr && pr.title.toLowerCase().indexOf(needle) >= 0)) {
          front.push({name: nm, logo: '', sat: ch, tags: [], cc: '', group: pr ? 'Sat · jetzt: ' + pr.title : 'Sat-Sender ' + ch.major});
        }
      }
      out = front.concat(out);
      setList(out, 'Suche „' + q + '“', out.length ? out.length + ' Treffer für „' + q + '“  ·  OK: ansehen' : 'Nichts gefunden für „' + q + '“.');
    });
  }

  function field() { return $('wtv-q'); }
  function startTyping(mode) {
    ui.mode = mode;
    var f = field();
    f.value = '';
    f.placeholder = mode === 'add' ? 'Adresse einer M3U-Liste, z. B. https://…/liste.m3u' : 'Sendername suchen, z. B. tagesschau';
    ui.zone = 'search';
    paintWorld();
    f.focus();
  }
  function stopTyping() { var f = field(); if (f && document.activeElement === f) f.blur(); }

  function addCustom(url) {
    url = (url || '').replace(/^\s+|\s+$/g, '');
    if (!/^https?:\/\/.+/i.test(url)) { $('wtv-info').textContent = 'Das ist keine Adresse. Sie muss mit http:// oder https:// beginnen.'; return; }
    var name = url.replace(/^https?:\/\//i, '').replace(/[?#].*$/, '');
    var parts = name.split('/'), label = parts[0] + (parts.length > 1 ? ' · ' + parts[parts.length - 1].replace(/\.m3u8?$/i, '') : '');
    var list = customSources().filter(function (s) { return s.url !== url; });
    list.push({label: label.slice(0, 40), url: url});
    store('wtvCustom', list);
    syncCustom();
    expanded['Eigene Quellen'] = true;
    store('wtvOpen', expanded);
    var rows = sideRows();
    for (var i = 0; i < rows.length; i++) if (rows[i].kind === 'src' && rows[i].src.url === url) { ui.side = i; pickSource(rows[i].src); }
    ui.zone = 'side';
    paintWorld();
  }

  function removeCustom(src) {
    store('wtvCustom', customSources().filter(function (s) { return s.url !== src.url; }));
    syncCustom();
    ui.side = Math.max(0, ui.side - 1);
    showRecent();
    paintWorld();
  }

  function letterOf(ch) { var c = (ch && ch.name || '#').charAt(0).toUpperCase(); return /[A-ZÄÖÜ]/.test(c) ? c.replace('Ä', 'A').replace('Ö', 'O').replace('Ü', 'U') : '#'; }

  function paintWorld() {
    // Seitenleiste
    var side = $('wtv-side'), rows = sideRows(), i;
    ui.side = Math.max(0, Math.min(rows.length - 1, ui.side));
    side.innerHTML = '';
    for (i = 0; i < rows.length; i++) {
      var r = rows[i], row = el('div', 'srow ' + r.kind, side, (r.kind === 'group' ? (r.open ? '▾  ' : '▸  ') : '') + r.label);
      if (r.kind === 'src' && ui.source === r.src) setClass(row, 'on', true);
      if (r.kind === 'recent' && !ui.source && ui.label === 'Zuletzt gesehen') setClass(row, 'on', true);
      if (ui.zone === 'side' && i === ui.side) setClass(row, 'focus', true);
    }
    var firstSide = Math.max(0, Math.min(rows.length - 13, ui.side - 6));
    side.style.webkitTransform = side.style.transform = 'translateY(' + (-firstSide * 60) + 'px)';
    var cur = rows[ui.side];
    $('wtv-hint').textContent = ui.zone === 'side' && cur && cur.custom ? 'Rote Taste: diese Quelle entfernen' : '';
    setClass($('wtv-close'), 'focus', ui.zone === 'close');
    setClass($('wtv-search'), 'focus', ui.zone === 'search');
    setClass($('wtv-bar'), 'focus', ui.zone === 'bar');
    // Raster: nur die sichtbaren Reihen gibt es als Elemente (auch bei Tausenden Sendern)
    var n = ui.list.length, rowsTotal = Math.ceil(n / COLS), r0 = Math.floor(ui.item / COLS);
    if (r0 < ui.scroll) ui.scroll = r0;
    if (r0 > ui.scroll + VIS - 2) ui.scroll = r0 - (VIS - 2);
    ui.scroll = Math.max(0, Math.min(ui.scroll, Math.max(0, rowsTotal - VIS + 1)));
    var grid = $('wtv-grid'), from = Math.max(0, (ui.scroll - 1) * COLS), to = Math.min(n, (ui.scroll + VIS + 1) * COLS), keep = {};
    for (i = from; i < to; i++) {
      keep[i] = true;
      if (!ui.nodes[i]) ui.nodes[i] = chanNode(ui.list[i], i, grid);
      setClass(ui.nodes[i], 'focus', ui.zone === 'grid' && i === ui.item);
    }
    for (var k in ui.nodes) {
      if (ui.nodes.hasOwnProperty(k) && !keep[k]) { if (ui.nodes[k].parentNode) ui.nodes[k].parentNode.removeChild(ui.nodes[k]); delete ui.nodes[k]; }
    }
    grid.style.webkitTransform = grid.style.transform = 'translateY(' + (-ui.scroll * RH) + 'px)';
    // Scrollleiste
    var track = 760, thumb = $('wtv-thumb'), bar = $('wtv-bar');
    bar.style.display = rowsTotal > VIS ? '' : 'none';
    var h = Math.max(48, Math.round(track * Math.min(1, VIS / Math.max(1, rowsTotal))));
    var span = Math.max(1, rowsTotal - VIS + 1);
    thumb.style.height = h + 'px';
    thumb.style.top = Math.round((track - h) * Math.min(1, ui.scroll / span)) + 'px';
  }

  function chanNode(ch, k, grid) {
    var c = el('div', 'chan', grid), logo = el('div', 'logo', c);
    c.style.left = (k % COLS) * CW + 'px';
    c.style.top = Math.floor(k / COLS) * RH + 'px';
    if (ch.logo) {
      var img = el('img', '', logo);
      img.onerror = function () { logo.innerHTML = ''; el('span', 'ph', logo, ch.name.charAt(0)); };
      img.src = ch.logo;
    } else el('span', 'ph', logo, ch.name.charAt(0));
    el('div', 'cn', c, ch.name + (ch.cc ? ' (' + ch.cc + ')' : ''));
    var np = el('div', 'np', c, ch.group ? ch.group.split(';')[0] : '');
    var sc = satFor(ch.name);
    if (sc) nowOn(sc, function (pr) { if (pr) np.textContent = (pr.start ? hm(pr.start) + '  ' : 'Jetzt: ') + pr.title; });
    var tags = ch.tags || [];
    var badge = isGeo(ch) ? (geoOk(ch) ? '' : 'Geo') : tags.indexOf('Not 24/7') >= 0 ? 'zeitweise' : ch.quality;
    if (badge) el('span', 'badge', c, badge);
    return c;
  }

  function showLetter() {
    var b = $('wtv-letter');
    b.textContent = letterOf(ui.list[ui.item]);
    setClass(b, 'on', true);
    clearTimeout(ui.letterTimer);
    ui.letterTimer = setTimeout(function () { setClass(b, 'on', false); }, 900);
  }

  function jumpLetter(dir) {
    var n = ui.list.length;
    if (!n) return;
    var now = letterOf(ui.list[ui.item]), i = ui.item;
    if (dir > 0) { while (i < n && letterOf(ui.list[i]) === now) i++; if (i >= n) i = n - 1; }
    else {
      while (i > 0 && letterOf(ui.list[i - 1]) === now) i--;   // Anfang des aktuellen Buchstabens
      if (i === ui.item && i > 0) { i--; var prev = letterOf(ui.list[i]); while (i > 0 && letterOf(ui.list[i - 1]) === prev) i--; }
    }
    ui.item = i;
    showLetter();
  }

  function closeWorld() {
    stopTyping();
    setClass($('wtv'), 'open', false);
    if (ui.over) { ui.over = false; setClass($('wtv'), 'over', false); ui.open = 'player'; osd(); return; }
    ui.open = null;
    if (ui.onClose) ui.onClose();
  }

  /** Im laufenden Sender: das Welt-TV-Menue halb durchsichtig darueber, das Bild laeuft weiter. */
  function overlayWorld() {
    var w = $('wtv');
    ui.over = true;
    ui.open = 'wtv';
    setClass(w, 'over', true);
    setClass(w, 'open', true);
    if (ui.playList && ui.list !== ui.playList && !ui.list.length) setList(ui.playList, ui.playLabel || 'Welt-TV');
    if (ui.playList === ui.list) ui.item = ui.playing;
    ui.zone = 'grid';
    paintWorld();
  }

  function sideActivate() {
    var r = sideRows()[ui.side];
    if (!r) return;
    if (r.kind === 'search') startTyping('search');
    else if (r.kind === 'recent') { ui.source = null; showRecent(); if (ui.list.length) ui.zone = 'grid'; }
    else if (r.kind === 'group') { expanded[r.label] = !expanded[r.label]; store('wtvOpen', expanded); }
    else if (r.kind === 'add') startTyping('add');
    else if (r.kind === 'src') { if (ui.source !== r.src) pickSource(r.src); else if (ui.list.length) ui.zone = 'grid'; }
  }

  /** Tasten, solange das Eingabefeld den Fokus hat. 'type': die Taste geht ins Feld. */
  function typingKey(k, K) {
    if (k === K.ok || k === 65376) {   // OK / Fertig der Samsung-Tastatur
      var v = field().value;
      stopTyping();
      if (ui.mode === 'add') addCustom(v); else { runSearch(v); if (ui.list.length) ui.zone = 'grid'; }
      paintWorld();
      return true;
    }
    if (k === K.back || k === 27 || k === 65385) { stopTyping(); paintWorld(); return true; }
    if (k === K.up) { stopTyping(); ui.zone = 'close'; paintWorld(); return true; }
    if (k === K.down) { stopTyping(); if (ui.list.length) ui.zone = 'grid'; paintWorld(); return true; }
    return 'type';
  }

  function worldKey(k, K) {
    if (document.activeElement === field()) return typingKey(k, K);
    var n = ui.list.length;
    if (k === K.back) {
      if (ui.zone === 'grid' || ui.zone === 'bar' || ui.zone === 'search') ui.zone = 'side';
      else { closeWorld(); return true; }
    } else if (ui.zone === 'close') {
      if (k === K.ok) { closeWorld(); return true; }
      if (k === K.down) ui.zone = 'search';
      else if (k === K.left) ui.zone = 'side';
    } else if (ui.zone === 'side') {
      var rows = sideRows();
      if (k === K.up) { if (ui.side > 0) ui.side--; else ui.zone = 'close'; }
      else if (k === K.down) ui.side = Math.min(rows.length - 1, ui.side + 1);
      else if (k === K.ok) sideActivate();
      else if (k === K.right) ui.zone = n ? 'grid' : 'search';
      else if (k === 403 && rows[ui.side] && rows[ui.side].custom) removeCustom(rows[ui.side].src);   // rote Taste
    } else if (ui.zone === 'filter') {
      if (k === K.left) { if (ui.fc > 0) ui.fc--; else ui.zone = 'side'; }
      else if (k === K.right) ui.fc = Math.min(ui.filters.length - 1, ui.fc + 1);
      else if (k === K.ok) { applyFilter(ui.fc); if (ui.list.length) ui.zone = 'grid'; }
      else if (k === K.up) ui.zone = 'search';
      else if (k === K.down && n) ui.zone = 'grid';
      paintFilters();
    } else if (ui.zone === 'search') {
      if (k === K.ok) { startTyping('search'); return true; }
      if (k === K.down && ui.filters.length) { ui.zone = 'filter'; ui.fc = ui.fi; paintFilters(); }
      else if (k === K.down && n) ui.zone = 'grid';
      else if (k === K.up) ui.zone = 'close';
      else if (k === K.left) ui.zone = 'side';
    } else if (ui.zone === 'bar') {
      if (k === K.up) jumpLetter(-1);
      else if (k === K.down) jumpLetter(1);
      else if (k === K.left || k === K.ok) { ui.zone = 'grid'; ui.item = Math.min(n - 1, ui.item - (ui.item % COLS) + COLS - 1); }
    } else {   // Raster
      var col = ui.item % COLS;
      if (k === K.left) { if (col > 0) ui.item--; else ui.zone = 'side'; }
      else if (k === K.right) { if (col < COLS - 1 && ui.item + 1 < n) ui.item++; else { ui.zone = 'bar'; showLetter(); } }
      else if (k === K.down) { if (ui.item + COLS < n) ui.item += COLS; else if (Math.floor(ui.item / COLS) < Math.floor((n - 1) / COLS)) ui.item = n - 1; }
      else if (k === K.up) { if (ui.item >= COLS) ui.item -= COLS; else { ui.zone = ui.filters.length ? 'filter' : 'search'; ui.fc = ui.fi; paintFilters(); } }
      else if (k === 427) ui.item = Math.max(col, ui.item - COLS * VIS);   // P-
      else if (k === 428) ui.item = Math.min(n - 1, ui.item + COLS * VIS);   // P+
      else if (k === K.ok && n) { play(ui.list, ui.item, ui.label); return true; }
      if (k === 427 || k === 428) showLetter();
    }
    paintWorld();
    return true;
  }

  // Player

  function loadHls(cb) {
    if (window.Hls) return cb();
    var s = document.createElement('script');
    s.src = 'hls.min.js';
    s.onload = cb;
    s.onerror = cb;
    document.head.appendChild(s);
  }

  function playerMsg(text) {
    var m = $('player-msg');
    m.textContent = text || '';
    setClass(m, 'on', !!text);
  }

  function osd() {
    var ch = ui.playList && ui.playList[ui.playing];
    if (!ch) return;
    $('osd-name').textContent = ch.name;
    var meta = [ui.playLabel, ch.quality, ch.tags.join(', '), (ui.playing + 1) + ' / ' + ui.playList.length];
    $('osd-meta').textContent = meta.filter(function (x) { return x; }).join('  ·  ');
    var logo = $('osd-logo');
    if (ch.logo) { logo.src = ch.logo; logo.style.display = ''; } else logo.style.display = 'none';
    setClass($('osd'), 'off', false);
    clearTimeout(ui.osdTimer);
    ui.osdTimer = setTimeout(function () { setClass($('osd'), 'off', true); }, 4500);
  }

  function stopVideo() {
    var v = $('video');
    clearTimeout(ui.watchdog);
    if (ui.hls) { try { ui.hls.destroy(); } catch (e) {} ui.hls = null; }
    try { v.pause(); } catch (e2) {}
    v.removeAttribute('src');
    try { v.load(); } catch (e3) {}
  }

  function play(list, idx, label) {
    var ch = list[idx];
    if (!ch) return;
    if (ch.app) { closeWorld(); if (extLaunch) extLaunch(ch.app); return; }
    if (ch.sat) { closeWorld(); tune(ch.sat, function () { changed(); }); return; }
    if (label !== 'Mediaplayer' && ch.group !== md.title) remember(ch);
    stopPreview();
    ui.playList = list;
    ui.playing = idx;
    ui.playLabel = label || '';
    if (ui.over) { ui.over = false; setClass($('wtv'), 'over', false); setClass($('wtv'), 'open', false); ui.before = 'wtv-hidden'; }
    else if (ui.open !== 'player') ui.before = ui.open;
    if (ui.before === 'wtv') { setClass($('wtv'), 'open', false); ui.before = 'wtv-hidden'; }
    ui.open = 'player';
    live(null);
    setClass($('player'), 'open', true);
    stopVideo();
    playerMsg('');
    osd();
    var v = $('video');
    var failed = function () {
      if (ui.playing !== idx || ui.open !== 'player') return;
      playerMsg(ch.name + ' ist gerade nicht erreichbar' +
        (ch.tags.indexOf('Geo-blocked') >= 0 ? ' (nur im Herkunftsland)' : '') + '.  ▲ ▼ nächster Sender');
    };
    v.onerror = failed;
    v.onplaying = function () { clearTimeout(ui.watchdog); playerMsg(''); };
    ui.watchdog = setTimeout(failed, 20000);
    var native = v.canPlayType('application/vnd.apple.mpegurl') || v.canPlayType('application/x-mpegURL');
    if (native || !/\.m3u8(\?|$)/i.test(ch.url)) {
      v.src = ch.url;
      try { var pr = v.play(); if (pr && pr['catch']) pr['catch'](function () {}); } catch (e) {}
      return;
    }
    loadHls(function () {
      if (ui.playing !== idx || ui.open !== 'player') return;
      if (window.Hls && window.Hls.isSupported()) {
        ui.hls = new window.Hls({maxBufferLength: 20, maxMaxBufferLength: 30, backBufferLength: 10, maxBufferSize: 30 * 1000 * 1000});   // 1.4: Gesehenes nicht endlos im Speicher halten
        ui.hls.on(window.Hls.Events.ERROR, function (ev, data) { if (data && data.fatal) failed(); });
        ui.hls.loadSource(ch.url);
        ui.hls.attachMedia(v);
        try { var pr2 = v.play(); if (pr2 && pr2['catch']) pr2['catch'](function () {}); } catch (e) {}
      } else {
        v.src = ch.url;
      }
    });
  }

  function closePlayer() {
    stopVideo();
    playerMsg('');
    setClass($('player'), 'open', false);
    var back = ui.before;
    ui.before = null;
    if (back === 'wtv' || back === 'wtv-hidden') {
      ui.open = 'wtv';
      setClass($('wtv'), 'open', true);
      ui.zone = 'grid';
      if (ui.playList === ui.list) ui.item = ui.playing;
      paintWorld();
    } else { ui.open = null; if (ui.onClose) ui.onClose(); }
  }

  function playerKey(k, K) {
    var n = ui.playList ? ui.playList.length : 0;
    if (k === K.up || k === 427) play(ui.playList, (ui.playing - 1 + n) % n, ui.playLabel);
    else if (k === K.down || k === 428) play(ui.playList, (ui.playing + 1) % n, ui.playLabel);
    else if (k === K.back) closePlayer();
    else if (k === 403) Recorder.world(ui.playList && ui.playList[ui.playing]);   // rot: aufnehmen / beenden
    else if (k === K.ok || k === K.left || k === K.right) overlayWorld();
    else osd();
  }

  // MARK: - Sat-Senderliste (eigene Ebene)

  var tvl = {item: 0, info: false, scroll: 0};

  function openChannels() {
    var s = $('tvlist');
    if (!s || !sat.list.length) return false;
    ui.open = 'tvlist';
    setClass(s, 'open', true);
    var box = $('tvlist-rows');
    box.innerHTML = '';
    var cur = sat.channel;
    tvl.item = 0;
    for (var i = 0; i < sat.list.length; i++) {
      var ch = sat.list[i], row = el('div', 'row', box);
      // minor 65534/65535 heisst bei Samsung "keine Unternummer" (war als 22.65534 zu sehen)
      el('span', 'num', row, ch.major + (ch.minor > 0 && ch.minor < 1000 ? '.' + ch.minor : ''));
      el('span', 'nm', row, channelName(ch));
      el('span', 'pg', row, '');
      el('span', 'ib', row, 'ⓘ');
      if (cur && ch.major === cur.major && ch.minor === cur.minor) tvl.item = i;
    }
    tvl.info = false;
    paintChannels();
    paintInfo();
    return true;
  }

  function paintChannels() {
    var rows = $('tvlist-rows').children;
    for (var i = 0; i < rows.length; i++) setClass(rows[i], 'focus', i === tvl.item);
    var first = Math.max(0, Math.min(rows.length - 9, tvl.item - 4));
    $('tvlist-rows').style.webkitTransform = $('tvlist-rows').style.transform = 'translateY(' + (-first * 76) + 'px)';
    // Das laufende Programm nur fuer die sichtbaren Zeilen abfragen (bei Sat sind es oft ueber tausend Sender)
    for (var k = first; k < Math.min(rows.length, first + 10); k++) {
      var span = rows[k].children[2];
      if (span.getAttribute('data-q')) continue;
      span.setAttribute('data-q', '1');
      span.textContent = '…';
      (function (sp, c) { nowOn(c, function (pr) { sp.textContent = pr ? (pr.start ? hm(pr.start) + '  ' : '') + pr.title : ''; }); })(span, sat.list[k]);
    }
  }

  function closeChannels() {
    ui.open = null;
    setClass($('tvlist'), 'open', false);
    if (ui.onClose) ui.onClose();
  }

  // Infofeld rechts: alles, was der Sender zur Sendung mitliefert, dazu Bild und Text von Wikipedia, wenn es sie gibt
  function paintInfo() {
    var box = $('tvlist-info'), ch = sat.list[tvl.item];
    box.innerHTML = '';
    setClass(box, 'focus', tvl.info);
    if (!ch) return;
    el('div', 'ich', box, channelName(ch) + '  ·  ' + ch.major);
    var key = ch.major + '.' + ch.minor;
    nowOn(ch, function (pr) {
      if (sat.list[tvl.item] !== ch) return;
      var nx = sat.nexts && sat.nexts[key];
      if (!pr) { el('div', 'it', box, 'Keine Programmdaten vom Sender'); return; }
      var w = wikiFor(pr.title);
      if (w && w.img) { var im = el('div', 'iimg', box); im.style.backgroundImage = 'url("' + w.img + '")'; }
      el('div', 'it', box, pr.title);
      el('div', 'itime', box, (pr.start ? hm(pr.start) : '') + (pr.end ? '–' + hm(pr.end) + '  ·  noch ' + Math.max(0, Math.round((pr.end - Date.now()) / 60000)) + ' Min.' : ''));
      if (pr.text) el('div', 'itx', box, pr.text);
      if (w && w.text) { el('div', 'ih', box, 'Wikipedia'); el('div', 'itx', box, w.text); }
      if (nx) { el('div', 'ih', box, 'Danach ' + hm(nx.start)); el('div', 'inx', box, nx.title); }
      var body = box.querySelectorAll('.itx');
      for (var i = 0; i < body.length; i++) body[i].style.webkitTransform = body[i].style.transform = 'translateY(' + (-tvl.scroll) + 'px)';
    });
  }

  function channelsKey(k, K) {
    if (k === K.back) { if (tvl.info) { tvl.info = false; paintInfo(); return; } closeChannels(); return; }
    if (tvl.info) {   // im Infofeld: ▲ ▼ blaettern, ◄ zurueck zur Liste
      if (k === K.left || k === K.ok || k === 457) tvl.info = false;
      else if (k === K.down) tvl.scroll += 120;
      else if (k === K.up) tvl.scroll = Math.max(0, tvl.scroll - 120);
      paintInfo();
      return;
    }
    if (k === K.right || k === 457) { tvl.info = true; tvl.scroll = 0; paintInfo(); return; }   // ► oder Info-Taste
    if (k === K.up) tvl.item = Math.max(0, tvl.item - 1);
    else if (k === K.down) tvl.item = Math.min(sat.list.length - 1, tvl.item + 1);
    else if (k === 427) tvl.item = Math.max(0, tvl.item - 9);
    else if (k === 428) tvl.item = Math.min(sat.list.length - 1, tvl.item + 9);
    else if (k === K.ok) {
      var ch = sat.list[tvl.item];
      closeChannels();
      tune(ch, function () { changed(); });
      return;
    }
    tvl.scroll = 0;
    paintChannels();
    paintInfo();
  }

  // MARK: - Programmfuehrer (eigene Ebene): 10 Sender davor, der aktuelle, 10 danach, mit Zeitleiste

  var gd = {at: 0, from: 0, sel: 0, t: 0, menu: -1, detail: false, prog: null, ch: null};
  var GD_MIN = 5.2;   // Pixel pro Minute (1.6: Zeilen enden vor dem Fernsehbild rechts unten)
  var GD_SPAN = 180;   // Minuten sichtbar

  // Free My TV+ 1.4: EPG nacheinander laden (der Fernseher verwirft viele gleichzeitige Anfragen). Zuerst alle sichtbaren
  // Sender im sichtbaren Zeitfenster, dann dieselben Sender Fenster fuer Fenster bis Tagesende (oder bis Anzeigeende,
  // wenn der Tag vorher endet), erst danach die Sender ausserhalb der Liste.
  var epg = {}, epgQ = [], epgBusy = false, epgGen = 0;
  function epgKey(ch) { return ch.major + '.' + ch.minor; }
  function epgList(ch) { var e = epg[epgKey(ch)]; return e ? e.list : null; }
  function epgHas(ch, from, to) {
    var e = epg[epgKey(ch)];
    if (!e || e.at < Date.now() - 15 * 60000) return false;
    for (var i = 0; i < e.spans.length; i++) if (e.spans[i][0] <= from && e.spans[i][1] >= to) return true;
    return false;
  }
  function epgMerge(ch, from, to, list) {
    var key = epgKey(ch), e = epg[key];
    if (!e || e.at < Date.now() - 15 * 60000) e = epg[key] = {list: [], spans: [], at: Date.now()};
    var seen = {};
    for (var i = 0; i < e.list.length; i++) seen[e.list[i].start + '|' + e.list[i].title] = true;
    for (var j = 0; j < list.length; j++) {
      var p = list[j];
      if (!p.start || seen[p.start + '|' + p.title]) continue;
      seen[p.start + '|' + p.title] = true;
      e.list.push(p);
    }
    e.list.sort(function (x, y) { return x.start - y.start; });
    e.spans.push([from, to]);
  }
  function epgRun() {
    if (epgBusy || !epgQ.length) return;
    var job = epgQ.shift();
    if (epgHas(job.ch, job.from, job.to)) { if (job.done) job.done(epgList(job.ch)); setTimeout(epgRun, 0); return; }
    epgBusy = true;
    var finished = false;
    function finish(list, ok) {
      if (finished) return;
      finished = true;
      epgBusy = false;
      if (ok) epgMerge(job.ch, job.from, job.to, list);
      else if (!job.retry) { job.retry = true; epgQ.push(job); }   // einmal spaeter noch versuchen
      if (job.done && (ok || job.retry === 'done')) job.done(epgList(job.ch) || []);
      if (!ok && job.retry === true) job.retry = 'done';
      setTimeout(epgRun, 30);
    }
    setTimeout(function () { finish([], false); }, 4000);   // keine Antwort: weiter mit dem naechsten
    try {
      var tz;
      try { tz = new window.tizen.TZDate(new Date(job.from)); } catch (eT) { tz = new window.tizen.TZDate(); }
      tv.getProgramList(job.ch, tz, function (list) {
        var out = [];
        for (var i = 0; list && i < list.length; i++) out.push(program(list[i]));
        finish(out, true);
      }, function () { finish([], false); }, Math.max(1, Math.round((job.to - job.from) / 3600000)));
    } catch (e) { finish([], false); }
  }
  /** Die Ladeliste fuer den Programmfuehrer neu aufstellen: sichtbare Sender und Zeitfenster zuerst. */
  function epgPlan(visible, others, from, onRow) {
    epgGen++;
    epgQ = [];
    var span = GD_SPAN * 60000, end = from + span, day = new Date(from);
    day.setHours(24, 0, 0, 0);
    var until = Math.max(day.getTime(), end);
    var t, i;
    for (t = from; t < until; t += span) {
      for (i = 0; i < visible.length; i++) epgQ.push({ch: visible[i], from: t, to: t + span, done: t === from ? onRow(visible[i]) : null});
    }
    for (i = 0; i < others.length; i++) epgQ.push({ch: others[i], from: from, to: end});
    epgRun();
  }
  /** Fuer die Senderliste und das Info-Fenster: alles, was zu einem Sender schon da ist, sonst ein Abruf. */
  function plistOf(ch, done) {
    var now = Date.now(), from = now - 2 * 3600000;
    if (epgHas(ch, from, from + 8 * 3600000)) return done(epgList(ch));
    epgQ.unshift({ch: ch, from: from, to: from + 8 * 3600000, done: done});
    epgRun();
  }

  // Free My TV+ 1.6: Senderlogo aus tv-logo/tv-logos (raw.githubusercontent.com). Der Name wird vereinfacht und so lange
  // von hinten gekuerzt, bis ein Logo passt ("WDR HD Koeln" -> wdr-koln -> wdr).
  var LOGO_SET = null, logoCache = {};
  var LOGO_BASE = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/germany/';
  function logoFor(ch) {
    var name = channelName(ch);
    if (logoCache[name] !== undefined) return logoCache[name];
    if (!LOGO_SET) { LOGO_SET = {}; var l = window.TV_LOGOS || []; for (var i = 0; i < l.length; i++) LOGO_SET[l[i]] = true; }
    var n = name.toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
      .replace(/\b(u?hd|sd|hevc|fhd|4k)\b/g, ' ').replace(/\+/g, ' plus ').replace(/_/g, ' ')
      .replace(/pro ?7|prosieben/g, 'pro sieben').replace(/sat\.?\s?1/g, 'sat 1').replace(/rtl ?zwei|rtl ?2\b/g, 'rtl zwei').replace(/rtl ?up/g, 'rtl up')
      .replace(/vox ?up/g, 'vox up').replace(/zdf ?info/g, 'zdf info').replace(/zdf ?neo/g, 'zdf neo').replace(/kabel ?(eins|1)/g, 'kabel eins')
      .replace(/n-?tv/g, 'ntv').replace(/super ?rtl/g, 'rtl super').replace(/eurosport ?1/g, 'eurosport 1').replace(/\s+fs\b/g, ' ')
      .replace(/[^a-z0-9 ]+/g, ' ').replace(/^\s+|\s+$/g, '');
    var words = n.split(/\s+/), hit = '';
    for (var k = words.length; k > 0 && !hit; k--) { var slug = words.slice(0, k).join('-'); if (LOGO_SET[slug]) hit = slug; }
    if (!hit && LOGO_SET[words.join('')]) hit = words.join('');
    logoCache[name] = hit ? LOGO_BASE + hit + '-de.png' : '';
    return logoCache[name];
  }

  function guideIndex() {
    var cur = sat.channel;
    for (var i = 0; i < sat.list.length; i++) if (cur && sat.list[i].major === cur.major && sat.list[i].minor === cur.minor) return i;
    return 0;
  }

  // Free My TV+ 1.5: Programmfuehrer mit Zeitachse (◄ ►), Seiten (P+ P−), Menue auf OK (Ansehen, Info, Aufnehmen),
  // ausfuehrlicher Info-Seite und EPG-Auffrischung nach 1, 2 und 3 Minuten, dann alle 5 Minuten.
  var GD_PAGE = 15, GD_STEP = 30 * 60000, GD_AHEAD = 48 * 3600000;
  function openGuide() {
    if (!sat.list.length) return false;
    ui.open = 'guide';
    gd.sel = guideIndex();
    gd.t = Date.now();
    gd.menu = -1;
    gd.detail = false;
    setClass($('guide'), 'open', true);
    paintGuide();
    guideRefresh(0);
    legendChanged();
    return true;
  }

  var gdTimer = 0;
  function guideRefresh(round) {
    clearTimeout(gdTimer);
    var wait = round < 3 ? 60000 : 5 * 60000;
    gdTimer = setTimeout(function () {
      if (ui.open !== 'guide') return;
      for (var k in epg) if (epg.hasOwnProperty(k)) epg[k].at = 0;   // alles neu vom Tuner holen
      if (!gd.detail && gd.menu < 0) paintGuide();
      guideRefresh(round + 1);
    }, wait);
  }

  function guideFrom() { var f = Math.max(gd.t, Date.now()) - 30 * 60000; return f - f % (30 * 60000); }

  /** Die Sendung des Senders zum Zeitpunkt gd.t (oder die naechste danach). */
  function guidePick(list) {
    var t = Math.max(gd.t, Date.now()), best = null;
    for (var i = 0; list && i < list.length; i++) {
      var p = list[i];
      if (p.start <= t && (!p.end || p.end > t)) return p;
      if (p.start > t && (!best || p.start < best.start)) best = p;
    }
    return best;
  }

  function laneFill(ln, list, from, now, pick) {
    ln.innerHTML = '';
    var any = false;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p.start || !p.end || p.end < from || p.start > from + GD_SPAN * 60000) continue;
      var x = Math.max(0, (p.start - from) / 60000 * GD_MIN), w = Math.min(GD_SPAN * GD_MIN, (p.end - from) / 60000 * GD_MIN) - x;
      if (w < 8) continue;
      var b = el('div', 'gprog' + (p.start <= now && p.end > now ? ' live' : '') + (pick && p === pick ? ' pick' : ''), ln);
      b.style.left = x + 'px';
      b.style.width = (w - 4) + 'px';
      el('div', 'gt', b, p.title);
      el('div', 'gh', b, hm(p.start) + '–' + hm(p.end));
      any = true;
    }
    if (!any) el('div', 'gnone', ln, 'Programmdaten werden geladen …');
    return any;
  }

  function dayLabel(ms) {
    var d = new Date(ms), t = new Date(), days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    var diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000);
    return diff === 0 ? 'Heute' : diff === 1 ? 'Morgen' : days[d.getDay()] + ' ' + d.getDate() + '.' + (d.getMonth() + 1) + '.';
  }

  function paintGuide() {
    var box = $('gd-rows'), head = $('gd-head'), at = gd.sel, n = sat.list.length, playing = guideIndex();
    var now = Date.now(), from = guideFrom();
    gd.from = from;
    head.innerHTML = '';
    for (var t = 0; t <= GD_SPAN; t += 30) {
      var tick = el('div', 'tick', head, (t === 0 ? dayLabel(from) + '  ' : '') + hm(from + t * 60000));
      tick.style.left = (t * GD_MIN) + 'px';
    }
    var nowLine = $('gd-now'), nx = (now - from) / 60000 * GD_MIN;
    nowLine.style.left = (368 + nx) + 'px';
    nowLine.style.display = nx >= 0 && nx <= GD_SPAN * GD_MIN ? '' : 'none';
    box.innerHTML = '';
    var lanes = {}, visible = [], others = [];
    var half = Math.min(7, Math.floor((n - 1) / 2)), last = Math.min(7, n - 1 - half);   // 1.6: 15 Zeilen, dafuer groesser
    for (var d = -half; d <= last; d++) {
      var idx = (at + d + n * 3) % n, ch = sat.list[idx];
      if (!ch || lanes[epgKey(ch)]) continue;
      var row = el('div', 'grow' + (d === 0 ? ' cur' : '') + (idx === playing ? ' playing' : ''), box);
      var name = el('div', 'gname', row);
      el('span', 'gn', name, String(ch.major));
      var lg = el('span', 'glogo', name), lu = logoFor(ch);
      if (lu) { var im2 = el('img', '', lg); im2.src = lu; im2.onerror = function () { this.parentNode.className = 'glogo none'; }; }
      else lg.className = 'glogo none';
      el('span', 'gc', name, channelName(ch));
      var lane = el('div', 'glane', row);
      lanes[epgKey(ch)] = {lane: lane, cur: d === 0};
      visible.push(ch);
      var have = epgList(ch);
      if (have) laneFill(lane, have, from, now, d === 0 ? guidePick(have) : null);
      else el('div', 'gnone', lane, 'Programmdaten werden geladen …');
      if (d === 0) guideInfo(ch, have || []);
    }
    for (var o = 11; o <= 40 && o * 2 < n; o++) { others.push(sat.list[(at + o) % n]); others.push(sat.list[(at - o + n * 3) % n]); }
    epgPlan(visible, others, from, function (c) {
      return function (list) {
        var l = lanes[epgKey(c)];
        if (!l) return;
        if (!laneFill(l.lane, list, from, Date.now(), l.cur ? guidePick(list) : null)) { l.lane.innerHTML = ''; el('div', 'gnone', l.lane, 'Keine Programmdaten vom Sender'); }
        if (l.cur) guideInfo(c, list);
      };
    });
    paintGuideMenu();
  }

  /** Rechts oben, kurz: Bild, Titel, Zeit, zwei, drei Zeilen. Mehr steht unter OK, Info. */
  function guideInfo(ch, list) {
    var box = $('gd-info'), cur = guidePick(list);
    gd.prog = cur;
    gd.ch = ch;
    box.innerHTML = '';
    if (!cur) { el('div', 'it', box, channelName(ch)); return; }
    var w = wikiFor(cur.title);
    if (w && w.img) { var im = el('div', 'iimg', box); im.style.backgroundImage = 'url("' + w.img + '")'; }
    el('div', 'it', box, cur.title);
    var now = Date.now();
    el('div', 'itime', box, channelName(ch) + '  ·  ' + (cur.start > now ? dayLabel(cur.start) + ' ' : '') + hm(cur.start) + '–' + hm(cur.end) +
      (cur.start <= now && cur.end > now ? '  ·  noch ' + Math.max(0, Math.round((cur.end - now) / 60000)) + ' Min.' : ''));
    var text = cur.text || (w && w.text) || '';
    if (text) el('div', 'itx short', box, text);
    el('div', 'imore', box, 'OK: Ansehen · Info · Aufnehmen');
  }
  function guideWiki() {
    if (gd.detail) paintDetail();
    else if (gd.ch) guideInfo(gd.ch, epgList(gd.ch) || []);
  }

  // Menue auf OK: drei Kacheln ueber der Zeile
  function menuItems() {
    var p = gd.prog, now = Date.now(), future = p && p.start > now + 60000;
    return [{id: 'watch', label: future ? 'Erinnern' : 'Programm ansehen', sym: future ? 'bell' : 'play'},
      {id: 'info', label: 'Info', sym: 'sparkles'},
      {id: 'rec', label: future ? 'Aufnahme planen' : 'Aufnehmen', sym: 'live_tv'}];
  }
  function paintGuideMenu() {
    var m = $('gd-menu');
    if (!m) { m = el('div', '', $('guide')); m.id = 'gd-menu'; }
    m.innerHTML = '';
    setClass(m, 'on', gd.menu >= 0);
    if (gd.menu < 0) return;
    var items = menuItems();
    el('div', 'mh', m, (gd.prog ? gd.prog.title : channelName(gd.ch)) + '  ·  ' + channelName(gd.ch));
    for (var i = 0; i < items.length; i++) {
      var b = el('div', 'mtile' + (i === gd.menu ? ' focus' : ''), m);
      var sy = el('span', 'sym', b);
      sy.style.webkitMaskImage = sy.style.maskImage = 'url(symbols/' + items[i].sym + '.png)';
      el('div', 'ml', b, items[i].label);
    }
  }

  function menuRun(id) {
    var ch = sat.list[gd.sel], p = gd.prog;
    if (id === 'info') { gd.menu = -1; gd.detail = true; paintGuideMenu(); paintDetail(); legendChanged(); if (ui.onClose) ui.onClose('refresh'); return; }
    if (id === 'rec') { gd.menu = -1; paintGuideMenu(); Recorder.sat(ch, p); return; }
    // ansehen (oder erinnern)
    gd.menu = -1;
    if (p && p.start > Date.now() + 60000) { Recorder.remind(ch, p); paintGuide(); return; }
    if (gd.sel !== guideIndex()) {
      sat.channel = ch; sat.now = null; sat.next = null;
      changed();
      tune(ch, function () { changed(); });
    }
    closeGuide();
    if (guideHooks.watch) guideHooks.watch();
  }

  // Die ausfuehrliche Info: grosse Schrift, Bild, wann, wo, wer, Genre, Aehnliches
  var similar = {};
  function similarFor(page, done) {
    if (similar[page] !== undefined) return done(similar[page]);
    similar[page] = [];
    getText('https://de.wikipedia.org/w/api.php?action=query&list=search&srlimit=6&format=json&origin=*&srsearch=' +
      encodeURIComponent('morelike:' + page), function (err, text) {
      if (err) return;
      try {
        var j = JSON.parse(text), out = [], r = j.query && j.query.search || [];
        for (var i = 0; i < r.length; i++) out.push(r[i].title);
        similar[page] = out;
        done(out);
      } catch (e) {}
    }, 8000);
  }
  /** Mitwirkende, Regie, Genre, Jahr aus dem EPG-Text (die Sender schreiben das meist ans Ende). */
  function parseCredits(text) {
    var out = {}, m;
    if ((m = /(?:Darsteller|Mit|Besetzung)\s*:?\s*([^.]{3,300})/i.exec(text))) out.cast = m[1].replace(/\s+-\s+/g, ' als ').replace(/\s+/g, ' ');
    if ((m = /Regie\s*:?\s*([^.,]{3,80})/i.exec(text))) out.director = m[1];
    if ((m = /(?:Buch|Autor|Drehbuch)(?:\/Autor)?\s*:?\s*([^.,]{3,80})/i.exec(text))) out.writer = m[1];
    if ((m = /(?:Moderation|Moderator|Moderatorin|mit)\s+([A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß]+)/.exec(text))) out.host = m[1];
    if ((m = /(Spielfilm|Fernsehfilm|Serie|Dokumentation|Doku|Reportage|Magazin|Nachrichten|Show|Talkshow|Krimi|Komödie|Drama|Thriller|Sitcom|Zeichentrick|Animation|Sport|Musik|Quiz|Gerichtsdrama|Actionfilm|Western|Science-Fiction|Abenteuer|Liebesfilm|Horrorfilm|Kinderserie|Naturdoku)[^.,]{0,40}?,?\s*([A-Z]{1,3}[a-z]*(?:\/[A-Z][a-z]+)*)?\s*((?:19|20)\d\d)?/.exec(text))) {
      out.genre = m[1]; if (m[2]) out.country = m[2]; if (m[3]) out.year = m[3];
    }
    return out;
  }
  function paintDetail() {
    var d = $('gd-detail');
    if (!d) { d = el('div', '', $('guide')); d.id = 'gd-detail'; }
    setClass(d, 'on', gd.detail);
    if (!gd.detail) return;
    d.innerHTML = '';
    var p = gd.prog, ch = gd.ch, now = Date.now();
    if (!p) { el('div', 'dt', d, channelName(ch)); el('div', 'dx', d, 'Zu dieser Zeit liefert der Sender keine Programmdaten.'); return; }
    var w = wikiFor(p.title) || {}, cr = parseCredits(p.text || '');
    var side = el('div', 'dside', d);
    if (w.img) { var im = el('div', 'dimg', side); im.style.backgroundImage = 'url("' + w.img + '")'; }
    var facts = el('div', 'dfacts', side);
    function fact(k, v) { if (!v) return; var r = el('div', 'df', facts); el('span', 'dk', r, k); el('span', 'dv', r, v); }
    fact('Wann', dayLabel(p.start) + ', ' + hm(p.start) + '–' + hm(p.end) + (p.start <= now && p.end > now ? '  (läuft, noch ' + Math.round((p.end - now) / 60000) + ' Min.)' : ''));
    fact('Sender', channelName(ch) + '  ·  Programmplatz ' + ch.major);
    fact('Genre', [cr.genre || w.desc || '', cr.country || '', cr.year || ''].join(' ').replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' '));
    fact('Mit', cr.cast || cr.host || '');
    fact('Regie', cr.director || '');
    fact('Buch', cr.writer || '');
    fact('Sprache', p.lang || '');
    fact('Alter', p.rating ? 'ab ' + p.rating : '');
    var main = el('div', 'dmain', d);
    el('div', 'dt', main, p.title);
    el('div', 'dx', main, p.text || w.text || 'Der Sender liefert zu dieser Sendung keine Beschreibung.');
    if (p.text && w.text && w.text !== p.text) { el('div', 'dsub', main, 'Aus der Wikipedia'); el('div', 'dx wiki', main, w.text); }
    // weitere Termine im EPG und aehnliche Sendungen aus der Wikipedia
    var more = [], seen = {};
    for (var k in epg) {
      if (!epg.hasOwnProperty(k)) continue;
      var l = epg[k].list;
      for (var i = 0; i < l.length; i++) if (l[i] !== p && l[i].title === p.title && l[i].start > now && !seen[l[i].start]) {
        seen[l[i].start] = true;
        more.push(dayLabel(l[i].start) + ' ' + hm(l[i].start) + '  ' + chanByKey(k));
      }
    }
    if (more.length) { el('div', 'dsub', main, 'Weitere Termine'); el('div', 'dx', main, more.slice(0, 4).join('   ·   ')); }
    var simBox = el('div', 'dx sim', main);
    if (w.page) similarFor(w.page, function (list) {
      simBox.innerHTML = '';
      if (!list.length) return;
      el('div', 'dsub', simBox, 'Ähnliche Sendungen');
      simBox.appendChild(document.createTextNode(list.join('   ·   ')));
    });
  }
  function chanByKey(k) {
    for (var i = 0; i < sat.list.length; i++) if (epgKey(sat.list[i]) === k) return channelName(sat.list[i]);
    return '';
  }

  function closeGuide() {
    ui.open = null;
    clearTimeout(gdTimer);
    gd.menu = -1;
    gd.detail = false;
    paintGuideMenu();
    paintDetail();
    epgGen++;
    epgQ = [];
    sweepStop();
    setClass($('guide'), 'open', false);
    if (ui.onClose) ui.onClose();
  }

  // Free My TV+ 1.7: EPG automatisch. Zuerst wird der 2. Empfaenger versucht (tune mit Fenster "SUB"): bleibt dabei das
  // Hauptbild unveraendert, laeuft der Suchlauf alle 3 Stunden unsichtbar im Hintergrund. Laesst Samsung das nicht zu,
  // sammelt die App nachts (3 bis 5 Uhr, 90 Minuten ohne Taste) und schaltet danach zurueck. Rote Taste geht weiter.
  var auto = {busy: false, ok: stored('epgSub'), at: stored('epgAutoAt') || 0, idleAt: Date.now()};
  function transponders(max) {
    var seen = {}, list = [];
    for (var i = 0; i < sat.list.length && list.length < max; i++) {
      var c = sat.list[i], key = c.transportStreamID !== undefined ? String(c.originalNetworkID) + '.' + String(c.transportStreamID) : epgKey(c);
      if (seen[key]) continue;
      seen[key] = true;
      list.push(c);
    }
    return list;
  }
  function sameMain(a) { try { var m = tv.getCurrentChannel('MAIN'); return m && a && m.major === a.major && m.minor === a.minor; } catch (e) { return true; } }
  function subTune(c, done) {
    var main = sat.channel, over = false;
    function fin(ok) { if (over) return; over = true; done(ok && sameMain(main)); }
    try {
      tv.tune({major: c.major, minor: c.minor}, {onsuccess: function () { fin(true); }, onnosignal: function () { fin(true); }}, function () { fin(false); }, 'SUB');
      setTimeout(function () { fin(false); }, 8000);
    } catch (e) { fin(false); }
  }
  function autoEpg() {
    if (auto.busy || sweep || !tv || !sat.list.length || Date.now() - auto.at < 3 * 3600000) return;
    var list = transponders(80);
    if (auto.ok !== false) {
      auto.busy = true;
      subTune(list[0], function (ok) {
        if (!ok) {
          // der 2. Empfaenger ist fuer Apps nicht erreichbar: das Hauptbild wieder herstellen, falls es sich doch bewegt hat
          auto.ok = false; store('epgSub', false); auto.busy = false;
          if (sat.channel && !sameMain(sat.channel)) tune(sat.channel, function () { refreshSat(); });
          return;
        }
        auto.ok = true; store('epgSub', true);
        var i = 1;
        (function next() {
          if (i >= list.length) { auto.busy = false; auto.at = Date.now(); store('epgAutoAt', auto.at); for (var k in epg) if (epg.hasOwnProperty(k)) epg[k].at = 0; return; }
          subTune(list[i++], function () { setTimeout(next, 9000); });
        })();
      });
      return;
    }
    // Rueckfall: nachts, wenn lange niemand eine Taste gedrueckt hat
    var h = new Date().getHours();
    if (!(window.Prefs && Prefs.epgNight && Prefs.epgNight()) || h < 3 || h >= 5 || Date.now() - auto.idleAt < 90 * 60000) return;
    auto.busy = true;
    var back = sat.channel, j = 0;
    (function step() {
      if (Date.now() - auto.idleAt < 60000 || j >= list.length) {   // jemand drueckt eine Taste: sofort zurueck
        auto.busy = false;
        if (j >= list.length) { auto.at = Date.now(); store('epgAutoAt', auto.at); }
        if (back) tune(back, function () { refreshSat(); });
        for (var k in epg) if (epg.hasOwnProperty(k)) epg[k].at = 0;
        return;
      }
      tune(list[j++], function () {});
      setTimeout(step, 9000);
    })();
  }
  setInterval(autoEpg, 10 * 60000);
  setTimeout(autoEpg, 2 * 60000);

  // EPG-Suchlauf (rote Taste): je Transponder ein Sender fuer ein paar Sekunden, damit der Tuner dessen
  // Programmdaten einsammelt. Danach zurueck zum Sender von vorher.
  var sweep = null;
  function sweepStart() {
    if (sweep || !sat.list.length) return;
    var seen = {}, list = [], n = sat.list.length;
    for (var o = -40; o <= 40; o++) {
      var c = sat.list[(gd.sel + o + n * 3) % n], ts = c && (String(c.originalNetworkID) + '.' + String(c.transportStreamID));
      if (!c || (c.transportStreamID === undefined && seen[epgKey(c)])) continue;
      var key = c.transportStreamID !== undefined ? ts : epgKey(c);
      if (seen[key]) continue;
      seen[key] = true;
      list.push(c);
    }
    sweep = {list: list, i: 0, back: sat.channel, timer: 0};
    sweepNext();
  }
  function sweepNext() {
    if (!sweep) return;
    var head = $('gd-sweep') || el('div', '', $('guide'));
    head.id = 'gd-sweep';
    if (sweep.i >= sweep.list.length) {
      var back = sweep.back;
      sweep = null;
      head.textContent = 'EPG-Suchlauf fertig';
      setTimeout(function () { if (!sweep) head.textContent = ''; }, 4000);
      if (back) tune(back, function () { refreshSat(); });
      for (var k in epg) if (epg.hasOwnProperty(k)) epg[k].at = 0;
      if (ui.open === 'guide') paintGuide();
      return;
    }
    var c = sweep.list[sweep.i++];
    head.textContent = 'EPG-Suchlauf ' + sweep.i + ' von ' + sweep.list.length + ': ' + channelName(c) + '  ·  Zurück bricht ab';
    tune(c, function () {});
    sweep.timer = setTimeout(sweepNext, 9000);
  }
  function sweepStop() {
    if (!sweep) return;
    clearTimeout(sweep.timer);
    var back = sweep.back;
    sweep = null;
    var head = $('gd-sweep');
    if (head) head.textContent = '';
    if (back) tune(back, function () { refreshSat(); });
  }

  function guideKey(k, K) {
    var n = sat.list.length;
    if (sweep) { if (k === K.back) { sweepStop(); paintGuide(); } return; }
    if (gd.detail) {
      if (k === K.back || k === K.ok || k === 457) { gd.detail = false; paintDetail(); paintGuide(); if (ui.onClose) ui.onClose('refresh'); }
      else if (k === K.down) { $('gd-detail').scrollTop += 120; }
      else if (k === K.up) { $('gd-detail').scrollTop -= 120; }
      return;
    }
    if (gd.menu >= 0) {
      var items = menuItems();
      if (k === K.back) gd.menu = -1;
      else if (k === K.left) gd.menu = Math.max(0, gd.menu - 1);
      else if (k === K.right) gd.menu = Math.min(items.length - 1, gd.menu + 1);
      else if (k === K.ok) { menuRun(items[gd.menu].id); return; }
      paintGuideMenu();
      return;
    }
    if (k === K.back) { closeGuide(); return; }
    if (k === K.ok) { gd.menu = 0; paintGuideMenu(); return; }
    if (k === 457) { gd.detail = true; paintDetail(); if (ui.onClose) ui.onClose('refresh'); return; }   // Info-Taste
    if (k === 403) { sweepStart(); return; }   // rot: EPG-Suchlauf
    if (k === K.up) gd.sel = (gd.sel - 1 + n) % n;
    else if (k === K.down) gd.sel = (gd.sel + 1) % n;
    else if (k === 427) gd.sel = (gd.sel - GD_PAGE + n * 3) % n;   // 1.6: P+ eine Seite nach oben
    else if (k === 428) gd.sel = (gd.sel + GD_PAGE) % n;   // P− eine Seite nach unten
    else if (k === K.right) gd.t = Math.min(Date.now() + GD_AHEAD, Math.max(gd.t, Date.now()) + GD_STEP);
    else if (k === K.left) gd.t = Math.max(Date.now(), gd.t - GD_STEP);
    else return;
    paintGuide();
  }
  var guideHooks = {};

  // MARK: - Mediaplayer (wie VLC, soweit Samsung es zulaesst): USB-Speicher durchsuchen, Adressen abspielen

  var MEDIA_EXT = /\.(mp4|m4v|mkv|webm|mov|avi|ts|m2ts|mpg|mpeg|mp3|m4a|aac|flac|wav|ogg|opus|m3u8?|jpg|jpeg|png)$/i;
  var md = {stack: [], rows: [], item: 0, title: 'Medien'};
  function mediaLegend() { return '▲ ▼ wählen  ·  OK öffnen / abspielen  ·  Zurück: eine Ebene hoch'; }

  function openMedia() {
    ui.open = 'media';
    setClass($('media'), 'open', true);
    md.stack = [];
    mediaHome();
    legendChanged();
    return true;
  }

  function mediaHome() {
    md.title = 'Medien';
    md.rows = [{label: 'Adresse abspielen (Video, Musik, Stream)', kind: 'url'}];
    var fs = window.tizen && window.tizen.filesystem;
    if (fs && fs.listStorages) {
      try {
        fs.listStorages(function (list) {
          for (var i = 0; i < list.length; i++) {
            if (list[i].type === 'EXTERNAL' && list[i].state === 'MOUNTED') {
              md.rows.push({label: 'USB: ' + list[i].label, kind: 'dir', path: list[i].label});
              md.rows.splice(1, 0, {label: '● Aufnahmen auf dem USB-Stick', kind: 'dir', path: list[i].label + '/' + REC_DIR});
            }
          }
          if (md.rows.length === 1) md.rows.push({label: 'Kein USB-Speicher gefunden. Stick einstecken, dann OK zum Neuladen.', kind: 'reload'});
          paintMedia();
        }, function () { paintMedia(); });
      } catch (e) {}
    } else md.rows.push({label: 'USB-Speicher gibt es nur am Fernseher', kind: 'none'});
    md.rows.push({label: 'Eigene Quellen und Listen: in Welt-TV unter „Eigene Quellen“', kind: 'wtv'});
    var c = Recorder.cfg();
    if (c.nas) md.rows.push({label: '● Aufnahmen im Netzwerk', kind: 'nasrec'});
    md.rows.push({label: 'Aufnahmen speichern auf:  ' + (c.target === 'nas' ? 'Netzwerkspeicher' : 'USB-Stick') + '   (OK wechselt)', kind: 'target'});
    md.rows.push({label: 'Netzwerkspeicher (WebDAV-Adresse):  ' + (c.nas || 'nicht eingerichtet'), kind: 'input', field: 'recNas',
      hint: 'WebDAV-Adresse, z. B. http://IP-vom-NAS:5005/aufnahmen/'});
    md.rows.push({label: 'Netzwerk-Benutzer:  ' + (c.user || '–'), kind: 'input', field: 'recUser', hint: 'Benutzername für den Netzwerkspeicher'});
    md.rows.push({label: 'Netzwerk-Passwort:  ' + (c.pass ? '••••••' : '–'), kind: 'input', field: 'recPass', hint: 'Passwort (bleibt nur auf diesem Fernseher)', secret: true});
    md.item = 0;
    paintMedia();
  }

  /** Aufnahmen im Netzwerkordner auflisten (WebDAV PROPFIND): jeder Unterordner mit playlist.m3u8 ist eine Aufnahme. */
  function mediaNas() {
    var c = Recorder.cfg(), base = c.nas.replace(/\/?$/, '/');
    md.title = 'Aufnahmen im Netzwerk';
    md.rows = [{label: 'Wird gelesen …', kind: 'none'}];
    paintMedia();
    var x = new XMLHttpRequest();
    try { x.open('PROPFIND', base, true); } catch (e) { md.rows = [{label: 'Netzwerkspeicher nicht erreichbar', kind: 'none'}]; paintMedia(); return; }
    if (c.user) x.setRequestHeader('Authorization', 'Basic ' + btoa(unescape(encodeURIComponent(c.user + ':' + c.pass))));
    x.setRequestHeader('Depth', '1');
    x.onload = function () {
      var rows = [], re = /<[a-z]*:?href>([^<]+)<\/[a-z]*:?href>/gi, m, host = base.replace(/^([a-z]+:\/\/[^\/]+).*$/i, '$1');
      while ((m = re.exec(x.responseText || ''))) {
        var h = m[1], full = /^[a-z]+:\/\//i.test(h) ? h : host + h;
        if (full.replace(/\/?$/, '/') === base || !/\/$/.test(h)) continue;
        rows.push({label: decodeURIComponent(h.replace(/\/$/, '').replace(/^.*\//, '')), kind: 'file', url: full + 'playlist.m3u8'});
      }
      rows.sort(function (a, b) { return a.label < b.label ? 1 : -1; });
      md.rows = rows.length ? rows : [{label: 'Noch keine Aufnahmen', kind: 'none'}];
      md.item = 0;
      paintMedia();
    };
    x.onerror = function () { md.rows = [{label: 'Netzwerkspeicher nicht erreichbar', kind: 'none'}]; paintMedia(); };
    x.send();
  }

  function mediaDir(path, label) {
    md.title = label || path;
    md.rows = [{label: 'Wird gelesen …', kind: 'none'}];
    paintMedia();
    try {
      window.tizen.filesystem.resolve(path, function (dir) {
        dir.listFiles(function (files) {
          var rows = [];
          files.sort(function (a, b) { return (b.isDirectory - a.isDirectory) || (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1); });
          for (var i = 0; i < files.length; i++) {
            var f = files[i];
            if (f.name.charAt(0) === '.') continue;
            if (f.isDirectory) rows.push({label: '▸  ' + f.name, kind: 'dir', path: path + '/' + f.name});
            else if (MEDIA_EXT.test(f.name)) rows.push({label: f.name, kind: 'file', url: f.toURI()});
          }
          md.rows = rows.length ? rows : [{label: 'Hier liegen keine Medien', kind: 'none'}];
          md.item = 0;
          paintMedia();
        }, function () { md.rows = [{label: 'Ordner ließ sich nicht lesen', kind: 'none'}]; paintMedia(); });
      }, function () { md.rows = [{label: 'Speicher ließ sich nicht öffnen', kind: 'none'}]; paintMedia(); }, 'r');
    } catch (e) { md.rows = [{label: 'Speicher ließ sich nicht öffnen', kind: 'none'}]; paintMedia(); }
  }

  function paintMedia() {
    $('media-title').textContent = md.title;
    var box = $('media-rows');
    box.innerHTML = '';
    for (var i = 0; i < md.rows.length; i++) {
      var r = el('div', 'row' + (md.rows[i].kind === 'none' ? ' dim' : ''), box, md.rows[i].label);
      setClass(r, 'focus', i === md.item);
    }
    var first = Math.max(0, Math.min(md.rows.length - 10, md.item - 4));
    box.style.webkitTransform = box.style.transform = 'translateY(' + (-first * 76) + 'px)';
  }

  function mediaFiles() {
    var list = [];
    for (var i = 0; i < md.rows.length; i++) if (md.rows[i].kind === 'file') list.push({name: md.rows[i].label, url: md.rows[i].url, logo: '', tags: [], cc: '', group: md.title});
    return list;
  }

  function mediaKey(k, K) {
    var f = $('media-q');
    if (document.activeElement === f) {
      if ((k === K.ok || k === 65376) && md.field) {
        f.blur();
        store(md.field, (f.value || '').replace(/^\s+|\s+$/g, ''));
        md.field = null;
        f.type = 'text';
        setClass($('media-search'), 'on', false);
        var keep = md.item;
        mediaHome();
        md.item = keep;
        paintMedia();
        return true;
      }
      if (k === K.ok || k === 65376) {
        f.blur();
        var u = (f.value || '').replace(/^\s+|\s+$/g, '');
        if (/^(https?|rtsp|rtmp|udp|file):\/\//i.test(u)) { setClass($('media'), 'open', false); play([{name: u.replace(/^.*\//, '') || u, url: u, logo: '', tags: [], cc: ''}], 0, 'Mediaplayer'); }
        return true;
      }
      if (k === K.back || k === 27 || k === 65385) { f.blur(); md.field = null; f.type = 'text'; setClass($('media-search'), 'on', false); return true; }
      return 'type';
    }
    if (k === K.back) {
      if (md.stack.length) { var prev = md.stack.pop(); if (prev) mediaDir(prev.path, prev.label); else mediaHome(); }
      else { ui.open = null; setClass($('media'), 'open', false); if (ui.onClose) ui.onClose(); }
      return true;
    }
    if (k === K.up) md.item = Math.max(0, md.item - 1);
    else if (k === K.down) md.item = Math.min(md.rows.length - 1, md.item + 1);
    else if (k === K.ok) {
      var r = md.rows[md.item];
      if (!r) return true;
      if (r.kind === 'url') { md.field = null; f.type = 'text'; f.placeholder = 'https://… oder rtsp://… eingeben, OK spielt ab'; setClass($('media-search'), 'on', true); f.value = ''; f.focus(); return true; }
      if (r.kind === 'input') {
        md.field = r.field;
        f.type = r.secret ? 'password' : 'text';
        f.placeholder = r.hint;
        f.value = r.secret ? '' : (stored(r.field) || '');
        setClass($('media-search'), 'on', true);
        f.focus();
        return true;
      }
      if (r.kind === 'target') { store('recTarget', Recorder.cfg().target === 'nas' ? 'usb' : 'nas'); var at2 = md.item; mediaHome(); md.item = at2; paintMedia(); return true; }
      if (r.kind === 'nasrec') { md.stack.push(null); mediaNas(); return true; }
      if (r.kind === 'reload') { mediaHome(); return true; }
      if (r.kind === 'wtv') { setClass($('media'), 'open', false); ui.open = null; openWorld(); return true; }
      if (r.kind === 'dir') { md.stack.push(md.stack.length ? {path: md.curPath, label: md.title} : null); md.curPath = r.path; mediaDir(r.path, r.label.replace('▸  ', '')); return true; }
      if (r.kind === 'file') {
        var files = mediaFiles(), at = 0;
        for (var i = 0; i < files.length; i++) if (files[i].url === r.url) at = i;
        setClass($('media'), 'open', false);
        play(files, at, md.title);
        return true;
      }
    }
    paintMedia();
    return true;
  }

  // MARK: - News nach Themen: jede Kachel hat ihr Thema, blaettert durch die Artikel, mit Bild aus der Quelle

  var TOPICS = window.NEWS_TOPICS || [];
  var NEWS_SLOTS = 4;
  var DEFAULT_TOPICS = ['Cybersecurity', 'Künstliche Intelligenz', 'Technik', 'Wissenschaft'];
  function topicsChosen() { var t = stored('newsTopics'); return t && t.length === NEWS_SLOTS ? t : DEFAULT_TOPICS.slice(); }
  var topicNews = {}, topicAt = {}, topicBusy = {};

  /** Bing News (RSS, mit Vorschaubild); geht das nicht, Google News (ohne Bild). */
  function loadTopic(topic) {
    if (topicBusy[topic] || (topicAt[topic] && Date.now() - topicAt[topic] < 30 * 60000)) return;
    topicBusy[topic] = true;
    var q = encodeURIComponent(topic);
    function done(items) { topicBusy[topic] = false; if (items && items.length) { topicNews[topic] = items; topicAt[topic] = Date.now(); changed(); } }
    getText('https://www.bing.com/news/search?q=' + q + '&format=rss&setlang=de-DE&cc=DE&mkt=de-DE', function (err, text) {
      var items = err ? null : parseTopicFeed(text);
      if (items && items.length) return done(items);
      getText('https://news.google.com/rss/search?q=' + q + '&hl=de&gl=DE&ceid=DE:de', function (err2, text2) {
        done(err2 ? null : parseTopicFeed(text2));
      }, 15000);
    }, 15000);
  }

  function parseTopicFeed(text) {
    var doc;
    try { doc = new DOMParser().parseFromString(text, 'text/xml'); } catch (e) { return null; }
    var items = doc.getElementsByTagName('item'), out = [];
    for (var i = 0; i < items.length && out.length < 12; i++) {
      var it = items[i], title = firstText(it, ['title']), link = firstText(it, ['link']);
      var img = '';
      var cands = it.getElementsByTagName('*');
      for (var c = 0; c < cands.length && !img; c++) {
        var n = cands[c].localName || cands[c].nodeName;
        if (/^(Image|image|thumbnail|content)$/i.test(n.replace(/^.*:/, ''))) img = cands[c].getAttribute('url') || cands[c].textContent || '';
      }
      if (img && img.indexOf('bing.com/th') >= 0 && img.indexOf('&w=') < 0) img += '&w=800&h=450&c=7';
      var src = firstText(it, ['source', 'News:Source']) || (link.match(/^https?:\/\/(?:www\.)?([^\/]+)/) || [])[1] || '';
      var at = Date.parse(firstText(it, ['pubDate'])) || 0;
      if (title) out.push({title: decode(title).replace(/\s+-\s+[^-]+$/, ''), link: link, image: img, source: src, at: at});
    }
    return out;
  }

  /** Die Kacheln im Tab "News": locker gestaffelt, eine grosse, zwei gestapelte, eine hohe und "Themen waehlen". */
  var NEWS_RECTS = [[80, 262, 820, 500], [920, 262, 440, 240], [920, 522, 440, 240], [1380, 262, 460, 380]];
  function newsCards(hooks) {
    var chosen = topicsChosen(), out = [], tick = Math.floor(Date.now() / 9000);
    for (var i = 0; i < NEWS_SLOTS; i++) {
      var topic = chosen[i], list = topicNews[topic];
      loadTopic(topic);
      if (topic === 'Cybersecurity' && (!list || !list.length) && news.length) list = news;   // heise/Golem als Rueckfall
      if (!list || !list.length) {
        out.push({id: 'n' + i + topic, text: 'Wird geladen …', kicker: topic, title: '', news: true, inside: true, plain: true, rect: NEWS_RECTS[i], run: function () {}});
        continue;
      }
      var it = list[(tick + i * 3) % list.length];
      (function (a) {
        out.push({id: 'n' + i + topic + a.title, text: a.title, kicker: topic + '  ·  ' + (a.source || '') + (a.at ? '  ·  ' + ago(a.at) : ''),
          title: '', news: true, inside: true, plain: true, image: a.image, rect: NEWS_RECTS[i],
          run: function () { if (a.link) openUrl(a.link, function () { hooks.toast('Artikel ließ sich nicht öffnen.'); }); }});
      })(it);
    }
    out.push({id: 'ntopics', text: 'Themen wählen', kicker: chosen.join('  ·  '), title: '', plain: true, inside: true, flat: true,
      rect: [1380, 662, 460, 100], run: function () { openTopics(); }});
    return out;
  }
  setInterval(function () { if (!ui.open) changed(); }, 9000);   // die News-Kacheln blaettern weiter

  // Themenwahl (eigene Ebene)
  var tp = {zone: 'slots', slot: 0, item: 0, scroll: 0, list: TOPICS, letter: 0};
  var LETTERS = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  function firstLetter(t) { var c = (t || '').charAt(0).toUpperCase().replace('Ä', 'A').replace('Ö', 'O').replace('Ü', 'U'); return /[A-Z]/.test(c) ? c : '#'; }
  var TP_COLS = 4, TP_RH = 64, TP_VIS = 12;
  function openTopics() {
    ui.open = 'topics';
    setClass($('topics'), 'open', true);
    tp.zone = 'slots'; tp.list = TOPICS; tp.item = Math.max(0, TOPICS.indexOf(topicsChosen()[0]));
    paintTopics();
  }
  function paintTopics() {
    var chosen = topicsChosen(), slots = $('tp-slots'), i;
    slots.innerHTML = '';
    for (i = 0; i < NEWS_SLOTS; i++) {
      var s = el('div', 'tslot', slots);
      el('div', 'k', s, 'Kachel ' + (i + 1));
      el('div', 'v', s, chosen[i]);
      setClass(s, 'on', i === tp.slot);
      setClass(s, 'focus', tp.zone === 'slots' && i === tp.slot);
    }
    setClass($('tp-search'), 'focus', tp.zone === 'search');
    var lb = $('tp-letters');
    lb.innerHTML = '';
    var curL = firstLetter(tp.list[tp.item]);
    for (i = 0; i < LETTERS.length; i++) {
      var L = el('div', 'tl', lb, LETTERS[i]);
      setClass(L, 'on', LETTERS[i] === curL);
      setClass(L, 'focus', tp.zone === 'letters' && i === tp.letter);
    }
    $('tp-count').textContent = tp.list.length + ' Themen';
    var grid = $('tp-grid'), rows = Math.ceil(tp.list.length / TP_COLS), r = Math.floor(tp.item / TP_COLS);
    if (r < tp.scroll) tp.scroll = r;
    if (r > tp.scroll + TP_VIS - 2) tp.scroll = r - TP_VIS + 2;
    tp.scroll = Math.max(0, Math.min(tp.scroll, Math.max(0, rows - TP_VIS)));
    grid.innerHTML = '';
    for (i = tp.scroll * TP_COLS; i < Math.min(tp.list.length, (tp.scroll + TP_VIS) * TP_COLS); i++) {
      var c = el('div', 'tchip', grid, tp.list[i]);
      c.style.left = (i % TP_COLS) * 330 + 'px';
      c.style.top = (Math.floor(i / TP_COLS) - tp.scroll) * TP_RH + 'px';
      setClass(c, 'on', chosen.indexOf(tp.list[i]) >= 0);
      setClass(c, 'focus', tp.zone === 'grid' && i === tp.item);
    }
  }
  function setTopic(t) {
    var chosen = topicsChosen();
    chosen[tp.slot] = t;
    store('newsTopics', chosen);
    loadTopic(t);
    changed();
  }
  function tpLetter(dir) {
    var n = tp.list.length, cur = (tp.list[tp.item] || '#').charAt(0).toUpperCase(), i = tp.item;
    if (dir > 0) { while (i < n && tp.list[i].charAt(0).toUpperCase() === cur) i++; tp.item = Math.min(n - 1, i); }
    else { while (i > 0 && tp.list[i - 1].charAt(0).toUpperCase() === cur) i--; if (i === tp.item && i > 0) { i--; var p = tp.list[i].charAt(0).toUpperCase(); while (i > 0 && tp.list[i - 1].charAt(0).toUpperCase() === p) i--; } tp.item = i; }
  }
  function tpFilter() {
    var q = ($('tp-q').value || '').toLowerCase();
    tp.list = q ? TOPICS.filter(function (t) { return t.toLowerCase().indexOf(q) >= 0; }) : TOPICS;
    tp.item = 0; tp.scroll = 0;
  }
  function topicsKey(k, K) {
    var f = $('tp-q'), n = tp.list.length;
    if (document.activeElement === f) {
      if (k === K.ok || k === 65376) {
        f.blur(); tpFilter();
        if (!tp.list.length && f.value) { setTopic(f.value.replace(/^\s+|\s+$/g, '')); tp.zone = 'slots'; }
        else tp.zone = 'grid';
        paintTopics(); return true;
      }
      if (k === K.back || k === 27 || k === 65385 || k === K.up || k === K.down) { f.blur(); tpFilter(); tp.zone = k === K.down && tp.list.length ? 'grid' : 'search'; paintTopics(); return true; }
      setTimeout(function () { tpFilter(); paintTopics(); }, 0);
      return 'type';
    }
    if (k === K.back) { if (tp.zone !== 'slots') tp.zone = 'slots'; else { ui.open = null; setClass($('topics'), 'open', false); if (ui.onClose) ui.onClose(); return true; } }
    else if (tp.zone === 'slots') {
      if (k === K.up) tp.slot = Math.max(0, tp.slot - 1);
      else if (k === K.down) tp.slot = Math.min(NEWS_SLOTS - 1, tp.slot + 1);
      else if (k === K.right || k === K.ok) { tp.zone = 'grid'; var at = tp.list.indexOf(topicsChosen()[tp.slot]); if (at >= 0) tp.item = at; }
    } else if (tp.zone === 'letters') {
      if (k === K.left) { if (tp.letter > 0) tp.letter--; else tp.zone = 'slots'; }
      else if (k === K.right) tp.letter = Math.min(LETTERS.length - 1, tp.letter + 1);
      else if (k === K.down) tp.zone = 'search';
      else if (k === K.ok) {
        for (var j = 0; j < tp.list.length; j++) if (firstLetter(tp.list[j]) === LETTERS[tp.letter]) { tp.item = j; tp.zone = 'grid'; break; }
      }
    } else if (tp.zone === 'search') {
      if (k === K.ok) { f.focus(); return true; }
      if (k === K.down && n) tp.zone = 'grid';
      else if (k === K.up) { tp.zone = 'letters'; tp.letter = Math.max(0, LETTERS.indexOf(firstLetter(tp.list[tp.item]))); }
      else if (k === K.left) tp.zone = 'slots';
    } else {
      var col = tp.item % TP_COLS;
      if (k === K.left) { if (col > 0) tp.item--; else tp.zone = 'slots'; }
      else if (k === K.right && col < TP_COLS - 1 && tp.item + 1 < n) tp.item++;
      else if (k === K.down && tp.item + TP_COLS < n) tp.item += TP_COLS;
      else if (k === K.up) { if (tp.item >= TP_COLS) tp.item -= TP_COLS; else tp.zone = 'search'; }
      else if (k === 427) tpLetter(-1);
      else if (k === 428) tpLetter(1);
      else if (k === K.ok && n) { setTopic(tp.list[tp.item]); tp.zone = 'slots'; }
    }
    paintTopics();
    return true;
  }

  // MARK: - Wetterbericht (eigene Ebene): 7 Tage mit allen wichtigen Werten, von Open-Meteo

  var wx = {data: null, at: 0, scroll: 0};
  var DIRS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  function symEl(name, parent, size) {
    var s = el('span', 'sym', parent);
    s.style.webkitMaskImage = s.style.maskImage = 'url(symbols/' + name + '.png)';
    if (size) { s.style.width = size + 'px'; s.style.height = size + 'px'; }
    return s;
  }
  function deg(v) { return window.Data && Data.degrees ? Data.degrees(v) : Math.round(v) + '°'; }
  function r1(v) { return v === null || v === undefined || isNaN(v) ? '–' : (Math.round(v * 10) / 10).toString().replace('.', ','); }

  function openWeather() {
    var s = $('wx');
    if (!s) return false;
    ui.open = 'wx';
    setClass(s, 'open', true);
    wx.scroll = 0;
    paintWeather();
    if (!wx.data || Date.now() - wx.at > 20 * 60000) loadWeather();
    return true;
  }

  function loadWeather() {
    var lat = window.Prefs ? Prefs.latitude() : '', lon = window.Prefs ? Prefs.longitude() : '';
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&timezone=auto&forecast_days=7' +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,pressure_msl,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,visibility,uv_index,weather_code,is_day,precipitation' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,uv_index_max,sunshine_duration,sunrise,sunset' +
      '&hourly=relative_humidity_2m,pressure_msl,dew_point_2m,cloud_cover';
    getText(url, function (err, text) {
      if (err) { $('wx-body').innerHTML = ''; el('div', 'wx-msg', $('wx-body'), 'Wetterdaten konnten nicht geladen werden.'); return; }
      try { wx.data = JSON.parse(text); wx.at = Date.now(); } catch (e) { return; }
      if (ui.open === 'wx') paintWeather();
    }, 15000);
  }

  function dayAvg(list, day) {
    var sum = 0, n = 0;
    for (var i = day * 24; list && i < (day + 1) * 24 && i < list.length; i++) if (list[i] !== null) { sum += list[i]; n++; }
    return n ? sum / n : NaN;
  }

  function v(list, k) { return list ? list[k] : undefined; }
  function rn(x) { x = Math.round(x); return isNaN(x) ? '–' : String(x); }

  function paintWeather() {
    var body = $('wx-body');
    body.innerHTML = '';
    var d = wx.data;
    if (!d) { el('div', 'wx-msg', body, 'Wetterbericht wird geladen …'); return; }
    var c = d.current || {}, dy = d.daily || {}, h = d.hourly || {};
    var now = el('div', 'wx-now', body);
    symEl(Data.symbol(c.weather_code, c.is_day), now, 120);
    var big = el('div', 'wx-big', now);
    el('div', 't', big, deg(c.temperature_2m));
    el('div', 'c', big, Data.condition(c.weather_code, c.is_day) + (Data.city ? '  ·  ' + Data.city : ''));
    var facts = el('div', 'wx-facts', now);
    var list = [
      ['Gefühlt', deg(c.apparent_temperature)], ['Luftfeuchte', rn(c.relative_humidity_2m) + ' %'],
      ['Taupunkt', deg(c.dew_point_2m)], ['Luftdruck', rn(c.pressure_msl) + ' hPa'],
      ['Wind', rn(c.wind_speed_10m) + ' km/h ' + DIRS[Math.round((c.wind_direction_10m || 0) / 45) % 8]],
      ['Böen', rn(c.wind_gusts_10m) + ' km/h'], ['Bewölkung', rn(c.cloud_cover) + ' %'],
      ['Sicht', c.visibility ? r1(c.visibility / 1000) + ' km' : '–'], ['UV-Index', r1(c.uv_index)], ['Niederschlag', r1(c.precipitation) + ' mm']
    ];
    for (var i = 0; i < list.length; i++) { var f = el('div', 'f', facts); el('span', 'l', f, list[i][0]); el('span', 'v', f, list[i][1]); }
    var days = el('div', 'wx-days', body);
    var names = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    for (var k = 0; dy.time && k < dy.time.length; k++) {
      var col = el('div', 'wx-day', days), date = new Date(v(dy.time, k) + 'T12:00');
      el('div', 'n', col, k === 0 ? 'Heute' : names[date.getDay()] + ' ' + date.getDate() + '.' + (date.getMonth() + 1) + '.');
      symEl(Data.symbol(v(dy.weather_code, k), true), col, 64);
      el('div', 'mx', col, deg(v(dy.temperature_2m_max, k)) + ' / ' + deg(v(dy.temperature_2m_min, k)));
      var rows = [
        ['gefühlt', deg(v(dy.apparent_temperature_max, k)) + ' / ' + deg(v(dy.apparent_temperature_min, k))],
        ['Regen', r1(v(dy.precipitation_sum, k)) + ' mm · ' + (v(dy.precipitation_probability_max, k) == null ? '–' : v(dy.precipitation_probability_max, k) + ' %')],
        ['Wind', rn(v(dy.wind_speed_10m_max, k)) + ' km/h ' + DIRS[Math.round((v(dy.wind_direction_10m_dominant, k) || 0) / 45) % 8]],
        ['Böen', rn(v(dy.wind_gusts_10m_max, k)) + ' km/h'],
        ['UV', r1(v(dy.uv_index_max, k))],
        ['Sonne', r1((v(dy.sunshine_duration, k) || 0) / 3600) + ' h'],
        ['Feuchte', rn(dayAvg(h.relative_humidity_2m, k)) + ' %'],
        ['Druck', rn(dayAvg(h.pressure_msl, k)) + ' hPa'],
        ['Wolken', rn(dayAvg(h.cloud_cover, k)) + ' %'],
        ['Auf / Unter', String(v(dy.sunrise, k) || '').slice(11, 16) + ' / ' + String(v(dy.sunset, k) || '').slice(11, 16)]
      ];
      for (var r = 0; r < rows.length; r++) { var line = el('div', 'r', col); el('span', 'l', line, rows[r][0]); el('span', 'v', line, rows[r][1]); }
    }
    el('div', 'wx-src', body, 'Daten: Open-Meteo.com  ·  Zurück: schließen');
  }

  function weatherKey(k, K) {
    if (k === K.back) { ui.open = null; setClass($('wx'), 'open', false); if (ui.onClose) ui.onClose(); return; }
    if (k === K.ok) loadWeather();
  }

  // MARK: - Werbung & Tracking: Selbsttest und Anleitung (eigene Ebene)

  // Eine App kann Samsungs Systemwerbung, Tracking und Zustimmungs-Abfragen nicht abschalten, sie kommen aus der
  // Firmware. Was hilft: die Schalter am TV und ein DNS-Filter mit blocklist/ im Heimnetz. Diese Ebene prueft, ob der
  // Filter greift, und erklaert beides.
  var PROBES = [
    {host: 'ads.samsungads.com', what: 'Werbung im Samsung-Menü', tier: 1},
    {host: 'log-ingestion-eu.samsungacr.com', what: 'Zuschauer-Tracking (ACR)', tier: 1},
    {host: 'ad.samsungadhub.com', what: 'Werbe-Netzwerk', tier: 1},
    {host: 'notice.samsungcloudsolution.com', what: 'Hinweise und Zustimmungs-Abfragen', tier: 2}
  ];
  var CONTROL = 'www.samsung.com';   // nicht gesperrt: zeigt, ob der TV fremde Server ueberhaupt abfragen darf

  var PRIVACY_TEXT = [
    ['h', '1  Am Fernseher ausschalten (einmalig, etwa 2 Minuten)'],
    ['p', 'Einstellungen → Schild-Symbol ganz unten → AGBs & Datenschutz (2018–2020). Neuere Geräte: Allgemein & Datenschutz → Nutzungsbedingungen und Datenschutz. Dort jeweils die Zustimmung zurücknehmen:'],
    ['li', '„Ich stimme den Anzeigeinformationsdiensten …“: ACR, erkennt, was läuft, auch über Sat und HDMI'],
    ['li', '„Ich stimme Werbung auf Grundlage meiner Interessen zu“: personalisierte Werbung'],
    ['li', '„Ich stimme den Spracherkennungsdiensten …“: Bixby und die Mikrofon-Taste gehen dann nicht mehr, Free My TV+ braucht beides nicht'],
    ['li', '„Bedingungen für den Remote-Service“ und „PSID zurücksetzen“. Geschäftsbedingungen und Smart-Hub-Datenschutzhinweis stehen lassen, sonst laufen keine Apps mehr.'],
    ['li', 'Marketing- und Werbe-Benachrichtigungen, falls vorhanden: aus'],
    ['p', 'Einstellungen → Allgemein → Smart-Funktionen: „Autom. Ausführung Smart Hub“ aus, „Autom. Ausführung der letzten App“ an. Dann startet der TV in Free My TV+ statt in der Samsung-Leiste mit Werbung.'],
    ['li', 'HbbTV aus (Einstellungen → Übertragung → Experteneinstellungen → HbbTV-Einstellungen): entfernt Werbe-Einblendungen der Sat-Sender über den roten Knopf. Die Mediathek über den roten Knopf geht dann auch nicht mehr.'],
    ['h', '2  Werbung und Zustimmungs-Abfragen endgültig sperren: DNS-Filter'],
    ['p', 'Der Fernseher fragt Werbung, Tracking und die Abfrage zur personalisierten Werbung bei Samsung-Servern ab. Ein DNS-Filter im Heimnetz beantwortet diese Namen nicht mehr: Die Werbung bleibt leer, und die Abfrage kann nicht mehr geladen werden.'],
    ['li', 'Am einfachsten, ohne Zusatzgerät (auch mit Vodafone Station, Speedport & Co.): AdGuard DNS am TV eintragen. Einstellungen → Allgemein → Netzwerk → Netzwerkstatus → IP-Einstellungen: IP-Einstellung bleibt „Automatisch“, DNS-Einstellung „Manuell eingeben“, DNS-Server 94.140.14.14 (Ausweich: 94.140.15.15). Kostenlos, ohne Konto. Sperrt Werbung und Tracking nach AdGuards eigener Liste; AdGuard sieht dafür, welche Namen der TV abfragt.'],
    ['li', 'Zeigt der Test danach noch „erreichbar“: IPv6 am TV ausschalten (Netzwerk → Experteneinstellungen → IPv6), sonst fragt der TV am Filter vorbei über den Router. Dann neu prüfen (OK).'],
    ['li', 'Pi-hole oder AdGuard Home (Raspberry Pi, NAS oder ein Rechner, der immer läuft): die Liste aus dem Ordner blocklist/ dieses Projekts als Sperrliste eintragen, dann am TV unter Einstellungen → Allgemein → Netzwerk → Netzwerkstatus → IP-Einstellungen → DNS-Einstellung „Manuell eingeben“ die IP vom Pi-hole eintragen.'],
    ['li', 'FRITZ!Box ohne Zusatzgerät: Internet → Filter → Listen → „Gesperrte Internetseiten“ bearbeiten, die Namen aus samsung-standard.txt eintragen, dann unter Zugangsprofile ein Profil „Fernseher“ mit dieser Liste anlegen und dem TV zuweisen.'],
    ['li', 'Volle Kontrolle mit beiden Stufen: Pi-hole (z. B. auf einem Raspberry Pi) oder ein DNS-Dienst mit eigener Sperrliste (NextDNS, AdGuard DNS mit Konto). Nur damit verschwinden sicher auch die Zustimmungs-Abfragen (Stufe 2).'],
    ['p', 'Stufe 1, samsung-standard.txt (empfohlen): Werbung, ACR, Nutzungsdaten. Smart Hub, App-Store, Netflix & Co. laufen weiter.'],
    ['p', 'Stufe 2, samsung-streng.txt (zusätzlich): Hinweise, Nutzungsbedingungen und Zustimmungs-Abfragen, Promo-Dienste. Kann Smart-Hub-Funktionen, das Samsung-Konto oder den App-Store stören. Wenn etwas klemmt: Stufe 2 wieder entfernen.'],
    ['p', 'Absichtlich nie gesperrt: Firmware- und Sicherheitsupdates (samsungotn.net).'],
    ['h', '3  Was keine App kann'],
    ['li', 'Samsungs vorinstallierte System-Apps lassen sich ohne Root nicht löschen. Free My TV+ blendet sie in seiner Leiste und unter Alle Apps aus (Einstellungen: „Samsung-Werbe-Apps ausblenden“).'],
    ['li', 'Was der Fernseher schon zugestimmt hat, bleibt beim Samsung-Konto gespeichert. Zurücknehmen geht nur über die Schalter oben.'],
    ['li', 'Werbung in Apps (Samsung TV Plus, Joyn, RTL+ …) kommt aus der App selbst; ein DNS-Filter erwischt sie nur teilweise. YouTube ohne Werbung: über TizenTube.']
  ];

  var priv = {scroll: 0, max: 0, results: []};

  function probe(host, done) {
    var x = new XMLHttpRequest(), t0 = Date.now(), over = false;
    function end(status) { if (!over) { over = true; done(status, Date.now() - t0); } }
    try {
      x.open('GET', 'https://' + host + '/?fmtv=' + t0, true);
      x.timeout = 6000;
      x.onreadystatechange = function () { if (x.readyState === 4) end(x.status); };
      x.ontimeout = function () { end(-1); };
      x.send();
    } catch (e) { end(0); }
  }

  function openPrivacy() {
    var s = $('privacy');
    if (!s) return false;
    ui.open = 'privacy';
    setClass(s, 'open', true);
    var body = $('privacy-body');
    body.innerHTML = '';
    var box = el('div', 'status', body);
    el('div', 'st-title', box, 'Selbsttest: Sperrt dein Netzwerk Samsungs Werbe-Server?');
    priv.results = [];
    for (var i = 0; i < PROBES.length; i++) {
      var row = el('div', 'st-row', box);
      el('span', 'dot', row);
      el('span', 'what', row, PROBES[i].what + (PROBES[i].tier === 2 ? '  (Stufe 2)' : ''));
      priv.results.push(el('span', 'res', row, 'wird geprüft …'));
    }
    priv.summary = el('div', 'st-sum', box, '');
    for (var k = 0; k < PRIVACY_TEXT.length; k++) {
      var t = PRIVACY_TEXT[k];
      el(t[0] === 'h' ? 'h3' : 'div', t[0] === 'li' ? 'li' : t[0] === 'p' ? 'p' : '', body, t[1]);
    }
    priv.scroll = 0;
    paintPrivacy();
    runProbes();
    return true;
  }

  function runProbes() {
    var rows = $('privacy-body').querySelectorAll('.st-row');
    for (var i = 0; i < rows.length; i++) { rows[i].className = 'st-row'; priv.results[i].textContent = 'wird geprüft …'; }
    priv.summary.textContent = '';
    probe(CONTROL, function (control) {
      var canTest = control > 0, blocked = 0, strict = 0, left = PROBES.length;
      for (var j = 0; j < PROBES.length; j++) {
        (function (j) {
          probe(PROBES[j].host, function (status) {
            var isBlocked = status <= 0;
            if (!canTest) { rows[j].className = 'st-row unknown'; priv.results[j].textContent = 'nicht prüfbar'; }
            else {
              rows[j].className = 'st-row ' + (isBlocked ? 'ok' : 'bad');
              priv.results[j].textContent = isBlocked ? 'gesperrt' : 'erreichbar';
              if (isBlocked) { blocked++; if (PROBES[j].tier === 2) strict++; }
            }
            if (--left) return;
            priv.summary.textContent = !canTest ?
              'Hier lässt sich nicht prüfen (kein Internet oder der Browser blockt die Abfrage). Am Fernseher funktioniert der Test.' :
              blocked === PROBES.length ? 'Alles gesperrt. Werbung, Tracking und Zustimmungs-Abfragen erreichen den Fernseher nicht mehr.' :
              blocked - strict === PROBES.length - 1 && !strict ? 'Werbung und Tracking sind gesperrt. Die Zustimmungs-Abfragen kommen noch durch: Dafür braucht es Stufe 2, also Pi-hole oder einen DNS-Dienst mit eigener Liste.' :
              blocked ? 'Teilweise gesperrt. Prüf, ob die ganze Liste im DNS-Filter steht und der TV den Filter als DNS nutzt.' :
              'Noch nichts gesperrt. Trag AdGuard DNS oder einen anderen Filter aus Schritt 2 ein, dann OK für einen neuen Test.';
          });
        })(j);
      }
    });
  }

  function paintPrivacy() {
    var view = $('privacy-view'), body = $('privacy-body');
    priv.max = Math.max(0, body.offsetHeight - view.offsetHeight + 40);
    priv.scroll = Math.max(0, Math.min(priv.max, priv.scroll));
    body.style.webkitTransform = body.style.transform = 'translateY(' + (-priv.scroll) + 'px)';
  }

  function closePrivacy() {
    ui.open = null;
    setClass($('privacy'), 'open', false);
    if (ui.onClose) ui.onClose();
  }

  function privacyKey(k, K) {
    if (k === K.back) { closePrivacy(); return; }
    if (k === K.up) priv.scroll -= 160;
    else if (k === K.down) priv.scroll += 160;
    else if (k === K.ok) runProbes();
    paintPrivacy();
  }

  /** Speicher fuer "Ueber diesen TV": frei/gesamt vom TV und was die Seite selbst an JS-Speicher belegt. */
  function memory() {
    var out = {system: '', app: ''};
    try {
      var si = window.tizen && window.tizen.systeminfo;
      var total = si.getTotalMemory(), free = si.getAvailableMemory();
      if (total) out.system = Math.round(free / 1048576) + ' MB frei von ' + Math.round(total / 1048576) + ' MB';
    } catch (e) {}
    try {
      var m = window.performance && window.performance.memory;
      if (m && m.usedJSHeapSize) out.app = (m.usedJSHeapSize / 1048576).toFixed(1) + ' MB JavaScript';
    } catch (e) {}
    return out;
  }

  // Holz fuer die App-Leiste: warm, alt, rustikal, einmal gezeichnet (Canvas), als Bild-URL
  var woodUrl = '';
  function wood() {
    if (woodUrl) return woodUrl;
    try {
      var W = 1760, H = 220, c = document.createElement('canvas');
      c.width = W; c.height = H;
      var g = c.getContext('2d');
      var planks = 4, ph = H / planks;
      for (var p = 0; p < planks; p++) {
        var base = [120 + p * 9 % 30, 74 + p * 7 % 18, 42 + p * 5 % 12];
        g.fillStyle = 'rgb(' + base.join(',') + ')';
        g.fillRect(0, p * ph, W, ph);
        // Maserung: viele feine, leicht gewellte Linien
        for (var l = 0; l < 70; l++) {
          var y0 = p * ph + Math.random() * ph, amp = 1 + Math.random() * 3.5, freq = 0.003 + Math.random() * 0.01, ph0 = Math.random() * 6;
          var dark = Math.random() < 0.6;
          g.strokeStyle = dark ? 'rgba(52, 28, 12, ' + (0.08 + Math.random() * 0.22) + ')' : 'rgba(255, 214, 160, ' + (0.04 + Math.random() * 0.1) + ')';
          g.lineWidth = 0.6 + Math.random() * 1.8;
          g.beginPath();
          for (var x = 0; x <= W; x += 16) { var yy = y0 + Math.sin(x * freq + ph0) * amp; if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy); }
          g.stroke();
        }
        // Aeste
        for (var k = 0; k < 2; k++) {
          var kx = Math.random() * W, ky = p * ph + ph * (0.3 + Math.random() * 0.4), kr = 6 + Math.random() * 10;
          var rg = g.createRadialGradient(kx, ky, 1, kx, ky, kr * 2.4);
          rg.addColorStop(0, 'rgba(40, 20, 8, 0.85)'); rg.addColorStop(0.45, 'rgba(70, 38, 16, 0.5)'); rg.addColorStop(1, 'rgba(70, 38, 16, 0)');
          g.fillStyle = rg; g.beginPath(); g.ellipse ? g.ellipse(kx, ky, kr * 2.6, kr, 0, 0, Math.PI * 2) : g.arc(kx, ky, kr * 2, 0, Math.PI * 2); g.fill();
        }
        // Fuge zwischen den Brettern und Kanten
        g.fillStyle = 'rgba(30, 14, 4, 0.75)'; g.fillRect(0, p * ph, W, 2.5);
        g.fillStyle = 'rgba(255, 220, 170, 0.12)'; g.fillRect(0, p * ph + 3, W, 1.5);
      }
      // Gebrauchsspuren und warmer Schimmer
      for (var s2 = 0; s2 < 900; s2++) { g.fillStyle = 'rgba(30, 15, 5, ' + Math.random() * 0.12 + ')'; g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 3, 1); }
      var vg = g.createLinearGradient(0, 0, 0, H);
      vg.addColorStop(0, 'rgba(255, 190, 120, 0.14)'); vg.addColorStop(0.5, 'rgba(0, 0, 0, 0)'); vg.addColorStop(1, 'rgba(20, 8, 0, 0.3)');
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
      woodUrl = c.toDataURL('image/jpeg', 0.86);
    } catch (e) { woodUrl = ''; }
    return woodUrl;
  }

  var legendHook = null;
  function legendChanged() { if (legendHook) try { legendHook(); } catch (e) {} }
  function legendText() {
    if (ui.open === 'wtv') {
      return ui.zone === 'side' ? '▲ ▼ wählen  ·  OK öffnen/aufklappen  ·  ► Sender  ·  Zurück' + (ui.over ? ' zum Bild' : '') :
        ui.zone === 'grid' ? 'OK ansehen  ·  ◄ ► ▲ ▼ wählen  ·  P+/P− blättern  ·  ► am Rand: Buchstaben  ·  Zurück' :
        ui.zone === 'bar' ? '▲ ▼ Buchstabe  ·  ◄ zurück ins Raster' : ui.zone === 'filter' ? '◄ ► Land  ·  OK filtern  ·  ▼ Sender' :
        ui.zone === 'search' ? 'OK tippen  ·  ▼ Ergebnisse  ·  ◄ Kategorien' : 'OK schließen  ·  ▼ Suche';
    }
    if (ui.open === 'player') return 'OK oder ◄ ► Menü über dem Bild  ·  ▲ ▼ / P+/P− Sender  ·  Rot: ' + (Recorder.busy() ? 'Aufnahme beenden' : 'aufnehmen') + '  ·  Zurück';
    if (ui.open === 'tvlist') return tvl.info ? '▲ ▼ blättern  ·  ◄ zurück zur Liste' : '▲ ▼ Sender  ·  OK umschalten  ·  ► / Info Details  ·  P+/P−  ·  Zurück';
    if (ui.open === 'light') return lt.dev ? '▲ ▼ wählen  ·  ◄ ► ändern  ·  OK schalten / anwenden  ·  Zurück: Geräte' : '▲ ▼ wählen  ·  OK öffnen  ·  Zurück';
    if (ui.open === 'guide') return sweep ? 'Zurück: Suchlauf abbrechen' : gd.detail ? '▲ ▼ blättern  ·  OK oder Zurück: schließen' :
      gd.menu >= 0 ? '◄ ► wählen  ·  OK  ·  Zurück' : '▲ ▼ Sender  ·  P+/P− Seite  ·  ◄ ► Zeit  ·  OK Menü  ·  Info  ·  Rot: EPG-Suchlauf  ·  Zurück';
    if (ui.open === 'topics') return tp.zone === 'letters' ? '◄ ► Buchstabe  ·  OK springen  ·  ▼ Themen' : tp.zone === 'slots' ? '▲ ▼ Kachel  ·  ► Thema wählen  ·  Zurück: fertig' : 'OK übernehmen  ·  ◄ ► ▲ ▼  ·  P+/P− Buchstaben  ·  ▲ ganz oben: A–Z';
    if (ui.open === 'wx') return 'OK aktualisieren  ·  Zurück';
    if (ui.open === 'privacy') return '▲ ▼ blättern  ·  OK neu prüfen  ·  Zurück';
    if (ui.open === 'media') return mediaLegend();
    return '';
  }

  /** Startet den Hintergrund-Dienst, der Free My TV+ nach anderen Apps zurueckholt (oder schaltet ihn aus). */
  // 1.4: dazu sagt die Startseite dem Dienst, ob sie vorne ist. Wird sie vorne beendet (Speicher voll, Absturz), holt er sie zurueck.
  function backHome(on, front) {
    if (!samsung || !window.tizen.ApplicationControl) return;
    try {
      var d = [new window.tizen.ApplicationControlData('enabled', [on ? '1' : '0']),
        new window.tizen.ApplicationControlData('ui', [front === false ? 'back' : 'front'])];
      var ac = new window.tizen.ApplicationControl('http://tizen.org/appcontrol/operation/service', null, null, null, d);
      window.tizen.application.launchAppControl(ac, 'FMTVplusDL.Rueckkehr', function () {}, function () {});
    } catch (e) {}
  }

  // Samsung-Werbe- und Promo-Apps, die Free My TV+ in Leiste und Alle Apps ausblendet (nur ausgeblendet, nicht geloescht).
  var PROMO = /samsung health|samsung promotion|^promotion$|universal guide|art store|samsung daily|gaming hub|global goals|samsung kids|samsung tv-?shop|^e-?shop$|samsung shop/i;
  function isPromo(app) { return PROMO.test(app.title || '') || /samsunghealth|promotion|universalguide/i.test(app.id || ''); }

  /** Tasten fuer die eigenen Ebenen; true = erledigt (home.js macht dann nichts mehr). */
  function key(k, K) {
    auto.idleAt = Date.now();
    var r = keyInner(k, K);
    legendChanged();
    return r;
  }
  function keyInner(k, K) {
    if (!ui.open && (k === 427 || k === 428) && sat.list.length) { zap(k === 427 ? 1 : -1); return true; }
    if (!ui.open) return false;
    if (k === 27 || k === 8) k = K.back;   // Esc/Backspace in der Vorschau
    if (ui.open === 'player') playerKey(k, K);
    else if (ui.open === 'wtv') return worldKey(k, K);
    else if (ui.open === 'tvlist') channelsKey(k, K);
    else if (ui.open === 'privacy') privacyKey(k, K);
    else if (ui.open === 'wx') weatherKey(k, K);
    else if (ui.open === 'topics') return topicsKey(k, K);
    else if (ui.open === 'guide') guideKey(k, K);
    else if (ui.open === 'light') return lightKey(k, K);
    else if (ui.open === 'media') return mediaKey(k, K);
    return true;
  }

  // MARK: - Foto-Streifen oben: Wetter und Tageszeit

  // Freie Fotos von Pexels (Pexels-Lizenz: kostenlos, ohne Namensnennung). Je Lage mehrere, das erste ladbare gewinnt.
  var PEXELS = {
    sunrise: [4130414, 7208],
    day: [629161, 1526713, 518485],
    partly: [949119, 949417],
    overcast: [1450082, 31469974, 4344780],
    rain: [4344775, 4344780],
    storm: [2531709, 1114690],
    snow: [790545, 104672, 5614589],
    fog: [157304, 2929248, 17965189],
    sunset: [1126382, 276388, 7208],
    dusk: [7677713, 18823804, 1126382],
    night: [114251, 66387, 1421903],
    nightcloud: [1921690, 1685543, 15141404],
    nightsnow: [2605867, 114251]
  };
  var LABEL = {sunrise: 'Sonnenaufgang', day: 'Sonnig', partly: 'Heiter bis wolkig', overcast: 'Bedeckt', rain: 'Regen',
    storm: 'Gewitter', snow: 'Schnee', fog: 'Nebel', sunset: 'Sonnenuntergang', dusk: 'Blaue Stunde', night: 'Sternenklare Nacht',
    nightcloud: 'Bewölkte Nacht', nightsnow: 'Winternacht'};

  function pexels(id) {
    return 'https://images.pexels.com/photos/' + id + '/pexels-photo-' + id + '.jpeg?auto=compress&cs=tinysrgb&w=1920';
  }

  /** Welche Lage gerade passt: aus Wettercode, Sonnenauf- und -untergang. */
  function mood(w, at) {
    at = at || Date.now();
    var code = w ? w.code : 0;
    var rise = w && w.sunrise, set = w && w.sunset;
    if (!rise || !set) { var d = new Date(at); rise = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 7).getTime(); set = rise + 11 * 3600000; }
    // sunrise/sunset sind die von heute; fuer den Vergleich reicht die Uhrzeit
    var day = 86400000, t = ((at - rise) % day + day) % day, len = ((set - rise) % day + day) % day;
    var minutesFromRise = t / 60000, minutesToSet = (len - t) / 60000;
    var isDay = t < len;
    var wx = code >= 95 ? 'storm' : (code >= 71 && code <= 77) || code === 85 || code === 86 ? 'snow'
      : (code >= 51 && code <= 67) || (code >= 80 && code <= 82) ? 'rain' : code === 45 || code === 48 ? 'fog'
      : code === 3 ? 'overcast' : code === 2 ? 'partly' : 'clear';
    if (!isDay) {
      var afterSet = (t - len) / 60000, beforeRise = (day - t) / 60000;
      if ((afterSet < 45 || beforeRise < 35) && (wx === 'clear' || wx === 'partly')) return 'dusk';
      if (wx === 'snow') return 'nightsnow';
      if (wx === 'storm') return 'storm';
      return wx === 'clear' ? 'night' : 'nightcloud';
    }
    if (wx === 'clear' || wx === 'partly') {
      if (minutesFromRise < 60) return 'sunrise';
      if (minutesToSet < 70) return 'sunset';
      return wx === 'clear' ? 'day' : 'partly';
    }
    return wx;
  }

  // Selbst ausgewaehlte Stimmungsbilder (Einstellungen: Hintergrundbild). mood: die passende Farbstimmung des Rahmens.
  var SCENES = {
    kamin: {label: 'Kaminfeuer', ids: [30629321, 30312507], mood: 'sunset'},
    strand: {label: 'Strand', ids: [16652213, 36216421], mood: 'day'},
    wolken: {label: 'Über den Wolken', ids: [38351374, 29442877], mood: 'day'},
    wolkenabend: {label: 'Wolken im Abendrot', ids: [29442877, 38351374], mood: 'sunset'},
    polarlicht: {label: 'Polarlichter', ids: [1663376, 30173395], mood: 'night'},
    sterne: {label: 'Sternenhimmel', ids: [40474457, 28445520], mood: 'night'},
    berge: {label: 'Berge im Schnee', ids: [30588906, 34530093], mood: 'snow'},
    alm: {label: 'Almwiese', ids: [29999861, 30588906], mood: 'partly'},
    bergsee: {label: 'Bergsee', ids: [34169870, 32801668], mood: 'partly'},
    wald: {label: 'Wald im Licht', ids: [33671598, 31035343], mood: 'fog'},
    herbst: {label: 'Herbstwald', ids: [34545331, 29007150], mood: 'sunrise'},
    winter: {label: 'Winterwald', ids: [19942478, 14722065], mood: 'snow'},
    wueste: {label: 'Wüste', ids: [16830227, 39242465], mood: 'sunrise'},
    lavendel: {label: 'Lavendelfeld', ids: [38299853, 12645409], mood: 'sunset'},
    meer: {label: 'Unter Wasser', ids: [17693485, 13211929], mood: 'rain'},
    leuchtturm: {label: 'Leuchtturm am Meer', ids: [37514714, 29322189], mood: 'sunset'},
    stadt: {label: 'Stadt bei Nacht', ids: [38720292, 1660603], mood: 'night'}
  };
  function sceneKey() { try { var s = window.Prefs && Prefs.scene ? Prefs.scene() : 'auto'; return SCENES[s] ? s : ''; } catch (e) { return ''; } }

  var bandMood = '', bandTried = {}, bandUrl = '';

  /** Das Foto des Streifens auch hinter allen Menues (Einstellungen, Alle Apps, Welt-TV ...), abgedunkelt. */
  function paintSheets(url) {
    var list = document.querySelectorAll('.sheet');
    for (var i = 0; i < list.length; i++) {
      var st = list[i].style;
      st.backgroundImage = '-webkit-linear-gradient(top, rgba(6, 8, 14, 0.72), rgba(6, 8, 14, 0.9)), url("' + url + '")';
      st.backgroundImage = 'linear-gradient(rgba(6, 8, 14, 0.72), rgba(6, 8, 14, 0.9)), url("' + url + '")';
      st.backgroundSize = 'cover';
      st.backgroundPosition = 'center';
    }
  }

  /** Setzt das passende Foto in den Streifen (#band). Ohne Internet oder Foto: die gezeichnete Szene. */
  function band(w) {
    var box = $('band');
    if (!box) return;
    var sc = sceneKey(), m = sc ? 'scene:' + sc : mood(w);
    var label = $('band-mood');
    if (label) label.textContent = sc ? SCENES[sc].label : LABEL[m] || '';
    if (m === bandMood) return;
    bandMood = m;
    var ids = sc ? SCENES[sc].ids : PEXELS[m] || PEXELS.day, i = 0;
    var photo = $('band-photo'), next = $('band-next');
    function tryNext() {
      if (bandMood !== m) return;
      if (i >= ids.length) { drawn(); return; }
      var url = pexels(ids[i++]);
      if (bandTried[url] === false) { tryNext(); return; }
      var img = new Image();
      img.onload = function () { bandTried[url] = true; if (bandMood === m) swap(url); };
      img.onerror = function () { bandTried[url] = false; tryNext(); };
      img.src = url;
    }
    function drawn() {
      if (!window.HomeScene) return;
      try {
        var o = {date: new Date(), code: w ? w.code : 0, sunrise: w && w.sunrise, sunset: w && w.sunset};
        swap(window.HomeScene.render(o).url);
      } catch (e) {}
    }
    function swap(url) {
      bandUrl = url;
      paintSheets(url);
      next.style.backgroundImage = 'url("' + url + '")';
      setClass(next, 'on', true);
      setClass(photo, 'on', false);
      next.id = 'band-photo';
      photo.id = 'band-next';
    }
    tryNext();
  }

  // MARK: - Karten fuer die drei Tabs

  /**
   * Die drei Karten des Tabs: {id, title, meta, image, logo, text, live, run}.
   * tab 0: Jetzt im TV, 1: Welt-TV, 2: News.
   */
  function cards(tab, hooks) {
    var out = [];
    if (tab !== 1) stopPreview();
    if (tab === 0) {
      guideHooks = hooks;
      if (sat.ok && sat.channel) {
        var now = sat.now, left = now && now.end ? Math.max(0, Math.round((now.end - Date.now()) / 60000)) : 0;
        out.push({id: 'live', live: true, title: channelName(sat.channel) + (now ? '  ·  ' + now.title : ''),
          meta: now && now.start ? 'Jetzt ' + hm(now.start) + (now.end ? '–' + hm(now.end) + '  ·  noch ' + left + ' Min.' : '') : 'Live',
          rect: [80, 270, 920, 500], run: hooks.fullTV});
        var nx = sat.next, pic = nx ? picture(nx.title) : '';
        out.push({id: 'next' + (pic ? 'p' : ''), text: nx ? nx.title : 'Kein EPG vom Sender', kicker: (nx && nx.start ? 'Danach ' + hm(nx.start) : 'Danach') + '  ·  ' + channelName(sat.channel),
          title: '', plain: true, inside: true, image: pic, rect: [1053, 257, 374, 370], run: hooks.fullTV});
        out.push({id: 'zap' + (sat.channel ? sat.channel.major + '.' + sat.channel.minor : '') + (zapMode ? 'z' : ''), switcher: true, text: '', kicker: 'Sender umschalten', title: '', plain: true, inside: true,
          rect: [1467, 257, 373, 370], draw: drawSwitcher, key: switcherKey, run: switcherOk});
        out.push({id: 'gsearch', text: 'Suchen: Sender, Sendungen, Apps & Mediatheken', kicker: '', title: '', plain: true, inside: true, flat: true, centered: true,
          icon: 'search', rect: [1053, 667, 787, 116], run: function () { openWorld('search'); }});
      } else {
        out.push({id: 'live', text: 'Fernsehen', kicker: 'Live-TV', title: 'Live-TV', meta: 'Sat / HD+', icon: 'live_tv', run: hooks.fullTV});
        for (var f = 0; f < featured.length && out.length < 3; f++) out.push(worldCard(featured[f], featured, f));
      }
    } else if (tab === 1) {
      // Welt-TV: Tipp (flach) und Suche darunter, "Alle Sender", dann die 10 zuletzt gesehenen
      loadSport();
      if (sportCh && !ui.open) {
        out.push({id: 'sport' + sportCh.url, draw: drawSport, text: '', kicker: '', title: '', plain: true, inside: true, rect: [80, 262, 700, 300],
          run: function () { stopPreview(); play([sportCh], 0, 'Welt-TV'); }});
      } else if (featured[0]) { stopPreview(); var a = worldCard(featured[0], featured, 0); a.rect = [80, 262, 700, 300]; a.inside = true; out.push(a); }
      out.push({id: 'wsearch', text: 'Sender suchen', kicker: 'Welt-TV', title: '', rect: [80, 582, 700, 180], inside: true, plain: true,
        run: function () { openWorld('search'); }});
      out.push({id: 'wtv', text: 'Alle Sender', kicker: 'Kategorien · Länder · Themen', title: '', icon: 'cast', rect: [800, 262, 300, 500], inside: true, plain: true,
        run: function () { openWorld(); }});
      var rec = recent().slice(0, 20), names = {};
      for (var r = 0; r < rec.length; r++) names[rec[r].name] = true;
      for (var t = 0; t < featured.length && rec.length < 20; t++) if (!names[featured[t].name]) rec.push(featured[t]);
      for (var m = 0; m < rec.length; m++) {
        var c = worldCard(rec[m], rec, m);
        c.id = 'r' + m + rec[m].name;
        c.rect = [1120 + (m % 5) * 146, 262 + Math.floor(m / 5) * 128, 132, 116];
        c.inside = true;
        c.mini = true;
        out.push(c);
      }
    } else {
      out = newsCards(hooks);
    }
    return out;
  }

  // Senderkachel: OK schaltet in den Umschalt-Modus, dann wechseln ▲ ▼ sofort den Sender, OK oder Zurueck beendet ihn
  var zapMode = false;
  function drawSwitcher(box) {
    box.innerHTML = '';
    el('div', 'kicker zk', box, 'Sender  ·  OK: Programmführer');
    var at = 0, cur = sat.channel;
    for (var i = 0; i < sat.list.length; i++) if (cur && sat.list[i].major === cur.major && sat.list[i].minor === cur.minor) at = i;
    var rows = el('div', 'zrows', box);
    for (var d = -2; d <= 2; d++) {
      var ch = sat.list[(at + d + sat.list.length) % sat.list.length];
      if (!ch) continue;
      var r = el('div', 'zrow' + (d === 0 ? ' cur' : ''), rows);
      el('span', 'zn', r, String(ch.major));
      el('span', 'zc', r, channelName(ch));
      if (d === 0) {
        var pg = el('div', 'zp', r, '');
        (function (span, c) { nowOn(c, function (pr) { if (pr) span.textContent = pr.title; }); })(pg, ch);
      }
    }
  }
  function switcherOk() { zapMode = false; if (!openGuide()) loadChannels(0); }
  function switcherKey(dx, dy) {
    if (!zapMode) return false;
    if (dy) { zap(dy); return true; }
    if (dx) { zapMode = false; changed(); }
    return false;
  }

  // Bild zur naechsten Sendung: das Vorschaubild ihres Wikipedia-Artikels, wenn es einen gibt
  var wiki = {};
  /** Wikipedia-Zusammenfassung zu einer Sendung: {img, text}, oder null (wird nachgeladen, dann changed()). */
  function wikiFor(title) {
    var t = (title || '').replace(/\s*[-–:(].*$/, '').replace(/^\s+|\s+$/g, '');
    if (!t || t.length < 3) return null;
    if (wiki[t] !== undefined) return wiki[t] || null;
    wiki[t] = false;
    getText('https://de.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(t.replace(/ /g, '_')), function (err, text) {
      if (err) return;
      try {
        var j = JSON.parse(text);
        if (j.type === 'disambiguation') return;
        wiki[t] = {img: j.originalimage ? j.originalimage.source : j.thumbnail ? j.thumbnail.source : '', text: j.extract || '', desc: j.description || '', page: j.title || t};
        changed();
        if (ui.open === 'tvlist') paintInfo();
        if (ui.open === 'guide') guideWiki();
      } catch (e) {}
    }, 8000);
    return null;
  }
  function picture(title) { var w = wikiFor(title); return w && w.img ? w.img : ''; }

  function worldCard(ch, list, i) {
    return {id: 'w' + i + ch.name, logo: ch.logo, title: ch.name, meta: 'Welt-TV' + (ch.quality ? '  ·  ' + ch.quality : ''),
      run: function () { play(list, i, 'Welt-TV'); }};
  }

  // MARK: - Licht: Govee (1.5)
  // Ueber die offizielle Govee-Cloud-API (die LAN-Steuerung braucht UDP, das koennen Samsung-Web-Apps nicht).
  // Der API-Schluessel ist der eigene (Govee-Home-App: Profil, Einstellungen, API-Schluessel beantragen) und bleibt
  // nur auf diesem Fernseher. Die Regler entstehen aus dem, was jedes Geraet selbst meldet.
  var GOVEE = 'https://openapi.api.govee.com/router/api/v1/';
  var COLORS = [['Warmweiß', 0xFFB46B], ['Weiß', 0xFFFFFF], ['Rot', 0xFF0000], ['Orange', 0xFF7A00], ['Gelb', 0xFFD400], ['Grün', 0x00D35A],
    ['Türkis', 0x00D4C8], ['Blau', 0x0050FF], ['Violett', 0x8A2BE2], ['Pink', 0xFF2D95], ['Kino-Blau', 0x1A2A6C], ['Sonnenuntergang', 0xFF5E3A]];
  var INSTANCE = {powerSwitch: 'Ein / Aus', brightness: 'Helligkeit', colorRgb: 'Farbe', colorTemperatureK: 'Weißton (Kelvin)',
    lightScene: 'Szene', diyScene: 'Eigene Szene (DIY)', snapshot: 'Schnappschuss', musicMode: 'Musik-Modus', dreamViewToggle: 'DreamView (TV-Sync)',
    gradientToggle: 'Farbverlauf', segmentedColorRgb: 'Alle Segmente: Farbe', segmentedBrightness: 'Alle Segmente: Helligkeit', nightlightToggle: 'Nachtlicht',
    sceneStageToggle: 'Szenen-Bühne', presetScene: 'Voreinstellung', workMode: 'Arbeitsmodus', oscillationToggle: 'Schwenken', airDeflectorToggle: 'Luftklappe'};
  var lt = {devices: [], dev: null, rows: [], item: 0, busy: false, pending: 0, msg: ''};
  function goveeKey() { return stored('goveeKey') || ''; }
  function govee(path, body, done) {
    var x = new XMLHttpRequest();
    try { x.open(body ? 'POST' : 'GET', GOVEE + path, true); } catch (e) { done(e); return; }
    x.setRequestHeader('Govee-API-Key', goveeKey());
    if (body) x.setRequestHeader('Content-Type', 'application/json');
    x.timeout = 15000;
    x.onload = function () {
      var j = null;
      try { j = JSON.parse(x.responseText); } catch (e) {}
      if (x.status === 429) return done(new Error('Zu viele Befehle, kurz warten'));
      if (x.status === 401 || x.status === 403) return done(new Error('API-Schlüssel ungültig'));
      if (x.status !== 200 || !j) return done(new Error('Govee antwortet nicht (' + x.status + ')'));
      done(null, j);
    };
    x.onerror = x.ontimeout = function () { done(new Error('Govee nicht erreichbar')); };
    x.send(body ? JSON.stringify(body) : null);
  }
  function rid() { return String(Date.now()) + Math.floor(Math.random() * 1000); }
  /** Beim Start der App: das gewaehlte Licht an und, wenn es das kann, TV-Sync (DreamView) an. */
  function lightAuto() {
    var id = stored('goveeAuto'), sku = stored('goveeAutoSku');
    if (!id || !sku || !goveeKey()) return;
    var dev = {sku: sku, device: id};
    send(dev, {type: 'devices.capabilities.on_off', instance: 'powerSwitch'}, 1, function () {
      setTimeout(function () { send(dev, {type: 'devices.capabilities.toggle', instance: 'dreamViewToggle'}, 1); }, 800);
    });
  }
  setTimeout(lightAuto, 4000);

  function openLight() {
    ui.open = 'light';
    setClass($('light'), 'open', true);
    lt.dev = null;
    lightHome();
    legendChanged();
    return true;
  }
  function lightHome() {
    lt.dev = null;
    lt.item = 0;
    lt.rows = [{label: 'Govee-API-Schlüssel:  ' + (goveeKey() ? '••••••••  (OK ändert)' : 'noch nicht eingegeben (OK)'), kind: 'key'}];
    if (!goveeKey()) {
      lt.rows.push({label: 'Den Schlüssel gibt es kostenlos in der Govee-Home-App: Profil → Einstellungen → API-Schlüssel beantragen (kommt per E-Mail).', kind: 'none'});
      paintLight();
      return;
    }
    lt.rows.push({label: 'Geräte werden geladen …', kind: 'none'});
    paintLight();
    govee('user/devices', null, function (err, j) {
      if (ui.open !== 'light' || lt.dev) return;
      lt.rows = lt.rows.slice(0, 1);
      if (err) { lt.rows.push({label: err.message, kind: 'none'}); paintLight(); return; }
      lt.devices = j.data || [];
      if (lt.devices.length > 1) {
        lt.rows.push({label: 'Alle Lichter an', kind: 'all', on: 1});
        lt.rows.push({label: 'Alle Lichter aus', kind: 'all', on: 0});
      }
      for (var i = 0; i < lt.devices.length; i++) lt.rows.push({label: '▸  ' + (lt.devices[i].deviceName || lt.devices[i].sku) + '   ·   ' + lt.devices[i].sku, kind: 'dev', dev: lt.devices[i]});
      if (!lt.devices.length) lt.rows.push({label: 'Keine Geräte im Govee-Konto', kind: 'none'});
      lt.item = Math.min(1, lt.rows.length - 1);
      paintLight();
    });
  }
  function capOf(dev, inst) { for (var i = 0; i < dev.capabilities.length; i++) if (dev.capabilities[i].instance === inst) return dev.capabilities[i]; return null; }

  /** Ein Geraet: aus seinen Faehigkeiten werden die Zeilen. */
  function lightDevice(dev) {
    lt.dev = dev;
    lt.item = 0;
    lt.rows = [];
    var caps = dev.capabilities || [];
    for (var i = 0; i < caps.length; i++) {
      var c = caps[i], t = c.type.replace('devices.capabilities.', ''), p = c.parameters || {}, name = INSTANCE[c.instance] || c.instance;
      if (t === 'on_off' || t === 'toggle') lt.rows.push({label: name, kind: 'toggle', cap: c, val: 0});
      else if (t === 'range') { var r = p.range || {min: 0, max: 100}; lt.rows.push({label: name, kind: 'range', cap: c, min: r.min, max: r.max, step: Math.max(1, Math.round((r.max - r.min) / 10)), val: r.max}); }
      else if (t === 'color_setting' && c.instance === 'colorRgb') lt.rows.push({label: name, kind: 'enum', cap: c, opts: colorOpts(), at: 0});
      else if (t === 'color_setting' && c.instance === 'colorTemperatureK') { var k = p.range || {min: 2000, max: 9000}; lt.rows.push({label: name, kind: 'range', cap: c, min: k.min, max: k.max, step: 500, val: 4000}); }
      else if ((t === 'dynamic_scene' || t === 'mode') && p.options && p.options.length) lt.rows.push({label: name, kind: 'enum', cap: c, opts: p.options, at: 0});
      else if (t === 'dynamic_scene') lt.rows.push({label: name + ' (wird geladen …)', kind: 'none', cap: c, load: true});
      else if (t === 'music_setting') {
        var f = musicField(p, 'musicMode');
        if (f && f.options) lt.rows.push({label: name, kind: 'music', cap: c, opts: f.options, at: 0});
      } else if (t === 'segment_color_setting' && c.instance === 'segmentedColorRgb') {
        var seg = musicField(p, 'segment'), n = seg && seg.elementRange ? seg.elementRange.max + 1 : 15;
        lt.rows.push({label: name, kind: 'segments', cap: c, segs: n, opts: colorOpts().concat([{name: 'Regenbogen', value: 'rainbow'}]), at: 0});
      }
    }
    if (!lt.rows.length) lt.rows.push({label: 'Dieses Gerät meldet keine steuerbaren Funktionen', kind: 'none'});
    // wichtigstes zuerst: Ein/Aus, TV-Sync (DreamView, beim H6099 die Kamera), Helligkeit, Farbe, Szenen, Musik
    var ORDER = ['powerSwitch', 'dreamViewToggle', 'brightness', 'colorRgb', 'colorTemperatureK', 'lightScene', 'diyScene', 'musicMode', 'snapshot', 'segmentedColorRgb', 'segmentedBrightness', 'gradientToggle'];
    function rank(r) { var i = r.cap ? ORDER.indexOf(r.cap.instance) : -1; return i < 0 ? 99 : i; }
    lt.rows.sort(function (a, b) { return rank(a) - rank(b); });
    if (capOf(dev, 'powerSwitch')) lt.rows.push({label: 'Mit Free My TV+ einschalten' + (capOf(dev, 'dreamViewToggle') ? ' (und TV-Sync an)' : ''), kind: 'auto',
      val: stored('goveeAuto') === dev.device ? 1 : 0});
    paintLight();
    // aktuellen Zustand lesen und Szenen nachladen
    govee('device/state', {requestId: rid(), payload: {sku: dev.sku, device: dev.device}}, function (err, j) {
      if (err || lt.dev !== dev) return;
      var st = j.payload && j.payload.capabilities || [];
      for (var i = 0; i < st.length; i++) for (var r = 0; r < lt.rows.length; r++) {
        var row = lt.rows[r];
        if (!row.cap || row.cap.instance !== st[i].instance || !st[i].state) continue;
        var v = st[i].state.value;
        if (row.kind === 'toggle') row.val = v ? 1 : 0;
        if (row.kind === 'range' && typeof v === 'number' && v) row.val = v;
      }
      paintLight();
    });
    var paths = [['device/scenes', 'lightScene'], ['device/diy-scenes', 'diyScene']];
    for (var q = 0; q < paths.length; q++) (function (path, inst) {
      if (!capOf(dev, inst)) return;
      govee(path, {requestId: rid(), payload: {sku: dev.sku, device: dev.device}}, function (err, j) {
        if (lt.dev !== dev) return;
        var caps2 = !err && j.payload && j.payload.capabilities || [], opts = [];
        for (var i = 0; i < caps2.length; i++) if (caps2[i].parameters && caps2[i].parameters.options) opts = opts.concat(caps2[i].parameters.options);
        for (var r = 0; r < lt.rows.length; r++) if (lt.rows[r].cap && lt.rows[r].cap.instance === inst && lt.rows[r].load) {
          lt.rows[r] = opts.length ? {label: INSTANCE[inst], kind: 'enum', cap: lt.rows[r].cap, opts: opts, at: 0} : {label: INSTANCE[inst] + ': keine vorhanden', kind: 'none'};
        }
        paintLight();
      });
    })(paths[q][0], paths[q][1]);
  }
  function colorOpts() { var o = []; for (var i = 0; i < COLORS.length; i++) o.push({name: COLORS[i][0], value: COLORS[i][1]}); return o; }
  function musicField(p, name) { var f = p.fields || []; for (var i = 0; i < f.length; i++) if (f[i].fieldName === name) return f[i]; return null; }

  function send(dev, cap, value, done) {
    govee('device/control', {requestId: rid(), payload: {sku: dev.sku, device: dev.device, capability: {type: cap.type, instance: cap.instance, value: value}}}, function (err) {
      lt.msg = err ? err.message : '';
      if (done) done(err);
      if (ui.open === 'light') paintLight();
    });
  }
  function hsv(h) { var f = function (n) { var k = (n + h / 60) % 6; return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1)))); }; return (f(5) << 16) | (f(3) << 8) | f(1); }
  function applyRow(row) {
    var dev = lt.dev;
    if (!dev || !row.cap) return;
    if (row.kind === 'toggle') send(dev, row.cap, row.val);
    else if (row.kind === 'range') send(dev, row.cap, row.val);
    else if (row.kind === 'enum') send(dev, row.cap, row.opts[row.at].value);
    else if (row.kind === 'music') send(dev, row.cap, {musicMode: row.opts[row.at].value, sensitivity: 100, autoColor: 1});
    else if (row.kind === 'segments') {
      var o = row.opts[row.at], all = [];
      for (var i = 0; i < row.segs; i++) all.push(i);
      if (o.value !== 'rainbow') { send(dev, row.cap, {segment: all, rgb: o.value}); return; }
      // Regenbogen: sechs Farbgruppen nacheinander (Govee erlaubt 2 Befehle je Sekunde und Geraet)
      var g = 0;
      (function next() {
        if (g >= 6 || lt.dev !== dev) return;
        var part = [];
        for (var s2 = 0; s2 < row.segs; s2++) if (Math.floor(s2 * 6 / row.segs) === g) part.push(s2);
        var col = hsv(g * 60);
        g++;
        send(dev, row.cap, {segment: part, rgb: col}, function () { setTimeout(next, 600); });
      })();
    }
  }
  function rowValue(row) {
    if (row.kind === 'toggle' || row.kind === 'auto') return row.val ? 'an' : 'aus';
    if (row.kind === 'range') return '◄  ' + row.val + (row.cap.instance === 'colorTemperatureK' ? ' K' : ' %') + '  ►';
    if (row.kind === 'enum' || row.kind === 'music' || row.kind === 'segments') return '◄  ' + (row.opts[row.at].name || '') + '  ►';
    return '';
  }
  function paintLight() {
    $('light-title').textContent = lt.dev ? (lt.dev.deviceName || lt.dev.sku) + (lt.msg ? '   ·   ' + lt.msg : '') : 'Govee-Licht' + (lt.msg ? '   ·   ' + lt.msg : '');
    var box = $('light-rows');
    box.innerHTML = '';
    for (var i = 0; i < lt.rows.length; i++) {
      var r = lt.rows[i], row = el('div', 'row' + (r.kind === 'none' ? ' dim' : '') + (i === lt.item ? ' focus' : ''), box, r.label);
      var v = rowValue(r);
      if (v) el('span', 'val', row, v);
      if (r.kind === 'enum' && r.cap && r.cap.instance === 'colorRgb' || r.kind === 'segments') {
        var c = r.opts[r.at].value;
        if (typeof c === 'number') { var dot = el('span', 'dot', row); dot.style.background = '#' + ('00000' + c.toString(16)).slice(-6); }
      }
    }
    var first = Math.max(0, Math.min(lt.rows.length - 10, lt.item - 4));
    box.style.webkitTransform = box.style.transform = 'translateY(' + (-first * 76) + 'px)';
  }
  function lightKey(k, K) {
    var f = $('light-q');
    if (document.activeElement === f) {
      if (k === K.ok || k === 65376) { f.blur(); store('goveeKey', (f.value || '').replace(/\s+/g, '')); setClass($('light-search'), 'on', false); lightHome(); return true; }
      if (k === K.back || k === 27 || k === 65385) { f.blur(); setClass($('light-search'), 'on', false); return true; }
      return 'type';
    }
    var row = lt.rows[lt.item];
    if (k === K.back) {
      if (lt.dev) lightHome();
      else { ui.open = null; setClass($('light'), 'open', false); if (ui.onClose) ui.onClose(); }
      return true;
    }
    if (k === K.up) lt.item = Math.max(0, lt.item - 1);
    else if (k === K.down) lt.item = Math.min(lt.rows.length - 1, lt.item + 1);
    else if ((k === K.left || k === K.right) && row) {
      var d = k === K.right ? 1 : -1;
      if (row.kind === 'range') { row.val = Math.max(row.min, Math.min(row.max, row.val + d * row.step)); }
      else if (row.opts) { row.at = (row.at + d + row.opts.length) % row.opts.length; }
      else if (row.kind === 'toggle') { row.val = d > 0 ? 1 : 0; }
      else return true;
      clearTimeout(lt.pending);
      lt.pending = setTimeout(function () { applyRow(row); }, 450);   // erst senden, wenn die Taste ruht
    } else if (k === K.ok && row) {
      if (row.kind === 'key') { setClass($('light-search'), 'on', true); f.value = ''; f.focus(); return true; }
      if (row.kind === 'dev') { lightDevice(row.dev); return true; }
      if (row.kind === 'all') {
        var i = 0;
        (function next() {
          if (i >= lt.devices.length) return;
          var dv = lt.devices[i++], c = capOf(dv, 'powerSwitch');
          if (c) send(dv, c, row.on, function () { setTimeout(next, 300); }); else next();
        })();
        lt.msg = row.on ? 'Alle an' : 'Alle aus';
      } else if (row.kind === 'toggle') { row.val = row.val ? 0 : 1; applyRow(row); }
      else if (row.kind === 'auto') { row.val = row.val ? 0 : 1; store('goveeAuto', row.val ? lt.dev.device : ''); store('goveeAutoSku', row.val ? lt.dev.sku : ''); }
      else applyRow(row);
    }
    paintLight();
    return true;
  }

  // MARK: - Recorder (1.5)
  // Welt-TV (HLS) nimmt die App selbst auf: Segment fuer Segment auf den USB-Stick (eine .ts-Datei) oder in einen
  // Netzwerkordner per WebDAV (Segmente und eine Wiedergabeliste, spielbar mit VLC oder hier im Mediaplayer).
  // Sat-Sender kann keine fremde App aufnehmen: das macht der Fernseher selbst (REC-Taste im Fernsehbild).
  // Adresse, Benutzer und Passwort fuers Netzwerk bleiben nur auf diesem Fernseher (localStorage).
  var REC_DIR = 'FreeMyTV-Aufnahmen';
  var Recorder = (function () {
    var job = null;
    function say(t) { if (guideHooks && guideHooks.toast) guideHooks.toast(t); }
    function cfg() { return {target: stored('recTarget') || 'usb', nas: stored('recNas') || '', user: stored('recUser') || '', pass: stored('recPass') || ''}; }
    function abs(base, u) {
      if (/^[a-z]+:\/\//i.test(u)) return u;
      if (u.charAt(0) === '/') return base.replace(/^([a-z]+:\/\/[^\/]+).*$/i, '$1') + u;
      return base.replace(/[^\/]*([?#].*)?$/, '') + u;
    }
    function getBin(url, done) {
      var x = new XMLHttpRequest();
      try { x.open('GET', url, true); x.responseType = 'arraybuffer'; } catch (e) { done(e); return; }
      x.timeout = 20000;
      x.onload = function () { if (x.status >= 200 && x.status < 300 && x.response) done(null, x.response); else done(new Error('HTTP ' + x.status)); };
      x.onerror = x.ontimeout = function () { done(new Error('net')); };
      x.send();
    }
    function b64(buf) {
      var u = new Uint8Array(buf), out = '', CH = 0x8000;
      for (var i = 0; i < u.length; i += CH) out += String.fromCharCode.apply(null, u.subarray(i, i + CH));
      return btoa(out);
    }
    function safe(name) { return (name || 'Aufnahme').replace(/[^A-Za-z0-9ÄÖÜäöüß _.-]+/g, '').replace(/\s+/g, '_').slice(0, 40); }
    function stamp() { var d = new Date(); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()); }

    // Ziel USB: erster eingesteckter Speicher, Ordner FreeMyTV-Aufnahmen, eine Datei, die waechst
    function usbSink(name, ready) {
      var fs = window.tizen && window.tizen.filesystem;
      if (!fs || !fs.listStorages) return ready(new Error('Kein Dateizugriff'));
      fs.listStorages(function (list) {
        var st = null;
        for (var i = 0; i < list.length; i++) if (list[i].type === 'EXTERNAL' && list[i].state === 'MOUNTED') st = list[i];
        if (!st) return ready(new Error('Kein USB-Stick gefunden'));
        fs.resolve(st.label, function (root) {
          var dir;
          try { dir = root.resolve(REC_DIR); } catch (e) { try { dir = root.createDirectory(REC_DIR); } catch (e2) { return ready(new Error('Ordner ließ sich nicht anlegen')); } }
          var file, part = 1, size = 0, base = name;
          function open() {
            try { file = dir.createFile(base + (part > 1 ? '_teil' + part : '') + '.ts'); } catch (e) { return false; }
            return true;
          }
          if (!open()) return ready(new Error('Datei ließ sich nicht anlegen'));
          ready(null, {
            label: 'USB ' + st.label + ' / ' + REC_DIR,
            write: function (buf, done) {
              // FAT32: hoechstens 4 GB je Datei, dann geht es in einer neuen weiter
              if (size + buf.byteLength > 3900 * 1048576) { part++; size = 0; if (!open()) return done(new Error('voll')); }
              try {
                file.openStream('a', function (st2) {
                  try { st2.writeBase64(b64(buf)); st2.close(); size += buf.byteLength; done(null); } catch (e) { try { st2.close(); } catch (e3) {} done(e); }
                }, function (e) { done(e); });
              } catch (e) { done(e); }
            },
            end: function () {}
          });
        }, function () { ready(new Error('USB-Stick ließ sich nicht öffnen')); }, 'rw');
      }, function () { ready(new Error('Keine Speicher')); });
    }

    // Ziel Netzwerk (WebDAV): Ordner je Aufnahme, Segmente einzeln, dazu playlist.m3u8
    function dav(method, url, body, c, done) {
      var x = new XMLHttpRequest();
      try { x.open(method, url, true); } catch (e) { done(e); return; }
      if (c.user) x.setRequestHeader('Authorization', 'Basic ' + btoa(unescape(encodeURIComponent(c.user + ':' + c.pass))));
      if (method === 'PROPFIND') x.setRequestHeader('Depth', '1');
      x.timeout = 30000;
      x.onload = function () { done(x.status >= 200 && x.status < 300 || x.status === 405 ? null : new Error('HTTP ' + x.status), x.responseText); };
      x.onerror = x.ontimeout = function () { done(new Error('Netzwerkspeicher nicht erreichbar')); };
      x.send(body || null);
    }
    function nasSink(name, ready) {
      var c = cfg();
      if (!c.nas) return ready(new Error('Kein Netzwerkspeicher eingerichtet (Mediaplayer)'));
      var base = c.nas.replace(/\/?$/, '/'), folder = base + encodeURIComponent(name) + '/', n = 0, lines = [], target = 6;
      dav('MKCOL', folder, null, c, function (err) {
        if (err) return ready(err);
        function playlist(end, done) {
          var t = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:' + target + '\n#EXT-X-MEDIA-SEQUENCE:0\n' + (end ? '#EXT-X-PLAYLIST-TYPE:VOD\n' : '') +
            lines.join('') + (end ? '#EXT-X-ENDLIST\n' : '');
          dav('PUT', folder + 'playlist.m3u8', t, c, done || function () {});
        }
        ready(null, {
          label: 'Netzwerk ' + base.replace(/^[a-z]+:\/\/([^\/]+).*$/i, '$1'),
          url: folder + 'playlist.m3u8',
          write: function (buf, done, dur) {
            var seg = 'seg' + ('0000' + (++n)).slice(-5) + '.ts';
            target = Math.max(target, Math.ceil(dur || 6));
            dav('PUT', folder + seg, buf, c, function (err2) {
              if (err2) return done(err2);
              lines.push('#EXTINF:' + (dur || 6).toFixed(3) + ',\n' + seg + '\n');
              playlist(false);
              done(null);
            });
          },
          end: function () { playlist(true); }
        });
      });
    }

    function status() {
      var b = $('recbadge');
      if (!b) { b = el('div', '', $('stage') || document.body); b.id = 'recbadge'; }
      setClass(b, 'on', !!job);
      if (!job) return;
      var sec = Math.round((Date.now() - job.started) / 1000);
      b.textContent = '● REC  ' + job.name + '  ' + Math.floor(sec / 60) + ':' + pad(sec % 60) + '  ·  ' + Math.round(job.bytes / 1048576) + ' MB' + (job.err ? '  ·  ' + job.err : '');
    }

    function stop(why) {
      if (!job) return;
      var j = job;
      job = null;
      clearTimeout(j.timer);
      clearInterval(j.tick);
      try { j.sink.end(); } catch (e) {}
      status();
      say('Aufnahme beendet' + (why ? ' (' + why + ')' : '') + ': ' + j.name + ', ' + Math.round(j.bytes / 1048576) + ' MB auf ' + j.sink.label);
    }

    /** Welt-TV-Sender aufnehmen (HLS), bis gestoppt. */
    function world(ch) {
      if (job) { stop(); return; }
      if (!ch || !/\.m3u8?(\?|$)/i.test(ch.url) && !/m3u8/i.test(ch.url)) { say('Aufnehmen geht bei Welt-TV-Sendern mit HLS-Stream (m3u8).'); return; }
      var c = cfg(), name = safe(ch.name) + '_' + stamp();
      (c.target === 'nas' ? nasSink : usbSink)(name, function (err, sink) {
        if (err) { say('Aufnahme nicht möglich: ' + err.message); return; }
        job = {name: ch.name, url: ch.url, sink: sink, started: Date.now(), bytes: 0, seen: {}, queue: [], busy: false, timer: 0, err: ''};
        job.tick = setInterval(status, 1000);
        status();
        say('Aufnahme läuft: ' + ch.name + ' auf ' + sink.label + '. Rote Taste im Player beendet sie.');
        poll(job, ch.url, true);
      });
    }
    function poll(j, url, first) {
      if (job !== j) return;
      getText(url, function (err, text) {
        if (job !== j) return;
        if (err) { j.err = 'Stream hakt'; j.timer = setTimeout(function () { poll(j, url); }, 4000); return; }
        if (/#EXT-X-STREAM-INF/.test(text)) {
          // Hauptliste: die beste Qualitaet bis etwa 6 Mbit/s (USB-Stick und WLAN kommen da mit)
          var lines = text.split(/\r?\n/), best = null, bw = -1, lowest = null, lbw = 1e12;
          for (var i = 0; i < lines.length; i++) {
            var m = /BANDWIDTH=(\d+)/.exec(lines[i]);
            if (!m || !lines[i + 1]) continue;
            var b = +m[1], u = abs(url, lines[i + 1].replace(/^\s+|\s+$/g, ''));
            if (b <= 6000000 && b > bw) { bw = b; best = u; }
            if (b < lbw) { lbw = b; lowest = u; }
          }
          return poll(j, best || lowest, true);
        }
        if (/#EXT-X-KEY:METHOD=(?!NONE)/.test(text)) { stop('der Sender verschlüsselt seinen Stream'); return; }
        var map = /#EXT-X-MAP:URI="([^"]+)"/.exec(text);
        if (map && first && !j.seen['map']) { j.seen['map'] = true; j.queue.push({url: abs(url, map[1]), dur: 0}); }
        var td = +((/#EXT-X-TARGETDURATION:(\d+)/.exec(text) || [])[1] || 6), ls = text.split(/\r?\n/), dur = 0;
        for (var k = 0; k < ls.length; k++) {
          var l = ls[k].replace(/^\s+|\s+$/g, '');
          if (/^#EXTINF:/.test(l)) dur = parseFloat(l.slice(8)) || td;
          else if (l && l.charAt(0) !== '#') {
            var su = abs(url, l);
            if (!j.seen[su]) { j.seen[su] = true; j.queue.push({url: su, dur: dur}); }
          }
        }
        // bei einer langen Liste am Anfang nur die letzten drei Stuecke (sonst beginnt die Aufnahme in der Vergangenheit)
        if (first && j.queue.length > 4) j.queue = j.queue.slice(j.queue.length - 3);
        drain(j);
        if (/#EXT-X-ENDLIST/.test(text)) return;
        j.timer = setTimeout(function () { poll(j, url); }, Math.max(2000, Math.min(10000, td * 1000 / 2)));
      }, 15000);
    }
    function drain(j) {
      if (j.busy || job !== j || !j.queue.length) return;
      j.busy = true;
      var s = j.queue.shift();
      getBin(s.url, function (err, buf) {
        if (job !== j) return;
        if (err) { j.busy = false; j.err = 'Stück fehlt'; drain(j); return; }
        j.sink.write(buf, function (err2) {
          j.busy = false;
          if (err2) { stop('Speichern fehlgeschlagen: ' + (err2.message || err2)); return; }
          j.err = '';
          j.bytes += buf.byteLength;
          drain(j);
        }, s.dur);
      });
    }

    // Sat: der Fernseher nimmt selbst auf. Jetzt: umschalten und ins Fernsehbild, dort REC. Spaeter: Erinnerung, die
    // zur Startzeit umschaltet und ins Fernsehbild wechselt.
    function satRec(ch, p) {
      if (p && p.start > Date.now() + 60000) {
        timer({kind: 'rec', major: ch.major, minor: ch.minor, name: channelName(ch), title: p.title, start: p.start, end: p.end});
        say('Geplant: ' + p.title + ' (' + dayLabel(p.start) + ' ' + hm(p.start) + '). Free My TV+ schaltet dann um und öffnet das Fernsehbild – dort REC drücken. Sat-Aufnahmen speichert der Fernseher selbst auf eine USB-Festplatte (USB-Sticks nimmt er dafür nicht).');
        return;
      }
      say('Sat-Aufnahmen macht der Fernseher selbst: gleich öffnet sich das Fernsehbild auf ' + channelName(ch) + ' – dort die REC-Taste drücken (USB-Festplatte am TV, kein Stick). HD+-Sender erlauben das teils nicht.');
      tune(ch, function () {
        setTimeout(function () { try { window.tizen.application.launch('org.tizen.tv-viewer', function () {}, function () {}); } catch (e) {} }, 3500);
      });
    }
    function remind(ch, p) {
      timer({kind: 'remind', major: ch.major, minor: ch.minor, name: channelName(ch), title: p.title, start: p.start, end: p.end});
      say('Erinnerung gesetzt: ' + p.title + ', ' + dayLabel(p.start) + ' ' + hm(p.start) + ' auf ' + channelName(ch));
    }
    function timers() { var t = stored('timers'); return t && t.length ? t : []; }
    function timer(t) { var all = timers(); all.push(t); store('timers', all); }
    setInterval(function () {
      var all = timers(), keep = [], now = Date.now();
      for (var i = 0; i < all.length; i++) {
        var t = all[i];
        if (t.start - now > 60000) { keep.push(t); continue; }
        if (now > t.end) continue;   // verpasst (Fernseher aus)
        var ch = null;
        for (var k = 0; k < sat.list.length; k++) if (sat.list[k].major === t.major && sat.list[k].minor === t.minor) ch = sat.list[k];
        if (!ch) continue;
        if (t.kind === 'rec') satRec(ch, null);
        else { say('Jetzt: ' + t.title + ' auf ' + t.name); sat.channel = ch; changed(); tune(ch, function () { changed(); }); }
      }
      if (keep.length !== all.length) store('timers', keep);
    }, 20000);

    return {world: world, stop: stop, sat: satRec, remind: remind, busy: function () { return !!job; }, cfg: cfg};
  })();

  // MARK: - Start

  var preloaded = false;
  function refresh() {
    if (!preloaded) {   // 1.7: hls.js und der Sportsender schon vorab, damit die Welt-TV-Vorschau schnell steht
      preloaded = true;
      setTimeout(function () { loadHls(function () {}); loadSport(); if (sportCh) getText(sportCh.url, function () {}, 8000); }, 5000);
    }
    refreshNews();
    if (Date.now() - sat.at > 60000) refreshSat();
    if (!featured.length) loadFeatured();
  }

  try { window.tizen.tvinputdevice.registerKey('ChannelUp'); window.tizen.tvinputdevice.registerKey('ChannelDown'); } catch (e) {}
  try { window.tizen.tvinputdevice.registerKey('ColorF0Red'); } catch (e) {}
  try { window.tizen.tvinputdevice.registerKey('Info'); } catch (e) {}

  if (tv) {
    try { tv.addChannelChangeListener(function () { sat.now = null; refreshSat(); changed(); }, 'MAIN'); } catch (e) {}
  }

  return {
    onChange: function (fn) { listeners.push(fn); },
    refresh: refresh,
    news: function () { return news; },
    newsAgo: ago,
    isYouTube: isYouTube,
    youtube: youtube,
    openUrl: openUrl,
    cards: cards,
    live: live,
    onLive: function (fn) { liveHook = fn; },
    sat: sat,
    band: band,
    bandUrl: function () { return bandUrl; },
    bandLabel: function () { var s = sceneKey(); return s ? SCENES[s].label : LABEL[bandMood] || ''; },
    mood: mood,
    moodLabel: function (m) { return LABEL[m] || m; },
    scenes: SCENES,
    sceneMood: function () { var s = sceneKey(); return s ? SCENES[s].mood : ''; },
    openWorld: openWorld,
    openPrivacy: openPrivacy,
    openWeather: openWeather,
    isPromo: isPromo,
    memory: memory,
    backHome: backHome,
    wood: wood,
    legendText: legendText,
    onLegend: function (fn) { legendHook = fn; },
    liveMorph: liveMorph,
    morphing: function () { return !!morph; },
    cornerOk: function () { return sat.ok && !!sat.channel && ui.open !== 'player' && ui.open !== 'wx' && ui.open !== 'topics' && ui.open !== 'wtv' && ui.open !== 'light' ; },
    // im Programmfuehrer 10 % kleiner und ueber der Legende, sonst rechts unten
    cornerRect: function () { return ui.open === 'guide' ? [1336, 724, 504, 284] : [1316, 728, 560, 315]; },
    openGuide: openGuide,
    openLight: openLight,
    stopPreview: stopPreview,
    epgAuto: function () { return auto.ok === true ? 'über den 2. Empfänger' : auto.ok === false ? 'nachts (2. Empfänger für Apps gesperrt)' : 'wird geprüft'; },
    openMedia: openMedia,
    setApps: function (list, launch) { extApps = list || []; extLaunch = launch; },
    zapMode: function () { return zapMode; },
    endZap: function () { if (zapMode) { zapMode = false; changed(); return true; } return false; },
    key: key,
    isOpen: function () { return !!ui.open; },
    onClose: function (fn) { ui.onClose = fn; },
    sources: WTV_SOURCES
  };
})();
