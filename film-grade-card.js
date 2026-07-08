/* ════════════════════════════════════════════════════════════════════
   FITCLUB CT — FILM GRADE CARD (film-grade-card.js)
   Standalone lead-gen grading module. Logic only — no delivery UI yet.

   THE POINT: this deliberately returns LESS information than the real
   Film Room tool. It reuses the same age-banded angle/GCT norms Austin
   already validated in patch.js, but the public output is capped at
   a grade + one vague, honest teaser line + a CTA. No angle values, no
   phase names, no fault identification, no fix — that's the in-person
   product. This is the thing that gets them in the door for that.

   Two functions on purpose:
   - gradeInternal()  → full breakdown, staff-only, same shape as the
     real Film Room analysis. Never surface this to a prospect.
   - gradeCard()       → the public-safe wrapper. This is the only one
     that should ever touch a webpage, PDF, or QR code output.
   ════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if(window._filmGradePatched)return; window._filmGradePatched=true;

const AGE_BANDS={ youth:{lo:0,hi:14,label:'12–14'}, hs:{lo:15,hi:18,label:'15–18'}, col:{lo:19,hi:99,label:'19+'} };
function ageBand(age){ const a=parseInt(age); if(isNaN(a))return 'hs'; if(a<=14)return 'youth'; if(a<=18)return 'hs'; return 'col'; }

// Same norm tables as the live Film Room tool (patch.js) — single source
// of truth would be better long-term (import instead of duplicate), but
// keeping this file standalone on purpose since delivery isn't decided yet.
const PHASES={
  accel:{angles:[
      {k:'trunk',youth:[38,58],hs:[40,55],col:[40,52]},
      {k:'shin', youth:[38,58],hs:[40,55],col:[42,55]},
      {k:'fknee',youth:[95,125],hs:[100,120],col:[100,118]},
      {k:'rshin',youth:[28,48],hs:[30,45],col:[30,42]},
    ], gct:{youth:[0.15,0.21],hs:[0.14,0.18],col:[0.13,0.17]}},
  transition:{angles:[
      {k:'trunk',youth:[18,42],hs:[20,40],col:[22,38]},
      {k:'shin', youth:[52,78],hs:[55,75],col:[55,72]},
      {k:'fknee',youth:[105,132],hs:[110,130],col:[110,128]},
    ], gct:{youth:[0.12,0.17],hs:[0.11,0.15],col:[0.10,0.14]}},
  maxv:{angles:[
      {k:'trunk',youth:[0,15],hs:[0,12],col:[0,10]},
      {k:'thigh',youth:[50,82],hs:[55,80],col:[58,80]},
      {k:'fknee',youth:[32,58],hs:[35,55],col:[35,52]},
      {k:'shin', youth:[75,90],hs:[78,90],col:[80,90]},
    ], gct:{youth:[0.10,0.14],hs:[0.09,0.12],col:[0.08,0.11]}},
  cod:{angles:[
      {k:'plantshin',youth:[33,57],hs:[35,55],col:[35,52]},
      {k:'hip',youth:[88,122],hs:[90,120],col:[90,118]},
      {k:'trunk',youth:[8,32],hs:[10,30],col:[10,28]},
      {k:'reaccel',youth:[28,52],hs:[30,50],col:[32,50]},
    ], gct:{youth:[0.18,0.28],hs:[0.16,0.25],col:[0.15,0.23]}},
};

/* Score one angle: 1.0 fully in range, linear falloff to 0 at 25% over
   the range width outside either edge, floor 0. */
function scoreAngle(value, range){
  const [lo,hi]=range;
  if(value>=lo && value<=hi) return 1;
  const width=hi-lo;
  const dist = value<lo ? lo-value : value-hi;
  const tolerance = width*0.25;
  if(dist>=tolerance) return 0;
  return 1 - dist/tolerance;
}

function scoreGct(value, range){
  const [lo,hi]=range;
  if(value<=hi) return 1;               // faster than norm ceiling = full credit
  if(value<lo) return 1;                // (lo is the fast end here, shouldn't penalize)
  const over = value-hi;
  const tolerance = hi*0.2;
  if(over>=tolerance) return 0;
  return 1 - over/tolerance;
}

/* ── STAFF-ONLY: full breakdown, same shape as real Film Room output ── */
function gradeInternal(input){
  // input: {age, phase: 'accel'|'transition'|'maxv'|'cod', angles:{k:value}, gct: number|null}
  const band = ageBand(input.age);
  const def = PHASES[input.phase];
  if(!def) return {error:'unknown phase'};
  const scores=[];
  def.angles.forEach(a=>{
    const v=input.angles && input.angles[a.k];
    if(v==null||isNaN(v))return;
    scores.push({k:a.k, value:v, range:a[band], score:scoreAngle(v, a[band])});
  });
  let gctScore=null;
  if(input.gct!=null && !isNaN(input.gct)){
    gctScore={value:input.gct, range:def.gct[band], score:scoreGct(input.gct, def.gct[band])};
  }
  const allScores = scores.map(s=>s.score).concat(gctScore?[gctScore.score]:[]);
  const composite = allScores.length ? allScores.reduce((s,x)=>s+x,0)/allScores.length : null;
  return {band, phase:input.phase, angleScores:scores, gctScore, composite};
}

/* ── PUBLIC: grade + vague honest teaser + CTA. Nothing else. ───────── */
const GRADE_TIERS=[
  {min:0.85, grade:'A', label:'Elite for her age',
   teasers:["She's ahead of the norm for her age group — the full breakdown shows exactly where her edge is and how to protect it as she moves up levels."]},
  {min:0.65, grade:'B', label:'Above average for her age',
   teasers:["Solid mechanics overall, with one or two specific things holding back her top-end speed. A full session pinpoints exactly which phase and what to fix."]},
  {min:0.40, grade:'C', label:'Developing — room to grow',
   teasers:["A mixed picture — real strengths alongside a clear limiter in her mechanics. The full breakdown identifies which phase is costing her the most speed."]},
  {min:0,    grade:'D', label:'Needs work',
   teasers:["Multiple phases show room to improve relative to her age group. A full assessment will identify the priority fix first — not everything at once."]},
];
function pickTier(composite){
  for(const t of GRADE_TIERS) if(composite>=t.min) return t;
  return GRADE_TIERS[GRADE_TIERS.length-1];
}

function gradeCard(input){
  const full = gradeInternal(input);
  if(full.error || full.composite==null){
    return {name:input.name||null, grade:null, label:'Not enough clean film to grade yet', teaser:'', cta:'Book a Full Movement Assessment at FitClub CT'};
  }
  const tier = pickTier(full.composite);
  return {
    name: input.name || null,
    ageBandLabel: AGE_BANDS[full.band].label,
    grade: tier.grade,
    label: tier.label,
    teaser: tier.teasers[0],
    cta: 'Book a Full Movement Assessment at FitClub CT',
    signoff: 'Coach Austin C., ATC · Head Coach, FitClub CT'
    // deliberately no: phase name, angle values, angle names, GCT value, composite score
  };
}

window.FilmGradeCard = { gradeInternal, gradeCard };
console.log('Film Grade Card module loaded (grade-only public output, full breakdown staff-only via gradeInternal).');
})();
