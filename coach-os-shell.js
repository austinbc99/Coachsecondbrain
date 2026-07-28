/* ═══════════════════════════════════════════════════════════════════════
   COACH OS — SHELL  v1.0
   Coach Austin C., ATC · Head Coach, FitClub CT

   LOAD ORDER: last. After program-builder-dropin.js.

   WHAT THIS DOES
   Coach OS is organised around features that were built, not around the
   way an athlete is actually worked with. VALD, Film and Sprint Lab are
   all athlete data capture, but they sit as peer tabs to Athletes — so
   looking at one athlete means visiting four destinations.

   This re-parents rather than rewrites. The three page nodes are MOVED
   (not copied, not recreated) into the athlete detail area as sub-tabs.
   Every id, handler and function in index.html keeps working untouched
   because the same DOM nodes are still on the page — just somewhere else.

     BEFORE: Dashboard · Athletes · VALD · Film · Sprint · Programs · Content
     AFTER:  Today · Athletes · Build · Studio
                       └─ Profile | Testing | Film | Sprint | Program

   Nothing is deleted. go('vald') still works from anywhere.
   Set localStorage 'coachos_shell'='off' and reload to disable.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if(window.__shellLoaded)return; window.__shellLoaded=true;
try{if(localStorage.getItem('coachos_shell')==='off'){console.log('[Shell] disabled');return;}}catch(e){}

const Shell={ver:'1.1',cur:'profile'};
window.Shell=Shell;

/* Sub-pages that move under Athletes. Key = existing page id suffix. */
const SUB={
  vald  :{label:'Testing',icon:'\u{1F4CB}'},
  film  :{label:'Film',   icon:'\u{1F3AC}'},
  sprint:{label:'Sprint', icon:'\u26A1'}
};

/* ═══════════ 1. DENSITY / TOUCH-TARGET PASS ═════════════════════════════
   Not a recolour — the palette stays. This is spacing, tap-target size
   and border noise. 44px is the minimum reliable touch target; a lot of
   the existing controls sit under 30. */
function injectCSS(){
  if(document.getElementById('shell-css'))return;
  const s=document.createElement('style'); s.id='shell-css';
  s.textContent=`
  /* ---- 4-tab primary nav ---- */
  #nav{display:grid !important;grid-template-columns:repeat(4,1fr) !important;gap:0 !important;}
  #nav .tab{display:flex !important;flex-direction:column;align-items:center;justify-content:center;
    gap:3px;padding:11px 4px !important;font-size:10px !important;min-height:52px;
    border-bottom:2px solid transparent;white-space:nowrap;overflow:hidden;}
  #nav .tab.active{border-bottom-color:var(--accent);color:var(--accent);}
  #nav .tab .ti{font-size:16px;line-height:1;}
  #nav .tab[data-shell-hidden]{display:none !important;}

  /* ---- athlete sub-nav ---- */
  #ath-subnav{display:flex;gap:0;overflow-x:auto;-webkit-overflow-scrolling:touch;
    border-bottom:1px solid var(--border);margin:0 0 12px;scrollbar-width:none;}
  #ath-subnav::-webkit-scrollbar{display:none;}
  #ath-subnav .sb{flex:0 0 auto;padding:10px 14px;font-size:11px;color:var(--text2);
    cursor:pointer;border-bottom:2px solid transparent;min-height:40px;
    display:flex;align-items:center;gap:5px;user-select:none;}
  #ath-subnav .sb.on{color:var(--accent);border-bottom-color:var(--accent);}
  #ath-sub .page{display:block !important;padding:0 !important;}
  #ath-sub .page:not(.sub-on){display:none !important;}
  #ath-sub .ph{display:none !important;}   /* sub-pages keep their own big header — redundant here */

  /* ---- touch targets + button consistency ---- */
  .btn,button.btn{min-height:40px !important;padding:10px 13px !important;
    border-radius:var(--r) !important;font-size:11px !important;}
  .tb-brain{min-height:38px !important;padding:9px 14px !important;}
  .btn-sm{min-height:34px !important;padding:8px 10px !important;font-size:10px !important;}

  /* iOS Safari zooms the whole page when a focused input is under 16px.
     14px is NOT enough - it has to be >=16px. Everything else can stay small. */
  input,select,textarea{min-height:42px !important;font-size:16px !important;}

  /* ---- iPHONE: safe areas ----
     viewport-fit=cover is already set in index.html, which means content runs
     under the notch and the home indicator unless we inset it ourselves. */
  #nav-wrap{padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);}
  #pages{padding-left:max(10px,env(safe-area-inset-left)) !important;
         padding-right:max(10px,env(safe-area-inset-right)) !important;
         padding-bottom:max(24px,env(safe-area-inset-bottom)) !important;}
  /* the Today overlay is position:fixed inset:0 - it needs its own insets */
  #pb-today{padding-top:max(16px,env(safe-area-inset-top)) !important;
            padding-bottom:max(40px,calc(env(safe-area-inset-bottom) + 28px)) !important;
            padding-left:max(14px,env(safe-area-inset-left)) !important;
            padding-right:max(14px,env(safe-area-inset-right)) !important;}

  /* ---- iPHONE: narrow widths (SE 375 / standard 390) ---- */
  @media (max-width:430px){
    #nav .tab{font-size:9px !important;padding:9px 2px !important;min-height:50px;}
    #nav .tab .ti{font-size:15px;}
    .ph-title{font-size:12px !important;}
    .ph-actions .btn{flex:1 1 auto;justify-content:center;}
    #ath-subnav .sb{padding:10px 11px;font-size:10px;}
    .card{padding:11px !important;}
  }
  @media (max-width:380px){
    #nav .tab{font-size:8px !important;}
  }

  /* stop rubber-band scroll chaining behind the Today overlay on iOS */
  body.pb-locked{overflow:hidden;position:fixed;width:100%;}

  /* ---- density: less border noise, tighter cards ---- */
  .card{border-color:var(--border) !important;margin-bottom:10px !important;}
  .ph{padding-bottom:10px !important;margin-bottom:12px !important;}
  .ph-title{font-size:13px !important;letter-spacing:.5px;}
  .ph-actions{display:flex;gap:6px;flex-wrap:wrap;}
  #pages{padding-top:8px !important;}

  /* ---- top bar: secondary controls shrink, Brain stays prominent ---- */
  #sentinel-btn,#key-btn{opacity:.55;}
  #sentinel-btn:hover,#key-btn:hover{opacity:1;}
  `;
  document.head.appendChild(s);
}

/* ═══════════ 2. REBUILD PRIMARY NAV ═════════════════════════════════════ */
const NAV=[
  {page:'dash',     icon:'\u25B6',      label:'Today'},
  {page:'athletes', icon:'\u{1F3C3}',   label:'Athletes'},
  {page:'programs', icon:'\u{1F4CB}',   label:'Build'},
  {page:'content',  icon:'\u{1F4F7}',   label:'Studio'}
];

function buildNav(){
  const nav=document.getElementById('nav'); if(!nav)return;
  nav.innerHTML=NAV.map(t=>
    '<div class="tab'+(S.page===t.page?' active':'')+'" data-page="'+t.page+'" '
    +'onclick="go(\''+t.page+'\')"><span class="ti">'+t.icon+'</span>'+t.label+'</div>').join('');
}

/* ═══════════ 3. RE-PARENT VALD / FILM / SPRINT ══════════════════════════
   appendChild MOVES a node in the DOM. Listeners, ids and state survive —
   this is why nothing in index.html needs editing. */
function reparent(){
  const host=document.getElementById('pg-athletes'); if(!host)return;
  if(document.getElementById('ath-sub'))return;

  const subnav=document.createElement('div'); subnav.id='ath-subnav';
  const wrap=document.createElement('div');   wrap.id='ath-sub';

  const detail=document.getElementById('ath-detail');
  const anchor=detail||host.lastElementChild;
  (anchor.parentNode||host).insertBefore(subnav,anchor);
  (anchor.parentNode||host).insertBefore(wrap,anchor.nextSibling);

  // Profile = the existing athlete detail pane, wrapped so it toggles like the others
  if(detail){
    const pw=document.createElement('div');
    pw.className='page sub-on'; pw.id='sub-profile';
    detail.parentNode.insertBefore(pw,detail);
    pw.appendChild(detail);
    wrap.appendChild(pw);
  }
  Object.keys(SUB).forEach(k=>{
    const pg=document.getElementById('pg-'+k);
    if(pg)wrap.appendChild(pg);        // MOVE, not clone
  });

  const tabs=[{k:'profile',icon:'\u{1F464}',label:'Profile'}]
    .concat(Object.keys(SUB).map(k=>({k,icon:SUB[k].icon,label:SUB[k].label})));
  subnav.innerHTML=tabs.map(t=>
    '<div class="sb'+(t.k==='profile'?' on':'')+'" data-sub="'+t.k+'" '
    +'onclick="Shell.sub(\''+t.k+'\')"><span>'+t.icon+'</span>'+t.label+'</div>').join('')
    +'<div class="sb" onclick="Shell.gotoProgram()"><span>\u{1F4C8}</span>Program</div>';
}

Shell.sub=function(k){
  Shell.cur=k;
  const wrap=document.getElementById('ath-sub'); if(!wrap)return;
  Array.from(wrap.children).forEach(c=>c.classList.remove('sub-on'));
  const target=document.getElementById(k==='profile'?'sub-profile':'pg-'+k);
  if(target)target.classList.add('sub-on');
  document.querySelectorAll('#ath-subnav .sb').forEach(b=>
    b.classList.toggle('on',b.dataset.sub===k));
  if(k!=='profile'&&window.pageInits&&typeof pageInits[k]==='function'){
    try{pageInits[k]();}catch(e){console.warn('[Shell] init '+k,e);}
  }
  try{document.getElementById('pages').scrollTop=0;}catch(e){}
};

Shell.gotoProgram=function(){
  if(S.selAth&&typeof goGenProgram==='function')goGenProgram(S.selAth);
  else go('programs');
};

/* ═══════════ 4. ROUTE OLD PAGE NAMES ════════════════════════════════════
   go('vald') is called from several places in index.html. Keep it working:
   route it to Athletes + the right sub-tab instead of a dead page. */
function wrapGo(){
  const _go=window.go;
  window.go=function(p){
    if(SUB[p]){
      _go('athletes');
      buildNavActive('athletes');
      Shell.sub(p);
      return;
    }
    _go(p);
    buildNavActive(p);
    if(p==='athletes')Shell.sub(Shell.cur||'profile');
  };
}
function buildNavActive(p){
  document.querySelectorAll('#nav .tab').forEach(t=>
    t.classList.toggle('active',t.dataset.page===p));
}

/* ═══════════ 5. BOOT ════════════════════════════════════════════════════ */
function patchTodayOverlay(){
  if(!window.PB||!PB.openToday||PB._iosPatched)return;
  const _open=PB.openToday, _close=()=>document.body.classList.remove('pb-locked');
  PB.openToday=function(){ _open.apply(this,arguments);
    document.body.classList.add('pb-locked');
    const ov=document.getElementById('pb-today');
    if(ov){const x=ov.querySelector('span[onclick*="remove"]');
      if(x)x.addEventListener('click',_close,{once:true});}
  };
  PB._iosPatched=true;
}

function boot(){
  try{
    injectCSS();
    patchTodayOverlay();
    reparent();
    buildNav();
    wrapGo();
    if(S&&S.page&&SUB[S.page]){S.page='athletes';}
    buildNavActive(S?S.page:'dash');
    if(S&&S.page==='athletes')Shell.sub('profile');
    console.log('%c[Shell] v'+Shell.ver+' — 4 tabs, re-parented, iOS safe-area',
                'color:#00e5a0;font-weight:bold');
  }catch(e){
    console.error('[Shell] boot failed, app unaffected:',e);
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,60));
else setTimeout(boot,60);
})();
