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
    return {title: p.title || '', start: start, end: dur ? start + dur : 0, text: p.detailedDescription || p.description || ''};
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
      tv.getProgramList(ch, new window.tizen.TZDate(), function (list) {
        var now = Date.now(), hit = null;
        for (var i = 0; list && i < list.length; i++) {
          var p = program(list[i]);
          if (p.start <= now && (!p.end || p.end > now)) { hit = p; break; }
        }
        sat.programs[key] = hit;
        done(hit);
      }, function () { done(null); }, 3);
    } catch (e) { done(null); }
  }

  var liveShown = false, liveRect = '', liveHook = null;
  function liveState(on) { liveShown = on; if (liveHook) liveHook(on); }

  /** Das Livebild des Fernsehers in einem Rechteck (Bildschirmpixel), oder aus. */
  function live(rect) {
    if (!tvw) return;
    var key = rect ? rect.join(',') : '';
    if (key === liveRect) return;
    liveRect = key;
    try {
      if (!rect) { if (liveShown) tvw.hide(function () {}, function () {}, 'MAIN'); liveState(false); return; }
      tvw.show(function () { liveState(true); }, function () { liveState(false); },
        [rect[0] + 'px', rect[1] + 'px', rect[2] + 'px', rect[3] + 'px'], 'MAIN');
    } catch (e) { liveState(false); }
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
        cur = {name: name, logo: attrs['tvg-logo'] || '', group: attrs['group-title'] || '', quality: q, tags: tags};
      } else if (line.charAt(0) !== '#' && cur) {
        cur.url = line;
        var key = cur.name.toLowerCase();
        if (cur.name && !seen[key] && !ADULT.test(cur.group)) { seen[key] = true; out.push(cur); }
        cur = null;
      }
    }
    out.sort(function (a, b) { var x = a.name.toLowerCase(), y = b.name.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; });
    return out;
  }

  function srcUrl(src) { return src.url || WTV_BASE + src.path; }

  function loadList(src, done) {
    if (src.filter) {
      return loadList(INDEX, function (all) {
        done(all ? all.filter(function (c) { return src.filter.test(c.name) || src.filter.test(c.group); }) : null);
      });
    }
    var url = srcUrl(src);
    if (wtvCache[url]) return done(wtvCache[url]);
    getText(url, function (err, text) {
      if (err) return done(null);
      wtvCache[url] = parseM3U(text);
      done(wtvCache[url]);
    }, 30000);
  }

  // Zuletzt gesehen: die letzten 10 Sender, die in Welt-TV liefen
  function recent() { return stored('wtvRecent') || []; }
  function remember(ch) {
    var list = recent().filter(function (c) { return c.url !== ch.url; });
    list.unshift({name: ch.name, url: ch.url, logo: ch.logo, quality: ch.quality, tags: ch.tags || []});
    store('wtvRecent', list.slice(0, 10));
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

  function setList(list, label, info) {
    ui.list = list;
    ui.label = label;
    ui.item = 0;
    ui.scroll = 0;
    ui.nodes = {};
    $('wtv-grid').innerHTML = '';
    $('wtv-info').textContent = info || (list.length + ' Sender  ·  ' + label + '  ·  OK: ansehen  ·  rechte Leiste: nach Buchstaben springen  ·  P+/P−: blättern');
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
    el('div', 'cn', c, ch.name);
    var tags = ch.tags || [];
    var badge = tags.indexOf('Geo-blocked') >= 0 ? 'Geo' : tags.indexOf('Not 24/7') >= 0 ? 'zeitweise' : ch.quality;
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
    ui.open = null;
    setClass($('wtv'), 'open', false);
    if (ui.onClose) ui.onClose();
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
    } else if (ui.zone === 'search') {
      if (k === K.ok) { startTyping('search'); return true; }
      if (k === K.down && n) ui.zone = 'grid';
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
      else if (k === K.up) { if (ui.item >= COLS) ui.item -= COLS; else ui.zone = 'search'; }
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
    remember(ch);
    ui.playList = list;
    ui.playing = idx;
    ui.playLabel = label || '';
    if (ui.open !== 'player') ui.before = ui.open;
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
        ui.hls = new window.Hls({maxBufferLength: 20});
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
    ui.open = ui.before || null;
    ui.before = null;
    if (ui.open === 'wtv') { ui.row = 0; ui.item = ui.playList === ui.list ? ui.playing : ui.item; paintWorld(); }
    else if (ui.onClose) ui.onClose();
  }

  function playerKey(k, K) {
    var n = ui.playList ? ui.playList.length : 0;
    if (k === K.up || k === 427) play(ui.playList, (ui.playing - 1 + n) % n, ui.playLabel);
    else if (k === K.down || k === 428) play(ui.playList, (ui.playing + 1) % n, ui.playLabel);
    else if (k === K.back) closePlayer();
    else osd();
  }

  // MARK: - Sat-Senderliste (eigene Ebene)

  var tvl = {item: 0};

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
      el('span', 'num', row, ch.major + (ch.minor ? '.' + ch.minor : ''));
      el('span', 'nm', row, channelName(ch));
      el('span', 'pg', row, '');
      if (cur && ch.major === cur.major && ch.minor === cur.minor) tvl.item = i;
    }
    paintChannels();
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

  function channelsKey(k, K) {
    if (k === K.back) { closeChannels(); return; }
    if (k === K.up) tvl.item = Math.max(0, tvl.item - 1);
    else if (k === K.down) tvl.item = Math.min(sat.list.length - 1, tvl.item + 1);
    else if (k === K.ok) {
      var ch = sat.list[tvl.item];
      closeChannels();
      tune(ch, function () { changed(); });
      return;
    }
    paintChannels();
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

  /** Startet den Hintergrund-Dienst, der Free My TV+ nach anderen Apps zurueckholt (oder schaltet ihn aus). */
  function backHome(on) {
    if (!samsung || !window.tizen.ApplicationControl) return;
    try {
      var d = new window.tizen.ApplicationControlData('enabled', [on ? '1' : '0']);
      var ac = new window.tizen.ApplicationControl('http://tizen.org/appcontrol/operation/service', null, null, null, [d]);
      window.tizen.application.launchAppControl(ac, 'FMTVplusDL.Rueckkehr', function () {}, function () {});
    } catch (e) {}
  }

  // Samsung-Werbe- und Promo-Apps, die Free My TV+ in Leiste und Alle Apps ausblendet (nur ausgeblendet, nicht geloescht).
  var PROMO = /samsung health|samsung promotion|^promotion$|universal guide|art store|samsung daily|gaming hub|global goals|samsung kids|samsung tv-?shop|^e-?shop$|samsung shop/i;
  function isPromo(app) { return PROMO.test(app.title || '') || /samsunghealth|promotion|universalguide/i.test(app.id || ''); }

  /** Tasten fuer die eigenen Ebenen; true = erledigt (home.js macht dann nichts mehr). */
  function key(k, K) {
    if (!ui.open) return false;
    if (k === 27 || k === 8) k = K.back;   // Esc/Backspace in der Vorschau
    if (ui.open === 'player') playerKey(k, K);
    else if (ui.open === 'wtv') return worldKey(k, K);
    else if (ui.open === 'tvlist') channelsKey(k, K);
    else if (ui.open === 'privacy') privacyKey(k, K);
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
    if (tab === 0) {
      if (sat.ok && sat.channel) {
        var now = sat.now, left = now && now.end ? Math.max(0, Math.round((now.end - Date.now()) / 60000)) : 0;
        out.push({id: 'live', live: true, title: channelName(sat.channel) + (now ? '  ·  ' + now.title : ''),
          meta: now && now.start ? 'Jetzt ' + hm(now.start) + (now.end ? '–' + hm(now.end) + '  ·  noch ' + left + ' Min.' : '') : 'Live',
          run: hooks.fullTV});
        var nx = sat.next;
        out.push({id: 'next', text: nx ? nx.title : 'Programm', kicker: nx && nx.start ? 'Danach ' + hm(nx.start) : 'Danach',
          title: nx ? channelName(sat.channel) : 'Kein EPG vom Sender', run: hooks.fullTV});
        out.push({id: 'list', text: 'Senderliste', kicker: 'TV-Programm', title: sat.list.length ? sat.list.length + ' Sender' : 'Alle Sender', icon: 'live_tv',
          run: function () { if (!openChannels()) { loadChannels(0); hooks.toast('Die Senderliste wird geladen, gleich noch einmal versuchen.'); } }});
      } else {
        out.push({id: 'live', text: 'Fernsehen', kicker: 'Live-TV', title: 'Live-TV', meta: 'Sat / HD+', icon: 'live_tv', run: hooks.fullTV});
        for (var f = 0; f < featured.length && out.length < 3; f++) out.push(worldCard(featured[f], featured, f));
      }
    } else if (tab === 1) {
      // Welt-TV: Tipp (flach) und Suche darunter, "Alle Sender", dann die 10 zuletzt gesehenen
      if (featured[0]) { var a = worldCard(featured[0], featured, 0); a.rect = [80, 262, 700, 300]; a.inside = true; out.push(a); }
      out.push({id: 'wsearch', text: 'Sender suchen', kicker: 'Welt-TV', title: '', rect: [80, 582, 700, 180], inside: true, plain: true,
        run: function () { openWorld('search'); }});
      out.push({id: 'wtv', text: 'Alle Sender', kicker: 'Kategorien · Länder · Themen', title: '', icon: 'cast', rect: [800, 262, 300, 500], inside: true, plain: true,
        run: function () { openWorld(); }});
      var rec = recent().slice(0, 10), names = {};
      for (var r = 0; r < rec.length; r++) names[rec[r].name] = true;
      for (var t = 0; t < featured.length && rec.length < 10; t++) if (!names[featured[t].name]) rec.push(featured[t]);
      for (var m = 0; m < rec.length; m++) {
        var c = worldCard(rec[m], rec, m);
        c.id = 'r' + m + rec[m].name;
        c.rect = [1120 + (m % 5) * 146, 262 + Math.floor(m / 5) * 258, 132, 242];
        c.inside = true;
        c.mini = true;
        out.push(c);
      }
    } else {
      for (var n = 0; n < news.length && out.length < 3; n++) {
        (function (it) {
          out.push({id: 'news' + n, text: it.title, kicker: it.source + (it.at ? '  ·  ' + ago(it.at) : ''),
            title: it.at ? ago(it.at) : it.source, news: true, run: function () { if (it.link) openUrl(it.link, function () { hooks.toast('Artikel ließ sich nicht öffnen.'); }); }});
        })(news[n]);
      }
      if (!out.length) out.push({id: 'nonews', text: 'Nachrichten werden geladen …', kicker: 'Cybersecurity', title: 'News', news: true, run: function () {}});
    }
    return out;
  }

  function worldCard(ch, list, i) {
    return {id: 'w' + i + ch.name, logo: ch.logo, title: ch.name, meta: 'Welt-TV' + (ch.quality ? '  ·  ' + ch.quality : ''),
      run: function () { play(list, i, 'Welt-TV'); }};
  }

  // MARK: - Start

  function refresh() {
    refreshNews();
    if (Date.now() - sat.at > 60000) refreshSat();
    if (!featured.length) loadFeatured();
  }

  try { window.tizen.tvinputdevice.registerKey('ChannelUp'); window.tizen.tvinputdevice.registerKey('ChannelDown'); } catch (e) {}
  try { window.tizen.tvinputdevice.registerKey('ColorF0Red'); } catch (e) {}

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
    isPromo: isPromo,
    memory: memory,
    backHome: backHome,
    key: key,
    isOpen: function () { return !!ui.open; },
    onClose: function (fn) { ui.onClose = fn; },
    sources: WTV_SOURCES
  };
})();
