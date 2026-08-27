/* ═══════════════════════════════════════════════════════════════════════
   COACH OS — BLOCKS & PHASES DROP-IN  v1.1
   Coach Austin C., ATC · Head Coach, FitClub CT

   LOAD ORDER: after program-builder-dropin.js. Wrap chain:
   super-patch render → PB.decorate → BLK.decorate.

   v1.1 — STRENGTH-SHEET LETTERING + PROFESSIONAL RESTYLE
   1. Letter ordering (A1/A2, B1...) on every exercise outside Movement
      Prep — the standard S&C sheet convention. AI-assigned "pair" tags
      are honored verbatim; legacy programs get display-only derived
      letters (one letter per standalone exercise), so no data mutates.
   2. Pro skin on the program view: emoji stripped, neon chips become
      quiet outlines, block headers are small-caps over hairlines. The
      skin is scoped to #prog-detail — the rest of the app is untouched.
   3. Print/PDF fully redesigned: instrument-grade sheet, ink-on-paper,
      mono letter spine, small-caps block sections. The parent-facing
      artifact carries the professionalism hardest.

   Everything from v1.0 stands: block-as-tag (never nested arrays, so
   actuals/done/loadHistory keys survive forever), never reordering
   exercises, our block sequence (speed fresh-first, per Spellman/
   Holler) not Relay's lifter sequence.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if(window.__blkDropinLoaded){console.warn('blocks-dropin already loaded');return;}
window.__blkDropinLoaded=true;

const BLK={ver:'1.1'};
window.BLK=BLK;

/* ═══════════════ SECTION 1 — CANONICAL BLOCKS ═══════════════════════════ */

BLK.CANON=[
  {name:'Movement Prep'},
  {name:'Speed / COD'},        // fresh-first — Spellman
  {name:'Plyo / Reactive'},
  {name:'Primary Strength'},
  {name:'Accessory'},
  {name:'Conditioning'}
];

/* ═══════════════ SECTION 2 — LETTERING ══════════════════════════════════
   One shared function so the app view and the print sheet can never
   disagree. Rules: Movement Prep is unlettered (warm-ups aren't
   lettered on any real sheet). An explicit ex.pair ("A1"/"A2") is the
   coach's or the AI's grouping intent — honored verbatim. Anything
   else gets the next free letter alone, display-only: legacy data is
   never mutated by rendering. */

BLK.letters=function(s){
  const ex=(s.exercises||[]);
  const out=new Array(ex.length).fill(null);
  const claimed=new Set();
  // pass 1: explicit pair tags claim their letters
  ex.forEach((e,i)=>{
    if((e.block||'')==='Movement Prep')return;
    const m=/^([A-Za-z])(\d+)$/.exec((e.pair||'').trim());
    if(m){out[i]=m[1].toUpperCase()+m[2];claimed.add(m[1].toUpperCase().charCodeAt(0)-65);}
  });
  // pass 2: everything else takes the lowest unclaimed letter, in order —
  // never colliding with an explicit pair's letter
  let next=0;
  ex.forEach((e,i)=>{
    if((e.block||'')==='Movement Prep'||out[i])return;
    while(claimed.has(next))next++;
    out[i]=String.fromCharCode(65+next);claimed.add(next);
  });
  return out;
};

/* ═══════════════ SECTION 3 — AUTO-TAG (migration) ═══════════════════════
   Unchanged from v1.0. Known limits stand: "press" is ambiguous and
   contrast pairs split on keywords (a Box Jump paired under strength
   reads as plyo) — the tags are one-tap editable for exactly that. */

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
  return'Accessory';
};

BLK.autoTag=function(athId){
  const p=S.programs[athId]; if(!p)return;
  let tagged=0;
  (p.weeks_data||[]).forEach(w=>(w.days||[]).forEach(d=>(d.sessions||[]).forEach(s=>{
    (s.exercises||[]).forEach(ex=>{
      if(ex.block)return;
      ex.block=BLK.classify(ex); tagged++;
    });
  })));
  save();
  toast(tagged?('Tagged '+tagged+' exercises into blocks — review the tags, especially paired work'):'Already fully tagged');
  if(typeof showProgDetail==='function')showProgDetail(athId);
};

/* ═══════════════ SECTION 4 — GENERATION ═════════════════════════════════
   weekObj is stored whole with no field whitelist, so "block" and
   "pair" flow straight into weeks_data. */

if(typeof window.buildWeekPrompt==='function'){
  const _blkPrevBWP=window.buildWeekPrompt;
  window.buildWeekPrompt=function(){
    let base=_blkPrevBWP.apply(this,arguments);
    base+='\n\nSESSION BLOCK STRUCTURE (mandatory): every exercise object must also include a "block" field, exactly one of: "Movement Prep","Speed / COD","Plyo / Reactive","Primary Strength","Accessory","Conditioning". '
      +'List exercises in that block order within each session — speed, COD, and reactive work come FIRST after movement prep, while the CNS is fresh; they never follow strength or conditioning. Not every session needs every block.'
      +'\nORDERING & LETTERING (mandatory): every exercise outside Movement Prep also gets a "pair" field using standard strength-sheet lettering, sequential through the session: "A1","A2" means those two are performed as a superset or contrast pair; the next group is "B1", then "C1", and so on. A standalone exercise is the sole member of its letter (e.g. "B1"). Movement Prep exercises get no "pair" field. '
      +'Only pair CNS-compatible work — strength with strength, strength with a contrast plyo, or accessory with accessory. Never pair speed, COD, or conditioning work with anything.';
    return base;
  };
}

/* ═══════════════ SECTION 5 — PRO SKIN ═══════════════════════════════════
   Scoped to #prog-detail. Two mechanisms because the base render uses
   inline styles (which beat stylesheets): a small injected stylesheet
   for what it can reach, and a JS pass for inline-styled chips,
   toolbar buttons, and emoji. The emoji strip runs on innerHTML BEFORE
   any real listeners are attached — the base render and PB.decorate
   wire everything through onclick attributes, which survive an
   innerHTML rewrite; our own listeners are attached after. */

const EMOJI=/[\u26a1\ud83d\udd01\ud83d\udee1\u25b6\ud83d\udda8\ud83c\udfc1\ud83e\uddf1\ud83d\udcca\ufe0f]/g;

BLK.skin=function(root){
  root.innerHTML=root.innerHTML.replace(EMOJI,'').replace(/RETEST DAY\s*/g,'RETEST DAY');
  // quiet the flag/chip zoo: same treatment for every badge
  root.querySelectorAll('span').forEach(sp=>{
    const t=(sp.textContent||'').trim();
    if(['VALD','ACL','TENDON','AUTO-ADJ'].includes(t)){
      sp.style.cssText='font-size:7px;letter-spacing:.8px;background:transparent;'
        +'border:1px solid var(--border2);color:var(--text3);padding:1px 4px;'
        +'border-radius:2px;margin-left:4px;';
    }
  });
  // uniform quiet toolbar
  const bar=root.querySelector('#pb-toolbar');
  if(bar)bar.querySelectorAll('button').forEach(b=>{
    b.textContent=b.textContent.replace(EMOJI,'').trim();
    b.style.cssText='padding:5px 11px;font-size:9px;letter-spacing:.4px;'
      +'border-radius:var(--r);border:1px solid var(--border2);'
      +'background:transparent;color:var(--text2);cursor:pointer;';
  });
};

/* ═══════════════ SECTION 6 — RENDER DECORATION ══════════════════════════ */

const _blkPrevSPD=window.showProgDetail;
window.showProgDetail=function(athId,forceWkIdx){
  if(typeof _blkPrevSPD==='function')_blkPrevSPD.apply(this,arguments);
  try{BLK.decorate(athId,forceWkIdx);}catch(e){console.warn('BLK decorate failed',e);}
};

BLK.decorate=function(athId,forceWkIdx){
  const p=S.programs[athId]; if(!p)return;
  const wkIdx=forceWkIdx!==undefined?forceWkIdx:(p.currentWeek?p.currentWeek-1:0);
  const w=p.weeks_data[wkIdx]; if(!w)return;
  const detail=document.getElementById('prog-detail');
  const host=document.querySelector('.prog-week'); if(!host||!detail)return;

  if(detail.dataset.blkSkin!=='1'){BLK.skin(detail);detail.dataset.blkSkin='1';}

  BLK.phaseStrip(p,athId,wkIdx);

  const untagged=(w.days||[]).some(d=>(d.sessions||[]).some(s=>(s.exercises||[]).some(ex=>!ex.block)));
  const bar=document.getElementById('pb-toolbar');
  if(bar&&untagged&&!document.getElementById('blk-autotag')){
    const b=document.createElement('button');
    b.id='blk-autotag';
    b.style.cssText='padding:5px 11px;font-size:9px;letter-spacing:.4px;border-radius:var(--r);'
      +'border:1px solid var(--text3);background:transparent;color:var(--text2);cursor:pointer;';
    b.textContent='Structure into Blocks';
    b.onclick=function(){BLK.autoTag(athId);};
    bar.appendChild(b);
  }

  let ti=0;
  (w.days||[]).forEach((d,dIdx)=>(d.sessions||[]).forEach((s,sIdx)=>{
    const tbl=document.querySelectorAll('.prog-week table.tbl')[ti++]; if(!tbl)return;
    const body=tbl.querySelector('tbody'); if(!body)return;
    const cols=tbl.querySelectorAll('thead th').length||10;
    const rows=Array.from(body.rows);           // snapshot BEFORE inserting
    const letters=BLK.letters(s);
    let prevBlock=null;

    rows.forEach((tr,ei)=>{
      const ex=(s.exercises||[])[ei]; if(!ex)return;

      if(ex.block&&ex.block!==prevBlock){
        let end=ei;
        while(end+1<(s.exercises||[]).length&&s.exercises[end+1].block===ex.block)end++;
        const hdr=document.createElement('tr');
        hdr.dataset.blk='1';
        hdr.innerHTML='<td colspan="'+cols+'" style="padding:9px 6px 3px;background:transparent;'
          +'border-top:1px solid var(--border2);">'
          +'<span style="font-size:8px;font-weight:600;letter-spacing:2px;text-transform:uppercase;'
          +'color:var(--text2);">'+ex.block+'</span>'
          +'<a href="#" onclick="event.preventDefault();BLK.rename(\''+athId+'\','+wkIdx+','+dIdx+','+sIdx+','+ei+','+end+')" '
          +'style="font-size:8px;color:var(--text3);margin-left:10px;text-decoration:none;">rename</a>'
          +'</td>';
        body.insertBefore(hdr,tr);
      }
      prevBlock=ex.block||prevBlock;

      const inp=tr.querySelector('td input');
      const nameCell=inp?inp.closest('td'):tr.cells[0];
      if(nameCell&&!nameCell.dataset.blk){
        nameCell.dataset.blk='1';
        if(letters[ei]){
          const L=document.createElement('span');
          L.style.cssText='display:inline-block;min-width:20px;font-size:9px;'
            +'font-family:var(--mono);font-weight:700;color:var(--text);';
          L.textContent=letters[ei];
          nameCell.insertBefore(L,nameCell.firstChild);
        }
        const cyc=document.createElement('span');
        cyc.title='Move to next block';
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

/* ═══════════════ SECTION 7 — PHASE STRIP ════════════════════════════════
   Quiet segmented bar. Type does the work: uppercase, tracking, weight
   on the active phase — no fills, no emoji. */

BLK.phaseStrip=function(p,athId,wkIdx){
  if(document.getElementById('blk-phasestrip'))return;
  const wd=p.weeks_data||[]; if(wd.length<2)return;
  const runs=[];
  wd.forEach((w,i)=>{
    const ph=w.phase||'—';
    const last=runs[runs.length-1];
    if(last&&last.phase===ph)last.n++;
    else runs.push({phase:ph,n:1,firstIdx:i});
  });
  if(runs.length<2)return;

  const strip=document.createElement('div');
  strip.id='blk-phasestrip';
  strip.style.cssText='display:flex;gap:2px;margin-bottom:10px;';
  strip.innerHTML=runs.map(r=>{
    const active=wkIdx>=r.firstIdx&&wkIdx<r.firstIdx+r.n;
    return'<div onclick="showProgDetail(\''+athId+'\','+r.firstIdx+')" '
      +'style="flex:'+r.n+';min-width:0;cursor:pointer;text-align:center;padding:5px 2px;'
      +'font-size:8px;letter-spacing:1.2px;text-transform:uppercase;overflow:hidden;'
      +'white-space:nowrap;text-overflow:ellipsis;background:transparent;'
      +'border-bottom:2px solid '+(active?'var(--text)':'var(--border2)')+';'
      +'color:'+(active?'var(--text)':'var(--text3)')+';'
      +'font-weight:'+(active?'700':'400')+';" '
      +'title="'+r.phase+' — weeks '+(r.firstIdx+1)+'–'+(r.firstIdx+r.n)+'">'
      +r.phase+'&ensp;'+(r.firstIdx+1)+'–'+(r.firstIdx+r.n)+'</div>';
  }).join('');
  const bar=document.getElementById('pb-toolbar');
  const anchor=bar||document.querySelector('.prog-week');
  if(anchor)anchor.parentNode.insertBefore(strip,anchor);
};

/* ═══════════════ SECTION 8 — PRINT SHEET (redesigned) ═══════════════════
   The artifact parents and athletes hold. Instrument-grade: ink on
   paper, hairline rules, a mono letter spine down the left, block
   sections in tracked small caps. Zero decoration that isn't
   information. Same window.print() approach — no libraries, still a
   single-file PWA. */

if(window.PB&&typeof PB.printProgram==='function'){
  PB.printProgram=function(athId){
    const p=S.programs[athId]; if(!p)return;
    const ath=S.athletes.find(a=>a.id===athId);

    const wd=p.weeks_data||[];
    const phRuns=[];
    wd.forEach(w=>{
      const last=phRuns[phRuns.length-1];
      if(last&&last.phase===(w.phase||'—'))last.n++;
      else phRuns.push({phase:w.phase||'—',n:1,first:(phRuns.length?phRuns[phRuns.length-1].first+phRuns[phRuns.length-1].n:1)});
    });
    const phaseLine=phRuns.length>1
      ?'<div class="phases">'+phRuns.map(r=>'<span>'+r.phase+'<em>WK '+r.first+'–'+(r.first+r.n-1)+'</em></span>').join('')+'</div>'
      :'';

    const weeks=wd.map(w=>
      '<div class="wk"><div class="wkhead"><span class="wknum">Week '+w.week+'</span>'
      +'<span class="wkphase">'+(w.phase||'')+'</span>'
      +(w.focus?'<span class="wkfocus">'+w.focus+'</span>':'')+'</div>'
      +(w.days||[]).map(d=>(d.sessions||[]).map(s=>{
        const letters=BLK.letters(s);
        let prevB=null;
        return'<div class="session"><div class="sesshead">'+d.day+' · '+s.type+'</div>'
        +(s.warmup?'<div class="warm">Warm-up — '+s.warmup+'</div>':'')
        +'<table><thead><tr><th class="ord"></th><th>Exercise</th><th>Sets</th><th>Reps</th>'
        +'<th>Tempo</th><th>Load</th><th>RPE</th><th class="act">Actual</th></tr></thead><tbody>'
        +(s.exercises||[]).map((ex,ei)=>{
          let hdr='';
          if(ex.block&&ex.block!==prevB){
            hdr='<tr class="blkrow"><td colspan="8">'+ex.block+'</td></tr>';
            prevB=ex.block;
          }
          return hdr+'<tr>'
          +'<td class="ord">'+(letters[ei]||'')+'</td>'
          +'<td class="exn">'+(ex.name||'')
          +(ex.cue?'<div class="cue">'+ex.cue+'</div>':'')+'</td>'
          +'<td>'+(ex.sets||'')+'</td><td>'+(ex.reps||'')+'</td><td class="num">'+(ex.tempo||'')+'</td>'
          +'<td class="num">'+(ex.weight||'')+'</td><td class="num">'+(ex.rpe||'')+'</td>'
          +'<td class="act"></td></tr>';
        }).join('')
        +'</tbody></table>'
        +(s.sprint?'<div class="sprintnote">Sprint work — '+s.sprint+'</div>':'')
        +'</div>';
      }).join('')).join('')+'</div>').join('');

    const win=window.open('','_blank');
    if(!win){toast('Popup blocked — allow popups to print');return;}
    win.document.write('<!doctype html><html><head><meta charset="utf-8">'
      +'<title>'+(ath?an(ath):'Program')+'</title><style>'
      +':root{--ink:#16181c;--mut:#6b7076;--hair:#e2e4e7;--sect:#2f4b6e;}'
      +'*{box-sizing:border-box;}'
      +'body{font-family:"Avenir Next","Helvetica Neue",Helvetica,Arial,sans-serif;'
      +'font-size:10.5px;line-height:1.45;color:var(--ink);margin:0;padding:34px 40px;}'
      +'.doc-head{border-bottom:2px solid var(--ink);padding-bottom:14px;margin-bottom:6px;}'
      +'h1{font-size:23px;font-weight:700;letter-spacing:-.3px;margin:0;}'
      +'.sub{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--mut);margin-top:3px;}'
      +'.phases{display:flex;gap:22px;padding:9px 0 0;font-size:8.5px;letter-spacing:1.6px;'
      +'text-transform:uppercase;color:var(--ink);}'
      +'.phases em{font-style:normal;color:var(--mut);margin-left:6px;letter-spacing:.8px;}'
      +'.wk{margin-top:24px;}'
      +'.wkhead{display:flex;align-items:baseline;gap:12px;border-bottom:1px solid var(--ink);'
      +'padding-bottom:3px;page-break-after:avoid;}'
      +'.wknum{font-size:13px;font-weight:700;}'
      +'.wkphase{font-size:8.5px;letter-spacing:1.8px;text-transform:uppercase;color:var(--sect);}'
      +'.wkfocus{font-size:9px;color:var(--mut);margin-left:auto;font-style:italic;}'
      +'.session{margin-top:12px;page-break-inside:avoid;}'
      +'.sesshead{font-size:11px;font-weight:600;page-break-after:avoid;}'
      +'.warm{font-size:8.5px;color:var(--mut);font-style:italic;padding:2px 0 1px;}'
      +'table{width:100%;border-collapse:collapse;margin-top:4px;}'
      +'th{font-size:7.5px;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;'
      +'color:var(--mut);text-align:left;padding:3px 6px;border-bottom:1.5px solid var(--ink);}'
      +'td{padding:4px 6px;border-bottom:1px solid var(--hair);vertical-align:top;font-size:10px;}'
      +'td.ord,th.ord{width:30px;font-family:"SF Mono",Consolas,Menlo,monospace;'
      +'font-weight:700;font-size:9.5px;padding-left:0;}'
      +'td.exn{font-weight:600;}'
      +'td.num{font-family:"SF Mono",Consolas,Menlo,monospace;font-size:9px;}'
      +'td.act,th.act{width:80px;} '
      +'.cue{font-size:8px;font-weight:400;color:var(--mut);font-style:italic;padding-top:1px;}'
      +'tr.blkrow td{border-bottom:none;padding:9px 6px 1px 0;font-size:8px;font-weight:600;'
      +'letter-spacing:2.2px;text-transform:uppercase;color:var(--sect);}'
      +'.sprintnote{font-size:8.5px;color:var(--ink);border-left:2px solid var(--sect);'
      +'padding:3px 0 3px 8px;margin-top:6px;}'
      +'.foot{margin-top:30px;padding-top:8px;border-top:1px solid var(--hair);'
      +'font-size:8px;letter-spacing:1.6px;text-transform:uppercase;color:var(--mut);}'
      +'@media print{@page{margin:13mm;} body{padding:0;}}'
      +'</style></head><body>'
      +'<div class="doc-head"><h1>'+(ath?an(ath):'Program')+'</h1>'
      +'<div class="sub">'+(p.goal||p.focus||p.phase||'Training Program')+' · '+wd.length+' weeks · FitClub CT</div>'
      +phaseLine+'</div>'
      +weeks
      +'<div class="foot">Coach Austin C., ATC · Head Coach, FitClub CT</div>'
      +'</body></html>');
    win.document.close();
    setTimeout(()=>{try{win.print();}catch(e){}},350);
  };
}

console.log('%cCoach OS Blocks & Phases drop-in v'+BLK.ver+' loaded','font-weight:bold');
})();
