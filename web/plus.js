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
    remember(ch);
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
  var tp = {zone: 'slots', slot: 0, item: 0, scroll: 0, list: TOPICS};
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
    } else if (tp.zone === 'search') {
      if (k === K.ok) { f.focus(); return true; }
      if (k === K.down && n) tp.zone = 'grid';
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
    if (!ui.open && (k === 427 || k === 428) && sat.list.length) { zap(k === 427 ? 1 : -1); return true; }
    if (!ui.open) return false;
    if (k === 27 || k === 8) k = K.back;   // Esc/Backspace in der Vorschau
    if (ui.open === 'player') playerKey(k, K);
    else if (ui.open === 'wtv') return worldKey(k, K);
    else if (ui.open === 'tvlist') channelsKey(k, K);
    else if (ui.open === 'privacy') privacyKey(k, K);
    else if (ui.open === 'wx') weatherKey(k, K);
    else if (ui.open === 'topics') return topicsKey(k, K);
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
        var nx = sat.next, pic = nx ? picture(nx.title) : '';
        out.push({id: 'next' + (pic ? 'p' : ''), text: nx ? nx.title : 'Kein EPG vom Sender', kicker: (nx && nx.start ? 'Danach ' + hm(nx.start) : 'Danach') + '  ·  ' + channelName(sat.channel),
          title: '', plain: true, inside: true, image: pic, rect: [1160, 262, 320, 380], run: hooks.fullTV});
        out.push({id: 'zap' + (sat.channel ? sat.channel.major + '.' + sat.channel.minor : '') + (zapMode ? 'z' : ''), switcher: true, text: '', kicker: 'Sender umschalten', title: '', plain: true, inside: true,
          rect: [1520, 262, 320, 380], draw: drawSwitcher, key: switcherKey, run: switcherOk});
        out.push({id: 'gsearch', text: 'Suchen: Sender, Sendungen, Apps & Mediatheken', kicker: '', title: '', plain: true, inside: true, flat: true,
          rect: [1160, 662, 680, 100], run: function () { openWorld('search'); }});
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
    el('div', 'kicker zk', box, zapMode ? '▲ ▼ schaltet um  ·  OK fertig' : 'Sender  ·  OK zum Umschalten');
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
  function switcherOk() { zapMode = !zapMode; changed(); }
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
        wiki[t] = {img: j.originalimage ? j.originalimage.source : j.thumbnail ? j.thumbnail.source : '', text: j.extract || ''};
        changed();
        if (ui.open === 'tvlist') paintInfo();
      } catch (e) {}
    }, 8000);
    return null;
  }
  function picture(title) { var w = wikiFor(title); return w && w.img ? w.img : ''; }

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
    setApps: function (list, launch) { extApps = list || []; extLaunch = launch; },
    zapMode: function () { return zapMode; },
    endZap: function () { if (zapMode) { zapMode = false; changed(); return true; } return false; },
    key: key,
    isOpen: function () { return !!ui.open; },
    onClose: function (fn) { ui.onClose = fn; },
    sources: WTV_SOURCES
  };
})();
