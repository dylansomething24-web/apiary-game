// ── TOAST ─────────────────────────────────────────────────────────────────────
let _pb=0,_ph=0;
function toast(msg,type='info'){
    const el=document.createElement('div');
    const c={info:'#c8a860',warn:'#d09020',green:'#58c858',mile:'#e09a18'}[type]||'#c8a860';
    const bg=type==='mile'?'rgba(60,40,4,.97)':'rgba(4,8,4,.95)';
    el.style.cssText=`position:fixed;bottom:${90+_pb}px;left:50%;transform:translateX(-50%);background:${bg};color:${c};padding:10px 18px;border-radius:3px;font:italic .9rem 'Baskerville',Georgia,serif;border:1px solid ${c}44;z-index:800;max-width:82vw;text-align:center;line-height:1.4;pointer-events:none;`;
    el.textContent=msg;document.body.appendChild(el);
    _pb+=52;
    setTimeout(()=>{el.style.transition='opacity .5s';el.style.opacity='0';setTimeout(()=>{el.remove();_pb=Math.max(0,_pb-52);},500);},3200);
    if(type==='mile')Snd.mile();
}

// ── CHOICE MODAL ──────────────────────────────────────────────────────────────
let _pendN=null,_cA=null,_cB=null;
function showChoice({icon,title,body,a,b}){
    document.getElementById('ch-icon').textContent=icon||'';
    document.getElementById('ch-title').textContent=title;
    document.getElementById('ch-body').textContent=body;
    document.getElementById('ch-a').textContent=a.label;
    document.getElementById('ch-b').textContent=b.label;
    _cA=a.fn;_cB=b.fn;
    ovShow('ov-c');
}
function doChoice(ab){
    ovHide('ov-c');
    if(ab==='a'&&_cA)_cA();
    if(ab==='b'&&_cB)_cB();
    _cA=_cB=null;
    hud();save();if(window._S)window._S.refresh();
}
document.getElementById('ch-a').addEventListener('click',()=>doChoice('a'));
document.getElementById('ch-b').addEventListener('click',()=>doChoice('b'));

// ── HUD ───────────────────────────────────────────────────────────────────────
function hud(){
    const stage=getStage();
    document.getElementById('hud-bees').textContent=G.bees;
    document.getElementById('hud-honey').textContent=~~G.honey;
    document.getElementById('hud-nectar').textContent=~~G.nectar;
    const dy=G.day,yr=G.year;
    document.getElementById('hud-day').textContent=`${G.season} · Day ${doyNum(dy)} · Year ${yr}`;
    const fo=foragerTotal(),po=pollTotal(),oc=occupied(),fr=free();
    document.getElementById('hud-free').textContent=`${fr} free · ${fo} foraging · ${po} restoring`;
    document.getElementById('hud-proc').textContent=`${G.processors} proc`;
    // Stage badge
    const sn=STAGE_NAMES[stage]||'New Swarm';
    document.getElementById('hud-stage').textContent=sn;
    // Swarm pressure bar
    const sp=document.getElementById('hud-swarm');
    if(G.swarm>0){sp.style.display='block';document.getElementById('hud-swarm-fill').style.width=G.swarm+'%';}
    else sp.style.display='none';
    // Hive subtext in hive view
    if(G.view==='hive'){
        const need=Math.ceil(G.bees/20);
        document.getElementById('hud-sub').textContent=`Nurses ${G.nurses}/${need} · Brood day ${G.brood}/20 · Guards ${G.guards}`;
    }else{
        document.getElementById('hud-sub').textContent='';
    }
}

// ── ROLE MANAGEMENT ───────────────────────────────────────────────────────────
function role(r,delta){
    Snd.tap();hap([20]);
    if(r==='nurses'){
        const n=clamp(G.nurses+delta,0,G.bees-G.guards-G.processors-foragerTotal()-pollTotal());
        G.nurses=Math.max(0,n);
    }else if(r==='guards'){
        const n=clamp(G.guards+delta,0,G.bees-G.nurses-G.processors-foragerTotal()-pollTotal());
        G.guards=Math.max(0,n);
    }else if(r==='processors'){
        const n=clamp(G.processors+delta,0,G.bees-G.nurses-G.guards-foragerTotal()-pollTotal());
        G.processors=Math.max(0,n);
    }
    hud();fillPanel(G.selKey);save();
}

function adjPoll(k,delta){
    if(getStage()<2){toast('Pollinators unlock after surviving first winter','warn');return;}
    const t=G.tiles[k];
    if(!t||t.type!=='DEAD_ZONE')return;
    const cur=G.pa[k]||0;
    const nxt=clamp(cur+delta,0,cur+free());
    if(nxt===0){delete G.pa[k];}else{G.pa[k]=nxt;}
    Snd.tap();hap([20]);hud();fillPanel(k);save();
}
function recallPoll(k){
    delete G.pa[k];
    toast('Pollinators recalled','green');
    Snd.tap();hud();fillPanel(k);save();
}
function sendForagers(k){
    const n=_pendN||1;
    if(n>free()+(G.fa[k]||0)){toast('Not enough free bees','warn');return;}
    G.fa[k]=(G.fa[k]||0)+n;_pendN=null;
    toast(`${n} forager${n>1?'s':''} sent`,'green');Snd.tap();hap([20]);
    hud();fillPanel(k);save();
    if(window._S)window._S.refresh();
}
function recallForagers(k){
    const n=G.fa[k]||0;
    delete G.fa[k];
    toast(`${n} forager${n>1?'s':''} recalled`,'green');Snd.tap();hap([20]);
    hud();fillPanel(k);save();
    if(window._S)window._S.refresh();
}
function clearDistress(){
    const n=G._distress.length;
    if(n===0){toast('No distressed cells','warn');return;}
    const cost=Math.max(1,~~(n*1.5));
    if(G.bees-cost<=2){toast('Too few bees to clear cells safely','warn');return;}
    G.bees-=cost;G._distress=[];
    toast(`Distressed cells cleared — ${cost} bees lost`,'green');hap([40,20,40]);
    hud();save();if(window._S)window._S.refresh();
}

// ── PANEL FILL FUNCTIONS ──────────────────────────────────────────────────────
function fillPanel(k){
    if(!k)return;
    const t=G.tiles[k];
    if(!t){_fillFogPanel(k);return;}
    if(t.type==='HIVE_BOX'){_fillHivePanel();return;}
    if(t.type==='DEAD_ZONE'){_fillDeadPanel(k,t);return;}
    _fillTilePanel(k,t);
}

function _fillHivePanel(){
    const stage=getStage();
    const need=Math.ceil(G.bees/20);
    const nurseOk=G.nurses>=need;
    const winterNeed=Math.ceil(G.bees*0.08*15);
    const r=document.getElementById('panel-body');
    const stageName=STAGE_NAMES[stage];
    const nextDesc=stageNextDesc();
    const colName=G._colonyName?`<p style="font-style:italic;color:#e09a18;margin:0 0 10px">"${G._colonyName}"</p>`:'';
    r.innerHTML=`
    ${colName}
    <div style="display:flex;justify-content:space-between;margin-bottom:10px">
        <span style="color:#58c858;font-family:'Courier New',monospace;font-size:.8rem">${stageName}</span>
        <span style="color:#3a5a30;font-size:.75rem">${G._wintersS} winter${G._wintersS!==1?'s':''} survived</span>
    </div>
    <p style="color:#3a5a30;font-size:.75rem;margin:0 0 12px">${nextDesc}</p>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:14px">
        <div class="stat-box"><div class="stat-n">${G.bees}</div><div class="stat-l">bees</div></div>
        <div class="stat-box"><div class="stat-n">${~~G.honey}</div><div class="stat-l">lbs honey</div></div>
        <div class="stat-box"><div class="stat-n">${free()}</div><div class="stat-l">free</div></div>
    </div>
    <div style="margin-bottom:14px">
        <div class="role-row">
            <span>Nurses <span style="color:${nurseOk?'#58c858':'#d04040'}">${G.nurses}/${need}</span></span>
            <div class="pm-wrap"><button onclick="role('nurses',-1)">−</button><button onclick="role('nurses',1)">+</button></div>
        </div>
        <div class="role-row">
            <span>Guards <span style="color:#c8a860">${G.guards}</span></span>
            <div class="pm-wrap"><button onclick="role('guards',-1)">−</button><button onclick="role('guards',1)">+</button></div>
        </div>
        <div class="role-row">
            <span>Processors <span style="color:#c8a860">${G.processors}</span> <span style="color:#3a5a30;font-size:.75rem">(${~~(G.processors*1.5*.75*10)/10} lbs/day)</span></span>
            <div class="pm-wrap"><button onclick="role('processors',-1)">−</button><button onclick="role('processors',1)">+</button></div>
        </div>
    </div>
    ${G.season==='Fall'||G.season==='Winter'?`<p style="color:#d09020;font-size:.82rem;margin:0 0 10px">Winter need: ${winterNeed} lbs · Have: ${~~G.honey} lbs</p>`:''}
    ${G.swarm>0?`<p style="color:#d04040;font-size:.82rem;margin:0 0 6px">Swarm pressure: ${~~G.swarm}%</p>`:''}
    ${G.swarm>=40?`<button class="act-btn" onclick="prepSwarm()">Prepare swarm cell (−5 lbs honey)</button>`:''}
    <p style="color:#3a5a30;font-size:.75rem;margin:10px 0 0">Switch to Hive view to manage brood and the queen</p>
    `;
}

function _fillTilePanel(k,t){
    const def=TD[t.type];
    const dist=hdist(t.q,t.r,0,0);
    const inRange=dist<=G.frad;
    const assigned=G.fa[k]||0;
    const eff={Spring:1.0,Summer:1.15,Fall:0.6,Winter:0}[G.season];
    let bonus=1;
    nbrs(t.q,t.r).forEach(([nq,nr])=>{const nt=G.tiles[hkey(nq,nr)];if(nt&&nt.type==='WATER')bonus=1.1;});
    const rate=def.forage?(def.forage*0.022*eff*bonus).toFixed(3):'0';
    const r=document.getElementById('panel-body');
    r.innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="background:#1a2a1a;padding:3px 8px;border-radius:2px;font:11px 'Courier New',monospace;color:#58c858">${STG[t.stage]||'—'}</span>
        ${bonus>1?'<span style="color:#78a8d8;font-size:.78rem">+10% water bonus</span>':''}
    </div>
    ${def.forage?`<p style="color:#c8a860;margin:0 0 8px">Forage: ${def.forage} · ${rate} nectar/bee/day</p>`:'<p style="color:#3a5a30;margin:0 0 8px">No forage</p>'}
    <p style="color:#3a5a30;font-size:.8rem;margin:0 0 12px">Distance ${dist} · ${inRange?'In range':'Beyond forage range'}</p>
    ${!inRange?`<button class="act-btn" onclick="sendScout('${k}',${t.q},${t.r})">Send scouts</button>`:''}
    ${inRange&&def.forage>0?`
    ${assigned>0?`
    <div class="role-row">
        <span style="color:#e09a18">${assigned} foraging here</span>
        <div class="pm-wrap">
            <button onclick="if(G.fa['${k}']>1)G.fa['${k}']--;else delete G.fa['${k}'];hud();fillPanel('${k}');save();if(window._S)window._S.refresh()">−</button>
            <button onclick="if(free()>0){G.fa['${k}']=(G.fa['${k}']||0)+1;hud();fillPanel('${k}');save();if(window._S)window._S.refresh();}">+</button>
        </div>
    </div>
    <button class="act-btn" onclick="recallForagers('${k}')">Recall all</button>
    `:`
    <div class="role-row" style="margin-bottom:8px">
        <span>Send foragers</span>
        <div class="pm-wrap">
            <button onclick="_pendN=Math.max(1,(_pendN||1)-1);document.getElementById('pend-n').textContent=(_pendN||1)">−</button>
            <span id="pend-n" style="color:#e09a18;min-width:22px;text-align:center;font-family:'Courier New',monospace">${_pendN||1}</span>
            <button onclick="_pendN=Math.min(free(),(_pendN||1)+1);document.getElementById('pend-n').textContent=(_pendN||1)">+</button>
        </div>
    </div>
    <button class="act-btn" onclick="sendForagers('${k}')">Send foragers</button>
    `}
    `:''}
    `;
}

function _fillDeadPanel(k,t){
    const stage=getStage();
    const prog=G.restore[k]||0;
    const assigned=G.pa[k]||0;
    const daysLeft=assigned>0?~~((100-prog)/(assigned*3.5)):null;
    const locked=stage<2;
    const r=document.getElementById('panel-body');
    r.innerHTML=`
    <p style="color:#3a5a30;margin:0 0 10px;font-size:.85rem">A dead zone. Pollinators can slowly restore it to Wildflower.</p>
    ${locked?`<p style="color:#d09020;font-size:.82rem;margin:0 0 12px">Pollinators unlock after surviving first winter (Stage 2).</p>`:`
    <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:.8rem;color:#c8a860">Restoration</span>
            <span style="font:11px 'Courier New',monospace;color:#58c858">${~~prog}%</span>
        </div>
        <div style="background:#0a1a0a;height:8px;border-radius:4px">
            <div style="background:#30a040;height:100%;border-radius:4px;width:${prog}%;transition:width .3s"></div>
        </div>
        ${daysLeft!==null?`<p style="color:#3a5a30;font-size:.75rem;margin:4px 0 0">~${daysLeft} days remaining</p>`:''}
    </div>
    <div class="role-row">
        <span>Pollinators <span style="color:#58c858">${assigned}</span></span>
        <div class="pm-wrap">
            <button onclick="adjPoll('${k}',-1)">−</button>
            <button onclick="adjPoll('${k}',1)">+</button>
        </div>
    </div>
    ${assigned>0?`<button class="act-btn" style="margin-top:8px" onclick="recallPoll('${k}')">Recall all pollinators</button>`:''}
    `}
    `;
}

function _fillFogPanel(k){
    const f=G.fog[k];if(!f)return;
    const scouting=G.scouts.find(s=>s.k===k);
    const r=document.getElementById('panel-body');
    r.innerHTML=`
    <p style="color:#3a5a30;margin:0 0 12px">Unexplored land. Scouts will map what lies here.</p>
    ${scouting?`<p style="color:#c8a860;font-style:italic">Scouting… returns in ${scouting.days} day${scouting.days!==1?'s':''}</p>`
    :`<button class="act-btn" onclick="sendScout('${k}',${f.q},${f.r})">Send scouts</button>`}
    `;
}

// ── QUEEN/BROOD/HONEY PANELS (hive view) ─────────────────────────────────────
function _fillQueenPanel(){
    const stage=getStage();
    const locked=stage<2;
    const modes=['conserve','normal','overdrive'];
    const descs={
        conserve:'She lays with restraint. Swarm pressure eases. Growth slows.',
        normal:'Her natural pace. Balanced growth and swarming risk.',
        overdrive:'She lays relentlessly. The colony surges. Swarm pressure builds.',
    };
    const r=document.getElementById('panel-body');
    if(locked){
        r.innerHTML=`<p style="color:#d09020;font-style:italic;margin:0">Queen mode unlocks after surviving the first winter.</p><p style="color:#3a5a30;font-size:.8rem;margin:8px 0 0">The colony is still finding its rhythm.</p>`;
        return;
    }
    const qm={conserve:0.65,normal:1.0,overdrive:1.35}[G.qMode]||1;
    const proj=~~(G.bees*0.06*qm);
    r.innerHTML=`
    <p style="color:#3a5a30;font-size:.8rem;margin:0 0 10px">Swarm pressure: ${~~G.swarm}% · Bees: ${G.bees}</p>
    <p style="color:#c8a860;font-size:.82rem;margin:0 0 12px">Next hatch: ~${proj} bees (day ${G.brood} of 20)</p>
    ${modes.map(m=>`
    <button onclick="setQueenMode('${m}')" style="display:block;width:100%;text-align:left;background:${G.qMode===m?'#1a2a0a':'transparent'};border:1px solid ${G.qMode===m?'#58c858':'#1e3a1e'};color:${G.qMode===m?'#58c858':'#3a5a30'};padding:8px 12px;margin-bottom:6px;border-radius:3px;font:italic .88rem 'Baskerville',Georgia,serif;cursor:pointer">
        <strong>${m.charAt(0).toUpperCase()+m.slice(1)}</strong><br><span style="font-size:.8rem">${descs[m]}</span>
    </button>`).join('')}
    `;
}
function _fillBroodPanel(ring){
    const need=Math.ceil(G.bees/20);
    const ok=G.nurses>=need;
    const r=document.getElementById('panel-body');
    if(G.season==='Winter'){r.innerHTML=`<p style="color:#78a8d8;font-style:italic;margin:0">No new brood is being laid. The queen rests.</p>`;return;}
    r.innerHTML=`
    <p style="color:${ok?'#58c858':'#d04040'};margin:0 0 10px">Nurses: ${G.nurses}/${need} — ${ok?'adequate':'insufficient'}</p>
    <p style="color:#c8a860;font-size:.82rem;margin:0 0 8px">Brood day ${G.brood}/20 · ${ring==='b1'?'Inner ring (6 cells)':'Outer ring (12 cells)'}</p>
    ${G._distress.length>0?`<p style="color:#d04040;margin:0 0 8px">${G._distress.length} distressed cell${G._distress.length>1?'s':''}</p><button class="act-btn" onclick="clearDistress()">Clear distressed cells</button>`:''}
    `;
}
function _fillHoneyRingPanel(){
    const HM=Math.max(90,~~(G.bees*.5));
    const pct=Math.min(100,~~(G.honey/HM*100));
    const winterNeed=~~(G.bees*0.08*15);
    const r=document.getElementById('panel-body');
    r.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div class="stat-box"><div class="stat-n">${~~G.honey}</div><div class="stat-l">lbs stored</div></div>
        <div class="stat-box"><div class="stat-n">${pct}%</div><div class="stat-l">of ring cap</div></div>
    </div>
    <p style="color:#d09020;font-size:.82rem;margin:0 0 6px">Winter need: ${winterNeed} lbs</p>
    ${G.honey>=winterNeed?`<p style="color:#58c858;font-size:.82rem;margin:0">On track for winter</p>`:`<p style="color:#d04040;font-size:.82rem;margin:0">Short by ${winterNeed-~~G.honey} lbs</p>`}
    <p style="color:#3a5a30;font-size:.75rem;margin:8px 0 0">Nectar buffer: ${~~G.nectar}/25 lbs · ${G.processors} processor${G.processors!==1?'s':''}</p>
    `;
}

// ── PANEL OPEN/CLOSE ──────────────────────────────────────────────────────────
function openPanel(k){
    const t=G.tiles[k];if(!t)return;
    G.selKey=k;G.panelOpen=true;
    const def=TD[t.type];
    document.getElementById('panel-title').textContent=def?def.label:'Tile';
    fillPanel(k);
    const p=document.getElementById('panel');
    p.style.display='block';p.style.transform='translateY(0)';
    Snd.tap();hap([20]);
}
function openFogPanel(k,q,r){
    G.selKey=k;G.panelOpen=true;G.fogPanel={k,q,r};
    document.getElementById('panel-title').textContent='Unknown Territory';
    _fillFogPanel(k);
    const p=document.getElementById('panel');
    p.style.display='block';p.style.transform='translateY(0)';
    Snd.tap();
}
function openHiveCell(type){
    G.panelOpen=true;
    const titles={queen:'The Queen',b1:'Inner Brood Ring',b2:'Outer Brood Ring',honey:'Honey Reserve'};
    document.getElementById('panel-title').textContent=titles[type]||type;
    if(type==='queen')_fillQueenPanel();
    else if(type==='b1'||type==='b2')_fillBroodPanel(type);
    else if(type==='honey')_fillHoneyRingPanel();
    const p=document.getElementById('panel');
    p.style.display='block';p.style.transform='translateY(0)';
    Snd.tap();hap([20]);
}
function closePanel(){
    G.panelOpen=false;G.selKey=null;G.fogPanel=null;_pendN=null;
    const p=document.getElementById('panel');
    p.style.transform='translateY(100%)';
    setTimeout(()=>{if(!G.panelOpen)p.style.display='none';},300);
}
document.getElementById('px').addEventListener('click',closePanel);

// ── VIEW / SPEED ──────────────────────────────────────────────────────────────
function setView(v){
    if(G.view===v)return;
    G.view=v;closePanel();
    document.getElementById('tab-map').classList.toggle('tab-active',v==='map');
    document.getElementById('tab-hive').classList.toggle('tab-active',v==='hive');
    if(window._S){
        const S=window._S;
        if(v==='hive'){
            S.bgG.setVisible(false);S.hvG.setVisible(true);
            Object.values(S.fTx).forEach(t=>t.setVisible(false));
            S.cam.setScroll(-S.cam.width/2,-S.cam.height/2);
            S.drawHive();
        }else{
            S.bgG.setVisible(true);S.hvG.setVisible(false);
            Object.values(S.fTx).forEach(t=>t.setVisible(true));
            S.cam.setScroll(-S.cam.width/2,-S.cam.height/2);
            S.drawMap();
        }
    }
    hud();
}
function cycleSpeed(){
    G.speed=G.speed>=3?1:G.speed+1;
    G.ms=G.speed===3?1000:G.speed===2?2000:3000;
    const lbl=['','1×','2×','3×'][G.speed]||'1×';
    document.getElementById('speed-btn').textContent=lbl;
    toast(`Speed: ${lbl}`,'info');save();
}
document.getElementById('tab-map').addEventListener('click',()=>setView('map'));
document.getElementById('tab-hive').addEventListener('click',()=>setView('hive'));
document.getElementById('speed-btn').addEventListener('click',cycleSpeed);
document.getElementById('new-game-btn').addEventListener('click',newGame);
