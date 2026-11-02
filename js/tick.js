// ── TICK STATE ────────────────────────────────────────────────────────────────
let _nIn=0,_hday=0;

// ── SEASON FLASH ─────────────────────────────────────────────────────────────
function flashSeason(name){
    const c={Spring:'#50cc70',Summer:'#e8c030',Fall:'#c86020',Winter:'#78a8d8'}[name]||'#888';
    const el=document.createElement('div');
    el.style.cssText=`position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);z-index:900;pointer-events:none;`;
    el.innerHTML=`<div style="font:italic 3.2rem 'Baskerville',Georgia,serif;color:${c};text-shadow:0 0 40px ${c}88;">${name}</div>`;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),1500);
}

// ── MAIN TICK ─────────────────────────────────────────────────────────────────
function tick(){
    // ── Day advance ──────────────────────────────────────────────────────────
    G.day++;
    const totalDays=SLEN.reduce((a,b)=>a+b,0); // 100
    if(G.day>totalDays){G.day=1;G.year++;}
    const dv=doyNum(G.day);
    const newSeason=doyStr(G.day);

    // ── Season transitions ────────────────────────────────────────────────────
    if(newSeason!==G.season){
        const prev=G.season;
        G.season=newSeason;
        flashSeason(newSeason);
        // Winter → Spring: count survived winter
        if(newSeason==='Spring'&&prev==='Winter'){
            G._wintersS++;
            G._w82=false; // reset for next fall
            const stageNow=getStage();
            if(stageNow>G._stagePrev){G._stagePrev=stageNow;onStageAdvance(stageNow);}
        }
        // spring/summer forage radius by population
        const newRad=G.bees>=400?3:G.bees>=100?2:1;
        if(newRad>G.frad){G.frad=newRad;toast(`The colony's range extends — new tiles are now reachable`,'green');}
    }

    // ── Stage check (non-winter transitions) ─────────────────────────────────
    const stageNow=getStage();
    if(stageNow>G._stagePrev){G._stagePrev=stageNow;onStageAdvance(stageNow);}

    // ── Season multiplier ─────────────────────────────────────────────────────
    const eff={Spring:1.0,Summer:1.15,Fall:0.6,Winter:0}[G.season];

    // ── Foragers collect nectar ───────────────────────────────────────────────
    let nIn=0;
    Object.entries(G.fa).forEach(([k,n])=>{
        const t=G.tiles[k];if(!t||t.stage===0)return;
        const def=TD[t.type];if(!def||!def.forage)return;
        let bonus=1;
        nbrs(t.q,t.r).forEach(([nq,nr])=>{const nt=G.tiles[hkey(nq,nr)];if(nt&&nt.type==='WATER')bonus=1.1;});
        nIn+=def.forage*n*0.022*eff*bonus;
    });
    _nIn=nIn;G._nf+=nIn;
    const nAdd=~~G._nf;G._nf-=nAdd;
    const nCap=25;
    if(G.nectar+nAdd>nCap){
        G.nectar=nCap;
        if(!G._hbWarn){G._hbWarn=true;toast('Hive honey-bound — add more processors','warn');}
    }else{G.nectar+=nAdd;if(nAdd>0)G._hbWarn=false;}

    // ── Processors convert nectar → honey (75%) ───────────────────────────────
    const procCap=G.processors*1.5;
    const toProc=Math.min(G.nectar,procCap);
    G.nectar=Math.max(0,G.nectar-toProc);
    G._hf+=toProc*0.75;
    const hAdd=~~G._hf;G._hf-=hAdd;
    if(hAdd>0){G.honey+=hAdd;G._totH+=hAdd;}
    _hday=hAdd;

    // ── Nurse honey cost (feeding larvae) ─────────────────────────────────────
    if(G.season!=='Winter'&&G.nurses>0){
        G.honey=Math.max(0,G.honey-G.nurses*0.08);
    }

    // ── Winter consumption ────────────────────────────────────────────────────
    if(G.season==='Winter'){
        G.honey=Math.max(0,G.honey-G.bees*0.08);
        if(G.honey<=0&&G.bees>2){
            G.bees=Math.max(2,G.bees-~~(G.bees*0.06));
            if(G.bees<=20&&!G._wasLow)G._wasLow=true;
        }
    }

    // ── Brood cycle ───────────────────────────────────────────────────────────
    if(G.season!=='Winter'){
        G.brood=(G.brood+1)%21;
        if(G.brood===0){
            const need=Math.ceil(G.bees/20);
            if(G.nurses>=need){
                const qm={conserve:0.65,normal:1.0,overdrive:1.35}[G.qMode]||1;
                const added=~~(G.bees*0.06*qm);
                G.bees+=Math.max(1,added);
                if(G.bees>G._peakB)G._peakB=G.bees;
                // Swarm pressure
                if(G.bees>150&&(G.season==='Spring'||G.season==='Summer')){
                    const rate={conserve:0.8,normal:2,overdrive:3.5}[G.qMode]||2;
                    G.swarm=Math.min(100,G.swarm+rate);
                }
                // Natural attrition
                G.bees=Math.max(2,G.bees-~~(G.bees*0.015));
            }else{
                if(!G._nt||Math.random()<.3)toast('Nurse shortage — brood cells darkening','warn');
            }
            G._distress=G._distress.filter(()=>Math.random()>.1);
        }
    }

    // ── Swarm auto-fires at 100% ──────────────────────────────────────────────
    if(G.swarm>=100){
        const lost=~~(G.bees*0.28);G.bees=Math.max(2,G.bees-lost);G.swarm=0;
        toast(`The colony swarmed — ${lost} bees departed`,'warn');hap([100,50,100]);
        G._col++;
    }
    if(G.swarm>=80&&G.swarm<100&&G._col===0){
        G._col=1;toast('The colony grows restless','warn');
    }

    // ── Low-bee tracking ──────────────────────────────────────────────────────
    if(G.bees<=20&&!G._wasLow)G._wasLow=true;

    // ── Scout missions ────────────────────────────────────────────────────────
    G.scouts=G.scouts.filter(s=>{
        s.days--;
        if(s.days<=0){revealTile(s.k);return false;}
        return true;
    });

    // ── Pollinator restoration ────────────────────────────────────────────────
    const stage=getStage();
    const restBonus=stage>=3?1.2:1.0;
    Object.entries(G.pa).forEach(([k,n])=>{
        const t=G.tiles[k];
        if(!t||t.type!=='DEAD_ZONE'){delete G.pa[k];return;}
        if(!G.restore[k])G.restore[k]=0;
        G.restore[k]=Math.min(100,G.restore[k]+n*3.5*restBonus);
        if(G.restore[k]>=100){
            G.restore[k]=100;t.stage=1;t.type='WILDFLOWER';t._wasRevived=true;
            G._tilesRestored++;
            const recalled=G.pa[k];delete G.pa[k];
            toast(`A dead zone stirs back to life — ${recalled} pollinators recalled`,'green');
            hap([40,20,40,20,40]);Snd.revive();
            // Check stage advance from restoration
            const snew=getStage();
            if(snew>G._stagePrev){G._stagePrev=snew;onStageAdvance(snew);}
        }
    });

    // ── Tile healing ──────────────────────────────────────────────────────────
    if(G.day%5===0){
        const eligible=Object.values(G.tiles).filter(t=>{
            if(t.type==='HIVE_BOX'||t.type==='WATER'||t.type==='DEAD_ZONE'||t.type==='STRUCTURE')return false;
            if(t.stage>=3)return false;
            const d=hdist(t.q,t.r,0,0);
            return d<=G.frad;
        });
        if(eligible.length){
            const t=eligible[~~(Math.random()*eligible.length)];
            t.stage=Math.min(3,t.stage+1);
        }
    }

    // ── Forage radius update ──────────────────────────────────────────────────
    const newRad=G.bees>=400?3:G.bees>=100?2:1;
    if(newRad>G.frad){G.frad=newRad;toast(`The colony's range extends — new tiles reachable`,'green');}

    // ── Season warnings ───────────────────────────────────────────────────────
    const doy=G.day;
    const fallStart=sfrom('Fall');
    const winterStart=sfrom('Winter');
    const winterNeed=Math.ceil(G.bees*0.08*15);
    if(doy===fallStart+17&&!G._wW){ // day 78
        G._wW=true;
        if(G.honey<winterNeed)toast(`Winter in ${SLEN[2]-(doy-fallStart)} days — need ${winterNeed} lbs, have ${~~G.honey}`,'warn');
    }
    if(doy===fallStart+21&&!G._w82){ // day 82
        G._w82=true;
        if(G.honey<winterNeed)toast(`CRITICAL: Winter in ${winterStart-doy} days — ${winterNeed-~~G.honey} lbs short`,'warn');hap([200,100,200]);
    }

    // ── Hive collapse check ───────────────────────────────────────────────────
    if(G.bees<=2){
        G._col++;
        if(G._col>=3)return collapse();
    }else G._col=0;

    // ── Threats (every 22–44 days) ────────────────────────────────────────────
    G._nt--;
    if(G._nt<=0){
        G._nt=22+~~(Math.random()*22);
        if(Math.random()<.6)threat();
    }

    // ── Milestones ────────────────────────────────────────────────────────────
    checkMS();

    // ── Ambient volume ────────────────────────────────────────────────────────
    Snd.setVol();

    // ── Save + redraw ─────────────────────────────────────────────────────────
    save();
    if(window._S)window._S.refresh();
    hud();
}

// ── THREAT SYSTEM ─────────────────────────────────────────────────────────────
function threat(){
    const pool=[];
    // Standard threats
    pool.push({w:3,fn:()=>wasp()},{w:2.5,fn:()=>varroa()},{w:1,fn:()=>bear()});
    // Seasonal
    if(G.season==='Summer')pool.push({w:1.5,fn:()=>goodWeather()});
    pool.push({w:1,fn:()=>diseasedFlower()});
    // Total weight
    const total=pool.reduce((a,b)=>a+b.w,0);
    let r=Math.random()*total;
    for(const e of pool){r-=e.w;if(r<=0){e.fn();return;}}
    pool[pool.length-1].fn();
}

function wasp(){
    if(G.guards>=3){toast('Your guards drove off the wasp scouts','green');return;}
    Snd.danger();hap([80,40,80]);
    showChoice({
        icon:'🪲',title:'Wasp Raid',
        body:`Wasps have found the entrance. ${G.guards} guards are holding them off.`,
        a:{label:'Rally the guards — fight them off',fn:()=>{const lost=~~(Math.max(0,(3-G.guards)*5)+G.honey*.05);G.honey=Math.max(0,G.honey-lost);toast(`Guards repelled the raid — ${lost} lbs honey lost`,'warn');}},
        b:{label:'Seal the entrance temporarily',fn:()=>{const lost=Math.min(2,G.bees-2);G.bees-=lost;toast(`Entrance sealed — ${lost} bees trapped outside`,'warn');}},
    });
}
function varroa(){
    Snd.danger();hap([80,40,80,40,80]);
    showChoice({
        icon:'🕷',title:'Varroa Outbreak',
        body:'A mite infestation is spreading through the inner brood ring.',
        a:{label:'Remove the infected cells',fn:()=>{const lost=~~(G.bees*.08);G.bees=Math.max(2,G.bees-lost);G._distress=[];toast(`Infected cells removed — ${lost} bees lost`,'warn');}},
        b:{label:'Wait and see',fn:()=>{const lost=~~(G.bees*.15);G.bees=Math.max(2,G.bees-lost);const ring1ct=6;G._distress=[...Array(ring1ct).keys()];toast(`Mites spread — ${lost} bees lost, brood distressed`,'warn');}},
    });
}
function bear(){
    Snd.danger();hap([200,100,200]);
    showChoice({
        icon:'🐻',title:'Bear Attack',
        body:"A bear has found the hive. She's tearing through the entrance.",
        a:{label:'Send the guards',fn:()=>{const lost=~~(G.bees*.04);G.bees=Math.max(2,G.bees-lost);toast(`Guards drove the bear off — ${lost} bees lost`,'warn');}},
        b:{label:"Let her raid",fn:()=>{const hLost=~~(G.honey*.25);const bLost=~~(G.bees*.05);G.honey=Math.max(0,G.honey-hLost);G.bees=Math.max(2,G.bees-bLost);toast(`Bear raided — ${hLost} lbs honey, ${bLost} bees lost`,'warn');}},
    });
}
function goodWeather(){
    Snd.tap();
    showChoice({
        icon:'☀',title:'Exceptional Weather',
        body:'Perfect conditions. Flowers everywhere. Push the foragers harder, or let them set their own pace?',
        a:{label:'Double shift — push hard',fn:()=>{
            // Double nectar for today
            const bonus=Math.max(1,~~(_nIn*1.0));G.nectar=Math.min(25,G.nectar+bonus);
            const fatigue=~~(G.bees*.01);G.bees=Math.max(2,G.bees-fatigue);
            toast(`Pushed hard — nectar flowing, ${fatigue} bees fatigued`,'green');
        }},
        b:{label:'Let them work naturally',fn:()=>toast('The bees forage at their own pace','green')},
    });
}
function diseasedFlower(){
    // Find a foraged tile
    const foraged=Object.entries(G.fa).filter(([k,n])=>n>0&&G.tiles[k]&&G.tiles[k].type!=='HIVE_BOX');
    if(!foraged.length){toast('Scouts report a diseased crop nearby — no foragers affected','warn');return;}
    const [targetKey]=foraged[~~(Math.random()*foraged.length)];
    const t=G.tiles[targetKey];
    Snd.danger();
    showChoice({
        icon:'🥀',title:'Diseased Flower Source',
        body:`Scouts report diseased crops at the ${TD[t.type].label}. Recall those foragers or push through?`,
        a:{label:'Recall immediately',fn:()=>{
            const n=G.fa[targetKey]||0;delete G.fa[targetKey];
            t.stage=Math.max(0,t.stage-2);
            toast(`Foragers recalled from ${TD[t.type].label} — tile damaged`,'warn');
        }},
        b:{label:'Keep foraging',fn:()=>{
            t.stage=Math.max(0,t.stage-1);
            const lost=~~(G.bees*.03);G.bees=Math.max(2,G.bees-lost);
            toast(`Disease spread — ${lost} bees lost, tile weakened`,'warn');
        }},
    });
}

// ── SCOUTS ────────────────────────────────────────────────────────────────────
const REVEAL_WEIGHTS={WILDFLOWER:3,FOREST:2,CLOVER:2,SUNFLOWER:1,DEAD_ZONE:1};
function revealTile(k){
    if(!G.fog[k])return;
    const{q,r}=G.fog[k];
    const pool=[];
    Object.entries(REVEAL_WEIGHTS).forEach(([t,w])=>{for(let i=0;i<w;i++)pool.push(t);});
    const type=pool[~~(Math.random()*pool.length)];
    G.tiles[k]={q,r,type,stage:1};
    delete G.fog[k];
    // Expose adjacent fog at level 1
    nbrs(q,r).forEach(([nq,nr])=>{
        const fk=hkey(nq,nr);
        if(!G.tiles[fk]&&!G.fog[fk])G.fog[fk]={q:nq,r:nr,level:1};
        else if(G.fog[fk]&&G.fog[fk].level===2)G.fog[fk].level=1;
    });
    toast(`Scouts mapped new territory: ${TD[type].label}`,'green');
    if(window._S)window._S.drawMap();
    G.scouts.find(s=>s.k===k&&!s.revealed)&&(G.scouts.find(s=>s.k===k).revealed=true);
    checkMS();
}
function sendScout(k,q,r){
    if(G.scouts.length>=3){toast('Three scout teams already out','warn');return;}
    if(G.scouts.find(s=>s.k===k)){toast('Already scouting that area','warn');return;}
    G.scouts.push({k,q,r,days:3,revealed:false});
    toast('Scouts dispatched — returns in 3 days','green');
    closePanel();hud();
}

// ── COLLAPSE ──────────────────────────────────────────────────────────────────
function collapse(){
    ovShow('ov-g');
    document.getElementById('gm-year').textContent=`Year ${G.year}, ${G.season}`;
    document.getElementById('gm-peak').textContent=G._peakB;
    document.getElementById('gm-honey').textContent=~~G._totH;
    document.getElementById('gm-winters').textContent=G._wintersS;
    document.getElementById('gm-tiles').textContent=G._tilesRestored;
    document.getElementById('gm-stage').textContent=STAGE_NAMES[getStage()]||'—';
    if(G._colonyName)document.getElementById('gm-name').textContent=`"${G._colonyName}"`;
}

// ── QUEEN MODE ────────────────────────────────────────────────────────────────
function setQueenMode(m){
    if(getStage()<2){toast('Queen mode unlocks after surviving first winter','warn');return;}
    G.qMode=m;hud();
    const msgs={conserve:'She lays with restraint.',normal:'Her natural pace.',overdrive:'She lays relentlessly.'};
    toast(msgs[m]||m,'green');Snd.tap();
}
function prepSwarm(){
    if(G.honey<5){toast('Need 5 lbs honey to prepare swarm cells','warn');return;}
    G.honey-=5;G.swarm=Math.max(0,G.swarm-45);
    G._ach.sp=true;
    toast('Swarm cells prepared — colony pressure eases','green');hap([40,20,40]);
    hud();save();
}
