/* runner-dropin.js — AssaultRunner Bluetooth speedometer as its own Coach OS tab.
   Built from speed.html (same logic, same 'rsl.' saved history on this site). Renders inside a
   shadow root so its styles can't clash with Coach OS styles. Bluetooth needs Bluefy on iPhone/iPad. */
(function(){
if (window.RSL) return;
const RSL = window.RSL = {ver:'1.0'};
let ROOT = null, started = false;
const CSS = "\n/* Layout: gym-floor instrument. Live gauge first, setup beside it on iPad, rep log below. Dark only (read under gym lights). */\n:host{display:block;\n  --bg:#0c0c0d; --surface:#151517; --raise:#1c1c1f; --line:#2a2a2f;\n  --fg:#f2f1ee; --mute:#8d8c93; --red:#e0312b; --red-dim:#5a1b19;\n  --good:#3fb97f; --warn:#e8b23a; --rest:#4b8fd6;\n  --display:\"Syne\",ui-sans-serif,system-ui,sans-serif;\n  --body:\"DM Sans\",ui-sans-serif,system-ui,-apple-system,sans-serif;\n  --mono:\"DM Mono\",ui-monospace,\"SF Mono\",Menlo,monospace;\n  color-scheme:dark;\n}\n*{box-sizing:border-box}\n[hidden]{display:none!important}.wrap>*,.grid>*{min-width:0}#viewRun{width:100%;margin:0}td.empty{white-space:normal}.clock{flex:none;white-space:nowrap}.phase-row #stepLabel{flex:1 1 auto;min-width:0;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.rsl-root{background:var(--bg);color:var(--fg);border-radius:14px}\n.rsl-root{font:15px/1.45 var(--body);padding:4px 16px 24px;-webkit-tap-highlight-color:transparent;text-align:left}\n.wrap{max-width:1100px;margin:0 auto;display:flex;flex-direction:column;gap:14px}\nheader{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding-block:14px 4px}\n.brand{font:800 18px var(--display);letter-spacing:.02em;display:flex;align-items:center;gap:8px;margin-right:auto}\n.brand i{width:10px;height:10px;background:var(--red);display:inline-block;border-radius:2px}\n.brand small{font:500 11px var(--mono);color:var(--mute);letter-spacing:.08em;text-transform:uppercase}\n.pill{font:500 12px var(--mono);padding:6px 10px;border-radius:999px;border:1px solid var(--line);color:var(--mute);display:inline-flex;align-items:center;gap:7px}\n.pill b{width:8px;height:8px;border-radius:50%;background:var(--mute)}\n.pill.live{color:var(--fg)} .pill.live b{background:var(--good);box-shadow:0 0 0 3px #3fb97f33}\n.pill.sim b{background:var(--warn)} .pill.busy b{background:var(--warn)}\nbutton,select,input{font:inherit;color:inherit}\n.btn{background:var(--raise);border:1px solid var(--line);border-radius:10px;padding:10px 14px;font-weight:600;cursor:pointer;min-height:44px}\n.btn:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--red);outline-offset:2px}\n.btn.primary{background:var(--red);border-color:var(--red);color:#fff}\n.btn.ghost{background:transparent}\n.btn:disabled{opacity:.4;cursor:default}\n.notice{border:1px solid var(--warn);background:#2a2210;color:#f4dfae;border-radius:10px;padding:10px 12px;font-size:14px}\n.tabs{display:flex;gap:6px}\n.tab{background:none;border:0;border-bottom:2px solid transparent;padding:8px 4px;margin-right:12px;color:var(--mute);font:700 14px var(--display);letter-spacing:.04em;text-transform:uppercase;cursor:pointer}\n.tab[aria-selected=\"true\"]{color:var(--fg);border-color:var(--red)}\n.grid{display:grid;grid-template-columns:1fr;gap:14px}\n@media (min-width:820px){.grid{grid-template-columns:1.35fr 1fr}}\n.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px;min-width:0}\n.label{font:500 11px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--mute)}\n/* gauge */\n.gauge{display:flex;flex-direction:column;gap:10px;position:relative;overflow:hidden}\n.phase-row{display:flex;justify-content:space-between;align-items:center;gap:10px}\n.phase{font:800 15px var(--display);letter-spacing:.12em;padding:5px 10px;border-radius:6px;background:var(--raise);color:var(--mute)}\n.phase.work{background:var(--red);color:#fff} .phase.rest{background:#14263b;color:#9cc5f0} .phase.ready{background:#2a2210;color:var(--warn)} .phase.done{background:#123024;color:var(--good)}\n.clock{font:500 30px var(--mono);font-variant-numeric:tabular-nums}\n.dial svg{width:100%;max-width:460px;display:block;margin:0 auto;overflow:visible}\n.dial .trk{fill:none;stroke:var(--raise);stroke-width:14}\n.dial .red{fill:none;stroke:var(--red-dim);stroke-width:14}\n.dial .val{fill:none;stroke:var(--red);stroke-width:14;transition:d .25s ease-out}\n.dial .tk{stroke:var(--mute);stroke-width:1.5}\n.dial .tk.maj{stroke:var(--fg);stroke-width:2.5}\n.dial .tl{fill:var(--mute);font:500 13px var(--mono);text-anchor:middle;dominant-baseline:middle}\n.dial .tl.hot{fill:#ff8a84}\n.dial .ndl{fill:var(--red);transition:transform .25s ease-out}\n.dial .hub{fill:var(--fg)} .dial .hub2{fill:var(--bg)}\n.dial .pk{fill:var(--warn);transition:transform .25s ease-out}\n.dial .dig{fill:var(--fg);font:500 64px var(--mono);text-anchor:middle;font-variant-numeric:tabular-nums;letter-spacing:-2px}\n.dial .unit{fill:var(--mute);font:700 14px var(--display);text-anchor:middle;letter-spacing:3px}\n@media (prefers-reduced-motion:reduce){.dial .ndl,.dial .pk,.dial .val{transition:none}}\n.subline{display:flex;gap:18px;flex-wrap:wrap;font:400 13px var(--mono);color:var(--mute)}\n.subline b{color:var(--fg);font-weight:500}\n.bar{height:6px;background:var(--raise);border-radius:3px;overflow:hidden}\n.bar i{display:block;height:100%;width:0;background:var(--red);transition:width .1s linear}\n.bar.rest i{background:var(--rest)}\n.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;border-top:1px solid var(--line);padding-top:12px}\n.stat .n{font:500 24px var(--mono);font-variant-numeric:tabular-nums}\n.stat .n small{font-size:13px;color:var(--mute)}\n.target{font:500 13px var(--mono);color:var(--warn);min-height:1.2em}\n/* setup */\n.setup{display:flex;flex-direction:column;gap:12px}\n.field{display:flex;flex-direction:column;gap:5px;min-width:0}\n.field select,.field input{background:var(--raise);border:1px solid var(--line);border-radius:10px;padding:10px 12px;min-height:44px;width:100%}\n.row{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap}\n.row > .field{flex:1 1 90px}\n.desc{color:var(--mute);font-size:13.5px}\n.check{display:flex;align-items:center;gap:8px;font-size:14px}\n.check input{width:20px;height:20px;accent-color:var(--red)}\n.actions{display:flex;gap:8px}\n.actions .btn{flex:1}\n/* table */\n.tablewrap{overflow-x:auto}\ntable{width:100%;border-collapse:collapse;font:400 14px var(--mono);font-variant-numeric:tabular-nums}\nth{font:500 11px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--mute);text-align:right;padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}\ntd{text-align:right;padding:8px;border-bottom:1px solid var(--line);white-space:nowrap}\nth:first-child,td:first-child,th:nth-child(2),td:nth-child(2){text-align:left}\ntr.anchor td{color:var(--mute)}\ntr.miss td:nth-child(6){color:var(--red)}\ntr.ok td:nth-child(6){color:var(--good)}\n.tag{font-size:11px;padding:2px 6px;border-radius:4px;background:var(--raise);color:var(--mute)}\n.tag.kill{background:var(--red-dim);color:#ffb3ae}\n.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}\n.summary .stat{background:var(--raise);border-radius:10px;padding:10px 12px}\n.empty{color:var(--mute);font-size:14px;padding:6px 0}\ndetails summary{cursor:pointer;color:var(--mute);font:500 12px var(--mono);letter-spacing:.06em;text-transform:uppercase}\npre.raw{font:400 12px/1.5 var(--mono);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;max-height:220px;overflow:auto;white-space:pre;margin:10px 0 0}\n.hist{display:flex;flex-direction:column;gap:10px}\n.hitem{background:var(--raise);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:6px}\n.hitem .top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}\n.hitem .top b{font:700 15px var(--display)}\n.hitem .meta{font:400 13px var(--mono);color:var(--mute);display:flex;gap:14px;flex-wrap:wrap}\n.hitem .meta b{color:var(--fg);font-weight:500}\n@media (prefers-reduced-motion:reduce){.bar i{transition:none}}\n";
const HTML = "\n<div class=\"wrap\">\n  <header>\n    <div class=\"brand\"><i></i>AssaultRunner <small>Bluetooth speed</small></div>\n    <span class=\"pill\" id=\"pill\"><b></b><span id=\"pillText\">Not connected</span></span>\n    <button class=\"btn primary\" id=\"btnConnect\">Connect runner</button>\n    <button class=\"btn ghost\" id=\"btnSim\">Simulator</button>\n  </header>\n  <div class=\"notice\" id=\"noBt\" hidden>This browser can't use Bluetooth. On iPhone or iPad, open Coach OS in the free <b>Bluefy</b> browser to connect the runner. The simulator works anywhere.</div>\n  <div class=\"notice\" id=\"errBox\" hidden></div>\n\n  <nav class=\"tabs\" role=\"tablist\">\n    <button class=\"tab\" role=\"tab\" id=\"tabRun\" aria-selected=\"true\">Run</button>\n    <button class=\"tab\" role=\"tab\" id=\"tabHist\" aria-selected=\"false\">History</button>\n  </nav>\n\n  <section id=\"viewRun\" class=\"wrap\" style=\"gap:14px\">\n    <div class=\"grid\">\n      <div class=\"card gauge\">\n        <div class=\"phase-row\">\n          <span class=\"phase\" id=\"phase\">IDLE</span>\n          <span class=\"label\" id=\"stepLabel\">Pick a test and press Start</span>\n          <span class=\"clock\" id=\"clock\">--</span>\n        </div>\n        <div class=\"bar\" id=\"bar\"><i id=\"barFill\"></i></div>\n        <div class=\"dial\"><svg id=\"dial\" viewBox=\"-6 -4 312 246\" role=\"img\" aria-label=\"Speedometer\">\n          <path class=\"trk\" id=\"dTrk\"/><path class=\"red\" id=\"dRed\"/><path class=\"val\" id=\"dVal\"/>\n          <g id=\"dTicks\"></g>\n          <polygon class=\"pk\" id=\"dPk\" points=\"272,150 286,143 286,157\"/>\n          <polygon class=\"ndl\" id=\"dNdl\" points=\"138,146 262,150 138,154\"/>\n          <circle class=\"hub\" cx=\"150\" cy=\"150\" r=\"11\"/><circle class=\"hub2\" cx=\"150\" cy=\"150\" r=\"4\"/>\n          <text class=\"dig\" id=\"mph\" x=\"150\" y=\"216\">0.0</text>\n          <text class=\"unit\" x=\"150\" y=\"236\">MPH</text>\n        </svg></div>\n        <div class=\"subline\">\n          <span><b id=\"kmh\">0.0</b> km/h</span>\n          <span>rep peak <b id=\"repPeak\">\u2013</b> <i style=\"color:var(--warn);font-style:normal\">\u25b2</i></span>\n          <span>rep <b id=\"repYd\">\u2013</b> yd</span>\n        </div>\n        <div class=\"target\" id=\"target\"></div>\n        <div class=\"stats\">\n          <div class=\"stat\"><div class=\"label\">Best peak</div><div class=\"n\" id=\"bestPeak\">\u2013<small> mph</small></div></div>\n          <div class=\"stat\"><div class=\"label\">Session peak</div><div class=\"n\" id=\"sessPeak\">\u2013<small> mph</small></div></div>\n          <div class=\"stat\"><div class=\"label\">Decrement</div><div class=\"n\" id=\"dec\">\u2013<small> %</small></div></div>\n        </div>\n      </div>\n\n      <div class=\"card setup\">\n        <div class=\"row\">\n          <div class=\"field\"><label class=\"label\" for=\"athlete\">Athlete</label><select id=\"athlete\"></select></div>\n          <div class=\"field\" style=\"flex:0 0 auto\"><button class=\"btn\" id=\"btnAddAth\" hidden style=\"display:none\">Add</button></div>\n        </div>\n        <div class=\"row\" id=\"addRow\" hidden>\n          <div class=\"field\"><label class=\"label\" for=\"newAth\">Name</label><input id=\"newAth\" autocomplete=\"off\" placeholder=\"e.g. Kailea Silva\"></div>\n          <div class=\"field\" style=\"flex:0 0 auto\"><button class=\"btn primary\" id=\"btnSaveAth\">Save</button></div>\n        </div>\n        <div class=\"field\"><label class=\"label\" for=\"proto\">Test</label><select id=\"proto\"></select></div>\n        <div class=\"desc\" id=\"protoDesc\"></div>\n        <div class=\"row\">\n          <div class=\"field\"><label class=\"label\" for=\"fWork\">Work s</label><input id=\"fWork\" type=\"number\" inputmode=\"numeric\" min=\"1\"></div>\n          <div class=\"field\" id=\"wrapRest\"><label class=\"label\" for=\"fRest\">Rest s</label><input id=\"fRest\" type=\"number\" inputmode=\"numeric\" min=\"0\"></div>\n          <div class=\"field\" id=\"wrapLadder\" hidden><label class=\"label\" for=\"fLadder\">Rests s</label><input id=\"fLadder\" inputmode=\"numeric\"></div>\n          <div class=\"field\" id=\"wrapReps\"><label class=\"label\" for=\"fReps\">Reps</label><input id=\"fReps\" type=\"number\" inputmode=\"numeric\" min=\"1\"></div>\n        </div>\n        <div class=\"row\">\n          <div class=\"field\"><label class=\"label\" for=\"fSets\">Sets</label><input id=\"fSets\" type=\"number\" inputmode=\"numeric\" min=\"1\"></div>\n          <div class=\"field\"><label class=\"label\" for=\"fSetRest\">Set rest s</label><input id=\"fSetRest\" type=\"number\" inputmode=\"numeric\" min=\"0\"></div>\n          <div class=\"field\"><label class=\"label\" for=\"fAnchor\">Anchor reps</label><input id=\"fAnchor\" type=\"number\" inputmode=\"numeric\" min=\"0\"></div>\n        </div>\n        <div class=\"row\">\n          <label class=\"check\"><input type=\"checkbox\" id=\"fKill\"> Kill rule: stop the set after 2 reps in a row under</label>\n          <div class=\"field\" style=\"flex:0 0 80px\"><input id=\"fKillPct\" type=\"number\" inputmode=\"numeric\" min=\"50\" max=\"100\" aria-label=\"Kill threshold percent\"></div>\n          <span class=\"desc\">% of anchor avg speed</span>\n        </div>\n        <div class=\"actions\">\n          <button class=\"btn primary\" id=\"btnStart\">Start</button>\n          <button class=\"btn\" id=\"btnStop\" disabled>Stop</button>\n          <button class=\"btn ghost\" id=\"btnResetPeak\">Reset peak</button>\n        </div>\n      </div>\n    </div>\n\n    <div class=\"card\">\n      <div class=\"phase-row\" style=\"margin-bottom:8px\"><span class=\"label\">Reps</span><span class=\"label\" id=\"rate\"></span></div>\n      <div class=\"tablewrap\">\n        <table>\n          <thead><tr><th>#</th><th>Type</th><th>Peak mph</th><th>Avg mph</th><th>Yards</th><th>% of ref</th></tr></thead>\n          <tbody id=\"repBody\"><tr><td colspan=\"6\" class=\"empty\" style=\"text-align:left\">Reps show up here as you go. Distance is the belt distance during the work window.</td></tr></tbody>\n        </table>\n      </div>\n      <div class=\"summary\" id=\"summary\" hidden style=\"margin-top:12px\"></div>\n    </div>\n\n    <div class=\"card\">\n      <details id=\"rawDetails\">\n        <summary>Raw Bluetooth packets</summary>\n        <p class=\"desc\">If the speed here doesn't match the console, screenshot this panel and send it to Claude.</p>\n        <pre class=\"raw\" id=\"raw\">No packets yet.</pre>\n      </details>\n    </div>\n  </section>\n\n  <section id=\"viewHist\" hidden>\n    <div class=\"card\">\n      <div class=\"row\" style=\"justify-content:space-between;margin-bottom:12px\">\n        <div class=\"field\"><label class=\"label\" for=\"histAth\">Athlete</label><select id=\"histAth\"></select></div>\n        <div class=\"field\" style=\"flex:0 0 auto\"><button class=\"btn\" id=\"btnCsv\">Copy CSV</button></div>\n        <div class=\"field\" style=\"flex:0 0 auto\"><button class=\"btn\" id=\"btnDl\">Download CSV</button></div>\n      </div>\n      <div class=\"hist\" id=\"histList\"></div>\n      <p class=\"desc\" id=\"csvMsg\"></p>\n    </div>\n  </section>\n</div>\n\n";
function mount(){
  const nav = document.getElementById('nav'), pages = document.getElementById('pages');
  if (!nav || !pages) return false;
  if (!document.getElementById('rsl-fonts')){
    const l = document.createElement('link'); l.id = 'rsl-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap';
    document.head.appendChild(l);
  }
  if (!document.getElementById('rsl-navcss')){
    // Shell's phone nav is a 4-column grid; with Lab + Top Speed that wraps to 2 rows. Keep every tab on one row.
    const st = document.createElement('style'); st.id = 'rsl-navcss';
    st.textContent = '@media (max-width:899px){#nav{grid-template-columns:none !important;grid-auto-flow:column !important;grid-auto-columns:minmax(0,1fr) !important;}#nav .tab{min-width:0 !important;padding-left:1px !important;padding-right:1px !important;letter-spacing:.04em !important;}}@media (max-width:430px){#nav-wrap #nav .tab{font-size:8.5px !important;letter-spacing:.01em !important;}}';
    document.head.appendChild(st);
  }
  if (!document.getElementById('pg-runner')){
    const pg = document.createElement('div'); pg.className = 'page'; pg.id = 'pg-runner';
    pg.innerHTML = '<div class="ph"><div><div class="ph-title">TOP SPEED</div><div class="ph-sub">AssaultRunner live speed &middot; interval tests</div></div></div><div id="rsl-host"></div>';
    pages.appendChild(pg);
    ROOT = pg.querySelector('#rsl-host').attachShadow({mode:'open'});
    ROOT.innerHTML = '<style>' + CSS + '</style><div class="rsl-root">' + HTML + '</div>';
  }
  addTab(nav);
  if (typeof pageInits === 'object') pageInits.runner = open;
  return true;
}
function addTab(nav){
  if (!nav || nav.querySelector('.tab[data-page="runner"]')) return;
  {
    const t = document.createElement('div'); t.className = 'tab'; t.dataset.page = 'runner'; t.setAttribute('onclick', "go('runner')");
    t.innerHTML = '<span class="ti">\u23F1\uFE0F</span>Top Speed';
    nav.appendChild(t); // last tab, after Studio
    if (typeof S === 'object' && S.page === 'runner') t.classList.add('active');
  }
}
function open(){
  if (!started){ started = true; RSL.init(); }
  else RSL.renderAthletes();
  RSL.renderLive();
}

'use strict';
/* ===================== Pure logic (tested) ===================== */
const KMH_TO_MPH = 0.621371;
const YD_PER_S_PER_MPH = 1760 / 3600;
const FTMS_SERVICE = 0x1826, TREADMILL_DATA = 0x2acd;

// FTMS Treadmill Data (0x2ACD). Flags uint16 LE.
// bit0 "More Data": when 0, Instantaneous Speed (uint16, 0.01 km/h) IS present.
// bit1 Average Speed (uint16, 0.01 km/h). bit2 Total Distance (uint24, 1 m).
// Later fields (pace, energy, time…) aren't needed; we keep our own clock.
function parseTreadmillData(dv){
  const out = {flags:null, speedKmh:null, avgKmh:null, distM:null};
  if (!dv || dv.byteLength < 2) return out;
  const f = dv.getUint16(0, true); let o = 2; out.flags = f;
  if (!(f & 0x01)){ if (dv.byteLength < o+2) return out; out.speedKmh = dv.getUint16(o, true)/100; o += 2; }
  if (f & 0x02){ if (dv.byteLength < o+2) return out; out.avgKmh = dv.getUint16(o, true)/100; o += 2; }
  if (f & 0x04){ if (dv.byteLength < o+3) return out; out.distM = dv.getUint8(o) | (dv.getUint8(o+1)<<8) | (dv.getUint8(o+2)<<16); o += 3; }
  return out;
}
function encodeTreadmillData({speedKmh=null, avgKmh=null, distM=null}){
  let f = 0, bytes = [];
  if (speedKmh == null) f |= 0x01; else { const v = Math.round(speedKmh*100); bytes.push(v & 255, v >> 8 & 255); }
  if (avgKmh != null){ f |= 0x02; const v = Math.round(avgKmh*100); bytes.push(v & 255, v >> 8 & 255); }
  if (distM != null){ f |= 0x04; const v = Math.round(distM); bytes.push(v & 255, v >> 8 & 255, v >> 16 & 255); }
  const arr = new Uint8Array([f & 255, f >> 8 & 255, ...bytes]);
  return new DataView(arr.buffer);
}
// Exact 21-byte layout captured from AssaultRunner332369 (flags 0x14A6):
// speed u16, avg u16, dist u24, pace u8, kcal u16, kcal/h u16, kcal/min u8, time u16, force s16, power s16
function encodeAssault({speedKmh, distM, secs, kcal=0, watts=0}){
  const u16 = v => [v & 255, v >> 8 & 255], sp = Math.round(speedKmh*100), d = Math.round(distM);
  return new DataView(new Uint8Array([0xA6,0x14, ...u16(sp), 0,0, d & 255, d >> 8 & 255, d >> 16 & 255, 1,
    ...u16(Math.round(kcal)), 0xFF,0xFF, 0xFF, ...u16(Math.round(secs)), 0xFF,0x7F, ...u16(Math.round(watts))]).buffer);
}
function hex(dv){ const a=[]; for(let i=0;i<dv.byteLength;i++) a.push(dv.getUint8(i).toString(16).padStart(2,'0').toUpperCase()); return a.join(' '); }

const PRESETS = {
  t1020:  {name:'10 on / 20 off', desc:'10 s sprint, 20 s rest. Tracks peak speed, yards per rep and how much output fades (decrement).', work:10, rest:20, reps:10, sets:1, setRest:0, anchor:0, kill:false, killPct:90},
  top:    {name:'Top speed', desc:'3 × 6 s all-out with 2 min rest. Best peak is the score.', work:6, rest:120, reps:3, sets:1, setRest:0, anchor:0, kill:false, killPct:90},
  rsa:    {name:'RSA with kill rule', desc:'3 × 8 s anchor reps (90 s rest) set the reference. Then 10 on / 20 off; the test ends after 2 reps in a row under the threshold.', work:10, rest:20, reps:12, sets:1, setRest:0, anchor:3, anchorWork:8, anchorRest:90, toMain:180, kill:true, killPct:90},
  ladder: {name:'Rest ladder', desc:'3 × 8 s anchor reps, then sets of 10 s sprints with rest shrinking between reps. A set ends early after 2 reps in a row under the threshold.', work:10, ladder:[50,40,30,20], sets:3, setRest:180, anchor:3, anchorWork:8, anchorRest:90, toMain:180, kill:true, killPct:90},
  custom: {name:'Custom intervals', desc:'Set your own work, rest, reps and sets.', work:15, rest:45, reps:6, sets:1, setRest:120, anchor:0, kill:false, killPct:90}
};

function buildSteps(c){
  const s = [{type:'ready', dur:5, label:'Get ready'}];
  const aw = c.anchorWork || c.work, ar = c.anchorRest ?? 90;
  for (let i=0;i<(c.anchor||0);i++){
    s.push({type:'work', group:'anchor', set:-1, dur:aw, label:`Anchor ${i+1} of ${c.anchor}`});
    s.push({type:'rest', set:-1, dur: i < c.anchor-1 ? ar : (c.toMain ?? 180), label: i < c.anchor-1 ? 'Rest' : 'Rest before main set', brk: i === c.anchor-1});
  }
  const ladder = Array.isArray(c.ladder) && c.ladder.length ? c.ladder : null;
  const reps = ladder ? ladder.length + 1 : c.reps;
  let n = 0;
  for (let set=0; set<c.sets; set++){
    for (let r=0; r<reps; r++){
      n++;
      s.push({type:'work', group:'main', set, dur:c.work, label: c.sets>1 ? `Set ${set+1} · rep ${r+1} of ${reps}` : `Rep ${r+1} of ${reps}`});
      if (r < reps-1) s.push({type:'rest', set, dur: ladder ? ladder[r] : c.rest, label:'Rest'});
      else if (set < c.sets-1) s.push({type:'rest', set, dur:c.setRest, label:'Set rest', brk:true});
    }
  }
  return s.filter(x => x.dur > 0);
}

// Kill rule compares AVERAGE SPEED, not yards, so an 8 s anchor and a 10 s rep are comparable.
// Reference: best anchor rep if any, otherwise best main rep before this one.
function anchorAvg(reps){
  const a = reps.filter(r => r.group==='anchor').map(r => r.avg);
  return a.length ? Math.max(...a) : null;
}
function anchorYards(reps){
  const a = reps.filter(r => r.group==='anchor').map(r => r.yards);
  if (a.length) return Math.max(...a);
  return null;
}
function referenceFor(reps){
  const a = anchorAvg(reps); if (a != null) return a;
  const m = reps.filter(r => r.group==='main').map(r => r.avg);
  return m.length ? Math.max(...m) : null;
}
// Fitzsimons decrement on main-rep yards: 100 × (1 − total / (best × n))
function decrement(reps){
  const m = reps.filter(r => r.group==='main').map(r => r.yards);
  if (m.length < 2) return null;
  const best = Math.max(...m); if (!best) return null;
  return 100 * (1 - m.reduce((a,b)=>a+b,0) / (best*m.length));
}
// Given the rep just finished, decide kill. Returns {pct, miss, kill}.
function judgeRep(prior, rep, cfg, missCount){
  if (rep.group !== 'main') return {pct:null, miss:false, kill:false, missCount};
  const ref = referenceFor(prior);
  if (ref == null || !ref) return {pct:null, miss:false, kill:false, missCount:0};
  const pct = 100 * rep.avg / ref;
  if (!cfg.kill) return {pct, miss:false, kill:false, missCount:0};
  const miss = pct < cfg.killPct;
  const mc = miss ? missCount + 1 : 0;
  return {pct, miss, kill: mc >= 2, missCount: mc};
}
// After a kill in `set`, return index of the next step to run (set-break rest of that set, or end).
function skipAfterKill(steps, idx, set){
  for (let i=idx+1;i<steps.length;i++){
    if (steps[i].set === set && steps[i].brk) return i;
    if (steps[i].set > set) return i;
  }
  return steps.length;
}
// Sample-and-hold integration of belt distance across a work window.
function makeRep(group, label, startT){ return {group, label, startT, endT:null, peak:0, yards:0, lastT:startT, lastMph:null}; }
function addSample(rep, t, mph){
  if (rep.lastMph != null && t > rep.lastT){ const dt = Math.min((t - rep.lastT)/1000, 2.5); rep.yards += ((rep.lastMph + mph)/2) * dt * YD_PER_S_PER_MPH; }
  rep.lastT = Math.max(rep.lastT, t); rep.lastMph = mph; if (mph > rep.peak) rep.peak = mph;
}
function closeRep(rep, endT){
  if (rep.lastMph != null && endT > rep.lastT){ const dt = Math.min((endT - rep.lastT)/1000, 2.5); rep.yards += rep.lastMph * dt * YD_PER_S_PER_MPH; }
  rep.lastT = endT; rep.endT = endT;
  const secs = (endT - rep.startT)/1000; rep.avg = secs > 0 ? rep.yards / YD_PER_S_PER_MPH / secs : 0;
  return rep;
}

/* ===================== App ===================== */
const $ = id => ROOT.getElementById(id);
const store = {
  get(k, d){ try { const v = localStorage.getItem('rsl.'+k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem('rsl.'+k, JSON.stringify(v)); } catch(e){} }
};
const app = {
  device:null, char:null, mode:'off', live:{mph:0, t:0}, sessPeak:0,
  packets:[], rateTimes:[], run:null, sim:null, wake:null,
  athletes: [], history: store.get('history', [])
};

/* ---------- audio ---------- */
let actx = null;
function beep(freq=880, ms=120){
  try { actx = actx || new (window.AudioContext||window.webkitAudioContext)(); const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(actx.destination); g.gain.setValueAtTime(.25, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, actx.currentTime + ms/1000); o.start(); o.stop(actx.currentTime + ms/1000); } catch(e){}
}

/* ---------- connection ---------- */
function setPill(kind, text){ const p = $('pill'); p.className = 'pill ' + kind; $('pillText').textContent = text; }
function showErr(msg){ const e = $('errBox'); e.textContent = msg; e.hidden = !msg; }

async function connect(){
  showErr('');
  if (!navigator.bluetooth){ $('noBt').hidden = false; return; }
  stopSim();
  try {
    setPill('busy', 'Pick the runner…');
    if (!app.device){
      app.device = await navigator.bluetooth.requestDevice({
        filters:[{services:[FTMS_SERVICE]}, {namePrefix:'Assault'}],
        optionalServices:[FTMS_SERVICE, 0x180f]
      });
      app.device.addEventListener('gattserverdisconnected', onDisconnect);
    }
    setPill('busy', 'Connecting…');
    const server = await app.device.gatt.connect();
    let svc;
    try { svc = await server.getPrimaryService(FTMS_SERVICE); }
    catch(e){
      let list = '';
      try { list = (await server.getPrimaryServices()).map(s => s.uuid).join('\n'); } catch(_){}
      $('raw').textContent = 'Fitness Machine service not found. Services on device:\n' + (list || '(none readable)');
      $('rawDetails').open = true;
      throw new Error('Connected, but the runner did not expose the Fitness Machine service. The raw panel lists what it did expose. Send a screenshot of it.');
    }
    app.char = await svc.getCharacteristic(TREADMILL_DATA);
    app.char.addEventListener('characteristicvaluechanged', ev => onPacket(ev.target.value, performance.now()));
    await app.char.startNotifications();
    app.mode = 'ble'; setPill('live', app.device.name || 'Runner');
    $('btnConnect').textContent = 'Disconnect';
  } catch(e){
    setPill('', 'Not connected');
    if (e && e.name === 'NotFoundError') return; // user closed the picker
    showErr((e && e.message) || 'Could not connect. Close any other app connected to the runner (Assault, Zwift, Wahoo, nRF Connect), wake the console, and try again.');
  }
}
function disconnect(){ if (app.device && app.device.gatt.connected) app.device.gatt.disconnect(); }
function onDisconnect(){
  app.mode = 'off'; app.char = null; setPill('', 'Disconnected');
  $('btnConnect').textContent = 'Reconnect';
  if (app.run && !app.run.done) showErr('The runner disconnected mid-test. Reps already finished are kept. Tap Reconnect; the test keeps running.');
}

/* ---------- packets ---------- */
function onPacket(dv, t){
  const p = parseTreadmillData(dv);
  app.packets.unshift(`${new Date().toLocaleTimeString()}  ${hex(dv).padEnd(26)}  ${p.speedKmh != null ? p.speedKmh.toFixed(2)+' km/h' : '(no speed)'}${p.distM != null ? '  '+p.distM+' m' : ''}`);
  if (app.packets.length > 40) app.packets.length = 40;
  if ($('rawDetails').open) $('raw').textContent = app.packets.join('\n');
  if (p.speedKmh == null) return;
  const mph = p.speedKmh * KMH_TO_MPH;
  app.live = {mph, kmh:p.speedKmh, t};
  app.rateTimes.push(t); while (app.rateTimes.length && t - app.rateTimes[0] > 5000) app.rateTimes.shift();
  if (mph > app.sessPeak) app.sessPeak = mph;
  const r = app.run;
  if (r){
    if (r.rep && t >= r.rep.startT) addSample(r.rep, t, mph);
    // Console data trails the belt slightly; let a just-finished rep's PEAK take samples for 0.75 s.
    if (r.graceRep && t - r.graceRep.endT < 750 && mph > r.graceRep.peak){ r.graceRep.peak = mph; renderReps(); }
  }
  renderLive();
}

/* ---------- simulator (feeds encoded FTMS bytes through the same parser) ---------- */
function startSim(){
  showErr(''); disconnect();
  app.mode = 'sim'; setPill('sim', 'Simulator');
  const sim = app.sim = {v:0, dist:0, last:performance.now(), mainDone:0, top:20 + Math.random()*2.5};
  sim.timer = setInterval(() => {
    const now = performance.now(), dt = (now - sim.last)/1000; sim.last = now;
    const r = app.run, step = r && !r.done ? r.steps[r.idx] : null;
    let target;
    if (step && step.type === 'work'){
      const n = r.reps.filter(x=>x.group==='main').length;
      target = sim.top * (step.group==='anchor' ? 1 : (1 - 0.018*n)) * (0.97 + Math.random()*0.06);
    } else target = r && !r.done ? 0 : 3.2;
    const tau = target > sim.v ? 1.1 : 0.7;
    sim.v += (target - sim.v) * (1 - Math.exp(-dt/tau));
    const kmh = Math.max(0, sim.v / KMH_TO_MPH);
    sim.dist += kmh/3.6*dt;
    sim.secs = (sim.secs||0) + dt; onPacket(encodeAssault({speedKmh:kmh, distM:sim.dist, secs:sim.secs, kcal:sim.secs/9, watts:kmh*12}), now);
  }, 250);
  $('btnSim').textContent = 'Stop simulator';
}
function stopSim(){ if (app.sim){ clearInterval(app.sim.timer); app.sim = null; } if (app.mode === 'sim'){ app.mode = 'off'; setPill('', 'Not connected'); } $('btnSim').textContent = 'Simulator'; }

/* ---------- test engine ---------- */
function readCfg(){
  const key = $('proto').value, p = PRESETS[key];
  const num = (id, d) => { const v = parseFloat($(id).value); return isFinite(v) ? v : d; };
  const cfg = Object.assign({}, p, {
    key, work:num('fWork', p.work), rest:num('fRest', p.rest ?? 0), reps:Math.max(1, num('fReps', p.reps ?? 1)),
    sets:Math.max(1, num('fSets', p.sets)), setRest:num('fSetRest', p.setRest), anchor:Math.max(0, num('fAnchor', p.anchor)),
    kill:$('fKill').checked, killPct:num('fKillPct', p.killPct)
  });
  if (p.ladder){ const l = $('fLadder').value.split(/[,\s]+/).map(Number).filter(x=>x>0); cfg.ladder = l.length ? l : p.ladder; }
  return cfg;
}
function startRun(){
  showErr('');
  if (app.mode === 'off'){ showErr('Connect the runner (or open the simulator) first.'); return; }
  if (!$('athlete').value){ showErr('Add or pick an athlete first so the result saves to them.'); return; }
  const cfg = readCfg();
  app.run = {cfg, athlete:$('athlete').value, steps:buildSteps(cfg), idx:0, stepStart:performance.now(), reps:[], rep:null, graceRep:null, missCount:0, lastBeep:null, done:false, startedAt:new Date().toISOString()};
  $('summary').hidden = true; $('btnStart').disabled = true; $('btnStop').disabled = false;
  beep(660, 90);
  try { navigator.wakeLock && navigator.wakeLock.request('screen').then(w => app.wake = w).catch(()=>{}); } catch(e){}
  enterStep();
  renderReps();
}
function enterStep(){
  const r = app.run, s = r.steps[r.idx];
  r.stepStart = performance.now(); r.lastBeep = null;
  if (s.type === 'work'){ r.rep = makeRep(s.group, s.label, r.stepStart); r.rep.lastMph = app.live.mph; beep(1175, 260); }
}
function finishStep(){
  const r = app.run, s = r.steps[r.idx];
  let next = r.idx + 1;
  if (s.type === 'work' && r.rep){
    const rep = closeRep(r.rep, performance.now());
    const j = judgeRep(r.reps, rep, r.cfg, r.missCount);
    rep.pct = j.pct; rep.miss = j.miss; rep.kill = j.kill; r.missCount = j.missCount;
    r.reps.push(rep); r.graceRep = rep; r.rep = null;
    beep(520, 300);
    if (j.kill){ next = skipAfterKill(r.steps, r.idx, s.set); r.missCount = 0; }
    renderReps();
  }
  r.idx = next;
  if (r.idx >= r.steps.length) return endRun(false);
  enterStep();
}
function endRun(stopped){
  const r = app.run; if (!r || r.done) return;
  if (r.rep){ const rep = closeRep(r.rep, performance.now()); rep.partial = true; r.rep = null; if (stopped && (rep.endT - rep.startT) > 1500){ r.reps.push(rep); } }
  r.done = true; r.stopped = stopped;
  $('btnStart').disabled = false; $('btnStop').disabled = true;
  try { app.wake && app.wake.release(); } catch(e){}
  beep(880,120); setTimeout(()=>beep(880,120),180);
  if (r.reps.length) saveResult(r);
  renderReps(); renderSummary(r); renderLive();
}
function tick(){
  const r = app.run;
  if (r && !r.done){
    const s = r.steps[r.idx], el = (performance.now() - r.stepStart)/1000, left = s.dur - el;
    if (s.type !== 'work'){ const sec = Math.ceil(left); if (sec <= 3 && sec >= 1 && r.lastBeep !== sec){ r.lastBeep = sec; beep(880, 90); } }
    if (left <= 0) finishStep();
  }
  renderLive();
}

/* ---------- results ---------- */
function summarize(r){
  const main = r.reps.filter(x=>x.group==='main'), all = r.reps;
  const best = all.length ? Math.max(...all.map(x=>x.peak)) : 0;
  const mainYd = main.map(x=>x.yards);
  return {
    bestPeak:best, reps:main.length, anchor:anchorAvg(all),
    bestYd: mainYd.length ? Math.max(...mainYd) : (all.length ? Math.max(...all.map(x=>x.yards)) : 0),
    totalYd: mainYd.reduce((a,b)=>a+b,0), dec:decrement(all),
    kills: main.filter(x=>x.kill).length
  };
}
function saveResult(r){
  const sum = summarize(r);
  app.history.unshift({id:Date.now(), athlete:r.athlete, test:r.cfg.name, date:r.startedAt, src:app.mode === 'sim' ? 'sim' : 'runner', stopped:!!r.stopped, sum,
    reps:r.reps.map((x,i)=>({n:i+1, group:x.group, peak:+x.peak.toFixed(2), avg:+(x.avg||0).toFixed(2), yards:+x.yards.toFixed(1), pct:x.pct==null?null:+x.pct.toFixed(1), kill:!!x.kill}))});
  store.set('history', app.history); renderHist();
}

/* ---------- speedometer dial ---------- */
const G = {cx:150, cy:150, r:120, a0:150, sweep:240, max:0, hot:20};
function polar(r, deg){ const t = deg*Math.PI/180; return [G.cx + r*Math.cos(t), G.cy + r*Math.sin(t)]; }
function ang(v){ return G.a0 + G.sweep * Math.max(0, Math.min(v, G.max)) / G.max; }
function arcPath(r, v0, v1){
  const d0 = ang(v0), d1 = Math.max(ang(v1), d0 + 0.01), [x0,y0] = polar(r,d0), [x1,y1] = polar(r,d1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${d1-d0>180?1:0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
function buildDial(max){
  if (G.max === max) return; G.max = max;
  let h = '';
  for (let v=0; v<=max; v++){
    const maj = v % 5 === 0, d = ang(v), [x0,y0] = polar(G.r - 9 - (maj?12:5), d), [x1,y1] = polar(G.r - 9, d);
    h += `<line class="tk${maj?' maj':''}" x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"/>`;
    if (maj){ const [tx,ty] = polar(G.r - 36, d); h += `<text class="tl${v>=G.hot?' hot':''}" x="${tx.toFixed(1)}" y="${ty.toFixed(1)}">${v}</text>`; }
  }
  $('dTicks').innerHTML = h;
  $('dTrk').setAttribute('d', arcPath(G.r, 0, max));
  $('dRed').setAttribute('d', arcPath(G.r, G.hot, max));
}
function renderDial(mph, peak){
  const need = Math.max(mph, peak || 0, app.sessPeak);
  buildDial(need > 33 ? 40 : need > 28 ? 35 : 30);
  $('dVal').setAttribute('d', arcPath(G.r, 0, mph));
  $('dNdl').style.transform = `rotate(${ang(mph).toFixed(2)}deg)`; $('dNdl').style.transformOrigin = '150px 150px';
  const pk = $('dPk'); pk.style.transformOrigin = '150px 150px';
  if (peak){ pk.style.display = ''; pk.style.transform = `rotate(${ang(peak).toFixed(2)}deg)`; } else pk.style.display = 'none';
}

/* ---------- render ---------- */
const f1 = v => (v==null || !isFinite(v)) ? '–' : v.toFixed(1);
function renderLive(){
  if (typeof S === 'object' && S && S.page && S.page !== 'runner') return;
  const stale = performance.now() - app.live.t > 3000;
  const mph = stale ? 0 : app.live.mph;
  $('mph').textContent = mph.toFixed(1);
  { const rr = app.run, c = rr && (rr.rep || rr.graceRep); renderDial(mph, c ? c.peak : app.sessPeak); }
  $('kmh').textContent = (stale?0:app.live.kmh||0).toFixed(1);
  $('sessPeak').innerHTML = (app.sessPeak ? app.sessPeak.toFixed(1) : '–') + '<small> mph</small>';
  if (app.mode === 'ble'){ const n = app.rateTimes.length; $('rate').textContent = n > 1 ? `${((n-1)/((app.rateTimes[n-1]-app.rateTimes[0])/1000)).toFixed(1)} updates/s from console` : ''; }
  else if (app.mode === 'sim') $('rate').textContent = 'Simulated data';
  else $('rate').textContent = '';
  const r = app.run, ph = $('phase'), bar = $('bar');
  if (!r){ ph.className='phase'; ph.textContent='IDLE'; $('clock').textContent='--'; $('barFill').style.width='0'; return; }
  if (r.done){ ph.className='phase done'; ph.textContent= r.stopped?'STOPPED':'DONE'; $('stepLabel').textContent=r.cfg.name; $('clock').textContent='--'; $('barFill').style.width='100%'; $('target').textContent=''; }
  else {
    const s = r.steps[r.idx], el = (performance.now()-r.stepStart)/1000, left = Math.max(0, s.dur - el);
    ph.className = 'phase ' + s.type; ph.textContent = s.type.toUpperCase();
    $('stepLabel').textContent = s.label; $('clock').textContent = left.toFixed(s.type==='work'?1:0);
    bar.className = 'bar' + (s.type==='work'?'':' rest'); $('barFill').style.width = Math.min(100, 100*el/s.dur) + '%';
    const ref = referenceFor(r.reps), nextMain = s.type==='work' ? s.group==='main' : (r.steps.slice(r.idx).find(x=>x.type==='work')||{}).group==='main';
    $('target').textContent = (r.cfg.kill && ref && nextMain) ? `Kill line ${(ref*r.cfg.killPct/100).toFixed(1)} mph avg  (${r.cfg.killPct}% of ${ref.toFixed(1)})${r.missCount? ' · 1 miss in a row' : ''}` : '';
  }
  const cur = r.rep || r.graceRep;
  $('repPeak').textContent = cur ? f1(cur.peak) : '–'; $('repYd').textContent = cur ? f1(cur.yards) : '–';
  const best = r.reps.length ? Math.max(...r.reps.map(x=>x.peak), r.rep?r.rep.peak:0) : (r.rep?r.rep.peak:0);
  $('bestPeak').innerHTML = (best ? best.toFixed(1) : '–') + '<small> mph</small>';
  const d = decrement(r.reps); $('dec').innerHTML = (d==null?'–':d.toFixed(1)) + '<small> %</small>';
}
function renderReps(){
  const r = app.run, tb = $('repBody');
  if (!r || !r.reps.length){ tb.innerHTML = '<tr><td colspan="6" class="empty" style="text-align:left">Reps show up here as you go. Distance is the belt distance during the work window.</td></tr>'; return; }
  tb.innerHTML = r.reps.map((x,i) => `<tr class="${x.group==='anchor'?'anchor':''} ${x.pct!=null && r.cfg.kill ? (x.miss?'miss':'ok') : ''}">
    <td>${i+1}</td><td>${x.group==='anchor'?'<span class="tag">anchor</span>':'<span class="tag">rep</span>'}${x.kill?' <span class="tag kill">set ended</span>':''}</td>
    <td>${f1(x.peak)}</td><td>${f1(x.avg)}</td><td>${f1(x.yards)}</td><td>${x.pct==null?'–':x.pct.toFixed(0)+'%'}</td></tr>`).join('');
}
function renderSummary(r){
  const s = summarize(r), el = $('summary');
  if (!r.reps.length){ el.hidden = true; return; }
  const box = (l, v, u) => `<div class="stat"><div class="label">${l}</div><div class="n">${v}<small> ${u}</small></div></div>`;
  el.innerHTML = box('Best peak', f1(s.bestPeak), 'mph') + box('Best rep', f1(s.bestYd), 'yd') + box('Total', f1(s.totalYd), 'yd')
    + box('Decrement', s.dec==null?'–':s.dec.toFixed(1), '%') + (s.anchor!=null ? box('Anchor avg', f1(s.anchor), 'mph') : '') + box('Main reps', s.reps, s.kills ? `· ${s.kills} kill` : '');
  el.hidden = false;
}
function rosterNames(){
  let r = [];
  try { r = (S.athletes||[]).map(a => (a.first||'') + ' ' + (a.last||'')).map(n => n.trim()).filter(Boolean); } catch(e){}
  const extra = store.get('athletes', []).concat(app.history.map(h => h.athlete));
  return [...new Set(r.concat(extra))].sort((a,b) => a.localeCompare(b));
}
function renderAthletes(){
  app.athletes = rosterNames();
  const opts = app.athletes.map(a => `<option>${a.replace(/</g,'&lt;')}</option>`).join('');
  const cur = store.get('lastAthlete', '');
  $('athlete').innerHTML = opts || '<option value="">No athletes yet</option>';
  if (cur && app.athletes.includes(cur)) $('athlete').value = cur;
  const h = $('histAth').value;
  $('histAth').innerHTML = '<option value="">All athletes</option>' + opts; if (h) $('histAth').value = h;
}
function renderHist(){
  const a = $('histAth').value, list = app.history.filter(x => !a || x.athlete === a);
  $('histList').innerHTML = list.length ? list.map(h => `<div class="hitem"><div class="top"><b>${h.athlete.replace(/</g,'&lt;')} · ${h.test}</b><span class="label">${new Date(h.date).toLocaleString([], {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'})}${h.src==='sim'?' · SIM':''}${h.stopped?' · stopped early':''}</span></div>
    <div class="meta"><span>peak <b>${f1(h.sum.bestPeak)}</b> mph</span><span>best rep <b>${f1(h.sum.bestYd)}</b> yd</span><span>total <b>${f1(h.sum.totalYd)}</b> yd</span><span>dec <b>${h.sum.dec==null?'–':h.sum.dec.toFixed(1)}</b>%</span><span><b>${h.sum.reps}</b> reps</span></div></div>`).join('')
    : '<p class="empty">No saved tests yet. Each finished or stopped test saves here on this device.</p>';
}
function csv(){
  const a = $('histAth').value, rows = [['date','athlete','test','source','rep','type','peak_mph','avg_mph','yards','pct_anchor','set_ended']];
  app.history.filter(x => !a || x.athlete === a).forEach(h => h.reps.forEach(r => rows.push([h.date, h.athlete, h.test, h.src, r.n, r.group, r.peak, r.avg, r.yards, r.pct ?? '', r.kill ? 'yes' : ''])));
  return rows.map(r => r.map(v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g,'""')}"` : v).join(',')).join('\n');
}

/* ---------- setup form ---------- */
function loadPreset(){
  const p = PRESETS[$('proto').value];
  $('protoDesc').textContent = p.desc;
  $('fWork').value = p.work; $('fRest').value = p.rest ?? ''; $('fReps').value = p.reps ?? '';
  $('fSets').value = p.sets; $('fSetRest').value = p.setRest; $('fAnchor').value = p.anchor;
  $('fKill').checked = p.kill; $('fKillPct').value = p.killPct;
  const lad = !!p.ladder; $('wrapLadder').hidden = !lad; $('wrapRest').hidden = lad; $('wrapReps').hidden = lad;
  if (lad) $('fLadder').value = p.ladder.join(', ');
}

/* ---------- wire up ---------- */
function init(){
  if (!navigator.bluetooth) $('noBt').hidden = false;
  $('proto').innerHTML = Object.entries(PRESETS).map(([k,p]) => `<option value="${k}">${p.name}</option>`).join('');
  loadPreset(); renderAthletes(); renderHist();
  $('proto').onchange = loadPreset;
  $('btnConnect').onclick = () => (app.mode === 'ble' ? disconnect() : connect());
  $('btnSim').onclick = () => (app.sim ? stopSim() : startSim());
  $('btnStart').onclick = startRun;
  $('btnStop').onclick = () => endRun(true);
  $('btnResetPeak').onclick = () => { app.sessPeak = 0; renderLive(); };
  $('btnAddAth').onclick = () => { $('addRow').hidden = !$('addRow').hidden; if (!$('addRow').hidden) $('newAth').focus(); };
  const saveAth = () => { const n = $('newAth').value.trim(); if (!n) return; if (!app.athletes.includes(n)){ app.athletes.push(n); app.athletes.sort(); store.set('athletes', app.athletes); }
    store.set('lastAthlete', n); $('newAth').value=''; $('addRow').hidden = true; renderAthletes(); $('athlete').value = n; };
  $('btnSaveAth').onclick = saveAth; $('newAth').onkeydown = e => { if (e.key === 'Enter') saveAth(); };
  $('athlete').onchange = () => store.set('lastAthlete', $('athlete').value);
  $('histAth').onchange = renderHist;
  $('rawDetails').ontoggle = () => { $('raw').textContent = app.packets.join('\n') || 'No packets yet.'; };
  $('btnCsv').onclick = () => { const t = csv(); const done = m => $('csvMsg').textContent = m;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(()=>done('CSV copied. Paste it into Sheets or Coach OS.'), ()=>done('Copy was blocked. Use Download CSV.')); };
  $('btnDl').onclick = () => { const b = new Blob([csv()], {type:'text/csv'}), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'runner-speed.csv'; document.body.appendChild(a); a.click(); a.remove(); };
  const tab = run => { $('tabRun').setAttribute('aria-selected', run); $('tabHist').setAttribute('aria-selected', !run); $('viewRun').hidden = !run; $('viewHist').hidden = run; if (!run) renderHist(); };
  $('tabRun').onclick = () => tab(true); $('tabHist').onclick = () => tab(false);
  setInterval(tick, 100);
}
RSL.init = init; RSL.renderAthletes = renderAthletes; RSL.renderLive = renderLive;

function boot(){
  if (!mount()) return;
  // The Shell rebuilds #nav and the Lab inserts its tab after load; put ours back whenever that happens.
  const nav = document.getElementById('nav');
  try { new MutationObserver(() => { if (!nav.querySelector('.tab[data-page="runner"]')) addTab(nav); }).observe(nav, {childList:true}); } catch(e){}
  try { if (typeof S === 'object' && S.page === 'runner') go('runner'); } catch(e){}
  console.log('%c[RSL] Runner tab v' + RSL.ver, 'color:#e0312b');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 400)); else setTimeout(boot, 400);
})();
