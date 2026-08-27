/* ═══════════════════════════════════════════════════════════════════════
   COACH OS — BLOCKS & PHASES DROP-IN  v1.0
   Coach Austin C., ATC · Head Coach, FitClub CT

   LOAD ORDER: must come AFTER program-builder-dropin.js (index.html
   line ~894). It wraps that file's showProgDetail wrapper, so the
   chain is: super-patch render → PB.decorate → BLK.decorate.

   WHAT THIS IS (source: Relay Athletic teardown, Aug 2026)
   Relay's training hierarchy is Program → Phase (meso) → Workout →
   Block → Sets. Coach OS already has three of the four layers:
     Program        = S.programs[athId]                      ✓ have
     Phase (meso)   = weeks_data[].phase — EXISTS per week,
                      but was never rendered as architecture  ✓ have, hidden
     Workout        = day → session                           ✓ have
     Block          = MISSING. Sessions are flat exercise
                      lists. This file adds the layer.        ✗ build

   ── WHY BLOCKS ARE A TAG, NOT A NESTED ARRAY ─────────────────────────
   Every logged actual, check-off, and loadHistory entry is keyed by
   flat exercise index (day-sessionType-ei). Restructuring exercises
   into nested block arrays would orphan every actual ever logged.
   So the block is a STRING FIELD on the exercise (ex.block), grouping
   is done at render time, and exercise order is NEVER changed by this
   file. Weeks with logged data keep their keys forever.

   ── WHY THE BLOCK ORDER IS OURS, NOT RELAY'S ─────────────────────────
   Relay's canonical example is Warmup → Primary Strength →
   Conditioning — a lifter's session. Ours puts Speed/COD and reactive
   work immediately after movement prep, BEFORE strength, because the
   stack (Spellman: train speed fresh; Holler: quality over fatigue)
   says CNS-demanding output work never follows a fatiguing lift.
   Copy the hierarchy, not the sequence.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if(window.__blkDropinLoaded){console.warn('blocks-dropin already loaded');return;}
window.__blkDropinLoaded=true;

const BLK={ver:'1.0'};
window.BLK=BLK;

/* ═══════════════ SECTION 1 — CANONICAL BLOCKS ═══════════════════════════
   Names are renameable per session (a rename just rewrites the tag on
   that run of exercises), but generation and auto-tagging emit these. */

BLK.CANON=[
  {name:'Movement Prep',    color:'#8a8f98'},
  {name:'Speed / COD',      color:'#b8ff57'},   // fresh-first — Spellman
  {name:'Plyo / Reactive',  color:'#ffc842'},
  {name:'Primary Strength', color:'#42a5ff'},
  {name:'Accessory',        color:'#b88cff'},
  {name:'Conditioning',     color:'#ff8c42'}
];
BLK.color=function(name){
  const c=BLK.CANON.find(b=>b.name===name);
  return c?c.color:'var(--text3)';
};

/* ═══════════════ SECTION 2 — AUTO-TAG (migration for existing programs) ═
   Keyword heuristic for programs generated before this file existed.
   Match order matters: specific families first, Primary Strength next,
   Accessory as the fallback. Known imperfection: "press" is ambiguous
   (bench press = primary, DB shoulder press = accessory) — that is why
   every tag is editable in the UI. A heuristic that is right ~90% of
   the time plus a one-tap fix beats an untagged program. */

const RULES=[
  ['Movement Prep',   /warm|mobilit|activat|band walk|hip opener|leg swing|a-?skip|world'?s greatest|inchworm|glute bridge(?!.*(barbell|loaded))|foam roll/i],
  ['Speed / COD',     /sprint|accel|fly(?:ing)? \d|5-10-5|pro agility|shuttle|\bcut\b|decel|backpedal|\bcod\b|curve run|tempo run/i],
  ['Plyo / Reactive', /jump|hop|bound|plyo|depth|pogo|landing|rebound|hurdle|med ?ball|\bthrow\b|skater/i],
  ['Conditioning',    /\bbike\b|assault|\berg\b|\bski erg\b|interval|conditioning|\bsled\b|circuit|\bcarry\b|farmer/i],
  ['Primary Strength',/back squat|front squat|goblet squat|split squat|trap ?bar|deadlift|\brdl\b|hip thrust|bench|\bohp\b|overhead press|pull-?up|chin-?up|\brow\b(?!er)|clean|snatch|push press/i]
];
BLK.classify=function(ex){
  const n=(ex.name||'');
  for(const[b,re]of RULES){if(re.test(n))return b;}
  // flags help where names don't: Natera iso holds without "landing" in
  // the name, Nordic/glute-med ACL work → accessory tier by design
  if(ex.tendonWork)return'Accessory';
  if(ex.aclWork)return'Accessory';
  return'Accessory';
};

BLK.autoTag=function(athId){
  const p=S.programs[athId]; if(!p)return;
  let tagged=0;
  (p.weeks_data||[]).forEach(w=>(w.days||[]).forEach(d=>(d.sessions||[]).forEach(s=>{
    (s.exercises||[]).forEach(ex=>{
      if(ex.block)return;               // never overwrite a coach's tag
      ex.block=BLK.classify(ex); tagged++;
    });
  })));
  save();
  toast(tagged?('Tagged '+tagged+' exercises into blocks — review and rename where the heuristic guessed wrong'):'Already fully tagged');
  if(typeof showProgDetail==='function')showProgDetail(athId);
};

/* ═══════════════ SECTION 3 — GENERATION (new programs tag themselves) ═══
   Wraps buildWeekPrompt LAST in the chain (super-patch adds OHM/why/
   evidence, pb-dropin adds needs analysis + constraints, this adds
   structure). weekObj from the API is stored whole with no field
   whitelist (super-patch ~line 645), so "block" and "pair" survive
   into weeks_data with zero parser changes. */

if(typeof window.buildWeekPrompt==='function'){
  const _blkPrevBWP=window.buildWeekPrompt;
  window.buildWeekPrompt=function(){
    let base=_blkPrevBWP.apply(this,arguments);
    base+='\n\nSESSION BLOCK STRUCTURE (mandatory): every exercise object must also include a "block" field, exactly one of: "Movement Prep","Speed / COD","Plyo / Reactive","Primary Strength","Accessory","Conditioning". '
      +'List exercises in that block order within each session — speed, COD, and reactive work come FIRST after movement prep, while the CNS is fresh; they never follow strength or conditioning. Not every session needs every block. '
      +'\nSUPERSETS: exercises paired as a superset get a "pair" field ("A1","A2","B1","B2"...). Only pair within Primary Strength or Accessory — never superset speed, plyo, or conditioning work. Pairs must sit on consecutive exercises in the same block.';
    return base;
  };
}

/* ═══════════════ SECTION 4 — RENDER DECORATION ══════════════════════════
   Same pattern as PB.decorate: run after the existing render, walk the
   DOM, never fork the render function. Ordering is load-order-safe:
   our wrapper wraps pb-dropin's wrapper, so PB's ✓/± columns already
   exist when we insert header rows — and we snapshot the row list
   BEFORE inserting so ei alignment with exercise indices holds. */

const _blkPrevSPD=window.showProgDetail;
window.showProgDetail=function(athId,forceWkIdx){
  if(typeof _blkPrevSPD==='function')_blkPrevSPD.apply(this,arguments);
  try{BLK.decorate(athId,forceWkIdx);}catch(e){console.warn('BLK decorate failed',e);}
};

BLK.decorate=function(athId,forceWkIdx){
  const p=S.programs[athId]; if(!p)return;
  const wkIdx=forceWkIdx!==undefined?forceWkIdx:(p.currentWeek?p.currentWeek-1:0);
  const w=p.weeks_data[wkIdx]; if(!w)return;
  const host=document.querySelector('.prog-week'); if(!host)return;

  BLK.phaseStrip(p,athId,wkIdx,host);

  // "Structure into Blocks" appears only while untagged work exists
  const untagged=(w.days||[]).some(d=>(d.sessions||[]).some(s=>(s.exercises||[]).some(ex=>!ex.block)));
  const bar=document.getElementById('pb-toolbar');
  if(bar&&untagged&&!document.getElementById('blk-autotag')){
    const b=document.createElement('button');
    b.id='blk-autotag';
    b.style.cssText='padding:5px 10px;font-size:9px;border-radius:var(--r);border:1px solid #42a5ff;background:var(--bg3);color:#42a5ff;cursor:pointer;';
    b.textContent='🧱 Structure into Blocks';
    b.onclick=function(){BLK.autoTag(athId);};
    bar.appendChild(b);
  }

  let ti=0;
  (w.days||[]).forEach((d,dIdx)=>(d.sessions||[]).forEach((s,sIdx)=>{
    const tbl=host.querySelectorAll('table.tbl')[ti++]; if(!tbl)return;
    const body=tbl.querySelector('tbody'); if(!body)return;
    const cols=tbl.querySelectorAll('thead th').length||10;
    const rows=Array.from(body.rows);           // snapshot BEFORE inserting
    let prevBlock=null;

    rows.forEach((tr,ei)=>{
      const ex=(s.exercises||[])[ei]; if(!ex)return;

      // block header row wherever the tag changes down the list
      if(ex.block&&ex.block!==prevBlock){
        const start=ei;
        let end=ei;
        while(end+1<(s.exercises||[]).length&&s.exercises[end+1].block===ex.block)end++;
        const hdr=document.createElement('tr');
        hdr.dataset.blk='1';
        hdr.innerHTML='<td colspan="'+cols+'" style="padding:5px 6px 3px;background:var(--bg3);'
          +'border-left:3px solid '+BLK.color(ex.block)+';">'
          +'<span style="font-size:8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;'
          +'color:'+BLK.color(ex.block)+';">'+ex.block+'</span>'
          +'<a href="#" onclick="event.preventDefault();BLK.rename(\''+athId+'\','+wkIdx+','+dIdx+','+sIdx+','+start+','+end+')" '
          +'style="font-size:8px;color:var(--text3);margin-left:8px;text-decoration:none;">rename</a>'
          +'</td>';
        body.insertBefore(hdr,tr);
      }
      prevBlock=ex.block||prevBlock;

      // pair chip (A1/A2) + tap-to-recycle block chip on the name cell
      const inp=tr.querySelector('td input');
      const nameCell=inp?inp.closest('td'):tr.cells[0];
      if(nameCell&&!nameCell.dataset.blk){
        nameCell.dataset.blk='1';
        if(ex.pair){
          const chip=document.createElement('span');
          chip.style.cssText='font-size:8px;font-family:var(--mono);font-weight:700;'
            +'background:rgba(66,165,255,.15);color:#42a5ff;padding:1px 4px;border-radius:2px;margin-right:4px;';
          chip.textContent=ex.pair;
          nameCell.insertBefore(chip,nameCell.firstChild);
        }
        const cyc=document.createElement('span');
        cyc.title='Move to next block (fix a mis-tag)';
        cyc.style.cssText='font-size:7px;color:var(--text3);cursor:pointer;margin-left:4px;user-select:none;';
        cyc.textContent='⇅';
        cyc.onclick=function(){BLK.cycle(athId,wkIdx,dIdx,sIdx,ei);};
        nameCell.appendChild(cyc);
      }
    });
  }));
};

BLK.rename=function(athId,wkIdx,di,si,startEi,endEi){
  const p=S.programs[athId]; if(!p)return;
  const s=p.weeks_data[wkIdx].days[di].sessions[si];
  const cur=s.exercises[startEi].block||'';
  const nm=prompt('Block name:',cur); if(nm==null||!nm.trim())return;
  for(let i=startEi;i<=endEi;i++)s.exercises[i].block=nm.trim();
  save(); showProgDetail(athId,wkIdx);
};

BLK.cycle=function(athId,wkIdx,di,si,ei){
  const p=S.programs[athId]; if(!p)return;
  const ex=p.weeks_data[wkIdx].days[di].sessions[si].exercises[ei];
  const i=BLK.CANON.findIndex(b=>b.name===ex.block);
  ex.block=BLK.CANON[(i+1)%BLK.CANON.length].name;
  save(); showProgDetail(athId,wkIdx);
};

/* ═══════════════ SECTION 5 — PHASE STRIP (the meso layer, finally shown) ═
   weeks_data[].phase has carried mesocycle names since day one — this
   just renders contiguous runs of the same phase as an architecture
   bar, Relay-grid style. Zero new data. Click a segment to jump to
   that phase's first week. */

BLK.phaseStrip=function(p,athId,wkIdx,host){
  if(document.getElementById('blk-phasestrip'))return;
  const wd=p.weeks_data||[]; if(wd.length<2)return;
  const runs=[];
  wd.forEach((w,i)=>{
    const ph=w.phase||'—';
    const last=runs[runs.length-1];
    if(last&&last.phase===ph)last.n++;
    else runs.push({phase:ph,n:1,firstIdx:i});
  });
  if(runs.length<2)return;                      // one phase = nothing to show

  const strip=document.createElement('div');
  strip.id='blk-phasestrip';
  strip.style.cssText='display:flex;gap:2px;margin-bottom:8px;';
  strip.innerHTML=runs.map(r=>{
    const active=wkIdx>=r.firstIdx&&wkIdx<r.firstIdx+r.n;
    const rt=r.phase==='Retest';
    return'<div onclick="showProgDetail(\''+athId+'\','+r.firstIdx+')" '
      +'style="flex:'+r.n+';min-width:0;cursor:pointer;text-align:center;padding:4px 2px;'
      +'border-radius:3px;font-size:8px;letter-spacing:.5px;text-transform:uppercase;overflow:hidden;'
      +'white-space:nowrap;text-overflow:ellipsis;'
      +'border:1px solid '+(active?'var(--accent)':rt?'rgba(255,140,66,.4)':'var(--border2)')+';'
      +'background:'+(active?'rgba(184,255,87,.12)':'var(--bg3)')+';'
      +'color:'+(active?'var(--accent)':rt?'var(--orange)':'var(--text3)')+';" '
      +'title="'+r.phase+' — weeks '+(r.firstIdx+1)+'–'+(r.firstIdx+r.n)+'">'
      +(rt?'🔁 ':'')+r.phase+' <span style="opacity:.6;">·'+r.n+'w</span></div>';
  }).join('');
  const bar=document.getElementById('pb-toolbar');
  const anchor=bar||host;
  anchor.parentNode.insertBefore(strip,anchor);
};

/* ═══════════════ SECTION 6 — BLOCK-AWARE PRINT ══════════════════════════
   Overrides PB.printProgram so the parent/athlete-facing PDF is where
   the structure shows most. Same print-stylesheet approach (no jsPDF,
   zero KB, stays a single-file PWA); adds a phase overview line and
   block sub-headers inside each session table. */

if(window.PB&&typeof PB.printProgram==='function'){
  PB.printProgram=function(athId){
    const p=S.programs[athId]; if(!p)return;
    const ath=S.athletes.find(a=>a.id===athId);

    const wd=p.weeks_data||[];
    const phRuns=[];
    wd.forEach((w,i)=>{
      const last=phRuns[phRuns.length-1];
      if(last&&last.phase===(w.phase||'—'))last.n++;
      else phRuns.push({phase:w.phase||'—',n:1,first:i+1});
    });
    const phaseLine=phRuns.length>1
      ?'<div class="hdr">Phases: '+phRuns.map(r=>r.phase+' (Wk '+r.first+'–'+(r.first+r.n-1)+')').join(' → ')+'</div>'
      :'';

    const rows=wd.map(w=>
      '<h2>Week '+w.week+' — '+(w.phase||'')+(w.focus?' · '+w.focus:'')+'</h2>'
      +(w.days||[]).map(d=>(d.sessions||[]).map(s=>{
        let prevB=null;
        return'<h3>'+d.day+' — '+s.type+'</h3>'
        +(s.warmup?'<p><em>Warm-up: '+s.warmup+'</em></p>':'')
        +'<table><thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Tempo</th>'
        +'<th>Weight</th><th>RPE</th><th>Actual</th></tr></thead><tbody>'
        +(s.exercises||[]).map(ex=>{
          let hdr='';
          if(ex.block&&ex.block!==prevB){
            hdr='<tr><td colspan="7" class="blkhdr">'+ex.block+'</td></tr>';
            prevB=ex.block;
          }
          return hdr+'<tr><td>'+(ex.pair?'<span class="pair">'+ex.pair+'</span> ':'')
          +'<strong>'+(ex.name||'')+'</strong>'
          +(ex.cue?'<br><span class="cue">'+ex.cue+'</span>':'')+'</td>'
          +'<td>'+(ex.sets||'')+'</td><td>'+(ex.reps||'')+'</td><td>'+(ex.tempo||'')+'</td>'
          +'<td>'+(ex.weight||'')+'</td><td>'+(ex.rpe||'')+'</td><td class="blank"></td></tr>';
        }).join('')
        +'</tbody></table>';
      }).join('')).join('')).join('');

    const win=window.open('','_blank');
    if(!win){toast('Popup blocked — allow popups to print');return;}
    win.document.write('<!doctype html><html><head><meta charset="utf-8">'
      +'<title>'+(ath?an(ath):'Program')+'</title><style>'
      +'body{font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:11px;color:#111;margin:24px;}'
      +'h1{font-size:17px;margin:0 0 2px;} h2{font-size:13px;margin:18px 0 4px;'
      +'border-bottom:1.5px solid #111;padding-bottom:2px;page-break-after:avoid;}'
      +'h3{font-size:11px;margin:10px 0 3px;page-break-after:avoid;}'
      +'table{width:100%;border-collapse:collapse;margin-bottom:8px;page-break-inside:avoid;}'
      +'th{background:#f0f0f0;text-align:left;font-size:9px;padding:3px 5px;border:1px solid #ccc;}'
      +'td{padding:3px 5px;border:1px solid #ddd;vertical-align:top;font-size:10px;}'
      +'td.blank{min-width:70px;background:#fafafa;} .cue{font-size:8px;color:#666;font-style:italic;}'
      +'td.blkhdr{background:#e8e8e8;font-size:8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#333;}'
      +'.pair{font-size:8px;font-weight:700;color:#1a6fc4;font-family:monospace;}'
      +'.hdr{font-size:9px;color:#555;margin-bottom:4px;}'
      +'@media print{@page{margin:12mm;}}'
      +'</style></head><body>'
      +'<h1>'+(ath?an(ath):'Program')+'</h1>'
      +'<div class="hdr">'+(p.goal||p.focus||'')+' · '+wd.length+' weeks'
      +'<br>Coach Austin C., ATC · Head Coach, FitClub CT</div>'
      +phaseLine
      +rows+'</body></html>');
    win.document.close();
    setTimeout(()=>{try{win.print();}catch(e){}},350);
  };
}

console.log('%cCoach OS Blocks & Phases drop-in v'+BLK.ver+' loaded',
            'color:#42a5ff;font-weight:bold');
})();
