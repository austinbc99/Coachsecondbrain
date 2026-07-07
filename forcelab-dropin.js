/* ============================================================================
   FORCE LAB  ·  Coach OS drop-in
   ----------------------------------------------------------------------------
   Self-wires onto your existing renderValdSummary(), reads the SELECTED
   athlete's  a.vald.asy / a.vald.asys  and  a.updates[]  , and draws.
   Force-Time stays a "socket" until an athlete has  a.forceTime = {bodyweightN,
   rateHz, force:[...]}  — that data comes from a ForceDecks RAW export, not the
   summary PDF. Uses YOUR token vars (--accent, --red, --orange…) so it themes
   itself. Namespaced helpers (_flE/_flcv) so nothing of yours is overwritten.
   Reconstructed from a prior session (July 2) that was never actually plugged
   into the live app — reassembled and verified against the current repo.
   ============================================================================ */
(function(){
  var NSFL='http://www.w3.org/2000/svg';
  function _flE(t,a,txt){var e=document.createElementNS(NSFL,t);for(var k in a)e.setAttribute(k,a[k]);if(txt!=null)e.textContent=txt;return e;}
  function _flcv(n){return getComputedStyle(document.body).getPropertyValue(n).trim()||'#b8ff57';}
  function _flSel(){try{return S.athletes.find(function(a){return a.id===S.selAth;});}catch(e){return null;}}

  /* ---- inject scoped styles once ---- */
  if(!document.getElementById('fl-style')){
    var st=document.createElement('style');st.id='fl-style';
    st.textContent=
      '#fl-wrap{margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px}'+
      '@media(max-width:640px){#fl-wrap{grid-template-columns:1fr}}'+
      '#fl-wrap .flp{grid-column:span 1;position:relative;background:var(--bg2,#111);border:1px solid var(--border2,#2c2c2c)}'+
      '#fl-wrap .flp.wide{grid-column:1/-1}'+
      '#fl-wrap .flh{display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--border,#222);background:var(--bg3,#181818)}'+
      '#fl-wrap .flid{font-size:9px;font-weight:700;letter-spacing:.13em;color:#000;background:var(--accent,#b8ff57);padding:2px 6px}'+
      '#fl-wrap .flt{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--text2,#8a8a8a)}'+
      '#fl-wrap .flst{margin-left:auto;font-size:8px;font-weight:700;letter-spacing:.1em;padding:1px 6px;border:1px solid}'+
      '#fl-wrap .flst.on{color:var(--accent,#b8ff57);border-color:var(--accent,#b8ff57)}'+
      '#fl-wrap .flst.off{color:var(--orange,#ff8c42);border-color:var(--orange,#ff8c42)}'+
      '#fl-wrap .flb{padding:10px}'+
      '#fl-wrap svg{display:block;width:100%;height:auto;overflow:visible}'+
      '#fl-wrap select{background:var(--bg,#090909);border:1px solid var(--border2,#2c2c2c);color:var(--text,#efefef);font:inherit;font-size:11px;padding:3px 6px;border-radius:3px;margin-bottom:6px}';
    document.head.appendChild(st);
  }

  /* ===================== drawAsymmetry(svgId, athlete) ===================== */
  window.drawAsymmetry=function(id,a){
    var s=document.getElementById(id);if(!s)return;s.innerHTML='';
    var v=(a&&a.vald)||{},def=+v.asy||0,side=((v.asys||'R')+'').charAt(0).toUpperCase();
    var W=440,cx=W/2,top=42,rh=30,half=140;
    s.appendChild(_flE('text',{x:cx-half/2,y:20,'text-anchor':'middle','font-size':8,fill:_flcv('--text2')},'LEFT'));
    s.appendChild(_flE('text',{x:cx+half/2,y:20,'text-anchor':'middle','font-size':8,fill:_flcv('--text2')},'RIGHT'));
    s.appendChild(_flE('line',{x1:cx,y1:26,x2:cx,y2:top+rh+14,stroke:_flcv('--border2')}));
    var band=half*0.08/0.20; // ±8% tolerance mapped on 0-20% scale
    s.appendChild(_flE('rect',{x:cx-band,y:26,width:band*2,height:top+rh+14-26,fill:_flcv('--accent'),opacity:.05}));
    [-1,1].forEach(function(g){s.appendChild(_flE('line',{x1:cx+g*band,y1:26,x2:cx+g*band,y2:top+rh+14,stroke:_flcv('--accent'),'stroke-dasharray':'2 3',opacity:.45}));});
    var strong=half, weak=half*(1-Math.min(def,20)/100);
    var Lw=side==='R'?strong:weak, Rw=side==='R'?weak:strong;
    var col=def>12?_flcv('--red'):def>8?_flcv('--orange'):_flcv('--accent');
    s.appendChild(_flE('rect',{x:cx-Lw,y:top,width:Lw,height:rh,fill:side==='L'?_flcv('--border2'):col,opacity:side==='L'?1:.85}));
    s.appendChild(_flE('rect',{x:cx,y:top,width:Rw,height:rh,fill:side==='R'?_flcv('--border2'):col,opacity:side==='R'?1:.85}));
    s.appendChild(_flE('text',{x:cx,y:top-4,'text-anchor':'middle','font-size':9,fill:_flcv('--text'),'font-family':_flcv('--mono')},(a&&a.name)||''));
    s.appendChild(_flE('text',{x:side==='R'?cx-half-6:cx+half+6,y:top+rh/2+4,'text-anchor':side==='R'?'end':'start','font-size':11,fill:col,'font-weight':600},(def||0)+'% '+side));
    s.appendChild(_flE('text',{x:cx,y:top+rh+30,'text-anchor':'middle','font-size':7,fill:_flcv('--accent')},'\u00b18% tolerance'));
    if(!def)s.appendChild(_flE('text',{x:cx,y:top+rh/2+4,'text-anchor':'middle','font-size':9,fill:_flcv('--text3')},'no asym data'));
  };

  /* ===================== drawTrend(svgId, athlete, key) ===================== */
  window.drawTrend=function(id,a,key){
    var s=document.getElementById(id);if(!s)return;s.innerHTML='';
    var u=((a&&a.updates)||[]).filter(function(r){return r&&r[key]!=null;});
    var W=440,H=150,pl=36,pr=42,pt=16,pb=28,x0=pl,x1=W-pr,y0=H-pb,y1=pt;
    if(u.length<2){s.appendChild(_flE('text',{x:W/2,y:H/2,'text-anchor':'middle','font-size':9,fill:_flcv('--text3')},'need \u22652 retests'));return;}
    var vals=u.map(function(r){return +r[key];});
    var mn=Math.min.apply(0,vals),mx=Math.max.apply(0,vals),pad=(mx-mn||1)*.2;mn-=pad;mx+=pad;
    function X(i){return x0+i/(u.length-1)*(x1-x0);}function Y(val){return y0-(val-mn)/(mx-mn)*(y0-y1);}
    s.appendChild(_flE('line',{x1:x0,y1:y0,x2:x1,y2:y0,stroke:_flcv('--border2')}));
    s.appendChild(_flE('line',{x1:x0,y1:y1,x2:x0,y2:y0,stroke:_flcv('--border2')}));
    s.appendChild(_flE('polyline',{points:u.map(function(r,i){return X(i)+','+Y(+r[key]);}).join(' '),fill:'none',stroke:_flcv('--accent'),'stroke-width':1.8,'stroke-linejoin':'round'}));
    u.forEach(function(r,i){var x=X(i),y=Y(+r[key]);
      s.appendChild(_flE('circle',{cx:x,cy:y,r:3.4,fill:_flcv('--bg2'),stroke:_flcv('--accent'),'stroke-width':1.6}));
      s.appendChild(_flE('text',{x:x,y:y-8,'text-anchor':'middle','font-size':9,fill:_flcv('--text')},r[key]));
      s.appendChild(_flE('text',{x:x,y:y0+12,'text-anchor':'middle','font-size':7,fill:_flcv('--text2')},((r.date||'')+'').slice(5)));});
    var d=vals[vals.length-1]-vals[0],better=key==='asy'?d<0:d>0;
    s.appendChild(_flE('text',{x:x1+4,y:Y(vals[vals.length-1])+3,'font-size':10,fill:better?_flcv('--accent'):_flcv('--orange')},(d>0?'+':'')+(Math.round(d*100)/100)));
  };

  /* ===================== drawForceTime(svgId, data) =====================
     data = { bodyweightN, rateHz, force:[N,...] }  OR  { samples:[{t,f}] } */
  window.drawForceTime=function(id,data){
    var s=document.getElementById(id);if(!s)return false;s.innerHTML='';
    var W=660,H=220,pl=44,pr=14,pt=14,pb=28,x0=pl,x1=W-pr,y0=H-pb,y1=pt,series;
    if(data&&data.samples&&data.samples.length)series=data.samples.map(function(p){return{t:+p.t,f:+p.f};});
    else if(data&&data.force&&data.force.length){var hz=data.rateHz||1000;series=data.force.map(function(f,i){return{t:i/hz*1000,f:+f};});}
    if(!series||series.length<3){
      s.appendChild(_flE('rect',{x:x0,y:y1,width:x1-x0,height:y0-y1,fill:'none',stroke:_flcv('--border2'),'stroke-dasharray':'3 3'}));
      s.appendChild(_flE('text',{x:W/2,y:H/2,'text-anchor':'middle','font-size':9,fill:_flcv('--orange')},'\u25CC awaiting raw ForceDecks export (a.forceTime)'));
      return false;
    }
    var bw=data.bodyweightN||series.reduce(function(m,p){return m+p.f;},0)/series.length;
    var t0=series[0].t,t1=series[series.length-1].t,fmax=Math.max.apply(0,series.map(function(p){return p.f;}))*1.05;
    function X(t){return x0+(t-t0)/(t1-t0||1)*(x1-x0);}function Y(f){return y0-f/fmax*(y0-y1);}
    s.appendChild(_flE('line',{x1:x0,y1:y0,x2:x1,y2:y0,stroke:_flcv('--border2')}));
    s.appendChild(_flE('line',{x1:x0,y1:y1,x2:x0,y2:y0,stroke:_flcv('--border2')}));
    for(var k=1;k*bw<fmax;k++){var y=Y(k*bw);s.appendChild(_flE('line',{x1:x0,y1:y,x2:x1,y2:y,stroke:k===1?_flcv('--text3'):_flcv('--border'),'stroke-dasharray':k===1?'':'1 4'}));s.appendChild(_flE('text',{x:x0-5,y:y+3,'text-anchor':'end','font-size':8,fill:_flcv('--text2')},k+'\u00D7'));}
    var poly=series.map(function(p){return X(p.t)+','+Y(p.f);});
    s.appendChild(_flE('polygon',{points:x0+','+y0+' '+poly.join(' ')+' '+x1+','+y0,fill:_flcv('--accent'),opacity:.06}));
    s.appendChild(_flE('polyline',{points:poly.join(' '),fill:'none',stroke:_flcv('--accent'),'stroke-width':1.4,'stroke-linejoin':'round'}));
    var pk=series.reduce(function(a,b){return b.f>a.f?b:a;}),lo=series.reduce(function(a,b){return b.f<a.f?b:a;});
    s.appendChild(_flE('circle',{cx:X(pk.t),cy:Y(pk.f),r:3,fill:_flcv('--accent')}));
    s.appendChild(_flE('text',{x:X(pk.t),y:Y(pk.f)-6,'text-anchor':'middle','font-size':8,fill:_flcv('--accent')},'PEAK '+(pk.f/bw).toFixed(2)+'\u00D7'));
    s.appendChild(_flE('circle',{cx:X(lo.t),cy:Y(lo.f),r:3,fill:_flcv('--blue')}));
    return true;
  };

  /* ===================== renderForceLab()  — builds mounts + draws ===================== */
  window.renderForceLab=function(){
    var host=document.getElementById('vald-summary');var a=_flSel();
    if(!host||!a)return;
    var old=document.getElementById('fl-wrap');if(old)old.remove();
    var wrap=document.createElement('div');wrap.id='fl-wrap';
    function panel(id,pid,title,wide){return '<div class="flp'+(wide?' wide':'')+'"><div class="flh"><span class="flid">'+pid+'</span><span class="flt">'+title+'</span><span class="flst '+((id==='fl-ft')?'off':'on')+'" id="'+id+'-st">'+((id==='fl-ft')?'\u25CC SOCKET':'\u25CF LIVE')+'</span></div><div class="flb">'+
      (id==='fl-trd'?'<select id="fl-trd-key"><option value="cmj">CMJ</option><option value="rsi">RSI</option><option value="asy">Asym</option><option value="trap">Trap</option></select><br>':'')+
      '<svg id="'+id+'" viewBox="0 0 '+(wide?660:440)+' '+(id==='fl-ft'?220:(id==='fl-trd'?150:150))+'"></svg></div></div>';}
    wrap.innerHTML=panel('fl-asy','ASY','Bilateral Asymmetry')+panel('fl-trd','TRD','Retest Trend')+panel('fl-ft','FT','Force\u2013Time',true);
    host.appendChild(wrap);
    drawAsymmetry('fl-asy',a);
    drawTrend('fl-trd',a,'cmj');
    var sel=document.getElementById('fl-trd-key');if(sel)sel.onchange=function(){drawTrend('fl-trd',_flSel(),this.value);};
    drawForceTime('fl-ft',a.forceTime||{});
  };

  /* ---- self-wire: wrap your existing renderValdSummary so Force Lab draws with it ---- */
  if(typeof window.renderValdSummary==='function'&&!window.renderValdSummary._flHooked){
    var _orig=window.renderValdSummary;
    window.renderValdSummary=function(){var r=_orig.apply(this,arguments);try{renderForceLab();}catch(e){}return r;};
    window.renderValdSummary._flHooked=true;
  }
  /* draw once now in case an athlete is already open */
  try{renderForceLab();}catch(e){}
})();
