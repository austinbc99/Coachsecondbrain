/* ═══════════════════════════════════════════════════════════════════════
   COACH OS — PROGRAM BUILDER DROP-IN  v1.0
   Coach Austin C., ATC · Head Coach, FitClub CT

   LOAD ORDER: must come AFTER coach-os-super-patch.js.
   It wraps that file's overrides rather than replacing them, so
   auto-adjust / learn-from-actual keeps working untouched.

   SCOPE (per build decision):
     1. Check-off per exercise                    [NEW]
     2. Block trends — e1RM / tonnage / adherence [RENDER of existing data]
     3. Global injury governance layer            [NEW]
     4. Progress / Regress ladder                 [NEW]
     5. Partial block rebuild on constraint change[NEW]
     6. Print-to-PDF                              [NEW]

   EXPLICITLY OUT: per-exercise demo video, athlete email login.

   ── WHY THE TREND WORK IS SMALL ──────────────────────────────────────
   p.loadHistory[exerciseName] is ALREADY populated on every logged
   actual by _learnFromActual() in the super-patch. Each entry carries
   {week, prescribedRPE, actualRPE, actualWeight, actualReps, date}.
   That is every input e1RM and tonnage need. The data has been
   accumulating this whole time and has never been rendered anywhere.
   So §2 below is a read, not a build.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if(window.__pbDropinLoaded){console.warn('program-builder-dropin already loaded');return;}
window.__pbDropinLoaded=true;

const PB={ver:'1.0'};
window.PB=PB;

/* ═══════════════ SECTION 1 — CHECK-OFF ══════════════════════════════════
   Stored parallel to p.actuals so nothing existing is disturbed:
     p.done['wk3']['Monday-Lower-2'] = {t:'2026-07-28T14:02:00Z'}
   Key format is identical to the actuals key (day-sessionType-exIndex),
   which is what lets adherence join cleanly against prescribed work. */

function pbKey(day,type,ei){return day+'-'+type+'-'+ei;}
PB.key=pbKey;

PB.isDone=function(athId,wkNum,key){
  const p=S.programs[athId];
  return !!(p&&p.done&&p.done['wk'+wkNum]&&p.done['wk'+wkNum][key]);
};

PB.toggleDone=function(athId,wkNum,key,wkIdx){
  const p=S.programs[athId]; if(!p)return;
  if(!p.done)p.done={};
  if(!p.done['wk'+wkNum])p.done['wk'+wkNum]={};
  const d=p.done['wk'+wkNum];
  if(d[key]){delete d[key];}
  else{d[key]={t:new Date().toISOString()};}
  save();
  if(typeof showProgDetail==='function')showProgDetail(athId,wkIdx);
};

/* ═══════════════ SECTION 2 — BLOCK TRENDS ═══════════════════════════════
   Epley with an RPE-to-reps-in-reserve correction. Straight Epley
   (w*(1+r/30)) assumes the set was taken to failure; almost none of
   ours are, so an RPE 7 set of 5 is really a set of ~8 in terms of
   what it says about 1RM. We add the RIR back before estimating.
   RIR = 10 - RPE. Same math used for Hannah's trap bar block. */

PB.e1rm=function(weight,reps,rpe){
  if(!weight||!reps)return null;
  const rir=(rpe!=null&&!isNaN(rpe))?Math.max(0,10-rpe):0;
  const eff=reps+rir;
  if(eff>12)return null;              // Epley degrades badly past ~12
  return Math.round(weight*(1+eff/30)*10)/10;
};

PB.e1rmSeries=function(p,exName){
  const h=(p.loadHistory||{})[(exName||'').toLowerCase().trim()]||[];
  return h.map(e=>({week:e.week,val:PB.e1rm(e.actualWeight,e.actualReps,e.actualRPE),date:e.date}))
          .filter(x=>x.val!=null)
          .sort((a,b)=>a.week-b.week);
};

/* Tonnage. Honest caveat baked in: prescribed SETS are used because the
   free-text actual only reliably yields load x reps, not sets completed.
   If an athlete cut a set short, tonnage reads high. Adherence (below)
   is the number to trust for "did the work happen". */
PB.weekTonnage=function(p,wkNum){
  const w=(p.weeks_data||[]).find(x=>x.week===wkNum); if(!w)return null;
  const act=(p.actuals||{})['wk'+wkNum]||{};
  let tons=0,counted=0;
  (w.days||[]).forEach(d=>(d.sessions||[]).forEach(s=>{
    (s.exercises||[]).forEach((ex,ei)=>{
      const raw=act[pbKey(d.day,s.type,ei)]; if(!raw)return;
      const pr=(typeof _parseActual==='function')?_parseActual(raw):null;
      if(!pr||pr.weight==null||pr.reps==null)return;
      const sets=parseInt(ex.sets)||1;
      tons+=pr.weight*pr.reps*sets; counted++;
    });
  }));
  return counted?{tonnage:Math.round(tons),entries:counted}:null;
};

/* Adherence: prescribed items in weeks up to current, vs items ticked.
   This is the metric that answers "the block, not a feeling." */
PB.adherence=function(p){
  let total=0,done=0;
  (p.weeks_data||[]).forEach(w=>{
    if(w.week>(p.currentWeek||1))return;
    (w.days||[]).forEach(d=>(d.sessions||[]).forEach(s=>{
      (s.exercises||[]).forEach((ex,ei)=>{
        total++;
        if(PB._doneLookup(p,w.week,pbKey(d.day,s.type,ei)))done++;
      });
    }));
  });
  return total?{total,done,pct:Math.round(done/total*100)}:null;
};
PB._doneLookup=function(p,wkNum,key){
  return !!(p.done&&p.done['wk'+wkNum]&&p.done['wk'+wkNum][key]);
};

PB.trendCard=function(athId){
  const p=S.programs[athId]; if(!p)return '';
  const adh=PB.adherence(p);
  const curWk=p.currentWeek||1;
  const ton=PB.weekTonnage(p,curWk);

  // top 3 lifts by number of logged entries
  const lifts=Object.entries(p.loadHistory||{})
    .map(([n,h])=>({name:n,n:h.length}))
    .sort((a,b)=>b.n-a.n).slice(0,3);

  const liftRows=lifts.map(l=>{
    const s=PB.e1rmSeries(p,l.name);
    if(s.length<2)return '<div style="font-size:9px;color:var(--text3);">'+l.name+' — need 2+ logged sets</div>';
    const first=s[0].val,last=s[s.length-1].val;
    const pct=Math.round((last-first)/first*1000)/10;
    const col=pct>0?'var(--accent)':pct<0?'var(--red)':'var(--text3)';
    return '<div style="display:flex;justify-content:space-between;font-size:9px;padding:2px 0;">'
      +'<span style="text-transform:capitalize;">'+l.name+'</span>'
      +'<span style="font-family:var(--mono);color:'+col+';">'+first+' → '+last
      +' ('+(pct>=0?'+':'')+pct+'%)</span></div>';
  }).join('');

  return '<div class="card" style="margin-top:10px;">'
    +'<div style="font-size:10px;font-weight:700;padding-bottom:6px;">Block Trend</div>'
    +'<div style="display:flex;gap:14px;padding-bottom:8px;">'
      +'<div><div style="font-size:8px;color:var(--text3);">ADHERENCE</div>'
        +'<div style="font-size:15px;font-family:var(--mono);color:'
        +(adh&&adh.pct>=80?'var(--accent)':adh&&adh.pct>=60?'var(--orange)':'var(--red)')+';">'
        +(adh?adh.pct+'%':'—')+'</div>'
        +'<div style="font-size:8px;color:var(--text3);">'+(adh?adh.done+'/'+adh.total:'')+'</div></div>'
      +'<div><div style="font-size:8px;color:var(--text3);">WK '+curWk+' TONNAGE</div>'
        +'<div style="font-size:15px;font-family:var(--mono);">'+(ton?ton.tonnage.toLocaleString():'—')+'</div>'
        +'<div style="font-size:8px;color:var(--text3);">'+(ton?ton.entries+' logged':'')+'</div></div>'
    +'</div>'
    +'<div style="font-size:8px;color:var(--text3);padding-bottom:3px;">EST 1RM TREND</div>'
    +(liftRows||'<div style="font-size:9px;color:var(--text3);">No logged actuals yet.</div>')
    +'<div style="font-size:7px;color:var(--text3);padding-top:6px;font-style:italic;">'
    +'Tonnage uses prescribed sets — a cut-short set reads high. Adherence is the honest number.</div>'
    +'</div>';
};

/* ═══════════════ SECTION 3 — GLOBAL INJURY GOVERNANCE ═══════════════════
   The existing behaviour puts athlete notes into the GENERATION PROMPT
   (_extractSafetyFlags → buildWeekPrompt). That asks the model nicely.
   It does not screen what comes back, and it does not touch imported or
   hand-edited programs at all.

   This screens the FINISHED program — every block, every week — and is
   re-runnable at any time. Generate-then-screen, not prompt-and-hope.
   For an ATC that distinction is the whole point: the warm-up and the
   plyo block are where a knee actually gets hurt, not the main lift. */

PB.REGIONS={
  knee:{
    match:/knee|patell|acl|mcl|meniscus|jumper/i,
    bans:[/depth jump/i,/drop jump/i,/bound/i,/reactive/i,/max decel/i,/deep squat/i,/90.?.?cut/i,/plyo/i,/hurdle hop/i],
    sub:{'depth jump':'iso landing hold (Natera) — 3s stick, no rebound',
         'drop jump':'iso landing hold (Natera) — 3s stick, no rebound',
         'bound':'split-stance pogo, low amplitude',
         'default':'iso landing hold — 3s stick'}
  },
  ankle:{
    match:/ankle|achill|calf|peroneal/i,
    bans:[/depth jump/i,/bound/i,/pogo/i,/sprint/i,/max velocity/i,/hurdle/i],
    sub:{'default':'seated / supported calf iso — no flight phase'}
  },
  shoulder:{
    match:/shoulder|labrum|rotator|ac joint|slap/i,
    bans:[/overhead/i,/snatch/i,/jerk/i,/push press/i,/med ?ball.*(throw|slam|overhead)/i,/bench/i,/ballistic/i],
    sub:{'default':'landmine / neutral-grip press, sub-90° only'}
  },
  hip:{
    match:/hip|groin|adductor|labral|fai/i,
    bans:[/deep squat/i,/wide stance/i,/lateral bound/i,/90.?.?cut/i,/sumo/i],
    sub:{'default':'narrow-stance, sagittal-plane variant'}
  },
  spine:{
    match:/back|spine|lumbar|disc|spondy/i,
    bans:[/good ?morning/i,/back squat/i,/conventional deadlift/i,/loaded rotation/i,/sit.?up/i],
    sub:{'default':'trap bar / supported variant, neutral spine'}
  }
};

PB.activeConstraints=function(ath){
  const txt=((ath&&ath.notes)||'')+' '+((ath&&ath.constraints)||'');
  if(!txt.trim())return [];
  return Object.entries(PB.REGIONS)
    .filter(([, cfg])=>cfg.match.test(txt))
    .map(([region,cfg])=>({region,cfg}));
};

PB.screenProgram=function(athId,apply){
  const p=S.programs[athId]; if(!p)return null;
  const ath=S.athletes.find(a=>a.id===athId);
  const cons=PB.activeConstraints(ath);
  if(!cons.length)return {constraints:[],hits:[]};

  const hits=[];
  (p.weeks_data||[]).forEach(w=>{
    (w.days||[]).forEach(d=>(d.sessions||[]).forEach(s=>{
      const blockTxt=[s.warmup||''].join(' ');
      cons.forEach(({region,cfg})=>{
        // warm-up text is screened too — this is the gap that mattered
        cfg.bans.forEach(rx=>{
          if(blockTxt&&rx.test(blockTxt)){
            hits.push({week:w.week,day:d.day,type:s.type,where:'warm-up',
                       name:s.warmup,region,pattern:String(rx)});
          }
        });
        (s.exercises||[]).forEach((ex,ei)=>{
          const n=ex.name||'';
          cfg.bans.forEach(rx=>{
            if(!rx.test(n))return;
            const subKey=Object.keys(cfg.sub).find(k=>k!=='default'&&n.toLowerCase().includes(k));
            const sub=cfg.sub[subKey]||cfg.sub.default;
            hits.push({week:w.week,day:d.day,type:s.type,where:'exercise',
                       ei,name:n,region,pattern:String(rx),sub});
            if(apply){
              ex._preScreen=ex._preScreen||n;
              ex.name=sub;
              ex.cue=(ex.cue?ex.cue+' ':'')+'[Screened: '+region+' constraint]';
              ex._screened={region,from:n,date:today()};
            }
          });
        });
      });
    }));
  });
  if(apply&&hits.length){p.edited=true;save();}
  return {constraints:cons.map(c=>c.region),hits};
};

PB.runScreen=function(athId){
  const r=PB.screenProgram(athId,false);
  if(!r)return;
  if(!r.constraints.length){toast('No injury constraints on file for this athlete');return;}
  if(!r.hits.length){toast('Clean — '+r.constraints.join(', ')+' screened, 0 conflicts');return;}
  const lines=r.hits.slice(0,12).map(h=>
    '• W'+h.week+' '+h.day+' ('+h.where+'): '+h.name+'  →  '+(h.sub||'REVIEW')).join('\n');
  if(confirm(r.hits.length+' conflict(s) against ['+r.constraints.join(', ')+']:\n\n'
     +lines+(r.hits.length>12?'\n…+'+(r.hits.length-12)+' more':'')
     +'\n\nApply substitutions?')){
    PB.screenProgram(athId,true);
    toast('Screened — '+r.hits.length+' substitution(s) applied');
    if(typeof showProgDetail==='function')showProgDetail(athId);
  }
};

/* ═══════════════ SECTION 4 — PROGRESS / REGRESS LADDER ══════════════════
   Sourced from our own stack, not a branded acronym. Each family is an
   ordered list of rungs; ± moves one step and re-screens against the
   athlete's active injury constraints before committing. */

PB.LADDERS=[
 {family:'decel-cod',src:'Baynton / Spellman',
  rungs:['2-step decel, submax, straight line',
         'backpedal → sprint transition',
         '45° plant-and-cut, cued',
         '90° cut, reactive',
         'open-field reactive cut vs stimulus'],
  match:/decel|cut|cod|change of direction|backpedal|plant/i},
 {family:'accel',src:'McMillan / ALTIS',
  rungs:['wall drill, 3-count hold',
         'march-to-run, 10m',
         'push-up start, 10m',
         '2-point start, 20m',
         'resisted → unresisted contrast, 20m'],
  match:/accel|sprint|start|10m|20m|fly/i},
 {family:'plyo-landing',src:'Natera / Spellman',
  rungs:['iso landing hold, 3s stick',
         'countermovement jump, stick',
         'repeat pogo, low amplitude',
         'box drop → stick',
         'depth jump → rebound'],
  match:/jump|plyo|hop|bound|pogo|landing|depth/i},
 {family:'squat',src:'triphasic',
  rungs:['goblet squat, tempo 3-1-1',
         'trap bar deadlift',
         'front squat',
         'back squat',
         'back squat, accommodating resistance'],
  match:/squat|deadlift|trap bar/i},
 {family:'posterior',src:'triphasic / tendon',
  rungs:['glute bridge, iso hold',
         'hip thrust',
         'RDL, tempo eccentric',
         'single-leg RDL',
         'Nordic hamstring curl'],
  match:/rdl|hinge|hamstring|nordic|bridge|thrust|glute/i},
 {family:'press',src:'general',
  rungs:['landmine press',
         'neutral-grip DB press',
         'incline barbell press',
         'barbell bench press',
         'push press'],
  match:/press|bench|push/i}
];

PB.findRung=function(name){
  const n=(name||'').toLowerCase();
  for(const L of PB.LADDERS){
    const i=L.rungs.findIndex(r=>n.includes(r.toLowerCase().split(',')[0].trim()));
    if(i>=0)return {ladder:L,idx:i};
    if(L.match.test(n))return {ladder:L,idx:-1};   // family known, rung unknown
  }
  return null;
};

PB.step=function(athId,wi,di,si,ei,dir){
  const p=S.programs[athId]; if(!p)return;
  let ex;
  try{ex=p.weeks_data[wi].days[di].sessions[si].exercises[ei];}catch(e){return;}
  if(!ex)return;
  const f=PB.findRung(ex.name);
  if(!f){toast('No ladder family matches "'+ex.name+'"');return;}
  if(f.idx<0){toast('Family: '+f.ladder.family+' — rung not identified, edit manually');return;}
  const next=f.idx+dir;
  if(next<0||next>=f.ladder.rungs.length){
    toast(dir>0?'Already top rung of '+f.ladder.family:'Already bottom rung of '+f.ladder.family);return;}
  const cand=f.ladder.rungs[next];

  // re-screen the candidate against injury constraints before committing
  const ath=S.athletes.find(a=>a.id===athId);
  const cons=PB.activeConstraints(ath);
  const blocked=cons.find(({cfg})=>cfg.bans.some(rx=>rx.test(cand)));
  if(blocked){
    toast('Blocked — "'+cand+'" violates '+blocked.region+' constraint');return;}

  ex._preLadder=ex._preLadder||ex.name;
  ex.name=cand;
  ex.cue=(ex.cue?ex.cue+' ':'')+'['+(dir>0?'Progressed':'Regressed')+' — '+f.ladder.family+', '+f.ladder.src+']';
  p.edited=true;save();
  if(typeof showProgDetail==='function')showProgDetail(athId,wi);
  toast((dir>0?'Progressed':'Regressed')+' → '+cand);
};

/* ═══════════════ SECTION 5 — PARTIAL BLOCK REBUILD ══════════════════════
   "No bike today." Rebuilds ONE session against a stated constraint,
   leaving the rest of the block alone. Reuses the app's apiFetch and
   the athlete's existing context rather than regenerating the week. */

PB.rebuildSession=async function(athId,wi,di,si){
  const p=S.programs[athId]; if(!p)return;
  const ath=S.athletes.find(a=>a.id===athId);
  let s;
  try{s=p.weeks_data[wi].days[di].sessions[si];}catch(e){return;}
  if(!s){toast('Session not found');return;}
  const change=prompt('What changed for this session?\n(e.g. "no bike", "turf closed", "only 35 min")');
  if(!change)return;
  if(typeof apiFetch!=='function'){toast('apiFetch unavailable');return;}

  const w=p.weeks_data[wi];
  const cons=PB.activeConstraints(ath).map(c=>c.region);
  const prompt_=
    'Rebuild ONLY this single training session. Keep the same intent, phase and '
    +'volume; change only what the constraint forces.\n\n'
    +'Athlete: '+(ath?an(ath):'unknown')+'\n'
    +'Week '+w.week+' — phase '+w.phase+' — focus: '+(w.focus||'n/a')+'\n'
    +'Session: '+s.type+'\n'
    +(cons.length?'HARD injury constraints (cannot be violated): '+cons.join(', ')+'\n':'')
    +'Constraint that changed: '+change+'\n\n'
    +'Current session JSON:\n'+JSON.stringify(s)+'\n\n'
    +'Return ONLY the rebuilt session object as valid JSON, same schema, no prose, no markdown fences.';

  toast('Rebuilding session…');
  try{
    const res=await apiFetch(prompt_);
    const txt=typeof res==='string'?res:(res&&res.content&&res.content[0]&&res.content[0].text)||'';
    const clean=txt.replace(/```json|```/g,'').trim();
    const rebuilt=(typeof parseJSONLoose==='function')?parseJSONLoose(clean):JSON.parse(clean);
    if(!rebuilt||!rebuilt.exercises){toast('Rebuild returned unusable JSON');return;}
    s._preRebuild=s._preRebuild||JSON.parse(JSON.stringify(s));
    s.type=rebuilt.type||s.type;
    s.warmup=rebuilt.warmup||s.warmup;
    s.exercises=rebuilt.exercises;
    s._rebuiltFor=change; s._rebuiltAt=today();
    p.edited=true;save();
    // constraints are re-screened after any regeneration, always
    PB.screenProgram(athId,true);
    if(typeof showProgDetail==='function')showProgDetail(athId,wi);
    toast('Session rebuilt for: '+change);
  }catch(e){console.error(e);toast('Rebuild failed — see console');}
};

/* ═══════════════ SECTION 6 — PRINT / PDF ════════════════════════════════
   No jsPDF. A print stylesheet + window.print() gives a clean PDF via
   the OS print dialog on desktop and iOS both, adds zero KB, and keeps
   the app a single-file PWA. Fewer moving parts than a PDF library. */

PB.printProgram=function(athId){
  const p=S.programs[athId]; if(!p)return;
  const ath=S.athletes.find(a=>a.id===athId);
  const rows=(p.weeks_data||[]).map(w=>
    '<h2>Week '+w.week+' — '+(w.phase||'')+(w.focus?' · '+w.focus:'')+'</h2>'
    +(w.days||[]).map(d=>(d.sessions||[]).map(s=>
      '<h3>'+d.day+' — '+s.type+'</h3>'
      +(s.warmup?'<p><em>Warm-up: '+s.warmup+'</em></p>':'')
      +'<table><thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Tempo</th>'
      +'<th>Weight</th><th>RPE</th><th>Actual</th></tr></thead><tbody>'
      +(s.exercises||[]).map(ex=>
        '<tr><td><strong>'+(ex.name||'')+'</strong>'
        +(ex.cue?'<br><span class="cue">'+ex.cue+'</span>':'')+'</td>'
        +'<td>'+(ex.sets||'')+'</td><td>'+(ex.reps||'')+'</td><td>'+(ex.tempo||'')+'</td>'
        +'<td>'+(ex.weight||'')+'</td><td>'+(ex.rpe||'')+'</td><td class="blank"></td></tr>').join('')
      +'</tbody></table>').join('')).join('')).join('');

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
    +'.hdr{font-size:9px;color:#555;margin-bottom:12px;}'
    +'@media print{@page{margin:12mm;}}'
    +'</style></head><body>'
    +'<h1>'+(ath?an(ath):'Program')+'</h1>'
    +'<div class="hdr">'+(p.goal||p.focus||'')+' · '+(p.weeks_data||[]).length+' weeks'
    +'<br>Coach Austin C., ATC · Head Coach, FitClub CT</div>'
    +rows+'</body></html>');
  win.document.close();
  setTimeout(()=>{try{win.print();}catch(e){}},350);
};

/* ═══════════════ SECTION 7 — UI INJECTION ═══════════════════════════════
   Wraps the super-patch showProgDetail. Runs it first, then decorates
   the rendered DOM: a check column on each exercise row, ladder arrows,
   the trend card, and a toolbar. Decorating after render means we never
   have to fork that function's markup. */

const _prevShowProgDetail=window.showProgDetail;
window.showProgDetail=function(athId,forceWkIdx){
  if(typeof _prevShowProgDetail==='function')_prevShowProgDetail.apply(this,arguments);
  try{PB.decorate(athId,forceWkIdx);}catch(e){console.warn('PB decorate failed',e);}
};

PB.decorate=function(athId,forceWkIdx){
  const p=S.programs[athId]; if(!p)return;
  const wkIdx=forceWkIdx!==undefined?forceWkIdx:(p.currentWeek?p.currentWeek-1:0);
  const w=p.weeks_data[wkIdx]; if(!w)return;

  const host=document.querySelector('.prog-week'); if(!host)return;

  // toolbar
  if(!document.getElementById('pb-toolbar')){
    const bar=document.createElement('div');
    bar.id='pb-toolbar';
    bar.style.cssText='display:flex;gap:6px;flex-wrap:wrap;padding:8px 0;';
    bar.innerHTML=
      '<button onclick="PB.runScreen(\''+athId+'\')" style="padding:5px 10px;font-size:9px;'
      +'border-radius:var(--r);border:1px solid var(--orange);background:var(--bg3);'
      +'color:var(--orange);cursor:pointer;">🛡 Screen Injuries</button>'
      +'<button onclick="PB.printProgram(\''+athId+'\')" style="padding:5px 10px;font-size:9px;'
      +'border-radius:var(--r);border:1px solid var(--border2);background:var(--bg3);'
      +'color:var(--text2);cursor:pointer;">🖨 Print / PDF</button>';
    host.parentNode.insertBefore(bar,host);
  }

  // trend card
  if(!document.getElementById('pb-trend')){
    const t=document.createElement('div');
    t.id='pb-trend'; t.innerHTML=PB.trendCard(athId);
    host.parentNode.appendChild(t);
  }

  // per-row check-off + ladder arrows
  let di=0;
  (w.days||[]).forEach((d,dIdx)=>(d.sessions||[]).forEach((s,sIdx)=>{
    const tables=host.querySelectorAll('table.tbl');
    const tbl=tables[di++]; if(!tbl)return;
    const body=tbl.querySelector('tbody'); if(!body)return;
    Array.from(body.rows).forEach((tr,ei)=>{
      if(tr.dataset.pb)return; tr.dataset.pb='1';
      const key=pbKey(d.day,s.type,ei);
      const done=PB.isDone(athId,w.week,key);

      const c=document.createElement('td');
      c.style.cssText='text-align:center;width:26px;';
      c.innerHTML='<span onclick="PB.toggleDone(\''+athId+'\','+w.week+',\''+key
        +'\','+wkIdx+')" style="cursor:pointer;font-size:14px;user-select:none;'
        +'color:'+(done?'var(--accent)':'var(--text3)')+';">'+(done?'☑':'☐')+'</span>';
      tr.insertBefore(c,tr.firstChild);
      if(done)tr.style.opacity='.62';

      const l=document.createElement('td');
      l.style.cssText='white-space:nowrap;width:38px;';
      l.innerHTML='<span onclick="PB.step(\''+athId+'\','+wkIdx+','+dIdx+','+sIdx+','+ei
        +',-1)" title="Regress" style="cursor:pointer;font-size:11px;color:var(--text3);">▼</span> '
        +'<span onclick="PB.step(\''+athId+'\','+wkIdx+','+dIdx+','+sIdx+','+ei
        +',1)" title="Progress" style="cursor:pointer;font-size:11px;color:var(--text3);">▲</span>';
      tr.appendChild(l);
    });
    const hr=tbl.querySelector('thead tr');
    if(hr&&!hr.dataset.pb){
      hr.dataset.pb='1';
      const th=document.createElement('th'); th.textContent='✓'; th.style.width='26px';
      hr.insertBefore(th,hr.firstChild);
      const th2=document.createElement('th'); th2.textContent='±';
      hr.appendChild(th2);
    }
  }));
};

console.log('%cCoach OS Program Builder drop-in v'+PB.ver+' loaded',
            'color:#b8ff57;font-weight:bold');
})();
