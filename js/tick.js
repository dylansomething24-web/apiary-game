// ── SEASON FLASH ─────────────────────────────────────────────────────────────
function flashSeason(name){
    const el=document.createElement('div');el.className='season-flash';
    el.innerHTML=`<span style="color:${SCOL[name]}">${name}</span>`;
    document.body.appendChild(el);setTimeout(()=>el.remove(),1600);
}
// once-per-N-days warnings so toasts don't spam
function warnOnce(key,msg,days=6,type='warn'){
    const t=G.year*YEAR+G.day;
    if(G._warn[key]&&t-G._warn[key]<days)return;
    G._warn[key]=t;toast(msg,type);
}

// ── MAIN TICK (one in-game day) ───────────────────────────────────────────────
function tick(){
    G.day++;if(G.day>YEAR){G.day=1;G.year++;}
    const ns=seasonOf(G.day);
    if(ns!==G.season){
        const prev=G.season;G.season=ns;flashSeason(ns);
        if(prev==='Winter'){
            G._wintersS++;G._wW=false;G._w82=false;
            toast('Spring. The queen begins laying again.','green');
        }
        if(ns==='Winter')toast('Winter. No foraging, no laying — the colony lives on stored honey.','warn');
        if(ns==='Fall')toast('Fall. Flowers are thinning. Fill your storage cells before winter.','warn');
    }
    const e=econ();

    // Foragers bring nectar home (only as much as storage can hold)
    const space=Math.max(0,e.cap-G.honey-G.nectar);
    let nIn=e.nectarIn;
    if(nIn>space+0.001){
        if(nIn>0)warnOnce('full','Storage is full — nectar is being wasted. Add builders or paint storage cells in the Hive.');
        nIn=space;
    }
    G.nectar+=nIn;G._nIn=nIn;

    // Processors turn nectar into honey
    const proc=Math.min(G.nectar,e.procCap);
    G.nectar-=proc;const hIn=proc*PROC_EFF;
    G.honey+=hIn;G._totH+=hIn;G._hIn=hIn;
    if(e.nectarIn>e.procCap*1.3&&G.nectar>3)warnOnce('proc','Nectar is piling up — assign more processors.');

    // Adults eat
    G.honey-=e.adultCost;

    // Brood ages and hatches
    let born=0;
    for(const c of Object.values(G.comb)){
        if(c.t!=='b')continue;
        if(c.d>0){if(G.nurses>0)c.d--;continue;}
        if(c.a>=0){c.a++;if(c.a>=21){c.a=-1;born++;}}
        if(c.a<0&&c.p){c.t=c.p;delete c.p;}
    }
    G.bees+=born;G._born=born;

    // Nurses feed larvae (costs honey); unfed larvae die
    const larvaeCells=Object.values(G.comb).filter(c=>c.t==='b'&&!(c.d>0)&&c.a>=3&&c.a<=8);
    const affordable=Math.floor(Math.max(0,G.honey)/LARVA_COST);
    const fed=Math.min(larvaeCells.length,e.nurseCap,affordable);
    G.honey-=fed*LARVA_COST;
    let starved=0;
    larvaeCells.slice(fed).forEach(c=>{c.a=-1;c.d=3;starved++;});
    if(starved){
        const why=fed>=e.nurseCap?'not enough nurses':'not enough honey';
        warnOnce('larva',`${starved} ${starved>1?'larvae':'larva'} died — ${why}.`,4);
    }

    // Builders deepen storage cells if told to, otherwise draw new comb (wax costs honey)
    let built=0;
    if(e.dpg){
        if(e.deepRate>0){
            G._dp+=e.deepRate;
            while(G._dp>=1){
                const cost=DEEP_COST[G.combLvl];if(G.honey<cost)break;
                G.deepDone++;G.honey-=cost;G._dp-=1;
                if(G.deepDone>=combCount('s')){
                    G.combLvl++;G.deepDone=0;G.deepen=false;G._dp=0;
                    toast(`Comb deepened — each storage cell now holds ${cellCapAt(G.combLvl)} lb`,'green');hap([40,20,40]);Snd.honey();break;
                }
            }
            if(G._dp>2)G._dp=2;
        }
    }else if(G.builders>0){
        G._bf+=G.builders*BUILD_RATE;
        while(G._bf>=1&&G.honey>=CELL_COST){
            const k=nextFrontier();if(!k){G._bf=0;break;}
            let t=newCellType();
            // brood belongs in the middle: swap an inner storage cell to brood and put the storage out here
            if(t==='b'&&G.newComb==='auto'){const inner=innerStorage(kdist(k));if(inner){G.comb[inner]={t:'b',a:-1};t='s';}}
            G.comb[k]={t,a:-1};G.honey-=CELL_COST;G._bf-=1;built++;
        }
        if(G._bf>2)G._bf=2;
    }

    // Queen lays into empty brood cells, nearest the centre first
    if(G.season!=='Winter'&&G.honey>0){
        let n=LAY[G.qMode];
        const empties=Object.entries(G.comb).filter(([k,c])=>c.t==='b'&&c.a<0&&!(c.d>0)&&!c.p).sort((a,b)=>kdist(a[0])-kdist(b[0]));
        for(const[,c]of empties){if(n<=0)break;c.a=0;n--;}
        if(n>=LAY[G.qMode]&&G.day>3)warnOnce('lay','The queen has no empty brood cells to lay in. Build comb or paint brood cells.',8);
    }

    // Natural deaths
    G._df+=G.bees*{Spring:.012,Summer:.012,Fall:.008,Winter:.004}[G.season];
    const died=Math.floor(G._df);G._df-=died;G.bees-=died;
    // Starvation
    if(G.honey<0){
        G.honey=0;const s=Math.max(1,Math.floor(G.bees*.05));G.bees-=s;
        warnOnce('starve',`The colony is starving — ${s} bee${s>1?'s':''} died. Get foragers and processors working.`,3);
    }
    G.bees=Math.max(0,G.bees);G._died=died;
    if(G.bees>G._peakB)G._peakB=G.bees;
    if(G.bees<=20&&G._peakB>30)G._wasLow=true;

    // Swarm pressure: a big, crowded colony wants to split
    const bs=broodStats();
    if(G.bees>120&&bs.empty<bs.total*0.1&&(G.season==='Spring'||G.season==='Summer')){
        G.swarm=Math.min(100,G.swarm+{conserve:.8,normal:2,overdrive:3.5}[G.qMode]);
        if(G.swarm>=80)warnOnce('swarm','The colony grows restless — swarm pressure is high. Build brood room or prepare a swarm cell.',10);
    }else G.swarm=Math.max(0,G.swarm-1);
    if(G.swarm>=100){
        const lost=Math.floor(G.bees*.4);G.bees-=lost;G.swarm=0;
        toast(`The colony swarmed — the old queen left with ${lost} bees. A new queen takes over.`,'warn');hap([100,50,100]);
    }

    rebalance();

    // Scouts
    G.scouts=G.scouts.filter(s=>{if(--s.days<=0){revealTile(s.k);return false;}return true;});

    // Pollinators restore dead zones
    const bonus=getStage()>=3?1.2:1;
    Object.entries(G.pa).forEach(([k,n])=>{
        const t=G.tiles[k];if(!t||t.type!=='DEAD_ZONE'){delete G.pa[k];return;}
        G.restore[k]=Math.min(100,(G.restore[k]||0)+n*3.5*bonus);
        if(G.restore[k]>=100){
            t.type='WILDFLOWER';t.stage=1;delete G.restore[k];delete G.pa[k];G._tilesRestored++;
            toast(`A dead zone stirs back to life — ${n} pollinators come home`,'green');hap([40,20,40,20,40]);Snd.revive();
        }
    });

    // Foraging heals the land
    Object.entries(G.fa).forEach(([k,n])=>{
        const t=G.tiles[k];if(!t||t.stage>=3||!TD[t.type].forage)return;
        if(Math.random()<n*0.012){t.stage++;toast(`${TD[t.type].label} is ${STG[t.stage].toLowerCase()} now — more nectar`,'green');}
    });

    // Forage range follows population
    const nr=G.bees>=400?3:G.bees>=100?2:1;
    if(nr>G.frad){G.frad=nr;toast('The colony’s range extends — more tiles are reachable','green');}

    // Winter warnings
    const fs=seasonStart('Fall'),need=winterNeed();
    if(G.day===fs+17&&!G._wW){G._wW=true;if(G.honey<need)toast(`Winter in 8 days — you need about ${need} lb of honey, you have ${G.honey.toFixed(0)}`,'warn');}
    if(G.day===fs+21&&!G._w82){G._w82=true;if(G.honey<need){toast(`CRITICAL: winter in 4 days — ${(need-G.honey).toFixed(0)} lb short`,'warn');hap([200,100,200]);}}

    // Collapse
    if(G.bees<=2){if(++G._low>=3){collapse();return;}}else G._low=0;

    // Events
    if(--G._nt<=0){G._nt=20+~~(Math.random()*20);if(!(G.year===1&&G.day<20)&&Math.random()<.65)threat();}

    const st=getStage();if(st>G._stagePrev){G._stagePrev=st;onStageAdvance(st);}
    checkMS();Snd.setVol();save();
    if(window._S){window._S.refresh();if(G._hIn>0.2&&G.view==='map')window._S.burstForage();}
    renderAll(true);
}

// ── EVENTS ────────────────────────────────────────────────────────────────────
function threat(){
    const pool=[{w:3,fn:wasp},{w:2,fn:varroa},{w:1,fn:bear},{w:2,fn:robbing},{w:1,fn:diseasedFlower}];
    if(G.season==='Summer')pool.push({w:1.5,fn:goodWeather});
    if(G.season==='Fall')pool.push({w:1.5,fn:lateBloom});
    if(G.season==='Winter')return;
    let r=Math.random()*pool.reduce((a,b)=>a+b.w,0);
    for(const p of pool){r-=p.w;if(r<=0)return p.fn();}
}
function wasp(){
    const need=guardsNeeded();
    if(G.guards>=need){toast(`Wasps probed the entrance — your ${G.guards} guards drove them off`,'green');return;}
    Snd.danger();hap([80,40,80]);
    showChoice({icon:'🪲',title:'Wasp Raid',
        body:`Wasps are at the entrance. You have ${G.guards} guards; about ${need} are needed to hold them.`,
        a:{label:'Fight them off',hint:'Lose honey',fn:()=>{const l=Math.min(G.honey,(need-G.guards)*1.5);G.honey-=l;toast(`Wasps driven off — they carried away ${l.toFixed(1)} lb`,'warn');}},
        b:{label:'Seal the entrance',hint:'Lose a few foragers',fn:()=>{const l=Math.min(Math.max(1,Math.ceil(foragerTotal()*.1)),G.bees-3);G.bees-=Math.max(0,l);rebalance();toast(`Entrance sealed — ${l} foragers were locked out`,'warn');}},
    });
}
function varroa(){
    Snd.danger();hap([80,40,80,40,80]);
    const res=getStage()>=5?.75:1;
    const brood=Object.values(G.comb).filter(c=>c.t==='b'&&c.a>=3);
    showChoice({icon:'🕷',title:'Varroa Mites',
        body:'Mites are spreading through the capped brood.',
        a:{label:'Remove infected brood',hint:'Lose some brood now',fn:()=>{let n=0;brood.forEach(c=>{if(Math.random()<.3*res){c.a=-1;c.d=3;n++;}});toast(`${n} infected cells cleared out`,'warn');}},
        b:{label:'Wait and see',hint:'Risk adults and brood',fn:()=>{const l=Math.floor(G.bees*.12*res);G.bees-=l;let n=0;brood.forEach(c=>{if(Math.random()<.5*res){c.a=-1;c.d=3;n++;}});rebalance();toast(`Mites spread — ${l} bees and ${n} brood lost`,'warn');}},
    });
}
function bear(){
    Snd.danger();hap([200,100,200]);
    showChoice({icon:'🐻',title:'Bear',
        body:"A bear has found the hive and is tearing at the entrance.",
        a:{label:'Send everyone to sting',hint:'Lose bees, keep honey',fn:()=>{const l=Math.max(1,Math.floor(G.bees*.05));G.bees-=l;rebalance();toast(`The bear retreated — ${l} bees died defending`,'warn');}},
        b:{label:'Let her take what she wants',hint:'Lose honey and comb',fn:()=>{const h=G.honey*.35;G.honey-=h;G.nectar*=.6;toast(`The bear took ${h.toFixed(1)} lb of honey`,'warn');}},
    });
}
function robbing(){
    if(G.guards>=guardsNeeded()){toast('Robber bees tried the entrance — your guards turned them away','green');return;}
    const l=Math.min(G.honey,(guardsNeeded()-G.guards)*1.2);G.honey-=l;
    toast(`Robber bees stole ${l.toFixed(1)} lb of honey — you need more guards`,'warn');
}
function lateBloom(){const add=Math.min(4,Math.max(0,capacity()-G.honey-G.nectar));G.nectar+=add;toast(`A late bloom — foragers returned heavy (+${add.toFixed(1)} lb nectar)`,'green');}
function goodWeather(){
    showChoice({icon:'☀',title:'Perfect Weather',
        body:'Flowers everywhere. Push the foragers harder today?',
        a:{label:'Double shift',hint:'Extra nectar, a few tired bees',fn:()=>{const e=econ();const add=Math.min(e.nectarIn,Math.max(0,capacity()-G.honey-G.nectar));G.nectar+=add;const l=Math.ceil(foragerTotal()*.03);G.bees-=l;rebalance();toast(`+${add.toFixed(1)} lb nectar, ${l} bees worn out`,'green');}},
        b:{label:'Normal pace',hint:'No risk',fn:()=>toast('The bees work at their own pace','green')},
    });
}
function diseasedFlower(){
    const ks=Object.keys(G.fa);if(!ks.length)return;
    const k=ks[~~(Math.random()*ks.length)],t=G.tiles[k];
    showChoice({icon:'🥀',title:'Diseased Flowers',
        body:`Scouts report blight in the ${TD[t.type].label}.`,
        a:{label:'Recall foragers',hint:'Tile loses health',fn:()=>{delete G.fa[k];t.stage=Math.max(0,t.stage-1);toast('Foragers recalled — the field will need time','warn');}},
        b:{label:'Keep foraging',hint:'Some bees get sick',fn:()=>{const l=Math.max(1,Math.ceil(G.fa[k]*.3));G.bees-=l;t.stage=Math.max(0,t.stage-1);rebalance();toast(`${l} foragers got sick and died`,'warn');}},
    });
}

// ── SCOUTING ──────────────────────────────────────────────────────────────────
function scoutable(k){const f=G.fog[k];return f&&f.level===1&&nbrs(f.q,f.r).some(([q,r])=>G.tiles[hkey(q,r)]);}
function sendScout(k){
    if(!scoutable(k)){toast('Scouts can only reach dark tiles touching your land','warn');return;}
    if(G.scouts.length>=3){toast('Three scout teams are already out','warn');return;}
    if(G.scouts.find(s=>s.k===k)){toast('Scouts are already heading there','warn');return;}
    if(idle()<SCOUT_BEES){toast(`Need ${SCOUT_BEES} idle bees to scout`,'warn');return;}
    G.scouts.push({k,days:SCOUT_DAYS,n:SCOUT_BEES});
    toast(`Scouts are out — back in ${SCOUT_DAYS} days`,'green');
}
function revealTile(k){
    const f=G.fog[k];if(!f)return;
    const type=pick({WILDFLOWER:3,FOREST:2,CLOVER:2,SUNFLOWER:1,DEAD_ZONE:2,WATER:1});
    G.tiles[k]={q:f.q,r:f.r,type,stage:type==='DEAD_ZONE'?0:1};delete G.fog[k];
    nbrs(f.q,f.r).forEach(([q,r])=>{const nk=hkey(q,r);if(G.tiles[nk])return;if(!G.fog[nk])G.fog[nk]={q,r,level:1};else G.fog[nk].level=1;});
    G._ach._scouted=(G._ach._scouted||0)+1;
    toast(`Scouts found a ${TD[type].label}`,'green');
}

// ── COLLAPSE ──────────────────────────────────────────────────────────────────
function collapse(){
    const set=(id,v)=>document.getElementById(id).textContent=v;
    set('gm-year',`Year ${G.year}, ${G.season}`);set('gm-peak',G._peakB);set('gm-honey',G._totH.toFixed(0)+' lb');
    set('gm-winters',G._wintersS);set('gm-tiles',G._tilesRestored);set('gm-stage',STAGE_NAMES[getStage()]);
    set('gm-name',G._colonyName?`“${G._colonyName}”`:'');
    localStorage.removeItem(SK);ovShow('ov-g');
}

// ── QUEEN ─────────────────────────────────────────────────────────────────────
function setQueenMode(m){
    if(getStage()<2){toast('Laying modes unlock after your first winter','warn');return;}
    G.qMode=m;toast({conserve:'She lays with restraint — 2 eggs a day.',normal:'Her natural pace — 4 eggs a day.',overdrive:'She lays relentlessly — 7 eggs a day.'}[m],'green');
}
function prepSwarm(){
    if(G.honey<5){toast('Need 5 lb of honey to raise a swarm cell','warn');return;}
    G.honey-=5;G.swarm=Math.max(0,G.swarm-45);G._ach.sp=true;
    toast('Swarm cell raised — the colony settles','green');
}
