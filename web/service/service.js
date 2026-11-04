/*
 * Free My TV+: Hintergrund-Dienst "Zurueck zu Free My TV+".
 * Samsung erlaubt keiner App, sich als Startbildschirm einzutragen. Dieser Dienst schaut deshalb alle 1,5 Sekunden,
 * welche Apps laufen. Schliesst sich die App, die vorne war (Browser, Netflix, Einstellungen, TizenTube ...), holt er
 * Free My TV+ wieder nach vorne. Das Fernsehbild (tv-viewer) und unsichtbare Systemteile loesen nichts aus.
 * Die Startseite startet den Dienst; ein = Daten "enabled" = "1", aus = "0". Daten "ui" = "front"/"back": ob sie
 * gerade vorne ist; wird sie vorne beendet (Speicher voll, Absturz), holt der Dienst sie gleich zurueck.
 *
 * 1.9: Frueher reichte es, dass irgendeine sichtbare App endete, auch eine im Hintergrund. Dann sprang Free My TV+
 * mitten ins laufende TizenTube, oder es wurde, waehrend man darin fernsah, neu gestartet und stand im Menue.
 * Jetzt zaehlt nur noch die App, die vorne ist: zuletzt gestartet, solange Free My TV+ hinten ist.
 */
'use strict';

var UI = 'FMTVplusDL.FreeMyTVPlus';
var SKIP = /^(FMTVplusDL\.|org\.tizen\.tv-viewer|org\.volt\.|com\.samsung\.tv\.csfs|org\.tizen\.volume)/;
var visible = {}, running = null, timer = 0, enabled = true, uiFront = true, front = null, waitBack = 0;

function loadVisible() {
  try {
    tizen.application.getAppsInfo(function (list) {
      visible = {};
      for (var i = 0; i < list.length; i++) if (list[i].show) visible[list[i].id] = true;
    }, function () {});
  } catch (e) {}
}

function bringBack(kind) {
  setTimeout(function () {
    try {
      // "from" sagt der Startseite, warum sie geholt wird: nach einer anderen App ins Menue, nach einem Absturz weiter wie vorher
      var ac = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null,
        [new tizen.ApplicationControlData('from', [kind || 'app-closed'])]);
      tizen.application.launchAppControl(ac, UI, function () {}, function () {
        try { tizen.application.launch(UI, function () {}, function () {}); } catch (e2) {}
      });
    } catch (e) {
      try { tizen.application.launch(UI, function () {}, function () {}); } catch (e3) {}
    }
  }, 700);
}

function others(now) {
  var n = 0;
  for (var id in now) if (now.hasOwnProperty(id) && visible[id] && !SKIP.test(id)) n++;
  return n;
}

function poll() {
  if (!enabled) return;
  try {
    tizen.application.getAppsContext(function (list) {
      var now = {}, id;
      for (var i = 0; i < list.length; i++) now[list[i].appId] = true;
      if (running) {
        // Free My TV+ selbst verschwand, waehrend es vorne war (Speicher voll, Absturz): sofort zurueck, weiter wie vorher
        if (running[UI] && !now[UI] && uiFront) { running = now; bringBack('crashed'); return; }
        // eine neu gestartete sichtbare App ist die, die jetzt vorne ist
        for (id in now) if (now.hasOwnProperty(id) && !running[id] && visible[id] && !SKIP.test(id)) { front = id; clearTimeout(waitBack); waitBack = 0; }
        if (!uiFront) {
          var gone = null;
          if (front && running[front] && !now[front]) gone = front;   // die vordere App ist zu
          else if (!front) {   // unbekannt, welche vorne war: nur zurueck, wenn gar keine sichtbare App mehr laeuft
            for (id in running) if (running.hasOwnProperty(id) && !now[id] && visible[id] && !SKIP.test(id) && !others(now)) gone = id;
          }
          if (gone && !waitBack) {
            front = null;
            // kurz warten: manche Apps (TizenBrew) beenden sich und starten gleich die naechste
            waitBack = setTimeout(function () { waitBack = 0; if (!front && !uiFront) bringBack('app-closed'); }, 2500);
          }
        }
        // ist Free My TV+ vorne, kuemmern andere Apps, die im Hintergrund enden, nicht mehr
      }
      running = now;
    }, function () {});
  } catch (e) {}
}

function readRequest() {
  try {
    var req = tizen.application.getCurrentApplication().getRequestedAppControl();
    var data = req && req.appControl && req.appControl.data || [];
    for (var i = 0; i < data.length; i++) {
      if (data[i].key === 'enabled') enabled = data[i].value[0] !== '0';
      if (data[i].key === 'ui') {
        uiFront = data[i].value[0] !== 'back';
        if (uiFront) { front = null; clearTimeout(waitBack); waitBack = 0; }
      }
    }
  } catch (e) {}
}

module.exports.onStart = function () {
  readRequest();
  loadVisible();
  setInterval(loadVisible, 10 * 60000);   // neu installierte Apps
  timer = setInterval(poll, 1500);
};

module.exports.onRequest = function () {
  readRequest();
};

module.exports.onExit = function () {
  clearInterval(timer);
};
