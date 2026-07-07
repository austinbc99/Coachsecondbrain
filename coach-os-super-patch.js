// ═══════════════════════════════════════════════════════════════════════
// COACH OS SUPER PATCH — one file, everything.
// Replaces program-builder-v2.js through v6.js entirely. Load ONE file:
//   <script src="coach-os-super-patch.js?v=1"></script>
// right after brain.js, before </body>. Delete the dead
// coachos-upgrade.js?v=3 line while you're in there — it 404s.
//
// Evidence base folded into program generation:
//  [1] Haugen T, Seiler S, Sandbakk O, Tønnessen E. The Training and
//      Development of Elite Sprint Performance. Sports Med Open. 2019;5:44.
//  [2] Haugen T, McGhie D, Ettema G. Sprint running: from fundamental
//      mechanics to practice — a review. Eur J Appl Physiol. 2019;119:1273-87.
//  [3] Malliaras P, Cook J, Purdam C, Rio E. Patellar Tendinopathy: Clinical
//      Diagnosis, Load Management, and Advice for Challenging Case
//      Presentations. J Orthop Sports Phys Ther. 2015;45(11):887-898.
//  [4] Sugimoto D, Myer GD, Bush HM, et al. Compliance with neuromuscular
//      training and ACL injury risk reduction in female athletes: a
//      meta-analysis. J Athl Train. 2012;47(6):714-723.
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════ SECTION 1 — FUZZY DUPLICATE GUARD ═══════════════

function _normName(s){return(s||'').toLowerCase().trim().replace(/\s+/g,' ');}

function _lev(a,b){
  a=_normName(a);b=_normName(b);
  const m=a.length,n=b.length;
  if(!m)return n; if(!n)return m;
  const d=Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);
  for(let j=0;j<=n;j++)d[0][j]=j;
  for(let i=1;i<=m;i++)for(let j=1;j<=n;j++){
    d[i][j]=a[i-1]===b[j-1]?d[i-1][j-1]:1+Math.min(d[i-1][j],d[i][j-1],d[i-1][j-1]);
  }
  return d[m][n];
}

function findAthleteMatch(first,last){
  const nf=_normName(first),nl=_normName(last);
  if(!nf||!nl)return{none:true};
  const exact=S.athletes.find(a=>_normName(a.first)===nf&&_normName(a.last)===nl);
  if(exact)return{exact};
  const near=S.athletes.filter(a=>{
    const dl=_lev(a.last,last),df=_lev(a.first,first);
    return dl<=2&&df<=2&&!(dl===0&&df===0);
  });
  if(near.length)return{near};
  return{none:true};
}

function scanForDuplicates(){
  const results=[];
  for(let i=0;i<S.athletes.length;i++)for(let j=i+1;j<S.athletes.length;j++){
    const a=S.athletes[i],b=S.athletes[j];
    const dl=_lev(a.last,b.last),df=_lev(a.first,b.first);
    if(dl<=2&&df<=2)results.push(an(a)+' \u2194 '+an(b)+' (edit-distance: first '+df+', last '+dl+')');
  }
  if(!results.length){alert('No likely duplicates found across '+S.athletes.length+' athletes.');return;}
  alert('Possible duplicates found:\n\n'+results.join('\n')+'\n\nReview these in the Athletes tab.');
}

const _origSaveValdEntry=window.saveValdEntry;
window.saveValdEntry=function(){
  const sel=document.getElementById('ve-sel');
  const isNew=sel&&sel.value==='_new';
  if(isNew){
    const first=(document.getElementById('ve-first')&&document.getElementById('ve-first').value||'').trim();
    const last=(document.getElementById('ve-last')&&document.getElementById('ve-last').value||'').trim();
    const match=findAthleteMatch(first,last);
    if(match.near&&match.near.length&&!window._dupeGuardOverride){
      const names=match.near.map(a=>an(a)).join(', ');
      const proceed=confirm('This looks similar to an existing athlete: '+names+'.\n\nOK = same person, use existing record.\nCancel = genuinely different, create new.');
      if(proceed){
        sel.value=match.near[0].id;
        veSelChange();
        window._dupeGuardOverride=false;
        toast('Matched to existing athlete: '+an(match.near[0]));
        _origSaveValdEntry.apply(this,arguments);
        return;
      }
      window._dupeGuardOverride=true;
    }
  }
  window._dupeGuardOverride=false;
  _origSaveValdEntry.apply(this,arguments);
};

const _origVpdfProcess=window.vpdfProcess;
if(_origVpdfProcess){
  window.vpdfProcess=async function(file){
    await _origVpdfProcess.apply(this,arguments);
    setTimeout(()=>{
      const sel=document.getElementById('ve-sel');
      if(!sel||sel.value!=='_new')return;
      const first=(document.getElementById('ve-first')&&document.getElementById('ve-first').value||'').trim();
      const last=(document.getElementById('ve-last')&&document.getElementById('ve-last').value||'').trim();
      if(!first||!last)return;
      const match=findAthleteMatch(first,last);
      if(match.near&&match.near.length){
        const st=document.getElementById('vpdf-status');
        if(st)st.innerHTML+='<div style="margin-top:6px;padding:6px 8px;background:rgba(255,140,66,.1);border:1px solid rgba(255,140,66,.3);border-radius:4px;font-size:9px;color:var(--orange);">\u26a0\ufe0f Similar existing athlete found: <b>'+match.near.map(a=>an(a)).join(', ')+'</b>. If this is the same person, select them from the dropdown above instead of saving as new.</div>';
      }
    },400);
  };
}

(function injectRosterButtons(){
  const btns=[...document.querySelectorAll('button')];
  const resetBtn=btns.find(b=>b.textContent.trim()==='Reset All');
  if(!resetBtn||!resetBtn.parentElement)return;
  if(!document.getElementById('dupe-scan-btn')){
    const b=document.createElement('button');
    b.id='dupe-scan-btn';b.className='btn btn-sm';b.textContent='\ud83d\udd0d Scan Duplicates';
    b.onclick=scanForDuplicates;
    resetBtn.parentElement.insertBefore(b,resetBtn);
  }
  if(!document.getElementById('roster-health-btn')){
    const b=document.createElement('button');
    b.id='roster-health-btn';b.className='btn btn-sm';b.textContent='\ud83e\ude7a Roster Health';
    b.onclick=runRosterHealthAudit;
    resetBtn.parentElement.insertBefore(b,resetBtn);
  }
})();

// ═══════════════════════ SECTION 2 — OHM DATA + SNAPSHOT HISTORY ═════════

function logOhmSession(athId,ohmLevel,avgW,peakW,reps,notes){
  const ath=S.athletes.find(a=>a.id===athId); if(!ath)return false;
  if(!ath.ohm)ath.ohm={sessions:[]};
  if(!ath.ohm.sessions)ath.ohm.sessions=[];
  ath.ohm.sessions.push({date:today(),ohm:ohmLevel,avgW:parseFloat(avgW)||null,peakW:parseFloat(peakW)||null,reps:reps||null,notes:notes||''});
  _recomputeOhmProfile(ath);
  _captureMetricSnapshot(athId);
  save();
  return true;
}

function _recomputeOhmProfile(ath){
  const s=(ath.ohm&&ath.ohm.sessions)||[]; if(!s.length)return;
  const byZone={4:[],6:[],8:[]};
  s.forEach(r=>{if(byZone[r.ohm])byZone[r.ohm].push(r.peakW||r.avgW||0);});
  const avg=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
  const force=avg(byZone[4]),mid=avg(byZone[6]),velocity=avg(byZone[8]);
  ath.ohm.profile={force,mid,velocity};
  if(force!=null&&velocity!=null&&force>0){
    const ratio=velocity/force;
    if(ratio<0.75)ath.ohm.profile.classification='Force-dominant, velocity/elastic deficit';
    else if(ratio>1.15)ath.ohm.profile.classification='Velocity-expressive, force hole';
    else ath.ohm.profile.classification='Balanced F-V profile';
  }
}

const _origGetMetrics=window.getMetrics;
window.getMetrics=function(a){
  const m=_origGetMetrics(a);
  if(a.ohm&&a.ohm.profile){
    m.ohm_force=a.ohm.profile.force!=null?Math.round(a.ohm.profile.force):undefined;
    m.ohm_velocity=a.ohm.profile.velocity!=null?Math.round(a.ohm.profile.velocity):undefined;
    m.ohm_class=a.ohm.profile.classification;
  }
  return m;
};

function _captureMetricSnapshot(athId){
  const ath=S.athletes.find(a=>a.id===athId); if(!ath)return;
  if(!ath.metricSnapshots)ath.metricSnapshots=[];
  const m=getMetrics(ath);
  ath.metricSnapshots.push({date:today(),metrics:m});
  if(ath.metricSnapshots.length>50)ath.metricSnapshots=ath.metricSnapshots.slice(-50);
  save();
}

// Hook snapshot capture into VALD saves too (chains after the dupe-guard save above)
const _saveValdEntryPreSnapshot=window.saveValdEntry;
window.saveValdEntry=function(){
  const sel=document.getElementById('ve-sel');
  const athIdBefore=sel&&sel.value!=='_new'?sel.value:null;
  _saveValdEntryPreSnapshot.apply(this,arguments);
  setTimeout(()=>{const id=S.selAth||athIdBefore; if(id)_captureMetricSnapshot(id);},350);
};

const METRIC_EXPLORER_OPTIONS=[
  {k:'cmj',l:'CMJ (cm)'},{k:'rsi',l:'RSI'},{k:'asy',l:'Asymmetry %'},
  {k:'trap',l:'Trap 1RM (lbs)'},{k:'spd',l:'Sprint Speed'},{k:'vj',l:'Vertical Jump (in)'},
  {k:'bj',l:'Broad Jump (in)'},{k:'nf',l:'Nordic Force (N)'},
  {k:'ohm_force',l:'OHM Force-Zone Peak W'},{k:'ohm_velocity',l:'OHM Velocity-Zone Peak W'}
];

function _computeMetricExplorerData(metric){
  const rows=S.athletes.map(a=>{
    const m=getMetrics(a);const v=m[metric];
    return(v!=null&&v!==''&&!isNaN(parseFloat(v)))?{name:an(a),id:a.id,value:parseFloat(v)}:null;
  }).filter(Boolean).sort((a,b)=>b.value-a.value);
  const avg=rows.length?rows.reduce((s,r)=>s+r.value,0)/rows.length:0;
  return{rows,avg};
}

function renderMetricExplorer(){
  const sel=document.getElementById('metric-explorer-sel'); if(!sel)return;
  const metric=sel.value||'cmj';
  const{rows,avg}=_computeMetricExplorerData(metric);
  const max=rows.length?Math.max(...rows.map(r=>r.value),avg):1;
  const body=document.getElementById('metric-explorer-body'); if(!body)return;
  if(!rows.length){body.innerHTML='<div class="muted">No data for this metric yet.</div>';return;}
  body.innerHTML=rows.map(r=>{
    const pct=Math.max(4,Math.round((r.value/max)*100));
    const aboveAvg=r.value>=avg;
    return'<div style="margin-bottom:8px;cursor:pointer;" onclick="showMetricHistory(\''+r.id+'\',\''+metric+'\')">'
      +'<div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px;"><span>'+r.name+'</span><span style="color:'+(aboveAvg?'var(--accent)':'var(--text3)')+';">'+r.value+'</span></div>'
      +'<div style="height:6px;background:var(--bg4);border-radius:3px;"><div style="width:'+pct+'%;height:100%;background:'+(aboveAvg?'var(--accent)':'var(--border2)')+';border-radius:3px;"></div></div>'
      +'</div>';
  }).join('')+'<div class="muted" style="margin-top:6px;">Team average: '+avg.toFixed(1)+' \u2014 tap an athlete for their history.</div>';
}

function showMetricHistory(athId,metric){
  const ath=S.athletes.find(a=>a.id===athId); if(!ath)return;
  const snaps=(ath.metricSnapshots||[]).filter(s=>s.metrics&&s.metrics[metric]!=null).map(s=>({date:s.date,value:s.metrics[metric]}));
  const body=document.getElementById('metric-explorer-history'); if(!body)return;
  if(!snaps.length){body.innerHTML='<div class="muted">No snapshot history yet for '+an(ath)+' on this metric.</div>';return;}
  body.innerHTML='<div class="card-title" style="margin-top:10px;">'+an(ath)+' \u2014 history</div>'
    +snaps.map(s=>'<div style="display:flex;justify-content:space-between;font-size:10px;padding:3px 0;border-bottom:1px solid var(--border);"><span class="muted">'+s.date+'</span><span>'+s.value+'</span></div>').join('');
}

// ═══════════════════════ SECTION 9 — POWER \u00D7 SPEED PROFILE MAP ═══════
// CMJ (power) plotted against 10yd sprint (speed) for every athlete with
// both metrics on file. Top-right quadrant = above-average power AND
// above-average speed. Dashed lines = team average on each axis. Lets you
// see the power-to-speed relationship at a glance instead of eyeballing
// two separate lists.

function _computePowerSpeedMapData(){
  return S.athletes.map(function(a){
    var m=getMetrics(a);
    var cmj=parseFloat(m.cmj), spd=parseFloat(m.spd);
    if(isNaN(cmj)||isNaN(spd))return null;
    return{name:an(a),id:a.id,cmj:cmj,spd:spd};
  }).filter(Boolean);
}

function renderPowerSpeedMap(){
  var body=document.getElementById('psmap-body'); if(!body)return;
  var data=_computePowerSpeedMapData();
  if(data.length<2){body.innerHTML='<div class="muted">Need at least 2 athletes with both CMJ and 10yd sprint on file.</div>';return;}

  var W=340,H=280,pl=40,pr=14,pt=18,pb=34,x0=pl,x1=W-pr,y0=H-pb,y1=pt;
  var cmjVals=data.map(function(d){return d.cmj;}), spdVals=data.map(function(d){return d.spd;});
  var cmjMin=Math.min.apply(0,cmjVals),cmjMax=Math.max.apply(0,cmjVals);
  var spdMin=Math.min.apply(0,spdVals),spdMax=Math.max.apply(0,spdVals);
  var cmjPad=(cmjMax-cmjMin||1)*0.18, spdPad=(spdMax-spdMin||1)*0.18;
  cmjMin-=cmjPad;cmjMax+=cmjPad;spdMin-=spdPad;spdMax+=spdPad;

  function X(cmj){return x0+(cmj-cmjMin)/(cmjMax-cmjMin)*(x1-x0);}
  // Sprint time: LOWER is faster, so faster athletes plot HIGHER on the chart (toward y1)
  function Y(spd){return y0-(spdMax-spd)/(spdMax-spdMin)*(y0-y1);}

  var cmjAvg=cmjVals.reduce(function(a,b){return a+b;},0)/cmjVals.length;
  var spdAvg=spdVals.reduce(function(a,b){return a+b;},0)/spdVals.length;

  var NS='http://www.w3.org/2000/svg';
  function E(t,attrs,txt){var e=document.createElementNS(NS,t);for(var k in attrs)e.setAttribute(k,attrs[k]);if(txt!=null)e.textContent=txt;return e;}
  var cv=function(n){return getComputedStyle(document.body).getPropertyValue(n).trim()||'#00e5a0';};

  body.innerHTML='';
  var svg=E('svg',{viewBox:'0 0 '+W+' '+H,style:'width:100%;height:auto;display:block;'});

  svg.appendChild(E('line',{x1:x0,y1:y0,x2:x1,y2:y0,stroke:cv('--border2')}));
  svg.appendChild(E('line',{x1:x0,y1:y1,x2:x0,y2:y0,stroke:cv('--border2')}));
  svg.appendChild(E('line',{x1:X(cmjAvg),y1:y1,x2:X(cmjAvg),y2:y0,stroke:cv('--text3'),'stroke-dasharray':'2 3'}));
  svg.appendChild(E('line',{x1:x0,y1:Y(spdAvg),x2:x1,y2:Y(spdAvg),stroke:cv('--text3'),'stroke-dasharray':'2 3'}));

  svg.appendChild(E('text',{x:x1-3,y:y1+10,'text-anchor':'end','font-size':7,fill:cv('--accent')},'POWER + SPEED'));
  svg.appendChild(E('text',{x:x0+3,y:y0-4,'text-anchor':'start','font-size':7,fill:cv('--text3')},'DEVELOP BOTH'));
  svg.appendChild(E('text',{x:(x0+x1)/2,y:H-6,'text-anchor':'middle','font-size':8,fill:cv('--text2')},'CMJ (power) \u2192'));
  svg.appendChild(E('text',{x:12,y:(y0+y1)/2,'text-anchor':'middle','font-size':8,fill:cv('--text2'),transform:'rotate(-90 12 '+((y0+y1)/2)+')'},'FASTER \u2192'));

  data.forEach(function(d){
    var cx=X(d.cmj), cy=Y(d.spd);
    var eliteQuad=d.cmj>=cmjAvg&&d.spd<=spdAvg;
    svg.appendChild(E('circle',{cx:cx,cy:cy,r:5,fill:eliteQuad?cv('--accent'):cv('--blue'),stroke:cv('--bg'),'stroke-width':1,opacity:.9}));
    svg.appendChild(E('text',{x:cx,y:cy-8,'text-anchor':'middle','font-size':6.5,fill:cv('--text2')},d.name.split(' ')[0]));
  });

  body.appendChild(svg);
  var note=document.createElement('div');
  note.className='muted'; note.style.marginTop='6px';
  note.textContent='Top-right = above-average CMJ AND faster sprint. Dashed lines = team average. '+data.length+' athletes plotted (need both CMJ + 10yd on file to appear).';
  body.appendChild(note);
}

function _ensurePowerSpeedMapCard(){
  if(document.getElementById('psmap-card'))return;
  var anchor=document.getElementById('sprint-avgs')&&document.getElementById('sprint-avgs').closest('.card');
  if(!anchor||!anchor.parentElement)return;
  var card=document.createElement('div');
  card.className='card'; card.id='psmap-card';
  card.innerHTML='<div class="card-title">\ud83c\udfaf Power \u00d7 Speed Map</div><div id="psmap-body"></div>';
  anchor.parentElement.insertBefore(card,anchor);
}

function _ensureMetricExplorerCard(){
  if(document.getElementById('metric-explorer-card'))return;
  const anchor=document.getElementById('sprint-avgs')&&document.getElementById('sprint-avgs').closest('.card');
  if(!anchor||!anchor.parentElement)return;
  const card=document.createElement('div');
  card.className='card';card.id='metric-explorer-card';
  card.innerHTML='<div class="card-title">\ud83d\udcc8 Metric Explorer</div>'
    +'<select id="metric-explorer-sel" onchange="renderMetricExplorer()" style="font-size:11px;padding:5px 8px;margin-bottom:8px;">'
    +METRIC_EXPLORER_OPTIONS.map(o=>'<option value="'+o.k+'">'+o.l+'</option>').join('')+'</select>'
    +'<div id="metric-explorer-body"></div><div id="metric-explorer-history"></div>';
  anchor.parentElement.insertBefore(card,anchor);
}

function _renderOhmQuickLogSprintTab(){
  let card=document.getElementById('ohm-quicklog-sprint');
  if(!card){
    const anchor=document.getElementById('sprint-avgs')&&document.getElementById('sprint-avgs').closest('.card');
    if(!anchor||!anchor.parentElement)return;
    card=document.createElement('div');card.className='card';card.id='ohm-quicklog-sprint';
    anchor.parentElement.insertBefore(card,anchor);
  }
  card.innerHTML='<div class="card-title">\ud83d\udcca Log OHM Session</div>'
    +'<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;">'
    +'<select id="ohm-sprint-ath" style="font-size:10px;padding:4px;"><option value="">- Athlete -</option>'+S.athletes.map(a=>'<option value="'+a.id+'">'+an(a)+'</option>').join('')+'</select>'
    +'<select id="ohm-sprint-level" style="font-size:10px;padding:4px;"><option value="4">4ohm</option><option value="6">6ohm</option><option value="8">8ohm</option></select>'
    +'<input id="ohm-sprint-avg" placeholder="avg W" style="font-size:10px;padding:4px 6px;width:60px;">'
    +'<input id="ohm-sprint-peak" placeholder="peak W" style="font-size:10px;padding:4px 6px;width:60px;">'
    +'<input id="ohm-sprint-reps" placeholder="reps" style="font-size:10px;padding:4px 6px;width:44px;">'
    +'<button class="btn btn-sm" onclick="_logOhmFromSprintTab()">Log</button></div>';
}
function _logOhmFromSprintTab(){
  const athId=document.getElementById('ohm-sprint-ath').value;
  if(!athId){toast('Select athlete');return;}
  const level=document.getElementById('ohm-sprint-level').value;
  const avg=document.getElementById('ohm-sprint-avg').value;
  const peak=document.getElementById('ohm-sprint-peak').value;
  const reps=document.getElementById('ohm-sprint-reps').value;
  if(logOhmSession(athId,level,avg,peak,reps,''))toast('OHM session logged');
}
function _renderOhmQuickLogAthDetail(id){
  const detail=document.getElementById('ath-detail'); if(!detail)return;
  const card=document.createElement('div');
  card.className='card';card.id='ohm-quicklog-ath';
  card.innerHTML='<div class="card-title">\ud83d\udcca Log OHM Session</div>'
    +'<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;">'
    +'<select id="ohm-ath-level" style="font-size:10px;padding:4px;"><option value="4">4ohm</option><option value="6">6ohm</option><option value="8">8ohm</option></select>'
    +'<input id="ohm-ath-avg" placeholder="avg W" style="font-size:10px;padding:4px 6px;width:60px;">'
    +'<input id="ohm-ath-peak" placeholder="peak W" style="font-size:10px;padding:4px 6px;width:60px;">'
    +'<input id="ohm-ath-reps" placeholder="reps" style="font-size:10px;padding:4px 6px;width:44px;">'
    +'<button class="btn btn-sm" onclick="logOhmSession(\''+id+'\',document.getElementById(\'ohm-ath-level\').value,document.getElementById(\'ohm-ath-avg\').value,document.getElementById(\'ohm-ath-peak\').value,document.getElementById(\'ohm-ath-reps\').value,\'\')&&toast(\'OHM logged\')">Log</button></div>';
  detail.appendChild(card);
}

(function backfillInitialSnapshots(){
  let changed=false;
  S.athletes.forEach(a=>{
    if(!a.metricSnapshots||!a.metricSnapshots.length){
      const m=getMetrics(a);
      if(Object.keys(m).some(k=>m[k]!=null)){a.metricSnapshots=[{date:today(),metrics:m}];changed=true;}
    }
  });
  if(changed)save();
})();

// ═══════════════════════ SECTION 3 — SAFETY, COMPLIANCE, FILM ═══════════

function _extractSafetyFlags(notes){
  if(!notes)return [];
  const keywords=['tendon','acl','patellar','achilles','back','spine','disc','concussion','fracture','stress fracture','shoulder','labrum','meniscus','hamstring strain','groin'];
  const lower=notes.toLowerCase();
  return keywords.filter(k=>lower.includes(k));
}

function _autoTagComplianceFlags(p){
  const aclNames=['nordic','hip abduction','glute med','clamshell','hip abductor'];
  const tendonNames=['isometric','tendon','decline calf','wall sit'];
  (p.weeks_data||[]).forEach(w=>(w.days||[]).forEach(d=>(d.sessions||[]).forEach(s=>{
    (s.exercises||[]).forEach(ex=>{
      const n=(ex.name||'').toLowerCase();
      if(ex.aclWork===undefined)ex.aclWork=aclNames.some(k=>n.includes(k));
      if(ex.tendonWork===undefined)ex.tendonWork=tendonNames.some(k=>n.includes(k));
    });
  })));
}

function computeAclCompliance(p){
  _autoTagComplianceFlags(p);
  let total=0,logged=0;
  (p.weeks_data||[]).forEach(w=>{
    if(w.week>(p.currentWeek||1))return;
    (w.days||[]).forEach(d=>(d.sessions||[]).forEach(s=>{
      (s.exercises||[]).forEach((ex,ei)=>{
        if(ex.aclWork||ex.tendonWork){
          total++;
          const key=d.day+'-'+s.type+'-'+ei;
          if(p.actuals&&p.actuals['wk'+w.week]&&p.actuals['wk'+w.week][key])logged++;
        }
      });
    }));
  });
  return total?{total,logged,pct:Math.round(logged/total*100)}:null;
}

function flagFilmForProgram(analysisId){
  const a=(S.filmAnalyses||[]).find(x=>x.id===analysisId); if(!a)return;
  a.priorityForProgram=!a.priorityForProgram;
  save();
  toast(a.priorityForProgram?'Flagged for next program generation':'Unflagged');
}

function getRecentFilmFindings(athId,n){
  n=n||2;
  let analyses=(S.filmAnalyses||[]).filter(a=>a.athId===athId);
  const flagged=analyses.filter(a=>a.priorityForProgram);
  analyses=(flagged.length?flagged:analyses).slice(0,n);
  if(!analyses.length)return '';
  return analyses.map(a=>{
    const r=a.result||{};
    const cues=(r.topCues||[]).slice(0,2).map(c=>c.title+(c.why?': '+c.why:'')).join('; ');
    let line=(a.date||a.ts||'')+' '+(a.movementLabel||'')+' (Grade '+(r.overallGrade||'?')+'): '+(r.summary||'');
    if(cues)line+=' Key cues: '+cues;
    if(r.retestTarget)line+=' Retest target: '+r.retestTarget;
    return line;
  }).join('\n');
}

const _origShowFilmOutput=window.showFilmOutput;
window.showFilmOutput=function(a){
  _origShowFilmOutput.apply(this,arguments);
  try{
    const out=document.getElementById('film-output');
    if(out&&a&&a.athId){
      const btn=document.createElement('button');
      btn.className='btn btn-sm';btn.style.marginTop='8px';
      btn.textContent=a.priorityForProgram?'\u2605 Prioritized for Program':'\u2606 Use This Finding in Next Program';
      btn.onclick=function(){flagFilmForProgram(a.id);showFilmOutput(a);};
      out.appendChild(btn);
    }
  }catch(e){}
};

const _origRenderFilmHistory=window.renderFilmHistory;
window.renderFilmHistory=function(){
  _origRenderFilmHistory.apply(this,arguments);
  try{
    const el=document.getElementById('film-history'); if(!el)return;
    const list=S.filmAnalyses||[];
    [...el.children].forEach((child,i)=>{
      const a=list[i]; if(!a||!a.priorityForProgram)return;
      if(child.querySelector('.priority-star'))return;
      const star=document.createElement('span');
      star.className='priority-star';star.textContent=' \u2605';star.style.color='var(--accent)';
      star.title='Prioritized for program generation';
      const nameDiv=child.querySelector('div > div');
      if(nameDiv)nameDiv.appendChild(star);
    });
  }catch(e){}
};

function runRosterHealthAudit(){
  const A=S.athletes,lines=[];
  lines.push('ROSTER HEALTH \u2014 '+A.length+' athletes\n');
  const dupes=[];
  for(let i=0;i<A.length;i++)for(let j=i+1;j<A.length;j++){
    const dl=_lev(A[i].last,A[j].last),df=_lev(A[i].first,A[j].first);
    if(dl<=2&&df<=2)dupes.push(an(A[i])+' \u2194 '+an(A[j]));
  }
  lines.push('Possible duplicates: '+(dupes.length?dupes.join('; '):'none'));
  const blankNotes=A.filter(a=>!a.notes||!a.notes.trim());
  lines.push('Blank notes/constraints: '+blankNotes.length+'/'+A.length+(blankNotes.length?' \u2014 '+blankNotes.map(an).join(', '):''));
  const blankSport=A.filter(a=>!a.sport||!a.sport.trim());
  lines.push('Missing sport/position: '+blankSport.length+'/'+A.length);
  const noProgram=A.filter(a=>!S.programs[a.id]);
  lines.push('No program on file: '+noProgram.length+'/'+A.length);
  const noSessions=A.filter(a=>!(S.sessions[a.id]&&S.sessions[a.id].length)&&(a.status==='Active'||a.status==='In-Season'));
  lines.push('Active/In-Season, zero sessions logged: '+noSessions.length+(noSessions.length?' \u2014 '+noSessions.map(an).join(', '):''));
  const incomplete=Object.values(S.programs||{}).filter(p=>p.weeks_data&&p.weeks_data.length<p.weeks);
  lines.push('Incomplete/stalled programs: '+incomplete.length+(incomplete.length?' \u2014 '+incomplete.map(p=>p.athName+' ('+p.weeks_data.length+'/'+p.weeks+')').join(', '):''));
  let stale=0;
  Object.keys(S.programs||{}).forEach(id=>{
    const p=S.programs[id],ath=A.find(a=>a.id===id);
    if(p&&ath&&p.valdSnapshot){try{if(p.valdSnapshot!==JSON.stringify(getMetrics(ath)))stale++;}catch(e){}}
  });
  lines.push('Programs stale vs current VALD/OHM: '+stale);
  alert(lines.join('\n'));
}

// ═══════════════════════ SECTION 4 — PROMPT BUILDING (why + evidence + safety + film + OHM) ═

const _origBuildWeekPrompt=window.buildWeekPrompt;
window.buildWeekPrompt=function(wk,totalWeeks,ath,opts,prevWeekData,actuals){
  let base=_origBuildWeekPrompt(wk,totalWeeks,ath,opts,prevWeekData,actuals);
  const m=getMetrics(ath);

  if(m.ohm_class){
    base+='\n\nOHM FORCE-VELOCITY PROFILE: '+m.ohm_class
      +(m.ohm_force!=null?' | Force-zone (4ohm) avg peak watts: '+m.ohm_force:'')
      +(m.ohm_velocity!=null?' | Velocity-zone (8ohm) avg peak watts: '+m.ohm_velocity:'')
      +'\nUse this to bias exercise selection: force-dominant/velocity-deficit athletes need more reactive/elastic work; velocity-expressive/force-hole athletes need more heavy slow strength work before adding speed.';
  }

  base+='\n\nWHY (mandatory): every exercise object must include a "why" field \u2014 ONE sentence explaining why THIS athlete needs THIS exercise right now, referencing their actual VALD/OHM number or the specific methodology principle driving it. Not generic \u2014 tie it to the data given above.\n'
    +'Also tag each exercise with two booleans: "aclWork" (true if Nordic curl / hip abduction / glute med / ACL-prevention pattern) and "tendonWork" (true if isometric or tendon-capacity focused). Updated exercise schema: {"name":"...","sets":"4","reps":"5","tempo":"...","weight":"...","rpe":"7","cue":"...","why":"...","aclWork":false,"tendonWork":false,"vald":false}';

  const p=S.programs[ath.id];
  if(p){
    const loadNote=_loadHistorySummary(p);
    if(loadNote)base+='\n\nLOAD HISTORY (auto-tracked from logged actuals \u2014 use to set this week\'s loads):\n'+loadNote;
    const speedNote=_speedTrendSummary(p);
    if(speedNote)base+='\n\nSPEED TREND (auto-tracked from logged actuals):\n'+speedNote;
  }

  base+='\n\nEVIDENCE BASE (use to sharpen exercise selection, cues, and "why" text \u2014 cite the principle, not a citation number, in athlete-facing text):\n'
    +'- SPRINT MECHANICS [Haugen/McGhie/Ettema 2019]: trunk angle progresses from ~36\u00b0 (first step) to ~84\u00b0 (near max velocity) through acceleration \u2014 use this as the actual cueing benchmark instead of vague "progressive extension." GCT and leg stiffness stay relatively constant across a sprint \u2014 do not treat horizontal and vertical force as independent, isolated contributors.\n'
    +'- SPRINT TRAINING DESIGN [Haugen/Seiler/Sandbakk/Tonnessen 2019]: progression, specificity, variation/periodization, individualization are the four pillars. Session-to-session sprint time changes under ~2% are typically measurement noise, not real adaptation \u2014 don\'t over-react to small timing fluctuations.\n'
    +'- TENDON LOADING [Malliaras/Cook/Purdam/Rio 2015]: 4-stage progression \u2014 (1) isometric for pain modulation when irritable (acute analgesic effect, not just strength), (2) isotonic/heavy-slow-resistance to rebuild capacity, (3) energy-storage/plyometric reintroduction once pain-quiet, (4) return-to-sport. Some pain during/after is acceptable but must settle within 24 hours.\n'
    +'- ACL/NEUROMUSCULAR PREVENTION [Sugimoto et al. 2012, female-specific]: injury-risk reduction scales with compliance, not program inclusion \u2014 the "why" for Nordic/hip-abductor/glute-med work should reinforce that consistency across sessions drives the effect, not any single session.\n';

  if(ath.notes&&ath.notes.trim()){
    const flags=_extractSafetyFlags(ath.notes);
    base+='\n\nMANDATORY SAFETY CONSTRAINT (from athlete file \u2014 cannot be dropped or overridden this session regardless of the Constraints box above): "'+ath.notes.trim()+'"'
      +(flags.length?' Flagged terms detected: '+flags.join(', ')+' \u2014 treat as hard constraints on loading/exercise selection.':'');
  }

  const filmNote=getRecentFilmFindings(ath.id,2);
  if(filmNote)base+='\n\nRECENT FILM ANALYSIS FINDINGS (incorporate corrective cues/exercise selection to address these faults):\n'+filmNote;

  return base;
};

const _origBuildRetestWeekPrompt=window.buildRetestWeekPrompt;
window.buildRetestWeekPrompt=function(wk,ath,prevWeekData){
  let base=_origBuildRetestWeekPrompt(wk,ath,prevWeekData);
  base+='\n\nAlso add a "why" field to every exercise (one sentence, tie to the baseline number being retested).';
  return base;
};

// ═══════════════════════ SECTION 5 — RESUMABLE GENERATION + DATA GATE ═══

async function _apiFetchWithBackoff(body,maxAttempts){
  maxAttempts=maxAttempts||4;
  let lastErr=null;
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    try{
      const res=await apiFetch(body);
      if(res.status===429||res.status>=500){
        lastErr='HTTP '+res.status;
        if(attempt<maxAttempts){await new Promise(r=>setTimeout(r,Math.pow(2,attempt)*500));continue;}
        return{error:true,message:lastErr};
      }
      return{res};
    }catch(e){
      lastErr=e.message;
      if(attempt<maxAttempts){await new Promise(r=>setTimeout(r,Math.pow(2,attempt)*500));continue;}
      return{error:true,message:lastErr};
    }
  }
  return{error:true,message:lastErr||'Unknown error'};
}

window.genProgram=async function(resumeAthId){
  if(!resumeAthId){
    const athId0=document.getElementById('prog-ath')&&document.getElementById('prog-ath').value;
    const ath0=athId0&&S.athletes.find(a=>a.id===athId0);
    if(ath0&&(!ath0.notes||!ath0.notes.trim())){
      const proceed=confirm('No constraints/rehab notes on file for '+an(ath0)+'.\n\nWithout this, the generator can\'t account for anything you know but haven\'t written down \u2014 tendon flags, asymmetry side, back issues, etc.\n\nGenerate anyway?');
      if(!proceed){toast('Add notes in the athlete profile, then generate.');return;}
    }
  }

  const athId=resumeAthId||document.getElementById('prog-ath').value;
  if(!athId){toast('Select athlete');return;}
  if(!_apiKey){toast('Set API key first');return;}
  const ath=S.athletes.find(a=>a.id===athId); if(!ath)return;

  const isResume=!!resumeAthId&&S.programs[athId]&&S.programs[athId]._genState;
  const genState=isResume?S.programs[athId]._genState:null;

  const totalWeeks=genState?genState.totalWeeks:(parseInt(document.getElementById('prog-weeks').value)||8);
  const opts=genState?genState.opts:{
    loading:document.getElementById('prog-loading').value,
    goal:document.getElementById('prog-goal').value,
    days:parseInt(document.getElementById('prog-days').value)||3,
    constraints:document.getElementById('prog-constraints').value.trim()||ath.notes||'',
    equip:(_progEquip&&_progEquip.length)?_progEquip:EQUIPMENT
  };

  const btn=document.getElementById('prog-gen-btn'); if(btn)btn.disabled=true;
  const retestWeeks=[]; for(let w=4;w<=totalWeeks;w+=4)retestWeeks.push(w);
  const valdSnapshot=JSON.stringify(getMetrics(ath));

  let weeksData,startWeek;
  if(isResume){
    weeksData=S.programs[athId].weeks_data||[];
    startWeek=weeksData.length+1;
    toast('Resuming from week '+startWeek+' of '+totalWeeks);
  }else{
    weeksData=[]; startWeek=1;
    S.programs[athId]={
      athId,athName:an(ath),generated:today(),
      weeks:totalWeeks,phase:'Triphasic',goal:opts.goal,
      loading:opts.loading,edited:false,actuals:{},
      primaryGoals:['Build per week'],valdFlags:[],
      weeks_data:[],valdSnapshot,_genState:{totalWeeks,opts,retestWeeks,inProgress:true}
    };
  }
  S.programs[athId]._genState={totalWeeks,opts,retestWeeks,inProgress:true};
  save(); renderProgramList();

  const detailEl=document.getElementById('prog-detail');
  if(detailEl)detailEl.innerHTML='<div class="card"><div class="card-title">\u26a1 '+(isResume?'Resuming':'Generating')+' '+totalWeeks+'-Week Program</div><div id="gen-progress" style="margin-bottom:14px;"></div><div id="gen-weeks-preview"></div></div>';

  function updateProgress(wk,status){
    const el=document.getElementById('gen-progress'); if(!el)return;
    const pct=Math.round((wk/totalWeeks)*100);
    el.innerHTML='<div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span style="font-size:10px;color:var(--text2);">Week '+wk+' of '+totalWeeks+' \u2014 '+status+'</span><span style="font-size:10px;color:var(--accent);">'+pct+'%</span></div><div style="height:3px;background:var(--bg4);border-radius:2px;"><div style="width:'+pct+'%;height:100%;background:var(--accent);border-radius:2px;transition:width .3s;"></div></div>';
  }
  function appendWeekPreview(weekData){
    const el=document.getElementById('gen-weeks-preview'); if(!el)return;
    const isRetest=weekData.phase==='Retest';
    const div=document.createElement('div');
    div.style.cssText='background:var(--bg3);border:1px solid var(--border);border-left:3px solid '+(isRetest?'var(--orange)':'var(--accent)')+';border-radius:var(--r);padding:8px 12px;margin-bottom:6px;';
    div.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;"><div style="font-family:var(--disp);font-size:15px;">Week '+weekData.week+(isRetest?' \ud83d\udd01':'')+'</div><span style="font-size:8px;color:'+(isRetest?'var(--orange)':'var(--accent)')+';">'+weekData.phase+'</span></div><div style="font-size:9px;color:var(--text3);margin-top:2px;">'+weekData.focus+'</div>';
    el.appendChild(div);
  }

  let failed=false,failReason='';
  for(let wk=startWeek;wk<=totalWeeks;wk++){
    if(failed)break;
    updateProgress(wk,'building...');
    const isRetest=retestWeeks.includes(wk);
    const prevWeek=weeksData.length?weeksData[weeksData.length-1]:null;
    const weekActuals=(S.programs[athId].actuals&&S.programs[athId].actuals['wk'+(wk-1)])||null;
    const prompt=isRetest?buildRetestWeekPrompt(wk,ath,prevWeek):buildWeekPrompt(wk,totalWeeks,ath,opts,prevWeek,weekActuals);
    if(btn)btn.textContent='Wk '+wk+'/'+totalWeeks+'...';
    const{res,error,message}=await _apiFetchWithBackoff({max_tokens:2000,system:'You are a JSON-only S&C week generator. Output ONLY valid JSON for ONE week. Start with { end with }. No markdown. No explanation.',messages:[{role:'user',content:prompt}]},4);
    if(error){failed=true;failReason=message;break;}
    const d=await res.json();
    if(d.error){failed=true;failReason=(d.error.message||'API error');break;}
    const raw=(d.content&&d.content.find(b=>b.type==='text')&&d.content.find(b=>b.type==='text').text)||'';
    let weekObj=parseJSONLoose(raw)||parseJSONLoose(repairJSON(raw));
    if(!weekObj||!weekObj.days){failed=true;failReason='Could not parse week '+wk;break;}
    weekObj.week=wk;
    if(!weekObj.phase)weekObj.phase=getPhaseForWeek(wk,totalWeeks).name;
    weeksData.push(weekObj);
    S.programs[athId].weeks_data=weeksData;
    save(); appendWeekPreview(weekObj); updateProgress(wk,'done \u2713');
    if(wk<totalWeeks)await new Promise(r=>setTimeout(r,300));
  }

  if(btn){btn.textContent='\u26a1 Generate';btn.disabled=false;}

  if(failed){
    S.programs[athId]._genState.inProgress=false;
    S.programs[athId]._genState.stalledAt=weeksData.length+1;
    S.programs[athId]._genState.stallReason=failReason;
    save();
    toast('Stopped at week '+(weeksData.length+1)+': '+failReason+'. Tap Resume to continue.');
    renderProgramList();
    if(detailEl)showProgDetail(athId,Math.max(0,weeksData.length-1));
    return;
  }

  const phases=[...new Set(weeksData.map(w=>w.phase))].join(' \u2192 ');
  S.programs[athId].phase=phases;
  S.programs[athId].weeks=weeksData.length;
  S.programs[athId]._genState.inProgress=false;
  save(); renderProgramList();
  const currentWk=S.programs[athId].currentWeek||1;
  showProgDetail(athId,currentWk-1);
  toast(weeksData.length+'-wk program built!'+(retestWeeks.length?' Retest weeks: '+retestWeeks.join(', '):''));
};

function resumeProgram(athId){window.genProgram(athId);}

function regenerateFromWeek(athId,fromWeek){
  const p=S.programs[athId]; if(!p){toast('No program found');return;}
  const ath=S.athletes.find(a=>a.id===athId); if(!ath)return;
  if(!confirm('Regenerate week '+fromWeek+' onward using CURRENT VALD/OHM data? Weeks before '+fromWeek+' stay exactly as they are.'))return;
  p.weeks_data=(p.weeks_data||[]).filter(w=>w.week<fromWeek);
  const m=getMetrics(ath);
  let newGoal='balanced';
  if(m.asy&&parseFloat(m.asy)>10)newGoal='asym';
  else if(m.spd&&parseFloat(m.spd)>5.0)newGoal='speed';
  else if(m.rsi&&parseFloat(m.rsi)<0.9)newGoal='power';
  const prevOpts=(p._genState&&p._genState.opts)||{loading:p.loading||'rpe',days:3,equip:EQUIPMENT};
  p._genState={
    totalWeeks:p.weeks,
    opts:{...prevOpts,goal:newGoal,constraints:ath.notes||prevOpts.constraints||''},
    retestWeeks:(function(){const r=[];for(let w=4;w<=p.weeks;w+=4)r.push(w);return r;})(),
    inProgress:true
  };
  p.valdSnapshot=JSON.stringify(m);
  save();
  toast('Regenerating from week '+fromWeek+' with current data (goal: '+newGoal+')...');
  window.genProgram(athId);
}

// ═══════════════════════ SECTION 6 — ACTUALS: LEARNING + AUDIT TRAIL ═════

function _parseActual(text){
  if(!text)return null;
  const t=String(text);
  const weightM=t.match(/(\d+(?:\.\d+)?)\s*(lbs?|kg|%)/i);
  const repsM=t.match(/x\s*(\d+)|(\d+)\s*reps?/i);
  const rpeM=t.match(/rpe\s*(\d+(?:\.\d+)?)|@\s*(\d+(?:\.\d+)?)/i);
  return{
    weight:weightM?parseFloat(weightM[1]):null,
    weightUnit:weightM?weightM[2].toLowerCase():null,
    reps:repsM?parseInt(repsM[1]||repsM[2]):null,
    rpe:rpeM?parseFloat(rpeM[1]||rpeM[2]):null
  };
}

function _autoregDelta(prescribedRPE,actualRPE){
  if(prescribedRPE==null||actualRPE==null)return 0;
  const diff=actualRPE-prescribedRPE;
  if(diff>=2)return -0.075;
  if(diff>=1)return -0.03;
  if(diff<=-2)return 0.08;
  if(diff<=-1)return 0.05;
  return 0.025;
}

function _applyDeltaToWeight(weightStr,delta){
  if(!weightStr||!delta)return null;
  const pctM=String(weightStr).match(/(\d+(?:\.\d+)?)\s*%/);
  if(pctM){const newPct=Math.round(parseFloat(pctM[1])*(1+delta));return String(weightStr).replace(pctM[0],newPct+'%');}
  const numM=String(weightStr).match(/(\d+(?:\.\d+)?)/);
  if(numM){const newNum=Math.round(parseFloat(numM[1])*(1+delta)*2)/2;return String(weightStr).replace(numM[0],String(newNum));}
  return null;
}

function _loadHistorySummary(p){
  if(!p.loadHistory)return '';
  const lines=[];
  Object.entries(p.loadHistory).forEach(([name,hist])=>{
    const last=hist[hist.length-1];
    lines.push(name+': last actual RPE '+last.actualRPE+' vs prescribed '+last.prescribedRPE+' (week '+last.week+') \u2192 '+(last.suggestedAdjPct>=0?'progress':'reduce')+' '+Math.abs(Math.round(last.suggestedAdjPct*100))+'%');
  });
  return lines.length?lines.join('\n'):'';
}

const _origLogWeekActuals=window.logWeekActuals;
window.logWeekActuals=function(athId,wkNum,key,val){
  _origLogWeekActuals.apply(this,arguments);
  try{_learnFromActual(athId,wkNum,key,val);}catch(e){console.warn('learn-from-actual failed',e);}
};

function _learnFromActual(athId,wkNum,key,val){
  const p=S.programs[athId]; if(!p)return;
  const parsed=_parseActual(val);
  if(parsed.weight==null&&parsed.rpe==null)return;
  const w=(p.weeks_data||[]).find(w=>w.week===wkNum); if(!w)return;
  let foundEx=null,foundName=null;
  (w.days||[]).forEach(d=>(d.sessions||[]).forEach(s=>{
    const parts=key.split('-'); const ei=parseInt(parts[parts.length-1]);
    if((d.day+'-'+s.type)===parts.slice(0,-1).join('-')&&s.exercises&&s.exercises[ei]){
      foundEx=s.exercises[ei]; foundName=(foundEx.name||'').toLowerCase().trim();
    }
  }));
  if(!foundEx||!foundName)return;
  const prescribedRPE=parseFloat(foundEx.rpe)||null;
  const delta=_autoregDelta(prescribedRPE,parsed.rpe);
  if(!p.loadHistory)p.loadHistory={};
  if(!p.loadHistory[foundName])p.loadHistory[foundName]=[];
  p.loadHistory[foundName].push({week:wkNum,prescribedRPE,actualRPE:parsed.rpe,actualWeight:parsed.weight,actualReps:parsed.reps,suggestedAdjPct:delta,date:today()});
  let appliedCount=0;
  (p.weeks_data||[]).forEach(fw=>{
    if(fw.week<=wkNum)return;
    (fw.days||[]).forEach(d=>(d.sessions||[]).forEach(s=>{
      (s.exercises||[]).forEach(ex=>{
        if((ex.name||'').toLowerCase().trim()!==foundName)return;
        if(ex._autoAdjusted)return;
        const before=ex.weight;
        const adjusted=_applyDeltaToWeight(ex.weight,delta);
        if(adjusted!=null){
          ex.weight=adjusted; ex._autoAdjusted=true;
          if(!ex._adjHistory)ex._adjHistory=[];
          ex._adjHistory.push({week:fw.week,from:before,to:adjusted,deltaPct:delta,sourceWeek:wkNum,date:today()});
          ex.why=(ex.why?ex.why+' ':'')+'(Auto-adjusted '+(delta>=0?'+':'')+Math.round(delta*100)+'% from Week '+wkNum+' actual RPE '+parsed.rpe+' vs prescribed '+prescribedRPE+'.)';
          appliedCount++;
        }
      });
    }));
  });
  save();
  if(appliedCount)toast('Learned from actual \u2014 auto-adjusted '+foundEx.name+' in '+appliedCount+' upcoming week(s)');
}

function revertAutoAdjust(athId,wi,di,si,ei){
  const p=S.programs[athId]; if(!p)return;
  try{
    const ex=p.weeks_data[wi].days[di].sessions[si].exercises[ei];
    if(!ex._adjHistory||!ex._adjHistory.length){toast('No adjustment history for this exercise');return;}
    const last=ex._adjHistory.pop();
    ex.weight=last.from;
    if(!ex._adjHistory.length)ex._autoAdjusted=false;
    save(); showProgDetail(athId,wi);
    toast('Reverted '+ex.name+' to '+last.from);
  }catch(e){toast('Revert failed');}
}

function logSpeedActual(athId,wkNum,metric,value){
  const p=S.programs[athId]; if(!p)return false;
  const v=parseFloat(value); if(isNaN(v))return false;
  if(!p.speedLog)p.speedLog=[];
  p.speedLog.push({week:wkNum,metric,value:v,date:today()});
  save(); toast('Logged '+metric+': '+v+'s');
  showProgDetail(athId,wkNum-1);
  return true;
}

const SWC_THRESHOLD_PCT=2; // smallest-worthwhile-change floor for sprint time noise [Haugen 2019]

function _speedTrend(p,metric){
  const rows=(p.speedLog||[]).filter(r=>r.metric===metric).sort((a,b)=>a.week-b.week);
  if(rows.length<2)return null;
  const first=rows[0].value,last=rows[rows.length-1].value;
  const pctChange=((last-first)/first)*100;
  return{first,last,pctChange,n:rows.length};
}

function _speedTrendSummary(p){
  if(!p.speedLog||!p.speedLog.length)return '';
  const metrics=[...new Set(p.speedLog.map(r=>r.metric))];
  const lines=[];
  metrics.forEach(m=>{
    const t=_speedTrend(p,m); if(!t)return;
    const mag=Math.abs(t.pctChange);
    let dir,action;
    if(mag<SWC_THRESHOLD_PCT){dir='stable (within normal measurement variability, not a real trend)';action='';}
    else if(t.pctChange<0){dir='faster (improving)';action=' \u2014 consider progressing volume/intensity';}
    else{dir='slower (regressing)';action=' \u2014 back off volume, check fatigue/recovery';}
    lines.push(m+': '+t.first+'s \u2192 '+t.last+'s over '+t.n+' logs, '+mag.toFixed(1)+'% '+dir+action);
  });
  return lines.join('\n');
}

// ═══════════════════════ SECTION 7 — PROGRAM DETAIL RENDERER ════════════

window.showProgDetail=function(athId,forceWkIdx){
  const p=S.programs[athId]; if(!p)return;
  const currentWkIdx=forceWkIdx!==undefined?forceWkIdx:(p.currentWeek?p.currentWeek-1:0);
  const w=p.weeks_data[currentWkIdx]; if(!w)return;
  const isRetest=w.phase==='Retest';

  const weekNav=p.weeks_data.map((wd,i)=>{
    const done=i<currentWkIdx,active=i===currentWkIdx,rt=wd.phase==='Retest';
    return'<button onclick="showProgDetail(\''+athId+'\','+i+')" style="padding:4px 9px;font-size:9px;border-radius:var(--r);border:1px solid '+(active?'var(--accent)':rt?'rgba(255,140,66,.4)':'var(--border2)')+';background:'+(active?'var(--accent)':done?'var(--bg4)':'var(--bg3)')+';color:'+(active?'#000':done?'var(--text3)':'var(--text2)')+';cursor:pointer;white-space:nowrap;">'+(rt?'\ud83d\udd01 ':'')+'W'+(i+1)+(done?' \u2713':'')+'</button>';
  }).join('');

  const speedT=_speedTrendSummary(p);
  const compliance=computeAclCompliance(p);

  const weeksHtml='<div class="prog-week"><div class="prog-week-hdr"><div class="prog-week-title" style="color:'+(isRetest?'var(--orange)':'var(--accent)')+';">Week '+w.week+(isRetest?' \u2014 RETEST DAY \ud83d\udd01':' \u2014 '+w.phase)+'</div>'
    +'<input value="'+(w.focus||'').replace(/"/g,'&quot;')+'" onchange="editProgFocus(\''+athId+'\','+(currentWkIdx)+',this.value)" style="font-size:9px;flex:1;margin-left:10px;max-width:200px;padding:4px 8px;color:var(--accent);border-color:transparent;background:transparent;text-align:right;"></div>'
    +(w.days||[]).map((d,di)=>(d.sessions||[]).map((s,si)=>{
      return'<div class="prog-day"><div style="border-left:2px solid '+(isRetest?'var(--orange)':'var(--border2)')+';padding-left:10px;">'
      +'<div style="font-size:10px;font-weight:700;padding:3px 0 4px;">'+d.day+' &mdash; '+s.type+'</div>'
      +(s.warmup?'<div style="font-size:9px;color:var(--text3);font-style:italic;padding-bottom:5px;">Warm-up: '+s.warmup+'</div>':'')
      +'<div style="overflow-x:auto;"><table class="tbl" style="font-size:10px;min-width:400px;"><thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Tempo</th><th>Weight</th><th>RPE</th><th>Actual</th><th></th></tr></thead><tbody>'
      +(s.exercises||[]).map((ex,ei)=>{
        const wid='why-'+athId+'-'+currentWkIdx+'-'+di+'-'+si+'-'+ei;
        return'<tr>'
        +'<td><input value="'+(ex.name||'').replace(/"/g,'&quot;')+'" onchange="editEx(\''+athId+'\','+(currentWkIdx)+','+di+','+si+','+ei+',\'name\',this.value)" style="padding:3px 5px;font-size:10px;border-color:transparent;background:transparent;">'
        +(ex.vald?'<span style="font-size:7px;background:rgba(184,255,87,.15);color:var(--accent);padding:1px 4px;border-radius:2px;margin-left:4px;">VALD</span>':'')
        +(ex.aclWork?'<span style="font-size:7px;background:rgba(184,140,255,.15);color:#b88cff;padding:1px 4px;border-radius:2px;margin-left:4px;">ACL</span>':'')
        +(ex.tendonWork?'<span style="font-size:7px;background:rgba(255,200,66,.15);color:#ffc842;padding:1px 4px;border-radius:2px;margin-left:4px;">TENDON</span>':'')
        +(ex._autoAdjusted?'<span style="font-size:7px;background:rgba(66,165,255,.15);color:var(--blue);padding:1px 4px;border-radius:2px;margin-left:4px;">AUTO-ADJ</span> <a href="#" onclick="event.preventDefault();revertAutoAdjust(\''+athId+'\','+(currentWkIdx)+','+di+','+si+','+ei+');" style="font-size:7px;color:var(--red);text-decoration:underline;">\u21ba revert</a>':'')
        +'<div style="font-size:8px;color:var(--text3);font-style:italic;padding-left:5px;">'+(ex.cue||'')+'</div>'
        +(ex.why?'<div style="padding-left:5px;"><a href="#" onclick="event.preventDefault();var e=document.getElementById(\''+wid+'\');e.style.display=e.style.display===\'none\'?\'block\':\'none\';" style="font-size:8px;color:var(--accent);text-decoration:none;">Why?</a><div id="'+wid+'" style="display:none;font-size:8px;color:var(--text2);margin-top:2px;line-height:1.4;">'+ex.why+'</div></div>':'')
        +'</td>'
        +'<td><input value="'+(ex.sets||'')+'" onchange="editEx(\''+athId+'\','+(currentWkIdx)+','+di+','+si+','+ei+',\'sets\',this.value)" style="padding:3px;font-size:10px;width:38px;text-align:center;"></td>'
        +'<td><input value="'+(ex.reps||'')+'" onchange="editEx(\''+athId+'\','+(currentWkIdx)+','+di+','+si+','+ei+',\'reps\',this.value)" style="padding:3px;font-size:10px;width:44px;text-align:center;"></td>'
        +'<td><input value="'+(ex.tempo||'')+'" onchange="editEx(\''+athId+'\','+(currentWkIdx)+','+di+','+si+','+ei+',\'tempo\',this.value)" placeholder="--" style="padding:3px;font-size:10px;width:50px;text-align:center;color:var(--text2);font-family:var(--mono);"></td>'
        +'<td><input value="'+(ex.weight||'')+'" onchange="editEx(\''+athId+'\','+(currentWkIdx)+','+di+','+si+','+ei+',\'weight\',this.value)" placeholder="--" style="padding:3px;font-size:10px;width:52px;text-align:center;color:var(--accent);"></td>'
        +'<td><input value="'+(ex.rpe||'')+'" onchange="editEx(\''+athId+'\','+(currentWkIdx)+','+di+','+si+','+ei+',\'rpe\',this.value)" placeholder="--" style="padding:3px;font-size:10px;width:36px;text-align:center;"></td>'
        +'<td><input placeholder="e.g. 185lbs x5 RPE6" id="actual-'+currentWkIdx+'-'+di+'-'+si+'-'+ei+'" style="padding:3px;font-size:9px;width:78px;text-align:center;border-color:rgba(184,255,87,.2);color:var(--accent);" onchange="logWeekActuals(\''+athId+'\','+w.week+',\''+d.day+'-'+s.type+'-'+ei+'\',this.value)"></td>'
        +'<td><button onclick="delEx(\''+athId+'\','+(currentWkIdx)+','+di+','+si+','+ei+')" style="background:transparent;border:none;color:var(--text3);cursor:pointer;">x</button></td>'
        +'</tr>';
      }).join('')
      +'</tbody></table></div>'
      +(s.sprint?'<div style="font-size:9px;background:rgba(184,255,87,.05);border:1px solid rgba(184,255,87,.15);border-radius:var(--r);padding:6px 9px;margin-top:6px;"><span style="color:var(--accent);letter-spacing:1px;font-size:8px;">\u26a1 SPRINT</span> '+s.sprint
        +(speedT?'<div style="margin-top:5px;padding-top:5px;border-top:1px solid rgba(184,255,87,.15);color:var(--text2);">'+speedT.replace(/\n/g,'<br>')+'</div>':'')
        +'<div style="margin-top:5px;display:flex;gap:4px;align-items:center;"><input id="speedlog-'+currentWkIdx+'-'+di+'-'+si+'" placeholder="e.g. 1.82 (10yd)" style="font-size:9px;padding:3px 6px;width:110px;"><select id="speedmetric-'+currentWkIdx+'-'+di+'-'+si+'" style="font-size:9px;padding:3px;"><option value="10yd">10yd</option><option value="5-10-5">5-10-5</option><option value="40yd">40yd</option><option value="broad_jump">Broad Jump</option></select><button class="btn btn-sm" style="font-size:8px;" onclick="logSpeedActual(\''+athId+'\','+w.week+',document.getElementById(\'speedmetric-'+currentWkIdx+'-'+di+'-'+si+'\').value,document.getElementById(\'speedlog-'+currentWkIdx+'-'+di+'-'+si+'\').value)">Log</button></div></div>':'')
      +'<button class="btn btn-sm" style="margin-top:5px;font-size:8px;" onclick="addEx(\''+athId+'\','+(currentWkIdx)+','+di+','+si+')">+ Exercise</button>'
      +'</div></div>';
    }).join('')).join('')
    +'</div>';

  const isLastWk=currentWkIdx>=p.weeks_data.length-1;
  const isCurrentActiveWk=(p.currentWeek||1)-1===currentWkIdx;
  const doneBtn=isCurrentActiveWk&&!isLastWk
    ?'<button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="advanceWeek(\''+athId+'\')">\u2713 Done with Week '+w.week+' \u2014 Advance to Week '+(w.week+1)+'</button>'
    :(isLastWk&&isCurrentActiveWk?'<div style="background:rgba(184,255,87,.08);border:1px solid rgba(184,255,87,.2);border-radius:var(--r);padding:12px;text-align:center;margin-top:12px;font-size:11px;color:var(--accent);">\ud83c\udfc1 Program Complete \u2014 Run VALD Retest</div>':'');

  const complianceHtml=compliance?'<div style="font-size:9px;margin-bottom:8px;padding:6px 9px;border-radius:var(--r);background:'+(compliance.pct<70?'rgba(255,140,66,.08)':'rgba(184,255,87,.08)')+';border:1px solid '+(compliance.pct<70?'rgba(255,140,66,.25)':'rgba(184,255,87,.2)')+';color:'+(compliance.pct<70?'var(--orange)':'var(--accent)')+';">ACL/tendon compliance: '+compliance.pct+'% logged ('+compliance.logged+'/'+compliance.total+') \u2014 consistency drives the injury-risk reduction, not any single session.</div>':'';

  document.getElementById('prog-detail').innerHTML=
    '<div class="card">'
    +'<div class="card-title" style="justify-content:space-between;"><span>'+p.athName+' &mdash; '+(p.phase||p.weeks+'-Week')+'</span>'
    +'<div class="flex"><button class="btn btn-sm" onclick="aiLoads(\''+athId+'\')">\u26a1 Loads</button><button class="btn btn-sm" onclick="dlProg(\''+athId+'\')">\u2193</button><button class="btn btn-sm btn-danger" onclick="delProgram(\''+athId+'\')">\u2715</button></div></div>'
    +(p.primaryGoals?'<div style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:4px;">'+p.primaryGoals.map(g=>'<span class="flag flag-green">'+g+'</span>').join('')+'</div>':'')
    +complianceHtml
    +'<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px;">'+weekNav+'</div>'
    +'<div class="muted" style="margin-bottom:10px;">Viewing Week '+(currentWkIdx+1)+' of '+p.weeks_data.length+'. Log actuals (e.g. "185lbs x5 RPE6") in the green column \u2014 future weeks auto-adjust.</div>'
    +weeksHtml
    +doneBtn
    +'</div>';
};

const _origRenderProgramList=window.renderProgramList;
window.renderProgramList=function(){
  _origRenderProgramList.apply(this,arguments);
  const wrap=document.getElementById('prog-list'); if(!wrap)return;
  Object.keys(S.programs||{}).forEach(id=>{
    const p=S.programs[id]; const ath=S.athletes.find(a=>a.id===id); if(!ath)return;
    const card=[...wrap.children].find(c=>c.textContent.includes(p.athName)); if(!card)return;

    const incomplete=p.weeks_data&&p.weeks_data.length<p.weeks;
    const stalled=p._genState&&p._genState.stalledAt;
    let stale=false;
    if(p.valdSnapshot){try{stale=p.valdSnapshot!==JSON.stringify(getMetrics(ath));}catch(e){}}
    if(!incomplete&&!stale)return;

    const banner=document.createElement('div');
    if(incomplete){
      banner.style.cssText='margin-top:6px;padding:6px 9px;background:rgba(255,77,77,.1);border:1px solid rgba(255,77,77,.3);border-radius:4px;font-size:9px;color:var(--red);';
      banner.innerHTML='\u26a0\ufe0f Only '+p.weeks_data.length+'/'+p.weeks+' weeks built'+(stalled?' \u2014 '+p._genState.stallReason:'')+' \u2014 <a href="#" onclick="event.stopPropagation();resumeProgram(\''+id+'\');return false;" style="color:var(--red);text-decoration:underline;">Resume</a>';
    }else if(stale){
      banner.style.cssText='margin-top:6px;padding:6px 9px;background:rgba(255,140,66,.1);border:1px solid rgba(255,140,66,.3);border-radius:4px;font-size:9px;color:var(--orange);';
      banner.innerHTML='\ud83d\udd04 VALD/OHM data has changed since this program was built \u2014 <a href="#" onclick="event.stopPropagation();regenerateFromWeek(\''+id+'\','+(p.currentWeek||1)+');return false;" style="color:var(--orange);text-decoration:underline;">Regenerate remaining weeks</a>';
    }
    card.appendChild(banner);
  });
};

// ═══════════════════════ SECTION 8 — DASHBOARD, SENTINEL, TAB HOOKS ═════

function computeProgramRetestAlerts(){
  const alerts=[];
  Object.keys(S.programs||{}).forEach(id=>{
    const p=S.programs[id]; if(!p||!p.weeks_data)return;
    const cur=p.currentWeek||1;
    const curWk=p.weeks_data.find(w=>w.week===cur);
    if(curWk&&curWk.phase==='Retest')alerts.push({id,name:p.athName,week:cur,upcoming:false});
    const nextWk=p.weeks_data.find(w=>w.week===cur+1);
    if(nextWk&&nextWk.phase==='Retest')alerts.push({id,name:p.athName,week:cur+1,upcoming:true});
  });
  return alerts;
}

function _renderProgramRetestCard(){
  let card=document.getElementById('dash-prog-retest-card');
  if(!card){
    const anchor=document.getElementById('dash-retest')&&document.getElementById('dash-retest').closest('.card');
    if(!anchor||!anchor.parentElement)return;
    card=document.createElement('div'); card.className='card'; card.id='dash-prog-retest-card';
    anchor.parentElement.insertBefore(card,anchor.nextSibling);
  }
  const alerts=computeProgramRetestAlerts();
  card.innerHTML='<div class="card-title">\ud83d\udd01 Program Retests</div>'
    +(alerts.length?alerts.map(a=>'<div class="alert-row" onclick="go(\'programs\');setTimeout(()=>showProgDetail(\''+a.id+'\'),50);"><div class="alert-dot '+(a.upcoming?'orange':'red')+'"></div><div style="flex:1;"><div style="font-size:11px;">'+a.name+'</div><div class="muted">'+(a.upcoming?'Retest week '+a.week+' coming up':'Retest week '+a.week+' is THIS week')+'</div></div></div>').join('')
      :'<div class="muted">No program retest weeks due right now.</div>');
}

const _origInitDash=window.initDash;
window.initDash=function(){
  _origInitDash.apply(this,arguments);
  try{_renderProgramRetestCard();}catch(e){console.warn('retest card failed',e);}
};

function checkPatchIntegrity(){
  return[{n:'Coach OS Super Patch',ok:typeof regenerateFromWeek==='function'&&typeof computeAclCompliance==='function'&&typeof findAthleteMatch==='function'}];
}

const _origRunSentinelChecks=window.runSentinelChecks;
window.runSentinelChecks=async function(){
  const checks=await _origRunSentinelChecks.apply(this,arguments);
  checkPatchIntegrity().forEach(c=>checks.push({n:'Patch: '+c.n,ok:c.ok,info:c.ok?'Loaded':'Not detected',fix:c.ok?null:'Check the <script> tag for coach-os-super-patch.js is present and loading without a 404'}));
  checks.push({n:'Known issue: dead script reference',ok:false,info:'index.html references coachos-upgrade.js?v=3, which does not exist in the repo (confirmed 404). Harmless, but should be deleted.',fix:'Remove that <script> line from index.html'});
  return checks;
};

const _origInitSprint=window.initSprint;
window.initSprint=function(){
  _origInitSprint.apply(this,arguments);
  try{_renderOhmQuickLogSprintTab();_ensureMetricExplorerCard();renderMetricExplorer();_ensurePowerSpeedMapCard();renderPowerSpeedMap();}catch(e){console.warn('sprint tab additions failed',e);}
};

const _origShowAthDetail=window.showAthDetail;
window.showAthDetail=function(id){
  _origShowAthDetail.apply(this,arguments);
  try{_renderOhmQuickLogAthDetail(id);}catch(e){}
};

console.log('Coach OS Super Patch loaded (single file, replaces v2\u2013v6): dupe guard, OHM integration + snapshot history, metric explorer, why-explanations, evidence base, safety net, film\u2192program integration, ACL/tendon compliance, resumable generation, regenerate-forward, auto-adjust + revert, roster health audit, dashboard-program retest sync, Sentinel patch check.');
