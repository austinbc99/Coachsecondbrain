/* ════════════════════════════════════════════════════════════════════
   FITCLUB CT — COACH OS · UPGRADE BUNDLE (coachos-upgrade.js)
   Load AFTER index.html's main script AND AFTER brain.js.
   index.html order must be:  patch.js -> brain.js -> coachos-upgrade.js

   This single file REPLACES the separate history.js + intel.js.
   Commit just this one. Two independent, additive layers:
     1. VALD snapshot history  — dated snapshots so trends have real data
     2. Athlete Intelligence   — per-metric trend explorer (Slide 2)
   Nothing existing is overwritten. Each layer is defensive.
   ════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════
   FITCLUB CT — COACH OS · VALD SNAPSHOT HISTORY (history.js)
   Drop-in. Load AFTER index.html's main script and AFTER brain.js.
   Adds dated VALD snapshots so per-athlete trends have real history.

   - Every VALD save (manual entry or PDF import → Save) appends a dated
     snapshot onto the athlete object: a.history = [{date, vald:{...}}].
   - Snapshots ride S.athletes, so they sync through your existing
     Cloudflare/D1 setup with zero new config.
   - One-time backfill rebuilds history from your already-logged sessions
     so trends aren't empty on day one.
   - Fully additive + defensive: a failure here never breaks the app, and
     nothing existing is overwritten or deleted.
   ════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if(window._histPatched) return; window._histPatched = true;

var MAX_SNAPS = 60; // cap per athlete — plenty of retests, keeps state lean

function todayStr(){
  try{ return (typeof today==='function') ? today() : new Date().toISOString().slice(0,10); }
  catch(e){ return new Date().toISOString().slice(0,10); }
}

/* Append (or replace same-day) a full snapshot of an athlete's current vald */
function snapAthlete(a){
  if(!a || !a.vald) return;
  if(!Array.isArray(a.history)) a.history = [];
  var d = todayStr();
  var snap;
  try{ snap = { date:d, vald: JSON.parse(JSON.stringify(a.vald)) }; }
  catch(e){ snap = { date:d, vald: {} }; }
  var last = a.history[a.history.length-1];
  if(last && last.date === d){ a.history[a.history.length-1] = snap; }   // same day → replace
  else { a.history.push(snap); }
  a.history.sort(function(x,y){ return x.date < y.date ? -1 : 1; });
  if(a.history.length > MAX_SNAPS) a.history = a.history.slice(-MAX_SNAPS);
}
window.snapAthlete = snapAthlete; // exposed for slide-2 view / manual use

/* ── Wrap saveValdEntry (base OR brain.js override — whichever is current) ──
   Capture the target athlete BEFORE the form resets, snapshot AFTER the
   underlying save (incl. brain.js's 300ms extended-field merge) settles. */
var _prevSaveVald = window.saveValdEntry;
window.saveValdEntry = function(){
  var sel = document.getElementById('ve-sel');
  var selVal = sel && sel.value;
  var fn = ((document.getElementById('ve-first')||{}).value || '').trim().toLowerCase();
  var ln = ((document.getElementById('ve-last')||{}).value || '').trim().toLowerCase();

  if(_prevSaveVald) _prevSaveVald.apply(this, arguments);

  setTimeout(function(){
    try{
      var a = null;
      if(selVal && selVal !== '_new') a = S.athletes.find(function(x){ return x.id === selVal; });
      if(!a && fn && ln) a = S.athletes.find(function(x){
        return (x.first||'').toLowerCase()===fn && (x.last||'').toLowerCase()===ln;
      });
      if(!a && S.selAth) a = S.athletes.find(function(x){ return x.id === S.selAth; });
      if(a){
        snapAthlete(a);
        if(typeof save==='function') save();
        if(typeof toast==='function') toast('Snapshot saved \u2713');
        if(S.selAth===a.id && typeof showAthDetail==='function') showAthDetail(a.id);
      }
    }catch(e){ console.warn('[history] snapshot failed', e); }
  }, 380); // > brain.js's 300ms extended-field merge
};

/* ── One-time backfill from existing session.updates ───────────────────
   Idempotent (keyed by date), so it's safe even if it re-runs on another
   synced device. Runs after brain.js's note-migration (2000ms). */
function seedHistory(){
  try{
    if(S._histSeeded) return;
    (S.athletes || []).forEach(function(a){
      var byDate = {};
      (Array.isArray(a.history) ? a.history : []).forEach(function(h){ if(h && h.date) byDate[h.date] = h; });
      var sess = (S.sessions && S.sessions[a.id]) || [];
      sess.forEach(function(s){
        if(!s || !s.updates || !s.date) return;
        var keys = Object.keys(s.updates);
        if(!keys.length) return;
        var v = byDate[s.date] ? byDate[s.date].vald : {};
        keys.forEach(function(k){
          var val = s.updates[k];
          if(val !== null && val !== undefined && val !== '') v[k] = val;
        });
        byDate[s.date] = { date:s.date, vald:v };
      });
      a.history = Object.keys(byDate)
        .map(function(d){ return byDate[d]; })
        .sort(function(x,y){ return x.date < y.date ? -1 : 1; });
      if(a.history.length > MAX_SNAPS) a.history = a.history.slice(-MAX_SNAPS);
    });
    S._histSeeded = true;
    if(typeof save==='function') save();
    console.log('[history] backfill complete');
  }catch(e){ console.warn('[history] seed failed', e); }
}
setTimeout(seedHistory, 2500);

console.log('[history] VALD snapshot layer loaded');
})();
/* ════════════════════════════════════════════════════════════════════
   FITCLUB CT — COACH OS · ATHLETE INTELLIGENCE (intel.js)  [Slide 2]
   Load AFTER index.html's main script, AFTER brain.js and history.js.
   Upgrades the athlete profile: pick any metric → that athlete's curve
   over time. Works for every athlete. Reads a.history (the snapshot
   layer) and falls back to logged session updates, so it's never empty
   if there's any data. Additive + defensive — never breaks the profile.
   ════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if(window._intelPatched) return; window._intelPatched = true;

// metric catalog — single-line unless `pair` (plots L & R together)
var METRICS = [
  {k:'cmj',              l:'CMJ',           hi:true},
  {k:'hop_rsi',          l:'Hop RSI',       hi:true},
  {k:'dj_rsi',           l:'Drop Jump RSI', hi:true},
  {k:'rsi',              l:'RSI',           hi:true},
  {k:'cmj_wkg',          l:'CMJ Power', u:'W/kg', hi:true},
  {k:'trap',             l:'Trap 1RM',  u:'lb',   hi:true},
  {k:'spd',              l:'10yd',      u:'s',    hi:false},
  {k:'cod',              l:'5-10-5',    u:'s',    hi:false},
  {k:'asy',              l:'Asymmetry', u:'%',    hi:false},
  {k:'sl_jump_asym_pct', l:'SL Jump Asym', u:'%', hi:false},
  {k:'vj',               l:'Vertical',  u:'in',   hi:true},
  {k:'bj',               l:'Broad',     u:'in',   hi:true},
  {k:'nf',               l:'Nordic',    u:'N',    hi:true},
  {k:'sl_hop',  l:'SL Hop L/R',  hi:true,  pair:['sl_hop_l','sl_hop_r']},
  {k:'sl_jump', l:'SL Jump L/R', u:'W/kg', hi:true, pair:['sl_jump_l','sl_jump_r']}
];

var _chart=null, _metric={}; // _metric[athId] = selected key

function num(v){ var n=parseFloat(v); return isNaN(n)?null:n; }

// merge session.updates + a.history into a dated series for one key
function collectPoints(a, key){
  var byDate={};
  ((S.sessions && S.sessions[a.id]) || []).forEach(function(s){
    if(s && s.updates && s.date && num(s.updates[key])!==null) byDate[s.date]=num(s.updates[key]);
  });
  (Array.isArray(a.history)?a.history:[]).forEach(function(h){
    if(h && h.date && h.vald && num(h.vald[key])!==null) byDate[h.date]=num(h.vald[key]);
  });
  return Object.keys(byDate).sort().map(function(d){ return {d:d, v:byDate[d]}; });
}
function metricHasData(a, m){
  if(m.pair) return collectPoints(a,m.pair[0]).length || collectPoints(a,m.pair[1]).length;
  return collectPoints(a,m.k).length;
}
function fmt(v,u){ return (v==null?'\u2013':v)+(u?' '+u:''); }

function renderIntel(a){
  var card=document.getElementById('intel-card'); if(!card) return;
  var avail=METRICS.filter(function(m){ return metricHasData(a,m); });
  if(!avail.length){
    card.innerHTML='<div class="card-title">Athlete Intelligence</div>'
      +'<div class="muted">No test history yet. Enter or import a VALD set \u2014 each save records a dated snapshot, and trends build from there.</div>';
    return;
  }
  if(!_metric[a.id] || !avail.some(function(m){return m.k===_metric[a.id];})) _metric[a.id]=avail[0].k;
  var sel=_metric[a.id], m=avail.find(function(x){return x.k===sel;});

  var chips=avail.map(function(x){
    return '<span class="kpi-chip '+(x.k===sel?'on':'')+'" onclick="intelPick(\''+a.id+'\',\''+x.k+'\')">'+x.l+'</span>';
  }).join('');

  var summaryHtml='';
  if(m.pair){
    var L=collectPoints(a,m.pair[0]), R=collectPoints(a,m.pair[1]);
    var lLast=L.length?L[L.length-1].v:null, rLast=R.length?R[R.length-1].v:null;
    var mx=(lLast!=null&&rLast!=null)?Math.max(lLast,rLast):0;
    var asym=(mx>0)?Math.abs((lLast-rLast)/mx*100):null;
    summaryHtml='<div class="g3" style="margin:10px 0;">'
      +'<div class="st"><div class="st-l">Left</div><div class="st-v" style="font-size:18px;">'+fmt(lLast,m.u)+'</div></div>'
      +'<div class="st"><div class="st-l">Right</div><div class="st-v" style="font-size:18px;">'+fmt(rLast,m.u)+'</div></div>'
      +'<div class="st"><div class="st-l">Asym</div><div class="st-v" style="font-size:18px;color:'+(asym!=null&&asym>10?'var(--orange)':'var(--accent)')+';">'+(asym!=null?asym.toFixed(1)+'%':'\u2013')+'</div></div>'
      +'</div>';
  } else {
    var P=collectPoints(a,m.k);
    var first=P.length?P[0].v:null, last=P.length?P[P.length-1].v:null;
    var delta=(first!=null&&last!=null)?(last-first):null;
    var pct=(delta!=null&&first!==0)?(delta/Math.abs(first)*100):null;
    var improved=(delta!=null)?(m.hi?delta>0:delta<0):null;
    var vals=P.map(function(x){return x.v;});
    var best=P.length?(m.hi?Math.max.apply(null,vals):Math.min.apply(null,vals)):null;
    summaryHtml='<div class="g4" style="margin:10px 0;">'
      +'<div class="st"><div class="st-l">Latest</div><div class="st-v" style="font-size:18px;">'+fmt(last,m.u)+'</div></div>'
      +'<div class="st"><div class="st-l">Change</div><div class="st-v" style="font-size:18px;color:'+(improved==null?'var(--text2)':improved?'var(--accent)':'var(--red)')+';">'+(pct!=null?(pct>0?'+':'')+pct.toFixed(1)+'%':'\u2013')+'</div></div>'
      +'<div class="st"><div class="st-l">Best</div><div class="st-v" style="font-size:18px;">'+fmt(best,m.u)+'</div></div>'
      +'<div class="st"><div class="st-l">Tests</div><div class="st-v" style="font-size:18px;">'+P.length+'</div></div>'
      +'</div>';
  }

  card.innerHTML='<div class="card-title" style="justify-content:space-between;"><span>Athlete Intelligence</span><span class="muted">trend over time</span></div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px;">'+chips+'</div>'
    +summaryHtml
    +'<canvas id="intel-chart" style="max-height:240px;"></canvas>'
    +'<div class="muted" id="intel-hint" style="margin-top:6px;"></div>';

  drawChart(a,m);
}

function drawChart(a,m){
  var el=document.getElementById('intel-chart'); if(!el) return;
  if(_chart){ try{_chart.destroy();}catch(e){} _chart=null; }
  var hint=document.getElementById('intel-hint');
  if(typeof Chart==='undefined'){ if(hint)hint.textContent='Chart library unavailable.'; return; }
  try{
    var labels=[], datasets=[];
    if(m.pair){
      var L=collectPoints(a,m.pair[0]), R=collectPoints(a,m.pair[1]);
      var dset={}; L.concat(R).forEach(function(p){dset[p.d]=1;}); labels=Object.keys(dset).sort();
      var lm={}; L.forEach(function(p){lm[p.d]=p.v;}); var rm={}; R.forEach(function(p){rm[p.d]=p.v;});
      datasets=[
        {label:'Left', data:labels.map(function(d){return lm[d]!=null?lm[d]:null;}), borderColor:'#b8ff57', backgroundColor:'#b8ff5722', borderWidth:2, pointRadius:3, tension:0.25, spanGaps:true},
        {label:'Right',data:labels.map(function(d){return rm[d]!=null?rm[d]:null;}), borderColor:'#42a5ff', backgroundColor:'#42a5ff22', borderWidth:2, pointRadius:3, tension:0.25, spanGaps:true}
      ];
    } else {
      var P=collectPoints(a,m.k);
      labels=P.map(function(p){return p.d;});
      var improved=P.length>1?(m.hi?P[P.length-1].v>P[0].v:P[P.length-1].v<P[0].v):true;
      var col=improved?'#b8ff57':'#ff4d4d';
      datasets=[{label:m.l, data:P.map(function(p){return p.v;}), borderColor:col, backgroundColor:col+'22', borderWidth:2, pointRadius:3, tension:0.25, fill:true}];
      if(hint) hint.textContent=(P.length<2)?'One test so far \u2014 log another to draw the curve.':'';
    }
    _chart=new Chart(el,{type:'line',data:{labels:labels,datasets:datasets},options:{
      responsive:true,maintainAspectRatio:false,animation:false,
      plugins:{legend:{display:!!m.pair,labels:{color:'#888',font:{size:9}}},tooltip:{enabled:true}},
      scales:{x:{grid:{color:'#1a1a1a'},ticks:{color:'#888',font:{size:8},maxRotation:0}},
              y:{grid:{color:'#1a1a1a'},ticks:{color:'#888',font:{size:9}}}}
    }});
  }catch(e){ if(hint)hint.textContent=''; console.warn('[intel] chart', e); }
}

window.intelPick=function(athId,key){
  _metric[athId]=key;
  var a=S.athletes.find(function(x){return x.id===athId;});
  if(a) renderIntel(a);
};

// wrap showAthDetail: drop the stock Progression card, inject Intelligence
var _prevShow=window.showAthDetail;
window.showAthDetail=function(id){
  if(_prevShow) _prevShow.apply(this,arguments);
  setTimeout(function(){
    try{
      var a=S.athletes.find(function(x){return x.id===id;}); if(!a) return;
      var detail=document.getElementById('ath-detail'); if(!detail) return;
      Array.prototype.slice.call(detail.querySelectorAll('.card')).forEach(function(c){
        var t=c.querySelector('.card-title');
        if(t && /Progression/i.test(t.textContent) && !c.id) c.remove();
      });
      var ex=document.getElementById('intel-card'); if(ex) ex.remove();
      var card=document.createElement('div'); card.className='card'; card.id='intel-card';
      card.style.cssText='border-color:rgba(66,165,255,.25);';
      var anchor=detail.querySelector('.vald-pro-card') || detail.querySelector('.card');
      if(anchor) anchor.insertAdjacentElement('afterend',card); else detail.appendChild(card);
      renderIntel(a);
    }catch(e){ console.warn('[intel] inject', e); }
  }, 220); // after brain.js's 150ms Pro-card injection
};

console.log('[intel] Athlete Intelligence (slide 2) loaded');
})();
