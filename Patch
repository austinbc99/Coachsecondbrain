/* ════════════════════════════════════════════════════════════════════
   FITCLUB CT — COACH OS · FILM ROOM UPGRADE (patch.js)
   Drop-in. Loads after the main script, wraps the Film Room without
   touching the original. Adds: Spellman phase model + youth norms,
   on-frame angle measurement rig (+ MoveNet auto-pose), frame-to-frame
   temporal metrics (GCT / flight / step rate / velocity), and scale
   calibration. Every block is defensive — a failure never breaks Film.
   ════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if(window._vlPatched)return; window._vlPatched=true;

/* ── NORMS: phase × age band (side view, sagittal) ──────────────────
   Angle bands in degrees. GCT in seconds. RF/DRF = Spellman ratio-of-
   force benchmarks (referenced in the read even if not film-measurable).
   Age bands widen youth ranges — a 13yo isn't graded to an NFL baseline. */
const AGE_BANDS={ youth:{lo:0,hi:14,label:'Youth 12–14'}, hs:{lo:15,hi:18,label:'HS 15–18'}, col:{lo:19,hi:99,label:'Collegiate+'} };
function ageBand(age){ const a=parseInt(age); if(isNaN(a))return 'hs'; if(a<=14)return 'youth'; if(a<=18)return 'hs'; return 'col'; }

const PHASES={
  accel:{name:'Early Accel',desc:'0–10y · drive',
    blurb:'Drive phase. Big horizontal push, positive shin, body leaning. Ratio of Force is the headline.',
    angles:[
      {k:'trunk',label:'Trunk lean (vs vertical)',youth:[38,58],hs:[40,55],col:[40,52],note:'forward lean'},
      {k:'shin', label:'Front shin (vs ground)',  youth:[38,58],hs:[40,55],col:[42,55],note:'positive, angled fwd'},
      {k:'fknee',label:'Front knee @ contact',    youth:[95,125],hs:[100,120],col:[100,118]},
      {k:'rshin',label:'Rear shin @ toe-off',     youth:[28,48],hs:[30,45],col:[30,42]},
    ],
    gct:{youth:[0.15,0.21],hs:[0.14,0.18],col:[0.13,0.17]},
    rf:'<50% bad · 50–55 solid · 55–60 good · >60 outstanding',
  },
  transition:{name:'Transition',desc:'10–20y · black hole',
    blurb:'Where most athletes leak time — they rise and bail on horizontal force early. DRF is the headline.',
    angles:[
      {k:'trunk',label:'Trunk lean (rising)',youth:[18,42],hs:[20,40],col:[22,38],note:'gradual rise'},
      {k:'shin', label:'Shin @ contact',youth:[52,78],hs:[55,75],col:[55,72]},
      {k:'fknee',label:'Front knee @ contact',youth:[105,132],hs:[110,130],col:[110,128]},
    ],
    gct:{youth:[0.12,0.17],hs:[0.11,0.15],col:[0.10,0.14]},
    rf:'DRF: ≥10% poor · 9 ok · 8 solid · 7 good',
  },
  maxv:{name:'Max Velocity',desc:'upright · elastic',
    blurb:'Tall posture, front-side mechanics, short contacts. Kickback (step-over vs back-side) + GCT are the read.',
    angles:[
      {k:'trunk',label:'Trunk (near vertical)',youth:[0,15],hs:[0,12],col:[0,10],note:'slight lean ok'},
      {k:'thigh',label:'Thigh separation',youth:[50,82],hs:[55,80],col:[58,80]},
      {k:'fknee',label:'Front knee @ recovery',youth:[32,58],hs:[35,55],col:[35,52],note:'tight heel recovery'},
      {k:'shin', label:'Shin @ touchdown',youth:[75,90],hs:[78,90],col:[80,90],note:'near-vertical, under hip'},
    ],
    gct:{youth:[0.10,0.14],hs:[0.09,0.12],col:[0.08,0.11]},
    rf:'GCT and front-side recovery are the keys at top speed',
  },
  cod:{name:'COD',desc:'plant · re-accel',
    blurb:'Field-sport cut. Penultimate prep, hip-dominant plant, trunk over plant leg, fast re-accel angle.',
    angles:[
      {k:'plantshin',label:'Plant shin (lateral)',youth:[33,57],hs:[35,55],col:[35,52]},
      {k:'hip',label:'Hip/knee flexion (load)',youth:[88,122],hs:[90,120],col:[90,118]},
      {k:'trunk',label:'Trunk over plant',youth:[8,32],hs:[10,30],col:[10,28],note:'controlled'},
      {k:'reaccel',label:'Re-accel trunk lean',youth:[28,52],hs:[30,50],col:[32,50]},
    ],
    gct:{youth:[0.18,0.28],hs:[0.16,0.25],col:[0.15,0.23]},
    rf:'Penultimate-step braking + plant quality drive the cut',
  },
};
function normRange(def,band){ return def[band]||def.hs; }

/* Bucket + cue (Spellman 2-series force / 1-series reactivity) */
const BUCKETS={
  force:{label:'2',cls:'force',title:'Force-deficient',desc:'Low ratio of force / F0 — horizontal strength. Heavy resisted, early-accel emphasis.',cues:['Push','Project','Drive']},
  react:{label:'1',cls:'react',title:'Reactivity-deficient',desc:'Poor DRF / RSI — bails on horizontal force at speed. Light resisted, velocity + reactive plyo.',cues:['Pop','Punch','Spring']},
};

/* ── STATE ─────────────────────────────────────────────────────────── */
const VL={ phase:'accel', age:'hs', frameIdx:0, angles:{}, rig:null, rigImg:null, drag:null,
  showLbls:true, leadFront:true, pxPerYd:null, scaleMode:false, scalePts:[],
  events:[], foot:'R', temporal:null };

/* ── geometry ──────────────────────────────────────────────────────── */
function angABC(a,v,b){const v1=Math.atan2(a.y-v.y,a.x-v.x),v2=Math.atan2(b.y-v.y,b.x-v.x);let d=Math.abs(v1-v2)*180/Math.PI;if(d>180)d=360-d;return d;}
function angVsVert(p1,p2){return Math.abs(Math.atan2(p2.x-p1.x,-(p2.y-p1.y))*180/Math.PI);}
function angVsHoriz(p1,p2){return Math.atan2(Math.abs(p2.y-p1.y),Math.abs(p2.x-p1.x))*180/Math.PI;}

const RIG_DEFAULT={ear:[.52,.16],shoulder:[.50,.24],hip:[.47,.45],kneeF:[.58,.60],ankleF:[.66,.74],toeF:[.72,.78],kneeR:[.38,.62],ankleR:[.30,.74],toeR:[.24,.78]};
const RIG_BONES=[['ear','shoulder'],['shoulder','hip'],['hip','kneeF'],['kneeF','ankleF'],['ankleF','toeF'],['hip','kneeR'],['kneeR','ankleR'],['ankleR','toeR']];
const ANGLE_DEFS=[
  {key:'trunk',label:'Trunk',type:'vert',pts:['hip','shoulder'],phase:['trunk','reaccel']},
  {key:'hipF',label:'Hip',type:'abc',pts:['shoulder','hip','kneeF'],phase:['hip']},
  {key:'fknee',label:'Front knee',type:'abc',pts:['hip','kneeF','ankleF'],phase:['fknee']},
  {key:'fshin',label:'Front shin',type:'horiz',pts:['kneeF','ankleF'],phase:['shin','plantshin']},
  {key:'rknee',label:'Rear knee',type:'abc',pts:['hip','kneeR','ankleR'],phase:[]},
  {key:'rshin',label:'Rear shin',type:'horiz',pts:['kneeR','ankleR'],phase:['rshin']},
  {key:'thighsep',label:'Thigh sep',type:'sep',pts:['kneeF','hip','kneeR'],phase:['thigh']},
];
const STC={good:'#b8ff57',warn:'#fbbf24',bad:'#ff4d4d',na:'#888'};

window.VL_DEBUG=VL; // expose for testing

/* ── UI INJECTION ──────────────────────────────────────────────────── */
function injectUI(){
  const film=document.getElementById('pg-film'); if(!film||document.getElementById('vlp-card'))return;
  const opts=document.getElementById('film-opts');
  const card=document.createElement('div'); card.className='card'; card.id='vlp-card';
  card.style.cssText='border-color:rgba(184,255,87,.25)';
  card.innerHTML=
   '<div class="card-title" style="justify-content:space-between"><span>⚡ Speed Lab — phase · angles · timing</span><span class="muted" id="vlp-scale-tag">scale: not set</span></div>'
   +'<div class="g2"><div class="fg"><label>Phase</label><select id="vlp-phase" onchange="vlSetPhase(this.value)">'
     +Object.entries(PHASES).map(([k,p])=>`<option value="${k}">${p.name} · ${p.desc}</option>`).join('')+'</select></div>'
   +'<div class="fg"><label>Age band</label><select id="vlp-age" onchange="vlSetAge(this.value)">'
     +Object.entries(AGE_BANDS).map(([k,b])=>`<option value="${k}"${k==='hs'?' selected':''}>${b.label}</option>`).join('')+'</select></div></div>'
   +'<div class="muted" id="vlp-blurb" style="margin:-4px 0 10px"></div>'
   +'<div style="border-top:1px solid var(--border);padding-top:10px"><div class="card-title" style="margin-bottom:7px">📐 Angles — measure on a frame</div>'
   +'<div class="flex" style="flex-wrap:wrap;gap:6px"><select id="vlp-frame" style="flex:1;min-width:120px"></select>'
   +'<button class="btn btn-sm btn-primary" onclick="vlOpenRig()">Measure</button>'
   +'<button class="btn btn-sm" onclick="vlAutoPose()">⦿ Auto-detect</button></div>'
   +'<div id="vlp-angread" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px"></div></div>'
   +'<div style="border-top:1px solid var(--border);padding-top:10px;margin-top:10px"><div class="card-title" style="margin-bottom:7px">📏 Scale</div>'
   +'<div class="flex" style="flex-wrap:wrap;gap:6px"><button class="btn btn-sm" id="vlp-scale-btn" onclick="vlStartScale()">Set scale</button>'
   +'<input id="vlp-scale-yd" type="number" step="0.1" value="10" style="width:70px" title="known distance (yd)"><span class="muted">yd reference</span></div></div>'
   +'<div style="border-top:1px solid var(--border);padding-top:10px;margin-top:10px"><div class="card-title" style="margin-bottom:7px">⏱ Timing — tag from the scrubber</div>'
   +'<div class="flex" style="flex-wrap:wrap;gap:6px">'
   +'<button class="btn btn-sm" id="vlp-foot" onclick="vlToggleFoot()">Foot: R</button>'
   +'<button class="btn btn-sm btn-primary" onclick="vlTagEvent(\'TD\')">Touchdown</button>'
   +'<button class="btn btn-sm" onclick="vlTagEvent(\'TO\')">Toe-off</button>'
   +'<button class="btn btn-sm" onclick="vlComputeTemporal()">Compute</button>'
   +'<button class="btn btn-sm" onclick="vlResetEvents()">Reset</button></div>'
   +'<div id="vlp-events" class="muted" style="margin-top:7px"></div>'
   +'<div id="vlp-temporal" style="margin-top:7px"></div></div>';
  if(opts&&opts.parentNode) opts.parentNode.insertBefore(card,opts.nextSibling);
  else film.querySelector('.g2 > div').appendChild(card);

  // rig overlay card (hidden until Measure)
  const rc=document.createElement('div'); rc.className='card'; rc.id='vlp-rigcard'; rc.style.display='none';
  rc.innerHTML='<div class="card-title" style="justify-content:space-between"><span>📐 Angle rig — drag joints onto the body</span>'
   +'<button class="btn btn-sm" onclick="vlCloseRig()">Done ✓</button></div>'
   +'<canvas id="vlp-canvas" style="width:100%;display:block;border-radius:var(--r);background:#000;touch-action:none"></canvas>'
   +'<div class="flex" style="flex-wrap:wrap;gap:6px;margin-top:8px">'
   +'<button class="btn btn-sm" onclick="vlPlaceRig()">⟲ Reset rig</button>'
   +'<button class="btn btn-sm" id="vlp-legbtn" onclick="vlFlipLeg()">Lead: front</button>'
   +'<button class="btn btn-sm btn-primary" onclick="vlPushAngles()">↑ Push to analysis</button></div>'
   +'<div id="vlp-rigread" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px"></div>';
  card.parentNode.insertBefore(rc,card.nextSibling);
  vlSetPhase(VL.phase);
}

/* wrap initFilm so the page nav refreshes our panel too */
const _origInitFilm=window.initFilm;
window.initFilm=function(){ try{ if(_origInitFilm)_origInitFilm.apply(this,arguments); }catch(e){} try{ injectUI(); vlRefreshFrames(); }catch(e){console.warn('VL init',e);} };

/* wrap vidCapture so new frames flow into our frame picker */
const _origVidCapture=window.vidCapture;
window.vidCapture=function(){ try{ if(_origVidCapture)_origVidCapture.apply(this,arguments); }catch(e){} try{ vlRefreshFrames(); }catch(e){} };

function vlRefreshFrames(){
  const sel=document.getElementById('vlp-frame'); if(!sel)return;
  const imgs=_filmImgs||[];
  sel.innerHTML=imgs.length?imgs.map((f,i)=>`<option value="${i}">Frame ${i+1}${f.timestamp?' @ '+f.timestamp+'s':''}</option>`).join(''):'<option value="">— capture a frame first —</option>';
}

window.vlSetPhase=function(k){ VL.phase=k; VL.angles={}; const b=document.getElementById('vlp-blurb'); if(b)b.textContent=PHASES[k].blurb; renderAngRead('vlp-angread'); };
window.vlSetAge=function(k){ VL.age=k; renderAngRead('vlp-angread'); if(document.getElementById('vlp-rigcard').style.display!=='none')drawRig(); };
window.vlToggleFoot=function(){ VL.foot=VL.foot==='R'?'L':'R'; document.getElementById('vlp-foot').textContent='Foot: '+VL.foot; };

/* ── SCALE CALIBRATION ─────────────────────────────────────────────── */
window.vlStartScale=function(){
  const imgs=_filmImgs||[]; const idx=parseInt(document.getElementById('vlp-frame').value)||0;
  if(!imgs[idx]){toast('Capture a frame first');return;}
  VL.scaleMode=true; VL.scalePts=[]; VL.frameIdx=idx;
  openCanvasWith(imgs[idx].dataUrl,()=>{ toast('Tap 2 points a known distance apart'); });
  document.getElementById('vlp-rigcard').querySelector('.card-title span').textContent='📏 Scale — tap two points '+(document.getElementById('vlp-scale-yd').value||10)+' yd apart';
};
function finishScale(){
  if(VL.scalePts.length<2)return;
  const [a,b]=VL.scalePts; const px=Math.hypot(a.x-b.x,a.y-b.y);
  const yd=parseFloat(document.getElementById('vlp-scale-yd').value)||10;
  VL.pxPerYd=px/yd; VL.scaleMode=false;
  document.getElementById('vlp-scale-tag').textContent='scale: '+VL.pxPerYd.toFixed(1)+' px/yd';
  toast('Scale set'); vlCloseRig();
}

/* ── CANVAS + RIG ──────────────────────────────────────────────────── */
function openCanvasWith(dataUrl,cb){
  const rc=document.getElementById('vlp-rigcard'), cv=document.getElementById('vlp-canvas');
  const img=new Image();
  img.onload=()=>{ cv.width=img.width; cv.height=img.height; VL.rigImg=img;
    cv.getContext('2d').drawImage(img,0,0); rc.style.display='block';
    rc.scrollIntoView({behavior:'smooth',block:'center'}); if(cb)cb(); };
  img.onerror=()=>{ toast('Frame not loadable'); };
  img.src=dataUrl;
}
window.vlOpenRig=function(){
  const imgs=_filmImgs||[]; const idx=parseInt(document.getElementById('vlp-frame').value)||0;
  if(!imgs[idx]){toast('Capture a frame first');return;}
  VL.frameIdx=idx; VL.scaleMode=false;
  document.getElementById('vlp-rigcard').querySelector('.card-title span').textContent='📐 Angle rig — drag joints onto the body';
  openCanvasWith(imgs[idx].dataUrl,()=>{ if(!imgs[idx].rig)vlPlaceRig(); else { VL.rig=imgs[idx].rig; drawRig(); } });
};
window.vlCloseRig=function(){ document.getElementById('vlp-rigcard').style.display='none'; };
window.vlPlaceRig=function(){
  const cv=document.getElementById('vlp-canvas'); VL.rig={};
  for(const k in RIG_DEFAULT) VL.rig[k]={x:RIG_DEFAULT[k][0]*cv.width,y:RIG_DEFAULT[k][1]*cv.height};
  const imgs=_filmImgs||[]; if(imgs[VL.frameIdx])imgs[VL.frameIdx].rig=VL.rig; drawRig();
};
window.vlFlipLeg=function(){ VL.leadFront=!VL.leadFront;
  ['kneeF','ankleF','toeF'].forEach((f,i)=>{const r=['kneeR','ankleR','toeR'][i];const t=VL.rig[f];VL.rig[f]=VL.rig[r];VL.rig[r]=t;});
  document.getElementById('vlp-legbtn').textContent='Lead: '+(VL.leadFront?'front':'rear'); drawRig(); };

function measureAngle(def){ const P=n=>VL.rig[n];
  if(def.type==='abc'||def.type==='sep')return angABC(P(def.pts[0]),P(def.pts[1]),P(def.pts[2]));
  if(def.type==='vert')return angVsVert(P(def.pts[0]),P(def.pts[1]));
  if(def.type==='horiz')return angVsHoriz(P(def.pts[0]),P(def.pts[1]));
  return 0; }
function angStatusFor(def,v){
  const pk=def.phase.find(k=>PHASES[VL.phase].angles.some(a=>a.k===k));
  if(!pk)return{st:'na',norm:null};
  const nd=PHASES[VL.phase].angles.find(a=>a.k===pk); const[lo,hi]=normRange(nd,VL.age);
  const tol=(hi-lo)*0.25; let st='bad'; if(v>=lo&&v<=hi)st='good'; else if(v>=lo-tol&&v<=hi+tol)st='warn';
  return{st,norm:lo+'–'+hi+'°'};
}
function drawRig(){
  if(!VL.rig||!VL.rigImg)return;
  const cv=document.getElementById('vlp-canvas'),ctx=cv.getContext('2d');
  ctx.drawImage(VL.rigImg,0,0);
  const jr=Math.max(7,cv.width/120),lw=Math.max(3,cv.width/300);
  ctx.strokeStyle='rgba(184,255,87,.9)';ctx.lineWidth=lw;ctx.lineCap='round';
  RIG_BONES.forEach(([a,b])=>{ctx.beginPath();ctx.moveTo(VL.rig[a].x,VL.rig[a].y);ctx.lineTo(VL.rig[b].x,VL.rig[b].y);ctx.stroke();});
  if(VL.showLbls){ const fs=Math.max(15,cv.width/45);
    ANGLE_DEFS.forEach(def=>{ const v=measureAngle(def),{st}=angStatusFor(def,v);
      const vx=def.type==='abc'||def.type==='sep'?VL.rig[def.pts[1]]:{x:(VL.rig[def.pts[0]].x+VL.rig[def.pts[1]].x)/2,y:(VL.rig[def.pts[0]].y+VL.rig[def.pts[1]].y)/2};
      const txt=Math.round(v)+'°'; ctx.font='700 '+fs+"px ui-monospace,monospace"; const w=ctx.measureText(txt).width;
      ctx.fillStyle='rgba(0,0,0,.62)'; rr(ctx,vx.x+jr,vx.y-fs*0.9,w+10,fs+6,5); ctx.fill();
      ctx.fillStyle=STC[st]; ctx.fillText(txt,vx.x+jr+5,vx.y+fs*0.18); }); }
  for(const k in VL.rig){ ctx.fillStyle='#090909';ctx.beginPath();ctx.arc(VL.rig[k].x,VL.rig[k].y,jr,0,7);ctx.fill();
    ctx.fillStyle='#b8ff57';ctx.beginPath();ctx.arc(VL.rig[k].x,VL.rig[k].y,jr*0.55,0,7);ctx.fill(); }
  renderAngRead('vlp-rigread');
}
function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

function renderAngRead(elId){
  const el=document.getElementById(elId); if(!el)return;
  if(!VL.rig && elId==='vlp-angread' && Object.keys(VL.angles).length===0){ el.innerHTML='<span class="muted">Measure a frame to read all angles</span>'; return; }
  const src=VL.rig?ANGLE_DEFS.map(d=>({def:d,v:measureAngle(d)})):ANGLE_DEFS.filter(d=>VL.angles[d.key]!=null).map(d=>({def:d,v:VL.angles[d.key]}));
  if(!src.length){ el.innerHTML='<span class="muted">Measure a frame to read all angles</span>'; return; }
  el.innerHTML=src.map(({def,v})=>{const{st}=angStatusFor(def,v);
    return `<span style="display:inline-flex;gap:5px;align-items:center;background:var(--bg3);border:1px solid ${st==='na'?'var(--border)':STC[st]+'66'};border-radius:8px;padding:4px 8px;font-size:10px"><span class="muted">${def.label}</span><b style="color:${STC[st]}">${Math.round(v)}°</b></span>`;
  }).join('');
}
window.vlPushAngles=function(){
  if(!VL.rig){toast('Measure a frame first');return;}
  ANGLE_DEFS.forEach(d=>{ VL.angles[d.key]=Math.round(measureAngle(d)); });
  renderAngRead('vlp-angread'); toast('Angles pushed to analysis'); vlCloseRig();
};

/* canvas pointer: drag joints OR place scale points */
(function bindCanvas(){
  function bind(){ const cv=document.getElementById('vlp-canvas'); if(!cv||cv._vlBound)return; cv._vlBound=true;
    function pt(e){const r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)*(cv.width/r.width),y:(e.clientY-r.top)*(cv.height/r.height)};}
    function pick(p){let best=null,bd=cv.width*0.07;for(const k in VL.rig){const d=Math.hypot(VL.rig[k].x-p.x,VL.rig[k].y-p.y);if(d<bd){bd=d;best=k;}}return best;}
    cv.addEventListener('pointerdown',e=>{ e.preventDefault();
      if(VL.scaleMode){ const p=pt(e); VL.scalePts.push(p); const ctx=cv.getContext('2d');
        ctx.fillStyle='#b8ff57';ctx.beginPath();ctx.arc(p.x,p.y,Math.max(5,cv.width/120),0,7);ctx.fill();
        if(VL.scalePts.length===2){const[a,b]=VL.scalePts;ctx.strokeStyle='#b8ff57';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();setTimeout(finishScale,200);} return; }
      if(!VL.rig)return; VL.drag=pick(pt(e)); if(VL.drag)cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove',e=>{ if(!VL.drag)return; e.preventDefault(); VL.rig[VL.drag]=pt(e);
      const imgs=_filmImgs||[]; if(imgs[VL.frameIdx])imgs[VL.frameIdx].rig=VL.rig; drawRig(); });
    cv.addEventListener('pointerup',()=>{VL.drag=null;});
    cv.addEventListener('pointercancel',()=>{VL.drag=null;});
  }
  const t=setInterval(()=>{ if(document.getElementById('vlp-canvas')){bind();} },400);
  setTimeout(()=>clearInterval(t),8000);
})();

/* ── AUTO-POSE (MoveNet, lazy CDN, graceful fallback to manual rig) ─── */
let _tfReady=null;
function loadTF(){
  if(_tfReady)return _tfReady;
  _tfReady=new Promise((res,rej)=>{
    const add=(src,ok)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>rej(new Error('cdn'));document.head.appendChild(s);};
    add('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js',()=>{
      add('https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js',res);
    });
  });
  return _tfReady;
}
window.vlAutoPose=async function(){
  const imgs=_filmImgs||[]; const idx=parseInt(document.getElementById('vlp-frame').value)||0;
  if(!imgs[idx]){toast('Capture a frame first');return;}
  VL.frameIdx=idx;
  toast('Loading detector…');
  try{
    await loadTF();
    const det=await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet,{modelType:'SinglePose.Lightning'});
    const img=new Image(); await new Promise((r,j)=>{img.onload=r;img.onerror=j;img.src=imgs[idx].dataUrl;});
    const poses=await det.estimatePoses(img);
    if(!poses||!poses.length)throw new Error('no pose');
    const kp={}; poses[0].keypoints.forEach(p=>kp[p.name]=p);
    const g=(n,fb)=>kp[n]&&kp[n].score>0.2?{x:kp[n].x,y:kp[n].y}:fb;
    // open canvas then map keypoints to rig (left side = lead by default)
    openCanvasWith(imgs[idx].dataUrl,()=>{
      const cv=document.getElementById('vlp-canvas');
      const mid=(a,b)=>a&&b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2}:(a||b);
      const ls=g('left_shoulder'),rs=g('right_shoulder'),lh=g('left_hip'),rh=g('right_hip');
      const sh=mid(ls,rs)||{x:cv.width*.5,y:cv.height*.24}, hp=mid(lh,rh)||{x:cv.width*.47,y:cv.height*.45};
      const ear=g('nose',{x:sh.x,y:sh.y-cv.height*.08});
      VL.rig={ ear, shoulder:sh, hip:hp,
        kneeF:g('left_knee',{x:hp.x+cv.width*.1,y:hp.y+cv.height*.15}), ankleF:g('left_ankle',{x:hp.x+cv.width*.18,y:hp.y+cv.height*.3}),
        kneeR:g('right_knee',{x:hp.x-cv.width*.1,y:hp.y+cv.height*.16}), ankleR:g('right_ankle',{x:hp.x-cv.width*.18,y:hp.y+cv.height*.3}) };
      // estimate toes by extending shin direction
      const toe=(kn,an)=>({x:an.x+(an.x-kn.x)*0.4+(cv.width*.04),y:an.y+(an.y-kn.y)*0.2});
      VL.rig.toeF=toe(VL.rig.kneeF,VL.rig.ankleF); VL.rig.toeR=toe(VL.rig.kneeR,VL.rig.ankleR);
      imgs[idx].rig=VL.rig; drawRig(); toast('Pose detected — nudge any joint to refine');
    });
  }catch(e){
    console.warn('autopose',e); toast('Auto-detect unavailable — placing manual rig');
    vlOpenRig();
  }
};

/* ── TEMPORAL ENGINE ───────────────────────────────────────────────── */
function vidNow(){ const v=document.getElementById('film-video'); return v&&!isNaN(v.currentTime)?v.currentTime:null; }
window.vlTagEvent=function(type){
  const t=vidNow();
  if(t===null){toast('Load a video and scrub to the moment first');return;}
  VL.events.push({type,foot:VL.foot,t:+t.toFixed(3)});
  VL.events.sort((a,b)=>a.t-b.t);
  renderEvents();
};
window.vlResetEvents=function(){ VL.events=[]; VL.temporal=null; renderEvents(); document.getElementById('vlp-temporal').innerHTML=''; };
function renderEvents(){
  const el=document.getElementById('vlp-events'); if(!el)return;
  if(!VL.events.length){el.innerHTML='Scrub to each contact: tap Touchdown then Toe-off (toggle foot per step).';return;}
  el.innerHTML='Events: '+VL.events.map(e=>`<span style="color:${e.type==='TD'?'var(--accent)':'var(--blue)'}">${e.foot}·${e.type}@${e.t}s</span>`).join('  ');
}
window.vlComputeTemporal=function(){
  if(VL.events.length<2){toast('Tag at least one touchdown + toe-off');return;}
  const ev=VL.events.slice().sort((a,b)=>a.t-b.t);
  const contacts=[]; // {foot, td, to, gct}
  for(let i=0;i<ev.length;i++){ if(ev[i].type==='TD'){ const to=ev.find((x,j)=>j>i&&x.type==='TO'&&x.foot===ev[i].foot); if(to)contacts.push({foot:ev[i].foot,td:ev[i].t,to:to.t,gct:+(to.t-ev[i].t).toFixed(3)}); } }
  const tds=ev.filter(e=>e.type==='TD').map(e=>e.t);
  const flights=[]; for(let i=0;i<ev.length;i++){ if(ev[i].type==='TO'){ const nextTD=ev.find((x,j)=>j>i&&x.type==='TD'); if(nextTD)flights.push(+(nextTD.t-ev[i].t).toFixed(3)); } }
  const stepTimes=[]; for(let i=1;i<tds.length;i++)stepTimes.push(+(tds[i]-tds[i-1]).toFixed(3));
  const avg=a=>a.length?a.reduce((s,n)=>s+n,0)/a.length:null;
  const gctA=avg(contacts.map(c=>c.gct)), flA=avg(flights), stA=avg(stepTimes);
  const cadence=stA?+(60/stA).toFixed(0):null; // steps/min
  const duty=(gctA&&flA)?+(gctA/(gctA+flA)).toFixed(2):null;

  // velocity/step length from rig'd frames + scale (optional, reliable when present)
  let velocity=null, stepLen=null;
  const imgs=(_filmImgs||[]).filter(f=>f.rig&&f.rig.hip&&f.timestamp!=null).sort((a,b)=>parseFloat(a.timestamp)-parseFloat(b.timestamp));
  if(VL.pxPerYd&&imgs.length>=2){
    const a=imgs[0],b=imgs[imgs.length-1]; const dpx=Math.abs(b.rig.hip.x-a.rig.hip.x); const dt=Math.abs(parseFloat(b.timestamp)-parseFloat(a.timestamp));
    if(dt>0){ const yd=dpx/VL.pxPerYd; velocity=+((yd*0.9144)/dt).toFixed(2); /* m/s */ if(stepTimes.length)stepLen=+(yd/(tds.length-1||1)).toFixed(2); }
  }
  VL.temporal={contacts,gctA,flA,stA,cadence,duty,velocity,stepLen};
  renderTemporal();
};
function gctStatus(g){ if(g==null)return'na'; const[lo,hi]=PHASES[VL.phase].gct[VL.age]; if(g<=hi)return'good'; if(g<=hi*1.2)return'warn'; return'bad'; }
function renderTemporal(){
  const el=document.getElementById('vlp-temporal'); if(!el||!VL.temporal)return; const T=VL.temporal;
  const[glo,ghi]=PHASES[VL.phase].gct[VL.age];
  const rows=[];
  rows.push(['Ground contact (avg)',T.gctA!=null?T.gctA.toFixed(3)+'s':'—',glo+'–'+ghi+'s',gctStatus(T.gctA)]);
  rows.push(['Flight time (avg)',T.flA!=null?T.flA.toFixed(3)+'s':'—','—','na']);
  rows.push(['Step time (avg)',T.stA!=null?T.stA.toFixed(3)+'s':'—','—','na']);
  rows.push(['Cadence',T.cadence!=null?T.cadence+'/min':'—','—','na']);
  rows.push(['Duty factor',T.duty!=null?T.duty:'—','lower = stiffer','na']);
  if(T.velocity!=null)rows.push(['Velocity',T.velocity+' m/s ('+(T.velocity*2.237).toFixed(1)+' mph)','—','good']);
  if(T.stepLen!=null)rows.push(['Step length',T.stepLen.toFixed(2)+' yd','—','na']);
  // Spellman trend
  let trend='';
  if(T.contacts.length>=2){ const g0=T.contacts[0].gct,g1=T.contacts[T.contacts.length-1].gct;
    trend=g1<g0?'<span style="color:var(--accent)">✓ GCT shortening across steps (drive holding)</span>':'<span style="color:var(--orange)">⚑ GCT not shortening — leaking horizontal force</span>'; }
  el.innerHTML='<table class="tbl" style="font-size:10px"><thead><tr><th>Metric</th><th>Value</th><th>Norm</th></tr></thead><tbody>'
    +rows.map(r=>`<tr><td class="muted">${r[0]}</td><td style="color:${STC[r[3]]};font-weight:600">${r[1]}</td><td class="muted">${r[2]}</td></tr>`).join('')
    +'</tbody></table>'+(trend?'<div style="margin-top:6px;font-size:10px">'+trend+'</div>':'')
    +(T.velocity==null&&VL.pxPerYd==null?'<div class="muted" style="margin-top:5px">Set scale + measure the hip on 2 frames to add velocity & step length.</div>':'');
}

/* ── UPGRADED ANALYSIS (prompt + render) ───────────────────────────── */
function vlContextBlock(){
  const p=PHASES[VL.phase], band=AGE_BANDS[VL.age].label;
  let s='\n\n=== SPEED LAB CONTEXT (authoritative) ===\n';
  s+='PHASE: '+p.name+' ('+p.desc+'). '+p.blurb+'\n';
  s+='AGE BAND: '+band+' — grade against youth-appropriate ranges, not pro baselines.\n';
  s+='PHASE ANGLE NORMS ('+band+', side view):\n';
  p.angles.forEach(a=>{const[lo,hi]=normRange(a,VL.age);s+='  - '+a.label+': '+lo+'–'+hi+'°'+(a.note?' ('+a.note+')':'')+'\n';});
  s+='RATIO-OF-FORCE REFERENCE: '+p.rf+'\n';
  const meas=Object.entries(VL.angles);
  if(meas.length){ s+='MEASURED ANGLES (from the on-frame rig — treat as ground truth, do not re-estimate):\n';
    meas.forEach(([k,v])=>{const d=ANGLE_DEFS.find(x=>x.key===k);s+='  - '+(d?d.label:k)+': '+v+'°\n';}); }
  if(VL.temporal){const T=VL.temporal; s+='TEMPORAL (measured from frame timing):\n';
    if(T.gctA!=null)s+='  - Ground contact avg: '+T.gctA.toFixed(3)+'s (norm '+PHASES[VL.phase].gct[VL.age].join('–')+'s)\n';
    if(T.flA!=null)s+='  - Flight avg: '+T.flA.toFixed(3)+'s\n';
    if(T.cadence!=null)s+='  - Cadence: '+T.cadence+'/min\n';
    if(T.velocity!=null)s+='  - Velocity: '+T.velocity+' m/s ('+(T.velocity*2.237).toFixed(1)+' mph)\n'; }
  s+='\nIn your read: weave these measurements in, assign a Spellman bucket (force-deficient "force" → Push/Project/Drive, heavy resisted; or reactivity-deficient "react" → Pop/Punch/Spring, light/reactive), and give a single measurable retest target.\n';
  s+='Add these keys to your JSON: "phaseLabel","angleTable":[{"metric","measured","norm","status":"good|warn|bad|na"}],"bucket":"force|react","bucketReason","cues":[],"retestTarget".\n';
  return s;
}

const _origRun=window.runFilmAnalysis;
window.runFilmAnalysis=async function(){
  // reuse original entirely if our panel isn't present
  if(!document.getElementById('vlp-card')){ return _origRun&&_origRun.apply(this,arguments); }
  const btn=document.getElementById('film-run-btn'); const reset=()=>{btn.textContent='⚡ Analyze';btn.disabled=false;};
  const imgs=_filmImgs||[];
  if(!imgs.length){toast('Upload frames first');return;}
  if(!_apiKey){toast('Set API key first');return;}
  const moveId=document.getElementById('film-move').value, guide=MG[_filmCat]&&MG[_filmCat].moves.find(m=>m.id===moveId);
  if(!guide){toast('Select movement');return;}
  btn.textContent='Analyzing…';btn.disabled=true;
  try{
    const imgBlocks=imgs.filter(i=>i&&i.dataUrl&&i.dataUrl.length>30).map(i=>({type:'image',source:{type:'base64',media_type:'image/jpeg',data:i.dataUrl.split(',')[1]}})).filter(i=>i.source.data&&i.source.data.length>100);
    const view=document.getElementById('film-view').value, notes=document.getElementById('film-notes').value.trim();
    const athId=document.getElementById('film-ath').value, ath=S.athletes.find(a=>a.id===athId);
    if(ath){ VL.age=ageBand(ath.age); const as=document.getElementById('vlp-age'); if(as)as.value=VL.age; }
    let ctx='MOVEMENT: '+guide.label+'\nCAMERA: '+view+'\nFOCUS: '+guide.focus+'\n';
    if(notes)ctx+='CONTEXT: '+notes+'\n';
    if(ath){const m=getMetrics(ath);ctx+='ATHLETE: '+an(ath)+', '+ath.sport+', age '+ath.age+'. CMJ:'+m.cmj+' RSI:'+m.rsi+' Asym:'+m.asy+'%\n';}
    ctx+='\nYou are an elite speed coach on the Les Spellman / Stu McMillan / ALTIS model. Analyze these frames.';
    ctx+=vlContextBlock();
    ctx+='\nReturn ONLY valid JSON:\n{"overallGrade":"A","overallScore":85,"summary":"2 sentences","phaseLabel":"","angleTable":[{"metric":"","measured":"","norm":"","status":"good"}],"categories":[{"name":"","grade":"A","score":85,"finding":""}],"bucket":"force","bucketReason":"","cues":["",""],"topCues":[{"number":1,"title":"3-word cue","verbal":"","drill":"","why":""}],"retestTarget":"","sessionNote":""}';
    const res=await apiFetch({max_tokens:2200,messages:[{role:'user',content:[...imgBlocks,{type:'text',text:ctx}]}]});
    const d=await res.json();
    if(d.error){toast('Error: '+(d.error.message||'').slice(0,60));reset();return;}
    const raw=(d.content&&d.content.find(b=>b.type==='text')&&d.content.find(b=>b.type==='text').text)||'';
    let result=parseJSONLoose(raw)||parseJSONLoose(repairJSON(raw))||{overallGrade:'B',overallScore:70,summary:raw.slice(0,200),categories:[],topCues:[]};
    result.vl={phase:VL.phase,age:VL.age,angles:{...VL.angles},temporal:VL.temporal};
    const analysis={id:uid(),ts:new Date().toLocaleString(),date:today(),athId:athId||null,athName:ath?an(ath):null,movementLabel:guide.label+' · '+PHASES[VL.phase].name,result};
    if(!S.filmAnalyses)S.filmAnalyses=[]; S.filmAnalyses.unshift(analysis); if(S.filmAnalyses.length>20)S.filmAnalyses=S.filmAnalyses.slice(0,20);
    save(); if(window.renderFilmHistory)renderFilmHistory(); reset(); showFilmOutput(analysis);
  }catch(e){toast('Error: '+e.message);reset();}
};

const gc=g=>({A:'var(--accent)',B:'var(--blue)',C:'#fbbf24',D:'var(--orange)',F:'var(--red)'}[g]||'var(--text2)');
const _origShow=window.showFilmOutput;
window.showFilmOutput=function(a){
  const r=a.result||{};
  if(!r.bucket && !r.angleTable){ return _origShow&&_origShow.apply(this,arguments); } // old analyses → original renderer
  const B=BUCKETS[r.bucket]||BUCKETS.force;
  const angRows=(r.angleTable||[]).map(x=>`<tr><td class="muted">${x.metric||''}</td><td style="color:var(--text)">${x.measured||'–'}</td><td class="muted">${x.norm||''}</td><td><span style="font-size:8px;padding:2px 6px;border-radius:10px;background:${(STC[x.status]||'#888')}22;color:${STC[x.status]||'#888'}">${(x.status||'na')}</span></td></tr>`).join('');
  const cats=(r.categories||[]).map(c=>`<div style="margin-bottom:12px"><div class="spread" style="margin-bottom:4px"><span style="font-size:9px;color:var(--text2)">${c.name}</span><span style="font-family:var(--disp);font-size:18px;color:${gc(c.grade)}">${c.grade}</span></div><div class="pb-wrap"><div class="pb"><div class="pb-fill" style="width:${c.score}%;background:${gc(c.grade)}"></div></div><div class="pb-val">${c.score}</div></div><div style="font-size:10px;color:var(--text2);margin-top:4px">${c.finding||''}</div></div>`).join('');
  const cues=(r.cues||B.cues).map(c=>`<span style="font-family:var(--disp);font-size:15px;letter-spacing:.5px;padding:7px 13px;border-radius:var(--r);background:var(--bg3);border:1px solid ${B.cls==='force'?'rgba(255,140,66,.4)':'rgba(66,165,255,.4)'};color:${B.cls==='force'?'var(--orange)':'var(--blue)'};text-transform:uppercase">${c}</span>`).join('');
  const topCues=(r.topCues||[]).map(c=>`<div class="card" style="border-left:3px solid var(--accent);margin-bottom:8px"><div class="card-title">#${c.number||''} ${c.title||''}</div><div style="font-size:13px;font-style:italic;padding:8px;background:var(--bg)">"${c.verbal||''}"</div>${c.drill?'<div style="font-size:10px;color:var(--text2);margin:6px 0 2px">Drill: '+c.drill+'</div>':''}${c.why?'<div style="font-size:9px;color:var(--text3)">'+c.why+'</div>':''}</div>`).join('');
  const T=r.vl&&r.vl.temporal;
  const temporalHtml=T?`<div class="card"><div class="card-title">⏱ Timing</div><div style="display:flex;flex-wrap:wrap;gap:6px;font-size:10px">${[T.gctA!=null?'GCT '+T.gctA.toFixed(3)+'s':null,T.flA!=null?'Flight '+T.flA.toFixed(3)+'s':null,T.cadence!=null?T.cadence+'/min':null,T.velocity!=null?(T.velocity*2.237).toFixed(1)+'mph':null].filter(Boolean).map(v=>'<span class="tag">'+v+'</span>').join('')}</div></div>`:'';
  document.getElementById('film-output').innerHTML=
    `<div class="card" style="border-color:${gc(r.overallGrade)}44"><div class="flex" style="margin-bottom:12px;gap:14px"><div class="grade-ring grade-${r.overallGrade||'B'}">${r.overallGrade||'?'}</div><div style="flex:1"><div style="font-family:var(--disp);font-size:18px">${a.movementLabel||''}</div><div style="font-size:10px;color:var(--text2);margin-top:4px">${r.summary||''}</div><div class="muted">${a.ts||''}${a.athName?' · '+a.athName:''}</div></div></div>${a.athId&&window.saveFilmAsSession?'<button class="btn btn-sm" onclick="saveFilmAsSession(\''+a.id+'\')">💾 Save to Session</button>':''}</div>`
    +`<div class="card" style="border-color:${B.cls==='force'?'rgba(255,140,66,.3)':'rgba(66,165,255,.3)'}"><div class="flex" style="gap:12px"><div style="font-family:var(--disp);font-size:30px;color:${B.cls==='force'?'var(--orange)':'var(--blue)'};min-width:34px">${B.label}</div><div><div style="font-family:var(--disp);font-size:15px">${B.title}</div><div style="font-size:10px;color:var(--text2)">${r.bucketReason||B.desc}</div></div></div></div>`
    +(angRows?`<div class="card"><div class="card-title">📐 Angles vs norm</div><table class="tbl" style="font-size:10px"><thead><tr><th>Metric</th><th>Measured</th><th>Norm</th><th></th></tr></thead><tbody>${angRows}</tbody></table></div>`:'')
    +temporalHtml
    +(cats?`<div class="card"><div class="card-title">Breakdown</div>${cats}</div>`:'')
    +`<div class="card"><div class="card-title">🗣 Matched cues</div><div style="display:flex;flex-wrap:wrap;gap:7px">${cues}</div></div>`
    +(topCues?`<div style="font-family:var(--disp);font-size:16px;letter-spacing:2px;margin:14px 0 10px">COACHING CUES</div>${topCues}`:'')
    +(r.retestTarget?`<div class="card" style="border-color:rgba(184,255,87,.3)"><div class="card-title">Retest target</div><div style="font-size:12px">${r.retestTarget}</div></div>`:'');
  document.getElementById('film-output').scrollIntoView({behavior:'smooth',block:'start'});
};

/* boot: inject now if Film page already in DOM */
try{ injectUI(); vlRefreshFrames(); }catch(e){ console.warn('VL boot',e); }
console.log('[VL] Film Room upgrade loaded');
})();
