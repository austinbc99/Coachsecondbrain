/* ═══════════════════════════════════════════════════════════════════════════
   PERFORMANCE DROPIN — v1  (maxes + %-resolution, roster compliance)

   LOAD ORDER: after readiness-dropin.js (end of the chain). Requires PB
   (program-builder-dropin). Bails gracefully if missing.

   FEATURE 1 — WORKING MAXES + PERCENT RESOLUTION
   "3x5 @ 80%" should land on the sheet as a number, per athlete.
   Working max per exercise comes from two sources, best wins:
     manual  — coach-entered 1RM (ath.maxes[name] = {val,date,src:'manual'})
     derived — best e1RM from the last 90 days of p.loadHistory, using
               PB.e1rm (the RIR-corrected Epley already in the app), so
               every logged actual silently keeps maxes current.
   Rendering: PB.decorate is wrapped. The annotation pass runs BEFORE the
   previous chain (super-patch render → PB.decorate → BLK.decorate)
   because at that moment the tbody still maps one row per exercise —
   PB's own row mapping assumption — so tables[di].rows[ei] ↔
   s.exercises[ei] is exact. We append a resolved-load span inside the
   Load cell (found by matching the cell whose text equals ex.weight);
   DOM-only, weeks_data is never mutated, print/PDF stays clean.
   Rounding: nearest 5 lb — barbell math, not calculator math.

   FEATURE 2 — ROSTER COMPLIANCE (the churn early-warning)
   pageInits.dash is wrapped; after initDash a compliance card renders on
   Today: per programmed athlete — adherence (PB.adherence: ticked vs
   prescribed up to current week), last activity (newest of done
   timestamps, loadHistory dates, readiness checks), and days silent.
   Sorted worst-first because the kid quietly ghosting is the one you
   act on. Green ≤7d, orange ≤14d, red beyond. Tap a row → that athlete.

   Storage: ath.maxes lives inside S.athletes — already in the sync
   whitelist both directions, so no applyRemote patch needed here.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if(window.PX){console.log('[Perf] already loaded');return;}
const PX=window.PX={ver:'1.0',cfg:{derivedWindowDays:90,warnDays:7,badDays:14}};
if(!window.PB){console.warn('[Perf] PB missing — dropin idle');return;}

const norm=s=>String(s||'').toLowerCase().trim();
const round5=x=>Math.round(x/5)*5;

/* ---------- working maxes ---------- */
PX.derivedMax=function(athId,name){
  const p=S.programs[athId]; if(!p||!p.loadHistory)return null;
  const h=p.loadHistory[norm(name)]||[];
  const cutoff=Date.now()-PX.cfg.derivedWindowDays*864e5;
  let best=null;
  h.forEach(e=>{
    const t=Date.parse(e.date||''); if(!isNaN(t)&&t<cutoff)return;
    const v=PB.e1rm(e.actualWeight,e.actualReps,e.actualRPE);
    if(v!=null&&(best==null||v>best.val))best={val:v,date:e.date,src:'e1RM'};
  });
  return best;
};
PX.workingMax=function(athId,name){
  const ath=S.athletes.find(a=>a.id===athId);
  const man=ath&&ath.maxes&&ath.maxes[norm(name)];
  const der=PX.derivedMax(athId,name);
  if(man&&der)return der.val>man.val?der:{val:man.val,date:man.date,src:'manual'};
  if(man)return {val:man.val,date:man.date,src:'manual'};
  return der;
};
PX.setMax=function(athId,name,val){
  const ath=S.athletes.find(a=>a.id===athId); if(!ath)return;
  if(!ath.maxes)ath.maxes={};
  ath.maxes[norm(name)]={val:val,date:today(),src:'manual'};
  save();
};

/* ---------- percent annotation (wraps PB.decorate, pre-pass) ---------- */
const _dec=PB.decorate;
PB.decorate=function(athId,forceWkIdx){
  try{annotate(athId,forceWkIdx);}catch(e){console.warn('[Perf] annotate failed',e);}
  return _dec.apply(this,arguments);
};
function annotate(athId,forceWkIdx){
  const p=S.programs[athId]; if(!p)return;
  const wkIdx=forceWkIdx!==undefined?forceWkIdx:(p.currentWeek?p.currentWeek-1:0);
  const w=p.weeks_data&&p.weeks_data[wkIdx]; if(!w)return;
  const host=document.querySelector('.prog-week'); if(!host)return;
  let di=0;
  (w.days||[]).forEach(d=>(d.sessions||[]).forEach(s=>{
    const tbl=host.querySelectorAll('table.tbl')[di++]; if(!tbl)return;
    const body=tbl.querySelector('tbody'); if(!body)return;
    Array.from(body.rows).forEach((tr,ei)=>{
      const ex=(s.exercises||[])[ei]; if(!ex||!ex.weight)return;
      const m=String(ex.weight).match(/(\d+(?:\.\d+)?)\s*%/); if(!m)return;
      const wm=PX.workingMax(athId,ex.name); if(!wm)return;
      const load=round5(parseFloat(m[1])/100*wm.val);
      const cell=Array.from(tr.cells).find(td=>td.textContent.trim()===String(ex.weight).trim());
      if(!cell||cell.querySelector('.px-res'))return;
      cell.innerHTML+=' <span class="px-res" title="'+wm.src+' '+Math.round(wm.val)
        +' ('+(wm.date||'')+')" style="color:var(--accent);font-weight:600;white-space:nowrap;">\u2192 '
        +load+'</span>';
    });
  }));
}

/* ---------- maxes card on athlete profile (wraps showAthDetail) ---------- */
if(typeof window.showAthDetail==='function'){
  const _sad=window.showAthDetail;
  window.showAthDetail=function(athId){
    const r=_sad.apply(this,arguments);
    try{maxCard(athId);}catch(e){console.warn('[Perf] maxCard failed',e);}
    return r;
  };
}
function maxRows(athId){
  const ath=S.athletes.find(a=>a.id===athId); if(!ath)return '';
  const p=S.programs[athId];
  const names=new Set(Object.keys(ath.maxes||{}));
  Object.keys((p&&p.loadHistory)||{}).forEach(n=>names.add(n));
  if(!names.size)return '<div style="font-size:11px;color:var(--text2);">No maxes yet — log actuals or add one below. Percent loads on the sheet resolve automatically once a max exists.</div>';
  return '<table style="width:100%;border-collapse:collapse;font-size:11px;">'
   +'<thead><tr><th style="text-align:left;color:var(--text2);font-weight:500;padding:4px;">Lift</th><th style="text-align:left;color:var(--text2);font-weight:500;padding:4px;">Working max</th><th style="text-align:left;color:var(--text2);font-weight:500;padding:4px;">Source</th></tr></thead><tbody>'
   +Array.from(names).sort().map(n=>{
      const wm=PX.workingMax(athId,n); if(!wm)return '';
      return '<tr><td style="padding:4px;border-top:1px solid var(--border);">'+n+'</td>'
       +'<td style="padding:4px;border-top:1px solid var(--border);color:var(--accent);font-weight:600;">'+Math.round(wm.val)+'</td>'
       +'<td style="padding:4px;border-top:1px solid var(--border);color:var(--text3);">'+wm.src+' · '+(wm.date||'')+'</td></tr>';
    }).join('')+'</tbody></table>';
}
function maxCard(athId){
  const hostDetail=document.getElementById('ath-detail'); if(!hostDetail)return;
  let card=document.getElementById('px-maxes');
  if(!card){card=document.createElement('div');card.className='card';card.id='px-maxes';hostDetail.appendChild(card);}
  card.innerHTML='<div class="ph"><div class="ph-title">WORKING MAXES</div></div>'
   +'<div id="px-max-rows">'+maxRows(athId)+'</div>'
   +'<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">'
   +'<input id="px-mx-name" placeholder="lift name" style="flex:2;min-width:110px;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:var(--r,6px);padding:7px;font-size:12px;">'
   +'<input id="px-mx-val" type="number" placeholder="1RM" style="flex:1;min-width:70px;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:var(--r,6px);padding:7px;font-size:12px;">'
   +'<button class="btn" onclick="PX.addMax(\''+athId+'\')">Add</button></div>'
   +'<div style="font-size:9px;color:var(--text3);margin-top:6px;">e1RM maxes auto-update from logged actuals (last '+PX.cfg.derivedWindowDays+' days, RIR-corrected Epley). Manual entry wins only while it is higher.</div>';
}
PX.addMax=function(athId){
  const n=(document.getElementById('px-mx-name').value||'').trim();
  const v=parseFloat(document.getElementById('px-mx-val').value);
  if(!n||isNaN(v)||v<=0){toast('Lift name + number');return;}
  PX.setMax(athId,n,v);
  document.getElementById('px-max-rows').innerHTML=maxRows(athId);
  document.getElementById('px-mx-name').value='';document.getElementById('px-mx-val').value='';
  toast('Max saved — % loads now resolve for '+n);
};

/* ---------- roster compliance on Today (wraps pageInits.dash) ---------- */
function lastActivity(athId){
  const p=S.programs[athId];let t=0;
  if(p&&p.done)Object.values(p.done).forEach(wk=>Object.values(wk).forEach(e=>{
    const x=Date.parse(e&&e.t||'');if(!isNaN(x)&&x>t)t=x;}));
  if(p&&p.loadHistory)Object.values(p.loadHistory).forEach(h=>h.forEach(e=>{
    const x=Date.parse(e.date||'');if(!isNaN(x)&&x>t)t=x;}));
  if(S.readiness&&S.readiness[athId])S.readiness[athId].forEach(e=>{
    const x=Date.parse(e.date||'');if(!isNaN(x)&&x>t)t=x;});
  return t||null;
}
function complianceCard(){
  const pg=document.getElementById('pg-dash'); if(!pg)return;
  let card=document.getElementById('px-comp');
  if(!card){card=document.createElement('div');card.className='card';card.id='px-comp';pg.appendChild(card);}
  const rows=S.athletes.filter(a=>S.programs[a.id]).map(a=>{
    const adh=PB.adherence(S.programs[a.id])||{done:0,total:0};
    const pct=adh.total?Math.round(adh.done/adh.total*100):null;
    const la=lastActivity(a.id);
    const gap=la?Math.floor((Date.now()-la)/864e5):null;
    return {a:a,pct:pct,adh:adh,gap:gap};
  }).sort((x,y)=>(y.gap==null?999:y.gap)-(x.gap==null?999:x.gap));
  card.innerHTML='<div class="ph"><div class="ph-title">ROSTER COMPLIANCE</div></div>'
   +(rows.length?'<table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr>'
   +'<th style="text-align:left;color:var(--text2);font-weight:500;padding:5px;">Athlete</th>'
   +'<th style="text-align:left;color:var(--text2);font-weight:500;padding:5px;">Block adherence</th>'
   +'<th style="text-align:left;color:var(--text2);font-weight:500;padding:5px;">Last activity</th></tr></thead><tbody>'
   +rows.map(r=>{
     const col=r.gap==null?'var(--text3)':r.gap<=PX.cfg.warnDays?'var(--accent)':r.gap<=PX.cfg.badDays?'var(--orange)':'var(--red)';
     return '<tr onclick="S.selAth=\''+r.a.id+'\';go(\'athletes\');" style="cursor:pointer;">'
      +'<td style="padding:5px;border-top:1px solid var(--border);">'+an(r.a)+'</td>'
      +'<td style="padding:5px;border-top:1px solid var(--border);">'+(r.pct==null?'—':r.adh.done+'/'+r.adh.total+' ('+r.pct+'%)')+'</td>'
      +'<td style="padding:5px;border-top:1px solid var(--border);color:'+col+';">'
      +(r.gap==null?'never logged':r.gap===0?'today':r.gap+'d ago')+'</td></tr>';
   }).join('')+'</tbody></table>'
   :'<div style="font-size:11px;color:var(--text2);">No programmed athletes yet.</div>');
}
if(typeof pageInits!=='undefined'&&pageInits.dash){
  const _id=pageInits.dash;
  pageInits.dash=function(){const r=_id.apply(this,arguments);try{complianceCard();}catch(e){console.warn('[Perf] compliance failed',e);}return r;};
}
if(S&&S.page==='dash'){try{complianceCard();}catch(e){}}

console.log('%c[Perf] v'+PX.ver+' — maxes + % resolution + roster compliance','color:#7aa2c4');
})();
