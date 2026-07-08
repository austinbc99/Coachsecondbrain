/* ════════════════════════════════════════════════════════════════════
   FITCLUB CT — COACH OS · NORMS + DECISION ENGINE (coach-os-norms-engine.js)
   Drop-in. Loads after coach-os-super-patch.js. Wraps, does not replace.

   PURPOSE: every metric in the system (OHM, VALD, sprint) gets graded
   against something real — literature norms where they exist, this
   roster's own accumulating population where they don't — instead of
   sitting as a raw number nobody can contextualize against age.

   CONFIDENCE LEVELS (be honest about this, not just accurate-looking):
   - LIT  = sourced from published peer-reviewed data, cited inline
   - ROSTER = computed live from this gym's own logged athletes at that
     age band. Requires n>=3 in-band before it will grade anyone — below
     that it says so instead of faking precision.
   ════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if(window._normsPatched)return; window._normsPatched=true;

/* ── AGE BANDS — matches Film Room's existing youth/hs/col bands ───── */
const NE_BANDS={
  y1:{lo:0, hi:14, label:'12-14'},
  y2:{lo:15,hi:19, label:'15-19'},
  col:{lo:20,hi:99,label:'Collegiate+'}
};
function neBand(age){
  const a=parseInt(age); if(isNaN(a))return 'y2';
  if(a<=14)return 'y1'; if(a<=19)return 'y2'; return 'col';
}

/* ── LITERATURE NORMS ────────────────────────────────────────────────
   CMJ peak power, W/kg, female youth soccer (directly matches Austin's
   population — lacrosse athletes track closely to soccer here).
   Source: age-related jumping performance in youth elite female soccer
   players — peak power CMJ by age tercile (Van Praagh/youth-power lit,
   consistent with Barretto et al. 2026 JSCR phase-banding for elite
   female youth soccer force-plate data).
   9-11y: 44.7±5.5 · 12-14y: 50±7 · 15-19y: 57±7 (W/kg)             */
const LIT_CMJ_POWER_WKG={
  y1:{mean:50, sd:7, n:'lit', src:'youth elite female soccer, 12-14y'},
  y2:{mean:57, sd:7, n:'lit', src:'youth elite female soccer, 15-19y'},
  col:{mean:57, sd:8, n:'lit', src:'no clean published collegiate female tercile — treat as floor, roster will refine'}
};

/* No equally clean sex-specific youth norm exists yet for RSI, 10yd
   sprint, or 505 in the literature search — those stay roster-only
   until a better source is found. Do not fabricate numbers for them. */
const LIT_UNAVAILABLE=['rsi','sprint10','agility505','ohm'];

/* ── ROSTER BASELINE ENGINE ──────────────────────────────────────────
   Pulls every athlete in S.athletes with a value for the given metric
   + a known age, buckets by band, returns mean/sd/n. Below n=3 in a
   band, refuses to grade rather than pretend precision. */
function neCollectRoster(metricGetter){
  const buckets={y1:[],y2:[],col:[]};
  (window.S && S.athletes || []).forEach(a=>{
    const v=metricGetter(a);
    if(v==null||isNaN(v))return;
    const b=neBand(a.age);
    buckets[b].push(v);
  });
  const out={};
  Object.keys(buckets).forEach(b=>{
    const arr=buckets[b];
    if(arr.length<3){out[b]={n:arr.length,insufficient:true};return;}
    const mean=arr.reduce((s,x)=>s+x,0)/arr.length;
    const sd=Math.sqrt(arr.reduce((s,x)=>s+(x-mean)*(x-mean),0)/arr.length)||0.0001;
    out[b]={mean,sd,n:arr.length,src:'roster ('+arr.length+' athletes)'};
  });
  return out;
}

// Metric getters — pull from the athlete object shape already used across
// Coach OS (vald.cmj, vald.rsi, OHM session log, sprint actual log)
function neOhmWatts(level){
  return a=>{
    const sess=(a.ohm||[]).filter(s=>String(s.level)===String(level));
    if(!sess.length)return null;
    return sess.reduce((s,x)=>s+(parseFloat(x.avg)||0),0)/sess.length;
  };
}
function neRsi(a){ return a.vald&&a.vald.rsi!=null ? parseFloat(a.vald.rsi) : null; }
function neSprint10(a){ return a.sprint&&a.sprint.t10!=null ? parseFloat(a.sprint.t10) : null; }
function neAgility(a){ return a.sprint&&a.sprint.agility!=null ? parseFloat(a.sprint.agility) : null; }

/* ── GRADING CORE ────────────────────────────────────────────────────
   Z-score → approximate percentile → band label. lowerIsBetter flips
   the sign for time-based metrics (sprint, 505) where less = faster. */
function neZtoPct(z){
  // Abramowitz-Stegun normal CDF approximation, no external lib needed
  const t=1/(1+0.2316419*Math.abs(z));
  const d=0.3989423*Math.exp(-z*z/2);
  let p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));
  p = z>0 ? 1-p : p;
  return Math.round(p*100);
}
function neGrade(value, ref, lowerIsBetter){
  if(!ref || ref.insufficient) return {status:'insufficient', label:ref?('need '+(3-ref.n)+' more logged in this age band before grading'):'no reference'};
  let z=(value-ref.mean)/(ref.sd||0.0001);
  if(lowerIsBetter)z=-z;
  const pct=neZtoPct(z);
  let band;
  if(pct<25)band='below age norm';
  else if(pct<45)band='low-average for age';
  else if(pct<65)band='average for age';
  else if(pct<85)band='above age norm';
  else band='elite for age';
  return {status:'graded', z:Math.round(z*100)/100, pct, band, src:ref.src};
}

/* ── DECISION LAYER ──────────────────────────────────────────────────
   Turns a grade into bucket + action, same pattern Film Room already
   uses for Spellman fault→cue matching. This is the piece that makes
   a graded number turn into "what do I do Monday." */
function neDecision(metricKey, grade){
  if(grade.status!=='graded') return {bucket:'no-data', action:grade.label};
  const low = grade.pct<45;
  const high = grade.pct>=85;
  const map={
    cmj_power:{
      low:{bucket:'force/power hole', action:'prioritize triphasic loading + ballistic transfer before adding more sprint volume — she can\'t express power she doesn\'t have yet.'},
      mid:{bucket:'on-track', action:'maintain current block ratio; retest in 6wk to confirm trajectory.'},
      high:{bucket:'velocity-capable', action:'safe to load reactive/plyo volume up; her power ceiling supports it.'}
    },
    ohm_watts:{
      low:{bucket:'engine gap for age', action:'this OHM level is underloaded relative to her age band — build base here before progressing resistance.'},
      mid:{bucket:'on-track', action:'progress load per standard block progression.'},
      high:{bucket:'ahead of age band', action:'consider progressing to next OHM level sooner than the standard timeline.'}
    },
    rsi:{
      low:{bucket:'reactive strength deficit', action:'isometric + stiffness work (Natera-style) before more plyo volume — ground contact quality is the limiter, not effort.'},
      mid:{bucket:'on-track', action:'maintain current reactive work.'},
      high:{bucket:'elastic', action:'she can handle higher-intensity plyo and short-contact speed work.'}
    },
    sprint10:{
      low:{bucket:'accel deficit for age', action:'early acceleration mechanics + force application — drive phase work before max-V.'},
      mid:{bucket:'on-track', action:'standard speed block progression.'},
      high:{bucket:'ahead of age band', action:'she\'s beating her age norm — protect this with recovery, don\'t just keep adding volume.'}
    }
  };
  const m=map[metricKey]; if(!m) return {bucket:'ungraded metric', action:''};
  const tier = low?'low':(high?'high':'mid');
  return m[tier];
}

/* ── PUBLIC API — wire this into dashboard cards, intake debriefs,
   and the program-gen why-field prompt context ─────────────────── */
window.NormsEngine={
  band: neBand,
  gradeCmjPower(value, age){
    const ref = LIT_CMJ_POWER_WKG[neBand(age)];
    const g = neGrade(value, ref, false);
    return Object.assign({}, g, neDecision('cmj_power', g), {confidence:'literature', source:ref.src});
  },
  gradeOhmWatts(value, age, level){
    const roster = neCollectRoster(neOhmWatts(level));
    const ref = roster[neBand(age)];
    const g = neGrade(value, ref, false);
    return Object.assign({}, g, neDecision('ohm_watts', g), {confidence:'roster', source:ref&&ref.src});
  },
  gradeRsi(value, age){
    const roster = neCollectRoster(neRsi);
    const ref = roster[neBand(age)];
    const g = neGrade(value, ref, false);
    return Object.assign({}, g, neDecision('rsi', g), {confidence:'roster', source:ref&&ref.src});
  },
  gradeSprint10(value, age){
    const roster = neCollectRoster(neSprint10);
    const ref = roster[neBand(age)];
    const g = neGrade(value, ref, true); // lower time = better
    return Object.assign({}, g, neDecision('sprint10', g), {confidence:'roster', source:ref&&ref.src});
  },
  gradeAgility505(value, age){
    const roster = neCollectRoster(neAgility);
    const ref = roster[neBand(age)];
    const g = neGrade(value, ref, true);
    return Object.assign({}, g, {}, {confidence:'roster', source:ref&&ref.src});
  },
  rosterStatus(){
    // quick diagnostic: how much roster data exists per band per metric
    const metrics={ohm4:neOhmWatts(4),ohm6:neOhmWatts(6),ohm8:neOhmWatts(8),rsi:neRsi,sprint10:neSprint10,agility505:neAgility};
    const out={};
    Object.keys(metrics).forEach(k=>{ out[k]=neCollectRoster(metrics[k]); });
    return out;
  }
};

console.log('Coach OS Norms Engine loaded: literature CMJ norms + roster-baseline OHM/RSI/sprint, z-score grading, decision-layer bucketing.');
})();
