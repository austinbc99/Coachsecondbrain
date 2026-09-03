/* ═══════════════════════════════════════════════════════════════════════════
   READINESS DROPIN — v1
   "Right plan, wrong time is meaningless." (Spellman, dose-response matrix)

   LOAD ORDER: after coach-os-shell.js (last script in index.html).

   WHAT IT DOES
   1. Adds a "Ready" sub-tab under Athletes (injected into the shell's
      existing subnav — Shell.sub() handles pg-readiness with zero shell
      edits because it toggles by id convention).
   2. Session-open check: coach enters CMJ, 10/5 pogo RSI, last-session /
      week RPE, optional pain flag. Compared against a ROLLING baseline
      (mean of that athlete's last 5 readiness entries; seeded from
      ath.vald.cmj / ath.vald.rsi when no history exists yet).
   3. Assigns a quadrant (dose-response matrix):
        GREEN    response normal                  → run plan as written
        FATIGUED response down + high load (RPE)  → keep intensity, cut dose
        STALE    response down + low load         → novelty + max intent
        RED      pain flagged                     → trim + pattern-swap flag
      Response is "down" when the WORST of CMJ% / RSI% vs baseline drops
      past cfg.dropPct (default 8%). Worst-of, not average — one system
      screaming is enough reason to adjust.
   4. One tap applies the quadrant's transformation to the chosen
      week/day of S.programs[athId]:
        FATIGUED: Primary Strength & Accessory lose their last set
                  (never below 1); Speed/COD + Plyo reps cut ~1/3 with a
                  "cap build-up distance" note (the 30+10 → 20+10 move:
                  exposure shrinks, intensity stays >90%); Conditioning
                  drops to 1 set.
        STALE:    sets untouched on speed/primary; Accessory -1 set;
                  session note demands PR intent + full recovery.
        RED:      FATIGUED trims + every loaded exercise gets a
                  "swap pattern away from [area]" note. The swap itself
                  stays a coach decision — automating injury substitutions
                  is how you hurt a kid with confidence.
      Every touched exercise stores _rdyOrig {sets,reps,cue} ONCE, so
      Revert restores the program exactly. Only sets/reps/cue are ever
      written; block / pair / rest / actuals / done are never touched
      (same contract as blocks-dropin: transform the dose, never the
      structure).
   5. Every check is logged to S.readiness[athId] — the saved record.
      pushState() already ships all of S to the cloud ({...S}), but
      applyRemote() PULLS a whitelist, so this file wraps applyRemote to
      merge 'readiness' with the same empty-cloud guard the Aug 28 sync
      fix uses (an empty cloud can never wipe non-empty local logs).

   WHY sets/reps strings are parsed defensively: builder output is
   free-text ("4", "3", "20 yd"). Leading-int parse; if a field doesn't
   parse, the numeric trim is skipped and only the note is added.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if(window.RDY){console.log('[Readiness] already loaded');return;}
const RDY=window.RDY={ver:'1.0',cfg:{dropPct:8,highRPE:8,baselineN:5}};

/* ---------- state ---------- */
function ensureState(){if(!S.readiness)S.readiness={};}
function log(athId){ensureState();if(!S.readiness[athId])S.readiness[athId]=[];return S.readiness[athId];}

/* ---------- sync: applyRemote whitelist wrap (pull-side) ---------- */
if(typeof window.applyRemote==='function'){
  const _ar=window.applyRemote;
  window.applyRemote=function(r){
    const skipped=_ar(r);
    try{
      if(r&&typeof r==='object'&&r.readiness!==undefined){
        const rEmpty=!Object.keys(r.readiness||{}).length;
        const lHas=!!(S.readiness&&Object.keys(S.readiness).length);
        if(!(rEmpty&&lHas))S.readiness=r.readiness;   // same guard shape as core
      }
    }catch(e){}
    return skipped;
  };
}

/* ---------- baseline ---------- */
function baseline(athId){
  const h=log(athId).filter(e=>e.cmj!=null||e.rsi!=null);
  const lastN=h.slice(-RDY.cfg.baselineN);
  const mean=k=>{const v=lastN.map(e=>e[k]).filter(x=>x!=null&&!isNaN(x));return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;};
  let cmj=mean('cmj'),rsi=mean('rsi');
  const ath=S.athletes.find(a=>a.id===athId);
  if(cmj==null&&ath&&ath.vald&&ath.vald.cmj!=null)cmj=ath.vald.cmj;   // seed from VALD baseline
  if(rsi==null&&ath&&ath.vald&&ath.vald.rsi!=null)rsi=ath.vald.rsi;
  return {cmj,rsi,n:lastN.length};
}

/* ---------- quadrant ---------- */
function pct(now,base){if(now==null||base==null||!base)return null;return (now-base)/base*100;}
function quadrant(entry,base){
  if(entry.pain)return 'RED';
  const drops=[pct(entry.cmj,base.cmj),pct(entry.rsi,base.rsi)].filter(x=>x!=null);
  const worst=drops.length?Math.min.apply(null,drops):null;
  entry.worstPct=worst==null?null:Math.round(worst*10)/10;
  const respDown=worst!=null&&worst<=-RDY.cfg.dropPct;
  if(!respDown)return 'GREEN';
  const highLoad=entry.rpe!=null&&entry.rpe>=RDY.cfg.highRPE;
  return highLoad?'FATIGUED':'STALE';
}
const QCOLOR={GREEN:'var(--accent)',FATIGUED:'var(--orange)',STALE:'var(--text3)',RED:'var(--red)'};
const QTEXT={
  GREEN:'Run the plan as written.',
  FATIGUED:'Keep intensity, cut the dose: -1 set on strength, speed exposure capped, conditioning minimal.',
  STALE:'Body is flat, not fried. Novelty + max intent: full recovery, PR intent on speed and primaries, accessory trimmed.',
  RED:'Pain flagged. Volume trimmed; swap loaded patterns away from the area — coach call, not automated.'
};

/* ---------- program transformation ---------- */
function leadInt(v){const m=String(v==null?'':v).match(/\d+/);return m?parseInt(m[0],10):null;}
function setInt(orig,n){return String(orig==null?'':orig).replace(/\d+/,String(n));}
function stamp(ex){if(!ex._rdyOrig)ex._rdyOrig={sets:ex.sets,reps:ex.reps,cue:ex.cue};}
function note(ex,txt){stamp(ex);ex.cue=((ex.cue||'')+(ex.cue?' | ':'')+txt);}

function transform(p,wkIdx,dayIdx,quad,painArea){
  if(quad==='GREEN')return 0;
  const day=p.weeks_data&&p.weeks_data[wkIdx]&&p.weeks_data[wkIdx].days&&p.weeks_data[wkIdx].days[dayIdx];
  if(!day)return -1;
  let touched=0;
  (day.sessions||[]).forEach(s=>{
    s._readiness={date:today(),quad:quad};
    (s.exercises||[]).forEach(ex=>{
      const b=ex.block||'';
      const sets=leadInt(ex.sets),reps=leadInt(ex.reps);
      if(quad==='FATIGUED'||quad==='RED'){
        if(b==='Primary Strength'||b==='Accessory'){
          if(sets&&sets>1){stamp(ex);ex.sets=setInt(ex.sets,sets-1);touched++;}
        }else if(b==='Speed / COD'||b==='Plyo / Reactive'){
          if(reps&&reps>1){stamp(ex);ex.reps=setInt(ex.reps,Math.max(1,Math.ceil(reps*2/3)));touched++;}
          note(ex,'cap build-up distance, intensity stays >90%');
        }else if(b==='Conditioning'){
          if(sets&&sets>1){stamp(ex);ex.sets=setInt(ex.sets,1);touched++;}
          note(ex,'minimal dose today');
        }
        if(quad==='RED'&&(b==='Primary Strength'||b==='Accessory'))
          note(ex,'SWAP if pattern loads: '+(painArea||'flagged area'));
      }else if(quad==='STALE'){
        if(b==='Accessory'&&sets&&sets>1){stamp(ex);ex.sets=setInt(ex.sets,sets-1);touched++;}
        if(b==='Speed / COD'||b==='Plyo / Reactive')note(ex,'PR intent, full recovery');
      }
    });
  });
  return touched;
}
function revert(p,wkIdx,dayIdx){
  const day=p.weeks_data&&p.weeks_data[wkIdx]&&p.weeks_data[wkIdx].days&&p.weeks_data[wkIdx].days[dayIdx];
  if(!day)return 0;let n=0;
  (day.sessions||[]).forEach(s=>{
    delete s._readiness;
    (s.exercises||[]).forEach(ex=>{
      if(ex._rdyOrig){ex.sets=ex._rdyOrig.sets;ex.reps=ex._rdyOrig.reps;ex.cue=ex._rdyOrig.cue;delete ex._rdyOrig;n++;}
    });
  });
  return n;
}

/* ---------- UI ---------- */
function css(){
  if(document.getElementById('rdy-css'))return;
  const s=document.createElement('style');s.id='rdy-css';
  s.textContent=
  '#pg-readiness .rdy-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;}'
 +'#pg-readiness label{font-size:10px;color:var(--text2);display:block;margin-bottom:3px;letter-spacing:.4px;}'
 +'#pg-readiness input[type=number],#pg-readiness input[type=text],#pg-readiness select{width:100%;box-sizing:border-box;'
 +'background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:var(--r,6px);padding:8px;font-size:13px;}'
 +'.rdy-chip{display:inline-block;padding:2px 10px;border-radius:999px;font-size:10px;font-weight:600;letter-spacing:.5px;'
 +'border:1px solid var(--border);}'
 +'.rdy-verdict{margin-top:12px;padding:12px;border:1px solid var(--border);border-radius:var(--r,6px);background:var(--bg2);font-size:12px;line-height:1.5;}'
 +'#rdy-hist table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px;}'
 +'#rdy-hist th{color:var(--text2);font-weight:500;text-align:left;padding:6px 6px;border-bottom:1px solid var(--border);font-size:10px;letter-spacing:.4px;}'
 +'#rdy-hist td{padding:6px 6px;border-bottom:1px solid var(--border);color:var(--text);}'
 +'.rdy-base{font-size:10px;color:var(--text3);margin-top:6px;}';
  document.head.appendChild(s);
}

function athlete(){return S.athletes.find(a=>a.id===S.selAth);}

function page(){
  let pg=document.getElementById('pg-readiness');
  if(pg)return pg;
  pg=document.createElement('div');pg.className='page';pg.id='pg-readiness';
  const wrap=document.getElementById('ath-sub');
  if(wrap)wrap.appendChild(pg);
  else{const host=document.getElementById('pg-athletes');if(host)host.appendChild(pg);}
  return pg;
}

function weekDayOptions(p){
  if(!p||!p.weeks_data||!p.weeks_data.length)return '';
  let wk='',dy='';
  p.weeks_data.forEach((w,i)=>wk+='<option value="'+i+'">Wk '+(i+1)+(w.emphasis?' ('+w.emphasis+')':'')+'</option>');
  const d0=(p.weeks_data[0].days||[]);
  d0.forEach((d,i)=>dy+='<option value="'+i+'">Day '+(i+1)+'</option>');
  return '<div><label>Apply to week</label><select id="rdy-wk">'+wk+'</select></div>'
        +'<div><label>Day</label><select id="rdy-dy">'+dy+'</select></div>';
}

function render(){
  css();
  const pg=page();const ath=athlete();
  if(!ath){pg.innerHTML='<div class="card"><div class="ph"><div class="ph-title">READINESS</div></div><div style="font-size:12px;color:var(--text2);">Select an athlete first.</div></div>';return;}
  const base=baseline(ath.id);const p=S.programs[ath.id];
  const hist=log(ath.id).slice().reverse();
  pg.innerHTML=
   '<div class="card"><div class="ph"><div class="ph-title">SESSION-OPEN READINESS — '+an(ath)+'</div></div>'
  +'<div class="rdy-grid">'
  +'<div><label>CMJ (same unit as baseline)</label><input type="number" step="0.1" id="rdy-cmj" placeholder="'+(base.cmj!=null?('base '+(Math.round(base.cmj*10)/10)):'no baseline')+'"></div>'
  +'<div><label>10/5 Pogo RSI</label><input type="number" step="0.01" id="rdy-rsi" placeholder="'+(base.rsi!=null?('base '+(Math.round(base.rsi*100)/100)):'no baseline')+'"></div>'
  +'<div><label>Last session / week RPE</label><input type="number" min="1" max="10" step="0.5" id="rdy-rpe"></div>'
  +'</div>'
  +'<div style="margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
  +'<label style="display:flex;align-items:center;gap:6px;margin:0;font-size:11px;color:var(--text);"><input type="checkbox" id="rdy-pain"> Pain / issue</label>'
  +'<input type="text" id="rdy-pain-txt" placeholder="area (e.g. R hamstring)" style="flex:1;min-width:140px;display:none;">'
  +'</div>'
  +'<div class="rdy-grid" style="margin-top:10px;">'+weekDayOptions(p)+'</div>'
  +'<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">'
  +'<button class="btn" onclick="RDY.check(false)">Check only</button>'
  +'<button class="btn primary" onclick="RDY.check(true)"'+(p?'':' disabled title="No program yet"')+'>Log + apply to session</button>'
  +'<button class="btn" onclick="RDY.revertDay()"'+(p?'':' disabled')+'>Revert day</button>'
  +'</div>'
  +'<div id="rdy-out"></div>'
  +'<div class="rdy-base">Baseline = rolling mean of last '+RDY.cfg.baselineN+' checks ('+base.n+' logged'+(base.n?'':', seeded from VALD profile')+'). Flag threshold: worst metric down '+RDY.cfg.dropPct+'%+.</div>'
  +'</div>'
  +'<div class="card" id="rdy-hist"><div class="ph"><div class="ph-title">READINESS LOG</div></div>'
  +(hist.length?histTable(hist,base):'<div style="font-size:12px;color:var(--text2);">No checks logged yet. First few builds the baseline.</div>')
  +'</div>';
  const cb=document.getElementById('rdy-pain');
  if(cb)cb.onchange=function(){document.getElementById('rdy-pain-txt').style.display=cb.checked?'block':'none';};
}

function histTable(hist,base){
  return '<table><thead><tr><th>Date</th><th>CMJ</th><th>RSI</th><th>RPE</th><th>Worst Δ</th><th>Call</th><th>Applied</th></tr></thead><tbody>'
  +hist.map(e=>'<tr><td>'+e.date+'</td><td>'+(e.cmj!=null?e.cmj:'—')+'</td><td>'+(e.rsi!=null?e.rsi:'—')+'</td><td>'+(e.rpe!=null?e.rpe:'—')+'</td>'
   +'<td>'+(e.worstPct!=null?(e.worstPct>0?'+':'')+e.worstPct+'%':'—')+'</td>'
   +'<td><span class="rdy-chip" style="color:'+QCOLOR[e.quad]+';border-color:'+QCOLOR[e.quad]+';">'+e.quad+'</span></td>'
   +'<td>'+(e.applied?('Wk'+(e.applied.wk+1)+' D'+(e.applied.dy+1)):'—')+'</td></tr>').join('')
  +'</tbody></table>';
}

/* ---------- actions ---------- */
RDY.check=function(apply){
  const ath=athlete();if(!ath){toast('Select an athlete');return;}
  const num=id=>{const v=document.getElementById(id).value;return v===''?null:parseFloat(v);};
  const entry={date:today(),cmj:num('rdy-cmj'),rsi:num('rdy-rsi'),rpe:num('rdy-rpe'),
               pain:document.getElementById('rdy-pain').checked,
               painArea:(document.getElementById('rdy-pain-txt').value||'').trim()};
  if(entry.cmj==null&&entry.rsi==null&&!entry.pain){toast('Enter at least one jump metric');return;}
  const base=baseline(ath.id);
  const quad=quadrant(entry,base);entry.quad=quad;
  let appliedMsg='';
  if(apply){
    const p=S.programs[ath.id];
    const wk=parseInt((document.getElementById('rdy-wk')||{}).value||'0',10);
    const dy=parseInt((document.getElementById('rdy-dy')||{}).value||'0',10);
    if(p){
      const t=transform(p,wk,dy,quad,entry.painArea);
      if(t===-1)appliedMsg='Could not find that week/day.';
      else{entry.applied={wk:wk,dy:dy,touched:t};
           appliedMsg=quad==='GREEN'?'GREEN — program untouched, logged.':(t+' exercises adjusted on Wk'+(wk+1)+' D'+(dy+1)+'. Open Program to review.');}
    }
  }
  log(ath.id).push(entry);
  save();
  const out=document.getElementById('rdy-out');
  out.innerHTML='<div class="rdy-verdict"><span class="rdy-chip" style="color:'+QCOLOR[quad]+';border-color:'+QCOLOR[quad]+';">'+quad+'</span>'
    +(entry.worstPct!=null?' <span style="color:var(--text2);">worst metric '+(entry.worstPct>0?'+':'')+entry.worstPct+'% vs baseline</span>':'')
    +'<div style="margin-top:6px;">'+QTEXT[quad]+'</div>'
    +(appliedMsg?'<div style="margin-top:6px;color:var(--text2);">'+appliedMsg+'</div>':'')+'</div>';
  render._keepOut=out.innerHTML;
  render();document.getElementById('rdy-out').innerHTML=render._keepOut;
};

RDY.revertDay=function(){
  const ath=athlete();if(!ath)return;
  const p=S.programs[ath.id];if(!p){toast('No program');return;}
  const wk=parseInt((document.getElementById('rdy-wk')||{}).value||'0',10);
  const dy=parseInt((document.getElementById('rdy-dy')||{}).value||'0',10);
  const n=revert(p,wk,dy);save();
  toast(n?('Restored '+n+' exercises'):'Nothing to revert on that day');
};

/* ---------- shell integration ---------- */
function inject(){
  const subnav=document.getElementById('ath-subnav');
  if(!subnav){  // shell off or not ready — retry, then fall back into Athletes page
    if(inject.tries==null)inject.tries=0;
    if(++inject.tries<20){setTimeout(inject,400);return;}
    page();render();return;
  }
  if(subnav.querySelector('[data-sub="readiness"]'))return;
  const btn=document.createElement('div');
  btn.className='sb';btn.dataset.sub='readiness';
  btn.innerHTML='<span>\u223F</span>Ready';
  btn.onclick=function(){render();Shell.sub('readiness');};
  const progBtn=Array.from(subnav.children).find(c=>!c.dataset.sub);  // the Program jump button
  subnav.insertBefore(btn,progBtn||null);
  page();
  console.log('%c[Readiness] v'+RDY.ver+' — dose-response matrix live','color:#7aa2c4');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);
else inject();
})();
