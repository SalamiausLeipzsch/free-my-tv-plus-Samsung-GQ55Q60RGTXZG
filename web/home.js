/*
 * The home screen for web-app TVs (LG webOS, Samsung Tizen), with the Android app's design and behavior (HomeView):
 *  - top: the "For You" title and the tabs (Explore, Movies, Shows); icon-only glass buttons at the right (Live TV,
 *    HDMI Inputs, Settings) and the crypto quotes at the end of the tab row;
 *  - three picks for this hour in the selected tab; the background is the first one's photo, blurred and almost white;
 *  - the glass shelf with the apps; ↓ opens the drawer (inputs, shortcuts, weather, prices); ↑ or Back closes it;
 *  - a night look from sunset to sunrise; a screensaver after a few idle minutes.
 * The remote's arrows, OK and Back move the focus; a pointer (LG's Magic Remote) focuses what it points at.
 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, parent, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  function sym(name, parent, size) {
    var s = el('span', 'sym', parent);
    s.style.webkitMaskImage = 'url(symbols/' + name + '.png)';
    s.style.maskImage = 'url(symbols/' + name + '.png)';
    if (size) { s.style.width = size + 'px'; s.style.height = size + 'px'; }
    return s;
  }

  function coin(i, parent) {
    var c = window.COINS && window.COINS[i];
    if (!c) return;
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 32 32');
    // Old WebKit (Tizen 2) draws an SVG without them at 300×150; the CSS still sets the size everywhere it's shown.
    svg.setAttribute('width', '15');
    svg.setAttribute('height', '15');
    for (var k = 0; k < c.length; k++) {
      var p = document.createElementNS(ns, 'path');
      p.setAttribute('d', c[k]);
      p.setAttribute('fill-rule', 'evenodd');
      svg.appendChild(p);
    }
    parent.appendChild(svg);
  }

  function hasClass(e, c) { return (' ' + e.className + ' ').indexOf(' ' + c + ' ') >= 0; }
  function setClass(e, c, on) {
    if (!e) return;
    if (on && !hasClass(e, c)) e.className = (e.className + ' ' + c).replace(/^\s+/, '');
    else if (!on && hasClass(e, c)) e.className = (' ' + e.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\s+|\s+$/g, '');
  }

  var stage = $('stage'), body = document.body;

  /** The 1920 × 1080 stage fills the window (on the TV it already is 1920 × 1080). */
  function fit() {
    // Free My TV+: oeffnet die Samsung-Tastatur, wird das Fenster niedriger. Dann bleibt die Groesse, wie sie war,
    // sonst rutschte das ganze Bild verkleinert nach links oben.
    var a = document.activeElement;
    if (a && a.tagName === 'INPUT') { window.scrollTo(0, 0); return; }
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.webkitTransform = stage.style.transform = s === 1 ? '' : 'scale(' + s + ')';
  }

  // MARK: - Apps on the shelf

  /** Shelf apps in this order when installed, like the Android app: key, LG app id, name on the TV, brand gradient. */
  var SHELF = [
    ['netflix', /^netflix$/, /netflix/i, ['#0A0A0A', '#000000']],
    ['youtube', /youtube/, /^youtube$/i, ['#1C1C1E', '#09090A']],
    ['prime', /^amazon$/, /prime video|amazon/i, ['#2AA8FF', '#0A68D4']],
    ['disney', /disney/, /disney/i, ['#173584', '#08143F']],
    ['max', /hbo|wbd/, /^(hbo )?max$|hbo max/i, ['#5C30E8', '#221684']],
    ['appletv', /appletv|apple\.tv/, /apple tv/i, ['#1C1C1E', '#000000']],
    ['hulu', /^hulu/, /hulu/i, ['#1CE783', '#0B8F4E']],
    ['paramount', /paramount|cbs/, /paramount/i, ['#0064FF', '#002A86']],
    ['peacock', /peacock/, /peacock/i, ['#1C1C1E', '#000000']],
    ['nfl', /nfl/, /^nfl/i, ['#013369', '#00163D']],
    ['globoplay', /globoplay/, /globoplay/i, ['#FF8A1F', '#FF2D5A']],
    ['jellyfin', /jellyfin/i, /jellyfin/i, ['#AA5CC3', '#00A4DC']],
    ['spotify', /spotify/, /spotify/i, ['#1DB954', '#0F7A36']],
    // Free My TV+: weitere Apps fuer die Leiste
    ['twitch', /twitch/i, /twitch/i, ['#9146FF', '#5A1FCC']],
    ['wow', /\.(wow|skyticket|skygo)/i, /^(wow|sky( ticket| go)?)$/i, ['#1F4FD1', '#0A2A8A']],
    ['hdplus', /hdplus|hd\+/i, /hd\+|hd plus/i, ['#0058A3', '#00305E']],
    ['tvplus', /tvplus/i, /tv plus/i, ['#3F3FA0', '#1E1E5C']],
    ['zdf', /zdf/i, /^zdf/i, ['#FA7D19', '#C2560A']],
    ['ard', /ardmediathek|\.ard\b/i, /^ard/i, ['#00327D', '#001A42']],
    ['joyn', /joyn/i, /joyn/i, ['#E6007E', '#8A0050']],
    ['rtl', /rtl/i, /^rtl/i, ['#FA002E', '#9A001C']],
    ['dazn', /dazn/i, /dazn/i, ['#2A2A2A', '#0A0A0A']]
  ];
  // Apps shown at once, as on Android: 8 (today's smallest tiles, 178 wide); the shelf scrolls for the rest. The
  // built-in list keeps 8 too.
  var SHELF_VISIBLE = 9, FEW_APPS = 12;
  // Free My TV+: quadratische Glas-Kacheln, die fokussierte wird breit (rechteckig)
  var TILE = 126, TILE_WIDE = 210, TILE_GAP = 56;

  function shelfKey(app) {
    for (var i = 0; i < SHELF.length; i++) if (SHELF[i][1].test(app.id) || SHELF[i][2].test(app.title)) return SHELF[i];
    return null;
  }

  function darken(hex, f) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#161618';
    var n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 'rgb(' + Math.round(r * f) + ',' + Math.round(g * f) + ',' + Math.round(b * f) + ')';
  }

  /** A name that fits the tile on one line (the font shrinks for long names). */
  function wordFit(title, width, max) {
    return Math.max(18, Math.min(max, Math.floor(width * 0.8 / (Math.max(4, title.length) * 0.56))));
  }

  // MARK: - Logos

  // The TV's icons are small squares with their own background (white behind Netflix, black behind Max). Like the
  // Android app does with the TV art, the logo is lifted off it once: the background goes transparent and the rest is
  // cropped to the logo, which then fills the tile on the brand's color.
  var lifted = {};   // icon url -> {src, bg: [r, g, b], ink: luminance histogram} or false (keep the icon as it is)
  var LIFT_SIZE = 240;

  // sRGB (0-255) to linear light, computed once: lift() needs it for every pixel, and old TVs are slow at Math.pow.
  var LINEAR = [];
  for (var li = 0; li < 256; li++) LINEAR[li] = li <= 10 ? li / 255 / 12.92 : Math.pow((li / 255 + 0.055) / 1.055, 2.4);

  /** Relative luminance (0-1) of an sRGB color (whole numbers, as read from the canvas). */
  function luminance(r, g, b) {
    return 0.2126 * LINEAR[r] + 0.7152 * LINEAR[g] + 0.0722 * LINEAR[b];
  }

  function rgbOf(color) {
    var m = /^#?([0-9a-f]{6})$/i.exec(color || '');
    if (m) { var n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(color || '');
    return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0];
  }

  function lift(img) {
    var w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return false;
    var f = Math.min(1, LIFT_SIZE / Math.max(w, h));
    w = Math.max(1, Math.round(w * f));
    h = Math.max(1, Math.round(h * f));
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var g = canvas.getContext('2d');
    var data;
    try {
      g.drawImage(img, 0, 0, w, h);
      data = g.getImageData(0, 0, w, h);
    } catch (e) {
      return false;   // a TV that doesn't let the page read its icons
    }
    var px = data.data;
    // The background: the most common color a little inside the edges (rounded icons have transparent corners).
    var votes = {}, best = null, bestN = 0, inset = Math.round(Math.min(w, h) * 0.08);
    for (var s = 0; s < 64; s++) {
      var t = s % 16 / 16, side = s >> 4;
      var x = side < 2 ? Math.round(inset + t * (w - 2 * inset)) : side === 2 ? inset : w - 1 - inset;
      var y = side < 2 ? (side === 0 ? inset : h - 1 - inset) : Math.round(inset + t * (h - 2 * inset));
      var i = (y * w + x) * 4;
      var key = px[i + 3] < 128 ? 'clear' : (px[i] >> 4) + ',' + (px[i + 1] >> 4) + ',' + (px[i + 2] >> 4);
      votes[key] = (votes[key] || 0) + 1;
      if (votes[key] > bestN) { bestN = votes[key]; best = key === 'clear' ? null : [px[i], px[i + 1], px[i + 2]]; }
    }
    var minX = w, minY = h, maxX = -1, maxY = -1, ink = [0, 0, 0, 0, 0, 0, 0, 0], inkSum = 0;
    for (var p = 0; p < w * h; p++) {
      var j = p * 4, a = px[j + 3] / 255;
      if (best) {
        // color to alpha: how far each channel is from the background, as a share of how far it could go, so the
        // anti-aliased edges come out as the logo's color, partly clear, without a fringe of the background
        var k = 0, c;
        for (c = 0; c < 3; c++) {
          var v = px[j + c], o = best[c];
          k = Math.max(k, v > o ? (v - o) / Math.max(1, 255 - o) : (o - v) / Math.max(1, o));
        }
        k = Math.max(0, Math.min(1, (k - 0.1) / 0.9));   // compression noise stays clear
        if (k > 0 && k < 1) {
          for (c = 0; c < 3; c++) px[j + c] = Math.max(0, Math.min(255, best[c] + (px[j + c] - best[c]) / k));
        }
        a *= k;
      }
      px[j + 3] = Math.round(a * 255);
      if (a > 0.3) {
        var px0 = p % w, py0 = (p / w) | 0;
        if (px0 < minX) minX = px0;
        if (px0 > maxX) maxX = px0;
        if (py0 < minY) minY = py0;
        if (py0 > maxY) maxY = py0;
        ink[Math.min(7, Math.floor(Math.sqrt(luminance(px[j], px[j + 1], px[j + 2])) * 8))] += a;
        inkSum += a;
      }
    }
    // Nothing left, or nothing taken away (a picture rather than a logo on a background): keep the icon.
    if (maxX < 0 || (maxX - minX > w * 0.96 && maxY - minY > h * 0.96)) return false;
    var crop = document.createElement('canvas');
    crop.width = maxX - minX + 1;
    crop.height = maxY - minY + 1;
    g.putImageData(data, 0, 0);
    crop.getContext('2d').drawImage(canvas, minX, minY, crop.width, crop.height, 0, 0, crop.width, crop.height);
    for (var b = 0; b < 8; b++) ink[b] /= inkSum;
    try {
      return {src: crop.toDataURL('image/png'), bg: best, ink: ink};
    } catch (e2) {
      return false;
    }
  }

  /**
   * Share of the logo that hardly shows on a tile of this luminance (YouTube's black type on a dark tile). Each bin
   * of the histogram holds the ink whose square-root luminance falls in it.
   */
  function unseen(ink, tileLum) {
    var share = 0;
    for (var b = 0; b < 8; b++) {
      var l = Math.pow((b + 0.5) / 8, 2);
      if ((Math.max(l, tileLum) + 0.05) / (Math.min(l, tileLum) + 0.05) < 1.8) share += ink[b];
    }
    return share;
  }

  function paint(box, top, bottom) {
    box.style.background = '-webkit-linear-gradient(top, ' + top + ', ' + bottom + ')';
    box.style.background = 'linear-gradient(' + top + ', ' + bottom + ')';
  }

  /** A color that is clearly a hue (Crunchyroll's orange), not black, white or a gray. */
  function colorful(rgb) {
    return Math.max(rgb[0], rgb[1], rgb[2]) - Math.min(rgb[0], rgb[1], rgb[2]) >= 96;
  }

  /**
   * The logo's box in its own proportions, as large as object-fit: contain draws it. Chrome 38 (webOS 3) ignores
   * object-fit while a tile next to it animates, and the logo stretched to its 70% x 50% box until the move ended.
   * Not laid out yet (a closed sheet): object-fit stays, and fitLogos() runs when the sheet opens.
   */
  function fitLogo(img) {
    var box = img.parentNode, bw = img.offsetWidth, bh = img.offsetHeight, nw = img.naturalWidth, nh = img.naturalHeight;
    if (!box || !bw || !bh || !nw || !nh || img.style.width) return;
    var s = Math.min(bw / nw, bh / nh);
    img.style.width = nw * s / box.offsetWidth * 100 + '%';
    img.style.height = nh * s / box.offsetHeight * 100 + '%';
  }

  function fitLogos(root) {
    var imgs = root.querySelectorAll('img.logo');
    for (var i = 0; i < imgs.length; i++) if (imgs[i].complete) fitLogo(imgs[i]);
  }

  /** own: the tile has the TV's color for the app, not one of SHELF's. */
  function showLogo(img, box, top, bottom, logo, own) {
    img.className = 'logo';
    img.onload = function () { img.onload = null; fitLogo(img); };
    img.src = logo.src;
    if (img.complete) fitLogo(img);
    var a = rgbOf(top), z = rgbOf(bottom);
    var tileLum = (luminance(a[0], a[1], a[2]) + luminance(z[0], z[1], z[2])) / 2;
    // The tile takes the icon's background when the logo only reads on it, and when that background is the brand's
    // color: LG's bgColor isn't always the icon's (Crunchyroll's is black, on an orange icon).
    if (logo.bg && ((own && colorful(logo.bg)) || unseen(logo.ink, tileLum) > 0.35)) {
      var bg = 'rgb(' + logo.bg.join(',') + ')';
      var hex = '#' + ((1 << 24) | (logo.bg[0] << 16) | (logo.bg[1] << 8) | logo.bg[2]).toString(16).slice(1);
      paint(box, bg, darken(hex, 0.93));
    }
  }

  /** An app's face: its logo on its brand color (or its name, when the icon can't be read). */
  function face(app, box, wordSize) {
    var k = shelfKey(app);
    var top = k ? k[3][0] : app.color ? darken(app.color, 0.92) : '#2A2A2E';
    var bottom = k ? k[3][1] : app.color ? darken(app.color, 0.62) : '#161618';
    paint(box, top, bottom);
    var word = el('div', 'word', box, app.title);
    if (wordSize) word.style.fontSize = wordSize + 'px';
    if (app.icon) {
      var img = el('img', '', box), url = app.icon;
      word.style.visibility = 'hidden';
      img.onerror = function () { if (img.parentNode) img.parentNode.removeChild(img); word.style.visibility = ''; };
      if (lifted[url]) { showLogo(img, box, top, bottom, lifted[url], !k); return; }
      if (lifted[url] !== false) {
        img.onload = function () {
          img.onload = null;
          if (lifted[url] === undefined) lifted[url] = lift(img);
          if (lifted[url]) showLogo(img, box, top, bottom, lifted[url], !k);
        };
      }
      img.src = url;
    }
  }

  var apps = [], shelf = [], others = [], inputs = [];

  /** shelf_apps in config.properties: the shelf in that order, by id or name (part of it). */
  var WANTED = (CONFIG.shelfApps || []).map(function (s) { return s.toLowerCase(); });

  function pickShelf() {
    if (WANTED.length && Prefs.shelfConfig() !== WANTED.join(',')) {
      Prefs.set('shelf', null);
      Prefs.set('shelfConfig', WANTED.join(','));
    }
    var chosen = Prefs.shelf(), out = [];
    if (chosen) {
      for (var i = 0; i < chosen.length; i++) {
        for (var j = 0; j < apps.length; j++) if (apps[j].id === chosen[i]) out.push(apps[j]);
      }
    } else if (WANTED.length) {
      for (var w = 0; w < WANTED.length; w++) {
        for (var k = 0; k < apps.length; k++) {
          var id = apps[k].id.toLowerCase(), title = apps[k].title.toLowerCase();
          if ((id.indexOf(WANTED[w]) >= 0 || title.indexOf(WANTED[w]) >= 0) && out.indexOf(apps[k]) < 0) { out.push(apps[k]); break; }
        }
      }
      if (!out.length) out = apps.slice(0, FEW_APPS);
    } else {
      for (var s = 0; s < SHELF.length && out.length < FEW_APPS; s++) {
        for (var a = 0; a < apps.length; a++) {
          if ((SHELF[s][1].test(apps[a].id) || SHELF[s][2].test(apps[a].title)) && out.indexOf(apps[a]) < 0) { out.push(apps[a]); break; }
        }
      }
      if (!out.length) out = apps.slice(0, FEW_APPS);
    }
    shelf = out;
    others = apps.filter(function (x) { return shelf.indexOf(x) < 0; });
  }

  // MARK: - Focus

  var Z = {TOP: 'top', CARDS: 'cards', SHELF: 'shelf', DRAWER: 'drawer', APPS: 'apps', SETTINGS: 'settings', EDIT: 'edit', LANG: 'lang', CITY: 'city', ABOUT: 'about'};
  var st = {zone: Z.SHELF, top: 0, tab: 0, card: 0, shelf: 0, drawer: 0, grid: 0, row: 0, edit: 0, lang: 0, city: 0};
  var cards = [];

  function sheetOpen() { return st.zone === Z.APPS || st.zone === Z.SETTINGS || st.zone === Z.EDIT || st.zone === Z.LANG || st.zone === Z.CITY || st.zone === Z.ABOUT; }

  function updateFocus() {
    var i, list;
    list = $('tabs').children;
    for (i = 0; i < list.length; i++) {
      setClass(list[i], 'on', i === st.tab);
      setClass(list[i], 'focus', st.zone === Z.TOP && st.top === i);
    }
    list = $('buttons').children;
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.TOP && st.top === 3 + i);
    setClass($('quotes'), 'hide', st.zone === Z.TOP && st.top >= 3);
    list = $('cards').children;
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.CARDS && st.card === i);
    list = $('tiles').children;
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.SHELF && st.shelf === i);
    if (list.length) placeTiles();
    revealShelf();
    list = document.querySelectorAll('#drawer .key');
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.DRAWER && st.drawer === i && !st.wxFocus);
    setClass($('weather'), 'focus', st.zone === Z.DRAWER && !!st.wxFocus);
    legend();
    list = document.querySelectorAll('#apps .cell');
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.APPS && st.grid === i);
    var rows = Math.max(1, Math.ceil(others.length / 5)), r = Math.floor(st.grid / 5), first = Math.max(0, Math.min(rows - 3, r - 1));
    $('apps').lastChild.style.webkitTransform = $('apps').lastChild.style.transform = 'translateY(' + (-first * 239) + 'px)';
    focusRows($('settings'), st.row, st.zone === Z.SETTINGS);
    focusRows($('shelfedit'), st.edit, st.zone === Z.EDIT);
    focusRows($('langpick'), st.lang, st.zone === Z.LANG);
    if (langHint) langHint.textContent = (st.lang + 1) + ' / ' + languageChoices().length + '  ·  ' + tr('OK picks, Back cancels.');
    focusRows($('citypick'), st.city, st.zone === Z.CITY);
    setClass(body, 'drawer-open', st.zone === Z.DRAWER);
    if (typeof syncLive === 'function' && cards) syncLive();
  }

  function focusRows(sheet, index, on) {
    var rows = sheet.querySelectorAll('.row');
    for (var i = 0; i < rows.length; i++) setClass(rows[i], 'focus', on && i === index);
    var holder = sheet.querySelector('.rows');
    if (!holder) return;
    var visible = 7, first = Math.max(0, Math.min(rows.length - visible, index - 3));
    holder.style.webkitTransform = holder.style.transform = 'translateY(' + (-first * 78) + 'px)';
  }

  function nearest(nodes, x) {
    var best = 0, bestD = 1e9;
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect(), d = Math.abs((r.left + r.right) / 2 - x);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function centerX(node) {
    if (!node) return 960;
    var r = node.getBoundingClientRect();
    return (r.left + r.right) / 2;
  }

  // MARK: - Top: title, tabs, buttons, quotes

  var TAB_KIND = [null, 'movie', 'tv'];

  function renderTop() {
    renderTitle();
    var tabs = $('tabs');
    tabs.innerHTML = '';
    var names = ['Jetzt im TV', 'Welt-TV', 'News'];   // Free My TV+: Sat-Programm, Welt-TV, Cybersecurity
    for (var i = 0; i < 3; i++) {
      var t = el('button', 'tab', tabs, names[i]);
      hover(t, Z.TOP, i);
    }
    var buttons = $('buttons');
    buttons.innerHTML = '';
    var defs = [['live_tv', tr('light|Live TV')], ['hdmi', tr('HDMI Inputs')], ['settings', tr('light|Settings')]];
    for (var b = 0; b < 3; b++) {
      var r = el('button', 'round' + (b === 2 ? ' last' : ''), buttons);
      r.style.left = (1596 + 88 * b) + 'px';
      sym(defs[b][0], r);
      el('div', 'tip', r, defs[b][1]);
      hover(r, Z.TOP, 3 + b);
    }
  }

  // Free My TV+: statt der Kryptokurse eine Cybersecurity-Schlagzeile, die alle 10 Sekunden wechselt.
  var tickerIndex = 0, tickerTimer = 0;
  function renderQuotes() {
    var q = $('quotes'), list = Plus.news();
    clearTimeout(tickerTimer);
    q.innerHTML = '';
    if (!Prefs.quotes() || !list.length) return;
    var it = list[tickerIndex % list.length];
    var item = el('span', 'q news', q);
    el('span', 'dot', item);
    el('span', 'src', item, it.source);
    el('span', 'hl', item, it.title);
    tickerTimer = setTimeout(function () { tickerIndex++; renderQuotes(); }, 10000);
  }

  // MARK: - Picks and background

  // Free My TV+: die Karten kommen aus Plus.cards: Livebild + EPG, Welt-TV-Sender oder Cybersecurity-Schlagzeilen.
  // Free My TV+: Karten 500 hoch (das Livebild ist groesser), eine Karte kann ihr eigenes Rechteck mitbringen
  var CARD_RECTS = [[80, 262, 1040, 500], [1160, 262, 320, 500], [1520, 262, 320, 500]];
  // Free My TV+ 1.4: das Livebild oben in der Livekarte [80, 270, 920, 500], darunter 60 px Bauchbinde
  var LIVE_RECT = [80, 270, 920, 440];
  var cardRects = [];
  var cardHooks = {
    fullTV: function () { var live = liveTV(); if (live) launcher(live.id, tr('Live TV'))(); else TV.launch('org.tizen.tv-viewer', null, function () {}); },
    toast: function (t) { toast(t); },
    watch: function () { idleAt = Date.now(); setTimeout(function () { if (!tvFull) enterFull(); }, 50); }   // Programmfuehrer: "Programm ansehen"
  };

  function renderCards() {
    var list = Plus.cards(st.tab, cardHooks);
    var holder = $('cards');
    setClass(body, 'no-picks', !list.length);
    var same = list.length === cards.length;
    for (var i = 0; same && i < list.length; i++) same = list[i].id === cards[i].id && list[i].title === cards[i].title && list[i].meta === cards[i].meta && list[i].text === cards[i].text && list[i].kicker === cards[i].kicker;
    if (same && holder.children.length === list.length) { syncLive(); return; }
    cards = list;
    holder.innerHTML = '';
    cardRects = [];
    for (var c = 0; c < list.length; c++) {
      var p = list[c], card = el('div', 'card' + (p.inside ? ' inside' : '') + (p.mini ? ' mini' : '') + (p.plain ? ' plain' : '') +
        (p.flat ? ' flat' : '') + (p.switcher ? ' switcher' + (Plus.zapMode() ? ' zapping' : '') : '') + (p.image ? ' pic' : '') + (p.news ? ' newscard' : ''), holder);
      var rc = p.rect || CARD_RECTS[Math.min(c, 2)];
      cardRects.push(rc);
      card.style.left = rc[0] + 'px';
      card.style.top = rc[1] + 'px';
      card.style.width = rc[2] + 'px';
      card.style.height = rc[3] + 'px';
      var img = el('div', 'img', card);
      if (p.live) {
        setClass(img, 'live', true);
        setClass(card, 'livecard', true);
        el('div', 'onair', img, 'LIVE');
        el('div', 'nolive', img, 'Livebild');
        // Free My TV+ 1.4: Sender und Sendung als Bauchbinde im Rahmen des Livebilds (das TV-Bild liegt ueber der Seite)
        var low = el('div', 'lower', card);
        el('span', 'lt', low, p.title);
        if (p.meta) el('span', 'lm', low, p.meta);
      } else if (p.logo) {
        setClass(img, 'logo', true);
        var lg = el('img', '', img);
        lg.src = p.logo;
        lg.onerror = function () { this.style.display = 'none'; };
      } else if (p.draw) {
        setClass(img, 'text', true);
        p.draw(img);
      } else {
        setClass(img, p.news ? 'text news' : 'text', true);
        if (p.image) {   // Free My TV+: Bild der Sendung oder des Artikels, unten abgedunkelt fuer die Schrift
          img.style.backgroundImage = '-webkit-linear-gradient(top, rgba(0, 0, 0, 0) 30%, rgba(0, 0, 0, 0.78)), url("' + p.image + '")';
          img.style.backgroundImage = 'linear-gradient(rgba(0, 0, 0, 0) 30%, rgba(0, 0, 0, 0.78)), url("' + p.image + '")';
        }
        if (p.centered) {
          var bg = el('div', 'big', img);
          if (p.icon) sym(p.icon, bg, 36);
          bg.appendChild(document.createTextNode(p.text || p.title));
        } else {
          if (p.icon) sym(p.icon, img, c === 0 ? 72 : 56);
          if (p.kicker) el('div', 'kicker', img, p.kicker);
          el('div', 'big', img, p.text || p.title);
        }
      }
      if (p.centered) setClass(card, 'centered', true);
      if ((p.title || !p.plain) && !p.live) {
        var nm = el('div', 'name', card, p.title);
        if (!p.inside) nm.style.top = (rc[3] + 14) + 'px';
        if (c === 0 && p.meta && !p.inside) el('span', 'm', nm, p.meta);
      }
      hover(card, Z.CARDS, c);
    }
    st.card = Math.min(st.card, Math.max(0, list.length - 1));
    if (!list.length && st.zone === Z.CARDS) st.zone = Z.SHELF;
    backdrop('');
    updateFocus();
  }

  /** Das Livebild in der grossen Karte: nur sichtbar, wenn sie es ist (kein Menue, keine Schublade, kein Bildschirmschoner). */
  // Free My TV+ 1.5: nach der Schublade kommt das Livebild 0,75 s spaeter, nach Programmfuehrer und Senderliste 0,25 s,
  // damit zuerst die Oberflaeche steht
  var liveWas = {drawer: false, plus: false}, liveDelay = 0, liveTimer = 0;
  function syncLive() {
    var show = st.tab === 0 && cards[0] && cards[0].live && !sheetOpen() && st.zone !== Z.DRAWER && !saverOn &&
      !Plus.isOpen() && !document.hidden;
    if (Plus.morphing()) return;
    if (show && !tvFull) {
      if (liveWas.drawer) liveDelay = Date.now() + 250;   // 1.6: 0,25 s wie nach dem Programmfuehrer
      else if (liveWas.plus) liveDelay = Date.now() + 250;
    }
    liveWas.drawer = st.zone === Z.DRAWER;
    liveWas.plus = Plus.isOpen();
    if (show && Date.now() < liveDelay) {
      Plus.live(null);
      clearTimeout(liveTimer);
      liveTimer = setTimeout(syncLive, liveDelay - Date.now() + 10);
      return;
    }
    if (tvFull && show) { Plus.live([0, 0, 1920, 1080]); return; }
    // Free My TV+ 1.3: ueber Menues und Suche wandert das Fernsehbild klein nach rechts unten
    if (!show && !saverOn && !document.hidden && Plus.isOpen() && Plus.cornerOk()) { Plus.live(Plus.cornerRect()); return; }
    Plus.live(show ? LIVE_RECT : null);
  }

  // Free My TV+ 1.5: 20 Sekunden keine Taste, dann waechst das Livebild in 3 Sekunden stufenlos zum Vollbild, waehrend die
  // Oberflaeche ausdimmt. Eine Taste dimmt sie in 1 Sekunde wieder auf und zieht das Bild zurueck in die Vorschau.
  var tvFull = false, tvTimer = null, IDLE_FULL = 20000;
  function tvClass(full, going, back) {
    setClass(body, 'tvgoing', going);
    setClass(body, 'tvback', back);
    setClass(body, 'tvfull', full);
  }
  // 1.6: der Videoplan des Fernsehers laesst sich nicht fluessig vergroessern (jeder Schritt ruckelt). Deshalb waechst
  // jetzt ein schwarzer Rahmen per GPU stufenlos von der Vorschau zum Vollbild, die Oberflaeche blendet dabei aus, und erst
  // am Ende springt das Bild in einem einzigen Schritt auf Vollbild. Zurueck genauso, nur andersherum.
  var ZOOM_IN = 1200, ZOOM_OUT = 800;
  function zoomFrame() {
    var z = $('zoomframe');
    if (!z) {
      z = el('div', '', stage);
      z.id = 'zoomframe';
      z.style.left = LIVE_RECT[0] + 'px'; z.style.top = LIVE_RECT[1] + 'px';
      z.style.width = LIVE_RECT[2] + 'px'; z.style.height = LIVE_RECT[3] + 'px';
    }
    return z;
  }
  function zoomTo(full, ms) {
    var z = zoomFrame(), t = full ? 'translate(' + (-LIVE_RECT[0]) + 'px, ' + (-LIVE_RECT[1]) + 'px) scale(' +
      (1920 / LIVE_RECT[2]).toFixed(4) + ', ' + (1080 / LIVE_RECT[3]).toFixed(4) + ')' : 'none';
    z.style.webkitTransitionDuration = z.style.transitionDuration = ms + 'ms';
    z.style.webkitTransform = z.style.transform = t;
  }
  function enterFull() {
    tvFull = true;
    clearTimeout(tvTimer);
    document.documentElement.style.background = 'transparent';
    var z = zoomFrame();
    zoomTo(false, 0);
    setClass(z, 'on', true);
    void z.offsetWidth;   // Startgroesse festhalten, dann wachsen
    tvClass(false, true, false);
    legend();
    zoomTo(true, ZOOM_IN);
    tvTimer = setTimeout(function () {
      if (!tvFull) return;
      Plus.live([0, 0, 1920, 1080]);   // ein einziger Sprung, wenn der Rahmen schon voll ist
      tvClass(true, false, false);
    }, ZOOM_IN);
  }
  function leaveFull() {
    tvFull = false;
    clearTimeout(tvTimer);
    var z = zoomFrame();
    var show = st.tab === 0 && cards[0] && cards[0].live && !sheetOpen() && st.zone !== Z.DRAWER && !Plus.isOpen();
    if (show) Plus.live(LIVE_RECT); else syncLive();   // das Bild sofort zurueck in die Vorschau, der Rahmen zieht nach
    setClass(z, 'on', true);
    zoomTo(false, ZOOM_OUT);
    tvClass(false, false, true);
    checkNight();
    legend();
    tvTimer = setTimeout(function () { setClass(body, 'tvback', false); setClass(z, 'on', false); syncLive(); }, ZOOM_OUT + 60);
  }
  setInterval(function () {
    if (tvFull || saverOn || document.hidden) return;
    var can = st.tab === 0 && cards[0] && cards[0].live && body.className.indexOf('liveon') >= 0 && !sheetOpen() &&
      st.zone !== Z.DRAWER && !Plus.isOpen() && !moving;
    if (can && Date.now() - idleAt > IDLE_FULL) enterFull();
  }, 1000);

  /** Der Rahmen um das Livebild (#hole) passend zum Rechteck der Livekarte. */
  (function placeHole() {
    var x = LIVE_RECT[0], y = LIVE_RECT[1], w = LIVE_RECT[2], h = LIVE_RECT[3], parts = $('hole') ? $('hole').children : [];
    var boxes = {t: [0, 0, 1920, y], l: [0, y, x, h], r: [x + w, y, 1920 - x - w, h], b: [0, y + h, 1920, 1080 - y - h]};
    for (var i = 0; i < parts.length; i++) {
      var b = boxes[parts[i].className];
      if (!b) continue;
      parts[i].style.left = b[0] + 'px'; parts[i].style.top = b[1] + 'px';
      parts[i].style.width = b[2] + 'px'; parts[i].style.height = b[3] + 'px';
      parts[i].style.backgroundPosition = (-b[0]) + 'px ' + (-b[1]) + 'px';
    }
  })();

  /** Free My TV+: Karten raeumlich ansteuern (Welt-TV hat zwei Reihen). -1 = keine in dieser Richtung. */
  function cardToward(dx, dy) {
    var a = cardRects[st.card];
    if (!a) return -1;
    var ax = a[0] + a[2] / 2, ay = a[1] + a[3] / 2, best = -1, bestScore = 1e9;
    for (var i = 0; i < cardRects.length; i++) {
      if (i === st.card) continue;
      var b = cardRects[i], bx = b[0] + b[2] / 2, by = b[1] + b[3] / 2;
      var ok = dx > 0 ? b[0] >= a[0] + a[2] - 4 : dx < 0 ? b[0] + b[2] <= a[0] + 4 : dy > 0 ? b[1] >= a[1] + a[3] - 4 : b[1] + b[3] <= a[1] + 4;
      if (!ok) continue;
      var main = dx ? Math.abs(bx - ax) : Math.abs(by - ay), side = dx ? Math.abs(by - ay) : Math.abs(bx - ax);
      var score = main + side * 2;
      if (score < bestScore) { bestScore = score; best = i; }
    }
    return best;
  }
  // Das Livebild liegt bei Samsung unter der Seite: solange es laeuft, ist der Hintergrund dort ausgespart (#hole).
  Plus.onLive(function (on) { setClass(body, 'liveon', on); });

  var bgUrl = null, bgFront = 'bgA';

  /** The first pick's photo as the background: drawn tiny and stretched, it's already as soft as a heavy blur. */
  function backdrop(url) {
    if (url === bgUrl) return;
    bgUrl = url;
    var next = bgFront === 'bgA' ? 'bgB' : 'bgA';
    if (!url) {
      setClass($('bgA'), 'on', false);
      setClass($('bgB'), 'on', false);
      return;
    }
    var img = new Image();
    img.onload = function () {
      if (bgUrl !== url) return;
      var canvas = $(next), ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setClass(canvas, 'on', true);
      setClass($(bgFront), 'on', false);
      bgFront = next;
    };
    img.src = url;
  }

  /** Free My TV+: oben links Uhrzeit, Wettersymbol und Datum (statt "Für dich"). */
  function renderTitle() {
    var t = $('title'), d = new Date(), w = Data.weather;
    if (!t) return;
    t.innerHTML = '';
    el('span', 'tclock', t, formatDate('format|h:mm', d.getTime()));
    if (w) sym(Data.symbol(w.code, w.isDay), t, 62).className += ' tsym';
    el('span', 'tdate', t, formatDate('format|EEEE, MMMM d', d.getTime()));
  }

  function renderClock() {
    renderTitle();
    renderDrawerHead();
    var d = new Date(), c = $('clock');
    c.firstChild.textContent = formatDate('format|h:mm', d.getTime());
    c.lastChild.textContent = formatDate('format|EEEE, MMMM d', d.getTime());
  }

  /** On the minute, so the clock never runs late (the 30-second refresh could, by up to 30 s). */
  function tickClock() {
    renderClock();
    setTimeout(tickClock, 60000 - Date.now() % 60000 + 50);
  }

  // MARK: - Shelf

  var shelfFirst = 0, tileStep = 0, tileLeft = 0;

  function renderShelf() {
    var n = Math.min(shelf.length, SHELF_VISIBLE), gap = TILE_GAP, pad = 40;
    var tw = TILE, th = TILE;
    // Free My TV+ 1.3: die Leiste so breit wie die Kacheln darueber (80 bis 1840), die breite Kachel ragt nie hinaus
    var spread = Math.round(TILE * 0.08), inner = 1760 - 2 * pad - 2 * spread;
    gap = n > 1 ? (inner - n * tw) / (n - 1) : 0;
    var width = 1760 - 2 * pad, left = 80 + pad;
    var platter = $('platter');
    platter.style.display = n ? '' : 'none';
    platter.style.left = (left - pad) + 'px';
    platter.style.width = (width + 2 * pad) + 'px';
    platter.style.top = (814 + 126 - th) + 'px';
    platter.style.height = (th + 2 * pad) + 'px';
    $('quotes').style.right = (1920 - left - width) + 'px';
    var tiles = $('tiles');
    tiles.innerHTML = '';
    tileStep = tw + gap;
    tileLeft = left + spread;
    shelfFirst = Math.max(0, Math.min(shelfFirst, shelf.length - n));
    for (var i = 0; i < shelf.length; i++) {
      var t = el('div', 'tile glass', tiles);
      t.style.top = (854 + 126 - th) + 'px';
      t.style.width = tw + 'px';
      t.style.height = th + 'px';
      face(shelf[i], t, wordFit(shelf[i].title, tw, 22));
      el('div', 'refr', t);   // Free My TV+: das Holz der Leiste, durch das Glas verzerrt
      hover(t, Z.SHELF, i);
    }
    // More apps than fit: a small arrow inside the glass's edge on each side that has more, where no tile reaches
    // even focused (inside the screen's safe area, as on Android).
    platter.innerHTML = '';
    for (var a = 0; a < 2; a++) {
      var arrow = sym('chevron_right', platter);
      arrow.className += a ? ' more' : ' more back';
      arrow.style.left = (a ? width + 2 * pad - 14 : 14) - 8.5 + 'px';
      arrow.style.top = (pad + th / 2 - 8.5) + 'px';
    }
    st.shelf = Math.min(st.shelf, Math.max(0, shelf.length - 1));
    placeTiles();
  }

  /** Free My TV+: jede Glaskachel zeigt das Holz hinter sich vergroessert und versetzt, wie durch einen Glaswuerfel. */
  // Free My TV+ 1.4: das Holz kommt einmal als CSS-Regel (nicht als Riesen-Bildadresse auf jeder Kachel bei jedem Schritt)
  var woodRule = '', lastRefr = [];
  function refract() {
    var tiles = $('tiles').children, wood = Plus.wood(), pl = $('platter');
    if (!wood || !pl) return;
    var px = parseFloat(pl.style.left) || 0, py = parseFloat(pl.style.top) || 0, pw = parseFloat(pl.style.width) || 1760, ph = parseFloat(pl.style.height) || 200;
    var zoom = 1.18, rule = pw + 'x' + ph;
    if (woodRule !== rule) {
      woodRule = rule;
      var css = $('woodcss') || el('style', '', document.head);
      css.id = 'woodcss';
      css.textContent = '#platter{background-image:url(' + wood + ')}.tile.glass .refr{background-image:url(' + wood + ');background-size:' +
        (pw * zoom) + 'px ' + (ph * zoom) + 'px}';
      lastRefr = [];
    }
    var n = Math.min(shelf.length, SHELF_VISIBLE);
    for (var i = 0; i < tiles.length; i++) {
      if (i < shelfFirst - 1 || i > shelfFirst + n) continue;   // unsichtbare Kacheln nicht anfassen
      var r = tiles[i].lastChild;
      if (!r || r.className !== 'refr') continue;
      var x = tileLeft + (i - shelfFirst) * tileStep - px, y = parseFloat(tiles[i].style.top) - py, w = TILE;
      // Linse: vergroessert um die Kachelmitte, dazu leicht gegen die Bewegung versetzt (Brechung)
      var cx = x + w / 2, cy = y + TILE / 2;
      var pos = Math.round(-(cx * zoom - w / 2) + (cx - pw / 2) * 0.06) + 'px ' + Math.round(-(cy * zoom - TILE / 2)) + 'px';
      if (lastRefr[i] !== pos) { lastRefr[i] = pos; r.style.backgroundPosition = pos; }
    }
  }

  /** The row slides (a transform on #tiles, which old TVs animate), and the apps it takes past the glass fade out. */
  function placeTiles() {
    var row = $('tiles'), tiles = row.children, n = Math.min(shelf.length, SHELF_VISIBLE);
    // Free My TV+ 1.4: Glaswuerfel bleiben quadratisch, der Fokus vergroessert nur per transform (GPU, kein Layout)
    for (var i = 0; i < shelf.length; i++) {
      var shown = i >= shelfFirst && i < shelfFirst + n, s = tiles[i].style;
      var left = (tileLeft + i * tileStep) + 'px', op = shown ? '' : '0';
      if (s.left !== left) s.left = left;
      if (s.opacity !== op) { s.opacity = op; s.pointerEvents = shown ? '' : 'none'; }
    }
    row.style.webkitTransform = row.style.transform = 'translateX(' + (-shelfFirst * tileStep) + 'px)';
    refract();
    var arrows = $('platter').children;
    arrows[0].style.visibility = shelfFirst > 0 ? '' : 'hidden';
    arrows[1].style.visibility = shelfFirst + n < shelf.length ? '' : 'hidden';
  }

  /** Scrolls the shelf, one app at a time, so the focused app is shown. */
  function revealShelf() {
    var n = Math.min(shelf.length, SHELF_VISIBLE);
    // Free My TV+ 1.3: ab etwa 60 % der Leiste wandern die Kacheln mit, erst am Ende laeuft der Fokus bis ganz nach rechts
    var first = Math.max(0, Math.min(st.shelf - Math.floor(n * 0.6), shelf.length - n));
    if (first === shelfFirst || !shelf.length) return;
    shelfFirst = first;
    placeTiles();
  }

  // MARK: - Drawer

  var drawerItems = [], drawerInputs = 0;

  function renderDrawer() {
    var d = $('drawer');
    d.innerHTML = '';
    drawerItems = [];
    for (var i = 0; i < inputs.length; i++) {
      var x = inputs[i];
      drawerItems.push({label: x.label || tr('Live TV'), symbol: x.symbol, off: !x.connected, run: launcher(x.id, x.label)});
    }
    drawerInputs = drawerItems.length;
    drawerItems.push({label: tr('All Apps'), symbol: 'apps', run: openApps});
    drawerItems.push({label: tr('Home Settings'), symbol: 'settings', run: openSettings});
    drawerItems.push({label: 'Mediaplayer', symbol: 'play', run: function () { Plus.openMedia(); updateFocus(); }});
    drawerItems.push({label: 'Werbefrei', symbol: 'shield', run: function () { Plus.openPrivacy(); updateFocus(); }});
    drawerItems.push({label: 'Licht', symbol: 'bulb', run: function () { Plus.openLight(); updateFocus(); }});
    if (TV.canOpenSettings) drawerItems.push({label: tr('TV Settings'), symbol: 'tv_settings', run: tvSettings});
    var n = drawerItems.length, gap = 18, groupGap = 56, groups = drawerInputs > 0 && drawerInputs < n ? 2 : 1;
    var tw = Math.min(230, (1760 - Math.max(0, n - groups) * gap - (groups - 1) * groupGap) / Math.max(1, n));
    var xPos = 80;
    for (var k = 0; k < n; k++) {
      if (k === drawerInputs && k > 0) {
        xPos += groupGap - gap;
        el('div', 'row-title', d, tr('Shortcuts')).style.left = (xPos + 4) + 'px';
      }
      if (k === 0 && drawerInputs) el('div', 'row-title', d, tr('Inputs')).style.left = '84px';
      var item = drawerItems[k], key = el('div', 'key glass' + (item.off ? ' off' : ''), d);
      key.style.left = xPos + 'px';
      key.style.width = tw + 'px';
      sym(item.symbol, key);
      el('div', 'label', key, item.label);
      hover(key, Z.DRAWER, k);
      xPos += tw + gap;
    }
    renderPanels();
    renderDrawerHead();
    updateFocus();
  }

  /** Free My TV+ 1.4: oben in der Schublade wieder Uhrzeit, Datum und die Tageskarte (heute: Wetter, Temperaturen, Sonne). */
  function renderDrawerHead() {
    var d = $('drawer');
    if (!d) return;
    var h = $('dhead') || el('div', '', d), now = Date.now(), w = Data.weather;
    h.id = 'dhead';
    h.innerHTML = '';
    el('span', 'dtime', h, formatDate('format|h:mm', now));
    el('span', 'ddate', h, formatDate('format|EEEE, MMMM d', now));
    if (w) {
      var card = el('span', 'dday glass', h);
      sym(Data.symbol(w.code, w.isDay), card, 40);
      el('span', 'dt', card, 'Heute ' + Data.degrees(w.min) + ' bis ' + Data.degrees(w.max));
      if (w.sunrise && w.sunset) el('span', 'ds', card, 'Sonne ' + Data.time(w.sunrise) + '–' + Data.time(w.sunset));
    }
  }

  function renderPanels() {
    var d = $('drawer');
    var old = d.querySelectorAll('.panel');
    for (var o = 0; o < old.length; o++) d.removeChild(old[o]);
    var wx = Prefs.weather(), coins = [], qt = Prefs.quotes();
    var split = 80 + 1760 * 0.585;
    if (wx) {
      var w = el('div', 'panel glass', d);
      w.id = 'weather';
      w.style.left = '80px';
      w.style.width = ((qt ? split - 16 : 1840) - 80) + 'px';
      renderWeather(w);
    }
    if (qt) {
      var q = el('div', 'panel glass', d);
      q.id = 'newspanel';
      var left = wx ? split + 16 : 80;
      q.style.left = left + 'px';
      q.style.width = (1840 - left) + 'px';
      renderNewsPanel(q);
    }
  }

  function renderWeather(card) {
    el('div', 'head', card, Data.city || tr('Weather'));
    var w = Data.weather;
    if (!w) {
      el('div', 'cond', card, tr('No weather data right now.')).style.top = '96px';
      return;
    }
    var now = el('div', 'now', card);
    sym(Data.symbol(w.code, w.isDay), now);
    el('span', 'temp', now, Data.degrees(w.temp));
    el('div', 'cond', card, Data.condition(w.code, w.isDay));
    el('div', 'range', card, trf('H:{max}', {max: Data.degrees(w.max)}) + '   ' + trf('L:{min}', {min: Data.degrees(w.min)}));
    el('div', 'hint', card, 'OK: ausführlicher Wetterbericht');
    el('div', 'split', card);
    // Home Settings → Forecast: the next 6 hours or the next 5 days (the hours until a forecast has days).
    var days = Prefs.forecast() === 'days' && w.days && w.days.length > 0, list = days ? w.days : w.hours, n = days ? 5 : 6;
    var hours = el('div', 'hours', card), width = parseFloat(card.style.width) - 30 - 422, hw = width / n;
    for (var i = 0; list && i < list.length && i < n; i++) {
      var h = el('div', 'hour', hours), x = list[i];
      h.style.left = (hw * i) + 'px';
      h.style.width = hw + 'px';
      el('div', 't', h, days ? Data.weekday(x.at) : Data.hour(x.at));
      sym(Data.symbol(x.code, days || x.day), h);
      var t = el('div', 'd', h, Data.degrees(days ? x.max : x.temp));
      if (days) el('span', 'low', t, Data.degrees(x.min));
    }
    var sun = el('div', 'sun', card);
    if (w.sunrise) { var a = el('span', '', sun); sym('sunrise', a); a.appendChild(document.createTextNode(trf('Sunrise {time}', {time: Data.time(w.sunrise)}))); }
    if (w.sunset) { var b = el('span', '', sun); sym('sunset', b); b.appendChild(document.createTextNode(trf('Sunset {time}', {time: Data.time(w.sunset)}))); }
  }

  /** Free My TV+: die neuesten Cybersecurity-Schlagzeilen in der Schublade, statt der Kurse. */
  function renderNewsPanel(card) {
    el('div', 'head', card, 'Cybersecurity');
    var list = Plus.news();
    el('div', 'side', card, list.length ? 'heise · Golem' : 'wird geladen …');
    for (var j = 0; j < list.length && j < 4; j++) {
      var row = el('div', 'newsrow', card);
      row.style.top = (86 + 52 * j) + 'px';
      el('span', 'n', row, list[j].title);
      el('span', 'c', row, Plus.newsAgo(list[j].at));
    }
  }

  function renderPrices(card, coins) {
    el('div', 'head', card, tr('Crypto'));
    var stale = Data.staleness(Data.pricesAt, 5 * 60000);
    el('div', 'side', card, stale ? trf('quotes|{ago}', {ago: stale}) : tr('24h change'));
    for (var j = 0; j < coins.length; j++) {
      var i = coins[j], row = el('div', 'coin', card);
      row.style.top = (86 + 52 * j) + 'px';
      coin(i, row);
      el('span', 'n', row, Data.coinName(i));
      el('span', 'p', row, Data.money(Data.prices[i]));
      var ch = Data.changes[i];
      if (!isNaN(ch)) el('span', 'c ' + (ch >= 0 ? 'up' : 'down'), row, Data.change(ch));
    }
  }

  function openDrawer() {
    if (!drawerItems.length) return;
    st.wxFocus = false;
    var tiles = $('tiles').children;
    st.zone = Z.DRAWER;
    st.drawer = Math.min(drawerItems.length - 1, nearest(document.querySelectorAll('#drawer .key'), centerX(tiles[st.shelf])));
    updateFocus();
  }

  function closeDrawer() {
    var keys = document.querySelectorAll('#drawer .key');
    st.zone = Z.SHELF;
    if (shelf.length) st.shelf = nearest($('tiles').children, centerX(keys[st.drawer]));
    updateFocus();
  }

  // MARK: - All Apps

  function renderApps() {
    var sheet = $('apps');
    sheet.firstChild.textContent = tr('All Apps');
    var grid = sheet.lastChild;
    grid.innerHTML = '';
    for (var i = 0; i < others.length; i++) {
      var r = Math.floor(i / 5), c = i % 5, cell = el('div', 'cell', grid);
      cell.style.left = (130 + c * 340) + 'px';
      cell.style.top = (196 + r * 239) + 'px';
      face(others[i], el('div', 'face', cell), wordFit(others[i].title, 300, 34));
      el('div', 'label', cell, others[i].title);
      hover(cell, Z.APPS, i);
    }
  }

  function openApps() {
    renderApps();
    st.zone = Z.APPS;
    st.grid = 0;
    setClass($('apps'), 'open', true);
    fitLogos($('apps'));
    updateFocus();
  }

  function closeSheets() {
    setClass($('apps'), 'open', false);
    setClass($('settings'), 'open', false);
    setClass($('shelfedit'), 'open', false);
    setClass($('langpick'), 'open', false);
    setClass($('about'), 'open', false);
    closeCityField();
    setClass($('citypick'), 'open', false);
    langHint = null;
    st.zone = Z.SHELF;
    updateFocus();
  }

  // MARK: - Home Settings

  function settingRows() {
    var unit = Prefs.temperature(), theme = Prefs.theme();
    var auto = tr('Automatic'), picked = pickedLanguage();
    var rows = [
      {label: tr('Language'), value: picked === 'auto' ? auto : I18N.languageName(picked), opens: true, language: true,
        step: function (d) { if (d >= 0) openLanguages(); }},
      {label: tr('Temperature'), value: unit === 'C' ? '°C' : unit === 'F' ? '°F' : tr('unit|Automatic'),
        step: function (d) { cycle('temperature', ['auto', 'C', 'F'], unit, d); renderPanels(); }},
      {label: tr('Theme'), value: theme === 'light' ? tr('Light') : theme === 'dark' ? tr('Dark') : MOODS[theme] ? Plus.moodLabel(theme) : 'Automatisch (Wetter & Tageszeit)',
        step: function (d) { cycle('theme', ['auto', 'light', 'dark'].concat(Object.keys(MOODS)), theme, d); checkNight(); }},
      {label: tr('Watch from the screensaver'), toggle: Prefs.saverWatch(),
        step: function () { Prefs.set('saverWatch', !Prefs.saverWatch()); }},
      {label: tr('Weather widget'), toggle: Prefs.weather(),
        step: function () { Prefs.set('weather', !Prefs.weather()); renderPanels(); }},
      {label: tr('City'), value: Prefs.city() || '—', opens: true, city: true,
        step: function (d) { if (d >= 0) openCities(); }},
      {label: tr('Forecast'), value: Prefs.forecast() === 'days' ? tr('Next days') : tr('Next hours'),
        step: function (d) { cycle('forecast', ['hours', 'days'], Prefs.forecast(), d); renderPanels(); }},
      {label: 'Cybersecurity-News', toggle: Prefs.quotes(),
        step: function () { Prefs.set('quotes', !Prefs.quotes()); renderQuotes(); renderPanels(); }},
      {label: 'Werbung & Tracking', value: '›', step: function (d) { if (d >= 0) Plus.openPrivacy(); }},
      {label: 'Farbe des Auswahlrahmens', value: ACCENTS[Prefs.accent()] ? ACCENTS[Prefs.accent()][0] : 'Blau',
        step: function (d) { cycle('accent', Object.keys(ACCENTS), Prefs.accent(), d); applyAccent(); }},
      {label: 'Hintergrundbild', value: Plus.scenes[Prefs.scene()] ? Plus.scenes[Prefs.scene()].label : 'Wetter & Tageszeit',
        step: function (d) { cycle('scene', ['auto'].concat(Object.keys(Plus.scenes)), Prefs.scene(), d); renderBand(); }},
      {label: 'Nach anderen Apps zurück zu Free My TV+', toggle: Prefs.backHome(),
        step: function () { Prefs.set('backHome', !Prefs.backHome()); Plus.backHome(Prefs.backHome()); }},
      {label: 'Welt-TV: auch Sender mit Geo-Sperre zeigen', toggle: Prefs.showGeo(),
        step: function () { Prefs.set('showGeo', !Prefs.showGeo()); }},
      {label: 'Samsung-Werbe-Apps ausblenden', toggle: Prefs.hidePromo(),
        step: function () { Prefs.set('hidePromo', !Prefs.hidePromo()); loadApps(function () { renderShelf(); }); }}
    ];
    var names = ['Bitcoin', 'Ethereum', 'Solana', tr('Dollar')];
    var count = 0;   // Free My TV+: keine Kryptokurse
    for (var i = 0; i < count; i++) {
      (function (i) {
        rows.push({label: names[i], toggle: Prefs.quotes() && Prefs.coin(i), dim: !Prefs.quotes(),
          step: function () { if (Prefs.quotes()) { Prefs.setCoin(i, !Prefs.coin(i)); Data.settingsChanged(); } }});
      })(i);
    }
    rows.push({label: tr('Shelf'), value: '›', shelf: true, step: function (d) { if (d >= 0) openShelfEdit(); }});
    rows.push({label: tr('About this TV'), value: '›', about: true, step: function (d) { if (d >= 0) openAbout(); }});
    if (TV.canOpenSettings) rows.push({label: tr('TV Settings'), value: '›', step: function (d) { if (d >= 0) tvSettings(); }});
    return rows;
  }

  function cycle(name, values, current, d) {
    var i = values.indexOf(current);
    Prefs.set(name, values[(i + (d || 1) + values.length) % values.length]);
  }

  var rowsNow = [];

  function renderSettings() {
    var box = $('settings').firstChild;
    box.innerHTML = '';
    var title = el('div', 'title', box);
    sym('settings', title);
    title.appendChild(document.createTextNode(tr('Home Settings')));
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    rowsNow = settingRows();
    list.style.height = Math.min(rowsNow.length, 7) * 78 + 'px';
    for (var i = 0; i < rowsNow.length; i++) {
      var r = rowsNow[i], row = el('div', 'row' + (r.dim ? ' dim' : ''), holder, r.label);
      if (r.toggle !== undefined) setClass(el('div', 'toggle', row), 'on', r.toggle);
      else {
        var v = el('span', 'value', row);
        if (r.value === '›') v.textContent = '›';
        else if (r.opens) { v.appendChild(document.createTextNode(r.value)); el('span', 'chev', v, '›'); }
        else { el('span', 'chev', v, '‹'); v.appendChild(document.createTextNode(r.value)); el('span', 'chev', v, '›'); }
      }
      hover(row, Z.SETTINGS, i);
    }
    el('div', 'hint', box, tr('OK or the arrows change the value.'));
    updateFocus();
  }

  function openSettings() {
    st.zone = Z.SETTINGS;
    st.row = 0;
    renderSettings();
    setClass($('settings'), 'open', true);
    updateFocus();
  }

  // MARK: - Language: a list of every catalogue in its own name, as on Android (moving through it doesn't switch the app)

  var langHint = null;

  function languageChoices() {
    return ['auto'].concat(I18N.languages());
  }

  /** The language in use: "auto", or the catalogue the setting resolved to ("pt-BR" in config.properties is "pt"). */
  function pickedLanguage() {
    return Prefs.language() === 'auto' ? 'auto' : I18N.lang;
  }

  function renderLanguages() {
    var box = $('langpick').firstChild, choices = languageChoices(), current = choices.indexOf(pickedLanguage());
    box.innerHTML = '';
    el('div', 'title', box, tr('Language'));
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    list.style.height = Math.min(choices.length, 7) * 78 + 'px';
    for (var i = 0; i < choices.length; i++) {
      var row = el('div', 'row', holder, choices[i] === 'auto' ? tr('Automatic') : I18N.languageName(choices[i]));
      if (i === current) sym('check', el('span', 'value', row));
      hover(row, Z.LANG, i);
    }
    langHint = el('div', 'hint', box);
    updateFocus();
  }

  function openLanguages() {
    setClass($('settings'), 'open', false);
    st.zone = Z.LANG;
    st.lang = Math.max(0, languageChoices().indexOf(pickedLanguage()));
    renderLanguages();
    setClass($('langpick'), 'open', true);
    updateFocus();
  }

  /** OK: the language under the focus; Back: none. Either way, back to Home Settings, on the Language row. */
  function closeLanguages(pick) {
    setClass($('langpick'), 'open', false);
    langHint = null;
    var code = languageChoices()[st.lang];
    if (pick && code !== pickedLanguage()) {
      Prefs.set('language', code);
      I18N.set(Prefs.language());
      renderAll();
      Data.refresh();   // the picks' titles and genres come in the new language
    }
    openSettings();
    for (var i = 0; i < rowsNow.length; i++) if (rowsNow[i].language) st.row = i;
    updateFocus();
  }

  // MARK: - City: typed with the TV's keyboard, found by Open-Meteo, as on Android (the weather is for its coordinates)

  var cityFound = [], cityStatus = '', cityTimer = 0, citySeq = 0;

  /** The field to type in, the Search row, then the places found. */
  function cityRows() { return 2 + cityFound.length; }

  function cityField() { return $('citypick').querySelector('input'); }

  function renderCities() {
    var box = $('citypick').firstChild, old = cityField(), typed = old ? old.value : '', inField = old && document.activeElement === old;
    box.innerHTML = '';
    el('div', 'title', box, tr('City'));
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    list.style.height = Math.min(cityRows(), 7) * 78 + 'px';
    var field = el('input', '', el('div', 'row field', holder));
    field.type = 'text';
    field.value = typed;
    field.placeholder = tr("Type the city's name");
    field.setAttribute('aria-label', tr('City'));
    field.setAttribute('autocomplete', 'off');
    field.setAttribute('spellcheck', 'false');
    hover(field.parentNode, Z.CITY, 0);
    var search = el('div', 'row', holder, tr('Search'));
    sym('chevron_right', el('span', 'value', search));
    hover(search, Z.CITY, 1);
    for (var i = 0; i < cityFound.length; i++) {
      var row = el('div', 'row', holder, cityFound[i].label);
      hover(row, Z.CITY, 2 + i);
    }
    el('div', 'hint', box, cityStatus || tr('OK picks, Back cancels.'));
    if (inField) openCityField();   // a message that went away while typing: the keyboard stays
    updateFocus();
  }

  function openCities() {
    setClass($('settings'), 'open', false);
    st.zone = Z.CITY;
    st.city = 0;
    cityFound = [];
    cityStatus = '';
    $('citypick').firstChild.innerHTML = '';
    renderCities();
    setClass($('citypick'), 'open', true);
    openCityField();
  }

  /** Into the field: the TV shows its keyboard. */
  function openCityField() {
    var f = cityField();
    if (!f) return;
    f.focus();
    try { f.setSelectionRange(f.value.length, f.value.length); } catch (e) {}
  }

  function closeCityField() {
    var f = cityField();
    if (f && document.activeElement === f) f.blur();
  }

  function setCityStatus(text) {
    cityStatus = text;
    clearTimeout(cityTimer);
    // Clears only the hint: a new render would rebuild the field and interrupt the TV's keyboard while someone types.
    if (text && text !== tr('Searching…')) cityTimer = setTimeout(function () {
      cityStatus = '';
      var hint = st.zone === Z.CITY && $('citypick').querySelector('.hint');
      if (hint) hint.textContent = tr('OK picks, Back cancels.');
    }, 4000);
    if (st.zone === Z.CITY) renderCities();
  }

  function searchCity() {
    var f = cityField(), name = f ? f.value : '';
    closeCityField();
    if (!name.trim()) { st.city = 0; openCityField(); updateFocus(); return; }
    if (cityStatus === tr('Searching…')) return;
    setCityStatus(tr('Searching…'));
    var mine = ++citySeq;   // an answer for a sheet already closed (and opened again) is dropped
    Data.findCity(name, function (err, found) {
      if (mine !== citySeq) return;
      if (st.zone !== Z.CITY) { cityStatus = ''; return; }
      cityFound = found || [];
      if (cityFound.length) st.city = 2;   // on the first place found
      setCityStatus(err ? trf("Couldn't search now: {error}", {error: err.message}) : cityFound.length ? '' : tr('No city with that name.'));
    });
  }

  /** OK on a place: the weather moves there. Back (pick false): nothing changes. Either way, back on the City row. */
  function closeCities(pick) {
    var place = pick && cityFound[st.city - 2];
    closeCityField();
    setClass($('citypick'), 'open', false);
    cityFound = [];
    citySeq++;
    clearTimeout(cityTimer);
    cityStatus = '';
    if (place) {
      Prefs.setCity(place.city, place.lat, place.lon);
      Data.cityChanged();
    }
    openSettings();
    for (var i = 0; i < rowsNow.length; i++) if (rowsNow[i].city) st.row = i;
    updateFocus();
  }

  function activateCity() {
    if (st.city === 0) openCityField();
    else if (st.city === 1) searchCity();
    else closeCities(true);
  }

  // MARK: - About this TV: what to quote when reporting a problem, without LG's or Samsung's slow menus

  function renderAbout(info) {
    var box = $('about').firstChild;
    box.innerHTML = '';
    el('div', 'title', box, tr('About this TV'));
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    var rows = [
      [tr('Model'), info && info.model], [tr('Firmware'), info && info.firmware], [tr('System'), info && info.system],
      [tr('IP address'), info && info.ip], [tr('Time zone'), TV.zone()], ['Free My TV+', info && info.version],
      ['Arbeitsspeicher', Plus.memory().system], ['Speicher der App', Plus.memory().app]   // Free My TV+
    ];
    for (var i = 0; i < rows.length; i++) {
      var row = el('div', 'row', holder), label = el('span', '', row, rows[i][0]);
      fitValue(row, label, el('span', 'value', row, info ? rows[i][1] || tr('Unavailable') : '…'));
    }
    el('div', 'hint', box, tr('Back closes.'));
  }

  /** A long value (Samsung's firmware) gets smaller instead of running over its label, and ends in "…" if even the smallest size is too wide. */
  function fitValue(row, label, value) {
    var room = row.clientWidth - label.offsetWidth - 2 * 24 - 24;   // the row's padding, and a gap after the label
    for (var size = 30; value.offsetWidth > room && size > 18; size -= 2) value.style.fontSize = size - 2 + 'px';
    if (value.offsetWidth > room) { value.style.maxWidth = room + 'px'; setClass(value, 'cut', true); }
  }

  function openAbout() {
    setClass($('settings'), 'open', false);
    st.zone = Z.ABOUT;
    renderAbout(null);
    setClass($('about'), 'open', true);
    updateFocus();
    TV.about(function (info) { if (st.zone === Z.ABOUT) renderAbout(info); });
  }

  function closeAbout() {
    setClass($('about'), 'open', false);
    openSettings();
    for (var i = 0; i < rowsNow.length; i++) if (rowsNow[i].about) st.row = i;
    updateFocus();
  }

  // MARK: - Shelf editor: which apps, in what order

  function editList() {
    var ids = shelf.map(function (a) { return a.id; });
    return {ids: ids, rows: apps.slice().sort(function (a, b) {
      var ia = ids.indexOf(a.id), ib = ids.indexOf(b.id);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
    })};
  }

  function renderShelfEdit() {
    var box = $('shelfedit').firstChild, e = editList();
    box.innerHTML = '';
    var title = el('div', 'title', box);
    sym('apps', title);
    title.appendChild(document.createTextNode(tr('Shelf')));
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    list.style.height = Math.min(e.rows.length, 7) * 78 + 'px';
    for (var i = 0; i < e.rows.length; i++) {
      var a = e.rows[i], at = e.ids.indexOf(a.id), row = el('div', 'row', holder, a.title);
      var place = el('span', 'value', row, at >= 0 ? '#' + (at + 1) : tr('shelf|Off'));
      if (at >= 0) sym('check', place).style.marginLeft = '16px';   // on the shelf: a check, as in the pickers
      hover(row, Z.EDIT, i);
    }
    el('div', 'hint', box, tr('OK adds or removes an app. ← → change the order.'));
    updateFocus();
  }

  function openShelfEdit() {
    setClass($('settings'), 'open', false);
    st.zone = Z.EDIT;
    st.edit = 0;
    renderShelfEdit();
    setClass($('shelfedit'), 'open', true);
    updateFocus();
  }

  function editShelf(dx) {
    var e = editList(), app = e.rows[st.edit];
    if (!app) return;
    var ids = e.ids.slice(), at = ids.indexOf(app.id);
    if (dx === 0) {
      if (at >= 0) ids.splice(at, 1);
      else ids.push(app.id);
    } else {
      if (at < 0) return;
      var to = Math.max(0, Math.min(ids.length - 1, at + dx));
      ids.splice(at, 1);
      ids.splice(to, 0, app.id);
    }
    Prefs.set('shelf', ids);
    pickShelf();
    renderShelf();
    var again = editList();
    for (var i = 0; i < again.rows.length; i++) if (again.rows[i].id === app.id) st.edit = i;
    renderShelfEdit();
  }

  // MARK: - Opening things

  function launcher(id, name) {
    return function () {
      var normal = function () {
        TV.launch(id, null, function (ok) {
          if (!ok) toast(trf("Couldn't open {app}.", {app: name || id}));
        });
      };
      // Free My TV+: YouTube oeffnet werbefrei als TizenTube in TizenBrew (fehlt TizenBrew, die normale App).
      if (Plus.isYouTube({id: id, title: name})) { Plus.youtube(normal); return; }
      normal();
    };
  }

  function tvSettings() {
    TV.settings(function (ok) {
      if (!ok) toast(tr("Couldn't open TV Settings"));
    });
  }

  function liveTV() {
    for (var i = 0; i < inputs.length; i++) if (inputs[i].key === 'live') return inputs[i];
    return null;
  }

  function activate() {
    switch (st.zone) {
      case Z.TOP:
        if (st.top < 3) return;
        if (st.top === 3) { var live = liveTV(); if (live) launcher(live.id, tr('Live TV'))(); }
        else if (st.top === 4) { st.zone = Z.SHELF; openDrawer(); st.drawer = 1 < drawerInputs ? 1 : 0; updateFocus(); }
        else openSettings();
        return;
      case Z.CARDS:
        var p = cards[st.card];
        if (p && p.run) p.run();
        return;
      case Z.SHELF:
        if (shelf[st.shelf]) launcher(shelf[st.shelf].id, shelf[st.shelf].title)();
        return;
      case Z.DRAWER:
        if (st.wxFocus) { Plus.openWeather(); updateFocus(); return; }
        if (drawerItems[st.drawer]) drawerItems[st.drawer].run();
        return;
      case Z.APPS:
        if (others[st.grid]) launcher(others[st.grid].id, others[st.grid].title)();
        return;
      case Z.SETTINGS:
        if (rowsNow[st.row]) { rowsNow[st.row].step(1); if (st.zone === Z.SETTINGS) renderSettings(); }
        return;
      case Z.EDIT:
        editShelf(0);
        return;
      case Z.LANG:
        closeLanguages(true);
        return;
      case Z.CITY:
        activateCity();
        return;
      case Z.ABOUT:
        closeAbout();
        return;
    }
  }

  function selectTab(i) {
    if (i === st.tab) return;
    st.tab = i;
    renderCards();
  }

  function move(dx, dy) {
    var tiles = $('tiles').children, cardNodes = $('cards').children;
    switch (st.zone) {
      case Z.SHELF:
        if (dx) st.shelf = Math.max(0, Math.min(shelf.length - 1, st.shelf + dx));
        else if (dy > 0) { openDrawer(); return; }
        else if (dy < 0) {
          if (cards.length) { st.zone = Z.CARDS; st.card = nearest(cardNodes, centerX(tiles[st.shelf])); }
          else { st.zone = Z.TOP; st.top = st.tab; }
        }
        break;
      case Z.CARDS:
        if (cards[st.card] && cards[st.card].key && cards[st.card].key(dx, dy)) return;   // Free My TV+: Senderkachel schaltet um
        var to = cardToward(dx, dy);
        if (to >= 0) st.card = to;
        else if (dx) break;
        else if (dy < 0) { st.zone = Z.TOP; st.top = st.tab; }
        else if (shelf.length) { st.zone = Z.SHELF; st.shelf = nearest(tiles, centerX(cardNodes[st.card])); }
        break;
      case Z.TOP:
        if (dx) {
          st.top = Math.max(0, Math.min(5, st.top + dx));
          if (st.top < 3) selectTab(st.top);   // as on Apple TV: focusing a tab selects it
        } else if (dy > 0) {
          if (cards.length) { st.zone = Z.CARDS; st.card = Math.min(cards.length - 1, st.top < 3 ? 0 : cards.length - 1); }
          else st.zone = Z.SHELF;
        }
        break;
      case Z.DRAWER:
        // Free My TV+ 1.3: oben Wetter und News, unten Eingaenge und Verknuepfungen. ▲ zum Wetter, OK oeffnet den Bericht.
        if (st.wxFocus) {
          if (dy > 0) st.wxFocus = false;
          else if (dy < 0) { st.wxFocus = false; closeDrawer(); return; }
        } else if (dx) st.drawer = Math.max(0, Math.min(drawerItems.length - 1, st.drawer + dx));
        else if (dy < 0) { if (Prefs.weather()) st.wxFocus = true; else { closeDrawer(); return; } }
        break;
      case Z.APPS:
        var g = st.grid + dx + dy * 5;
        if (g >= 0 && g < others.length && (dx === 0 || Math.floor(g / 5) === Math.floor(st.grid / 5))) st.grid = g;
        break;
      case Z.SETTINGS:
        if (dy) st.row = Math.max(0, Math.min(rowsNow.length - 1, st.row + dy));
        else if (dx && rowsNow[st.row]) {
          var r = rowsNow[st.row];
          if (r.value !== '›') { r.step(dx); if (st.zone === Z.SETTINGS) renderSettings(); }
        }
        break;
      case Z.EDIT:
        if (dy) st.edit = Math.max(0, Math.min(apps.length - 1, st.edit + dy));
        else if (dx) editShelf(dx);
        break;
      case Z.LANG:
        if (dy) st.lang = Math.max(0, Math.min(languageChoices().length - 1, st.lang + dy));
        break;
      case Z.CITY:
        if (dy) st.city = Math.max(0, Math.min(cityRows() - 1, st.city + dy));
        break;
    }
    updateFocus();
  }

  function back() {
    if (moving) { stopMoving(); return; }
    if (Plus.endZap()) return;
    if (st.zone === Z.EDIT) {
      setClass($('shelfedit'), 'open', false);
      openSettings();
      for (var i = 0; i < rowsNow.length; i++) if (rowsNow[i].shelf) st.row = i;   // back on the Shelf row, whatever follows it
      updateFocus();
      return;
    }
    if (st.zone === Z.LANG) { closeLanguages(false); return; }
    if (st.zone === Z.CITY) { closeCities(false); return; }
    if (st.zone === Z.ABOUT) { closeAbout(); return; }
    if (sheetOpen()) { closeSheets(); return; }
    if (st.zone === Z.DRAWER) { closeDrawer(); return; }
    if (st.zone !== Z.SHELF && shelf.length) { st.zone = Z.SHELF; updateFocus(); return; }
    TV.back();
  }

  /** The pointer focuses what it's over (the Magic Remote, or a mouse when previewing). */
  function hover(node, zone, index) {
    node.onmouseover = function () {
      if (saverOn || (sheetOpen() !== (zone === Z.APPS || zone === Z.SETTINGS || zone === Z.EDIT || zone === Z.LANG || zone === Z.CITY || zone === Z.ABOUT))) return;
      if (zone === Z.DRAWER && st.zone !== Z.DRAWER) return;
      if (zone !== Z.DRAWER && st.zone === Z.DRAWER && zone !== Z.SHELF) return;
      if (zone === Z.SHELF && st.zone === Z.DRAWER) closeDrawer();
      st.zone = zone;
      if (zone === Z.TOP) { st.top = index; if (index < 3) selectTab(index); }
      else if (zone === Z.CARDS) st.card = index;
      else if (zone === Z.SHELF) st.shelf = index;
      else if (zone === Z.DRAWER) st.drawer = index;
      else if (zone === Z.APPS) st.grid = index;
      else if (zone === Z.SETTINGS) st.row = index;
      else if (zone === Z.EDIT) st.edit = index;
      else if (zone === Z.LANG) st.lang = index;
      else if (zone === Z.CITY) st.city = index;
      updateFocus();
    };
    node.onclick = function () { node.onmouseover(); activate(); };
  }

  // MARK: - Toast

  var toastTimer = 0;
  function toast(text) {
    var t = $('toast');
    t.textContent = text;
    setClass(t, 'on', true);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { setClass(t, 'on', false); }, 6000);
  }

  // MARK: - Night, clock, screensaver

  var lastNight = null;

  // Free My TV+ 1.3: Farbe des Auswahlrahmens (home.css: .acc-…)
  var ACCENTS = {blue: ['Blau'], green: ['Grün'], orange: ['Orange'], pink: ['Pink'], purple: ['Lila'], red: ['Rot'], yellow: ['Gelb'], white: ['Weiß'], teal: ['Türkis']};
  var accentNow = '';
  function applyAccent() {
    var a = ACCENTS[Prefs.accent()] ? Prefs.accent() : 'blue';
    if (accentNow) setClass(body, 'acc-' + accentNow, false);
    setClass(body, 'acc-' + a, true);
    accentNow = a;
  }

  /** Legende unten rechts: welche Tasten hier was tun. */
  function legend() {
    var box = $('legend');
    if (!box) return;
    var t = '';
    if (Plus.isOpen()) t = Plus.legendText();
    else if (tvFull) t = 'Beliebige Taste: Oberfläche zurück';
    else if (moving) t = '◄ ► verschieben  ·  OK ablegen';
    else if (sheetOpen()) t = st.zone === Z.SETTINGS ? '▲ ▼ wählen  ·  ◄ ► ändern  ·  OK öffnen  ·  Zurück' : '▲ ▼ ◄ ► wählen  ·  OK  ·  Zurück';
    else if (st.zone === Z.DRAWER) t = st.wxFocus ? 'OK Wetterbericht  ·  ▼ Verknüpfungen  ·  ▲ schließen' : '◄ ► wählen  ·  OK öffnen  ·  ▲ Wetter  ·  Zurück';
    else if (st.zone === Z.SHELF) t = '◄ ► wählen  ·  OK öffnen  ·  OK lang: verschieben  ·  ▼ Schublade  ·  P+/P− Sender';
    else if (st.zone === Z.CARDS) t = (cards[st.card] && cards[st.card].switcher ? 'OK Programmführer  ·  ' : 'OK öffnen  ·  ') + '◄ ► ▲ ▼ wählen  ·  P+/P− Sender';
    else if (st.zone === Z.TOP) t = '◄ ► Tabs und Knöpfe  ·  ▼ Kacheln';
    if (box.textContent !== t) box.textContent = t;
    setClass(box, 'off', !t);
  }

  // Free My TV+: Farbstimmungen (Name: [Grundfarbe, dunkel?]), passend zu den Fotos im Streifen
  var MOODS = {sunrise: ['#FFF1E6', false], day: ['#F5F5F7', false], partly: ['#F1F4F8', false], overcast: ['#ECEEF1', false], rain: ['#E6ECF2', false], snow: ['#F7FAFD', false], fog: ['#EFEFEB', false], sunset: ['#FFE6D6', false], dusk: ['#2B2542', true], night: ['#141B2D', true], nightcloud: ['#1F2126', true], nightsnow: ['#1B2231', true], storm: ['#242830', true]};
  var moodNow = '';
  function themeMood() {
    var theme = Prefs.theme();
    if (MOODS[theme]) return theme;
    if (theme === 'auto') return Plus.sceneMood() || Plus.mood(Data.weather);
    return '';
  }

  function checkNight() {
    var theme = Prefs.theme(), m = themeMood();
    var night = theme === 'dark' ? true : theme === 'light' ? false : m ? MOODS[m][1] : Data.isNight(Date.now());
    if (m !== moodNow) { if (moodNow) setClass(body, 'mood-' + moodNow, false); if (m) setClass(body, 'mood-' + m, true); moodNow = m; }
    setClass(body, 'night', night);
    document.documentElement.style.background = m ? MOODS[m][0] : night ? '#0B0B0D' : '';
    if (night === lastNight) return;
    lastNight = night;
    try { localStorage.setItem('fmtv.night', night ? 'true' : 'false'); } catch (e) {}   // for index.html, next start
  }

  var saverOn = false, idleAt = Date.now(), saverIndex = 0, saverTimer = 0, saverPick = null, SAVER_AFTER = 5 * 60000;

  /** The screensaver's photos: picks with an app on the TV. */
  function saverPhotos() {
    var list = Data.showcase().filter(function (p) { return p.backdrop && Data.appFor(p.app); });
    // Free My TV+: ohne Film-Tipps zeigt der Bildschirmschoner das Wetter-Foto des Streifens in voller Groesse
    if (!list.length && Plus.bandUrl()) list = [{url: Plus.bandUrl(), title: Plus.bandLabel()}];
    return list;
  }

  function showSaver() {
    var photos = saverPhotos();
    saverOn = true;
    saverPick = null;
    var s = $('saver');
    s.innerHTML = '';
    var a = el('div', 'photo', s), b = el('div', 'photo', s);
    el('div', 'shade', s);
    var clock = el('div', 'clock', s);
    el('div', 'time', clock);
    el('div', 'date', clock);
    el('div', 'title', clock);
    var hint = el('div', 'hint', clock);
    var front = a;
    function next() {
      if (!saverOn) return;
      var p = photos.length ? photos[saverIndex++ % photos.length] : null;
      var back = front === a ? b : a;
      if (p) {
        back.style.backgroundImage = 'url(' + (p.url || Data.image(p.backdrop, 'original')) + ')';
        back.style.webkitTransform = back.style.transform = 'scale(1.0)';
        clock.children[2].textContent = p.title;
        saverPick = p;
        // With Watch from the screensaver on, OK opens this title's app (any other key only closes).
        var app = Prefs.saverWatch() && Data.appFor(p.app);
        hint.textContent = app ? trf('Press OK to watch on {app} · any other button to close', {app: app.title}) : '';
        setTimeout(function () {
          setClass(back, 'on', true);
          setClass(front, 'on', false);
          back.style.webkitTransform = back.style.transform = 'scale(1.08) translateX(-1.5%)';
          front = back;
        }, 60);
      }
      tickSaverClock(clock);
      saverTimer = setTimeout(next, 12000);
    }
    setClass(s, 'on', true);
    Plus.live(null);
    next();
  }

  function tickSaverClock(clock) {
    var d = new Date();
    clock.firstChild.textContent = formatDate('format|h:mm', d.getTime());
    clock.children[1].textContent = formatDate('format|EEEE, MMMM d', d.getTime());
  }

  function hideSaver() {
    saverOn = false;
    clearTimeout(saverTimer);
    setClass($('saver'), 'on', false);
    if (typeof syncLive === 'function') syncLive();
  }

  function poke(ok) {
    idleAt = Date.now();
    if (tvFull) { leaveFull(); return true; }   // Free My TV+: zurueck aus dem TV-Vollbild
    if (!saverOn) return false;
    var app = ok && saverPick && Prefs.saverWatch() && Data.appFor(saverPick.app);
    hideSaver();
    if (app) launcher(app.id, app.title)();
    return true;
  }

  // MARK: - Keys

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    setTimeout(function () { legend(); syncLive(); }, 0);   // Free My TV+: Legende und Fernsehbild nach jeder Taste
    if (poke(k === TV.keys.ok)) { e.preventDefault(); return; }   // the first press only wakes the screen (or OK watches)
    if (typing(k)) return;
    // Free My TV+: Kacheln der Leiste verschieben. OK lange halten (oder rote Taste), dann ← →, OK legt ab.
    if (st.zone === Z.SHELF && !sheetOpen() && !Plus.isOpen()) {
      if (moving) {
        if (k === TV.keys.left || k === TV.keys.right) { moveTile(k === TV.keys.left ? -1 : 1); e.preventDefault(); return; }
        if (k === TV.keys.ok || k === 403 || k === TV.keys.back || k === 27) { stopMoving(); e.preventDefault(); return; }
        if (k === TV.keys.up || k === TV.keys.down) stopMoving();
      } else if (k === 403) { startMoving(); e.preventDefault(); return; }
      else if (k === TV.keys.ok) {
        e.preventDefault();
        if (e.repeat || okTimer) return;
        okTimer = setTimeout(function () { okTimer = 0; startMoving(); }, 650);
        return;
      }
    }
    var handled = Plus.key(k, TV.keys);
    if (handled === 'type') return;   // Free My TV+: die Taste geht ins Suchfeld
    if (handled) { e.preventDefault(); return; }   // Free My TV+: Welt-TV, Player, Senderliste
    if (k === TV.keys.left) move(-1, 0);
    else if (k === TV.keys.right) move(1, 0);
    else if (k === TV.keys.up) move(0, -1);
    else if (k === TV.keys.down) move(0, 1);
    else if (k === TV.keys.ok) activate();
    else if (k === TV.keys.back || k === 27 || k === 8) back();
    else return;
    e.preventDefault();
  });
  document.addEventListener('mousemove', function () { poke(); });
  document.addEventListener('keyup', function (e) {
    if (e.keyCode === TV.keys.ok && okTimer) { clearTimeout(okTimer); okTimer = 0; activate(); }
  });

  var moving = false, okTimer = 0;
  function startMoving() {
    if (!shelf[st.shelf]) return;
    moving = true;
    setClass($('tiles').children[st.shelf], 'moving', true);
    toast('Kachel verschieben: ← →, OK legt sie ab');
  }
  function stopMoving() {
    moving = false;
    var t = $('tiles').children;
    for (var i = 0; i < t.length; i++) setClass(t[i], 'moving', false);
    Prefs.set('shelf', shelf.map(function (a) { return a.id; }));
    updateFocus();
  }
  function moveTile(dx) {
    var to = st.shelf + dx;
    if (to < 0 || to >= shelf.length) return;
    var a = shelf[st.shelf];
    shelf[st.shelf] = shelf[to];
    shelf[to] = a;
    st.shelf = to;
    renderShelf();
    setClass($('tiles').children[st.shelf], 'moving', true);
    updateFocus();
  }

  /**
   * In the city's field, the keys type (← → move in the text, Delete erases). OK or the keyboard's Done searches; Back,
   * its Cancel or ↑ ↓ leave the field. Samsung's keyboard sends Done as 65376 and Cancel as 65385. True: handled here.
   */
  function typing(k) {
    var f = cityField();
    if (st.zone !== Z.CITY || !f || document.activeElement !== f) return false;
    if (k === TV.keys.ok || k === 65376) searchCity();
    else if (k === TV.keys.back || k === 27 || k === 65385) { closeCityField(); updateFocus(); }
    else if (k === TV.keys.up || k === TV.keys.down) { closeCityField(); move(0, k === TV.keys.up ? -1 : 1); }
    else return true;   // typed into the field
    return true;
  }

  // MARK: - Start

  function renderAll() {
    renderTop();
    renderQuotes();
    cards = [];
    renderCards();
    renderShelf();
    renderDrawer();
    renderClock();
    checkNight();
    if (st.zone === Z.SETTINGS) renderSettings();
    updateFocus();
  }

  /** hide_apps in config.properties: left out of the shelf, All Apps and the picks, by id or name (part of it). */
  var HIDE = (CONFIG.hideApps || []).map(function (s) { return s.toLowerCase(); });
  function hidden(app) {
    if (Prefs.hidePromo() && Plus.isPromo(app)) return true;   // Free My TV+: Samsung-Werbe-Apps
    var id = (app.id || '').toLowerCase(), title = (app.title || '').toLowerCase();
    for (var i = 0; i < HIDE.length; i++) if (id.indexOf(HIDE[i]) >= 0 || title.indexOf(HIDE[i]) >= 0) return true;
    return false;
  }

  function loadApps(done) {
    TV.apps(function (list) {
      apps = list.filter(function (a) { return !hidden(a); });
      Data.setApps(apps);
      Plus.setApps(apps, function (a) { launcher(a.id, a.title)(); });
      pickShelf();
      TV.inputs(function (list2) {
        inputs = list2;
        if (done) done();
      });
    });
  }

  /** Back to the home screen (the app was opened again): the shelf, everything closed, the first tab. */
  function reset() {
    hideSaver();
    closeSheets();
    st.zone = Z.SHELF;
    st.shelf = 0;
    if (st.tab !== 0) { st.tab = 0; renderCards(); }
    updateFocus();
    restInDrawer();   // drawer_first: out again at once, not only after the TV lists its apps
  }

  Data.onChange(function () {
    renderQuotes();
    renderCards();
    renderPanels();
    checkNight();
    renderBand();
  });
  // Free My TV+: neue Schlagzeilen, neues EPG oder Welt-TV-Liste geladen
  Plus.onChange(function () {
    if (!$('quotes').firstChild) renderQuotes();
    renderCards();
    renderPanels();
  });
  Plus.onClose(function () { updateFocus(); });
  Plus.backHome(Prefs.backHome());
  applyAccent();
  Plus.onLegend(function () { legend(); });

  /** Free My TV+: der Foto-Streifen oben mit Wetter, Ort und Uhrzeit. */
  function renderBand() {
    var w = Data.weather, info = $('band-info');
    Plus.band(w);
    renderTitle();
    renderDrawerHead();
    checkNight();   // Free My TV+: die Farbstimmung folgt dem Wetter
    if (!info) return;
    info.innerHTML = '';
    if (w) {
      sym(Data.symbol(w.code, w.isDay), info, 34);
      el('span', 't', info, Data.degrees(w.temp));
      el('span', 'c', info, Data.condition(w.code, w.isDay) + (Data.city ? '  ·  ' + Data.city : ''));
    }
  }

  /** drawer_first: the home screen rests with the drawer open (shelf in the middle, inputs and weather below). */
  function restInDrawer() {
    if (!CONFIG.drawerFirst || !drawerItems.length || st.zone !== Z.SHELF) return;
    st.zone = Z.DRAWER;
    st.drawer = 0;
    updateFocus();
  }

  function reopened() {
    // LG: with handlesRelaunch the app has to come to the front itself, or opening it again while it runs shows nothing.
    if (window.PalmSystem && window.PalmSystem.activate) window.PalmSystem.activate();
    reset();
    loadApps(function () { renderShelf(); renderDrawer(); restInDrawer(); Data.refresh(); Plus.refresh(); });
  }

  window.addEventListener('resize', fit);
  document.addEventListener('webOSRelaunch', reopened);   // LG: opened again while running
  window.addEventListener('appcontrol', reopened);        // Samsung: the same
  document.addEventListener('visibilitychange', function () {
    if (Prefs.backHome()) Plus.backHome(true, !document.hidden);
    if (document.hidden) { hideSaver(); Plus.stopPreview(); if (tvFull || $('zoomframe')) { tvFull = false; clearTimeout(tvTimer); tvClass(false, false, false); setClass(zoomFrame(), 'on', false); zoomTo(false, 0); } Plus.live(null); return; }
    idleAt = Date.now();
    loadApps(function () { renderShelf(); renderDrawer(); updateFocus(); Data.refresh(); Plus.refresh(); renderCards(); });
  });

  I18N.set(Prefs.language());
  checkNight();   // now, from the last forecast: not after the TV lists its apps, with the day look until then
  // LG's screensaver waits only when ours will show: not under a sheet (ours waits there), and not without photos.
  TV.holdScreenSaver(function () { return !sheetOpen() && saverPhotos().length > 0; });
  fit();
  renderTop();
  tickClock();
  loadApps(function () {
    renderAll();
    restInDrawer();
    Data.refresh();
    Plus.refresh();
    renderBand();
  });
  setInterval(function () {
    checkNight();
    Data.refresh();
    Plus.refresh();
    renderBand();
    if (st.tab === 0) renderCards();   // EPG-Zeit ("noch 12 Min.") aktuell halten
    // 1.5: der Bildschirmschoner nur, wo kein Fernsehbild laeuft (Welt-TV- und News-Seite, Schublade), nie im laufenden Programm
    var liveShows = (st.tab === 0 && cards[0] && cards[0].live) || Plus.isOpen();
    if (!saverOn && !tvFull && !sheetOpen() && !liveShows && Date.now() - idleAt > SAVER_AFTER) showSaver();
    if (saverOn) tickSaverClock($('saver').querySelector('.clock'));
  }, 30000);

  // For the browser preview and tests.
  window.FreeMyTV = {state: st, move: move, activate: activate, back: back, showSaver: showSaver, hideSaver: hideSaver, toast: toast};
})();
