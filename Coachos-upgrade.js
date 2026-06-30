/* ════════════════════════════════════════════════════════════════════
   FITCLUB CT — COACH OS · UPGRADE BUNDLE (coachos-upgrade.js)  v3
   Load AFTER index.html's main script AND AFTER brain.js.
   index.html order:  patch.js -> brain.js -> coachos-upgrade.js
   Re-commit this file and bump its tag to ?v=3 so phones grab it fresh.

   Four additive, defensive layers (commit this one file):
     1. VALD snapshot history   — dated snapshots for trends
     2. Athlete Intelligence v2 — improvement banner, value labels,
                                  baseline line, all-tests strip (Slide 2)
     3. Sprint Lab F-V map      — named, quadrant-colored, shaded zones
     4. OHM Force-Velocity      — load vs watts curve, multi-athlete
                                  overlay + quick log (Sprint Lab)
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
   v2 — visual upgrade: improvement banner, value labels on every point,
   baseline reference line, and an all-tests strip. Asymmetry metrics
   headline the gap closing over time. Load AFTER brain.js.
   ════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if(window._intelPatched) return; window._intelPatched = true;

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

var _chart=null, _metric={};
function num(v){ var n=parseFloat(v); return isNaN(n)?null:n; }
function fmt(v,u){ return (v==null?'\u2013':v)+(u?' '+u:''); }
function r2(v){ return Math.round(v*100)/100; }

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
function asymSeries(a,m){
  var L=collectPoints(a,m.pair[0]), R=collectPoints(a,m.pair[1]);
  var lm={}; L.forEach(function(p){lm[p.d]=p.v;}); var rm={}; R.forEach(function(p){rm[p.d]=p.v;});
  return Object.keys(lm).filter(function(d){return rm[d]!=null;}).sort().map(function(d){
    var mx=Math.max(lm[d],rm[d]); return {d:d, v: mx>0?Math.abs(lm[d]-rm[d])/mx*100:0};
  });
}

function bannerSingle(P,m){
  if(P.length<2){
    var only=P.length?P[0].v:null;
    return '<div style="border:1px solid var(--border2);border-radius:var(--r);padding:10px 12px;margin:8px 0;font-size:11px;color:var(--text2);">Baseline set'+(only!=null?': <b style="color:var(--text);">'+fmt(only,m.u)+'</b>':'')+' \u2014 log another test and the gain shows here.</div>';
  }
  var first=P[0].v,last=P[P.length-1].v,delta=last-first;
  var pct=first!==0?delta/Math.abs(first)*100:null, improved=m.hi?delta>0:delta<0;
  var col=improved?'var(--accent)':'var(--red)', arrow=improved?'\u2191':'\u2193';
  var bg=improved?'rgba(184,255,87,.07)':'rgba(255,77,77,.07)';
  return '<div style="border:1px solid '+col+'55;background:'+bg+';border-radius:var(--r);padding:11px 13px;margin:8px 0;">'
    +'<div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;">'
    +'<span style="font-family:var(--disp);font-size:36px;line-height:.9;color:'+col+';">'+arrow+' '+(pct!=null?(pct>0?'+':'')+pct.toFixed(1)+'%':'\u2013')+'</span>'
    +'<span style="font-size:14px;color:var(--text);">'+fmt(r2(first),m.u)+' <span style="color:var(--text3);">\u2192</span> '+fmt(r2(last),m.u)+'</span></div>'
    +'<div class="muted" style="margin-top:4px;">'+P.length+' tests \u00b7 since '+P[0].d+' \u00b7 '+(improved?'improving':'watch')+'</div></div>';
}
function bannerPair(a,m){
  var A=asymSeries(a,m), L=collectPoints(a,m.pair[0]), R=collectPoints(a,m.pair[1]);
  var lLast=L.length?L[L.length-1].v:null, rLast=R.length?R[R.length-1].v:null;
  if(A.length<2){
    var cur=A.length?A[A.length-1].v:null;
    return '<div style="border:1px solid var(--border2);border-radius:var(--r);padding:10px 12px;margin:8px 0;font-size:11px;color:var(--text2);">Asymmetry '+(cur!=null?'<b style="color:var(--text);">'+cur.toFixed(1)+'%</b>':'\u2013')+' \u00b7 L '+fmt(lLast,m.u)+' / R '+fmt(rLast,m.u)+' \u2014 retest to track it closing.</div>';
  }
  var first=A[0].v,last=A[A.length-1].v,improved=(last-first)<0;
  var col=improved?'var(--accent)':'var(--red)', arrow=improved?'\u2193':'\u2191';
  var bg=improved?'rgba(184,255,87,.07)':'rgba(255,77,77,.07)';
  return '<div style="border:1px solid '+col+'55;background:'+bg+';border-radius:var(--r);padding:11px 13px;margin:8px 0;">'
    +'<div style="font-family:var(--disp);font-size:32px;line-height:.9;color:'+col+';">'+arrow+' '+first.toFixed(1)+'% <span style="color:var(--text3);">\u2192</span> '+last.toFixed(1)+'%</div>'
    +'<div class="muted" style="margin-top:4px;">asymmetry '+(improved?'closing':'widening')+' \u00b7 L '+fmt(r2(lLast),m.u)+' / R '+fmt(r2(rLast),m.u)+'</div></div>';
}
function testsStrip(a,m){
  var items=m.pair? asymSeries(a,m).map(function(p){return p.d.slice(5)+' \u00b7 '+p.v.toFixed(1)+'%';})
                  : collectPoints(a,m.k).map(function(p){return p.d.slice(5)+' \u00b7 '+r2(p.v);});
  if(!items.length) return '';
  return '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;">'
    +items.map(function(t){return '<span class="tag">'+t+'</span>';}).join('')+'</div>';
}

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
  card.innerHTML='<div class="card-title" style="justify-content:space-between;"><span>Athlete Intelligence</span><span class="muted">trend over time</span></div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:4px;">'+chips+'</div>'
    +(m.pair?bannerPair(a,m):bannerSingle(collectPoints(a,m.k),m))
    +'<canvas id="intel-chart" style="max-height:260px;"></canvas>'
    +'<div class="muted" id="intel-hint" style="margin-top:6px;"></div>'
    +testsStrip(a,m);
  drawChart(a,m);
}

// inline plugin: print each point's value above it (no extra libraries)
var valueLabels={id:'intelVL', afterDatasetsDraw:function(chart){
  var ctx=chart.ctx;
  chart.data.datasets.forEach(function(ds,di){
    var meta=chart.getDatasetMeta(di); if(meta.hidden)return;
    meta.data.forEach(function(pt,i){
      var v=ds.data[i]; if(v==null||!pt)return;
      ctx.save(); ctx.font='700 9px ui-monospace,monospace';
      ctx.fillStyle=ds.borderColor||'#efefef'; ctx.textAlign='center';
      ctx.fillText(''+(Math.round(v*100)/100), pt.x, pt.y-7); ctx.restore();
    });
  });
}};

function drawChart(a,m){
  var el=document.getElementById('intel-chart'); if(!el) return;
  if(_chart){ try{_chart.destroy();}catch(e){} _chart=null; }
  var hint=document.getElementById('intel-hint');
  if(typeof Chart==='undefined'){ if(hint)hint.textContent='Chart library unavailable.'; return; }
  try{
    var labels=[], datasets=[], plugins=[valueLabels], base=null;
    if(m.pair){
      var L=collectPoints(a,m.pair[0]), R=collectPoints(a,m.pair[1]);
      var ds={}; L.concat(R).forEach(function(p){ds[p.d]=1;}); labels=Object.keys(ds).sort();
      var lm={}; L.forEach(function(p){lm[p.d]=p.v;}); var rm={}; R.forEach(function(p){rm[p.d]=p.v;});
      datasets=[
        {label:'Left', data:labels.map(function(d){return lm[d]!=null?lm[d]:null;}), borderColor:'#b8ff57', backgroundColor:'#b8ff5722', borderWidth:2, pointRadius:4, tension:0.25, spanGaps:true},
        {label:'Right',data:labels.map(function(d){return rm[d]!=null?rm[d]:null;}), borderColor:'#42a5ff', backgroundColor:'#42a5ff22', borderWidth:2, pointRadius:4, tension:0.25, spanGaps:true}
      ];
    } else {
      var P=collectPoints(a,m.k); labels=P.map(function(p){return p.d;});
      var improved=P.length>1?(m.hi?P[P.length-1].v>P[0].v:P[P.length-1].v<P[0].v):true;
      var col=improved?'#b8ff57':'#ff4d4d';
      datasets=[{label:m.l, data:P.map(function(p){return p.v;}), borderColor:col, backgroundColor:col+'22', borderWidth:2.5, pointRadius:4, pointBackgroundColor:col, tension:0.25, fill:true}];
      base=P.length?P[0].v:null;
      if(hint) hint.textContent=(P.length<2)?'One test so far \u2014 the curve draws once you log a second.':'Dashed line = baseline (first test).';
    }
    if(base!=null){
      plugins.push({id:'intelBase', beforeDatasetsDraw:function(chart){
        try{ var y=chart.scales.y.getPixelForValue(base), ar=chart.chartArea; if(!ar)return;
          var ctx=chart.ctx; ctx.save(); ctx.strokeStyle='#777'; ctx.setLineDash([4,4]); ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(ar.left,y); ctx.lineTo(ar.right,y); ctx.stroke(); ctx.restore();
        }catch(e){}
      }});
    }
    _chart=new Chart(el,{type:'line',data:{labels:labels,datasets:datasets},plugins:plugins,options:{
      responsive:true,maintainAspectRatio:false,animation:false,layout:{padding:{top:16}},
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
  }, 220);
};

console.log('[intel] Athlete Intelligence v2 (slide 2) loaded');
})();
/* ════════════════════════════════════════════════════════════════════
   FITCLUB CT — COACH OS · SPRINT LAB F-V MAP UPGRADE (fv.js)
   Replaces the plain green scatter with a readable Force-Velocity profile:
   named points, quadrant-colored, shaded zones + crosshair at the roster
   median, so every athlete (and your three girls) reads at a glance.
   Load AFTER index.html's main script. Additive + defensive.
   ════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if(window._fvPatched) return; window._fvPatched = true;

function median(arr){ if(!arr.length)return 0; var s=arr.slice().sort(function(a,b){return a-b;}); var m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; }

function buildFV(){
  try{
    var el=document.getElementById('fv-chart'); if(!el || typeof Chart==='undefined') return;
    var prev=Chart.getChart && Chart.getChart(el); if(prev){ try{prev.destroy();}catch(e){} }
    var pts=(S.athletes||[]).filter(function(a){return a.vald&&a.vald.spd&&a.vald.cmj;}).map(function(a){
      return {x:parseFloat(a.vald.spd), y:parseFloat(a.vald.cmj), name:(a.first||''), full:an(a)};
    }).filter(function(p){return !isNaN(p.x)&&!isNaN(p.y);});
    if(!pts.length) return;

    var mx=median(pts.map(function(p){return p.x;})); // speed median (x reversed: faster=right)
    var my=median(pts.map(function(p){return p.y;})); // cmj median
    function quad(p){ var fast=p.x<=mx, high=p.y>=my;
      return fast&&high?'#b8ff57' : (!fast&&high?'#42a5ff' : (fast&&!high?'#ff8c42':'#6b6b6b')); }
    var colors=pts.map(quad);

    // shaded quadrants + crosshair at the medians
    var zonesPlugin={id:'fvZones', beforeDatasetsDraw:function(chart){
      try{
        var ar=chart.chartArea; if(!ar)return; var ctx=chart.ctx;
        var px=chart.scales.x.getPixelForValue(mx), py=chart.scales.y.getPixelForValue(my);
        ctx.save();
        // right=faster. top=high cmj.
        ctx.fillStyle='rgba(184,255,87,.05)'; ctx.fillRect(px,ar.top,ar.right-px,py-ar.top);       // fast+high (elite)
        ctx.fillStyle='rgba(66,165,255,.05)'; ctx.fillRect(ar.left,ar.top,px-ar.left,py-ar.top);    // slow+high (force)
        ctx.fillStyle='rgba(255,140,66,.05)'; ctx.fillRect(px,py,ar.right-px,ar.bottom-py);          // fast+low (speed)
        ctx.fillStyle='rgba(120,120,120,.06)'; ctx.fillRect(ar.left,py,px-ar.left,ar.bottom-py);     // slow+low (develop)
        ctx.strokeStyle='#333'; ctx.setLineDash([5,5]); ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(px,ar.top); ctx.lineTo(px,ar.bottom); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ar.left,py); ctx.lineTo(ar.right,py); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font='700 9px ui-monospace,monospace';
        ctx.fillStyle='rgba(184,255,87,.7)'; ctx.textAlign='right'; ctx.fillText('ELITE', ar.right-6, ar.top+13);
        ctx.fillStyle='rgba(66,165,255,.7)'; ctx.textAlign='left';  ctx.fillText('FORCE', ar.left+6, ar.top+13);
        ctx.fillStyle='rgba(255,140,66,.7)'; ctx.textAlign='right'; ctx.fillText('SPEED', ar.right-6, ar.bottom-7);
        ctx.fillStyle='rgba(150,150,150,.7)';ctx.textAlign='left';  ctx.fillText('DEVELOP', ar.left+6, ar.bottom-7);
        ctx.restore();
      }catch(e){}
    }};
    // athlete name on each point
    var namePlugin={id:'fvNames', afterDatasetsDraw:function(chart){
      try{
        var ctx=chart.ctx, meta=chart.getDatasetMeta(0);
        meta.data.forEach(function(pt,i){
          if(!pt)return; ctx.save(); ctx.font='600 10px ui-monospace,monospace';
          ctx.fillStyle='#e8e8e8'; ctx.textAlign='left';
          ctx.fillText(pts[i].name, pt.x+9, pt.y+3); ctx.restore();
        });
      }catch(e){}
    }};

    new Chart(el,{type:'scatter',
      data:{datasets:[{data:pts, backgroundColor:colors, borderColor:'#0a0a0a', borderWidth:1.5, pointRadius:8, pointHoverRadius:11}]},
      plugins:[zonesPlugin,namePlugin],
      options:{responsive:true,maintainAspectRatio:false,animation:false,layout:{padding:{right:14,top:6}},
        plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return c.raw.full+': '+c.raw.x+'s, '+c.raw.y+'cm';}}}},
        scales:{x:{reverse:true,title:{display:true,text:'Speed (s) \u2014 faster \u2192',color:'#888',font:{size:9}},grid:{color:'#161616'},ticks:{color:'#888',font:{size:9}}},
                y:{title:{display:true,text:'CMJ (cm) \u2014 more power \u2191',color:'#888',font:{size:9}},grid:{color:'#161616'},ticks:{color:'#888',font:{size:9}}}}}
    });
  }catch(e){ console.warn('[fv] build', e); }
}

// wrap initSprint everywhere it's reachable (button + page nav table)
var _origInitSprint = window.initSprint;
function wrapped(){ try{ if(_origInitSprint) _origInitSprint.apply(this,arguments); }catch(e){} setTimeout(buildFV,160); }
window.initSprint = wrapped;
try{ if(typeof pageInits!=='undefined' && pageInits) pageInits.sprint = wrapped; }catch(e){}
// if already sitting on the sprint page when this loads, refresh it
try{ if(S && S.page==='sprint') setTimeout(buildFV,200); }catch(e){}

console.log('[fv] Sprint Lab F-V map upgrade loaded');
})();
/* ════════════════════════════════════════════════════════════════════
   FITCLUB CT — COACH OS · OHM FORCE-VELOCITY (ohm.js)  [Sprint Lab]
   Real F-V curve from OHM Constant Force data: load (lb) on X, avg watts
   on Y, one line per athlete so Grace/Kailea/Dani overlay. Select one
   athlete to see their curve shift session-to-session. Quick log form
   creates the athlete if they're not in the roster yet. Additive.
   ════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if(window._ohmPatched) return; window._ohmPatched = true;

var PAL=['#b8ff57','#42a5ff','#ff8c42','#e36bff','#ffd166','#3a7a52','#ff4d4d','#5ad1c8'];
var _sel=null, _chart=null;
function num(v){var n=parseFloat(v);return isNaN(n)?null:n;}
function withOhm(){ return (S.athletes||[]).filter(function(a){return Array.isArray(a.ohm)&&a.ohm.length;}); }
function colorFor(a){ var i=(S.athletes||[]).findIndex(function(x){return x.id===a.id;}); return PAL[(i<0?0:i)%PAL.length]; }
function latest(a){ return a.ohm.slice().sort(function(x,y){return x.date<y.date?-1:1;})[a.ohm.length-1]; }

function inject(){
  var page=document.getElementById('pg-sprint'); if(!page) return;
  if(document.getElementById('ohm-fv-card')){ render(); return; }
  var card=document.createElement('div'); card.className='card'; card.id='ohm-fv-card';
  card.style.cssText='border-color:rgba(184,255,87,.25);';
  card.innerHTML='<div class="card-title" style="justify-content:space-between;"><span>\u26a1 OHM Force\u2013Velocity</span>'
    +'<button class="btn btn-sm" onclick="ohmToggleForm()">+ Log Session</button></div>'
    +'<div id="ohm-form" style="display:none;"></div>'
    +'<div id="ohm-chips" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;"></div>'
    +'<canvas id="ohm-chart" style="max-height:260px;"></canvas>'
    +'<div class="muted" id="ohm-hint" style="margin-top:6px;"></div>';
  var anchor=null;
  Array.prototype.slice.call(page.querySelectorAll('.card')).forEach(function(c){
    var t=c.querySelector('.card-title'); if(t && /F-?V Profile Map/i.test(t.textContent)) anchor=c;
  });
  if(anchor) anchor.insertAdjacentElement('afterend',card);
  else { var cols=page.querySelectorAll('.g2 > div'); (cols[1]||page).appendChild(card); }
  render();
}

function render(){
  var chipsEl=document.getElementById('ohm-chips'); if(!chipsEl) return;
  var data=withOhm(); var hint=document.getElementById('ohm-hint');
  if(!data.length){
    chipsEl.innerHTML='';
    if(hint) hint.innerHTML='No OHM data yet. Tap <b>+ Log Session</b> and enter avg watts at each load (Speed 25 / Mid 45 / Force 65).';
    if(_chart){try{_chart.destroy();}catch(e){}_chart=null;}
    return;
  }
  if(!_sel) _sel=data.map(function(a){return a.id;});
  chipsEl.innerHTML=data.map(function(a){
    var on=_sel.indexOf(a.id)>=0, c=colorFor(a);
    return '<span class="kpi-chip '+(on?'on':'')+'"'+(on?' style="border-color:'+c+';color:'+c+';background:'+c+'18;"':'')+' onclick="ohmTog(\''+a.id+'\')">'+a.first+'</span>';
  }).join('');
  draw(data);
}

var vlPlugin={id:'ohmVL',afterDatasetsDraw:function(chart){
  var ctx=chart.ctx;
  chart.data.datasets.forEach(function(ds,di){
    var meta=chart.getDatasetMeta(di); if(meta.hidden)return;
    meta.data.forEach(function(pt,i){
      var raw=ds.data[i]; if(!raw||raw.y==null||!pt)return;
      ctx.save(); ctx.font='700 9px ui-monospace,monospace'; ctx.fillStyle=ds.borderColor; ctx.textAlign='center';
      ctx.fillText(Math.round(raw.y)+'W', pt.x, pt.y-7); ctx.restore();
    });
  });
}};

function draw(data){
  var el=document.getElementById('ohm-chart'); if(!el||typeof Chart==='undefined') return;
  if(_chart){try{_chart.destroy();}catch(e){}_chart=null;}
  var sel=data.filter(function(a){return _sel.indexOf(a.id)>=0;});
  var hint=document.getElementById('ohm-hint'); var datasets=[];
  if(sel.length===1){
    var a=sel[0], c=colorFor(a);
    var ss=a.ohm.slice().sort(function(x,y){return x.date<y.date?-1:1;});
    ss.forEach(function(s,i){
      var pts=(s.pts||[]).filter(function(p){return num(p.load)!=null&&num(p.w)!=null;}).sort(function(p,q){return p.load-q.load;});
      var isLast=i===ss.length-1;
      datasets.push({label:s.date.slice(5), data:pts.map(function(p){return {x:p.load,y:p.w};}), borderColor:c, backgroundColor:c+'14', borderWidth:isLast?2.5:1.4, pointRadius:4, tension:0.2, borderDash:isLast?[]:[4,3]});
    });
    if(hint) hint.textContent=a.first+' \u2014 each line is a session; solid = latest. Curve lifting/shifting left = the work is transferring.';
  } else {
    sel.forEach(function(a){
      var c=colorFor(a), s=latest(a);
      var pts=(s.pts||[]).filter(function(p){return num(p.load)!=null&&num(p.w)!=null;}).sort(function(p,q){return p.load-q.load;});
      datasets.push({label:a.first, data:pts.map(function(p){return {x:p.load,y:p.w};}), borderColor:c, backgroundColor:c+'14', borderWidth:2.5, pointRadius:4, tension:0.2});
    });
    if(hint) hint.textContent='Latest curve per athlete \u2014 steep climb to the right = force-dominant; flat/high on the left = speed-dominant.';
  }
  try{
    _chart=new Chart(el,{type:'line',data:{datasets:datasets},plugins:[vlPlugin],options:{
      responsive:true,maintainAspectRatio:false,animation:false,layout:{padding:{top:16}},
      plugins:{legend:{display:true,labels:{color:'#888',font:{size:9}}},tooltip:{callbacks:{label:function(c){return c.dataset.label+': '+c.raw.x+'lb \u2192 '+c.raw.y+'W';}}}},
      scales:{x:{type:'linear',title:{display:true,text:'Load (lb) \u2014 heavier \u2192',color:'#888',font:{size:9}},grid:{color:'#161616'},ticks:{color:'#888',font:{size:9}}},
              y:{title:{display:true,text:'Avg Power (W) \u2191',color:'#888',font:{size:9}},grid:{color:'#161616'},ticks:{color:'#888',font:{size:9}}}}}
    });
  }catch(e){console.warn('[ohm] chart',e);}
}

window.ohmTog=function(id){ if(!_sel)_sel=[]; var i=_sel.indexOf(id); if(i>=0)_sel.splice(i,1); else _sel.push(id); render(); };

window.ohmToggleForm=function(){
  var f=document.getElementById('ohm-form'); if(!f)return;
  if(f.style.display!=='none'){ f.style.display='none'; f.innerHTML=''; return; }
  f.style.display='block';
  var opts=(S.athletes||[]).map(function(a){return '<option value="'+a.id+'">'+an(a)+'</option>';}).join('');
  f.innerHTML='<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:10px;margin-bottom:10px;">'
    +'<div class="frow"><div class="fg"><label>Athlete</label><select id="ohm-ath"><option value="">+ New athlete</option>'+opts+'</select></div>'
    +'<div class="fg" id="ohm-newname" style="display:none;"><label>First name</label><input id="ohm-first"></div></div>'
    +'<div class="fg"><label>Date</label><input id="ohm-date" type="date" value="'+today()+'"></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:8px;color:var(--text3);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:3px;"><div>Load (lb)</div><div>Avg Watts</div></div>'
    +[25,45,65].map(function(ld,i){return '<div class="frow"><div class="fg"><input id="ohm-l'+i+'" type="number" value="'+ld+'"></div><div class="fg"><input id="ohm-w'+i+'" type="number" placeholder="avg W"></div></div>';}).join('')
    +'<div class="frow"><div class="fg"><input id="ohm-l3" type="number" placeholder="+load"></div><div class="fg"><input id="ohm-w3" type="number" placeholder="avg W"></div></div>'
    +'<button class="btn btn-primary btn-sm" style="width:100%;margin-top:4px;" onclick="ohmSave()">\u2713 Save Session</button></div>';
  var sel=document.getElementById('ohm-ath');
  sel.onchange=function(){document.getElementById('ohm-newname').style.display=sel.value===''?'':'none';};
  sel.onchange();
};

window.ohmSave=function(){
  var selId=document.getElementById('ohm-ath').value;
  var date=document.getElementById('ohm-date').value||today();
  var ath=null;
  if(selId){ ath=S.athletes.find(function(x){return x.id===selId;}); }
  else { var fn=((document.getElementById('ohm-first')||{}).value||'').trim(); if(!fn){toast('Pick or name an athlete');return;}
    ath={id:uid(),first:fn,last:'',sport:'Soccer',position:'',age:'',status:'Active',notes:'',vald:{}}; S.athletes.push(ath); }
  if(!ath){toast('Pick athlete');return;}
  var pts=[];
  for(var i=0;i<4;i++){ var l=num(((document.getElementById('ohm-l'+i))||{}).value), w=num(((document.getElementById('ohm-w'+i))||{}).value); if(l!=null&&w!=null) pts.push({load:l,w:w}); }
  if(!pts.length){toast('Enter at least one load + watts');return;}
  if(!Array.isArray(ath.ohm))ath.ohm=[];
  var ex=ath.ohm.findIndex(function(s){return s.date===date;}); var rec={date:date,pts:pts};
  if(ex>=0)ath.ohm[ex]=rec; else ath.ohm.push(rec);
  save(); toast('OHM session saved \u2713'); _sel=null; ohmToggleForm(); render();
};

var _prev=window.initSprint;
function wrapped(){ try{ if(_prev)_prev.apply(this,arguments); }catch(e){} setTimeout(inject,180); }
window.initSprint=wrapped;
try{ if(typeof pageInits!=='undefined'&&pageInits) pageInits.sprint=wrapped; }catch(e){}
try{ if(S&&S.page==='sprint') setTimeout(inject,220); }catch(e){}

console.log('[ohm] OHM Force-Velocity loaded');
})();
