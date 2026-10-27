/*
 * Gezeichneter Hintergrund: Berglandschaft mit See, die sich an Tageszeit und Wetter anpasst.
 * Sonnenauf-/untergang, blaue Stunde, Nacht mit Mond und Sternen, Wolken, Regen, Schnee,
 * Nebel und Gewitter. Wird nur alle paar Minuten neu gezeichnet (schont den TV-Prozessor).
 *
 * window.HomeScene.render({ date, sunrise, sunset, code, cloud }) -> { url, label }
 */
(function () {
  'use strict';

  var W = 1920, H = 1080;
  var HORIZON = 0.80 * H;   // Wasserlinie

  // ---------- kleine Helfer ----------

  function rng(seed) {             // reproduzierbarer Zufall (mulberry32)
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgba(c, al) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (al === undefined ? 1 : al) + ')'; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }

  // ---------- Sonnenstand ----------
  // s: -1 (tiefe Nacht) .. 0 (Horizont) .. 1 (Mittag); f: Anteil des Tages/der Nacht (0..1, Ost -> West)
  function sunState(now, rise, set) {
    var t = now.getTime();
    var DAY = 86400000;
    if (t >= rise && t <= set) {
      var f = (t - rise) / (set - rise);
      return { s: Math.sin(Math.PI * f), f: f, day: true, morning: f < 0.5 };
    }
    var nStart, nEnd;
    if (t > set) { nStart = set; nEnd = rise + DAY; } else { nStart = set - DAY; nEnd = rise; }
    var g = (t - nStart) / (nEnd - nStart);
    // waehrend der Daemmerung (ca. 50 Min.) sanft unter den Horizont
    return { s: -Math.sin(Math.PI * g), f: g, day: false, morning: g > 0.5 };
  }

  // Himmelsfarben (oben, Mitte, Horizont) fuer bestimmte Sonnenhoehen
  var SKY = [
    { s: -1.00, top: '#03060f', mid: '#07112a', hor: '#122244' },
    { s: -0.30, top: '#050b1d', mid: '#0c1b3d', hor: '#1d2f58' },
    { s: -0.10, top: '#0c1736', mid: '#28396d', hor: '#5e5c8e' },
    { s: -0.02, top: '#1d2c5e', mid: '#8a5a7e', hor: '#e88a5a' },
    { s:  0.06, top: '#2f4f92', mid: '#c98a7f', hor: '#f6b26b' },
    { s:  0.20, top: '#3a6fbe', mid: '#86b0e0', hor: '#f1d4a8' },
    { s:  0.45, top: '#2a6ad0', mid: '#5f9ce6', hor: '#c6e0f7' },
    { s:  1.00, top: '#1f5fcc', mid: '#5294e6', hor: '#bfdcf7' }
  ];

  function skyAt(s) {
    for (var i = 0; i < SKY.length - 1; i++) {
      if (s <= SKY[i + 1].s) {
        var a = SKY[i], b = SKY[i + 1];
        var t = (s - a.s) / (b.s - a.s);
        return { top: mix(hex(a.top), hex(b.top), t), mid: mix(hex(a.mid), hex(b.mid), t), hor: mix(hex(a.hor), hex(b.hor), t) };
      }
    }
    var l = SKY[SKY.length - 1];
    return { top: hex(l.top), mid: hex(l.mid), hor: hex(l.hor) };
  }

  // ---------- Wetter einordnen ----------
  function kind(code) {
    if (code === 45 || code === 48) return 'fog';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'storm';
    if (code === 3) return 'overcast';
    if (code === 2) return 'partly';
    return 'clear';
  }

  // Mondphase 0..1 (0 = Neumond, 0.5 = Vollmond)
  function moonPhase(d) {
    var ref = Date.UTC(2000, 0, 6, 18, 14);
    var p = ((d.getTime() - ref) / 86400000) / 29.530588853;
    return p - Math.floor(p);
  }

  // ---------- Zeichnen ----------

  function ridge(ctx, rnd, baseY, amp, rough, color, seedShift) {
    var k1 = 0.0018 + rnd() * 0.0012, k2 = 0.0047 + rnd() * 0.002, k3 = 0.011 + rnd() * 0.004;
    var p1 = rnd() * 10 + seedShift, p2 = rnd() * 10, p3 = rnd() * 10;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (var x = 0; x <= W; x += 8) {
      var y = baseY - amp * (0.55 * Math.sin(x * k1 + p1) + 0.3 * Math.sin(x * k2 + p2) + rough * Math.sin(x * k3 + p3));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function cloud(ctx, rnd, cx, cy, scale, lit, shade, alpha) {
    var n = 6 + Math.floor(rnd() * 6);
    for (var i = 0; i < n; i++) {
      var ox = (rnd() - 0.5) * 320 * scale;
      var oy = (rnd() - 0.6) * 60 * scale;
      var r = (60 + rnd() * 90) * scale;
      var g = ctx.createRadialGradient(cx + ox, cy + oy - r * 0.3, r * 0.1, cx + ox, cy + oy, r);
      g.addColorStop(0, rgba(lit, alpha));
      g.addColorStop(0.55, rgba(mix(lit, shade, 0.5), alpha * 0.75));
      g.addColorStop(1, rgba(shade, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse ? ctx.ellipse(cx + ox, cy + oy, r * 1.6, r * 0.75, 0, 0, Math.PI * 2)
                  : ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function render(o) {
    var now = o.date || new Date();
    var rise = o.sunrise || new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0).getTime();
    var set = o.sunset || new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0).getTime();
    var wk = kind(o.code === undefined ? 0 : o.code);
    var cloudCover = o.cloud === undefined
      ? { clear: 5, partly: 45, overcast: 95, fog: 80, rain: 90, snow: 90, storm: 100 }[wk]
      : o.cloud;
    var sun = sunState(now, rise, set);
    var s = sun.s;
    var light = smooth(-0.25, 0.35, s);                 // 0 = Nacht, 1 = voller Tag
    var golden = s > -0.12 && s < 0.18 ? 1 - Math.abs((s - 0.02) / 0.16) : 0;
    golden = clamp(golden, 0, 1);

    var dayNo = Math.floor(now.getTime() / 86400000);
    var rnd = rng(dayNo * 7919 + 17);

    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');

    // --- Himmel ---
    var sky = skyAt(s);
    var grey = { clear: 0, partly: 0.12, overcast: 0.6, fog: 0.55, rain: 0.72, snow: 0.6, storm: 0.85 }[wk];
    grey = Math.max(grey, (cloudCover - 40) / 100);
    var greyDay = hex('#8d97a5'), greyNight = hex('#151a22');
    var gcol = mix(greyNight, greyDay, light);
    if (wk === 'storm') gcol = mix(gcol, hex('#2a2f3a'), 0.5);
    if (wk === 'snow') gcol = mix(gcol, hex('#c9d1dc'), 0.3 * light);
    var top = mix(sky.top, gcol, grey * 0.85);
    var mid = mix(sky.mid, gcol, grey * 0.9);
    var hor = mix(sky.hor, gcol, grey * 0.8);
    var g = ctx.createLinearGradient(0, 0, 0, HORIZON);
    g.addColorStop(0, rgba(top));
    g.addColorStop(0.6, rgba(mid));
    g.addColorStop(1, rgba(hor));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, HORIZON + 2);

    // --- Sterne ---
    var starVis = (1 - smooth(-0.3, -0.06, s)) * clamp(1 - cloudCover / 75, 0, 1);
    if (wk === 'fog' || wk === 'rain' || wk === 'snow' || wk === 'storm') starVis = 0;
    if (starVis > 0.02) {
      var srnd = rng(dayNo * 31 + 5);
      for (var i = 0; i < 420; i++) {
        var sx = srnd() * W, sy = srnd() * HORIZON * 0.82;
        var sz = srnd() < 0.06 ? 1.8 + srnd() * 1.2 : 0.5 + srnd() * 1.1;
        var sa = (0.35 + srnd() * 0.65) * starVis * (1 - sy / HORIZON * 0.6);
        ctx.fillStyle = 'rgba(255,255,255,' + sa.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(sx, sy, sz, 0, Math.PI * 2); ctx.fill();
      }
      // Milchstrasse andeutungsweise bei klarer, dunkler Nacht
      if (starVis > 0.7) {
        var mw = ctx.createLinearGradient(W * 0.2, 0, W * 0.75, HORIZON);
        mw.addColorStop(0, 'rgba(180,190,255,0)');
        mw.addColorStop(0.5, 'rgba(180,190,255,' + (0.06 * starVis).toFixed(3) + ')');
        mw.addColorStop(1, 'rgba(180,190,255,0)');
        ctx.fillStyle = mw;
        ctx.save(); ctx.translate(W * 0.5, HORIZON * 0.4); ctx.rotate(-0.5);
        ctx.fillRect(-W, -90, W * 2, 180);
        ctx.restore();
      }
    }

    // --- Sonne bzw. Mond ---
    var bodyX, bodyY, bodyVis = clamp(1 - (cloudCover - 30) / 70, 0, 1);
    if (wk === 'fog') bodyVis *= 0.35;
    var moon = null;
    if (s > -0.08) {
      bodyX = W * (0.1 + 0.8 * (sun.day ? sun.f : (sun.morning ? 0 : 1)));
      bodyY = HORIZON - (HORIZON - 150) * Math.max(s, 0) * 1.1 + (s < 0 ? -s * 600 : 0);
      var warm = mix(hex('#fff6dc'), hex('#ffb25a'), clamp(1 - s / 0.25, 0, 1));
      var glowR = 260 + golden * 380;
      var sg = ctx.createRadialGradient(bodyX, bodyY, 10, bodyX, bodyY, glowR);
      sg.addColorStop(0, rgba(warm, 0.9 * bodyVis));
      sg.addColorStop(0.15, rgba(warm, 0.45 * bodyVis));
      sg.addColorStop(1, rgba(warm, 0));
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, HORIZON);
      ctx.fillStyle = rgba(mix(warm, hex('#ffffff'), 0.5), bodyVis);
      ctx.beginPath(); ctx.arc(bodyX, bodyY, 34, 0, Math.PI * 2); ctx.fill();
    } else {
      var ph = moonPhase(now);
      var illum = (1 - Math.cos(ph * 2 * Math.PI)) / 2;     // 0..1
      moon = { illum: illum };
      bodyX = W * (0.15 + 0.7 * sun.f);
      bodyY = 170 + 260 * (1 - Math.sin(Math.PI * sun.f));
      if (illum > 0.04) {
        var mg = ctx.createRadialGradient(bodyX, bodyY, 10, bodyX, bodyY, 260);
        mg.addColorStop(0, 'rgba(210,220,255,' + (0.28 * bodyVis * illum).toFixed(3) + ')');
        mg.addColorStop(1, 'rgba(210,220,255,0)');
        ctx.fillStyle = mg;
        ctx.fillRect(0, 0, W, HORIZON);
        // Mondscheibe mit korrekter Phase (Sichel / Halbmond / Vollmond)
        var R = 30;
        var litC = 'rgba(236,238,248,' + bodyVis.toFixed(3) + ')';
        var darkC = 'rgba(40,46,64,' + (0.55 * bodyVis).toFixed(3) + ')';
        var k = Math.cos(ph * 2 * Math.PI);           // 1 = Neumond, -1 = Vollmond
        var waxing = ph < 0.5;                        // zunehmend: rechte Seite hell
        ctx.fillStyle = darkC;
        ctx.beginPath(); ctx.arc(bodyX, bodyY, R, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = litC;
        ctx.beginPath();
        if (waxing) ctx.arc(bodyX, bodyY, R, -Math.PI / 2, Math.PI / 2);
        else ctx.arc(bodyX, bodyY, R, Math.PI / 2, Math.PI * 1.5);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = k > 0 ? darkC : litC;
        if (k > 0) { // Sichel: Schatten-Ellipse ueber die helle Haelfte legen
          ctx.save();
          ctx.beginPath();
          if (waxing) ctx.rect(bodyX, bodyY - R, R, 2 * R); else ctx.rect(bodyX - R, bodyY - R, R, 2 * R);
          ctx.clip();
          ctx.fillStyle = 'rgba(' + Math.round(top[0]) + ',' + Math.round(top[1]) + ',' + Math.round(top[2]) + ',1)';
          ctx.beginPath(); ctx.ellipse(bodyX, bodyY, Math.abs(k) * R, R, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = darkC;
          ctx.beginPath(); ctx.ellipse(bodyX, bodyY, Math.abs(k) * R, R, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        } else {     // mehr als halb: helle Ellipse in die dunkle Haelfte
          ctx.beginPath(); ctx.ellipse(bodyX, bodyY, Math.abs(k) * R, R, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // --- Wolken ---
    var nClouds = wk === 'fog' ? 2 : Math.round(cloudCover / 100 * 16) + (wk === 'storm' ? 4 : 0);
    var cLit = mix(hex('#2c3650'), hex('#ffffff'), light);
    if (golden > 0) cLit = mix(cLit, hex('#ffc49a'), golden * 0.8);
    var cShade = mix(hex('#0c111c'), hex('#9aa6b8'), light);
    if (wk === 'rain' || wk === 'storm') { cLit = mix(cLit, hex('#6c7584'), 0.6); cShade = mix(cShade, hex('#2b313b'), 0.6); }
    var crnd = rng(dayNo * 101 + 3);
    for (var c = 0; c < nClouds; c++) {
      var cy = 120 + crnd() * (HORIZON * 0.62);
      var sc = 0.55 + crnd() * 0.9 + cy / HORIZON * 0.3;
      cloud(ctx, crnd, crnd() * (W + 400) - 200, cy, sc, cLit, cShade, 0.22 + 0.25 * (cloudCover / 100));
    }
    if (wk === 'storm') {
      var lx = W * (0.25 + crnd() * 0.5);
      var lg = ctx.createRadialGradient(lx, 330, 10, lx, 330, 420);
      lg.addColorStop(0, 'rgba(220,215,255,0.35)');
      lg.addColorStop(1, 'rgba(220,215,255,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, W, HORIZON);
      ctx.strokeStyle = 'rgba(235,235,255,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      var bx = lx, by = 360;
      ctx.moveTo(bx, by);
      for (var b = 0; b < 7; b++) { bx += (crnd() - 0.5) * 70; by += 40 + crnd() * 30; ctx.lineTo(bx, by); }
      ctx.stroke();
    }

    // --- Berge (drei Schichten, hinten heller wegen Dunst) ---
    var mrnd = rng(4242);
    var far = mix(mix(hex('#0b1222'), hex('#6f8296'), light), hor, 0.45);
    var midM = mix(hex('#070c18'), hex('#45596b'), light);
    var near = mix(hex('#04070f'), hex('#24343f'), light);
    if (golden > 0) { far = mix(far, hex('#9a6f86'), golden * 0.45); midM = mix(midM, hex('#4a3a52'), golden * 0.4); }
    if (wk === 'snow') { far = mix(far, hex('#dfe6ee'), 0.55 * (0.3 + light)); midM = mix(midM, hex('#b7c2cf'), 0.4 * (0.3 + light)); }
    if (wk === 'fog') { far = mix(far, gcol, 0.7); midM = mix(midM, gcol, 0.5); }
    ridge(ctx, mrnd, HORIZON - 150, 150, 0.12, rgba(far), 0);
    ridge(ctx, mrnd, HORIZON - 60, 110, 0.18, rgba(midM), 3);
    ridge(ctx, mrnd, HORIZON + 10, 55, 0.25, rgba(near), 7);

    // --- See mit Spiegelung ---
    var wl = HORIZON + 30;
    var wg = ctx.createLinearGradient(0, wl, 0, H);
    wg.addColorStop(0, rgba(mix(hor, near, 0.35)));
    wg.addColorStop(0.5, rgba(mix(mid, near, 0.55)));
    wg.addColorStop(1, rgba(mix(top, near, 0.7)));
    ctx.fillStyle = wg;
    ctx.fillRect(0, wl, W, H - wl);
    // Uferlinie
    ctx.fillStyle = rgba(near);
    ctx.fillRect(0, wl - 4, W, 6);
    // Lichtsaeule von Sonne/Mond auf dem Wasser
    if (bodyVis > 0.15 && (s > -0.08 || (moon && moon.illum > 0.2))) {
      var colA = s > -0.08 ? 'rgba(255,214,150,' : 'rgba(215,225,255,';
      var strength = s > -0.08 ? 0.35 + golden * 0.4 : 0.25 * moon.illum;
      var prnd = rng(99);
      for (var y = wl + 4; y < H; y += 5) {
        var spread = 30 + (y - wl) * 0.35;
        var a = strength * bodyVis * (1 - (y - wl) / (H - wl) * 0.7) * (0.4 + prnd() * 0.6);
        ctx.fillStyle = colA + a.toFixed(3) + ')';
        ctx.fillRect(bodyX - spread * (0.3 + prnd() * 0.7), y, spread * 2 * (0.3 + prnd() * 0.7), 2);
      }
    }
    // Wellenlinien
    var wrnd = rng(7);
    for (var wv = 0; wv < 140; wv++) {
      var wy = wl + 8 + wrnd() * (H - wl - 8);
      ctx.fillStyle = 'rgba(255,255,255,' + (0.03 + 0.05 * light * wrnd()).toFixed(3) + ')';
      ctx.fillRect(wrnd() * W, wy, 40 + wrnd() * 160, 1.5);
    }

    // --- Niederschlag, Nebel ---
    if (wk === 'rain' || wk === 'storm') {
      var rr = rng(dayNo + 11);
      ctx.strokeStyle = 'rgba(200,212,230,' + (0.16 + 0.14 * light).toFixed(3) + ')';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      var drops = wk === 'storm' ? 1500 : 1000;
      for (var d = 0; d < drops; d++) {
        var rx = rr() * (W + 200) - 100, ry = rr() * H, len = 18 + rr() * 26;
        ctx.moveTo(rx, ry); ctx.lineTo(rx - len * 0.25, ry + len);
      }
      ctx.stroke();
    }
    if (wk === 'snow') {
      var sr = rng(dayNo + 13);
      for (var f = 0; f < 900; f++) {
        var fr = 1 + sr() * 2.6;
        ctx.fillStyle = 'rgba(255,255,255,' + (0.45 + sr() * 0.45).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(sr() * W, sr() * H, fr, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (wk === 'fog') {
      var fc = mix(hex('#3a414b'), hex('#d3d8df'), light);
      // dichter Schleier ueber allem, nach unten hin am staerksten
      var fgr = ctx.createLinearGradient(0, 0, 0, H);
      fgr.addColorStop(0, rgba(fc, 0.35));
      fgr.addColorStop(0.55, rgba(fc, 0.62));
      fgr.addColorStop(0.8, rgba(fc, 0.82));
      fgr.addColorStop(1, rgba(fc, 0.6));
      ctx.fillStyle = fgr;
      ctx.fillRect(0, 0, W, H);
      var fb = rng(dayNo + 17);
      for (var fbn = 0; fbn < 10; fbn++) {
        var by2 = HORIZON - 260 + fb() * 340;
        var bandG = ctx.createLinearGradient(0, by2 - 30, 0, by2 + 30);
        bandG.addColorStop(0, rgba(fc, 0));
        bandG.addColorStop(0.5, rgba(mix(fc, hex('#ffffff'), 0.2), 0.35));
        bandG.addColorStop(1, rgba(fc, 0));
        ctx.fillStyle = bandG;
        ctx.fillRect(0, by2 - 30, W, 60);
      }
    }

    // --- Beschriftung ---
    var phaseName;
    if (s >= 0.18) phaseName = 'Tag';
    else if (s >= -0.02) phaseName = sun.morning ? 'Sonnenaufgang' : 'Sonnenuntergang';
    else if (s >= -0.25) phaseName = 'Blaue Stunde';
    else phaseName = 'Nacht';
    var label;
    if (phaseName === 'Nacht' && starVis > 0.5) label = 'Sternenklare Nacht';
    else {
      var w = { clear: '', partly: 'leicht bewölkt', overcast: 'bedeckt', fog: 'Nebel', rain: 'Regen', snow: 'Schnee', storm: 'Gewitter' }[wk];
      label = phaseName + (w ? ' · ' + w : '');
    }
    if (moon && moon.illum > 0.04 && bodyVis > 0.2) label += ' · Mond ' + Math.round(moon.illum * 100) + ' %';

    var url;
    try { url = cv.toDataURL('image/jpeg', 0.88); } catch (e) { url = cv.toDataURL(); }
    return { url: url, label: label };
  }

  window.HomeScene = { render: render };
})();
