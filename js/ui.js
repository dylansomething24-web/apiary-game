const $=id=>document.getElementById(id);
const f1=n=>(Math.round(n*10)/10).toFixed(1);
const sgn=n=>(n>=0?'+':'−')+f1(Math.abs(n));

// Don't rebuild a screen while a finger is on it (that's what eats taps)
let _holdUntil=0;
['pointerdown','pointerup','touchstart','touchend'].forEach(ev=>document.addEventListener(ev,()=>{_holdUntil=performance.now()+450;},true));

// ── TOASTS ────────────────────────────────────────────────────────────────────
function toast(msg,type='info'){
    const box=$('toasts');if(!box)return;
    const el=document.createElement('div');el.className='toast t-'+type;el.textContent=(_ctx?_ctx+': ':'')+msg;
    box.appendChild(el);while(box.children.length>3)box.firstChild.remove();
    setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),400);},type==='mile'?5000:3600);
    if(type==='mile')Snd.mile();
}

// ── CHOICE MODAL ──────────────────────────────────────────────────────────────
let _choice=null;
function showChoice({icon,title,body,a,b}){
    const hh=H();_choice={a:()=>withHive(hh,a.fn),b:()=>withHive(hh,b.fn)};
    $('ch-icon').textContent=icon||'';$('ch-title').textContent=title;$('ch-body').textContent=body;
    $('ch-a').innerHTML=`${a.label}<small>${a.hint||''}</small>`;
    $('ch-b').innerHTML=`${b.label}<small>${b.hint||''}</small>`;
    ovShow('ov-c');
}

// ── ALERTS (most urgent problem, always visible) ──────────────────────────────
function alerts(e){
    const out=[];
    if(instinctOn())return alerts5(e);
    if(G.honey<1&&e.net<0)out.push(['bad','Out of honey — bees are starving. Send foragers and keep processors working.']);
    if(e.bs.larvae>e.nurseCap)out.push(['bad',`Only ${e.nurseCap} of ${e.bs.larvae} larvae can be fed — add nurses.`]);
    if(G.season!=='Winter'&&e.bs.empty===0)out.push(e.dpg&&G.builders>0
        ?['warn','Brood cells are full — builders are deepening storage, not adding comb. Pause it in Colony → Hive.']
        :G.builders>0&&e.canBuild
        ?['info','Brood cells are full — the queen waits while builders add comb.']
        :['warn','No empty brood cells — the queen can’t lay. Add builders or paint brood cells.']);
    if(G.swarm>=60&&G.season!=='Winter')out.push([G.swarm>=85?'bad':'warn',`Swarm pressure ${~~G.swarm}% — tap to split or raise a queen cell.`,'swarm']);
    if(G.kp&&G.season!=='Winter'){
        if(G.sup.some(supFull))out.push(['warn',G.sup.length<MAX_SUP&&boxesStored()?'A super is 90% full. Pull it or add another.':'A super is 90% full. Pull it to make room.']);
        if(G._up&&!G.sup.length&&!boxesStored())out.push(['warn','No spare supers in the Storehouse.']);
        else if(!G.sup.length&&boxesStored())out.push(['info','This hive has no supers. Put some on in Supers.']);
    }
    if(G.honey+G.nectar>=e.cap-0.5&&e.nectarIn>0&&!(G.kp&&supRoom()>1))out.push(['warn',G.kp?'Brood box and supers are full. Add or pull supers.':'Storage full — add builders or paint storage cells.']);
    if(G.nectar>4&&e.nectarIn>e.procCap)out.push(['warn','Nectar is piling up — add processors.']);
    if(G.season==='Fall'&&G.honey<winterNeed())out.push(['warn',`Winter needs ~${winterNeed()} lb honey — you have ${G.honey.toFixed(0)}.`]);
    if(foragerTotal()===0&&G.season!=='Winter')out.push(['info','No foragers out — tap a flower tile next to the hive, or use Colony → Land.']);
    if(idle()>3&&G.season!=='Winter')out.push(['info',`${idle()} bees are idle — give them work in the Colony tab.`]);
    if(G.guards<guardsNeeded()&&(G.year-1)*YEAR+G.day>15)out.push(['info',`Guards ${G.guards}/${guardsNeeded()} — raiders can get in.`]);
    return out;
}

// Level 5: the hives run their own jobs, so only problems the player can act on show
function alerts5(e){
    const out=[];
    if(G.honey<1&&e.net<0)out.push(['bad','Out of honey — the bees are starving.']);
    if(e.bs.larvae>e.nurseCap)out.push(['bad',`Only ${e.nurseCap} of ${e.bs.larvae} larvae can be fed — the hive is short of bees.`]);
    if(G.swarm>=60&&G.season!=='Winter')out.push([G.swarm>=85?'bad':'warn',`Swarm pressure ${~~G.swarm}% — tap to split or raise a queen cell.`,'swarm']);
    if(G.kp&&G.season!=='Winter'){
        if(G.sup.some(supFull))out.push(['warn',G.sup.length<MAX_SUP&&boxesStored()?'A super is 90% full. Pull it or add another.':'A super is 90% full. Pull it to make room.']);
        if(G._up&&!G.sup.length&&!boxesStored())out.push(['warn','No spare supers in the Storehouse.']);
        else if(!G.sup.length&&boxesStored())out.push(['info','This hive has no supers. Put some on in Supers.']);
    }
    if(G.honey+G.nectar>=e.cap-0.5&&e.nectarIn>0&&!(G.kp&&supRoom()>1))out.push(['warn',G.kp?'Brood box and supers are full. Add or pull supers.':'The comb is full — nectar is being turned away.']);
    if(G.season==='Fall'&&G.honey<winterReserve())out.push(['warn',`Short of the winter reserve: ${G.honey.toFixed(0)} / ${winterReserve()} lb. Building has stopped.`]);
    if(G._rest>3&&G.season!=='Winter')out.push(['info',`${G._rest} bees have no open field. Scout or heal more land.`]);
    return out;
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function hud(e,fromTick){
    $('h-bees').textContent=G.bees;
    $('h-honey').textContent=f1(G.honey);
    $('h-cap').textContent=f1(e.cap);
    $('h-nectar').textContent=f1(G.nectar);
    const net=$('h-net');net.textContent=sgn(e.net)+'/day';net.className='hv '+(e.net>=0?'good':'bad');
    $('h-date').textContent=`${G.season} · Day ${dayInSeason(G.day)} · Year ${G.year}`;
    $('h-date').style.color=SCOL[G.season];
    $('h-stage').style.flex=G.kp?'none':'';
    $('h-stage').textContent=G.kp?`Lv ${G._lvl} ›`:`Lv ${G._lvl} · ${LEVELS[G._lvl].name} ›`;
    const kp=G.kp;$('h-money').hidden=!kp;
    if(kp){$('h-money').textContent='$'+money(kp.money)+(kp.debt?' · owe $'+money(kp.debt):'');$('h-money').classList.toggle('bad',kp.debt>0);}
    $('tab-house').hidden=!kp;const t2=$('tab-hive');t2.textContent=kp?'Supers':'Hive';t2.dataset.v=kp?'supers':'hive';
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.v===G.view||(G.view==='hive'&&t.id==='tab-hive')));
    $('speed-btn').textContent=(G.speed===0.5?'½':G.speed)+'×';
    const pb=$('pause-btn');pb.textContent=G.paused?'▶ Play':'❚❚';pb.classList.toggle('on',!!G.paused);    // the most urgent problem in any hive
    const rank={bad:0,warn:1,info:2};let best=null;const first=[];
    G.hives.forEach((h,i)=>{
        const al=withHive(h,()=>alerts(econ())[0]);first.push(al);
        if(!al)return;
        const score=rank[al[0]]*10+(i===G.ci?0:1);
        if(!best||score<best.score)best={score,i,al};
    });
    const a=$('h-alert');
    if(best){
        const other=best.i!==G.ci,sw=best.al[2]==='swarm';
        a.textContent=(G.hives.length>1?G.hives[best.i].name+': ':'')+best.al[1]+(other||sw?'  ›':'');a.className='alert a-'+best.al[0];
        if(sw||other){a.dataset.a=sw?'goswarm':'gohive';a.dataset.i=best.i;}else{delete a.dataset.a;delete a.dataset.i;}
    }else{a.textContent='The colony is working well.';a.className='alert a-ok';delete a.dataset.a;delete a.dataset.i;}
    const hs=$('hivesel');hs.hidden=G.hives.length<2;
    if(G.hives.length>1&&!(fromTick&&performance.now()<_holdUntil))hs.innerHTML=G.hives.map((h,i)=>`<button class="${i===G.ci?'on':''}${first[i]&&first[i][0]==='bad'?' bad':''}" data-a="gohive" data-i="${i}">${h.name}<small>${h.bees}</small></button>`).join('');
    a.hidden=false;
}

// ── ACTIONS (every button in the game goes through here) ──────────────────────
const ACT={
    role(d){
        if(instinctOn()){toast('The hives plan their own jobs now','info');return;}
        const r=d.r,delta=+d.d;
        if(delta>0){const n=Math.min(delta,idle());if(!n){toast('No idle bees — take some off another job first','warn');return;}G[r]+=n;}
        else G[r]=Math.max(0,G[r]+delta);
    },
    fa(d){
        const k=d.k,delta=+d.d,t=G.tiles[k];
        if(instinctOn()){toast('The hives send their own foragers now','info');return;}
        if(delta>0){
            if(isMill(k)){toast('The bees no longer forage where a mill stands','warn');return;}
            if(!inRange(t)){toast('Too far — the colony needs more bees to reach it','warn');return;}
            const room=tileSlots(k)-tileForagers(k);
            if(room<=0){toast('This field is full — more bees would only crowd it. Try another tile.','warn');return;}
            const n=Math.min(delta,idle(),room);if(!n){toast('No idle bees — take some off another job first','warn');return;}
            G.fa[k]=(G.fa[k]||0)+n;
        }else{G.fa[k]=Math.max(0,(G.fa[k]||0)+delta);if(!G.fa[k])delete G.fa[k];}
    },
    farecall(d){delete G.fa[d.k];},
    farecallall(){G.fa={};},
    autoforage(){
        let n=idle();if(!n){toast('No idle bees to send','warn');return;}
        const ks=Object.keys(G.tiles).filter(k=>inRange(G.tiles[k])&&TD[G.tiles[k].type].forage&&!isMill(k)).sort((a,b)=>tileYield(b)-tileYield(a));
        if(!ks.length){toast('No flowers in range','warn');return;}
        let sent=0,used=0;
        for(const k of ks){if(n<=0)break;const room=tileSlots(k)-tileForagers(k);if(room<=0)continue;const m=Math.min(room,n);G.fa[k]=(G.fa[k]||0)+m;n-=m;sent+=m;used++;}
        if(!sent){toast('Every field in range is full — scout further or heal more land','warn');return;}
        toast(`${sent} bees sent to ${used} field${used>1?'s':''}${n?` (${n} still idle — the fields are full)`:''}`,'green');
    },
    pa(d){
        if(G._lvl<2){toast('Pollinators open at Level 2, after your first winter','warn');return;}
        if(G.season==='Winter'){toast('Pollinators rest in winter. They head back out in spring.','info');return;}
        const delta=+d.d;if(delta>0)paAdd(d.k,delta);else paRemove(d.k,-delta);
    },
    psize(d){if(G.sel)G.sel.size=+d.v;},
    pbees(d){if(G.sel)G.sel.n=(G.sel.n||0)+(+d.d);},
    tripgo(d){if(G.sel&&sendTrip(d.k,G.sel.size||10,G.sel.n))closePanel();},
    tripend(d){const t=G.trips.find(x=>x.id===+d.id);if(t)endTrip(t,'The scouts head home');if(G.sel&&G.sel.kind==='fog')closePanel();},
    qmode(d){setQueenMode(d.v);},
    newcomb(d){G.newComb=d.v;},
    hmode(d){G.hmode=d.v;if(d.v!=='inspect')closePanel();},
    zoom(d){if(window._S)window._S.zoomBy(+d.d);},
    fit(){if(window._S)window._S.fitHive();},
    cellset(d){setCell(d.k,d.v);},
    view(d){if(d.t)G.ctab=d.t;if(d.h)G.htab=d.h;setView(d.v);},
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
    progress(){renderProgress();ovShow('ov-p');$('pbody').scrollTop=0;return'norender';},
    progclose(){ovHide('ov-p');},
    lvlok(){ovHide('ov-l');showNextLevel();},
    gohive(d){
        const i=+d.i;if(!G.hives[i]||i===G.ci)return;
        G.ci=i;closePanel();G.cams.hive=null;if(window._S)window._S.focusHive();
    },
    splitstart(){
        const c=canSplit();if(!c.ok){toast(c.reason,'warn');return;}
        G.placing=true;setView('map');closePanel();
        toast(`Tap a highlighted flower tile ${SPLIT_MINDIST} to ${SPLIT_MAXDIST} tiles away`,'green');
    },
    splitcancel(){G.placing=false;closePanel();},
    dosplit(d){if(doSplit(d.k)&&window._S)window._S.focusHive();},
    replay(d,btn){
        if(btn.dataset.armed){ovHide('ov-p');newGame();return;}
        btn.dataset.armed='1';btn.textContent='Tap again to start over at Level 1';
        setTimeout(()=>{if(btn.isConnected){delete btn.dataset.armed;btn.textContent='Replay from the beginning';}},3000);
        return'norender';
    },
    restart(){newGame();},
    hx(d){_hx[d.id]=!_hx[d.id];},
    swsplit(d){const i=+d.i;if(G.hives[i])G.ci=i;ACT.splitstart();},
    swcell(d){const h=G.hives[+d.i];if(h)withHive(h,prepSwarm);},
    goswarm(d){
        const h=G.hives[+d.i];if(!h)return;
        G.ci=G.hives.indexOf(h);G.ctab=instinctOn()?'swarms':'queen';setView('colony');
        setTimeout(()=>{const el=$('sw-'+h.id);if(el){el.scrollIntoView({block:'start'});el.classList.add('flash');}},0);
    },
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
    if(G.qMode==='auto'){if(!quiet)toast('Auto queen manages the cells. Switch her to a manual mode to paint.','info');return false;}
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
    G.view=v;if(v!=='map')G.placing=false;closePanel();
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.v===v));
    $('colony').hidden=v!=='colony';$('supers').hidden=v!=='supers';$('house').hidden=v!=='house';
    $('hivebar').hidden=v!=='hive';
    if(window._S)window._S.showView(v);
    renderAll();
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function renderAll(fromTick){
    const e=econ();
    hud(e,fromTick);
    $('placebar').hidden=!(G.placing&&G.view==='map');
    if(fromTick&&performance.now()<_holdUntil)return;
    if(G.view==='colony')renderColony(e);
    if(G.view==='hive')renderHivebar();
    if(G.view==='supers')renderSupers();
    if(G.view==='house')renderHouse();
    if(G.sel)renderPanel(e);
}

const btn=(label,a,data='',cls='')=>`<button class="${cls}" data-a="${a}" ${data}>${label}</button>`;
const steps=(a,data,big=true)=>`<div class="steps">${(big?[-5,-1,1,5]:[-1,1]).map(d=>btn((d>0?'+':'−')+Math.abs(d),a,`${data} data-d="${d}"`)).join('')}</div>`;
const bar=(pct,cls='')=>`<div class="bar ${cls}"><i style="width:${clamp(pct,0,100)}%"></i></div>`;

function roleRow(key,label,desc,status){
    return`<div class="row"><div class="row-top"><span class="rname">${label}</span><span class="rnum">${G[key]}</span></div>
    <div class="rdesc ${status||''}">${desc}</div>${steps('role',`data-r="${key}"`)}</div>`;
}

// pollinators and scouts: still the player's job at every level, pooled across the hives
function landCards(){
    let h='';const winter=G.season==='Winter';
    const mini=(a,k)=>`<button data-a="${a}" data-k="${k}" data-d="-1">−</button><button data-a="${a}" data-k="${k}" data-d="1">+</button>`;
    const dz=Object.keys(G.tiles).filter(k=>G.tiles[k].type==='DEAD_ZONE');
    const reach=k=>paHives(k).length>0,near=k=>{const t=G.tiles[k];return Math.min(...G.hives.map(hv=>hdist(t.q,t.r,hv.q,hv.r)));};
    const count=k=>paTotal(k)+(winter?G.hives.reduce((a,hv)=>a+((hv._paW||{})[k]||0),0):0);
    h+=`<section class="card"><h3>Pollinators <span class="sub">${dz.reduce((a,k)=>a+count(k),0)} restoring</span></h3>`;
    if(G._lvl<2)h+=`<p class="hint">Locked until your colony survives its first winter. Then pollinators can bring dead zones back to life.</p>`;
    else if(!dz.length)h+=`<p class="hint">No dead zones on your land.</p>`;
    else{
        dz.sort((a,b)=>reach(b)-reach(a)||count(b)-count(a)||(G.restore[b]||0)-(G.restore[a]||0)||near(a)-near(b));
        const rate=PA_RATE*(G._lvl>=3?1.2:1),far=dz.filter(k=>!reach(k)&&!count(k)).length;
        h+=dz.filter(k=>reach(k)||count(k)).map(k=>{const ok=reach(k),p=G.restore[k]||0,n=count(k);
            const from=G.hives.length>1&&paTotal(k)?' · '+G.hives.filter(hv=>hv.pa[k]).map(hv=>`${hv.name} ${hv.pa[k]}`).join(', '):'';
            return`<div class="frow"><div class="fi"><div class="rname">Dead Zone · ${near(k)} out</div>${bar(p,'greenbar')}
            <div class="rdesc">${!ok?'Out of reach of every hive':winter&&n?`${~~p}% · ${n} home for winter`:n?`${~~p}% · about ${Math.ceil((100-p)/(n*rate))} days left${from}`:`${~~p}% restored`}</div></div>
            <div class="fs">${ok?mini('pa',k).replace('</button><button','</button><b>'+n+'</b><button'):''}</div></div>`;}).join('');
        if(far)h+=`<div class="kv"><span>Out of reach of every hive</span><b>${far} dead zone${far===1?'':'s'}</b></div>`;
        h+=`<p class="hint">${winter?'Pollinators rest at home in winter and head back out on the first day of spring.':'Each + sends a bee from the closest hive that can reach the zone. When it is restored they fly home.'}</p>`;
    }
    h+=`</section>`;

    const out=G.hives.reduce((a,hv)=>a+hv.scouts.reduce((b,x)=>b+x.n,0),0);
    h+=`<section class="card"><h3>Scouting <span class="sub">${out} scout${out===1?'':'s'} out</span></h3>
    ${G.trips.map(t=>{const n=tripBees(t);
        return`<div class="row"><div class="row-top"><span class="rname">${t.name}</span><span class="rnum">${t.done}/${t.total}</span></div>${bar(t.done/t.total*100,'greenbar')}
        <div class="rdesc">${t.done} of ${t.total} mapped · ${winter?'waiting for spring':`${n} scout${n===1?'':'s'} · ${tripDays(t)} day${tripDays(t)===1?'':'s'} left`}</div>
        ${btn('Call them home','tripend',`data-id="${t.id}"`,'wide ghost')}</div>`;}).join('')||'<p class="hint">No scouts out.</p>'}
    <p class="hint">Tap a dark tile on the Map to pick a patch to map. One hex takes 6 bee-days, so 2 scouts map a hex in 3 days. Up to ${SCOUT_CAP} scouts from each hive, closest hive first.${winter?' Scouts stay home in winter.':''}</p>
    </section>`;
    return h;
}

// one Swarm and split card per hive
function swarmCard(hv,i){return withHive(hv,()=>{
    const cs=canSplit(),pl=splitPlan(),lv=G._lvl>=3;
    return`<section class="card" id="sw-${hv.id}"><h3>Swarm and split <span class="sub">${hv.name} · ${hv.bees} bees</span></h3>
      <div class="kv"><span>Swarm pressure</span><b class="${G.swarm>=85?'bad':G.swarm>=60?'warn':''}">${~~G.swarm}%</b></div>${bar(G.swarm,'redbar')}
      <div class="pair">${btn('Split the hive','swsplit',`data-i="${i}" ${cs.ok?'':'disabled'}`,'wide')}${btn('Raise a queen cell','swcell',`data-i="${i}" ${G.swarm>0&&G.honey>=5?'':'disabled'}`,'wide')}</div>
      ${cs.ok||!lv?'':`<div class="kv"><span>Forage range</span><b class="${G.frad>=SPLIT_REACH?'good':'bad'}">${G.frad} / ${SPLIT_REACH} tiles</b></div>
      <div class="kv"><span>Bees</span><b class="${G.bees>=SPLIT_MIN_BEES?'good':'bad'}">${G.bees} / ${SPLIT_MIN_BEES}</b></div>
      <div class="kv"><span>Season</span><b class="${G.season==='Spring'||G.season==='Summer'?'good':'bad'}">${G.season}</b></div>`}
      <p class="hint">${cs.ok?`A split takes ${pl.n} bees and ${f1(pl.honey+pl.nectar)} lb of stores to a new hive ${SPLIT_MINDIST} to ${SPLIT_MAXDIST} tiles away.`:cs.reason+'.'} A queen cell costs 5 lb of honey and takes 45% off the pressure. At 100% the old queen leaves with 40% of the bees, and they are lost.</p>
    </section>`;
});}

// ── COLONY PAGE FROM LEVEL 5 (the hives run themselves) ───────────────────────
const CTABS5=[['hives','Hives'],['land','Land'],['swarms','Swarms']];
let _hx={};   // which hive rows are open on the Hives tab
function renderColony5(e){
    if(!CTABS5.some(t=>t[0]===G.ctab))G.ctab='hives';
    const tab=G.ctab;let h='';
    if(tab==='hives'){
        h+=`<section class="card"><h3>Hive instincts <span class="sub">running on their own</span></h3>
          ${instincts().map(v=>`<div class="kv"><span>${v.inst}</span><b class="good">on</b></div>`).join('')}
          <p class="hint">Every hive plans its own jobs each morning and keeps a winter reserve before it builds. Pollinators, scouts, splitting and supers are still yours.</p></section>`;
        h+=`<section class="card"><h3>Hives <span class="sub">${G.hives.length} / ${MAX_HIVES} · ${totalBees()} bees</span></h3>`;
        G.hives.forEach((hv,i)=>{withHive(hv,()=>{
            const ee=econ(),res=winterReserve(),al=alerts(ee)[0],open=!!_hx[hv.id],bs=ee.bs,lvl=G.combLvl||0;
            const total=Object.keys(G.comb).length,maxCells=3*MAX_COMB_R*(MAX_COMB_R+1)+1;
            h+=`<div class="hrow5"><button class="hhead" data-a="hx" data-id="${hv.id}">
                <span class="dot ${al?'d-'+al[0]:'d-ok'}"></span><span class="rname">${hv.name}${i===G.ci?' <span class="sub">(here)</span>':''}</span>
                <span class="chev">${open?'▾':'▸'}</span><span class="hsum">${hv.bees} bees · ${f1(G.honey)} / ${res} lb · swarm ${~~G.swarm}%</span></button>`;
            if(open){
                const jobs=[['Nurses',G.nurses],['Processors',G.processors],['Guards',G.guards],['Builders',G.builders],['Foragers',foragerTotal()],['Pollinators',pollTotal()],['Scouts',scoutTotal()],['Resting',idle()]];
                h+=`<div class="hdet">
                  ${al?`<p class="note ${al[0]==='bad'?'bad':al[0]==='warn'?'warn':''}">${al[1]}</p>`:''}
                  <div class="lv-h">Jobs today</div><div class="jobgrid">${jobs.map(([l,n])=>`<div><b>${n}</b><span>${l}</span></div>`).join('')}</div>
                  <div class="lv-h">Honey per day</div>
                  <div class="ledger" style="margin-top:0;border-top:none">
                    <div><span>Made</span><b class="good">+${f1(ee.honeyIn)}</b></div>
                    <div><span>Eaten by bees and larvae</span><b class="bad">−${f1(ee.adultCost+ee.larvaCost)}</b></div>
                    <div><span>Wax for building</span><b class="bad">−${f1(ee.buildCost)}</b></div>
                    <div class="tot"><span>Net</span><b class="${ee.net>=0?'good':'bad'}">${sgn(ee.net)}</b></div></div>
                  <div class="kv"><span>Winter reserve</span><b class="${G.honey>=res?'good':'warn'}">${G.honey>=res?'ready for winter':`short ${Math.ceil(res-G.honey)} lb`}</b></div>
                  <div class="kv"><span>Comb</span><b>${total} / ${maxCells} cells · level ${lvl}</b></div>
                  <div class="kv"><span>Brood</span><b>${bs.eggs} eggs · ${bs.larvae} larvae · ${bs.capped} capped</b></div>
                  <div class="kv"><span>Queen</span><b>${ee.layRate} eggs/day</b></div>
                  ${G.kp?`<div class="kv"><span>Supers</span><b>${G.sup.length} on · ${f1(supHoney())} lb</b></div>`:''}
                  ${(G._log&&G._log.length)?`<div class="lv-h">What the hive did</div>${G._log.map(l=>`<div class="rdesc logl">${l}</div>`).join('')}`:''}
                  ${i===G.ci?'':btn('Go to this hive','gohive',`data-i="${i}"`,'wide ghost')}
                </div>`;
            }
            h+=`</div>`;
        });});
        h+=`</section>`;
        h+=`<section class="card"><h3>${G._colonyName||'Your Colony'}</h3>
          <div class="kv"><span>Level</span><b>${G._lvl} · ${LEVELS[G._lvl].name}</b></div>
          ${btn('See progress and levels','progress','','wide')}</section>`;
    }
    if(tab==='land'){
        const fk=Object.keys(G.fa).sort((a,b)=>tileYield(b)*G.fa[b]-tileYield(a)*G.fa[a]);
        h+=`<section class="card"><h3>Fields <span class="sub">${H().name} · ${foragerTotal()} out · ${f1(e.nectarIn)} lb nectar/day</span></h3>
          ${fk.length?fk.map(k=>{const t=G.tiles[k];return`<div class="kv"><span>${TD[t.type].label} · ${STG[t.stage]} · ${hiveDist(t)} out</span><b>${G.fa[k]} · ${f1(tileYield(k)*G.fa[k])} lb</b></div>`;}).join('')
            :`<p class="hint">${G.season==='Winter'?'No foraging in winter.':'No open fields in reach.'}</p>`}
          ${G._rest>0&&G.season!=='Winter'?`<p class="note warn">${G._rest} bees have no open field. Scout or heal more land.</p>`:''}
          <p class="hint">The hives send their own foragers to the best open fields each day. Reach: ${G.frad} tile${G.frad>1?'s':''}. Switch hives with the chips at the top.</p></section>`;
        h+=landCards();
    }
    if(tab==='swarms'){
        G.hives.map((hv,i)=>({hv,i})).sort((a,b)=>b.hv.swarm-a.hv.swarm).forEach(({hv,i})=>{h+=swarmCard(hv,i);});
    }
    $('ctabs').innerHTML=CTABS5.map(([v,l])=>btn(l,'ctab',`data-v="${v}"`,tab===v?'on':'')).join('');
    $('cbody').innerHTML=h;
    if(_lastCtab!==tab){$('cbody').scrollTop=0;_lastCtab=tab;}
}

const CTABS=[['hive','Hive'],['workers','Workers'],['land','Land'],['queen','Queen']];
let _lastCtab='';
function renderColony(e){
    if(instinctOn())return renderColony5(e);
    const bs=e.bs,stage=G._lvl,gn=guardsNeeded();
    const fill=(G.honey+G.nectar)/Math.max(1,e.cap)*100;
    if(!CTABS.some(t=>t[0]===G.ctab))G.ctab='hive';
    const tab=G.ctab;
    let h='';

    if(tab==='hive'){
    if(stage>=4)h+=`<section class="card"><h3>Queen and brood <span class="sub">Auto</span></h3>
    <div class="kv"><span>Laying</span><b>${e.layRate} eggs/day</b></div>
    <div class="kv"><span>Brood cells</span><b>${bs.total} (${bs.empty} empty)</b></div>
    <div class="brood-mix"><span>Eggs ${bs.eggs}</span><span>Larvae ${bs.larvae}</span><span>Capped ${bs.capped}</span>${bs.dead?`<span class="bad">Dead ${bs.dead}</span>`:''}</div>
    </section>`;
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

    if(tab==='land'){
    const fk=Object.keys(G.fa).sort((a,b)=>tileYield(b)*G.fa[b]-tileYield(a)*G.fa[a]);
    const mini=(a,k)=>`<button data-a="${a}" data-k="${k}" data-d="-1">−</button><button data-a="${a}" data-k="${k}" data-d="1">+</button>`;
    h+=`<section class="card"><h3>Foragers <span class="sub">${foragerTotal()} out · ${f1(e.nectarIn)} lb nectar/day</span></h3>
    ${fk.length?fk.map(k=>{const t=G.tiles[k],tf=tileForagers(k),sl=tileSlots(k);return`<div class="frow"><div class="fi"><div class="rname">${TD[t.type].label}</div>
      <div class="rdesc">${STG[t.stage]} · ${hiveDist(t)} out · ${f1(tileYield(k)*G.fa[k])} lb/day · ${tf}/${sl}${tf>sl?' <b class="bad">crowded</b>':''}</div></div>
      <div class="fs">${mini('fa',k).replace('</button><button','</button><b>'+G.fa[k]+'</b><button')}</div></div>`;}).join(''):'<p class="hint">No foragers yet. Tap a flower tile on the Map, or send the idle bees below.</p>'}
    <div class="pair">${btn(`Send ${idle()} idle`,'autoforage','','wide')}${btn('Recall all','farecallall',foragerTotal()?'':'disabled','wide ghost')}</div>
    <p class="hint">Reach: ${G.frad} tile${G.frad>1?'s':''} (grows at 100 and 250 bees). Each field feeds only so many foragers, and far flowers give less. Send picks the best open fields.</p>
    </section>`;

    h+=landCards();
    }

    if(tab==='queen'){
    const locked=G.hives.length<2;
    const qb=(m,l)=>btn(l,'qmode',`data-v="${m}"`,(G.qMode===m?'on ':'')+(m==='auto'&&locked?'off':''));
    if(stage<4)h+=`<section class="card"><h3>Queen</h3>
    <div class="kv"><span>Laying</span><b>${e.layRate} eggs/day${G.qMode==='auto'?' (auto)':''}</b></div>
    <div class="kv"><span>Brood cells</span><b>${bs.total} (${bs.empty} empty)</b></div>
    <div class="brood-mix"><span>Eggs ${bs.eggs}</span><span>Larvae ${bs.larvae}</span><span>Capped ${bs.capped}</span>${bs.dead?`<span class="bad">Dead ${bs.dead}</span>`:''}</div>
    <div class="seg four">${qb('auto','Auto')}${qb('conserve','Conserve')}${qb('normal','Normal')}${qb('overdrive','Overdrive')}</div>
    ${stage<2?'<p class="hint">Laying modes unlock after the first winter. Tell her where to lay by painting brood cells in the Hive tab.</p>'
      :'<p class="hint">Auto laying unlocks when you found a second hive. Until then, paint brood cells in the Hive tab to choose where she lays.</p>'}
    </section>`;
    G.hives.forEach((hv,i)=>{h+=swarmCard(hv,i);});
    }

    if(tab==='hive'){
    const total=Object.keys(G.comb).length,maxCells=3*MAX_COMB_R*(MAX_COMB_R+1)+1,lvl=G.combLvl||0,maxed=lvl>=DEEP_CAPS.length-1;
    h+=`<section class="card"><h3>Comb <span class="sub">${total} / ${maxCells} cells</span></h3>
    ${bar(total/maxCells*100)}
    <div class="kv"><span>Brood cells</span><b>${bs.total}</b></div>
    <div class="kv"><span>Storage cells</span><b>${combCount('s')}</b></div>
    <div class="kv"><span>Each storage cell holds</span><b>${f1(perCell())} lb</b></div>
    <div class="kv"><span>Total storage</span><b>${f1(e.cap)} lb</b></div>
    ${G.qMode==='auto'?'<p class="hint">The Auto queen is managing which cells are brood and which are storage.</p>':`<div class="kv"><span>New cells become</span></div>
    <div class="seg">${[['auto','Auto'],['b','Brood'],['s','Storage']].map(([v,l])=>btn(l,'newcomb',`data-v="${v}"`,G.newComb===v?'on':'')).join('')}</div>`}
    ${G.qMode==='auto'?'':`<p class="hint">${G.newComb==='auto'?'Auto keeps brood in the middle and honey around the outside, like a real hive. The queen gets about three weeks of room.':G.newComb==='b'?'Every new cell is brood.':'Every new cell is storage.'}</p>`}
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

    if(tab==='queen'){
    h+=`<section class="card"><h3>${G._colonyName||'Your Colony'}</h3>
    <div class="kv"><span>Level</span><b>${stage} · ${LEVELS[stage].name}</b></div>
    ${btn('See progress and levels','progress','','wide')}
    </section>`;
    h+=`<section class="card"><h3>Hives <span class="sub">${G.hives.length} / ${MAX_HIVES}</span></h3>
    ${G.hives.map((hv,i)=>`<div class="row"><div class="row-top"><span class="rname">${hv.name}</span><span class="rnum">${hv.bees}</span></div>
      <div class="rdesc">${f1(hv.honey)} lb honey · ${hdist(hv.q,hv.r)} tiles from the first hive · ${hv.qMode==='auto'?'Auto queen':hv.qMode}</div>
      ${i===G.ci?'<div class="note">You are here.</div>':btn('Go to this hive','gohive',`data-i="${i}"`,'wide ghost')}</div>`).join('')}
    </section>`;
    }

    $('ctabs').innerHTML=CTABS.map(([v,l])=>btn(v==='queen'&&stage>=4?'Swarms':l,'ctab',`data-v="${v}"`,tab===v?'on':'')).join('');
    $('cbody').innerHTML=h;
    if(_lastCtab!==tab){$('cbody').scrollTop=0;_lastCtab=tab;}
}

// ── PROGRESS SCREEN ───────────────────────────────────────────────────────────
function renderProgress(){
    const L=LEVELS[G._lvl],nx=LEVELS[G._lvl+1];
    const needRow=([l,v,t])=>`<div class="kv"><span>${l}</span><b class="${v>=t?'good':''}">${Math.min(v,t)} / ${t}</b></div>${bar(v/t*100,v>=t?'greenbar':'')}`;
    let h=`<section class="card"><div class="pl-n">Level ${G._lvl}</div><h3 class="pl-name">${L.name}</h3>
      ${G._colonyName?`<p class="hint">${G._colonyName}</p>`:''}
      ${nx?`<div class="lv-h">Next: Level ${G._lvl+1}, ${nx.name}</div>${nx.need().map(needRow).join('')}`
          :'<p class="hint">You have reached the top level for now. More levels will be added as the game grows.</p>'}
    </section>`;
    h+=`<section class="card"><h3>Levels</h3>${LEVELS.slice(1).map((v,i)=>{const n=i+1,st=n<G._lvl?'done':n===G._lvl?'cur':'lock';
        return`<div class="lvrow ${st}"><div class="lvbadge">${st==='done'?'✓':n}</div><div>
          <div class="rname">${v.name}</div>
          ${n>1?`<div class="rdesc">Needs: ${v.need().map(([l,,t])=>`${l} ${t}`).join(' · ')}</div>`:'<div class="rdesc">Where every colony begins</div>'}
          <div class="rdesc">Opens: ${v.opens.join(' · ')}</div>
          ${v.inst?`<div class="rdesc lvi">Hive instinct: ${v.inst}${v.soon?' (next update)':''}</div>`:''}
        </div></div>`;}).join('')}
      <div class="lvrow lock"><div class="lvbadge">…</div><div><div class="rdesc">More levels come as the colony grows.</div></div></div>
    </section>`;
    const ins=instincts();
    h+=`<section class="card"><h3>Hive instincts <span class="sub">jobs the bees now do on their own</span></h3>
      ${ins.length?ins.map(v=>`<div class="row"><div class="rname">${v.inst}${v.soon?' <span class="sub">(arrives next update)</span>':''}</div><div class="rdesc">${v.instD}</div></div>`).join('')
        :'<p class="hint">None yet. The first one, the Auto queen, arrives at Level 4.</p>'}
    </section>`;
    const p=restorationPct(),r=landRank();
    h+=`<section class="card"><h3>Land healing <span class="sub">${STG[r]}</span></h3>
      <div class="kv"><span>Land healed</span><b>${~~p}%</b></div>${bar(p,'greenbar')}
      <p class="hint">${r<3?`Next: ${STG[r+1]} at ${LAND_AT[r+1]}% healed.`:'Thriving land: varroa does 25% less harm.'} Healed land counts flower tiles at Recovering or better. Dead zones count against it.</p>
    </section>`;
    h+=`<section class="card"><h3>Colony record</h3>
      <div class="kv"><span>Year</span><b>${G.year}</b></div>
      <div class="kv"><span>Winters survived</span><b>${G._wintersS}</b></div>
      <div class="kv"><span>Most bees at once</span><b>${G._peakB}</b></div>
      <div class="kv"><span>Hives now / most</span><b>${G.hives.length} / ${G._maxHives}</b></div>
      <div class="kv"><span>Honey made</span><b>${G._totH.toFixed(0)} lb</b></div>
      <div class="kv"><span>Dead zones restored</span><b>${G._tilesRestored}</b></div>
    </section>`;
    const LR=lifeRec();
    h+=`<section class="card"><h3>Lifetime record <span class="sub">every colony you have played</span></h3>
      <div class="kv"><span>Colonies played</span><b>${LR.runs}</b></div>
      <div class="kv"><span>Highest level</span><b>${LR.lvl}</b></div>
      <div class="kv"><span>Most hives</span><b>${LR.hives}</b></div>
      <div class="kv"><span>Most bees at once</span><b>${LR.bees}</b></div>
      <div class="kv"><span>Most winters survived</span><b>${LR.years}</b></div>
      ${btn('Replay from the beginning','replay','','wide danger')}
      <p class="hint">Starts a fresh map at Level 1. This colony ends, and the lifetime record stays.</p>
    </section>`;
    $('pbody').innerHTML=h;
}

function renderHivebar(){
    document.querySelectorAll('#hivebar [data-a="hmode"]').forEach(b=>b.classList.toggle('on',b.dataset.v===G.hmode));
    $('hb-hint').textContent=G.qMode==='auto'?'Auto queen is managing the cells · drag to move, tap a cell to inspect':G.hmode==='inspect'?'Drag to move around · tap a cell to inspect it':(G.hmode==='b'?'Drag to paint brood cells (queen lays here)':'Drag to paint storage cells (honey goes here)')+' · two fingers to move';
}

// ── SLIDE-UP PANEL ────────────────────────────────────────────────────────────
function openSel(sel){G.sel=sel;renderPanel(econ());$('panel').classList.add('open');}
function closePanel(){G.sel=null;$('panel').classList.remove('open');if(window._S)window._S.clearHl();}

function renderPanel(e){
    const s=G.sel;if(!s)return;
    let title='',body='';
    if(s.kind==='fog'){
        const tr=tripOf(s.k);let hl=[];
        title='Unknown Land';
        if(tr){
            const w=G.season==='Winter';hl=tr.hexes;
            body=`<p class="desc">Scouts are mapping the ${tr.name.toLowerCase()}, nearest hex first.</p>${bar(tr.done/tr.total*100,'greenbar')}
              <div class="kv"><span>Mapped</span><b>${tr.done} of ${tr.total}</b></div>
              <div class="kv"><span>Scouts</span><b>${w?'home for winter':tripBees(tr)}</b></div>
              <div class="kv"><span>Time left</span><b>${w?'waiting for spring':`about ${tripDays(tr)} days`}</b></div>
              ${btn('Call the scouts home','tripend',`data-id="${tr.id}"`,'wide ghost')}`;
        }else{
            const size=s.size||10,hexes=patchAt(s.k,size),room=scoutRoomAll();hl=hexes;
            s.n=room?clamp(s.n==null?Math.min(room,SCOUT_CAP):s.n,1,room):0;
            body=!hexes.some(scoutable)?`<p class="desc">Unexplored.</p><p class="note">Too deep. Pick a dark tile closer to your land.</p>`
              :`<p class="desc">Scouts map the highlighted patch, one hex at a time, nearest first.</p>
              <div class="seg">${PATCH.map(([v,l])=>btn(`${l} · ${v}`,'psize',`data-v="${v}"`,size===v?'on':'')).join('')}</div>
              <div class="row"><div class="row-top"><span class="rname">Scouts</span><span class="rnum">${s.n}</span></div>
                <div class="rdesc">${room} free${G.hives.length>1?` across ${G.hives.length} hives`:''} · up to ${SCOUT_CAP} from each hive, closest first</div>${steps('pbees','')}</div>
              <div class="kv"><span>Patch</span><b>${hexes.length} hexes</b></div>
              <div class="kv"><span>Trip</span><b>${s.n?`about ${Math.ceil(HEX_WORK*hexes.length/s.n)} days`:'no bees free'}</b></div>
              ${G.season==='Winter'?'<p class="note warn">Scouts stay home in winter.</p>':''}
              ${btn(`Send ${s.n} scout${s.n===1?'':'s'}`,'tripgo',`data-k="${s.k}" ${s.n&&G.season!=='Winter'?'':'disabled'}`,'wide')}
              <p class="hint">One hex takes 6 bee-days: 2 scouts map a hex in 3 days.${instinctOn()?'':' Scouts must be idle bees.'}</p>`;
        }
        if(window._S)window._S.hlPatch(hl,s.k);
    }else if(s.kind==='cell'){
        const c=G.comb[s.k];if(!c){closePanel();return;}
        if(c.t==='q'){title='The Queen';body=`<p class="desc">She lays ${e.layRate} eggs a day into empty brood cells, nearest the centre first.</p>${btn('Queen settings','view','data-v="colony" data-t="queen"','wide')}`;}
        else if(c.t==='b'){
            title='Brood Cell';
            const st=c.d>0?`Dead brood — nurses will clear it in ${c.d} day${c.d>1?'s':''}`:c.a<0?'Empty — waiting for an egg':c.a<=2?`Egg · day ${c.a+1} of 21`:c.a<=8?`Larva · day ${c.a+1} of 21 · needs a nurse`:`Capped pupa · hatches in ${21-c.a} days`;
            body=`<p class="desc">${st}</p>${c.p?'<p class="note">Will become storage after it hatches.</p>':''}${G.qMode==='auto'?'<p class="note">The Auto queen is managing the cells.</p>':btn(c.p?'Keep as brood':'Make this a storage cell','cellset',`data-k="${s.k}" data-v="${c.p?'b':'s'}"`,'wide')}`;
        }else{
            title='Storage Cell';
            body=`<p class="desc">Holds ${f1(perCell())} lb. The hive is ${~~((G.honey+G.nectar)/Math.max(1,e.cap)*100)}% full (${f1(G.honey)} honey, ${f1(G.nectar)} nectar).</p>${G.qMode==='auto'?'<p class="note">The Auto queen is managing the cells.</p>':btn('Make this a brood cell','cellset',`data-k="${s.k}" data-v="b"`,'wide')}`;
        }
    }else if(s.kind==='place'){
        const k=s.k,t=G.tiles[k],err=siteError(k),pl=splitPlan();
        title='New hive site';
        body=err?`<p class="note warn">${err}.</p>`:`<div class="chips"><span class="chip">${TD[t.type].label}</span><span class="chip">${hiveDist(t)} tiles out</span></div>
          <p class="desc">Found a new hive here. It takes ${pl.n} bees and ${f1(pl.honey+pl.nectar)} lb of stores. The flowers on this tile are lost.</p>
          ${btn('Found the new hive here','dosplit',`data-k="${k}"`,'wide')}`;
    }else{
        const k=s.k,t=G.tiles[k];if(!t){closePanel();return;}
        const d=TD[t.type],ok=inRange(t),dist=hiveDist(t);
        title=d.label;
        if(t.type==='HIVE_BOX'){
            const hi=G.hives.findIndex(o=>o.q===t.q&&o.r===t.r),hv=G.hives[hi]||H();
            title=hv.name;
            body=hi===G.ci||hi<0
              ?`<div class="kv"><span>Bees</span><b>${G.bees} (${idle()} idle)</b></div><div class="kv"><span>Honey</span><b>${f1(G.honey)} lb</b></div>
                ${btn('Manage workers','view','data-v="colony" data-t="workers"','wide')}${G.kp?btn('Supers','view','data-v="supers"','wide'):''}${btn('Look inside the hive','view','data-v="hive"','wide')}`
              :`<div class="kv"><span>Bees</span><b>${hv.bees}</b></div><div class="kv"><span>Honey</span><b>${f1(hv.honey)} lb</b></div>
                ${btn('Go to this hive','gohive',`data-i="${hi}"`,'wide')}`;
        }else if(t.type==='DEAD_ZONE'){
            const p=G.restore[k]||0,n=paTotal(k);
            body=`<p class="desc">${d.desc}</p>${bar(p,'greenbar')}<p class="note">${~~p}% restored</p>`+
              (G._lvl<2?`<p class="note warn">Pollinators open at Level 2, after your first winter.</p>`:
               !paHives(k).length?`<p class="note warn">Out of reach of every hive. Reach grows with hive size.</p>`:
               G.season==='Winter'?`<p class="note">Pollinators rest at home in winter.</p>`:
               `<div class="row"><div class="row-top"><span class="rname">Pollinators</span><span class="rnum">${n}</span></div><div class="rdesc">From the closest hive that can reach it</div>${steps('pa',`data-k="${k}"`)}</div>`);
        }else if(isMill(k)){
            const m=G.kp.mills[k];title=MILL[m.lv].name;
            body=`<p class="desc">A lumber mill on a Thriving forest edge. The bees no longer forage here.</p>
              <div class="kv"><span>Boards on site</span><b>${Math.floor(m.boards+m.pool)}</b></div><div class="kv"><span>Supers on site</span><b>${m.sup}</b></div>
              ${m.why?`<p class="note warn">${m.why}</p>`:''}${btn('Manage in the Honey House','view','data-v="house" data-h="store"','wide')}`;
        }else if(d.forage){
            const n=G.fa[k]||0,y=tileYield(k);
            body=`<div class="chips"><span class="chip">${STG[t.stage]}</span>${hasWater(t)?'<span class="chip blue">water +10%</span>':''}<span class="chip">${dist} hex out</span><span class="chip">${Math.round(Math.max(.4,1-DIST_LOSS*(Math.max(1,dist)-1))*100)}% load</span></div>
            <p class="desc">${d.desc}</p>
            <div class="kv"><span>Each forager brings</span><b>${y.toFixed(2)} lb nectar/day</b></div>
            <div class="kv"><span>Field is feeding</span><b class="${tileForagers(k)>tileSlots(k)?'bad':''}">${tileForagers(k)} / ${tileSlots(k)} foragers</b></div>`+
            (!ok?`<p class="note warn">Out of range. Your bees reach ${G.frad} hex${G.frad>1?'es':''}; range grows at 100 bees.</p>`:
            instinctOn()?`<div class="kv"><span>Foragers here</span><b>${n}</b></div><p class="hint">The hives send their own foragers to the best open fields each day.</p>`:
            `<div class="row"><div class="row-top"><span class="rname">Foragers here</span><span class="rnum">${n}</span></div>
             <div class="rdesc">${f1(y*n)} lb nectar/day · ${idle()} idle bees at home</div>${steps('fa',`data-k="${k}"`)}</div>
             ${btn('Recall all','farecall',`data-k="${k}" ${n?'':'disabled'}`,'wide ghost')}`)+
            (G.kp&&t.type==='FOREST'?(t.stage>=3?`<div class="row"><div class="rname">Lumber mill</div><div class="rdesc">Build a sawpit here for $${money(MILL[1].cost)}. It makes boards and supers, and the bees stop foraging this tile for good.</div>${btn('Build a sawpit','millbuild',`data-k="${k}"`,'wide')}</div>`:'<p class="hint">A lumber mill can go here once this forest is Thriving.</p>'):'');
        }else body=`<p class="desc">${d.desc}</p>`;
    }
    if(s.kind==='tile'&&G.kp&&s.k===G.kp.hh){
        title=G.kp.camp?'Beekeeper’s camp':'Honey House';
        body=`<p class="desc">Where ${G.kp.name||'the beekeeper'} uncaps, extracts and bottles the honey.</p>${btn('Open the Honey House','view','data-v="house"','wide')}`+body;
    }
    $('panel-title').textContent=title;$('panel-body').innerHTML=body;
}
