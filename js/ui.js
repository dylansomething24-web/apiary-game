const $=id=>document.getElementById(id);
const f1=n=>(Math.round(n*10)/10).toFixed(1);
const sgn=n=>(n>=0?'+':'−')+f1(Math.abs(n));

// Don't rebuild a screen while a finger is on it (that's what eats taps)
let _holdUntil=0;
['pointerdown','pointerup','touchstart','touchend'].forEach(ev=>document.addEventListener(ev,()=>{_holdUntil=performance.now()+450;},true));

// ── TOASTS ────────────────────────────────────────────────────────────────────
function toast(msg,type='info'){
    const box=$('toasts');if(!box)return;
    const el=document.createElement('div');el.className='toast t-'+type;el.textContent=msg;
    box.appendChild(el);while(box.children.length>3)box.firstChild.remove();
    setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),400);},type==='mile'?5000:3600);
    if(type==='mile')Snd.mile();
}

// ── CHOICE MODAL ──────────────────────────────────────────────────────────────
let _choice=null;
function showChoice({icon,title,body,a,b}){
    _choice={a:a.fn,b:b.fn};
    $('ch-icon').textContent=icon||'';$('ch-title').textContent=title;$('ch-body').textContent=body;
    $('ch-a').innerHTML=`${a.label}<small>${a.hint||''}</small>`;
    $('ch-b').innerHTML=`${b.label}<small>${b.hint||''}</small>`;
    ovShow('ov-c');
}

// ── ALERTS (most urgent problem, always visible) ──────────────────────────────
function alerts(e){
    const out=[];
    if(G.honey<1&&e.net<0)out.push(['bad','Out of honey — bees are starving. Send foragers and keep processors working.']);
    if(e.bs.larvae>e.nurseCap)out.push(['bad',`Only ${e.nurseCap} of ${e.bs.larvae} larvae can be fed — add nurses.`]);
    if(G.season!=='Winter'&&e.bs.empty===0)out.push(e.dpg&&G.builders>0
        ?['warn','Brood cells are full — builders are deepening storage, not adding comb. Pause it in Colony → Comb.']
        :G.builders>0&&e.canBuild
        ?['info','Brood cells are full — the queen waits while builders add comb.']
        :['warn','No empty brood cells — the queen can’t lay. Add builders or paint brood cells.']);
    if(G.honey+G.nectar>=e.cap-0.5&&e.nectarIn>0)out.push(['warn','Storage full — add builders or paint storage cells.']);
    if(G.nectar>4&&e.nectarIn>e.procCap)out.push(['warn','Nectar is piling up — add processors.']);
    if(G.season==='Fall'&&G.honey<winterNeed())out.push(['warn',`Winter needs ~${winterNeed()} lb honey — you have ${G.honey.toFixed(0)}.`]);
    if(foragerTotal()===0&&G.season!=='Winter')out.push(['info','No foragers out — tap a flower tile next to the hive, or use Colony → Foraging.']);
    if(idle()>3&&G.season!=='Winter')out.push(['info',`${idle()} bees are idle — give them work in the Colony tab.`]);
    if(G.guards<guardsNeeded()&&(G.year-1)*YEAR+G.day>15)out.push(['info',`Guards ${G.guards}/${guardsNeeded()} — raiders can get in.`]);
    return out;
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function hud(e){
    $('h-bees').textContent=G.bees;
    $('h-honey').textContent=f1(G.honey);
    $('h-cap').textContent=f1(e.cap);
    $('h-nectar').textContent=f1(G.nectar);
    const net=$('h-net');net.textContent=sgn(e.net)+'/day';net.className='hv '+(e.net>=0?'good':'bad');
    $('h-date').textContent=`${G.season} · Day ${dayInSeason(G.day)} · Year ${G.year}`;
    $('h-date').style.color=SCOL[G.season];
    $('h-stage').textContent=STAGE_NAMES[getStage()];
    $('speed-btn').textContent=(G.speed===0.5?'½':G.speed)+'×';
    const pb=$('pause-btn');pb.textContent=G.paused?'▶ Play':'❚❚';pb.classList.toggle('on',!!G.paused);    const al=alerts(e)[0];
    const a=$('h-alert');
    if(al){a.textContent=al[1];a.className='alert a-'+al[0];}
    else{a.textContent='The colony is working well.';a.className='alert a-ok';}
    a.hidden=false;
}

// ── ACTIONS (every button in the game goes through here) ──────────────────────
const ACT={
    role(d){
        const r=d.r,delta=+d.d;
        if(delta>0){const n=Math.min(delta,idle());if(!n){toast('No idle bees — take some off another job first','warn');return;}G[r]+=n;}
        else G[r]=Math.max(0,G[r]+delta);
    },
    fa(d){
        const k=d.k,delta=+d.d,t=G.tiles[k];
        if(delta>0){
            if(!inRange(t)){toast('Too far — the colony needs more bees to reach it','warn');return;}
            const n=Math.min(delta,idle());if(!n){toast('No idle bees — take some off another job first','warn');return;}
            G.fa[k]=(G.fa[k]||0)+n;
        }else{G.fa[k]=Math.max(0,(G.fa[k]||0)+delta);if(!G.fa[k])delete G.fa[k];}
    },
    farecall(d){delete G.fa[d.k];},
    autoforage(){
        const n=idle();if(!n){toast('No idle bees to send','warn');return;}
        const best=Object.keys(G.tiles).filter(k=>inRange(G.tiles[k])&&TD[G.tiles[k].type].forage).sort((a,b)=>tileYield(b)-tileYield(a))[0];
        if(!best){toast('No flowers in range','warn');return;}
        G.fa[best]=(G.fa[best]||0)+n;toast(`${n} bees sent to the ${TD[G.tiles[best].type].label}`,'green');
    },
    pa(d){
        if(getStage()<2){toast('Pollinators unlock after your first winter','warn');return;}
        const k=d.k,delta=+d.d,t=G.tiles[k];
        if(delta>0){
            if(!inRange(t)){toast('Too far — the colony needs more bees to reach it','warn');return;}
            const n=Math.min(delta,idle());if(!n){toast('No idle bees','warn');return;}
            G.pa[k]=(G.pa[k]||0)+n;
        }else{G.pa[k]=Math.max(0,(G.pa[k]||0)+delta);if(!G.pa[k])delete G.pa[k];}
    },
    scout(d){sendScout(d.k);},
    qmode(d){setQueenMode(d.v);},
    newcomb(d){G.newComb=d.v;},
    hmode(d){G.hmode=d.v;if(d.v!=='inspect')closePanel();},
    zoom(d){if(window._S)window._S.zoomBy(+d.d);},
    fit(){if(window._S)window._S.fitHive();},
    cellset(d){setCell(d.k,d.v);},
    view(d){if(d.t)G.ctab=d.t;setView(d.v);},
    ctab(d){G.ctab=d.v;},
    deepen(){
        if((G.combLvl||0)>=DEEP_CAPS.length-1)return;
        G.deepen=!G.deepen;
        if(G.deepen&&!G.builders)toast('Deepening needs builders — assign some in Colony → Workers','warn');
    },
    speed(){G.speed=SPEEDS[(SPEEDS.indexOf(G.speed)+1)%SPEEDS.length];if(G.paused)G.paused=false;},
    pause(){G.paused=!G.paused;},
    close(){closePanel();},
    begin(){beginGame();},
    choice(d){ovHide('ov-c');const f=_choice&&_choice[d.c];_choice=null;if(f)f();},
    prepswarm(){prepSwarm();},
    newgame(d,btn){
        if(btn.dataset.armed){newGame();return;}
        btn.dataset.armed='1';btn.textContent='Tap again to abandon this colony';
        setTimeout(()=>{if(btn.isConnected){delete btn.dataset.armed;btn.textContent='Start a new colony';}},3000);
        return'norender';
    },
    restart(){newGame();},
};
document.addEventListener('click',ev=>{
    const b=ev.target.closest('[data-a]');if(!b||b.disabled)return;
    const f=ACT[b.dataset.a];if(!f)return;
    Snd._start();Snd.tap();hap(12);
    const res=f(b.dataset,b);
    if(res==='norender')return;
    save();if(window._S)window._S.refresh();renderAll();
});

function setCell(k,v,quiet){
    const c=G.comb[k];if(!c||c.t==='q')return false;
    if(c.t===v){if(c.p){delete c.p;return true;}return false;}
    if(v==='b'){
        if(G.honey+G.nectar>capacity()*(combCount('s')-1)/combCount('s')){if(!quiet)toast('That storage is full of honey — can’t clear it','warn');return false;}
        c.t='b';c.a=-1;delete c.p;return true;
    }
    if(c.a>=0||c.d>0){if(c.p==='s')return false;c.p='s';if(!quiet)toast('This cell will become storage once its bee hatches','info');return true;}
    c.t='s';delete c.a;c.a=-1;return true;
}

// ── VIEWS ─────────────────────────────────────────────────────────────────────
function setView(v){
    if(G.view===v)return;
    if(window._S)window._S.saveCam();
    G.view=v;closePanel();
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.v===v));
    $('colony').hidden=v!=='colony';
    $('hivebar').hidden=v!=='hive';
    if(window._S)window._S.showView(v);
    renderAll();
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function renderAll(fromTick){
    const e=econ();
    hud(e);
    if(fromTick&&performance.now()<_holdUntil)return;
    if(G.view==='colony')renderColony(e);
    if(G.view==='hive')renderHivebar();
    if(G.sel)renderPanel(e);
}

const btn=(label,a,data='',cls='')=>`<button class="${cls}" data-a="${a}" ${data}>${label}</button>`;
const steps=(a,data,big=true)=>`<div class="steps">${(big?[-5,-1,1,5]:[-1,1]).map(d=>btn((d>0?'+':'−')+Math.abs(d),a,`${data} data-d="${d}"`)).join('')}</div>`;
const bar=(pct,cls='')=>`<div class="bar ${cls}"><i style="width:${clamp(pct,0,100)}%"></i></div>`;

function roleRow(key,label,desc,status){
    return`<div class="row"><div class="row-top"><span class="rname">${label}</span><span class="rnum">${G[key]}</span></div>
    <div class="rdesc ${status||''}">${desc}</div>${steps('role',`data-r="${key}"`)}</div>`;
}

const CTABS=[['stores','Stores'],['workers','Workers'],['forage','Foraging'],['queen','Queen'],['comb','Comb'],['record','Record']];
let _lastCtab='';
function renderColony(e){
    const bs=e.bs,stage=getStage(),gn=guardsNeeded();
    const fill=(G.honey+G.nectar)/Math.max(1,e.cap)*100;
    if(!CTABS.some(t=>t[0]===G.ctab))G.ctab='stores';
    const tab=G.ctab;
    let h='';

    if(tab==='stores'){
    h+=`<section class="card"><h3>Stores</h3>
    <div class="kv"><span>Honey</span><b>${f1(G.honey)} lb</b></div>
    <div class="kv"><span>Nectar waiting</span><b>${f1(G.nectar)} lb</b></div>
    <div class="kv"><span>Storage used</span><b>${f1(G.honey+G.nectar)} / ${f1(e.cap)} lb</b></div>${bar(fill,fill>90?'warnbar':'')}
    <div class="ledger">
      <div><span>Processed into honey</span><b class="good">+${f1(e.honeyIn)}</b></div>
      <div><span>Adult bees eat</span><b class="bad">−${f1(e.adultCost)}</b></div>
      <div><span>Larvae fed by nurses</span><b class="bad">−${f1(e.larvaCost)}</b></div>
      <div><span>Wax for comb work</span><b class="bad">−${f1(e.buildCost)}</b></div>
      <div class="tot"><span>Honey per day</span><b class="${e.net>=0?'good':'bad'}">${sgn(e.net)}</b></div>
    </div>
    ${G.season==='Fall'||G.season==='Winter'?`<div class="note ${G.honey>=winterNeed()?'good':'bad'}">Winter needs about ${winterNeed()} lb.</div>`:''}
    </section>`;
    }

    if(tab==='workers'){
    h+=`<section class="card"><h3>Workers <span class="sub">${G.bees} bees · <b class="${idle()?'warn':''}">${idle()} idle</b></span></h3>
    ${roleRow('nurses','Nurses',`Feed larvae (honey from stores). Can feed ${e.nurseCap}; ${bs.larvae} larvae now.`,bs.larvae>e.nurseCap?'bad':'good')}
    ${roleRow('processors','Processors',`Turn nectar into honey: ${f1(e.procCap)} lb nectar/day max → ${f1(e.procCap*PROC_EFF)} lb honey.`,e.nectarIn>e.procCap?'warn':'')}
    ${roleRow('builders','Builders',e.dpg?`Deepening storage: ${f1(e.deepRate)} cells/day, using ${f1(e.buildCost)} lb honey as wax.${G.season==='Winter'?' Resting for winter.':''}`:e.canBuild?`Draw ${f1(e.buildRate)} new cells/day, using ${f1(e.buildCost)} lb honey as wax.`:'The comb is at full size.','')}
    ${roleRow('guards','Guards',`Defend the entrance. About ${gn} needed at this size.`,G.guards<gn?'warn':'good')}
    </section>`;
    }

    if(tab==='forage'){
    const fk=Object.keys(G.fa);
    h+=`<section class="card"><h3>Foragers <span class="sub">${foragerTotal()} out · ${f1(e.nectarIn)} lb nectar/day</span></h3>
    ${fk.length?fk.map(k=>{const t=G.tiles[k];return`<div class="row"><div class="row-top"><span class="rname">${TD[t.type].label}</span><span class="rnum">${G.fa[k]}</span></div>
      <div class="rdesc">${STG[t.stage]} · ${f1(tileYield(k)*G.fa[k])} lb/day${hasWater(t)?' · water bonus':''}</div>${steps('fa',`data-k="${k}"`)}</div>`;}).join(''):'<p class="hint">No foragers yet. Tap a flower tile on the Map, or:</p>'}
    ${btn(`Send all ${idle()} idle bees to the best flowers`,'autoforage','','wide')}
    <p class="hint">Flowers within ${G.frad} hex${G.frad>1?'es':''} of the hive can be foraged. Range grows at 100 and 400 bees.</p>
    </section>`;

    const dz=Object.keys(G.tiles).filter(k=>G.tiles[k].type==='DEAD_ZONE');
    h+=`<section class="card"><h3>Pollinators <span class="sub">${pollTotal()} restoring</span></h3>`;
    if(stage<2)h+=`<p class="hint">Locked until your colony survives its first winter. Then pollinators can bring dead zones back to life.</p>`;
    else if(!dz.length)h+=`<p class="hint">No dead zones on your land.</p>`;
    else h+=dz.map(k=>{const t=G.tiles[k],ok=inRange(t),p=G.restore[k]||0,n=G.pa[k]||0;
        return`<div class="row"><div class="row-top"><span class="rname">Dead Zone ${hdist(t.q,t.r)} hex out</span><span class="rnum">${n}</span></div>
        ${bar(p,'greenbar')}<div class="rdesc">${ok?(n?`${~~p}% · about ${Math.ceil((100-p)/(n*3.5))} days left`:`${~~p}% restored`):'Out of range'}</div>${ok?steps('pa',`data-k="${k}"`,false):''}</div>`;}).join('');
    h+=`</section>`;

    h+=`<section class="card"><h3>Scouts <span class="sub">${G.scouts.length}/3 teams</span></h3>
    ${G.scouts.map(s=>`<div class="kv"><span>Team of ${s.n}</span><b>back in ${s.days} day${s.days>1?'s':''}</b></div>`).join('')}
    <p class="hint">Tap a dark tile at the edge of the Map to scout it. Costs ${SCOUT_BEES} idle bees for ${SCOUT_DAYS} days.</p>
    </section>`;
    }

    if(tab==='queen'){
    h+=`<section class="card"><h3>Queen</h3>
    <div class="kv"><span>Laying</span><b>${e.layRate} eggs/day</b></div>
    <div class="kv"><span>Brood cells</span><b>${bs.total} (${bs.empty} empty)</b></div>
    <div class="brood-mix"><span>Eggs ${bs.eggs}</span><span>Larvae ${bs.larvae}</span><span>Capped ${bs.capped}</span>${bs.dead?`<span class="bad">Dead ${bs.dead}</span>`:''}</div>
    <div class="seg">${['conserve','normal','overdrive'].map(m=>btn(m[0].toUpperCase()+m.slice(1),'qmode',`data-v="${m}"`,G.qMode===m?'on':'')).join('')}</div>
    ${stage<2?'<p class="hint">Laying modes unlock after the first winter. Tell her where to lay by painting brood cells in the Hive tab.</p>':'<p class="hint">Paint brood cells in the Hive tab to choose where she lays.</p>'}
    ${G.swarm>0?`<div class="kv"><span>Swarm pressure</span><b class="${G.swarm>60?'bad':''}">${~~G.swarm}%</b></div>${bar(G.swarm,'redbar')}${btn('Raise a swarm cell (5 lb honey, −45%)','prepswarm','','wide')}`:''}
    </section>`;
    }

    if(tab==='comb'){
    const total=Object.keys(G.comb).length,maxCells=3*MAX_COMB_R*(MAX_COMB_R+1)+1,lvl=G.combLvl||0,maxed=lvl>=DEEP_CAPS.length-1;
    h+=`<section class="card"><h3>Comb <span class="sub">${total} / ${maxCells} cells</span></h3>
    ${bar(total/maxCells*100)}
    <div class="kv"><span>Brood cells</span><b>${bs.total}</b></div>
    <div class="kv"><span>Storage cells</span><b>${combCount('s')}</b></div>
    <div class="kv"><span>Each storage cell holds</span><b>${f1(perCell())} lb</b></div>
    <div class="kv"><span>Total storage</span><b>${f1(e.cap)} lb</b></div>
    <div class="kv"><span>New cells become</span></div>
    <div class="seg">${[['auto','Auto'],['b','Brood'],['s','Storage']].map(([v,l])=>btn(l,'newcomb',`data-v="${v}"`,G.newComb===v?'on':'')).join('')}</div>
    <p class="hint">${G.newComb==='auto'?'Auto keeps brood in the middle and honey around the outside, like a real hive. The queen gets about three weeks of room.':G.newComb==='b'?'Every new cell is brood.':'Every new cell is storage.'}</p>
    ${total>=maxCells?'<p class="note">The comb has reached its full size.</p>':''}
    ${btn('Open the Hive to paint cells','view','data-v="hive"','wide')}
    </section>`;

    h+=`<section class="card"><h3>Deepen the cells <span class="sub">level ${lvl} / ${DEEP_CAPS.length-1}</span></h3>`;
    if(maxed)h+=`<p class="hint">Fully deepened — every storage cell holds ${cellCapAt(lvl)} lb.</p>`;
    else{
        const n=combCount('s'),left=Math.max(0,n-(G.deepDone||0)),cost=DEEP_COST[lvl],rate=G.builders*DEEP_RATE;
        h+=`<p class="desc">Builders go back over the storage cells and draw them deeper: ${cellCapAt(lvl)} → ${cellCapAt(lvl+1)} lb each.</p>
        ${bar((G.deepDone||0)/Math.max(1,n)*100,'greenbar')}
        <div class="kv"><span>Progress</span><b>${G.deepDone||0} / ${n} cells</b></div>
        <div class="kv"><span>Wax still needed</span><b>${f1(left*cost)} lb honey</b></div>
        <div class="kv"><span>Time with ${G.builders} builder${G.builders===1?'':'s'}</span><b>${rate?`about ${Math.ceil(left/rate)} days`:'needs builders'}</b></div>
        ${btn(G.deepen?'Pause deepening':'Start deepening','deepen','','wide')}
        <p class="hint">While deepening, builders don’t add new comb. The work rests in winter.</p>`;
    }
    h+=`</section>`;
    }

    if(tab==='record'){
    h+=`<section class="card"><h3>${G._colonyName||'Your Colony'}</h3>
    <div class="kv"><span>Stage</span><b>${STAGE_NAMES[stage]}</b></div>
    <p class="hint">Next: ${stageNextDesc()}</p>
    <div class="kv"><span>Winters survived</span><b>${G._wintersS}</b></div>
    <div class="kv"><span>Peak population</span><b>${G._peakB}</b></div>
    <div class="kv"><span>Honey made</span><b>${G._totH.toFixed(0)} lb</b></div>
    <div class="kv"><span>Dead zones restored</span><b>${G._tilesRestored}</b></div>
    ${btn('Start a new colony','newgame','','wide danger')}
    </section>`;
    }

    $('ctabs').innerHTML=CTABS.map(([v,l])=>btn(l,'ctab',`data-v="${v}"`,tab===v?'on':'')).join('');
    $('cbody').innerHTML=h;
    if(_lastCtab!==tab){$('cbody').scrollTop=0;_lastCtab=tab;}
}

function renderHivebar(){
    document.querySelectorAll('#hivebar [data-a="hmode"]').forEach(b=>b.classList.toggle('on',b.dataset.v===G.hmode));
    $('hb-hint').textContent=G.hmode==='inspect'?'Drag to move around · tap a cell to inspect it':(G.hmode==='b'?'Drag to paint brood cells (queen lays here)':'Drag to paint storage cells (honey goes here)')+' · two fingers to move';
}

// ── SLIDE-UP PANEL ────────────────────────────────────────────────────────────
function openSel(sel){G.sel=sel;renderPanel(econ());$('panel').classList.add('open');}
function closePanel(){G.sel=null;$('panel').classList.remove('open');if(window._S)window._S.clearHl();}

function renderPanel(e){
    const s=G.sel;if(!s)return;
    let title='',body='';
    if(s.kind==='fog'){
        const sc=G.scouts.find(m=>m.k===s.k);
        title='Unknown Land';
        body=`<p class="desc">Unexplored. Scouts will find out what grows here.</p>`+
            (sc?`<p class="note">Scouts return in ${sc.days} day${sc.days>1?'s':''}.</p>`:
             scoutable(s.k)?btn(`Send scouts (${SCOUT_BEES} bees, ${SCOUT_DAYS} days)`,'scout',`data-k="${s.k}"`,'wide'):
             `<p class="note">Too deep — scout the tiles closer to home first.</p>`);
    }else if(s.kind==='cell'){
        const c=G.comb[s.k];if(!c){closePanel();return;}
        if(c.t==='q'){title='The Queen';body=`<p class="desc">She lays ${e.layRate} eggs a day into empty brood cells, nearest the centre first.</p>${btn('Queen settings','view','data-v="colony" data-t="queen"','wide')}`;}
        else if(c.t==='b'){
            title='Brood Cell';
            const st=c.d>0?`Dead brood — nurses will clear it in ${c.d} day${c.d>1?'s':''}`:c.a<0?'Empty — waiting for an egg':c.a<=2?`Egg · day ${c.a+1} of 21`:c.a<=8?`Larva · day ${c.a+1} of 21 · needs a nurse`:`Capped pupa · hatches in ${21-c.a} days`;
            body=`<p class="desc">${st}</p>${c.p?'<p class="note">Will become storage after it hatches.</p>':''}${btn(c.p?'Keep as brood':'Make this a storage cell','cellset',`data-k="${s.k}" data-v="${c.p?'b':'s'}"`,'wide')}`;
        }else{
            title='Storage Cell';
            body=`<p class="desc">Holds ${f1(perCell())} lb. The hive is ${~~((G.honey+G.nectar)/Math.max(1,e.cap)*100)}% full (${f1(G.honey)} honey, ${f1(G.nectar)} nectar).</p>${btn('Make this a brood cell','cellset',`data-k="${s.k}" data-v="b"`,'wide')}`;
        }
    }else{
        const k=s.k,t=G.tiles[k];if(!t){closePanel();return;}
        const d=TD[t.type],ok=inRange(t),dist=hdist(t.q,t.r);
        title=d.label;
        if(t.type==='HIVE_BOX'){
            body=`<div class="kv"><span>Bees</span><b>${G.bees} (${idle()} idle)</b></div><div class="kv"><span>Honey</span><b>${f1(G.honey)} lb</b></div>
            ${btn('Manage workers','view','data-v="colony" data-t="workers"','wide')}${btn('Look inside the hive','view','data-v="hive"','wide')}`;
        }else if(t.type==='DEAD_ZONE'){
            const p=G.restore[k]||0,n=G.pa[k]||0;
            body=`<p class="desc">${d.desc}</p>${bar(p,'greenbar')}<p class="note">${~~p}% restored</p>`+
              (getStage()<2?`<p class="note warn">Pollinators unlock after your first winter.</p>`:
               !ok?`<p class="note warn">Out of range (${dist} hexes). Range grows with colony size.</p>`:
               `<div class="row"><div class="row-top"><span class="rname">Pollinators</span><span class="rnum">${n}</span></div>${steps('pa',`data-k="${k}"`)}</div>`);
        }else if(d.forage){
            const n=G.fa[k]||0,y=tileYield(k);
            body=`<div class="chips"><span class="chip">${STG[t.stage]}</span>${hasWater(t)?'<span class="chip blue">water +10%</span>':''}<span class="chip">${dist} hex out</span></div>
            <p class="desc">${d.desc}</p>
            <div class="kv"><span>Each forager brings</span><b>${y.toFixed(2)} lb nectar/day</b></div>`+
            (!ok?`<p class="note warn">Out of range. Your bees reach ${G.frad} hex${G.frad>1?'es':''}; range grows at 100 bees.</p>`:
            `<div class="row"><div class="row-top"><span class="rname">Foragers here</span><span class="rnum">${n}</span></div>
             <div class="rdesc">${f1(y*n)} lb nectar/day · ${idle()} idle bees at home</div>${steps('fa',`data-k="${k}"`)}</div>
             ${btn('Recall all','farecall',`data-k="${k}" ${n?'':'disabled'}`,'wide ghost')}`);
        }else body=`<p class="desc">${d.desc}</p>`;
    }
    $('panel-title').textContent=title;$('panel-body').innerHTML=body;
}
