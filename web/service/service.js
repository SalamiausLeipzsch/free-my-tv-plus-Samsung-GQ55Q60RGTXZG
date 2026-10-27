/*
 * Free My TV+: Hintergrund-Dienst "Zurueck zu Free My TV+".
 * Samsung erlaubt keiner App, sich als Startbildschirm einzutragen. Dieser Dienst schaut deshalb alle 1,5 Sekunden,
 * welche Apps laufen. Schliesst sich eine sichtbare App (Browser, Netflix, Einstellungen, TizenTube ...), holt er
 * Free My TV+ wieder nach vorne. Das Fernsehbild (tv-viewer) und unsichtbare Systemteile loesen nichts aus.
 * Die Startseite startet den Dienst; ein = Daten "enabled" = "1", aus = "0". Daten "ui" = "front"/"back": ob sie
 * gerade vorne ist; wird sie vorne beendet (Speicher voll, Absturz), holt der Dienst sie gleich zurueck.
 */
'use strict';

var UI = 'FMTVplusDL.FreeMyTVPlus';
var SKIP = /^(FMTVplusDL\.|org\.tizen\.tv-viewer|org\.volt\.|com\.samsung\.tv\.csfs|org\.tizen\.volume)/;
var visible = {}, running = null, timer = 0, enabled = true, uiFront = true;

function loadVisible() {
  try {
    tizen.application.getAppsInfo(function (list) {
      visible = {};
      for (var i = 0; i < list.length; i++) if (list[i].show) visible[list[i].id] = true;
    }, function () {});
  } catch (e) {}
}

function bringBack() {
  setTimeout(function () {
    try { tizen.application.launch(UI, function () {}, function () {}); } catch (e) {}
  }, 700);
}

function poll() {
  if (!enabled) return;
  try {
    tizen.application.getAppsContext(function (list) {
      var now = {};
      for (var i = 0; i < list.length; i++) now[list[i].appId] = true;
      if (running) {
        // 1.4: Free My TV+ selbst verschwand, waehrend es vorne war (Speicher voll, Absturz): sofort zurueckholen
        if (running[UI] && !now[UI] && uiFront) { running = now; bringBack(); return; }
        for (var id in running) {
          if (running.hasOwnProperty(id) && !now[id] && visible[id] && !SKIP.test(id)) { bringBack(); break; }
        }
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
      if (data[i].key === 'ui') uiFront = data[i].value[0] !== 'back';
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
  running = null;
};

module.exports.onExit = function () {
  clearInterval(timer);
};
