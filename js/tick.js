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
            G._wintersS++;
            if(G._wintersS===1&&!G._colonyName){G._colonyName=genColonyName();setTimeout(()=>toast(`Your colony has known cold and kept its warmth. It is now known as ${G._colonyName}.`,'mile'),2500);}
            G.hives.forEach(h=>{h._wW=false;h._w82=false;});
            toast('Spring. The queen begins laying again.','green');
            if(G._kDue&&!G.kp)setTimeout(keeperArrive,1800);
            springOut();
        }
        if(ns==='Winter')winterHome();
        if(ns==='Winter')toast('Winter. No foraging, no laying — the colony lives on stored honey.','warn');
        if(ns==='Fall')toast('Fall. Flowers are thinning. Fill your storage cells before winter.','warn');
    }

    // every hive lives its own day
    const viewing=G.hives[G.ci];
    G.hives.slice().forEach(h=>{G.ci=G.hives.indexOf(h);_ctx=G.hives.length>1?h.name:null;if(anyJobAuto())planJobs();hiveDay();});
    _ctx=null;
    if(G.kp)keeperDay();
    tripsDay();

    // hives that died
    G.hives.filter(h=>h.dead).forEach(h=>{
        const t=G.tiles[hkey(h.q,h.r)];
        if(t){t.type='WILDFLOWER';t.stage=0;}
        G.hives.splice(G.hives.indexOf(h),1);
        if(G.hives.length)toast(`${h.name} has died out. Its bees are gone.`,'warn');
    });
    if(!G.hives.length){G.ci=0;collapse();return;}
    G.ci=Math.max(0,G.hives.indexOf(viewing));
    if(G.sel&&G.sel.kind==='cell'&&!G.comb[G.sel.k])closePanel();

    G._peakB=Math.max(G._peakB,totalBees());

    // Events strike one hive at random
    if(--G._nt<=0){
        G._nt=Math.round((20+~~(Math.random()*20))/Math.sqrt(G.hives.length));
        if(!(G.year===1&&G.day<20)&&Math.random()<.65){const h=G.hives[~~(Math.random()*G.hives.length)];withHive(h,threat);}
    }

    checkShop();checkLand();
    if(G._maxHives>=3&&!G.kp&&!G._kDue)G._kDue=true;   // the beekeeper comes the spring after the 3rd hive
    checkMS();Snd.setVol();save();
    if(window._S){window._S.refresh();if(H()._hIn>0.2&&G.view==='map')window._S.burstForage();}
    renderAll(true);
}

// ── ONE HIVE'S DAY (G.* is the hive being processed) ──────────────────────────
function hiveDay(){
    if(G.kp)superFlow();
    const e=econ();

    // Foragers bring nectar home (only as much as storage can hold)
    const space=Math.max(0,e.cap-G.honey-G.nectar);
    let nIn=e.nectarIn;
    if(nIn>space+0.001){
        if(nIn>0&&!(G.kp&&supRoom()>1))warnOnce('full',G.kp?'Storage is full — nectar is being wasted. Put supers on, or pull full ones.':'Storage is full — nectar is being wasted. Add builders or paint storage cells in the Hive.');
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

    // Auto queen resizes the brood area for the season
    tuneBrood();

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

    if(G.kp)superBuild();

    // Queen lays into empty brood cells, nearest the centre first
    if(G.season!=='Winter'&&G.honey>0){
        let n=layNow();
        const empties=Object.entries(G.comb).filter(([k,c])=>c.t==='b'&&c.a<0&&!(c.d>0)&&!c.p).sort((a,b)=>kdist(a[0])-kdist(b[0]));
        for(const[,c]of empties){if(n<=0)break;c.a=0;n--;}
        if(n>=layNow()&&G.day>3)warnOnce('lay','The queen has no empty brood cells to lay in. Build comb or paint brood cells.',8);
    }

    // Natural deaths
    G._df+=G.bees*{Spring:.012,Summer:.012,Fall:.008,Winter:.004}[G.season];
    const died=Math.floor(G._df);G._df-=died;G.bees-=died;
    // Starvation (in winter a hive will eat from its supers first)
    if(G.kp)eatSupers();
    if(G.honey<0){
        G.honey=0;const s=Math.max(1,Math.floor(G.bees*.05));G.bees-=s;
        warnOnce('starve',`The colony is starving — ${s} bee${s>1?'s':''} died. Get foragers and processors working.`,3);
    }
    G.bees=Math.max(0,G.bees);G._died=died;
    if(G.bees<=20&&G._peakB>30)G._wasLow=true;

    // Swarm pressure: a hive that has outgrown its comb wants to split
    const cells=Object.keys(G.comb).length;
    if(G.bees>=120&&G.bees>cells*0.6&&(G.season==='Spring'||G.season==='Summer')){
        G.swarm=Math.min(100,G.swarm+{conserve:.8,normal:2,overdrive:3.5}[effMode()]);
        if(G.swarm>=80)warnOnce('swarm',canSplit().ok?'The colony grows restless. Split the hive or raise a queen cell.':'The colony grows restless. Raise a queen cell before it swarms.',10);
    }else G.swarm=Math.max(0,G.swarm-1);
    if(G.swarm>=100){
        const lost=Math.floor(G.bees*.4);G.bees-=lost;G.swarm=0;
        const pc=_ctx;_ctx=null;toast(`${H().name} swarmed. ${lost} bees left with the old queen.`,'warn');_ctx=pc;hap([100,50,100]);
        if(window._S)window._S.swarmFly(H().q,H().r);
    }

    if(G.kp)superFlow();
    rebalance();

    // the land rests in winter: no restoring, no healing
    const growing=G.season!=='Winter';

    // Pollinators restore dead zones
    const bonus=owns('poll2')?1.2:1;
    if(growing)Object.entries(G.pa).forEach(([k,n])=>{
        const t=G.tiles[k];if(!t||t.type!=='DEAD_ZONE'){delete G.pa[k];return;}
        G.restore[k]=Math.min(100,(G.restore[k]||0)+n*PA_RATE*bonus);
        if(G.restore[k]>=100){
            const all=paTotal(k);
            t.type='WILDFLOWER';t.stage=1;delete G.restore[k];G.hives.forEach(h=>delete h.pa[k]);G._tilesRestored++;
            toast(`A dead zone stirs back to life — ${all} pollinators come home`,'green');hap([40,20,40,20,40]);Snd.revive();
        }
    });

    // Foraging heals the land (slowly)
    if(growing)Object.entries(G.fa).forEach(([k,n])=>{
        const t=G.tiles[k];if(!t||t.stage>=3||!TD[t.type].forage)return;
        if(Math.random()<n*HEAL_RATE){t.stage++;toast(`${TD[t.type].label} is ${STG[t.stage].toLowerCase()} now — more nectar`,'green');}
    });

    // Forage range follows population
    const nr=G.bees>=250?3:G.bees>=100?2:1;
    if(nr>G.frad){G.frad=nr;toast('The colony’s range extends — more tiles are reachable','green');}

    // Winter warnings
    const fs=seasonStart('Fall'),need=winterNeed();
    if(G.day===fs+17&&!G._wW){G._wW=true;if(G.honey<need)toast(`Winter in 8 days — you need about ${need} lb of honey, you have ${G.honey.toFixed(0)}`,'warn');}
    if(G.day===fs+21&&!G._w82){G._w82=true;if(G.honey<need){toast(`CRITICAL: winter in 4 days — ${(need-G.honey).toFixed(0)} lb short`,'warn');hap([200,100,200]);}}

    // Collapse
    if(G.bees<=2){if(++G._low>=3)H().dead=true;}else G._low=0;
}

// ── AUTO QUEEN: size the brood area to what she can lay this season ───────────
// Brood in the middle, honey around the outside. Cells beyond what she needs become storage;
// when spring comes the innermost storage cells become brood again (as far as the honey allows).
function tuneBrood(){
    if(G.qMode!=='auto')return;
    const target=autoBroodTarget();
    const brood=[];
    for(const[k,c]of Object.entries(G.comb))if(c.t==='b'&&!c.p)brood.push(k);
    const cur=brood.length;
    if(cur>target){
        brood.sort((a,b)=>kdist(b)-kdist(a));            // outermost first
        let extra=cur-target;
        for(const k of brood){
            if(extra<=0)break;const c=G.comb[k];
            if(c.a<0&&!(c.d>0)){G.comb[k]={t:'s',a:-1};}  // empty: becomes storage now
            else c.p='s';                                  // busy: becomes storage after it hatches
            extra--;
        }
    }else if(cur<target){
        let need=target-cur;
        // cells that were about to turn into storage can stay brood
        const pend=Object.keys(G.comb).filter(k=>G.comb[k].t==='b'&&G.comb[k].p).sort((a,b)=>kdist(a)-kdist(b));
        for(const k of pend){if(need<=0)break;delete G.comb[k].p;need--;}
        if(need>0){
            const store=Object.keys(G.comb).filter(k=>G.comb[k].t==='s').sort((a,b)=>kdist(a)-kdist(b));
            let cap=capacity();const pc=perCell();
            for(const k of store){
                if(need<=0)break;
                if(G.honey+G.nectar+2>cap-pc)break;       // the honey has to fit in what is left
                G.comb[k]={t:'b',a:-1};cap-=pc;need--;
            }
            if(need>0&&G.season!=='Winter')warnOnce('autoroom','The queen wants more brood room, but the honey stores are in the way.',10);
        }
    }
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
    const res=landRank()>=3?.75:1;
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
        b:{label:'Keep foraging',hint:'Some bees get sick',fn:()=>{const l=Math.max(1,Math.ceil((G.fa[k]||0)*.3));G.bees-=l;t.stage=Math.max(0,t.stage-1);rebalance();toast(`${l} foragers got sick and died`,'warn');}},
    });
}

// ── SCOUTING (territories, drawn from every hive) ─────────────────────────────
// The land past the start is cut into fixed territories: hexagons of 19 hexes on a set grid, so a
// territory never changes shape. A trip maps one whole territory and it opens all at once when the
// work is done. One hex is 6 bee-days of work. Scouts come from the hive closest first, 6 per hive at most.
const HEX_WORK=6,SCOUT_CAP=6,TERR_R=2;
const TN1=['Thistle','Bramble','Willow','Aster','Hazel','Cinder','Juniper','Sorrel','Mallow','Ashen','Fennel','Briar','Larch','Tansy','Yarrow','Sedge'];
const TN2=['Reach','Hollow','Flats','Ridge','Bottoms','Glen','Fields','Run','Downs','Bend','Heath','Barrens'];
// the territory hex (q,r) belongs to: nearest centre on the lattice (5,-2) / (2,3)
function terrOf(q,r){
    const fa=(3*q-2*r)/19,fb=(2*q+5*r)/19;let best=null,bd=1e9;
    for(const a of[Math.floor(fa),Math.ceil(fa)])for(const b of[Math.floor(fb),Math.ceil(fb)]){
        const d=hdist(q,r,5*a+2*b,-2*a+3*b);if(d<bd){bd=d;best=a+','+b;}
    }
    return best;
}
function terrOfK(k){const{q,r}=kq(k);return terrOf(q,r);}
function terrCentre(id){const[a,b]=id.split(',').map(Number);return{q:5*a+2*b,r:-2*a+3*b};}
// the hexes of territory id that are still unmapped
function terrHexes(id){
    const c=terrCentre(id),out=[];
    for(let dq=-TERR_R;dq<=TERR_R;dq++)for(let dr=Math.max(-TERR_R,-dq-TERR_R);dr<=Math.min(TERR_R,-dq+TERR_R);dr++){
        const k=hkey(c.q+dq,c.r+dr);if(!G.tiles[k])out.push(k);
    }
    return out;
}
function terrName(id){
    // number the territories in a spiral out from home, so the first 192 all get different names
    const[a,b]=id.split(',').map(Number),R=hdist(a,b);
    const n=R?1+3*R*(R-1)+ringCells(R).findIndex(([q,r])=>q===a&&r===b):0,x=n%16;
    return`${TN1[x*7%16]} ${TN2[(Math.floor(n/16)+5*x)%12]}`;
}
function terrTouchesLand(id){return terrHexes(id).some(k=>{const{q,r}=kq(k);return nbrs(q,r).some(([nq,nr])=>G.tiles[hkey(nq,nr)]);});}
function scoutable(k){const f=G.fog[k];return!!f&&terrTouchesLand(terrOf(f.q,f.r));}
// every territory next to known land shows in full on the map
function openFog(){
    const ids=new Set();
    Object.values(G.tiles).forEach(t=>nbrs(t.q,t.r).forEach(([q,r])=>{if(!G.tiles[hkey(q,r)])ids.add(terrOf(q,r));}));
    ids.forEach(id=>terrHexes(id).forEach(k=>{const{q,r}=kq(k);if(G.fog[k])G.fog[k].level=1;else G.fog[k]={q,r,level:1};}));
}
function tripOf(k){const id=terrOfK(k);return G.trips.find(t=>t.terr===id);}
function tripBees(t){let n=0;G.hives.forEach(h=>h.scouts.forEach(s=>{if(s.t===t.id)n+=s.n;}));return n;}
function tripLeft(t){return Math.max(0,t.total*HEX_WORK-t.work);}
function tripDays(t){const n=tripBees(t);return n?Math.ceil(tripLeft(t)/n):0;}
function tripPct(t){return t.total?Math.min(100,t.work/(t.total*HEX_WORK)*100):100;}
// bees hive h could send right now
function scoutRoom(h){
    return withHive(h,()=>Math.max(0,Math.min(SCOUT_CAP-scoutTotal(),idle()+(jobAuto('foragers')?foragerTotal():0))));
}
function scoutRoomAll(){return G.hives.reduce((a,h)=>a+scoutRoom(h),0);}
// pull n scouts for trip t, closest hive first (or back from the hives in `from`); returns how many went
function pullScouts(t,n,from){
    const f=terrCentre(t.terr);
    const hs=from||G.hives.slice().sort((a,b)=>hdist(a.q,a.r,f.q,f.r)-hdist(b.q,b.r,f.q,f.r));
    let sent=0;
    for(const h of hs){
        const want=from?Math.min(t.want[h.id]||0,n-sent):n-sent;if(want<=0)continue;
        const m=Math.min(want,scoutRoom(h));if(m<=0)continue;
        withHive(h,()=>{if(jobAuto('foragers'))freeForagers(m);G.scouts.push({t:t.id,n:m});});
        if(!from)t.want[h.id]=m;
        sent+=m;
    }
    return sent;
}
function sendTrip(k,n){
    if(G.season==='Winter'){toast('Scouts stay home in winter. Send them in spring.','warn');return false;}
    if(!G.fog[k])return false;
    if(tripOf(k)){toast('Scouts are already mapping this territory','warn');return false;}
    if(!scoutable(k)){toast('Too deep. Pick a territory next to your land.','warn');return false;}
    const id=terrOfK(k),hexes=terrHexes(id);
    const t={id:++G._tid,terr:id,name:terrName(id),total:hexes.length,work:0,want:{}};
    const sent=pullScouts(t,n);
    if(!sent){toast('No bees free to scout','warn');return false;}
    G.trips.push(t);
    toast(`${sent} scouts are out to ${t.name} (${t.total} hexes, about ${tripDays(t)} days)`,'green');
    return true;
}
function endTrip(t,msg){
    G.hives.forEach(h=>{h.scouts=h.scouts.filter(s=>s.t!==t.id);});
    G.trips.splice(G.trips.indexOf(t),1);
    if(msg)toast(msg,'green');
}
// the whole territory opens at once
function mapTerritory(t){
    const found={};
    terrHexes(t.terr).forEach(k=>{if(!G.fog[k]){const{q,r}=kq(k);G.fog[k]={q,r,level:1};}const ty=revealTile(k,true);found[ty]=(found[ty]||0)+1;});
    openFog();
    G._ach._terr=(G._ach._terr||0)+1;
    const f=Object.entries(found).sort((a,b)=>b[1]-a[1]).map(([ty,c])=>`${c} ${TD[ty].label.toLowerCase()}`).join(', ');
    endTrip(t,`${t.name} mapped: ${f}. The scouts head home.`);
    if(window._S&&window._S.terrOpen)window._S.terrOpen(t.terr);
}
function tripsDay(){
    if(G.season==='Winter')return;
    G.trips.slice().forEach(t=>{
        const n=tripBees(t);
        if(!n){endTrip(t);return;}
        t.work+=n;
        if(t.work>=t.total*HEX_WORK)mapTerritory(t);
    });
}
// first day of winter: scouts and pollinators come home; first day of spring: they head back out
function winterHome(){
    let n=0;
    G.hives.forEach(h=>{
        n+=h.scouts.reduce((a,s)=>a+s.n,0)+sum(h.pa);
        h.scouts=[];h._paW=h.pa;h.pa={};
    });
    if(n)toast(`${n} scouts and pollinators come home for the winter`,'info');
}
function springOut(){
    let n=0;
    G.trips.forEach(t=>{n+=pullScouts(t,Infinity,G.hives.filter(h=>t.want[h.id]));});
    G.hives.forEach(h=>{
        const w=h._paW||{};h._paW=null;
        Object.entries(w).forEach(([k,m])=>{
            const t=G.tiles[k];if(!t||t.type!=='DEAD_ZONE')return;
            withHive(h,()=>{if(jobAuto('foragers'))freeForagers(m);const c=Math.min(m,idle());if(c>0){G.pa[k]=(G.pa[k]||0)+c;n+=c;}});
        });
    });
    if(n)toast(`${n} scouts and pollinators head back out`,'green');
}
function revealTile(k,quiet){
    const f=G.fog[k];if(!f)return;
    const type=pick({WILDFLOWER:3,FOREST:2,CLOVER:2,SUNFLOWER:1,DEAD_ZONE:hdist(f.q,f.r)>=5?8:6,WATER:1});
    G.tiles[k]={q:f.q,r:f.r,type,stage:type==='DEAD_ZONE'?0:1};delete G.fog[k];
    nbrs(f.q,f.r).forEach(([q,r])=>{const nk=hkey(q,r);if(G.tiles[nk])return;if(!G.fog[nk])G.fog[nk]={q,r,level:1};else G.fog[nk].level=1;});
    if(!quiet)toast(`Scouts found a ${TD[type].label}`,'green');
    return type;
}

// ── POLLINATORS (one pool across the colony) ──────────────────────────────────
function paTotal(k){return G.hives.reduce((a,h)=>a+(h.pa[k]||0),0);}
function paHives(k){const t=G.tiles[k];return G.hives.filter(h=>hdist(t.q,t.r,h.q,h.r)<=h.frad).sort((a,b)=>hdist(t.q,t.r,a.q,a.r)-hdist(t.q,t.r,b.q,b.r));}
function paAdd(k,n){
    const hs=paHives(k);
    if(!hs.length){toast('Out of reach of every hive. Reach grows with hive size.','warn');return;}
    let left=n;
    for(const h of hs){
        if(left<=0)break;
        withHive(h,()=>{if(jobAuto('foragers'))freeForagers(left);const m=Math.min(left,idle());if(m>0){G.pa[k]=(G.pa[k]||0)+m;left-=m;}});
    }
    if(left===n)toast('No idle bees in the hives that can reach it','warn');
}
function paRemove(k,n){
    const hs=paHives(k).reverse().concat(G.hives.filter(h=>h.pa[k]));   // farthest first
    for(const h of hs){
        if(n<=0)break;const m=Math.min(n,h.pa[k]||0);if(!m)continue;
        h.pa[k]-=m;if(!h.pa[k])delete h.pa[k];n-=m;
    }
}

// ── COLLAPSE (the last hive has died) ─────────────────────────────────────────
function collapse(){
    const set=(id,v)=>document.getElementById(id).textContent=v;
    set('gm-year',`Year ${G.year}, ${G.season}`);set('gm-peak',G._peakB);set('gm-honey',G._totH.toFixed(0)+' lb');
    set('gm-winters',G._wintersS);set('gm-tiles',G._tilesRestored);set('gm-stage',`${Object.keys(G.up).length} of ${UPG.length}`);
    set('gm-name',G._colonyName?`“${G._colonyName}”`:'');
    localStorage.removeItem(SK);ovShow('ov-g');
}

// ── QUEEN ─────────────────────────────────────────────────────────────────────
function setQueenMode(m){
    if(owns('a_queen')){toast('Your queens follow the seasons on their own now','info');return;}
    if(!owns('qmodes')){toast('Buy Queen laying modes in Upgrades first. They open after your first winter.','warn');return;}
    if(m==='auto'){toast('Buy the Auto queen in Upgrades. It opens with your second hive.','warn');return;}
    G.qMode=m;
    toast({auto:'The queen follows the seasons — hard in spring, steady in summer, light in fall, resting in winter. She keeps only the brood room she needs.',conserve:'She lays with restraint — 2 eggs a day.',normal:'Her natural pace — 4 eggs a day.',overdrive:'She lays relentlessly — 7 eggs a day.'}[m],'green');
}
function prepSwarm(){
    if(G.honey<5){toast('Need 5 lb of honey to raise a swarm cell','warn');return;}
    G.honey-=5;G.swarm=Math.max(0,G.swarm-45);G._ach.sp=true;
    toast('Swarm cell raised — the colony settles','green');
}

// ── SPLITTING INTO A NEW HIVE ─────────────────────────────────────────────────
function canSplit(){
    if(!owns('split'))return{ok:false,reason:'Buy Splitting in Upgrades first'};
    if(G.hives.length>=MAX_HIVES)return{ok:false,reason:`The land can hold ${MAX_HIVES} hives at most`};
    if(G.frad<SPLIT_REACH)return{ok:false,reason:`Needs a forage range of ${SPLIT_REACH} tiles (yours is ${G.frad})`};
    if(G.season!=='Spring'&&G.season!=='Summer')return{ok:false,reason:'Colonies only swarm in spring and summer'};
    if(G.bees<SPLIT_MIN_BEES)return{ok:false,reason:`Needs at least ${SPLIT_MIN_BEES} bees (you have ${G.bees})`};
    return{ok:true};
}
// null if tile k can take a new hive from the active hive, otherwise why not
function siteError(k){
    const t=G.tiles[k],h=H();
    if(!t)return'Unexplored land — scout it first';
    if(t.type==='HIVE_BOX')return'There is already a hive here';
    if(!SITE_TYPES.includes(t.type))return`Bees can’t settle on ${TD[t.type].label.toLowerCase()}`;
    const d=hiveDist(t,h);
    if(d<SPLIT_MINDIST)return`Too close — a new hive needs to be at least ${SPLIT_MINDIST} tiles away`;
    if(d>SPLIT_MAXDIST)return`Too far — a swarm only flies ${SPLIT_MAXDIST} tiles`;
    if(G.hives.some(o=>o!==h&&hdist(t.q,t.r,o.q,o.r)<SPLIT_MINDIST))return'Too close to another hive';
    return null;
}
function splitPlan(){
    const n=Math.floor(G.bees*SPLIT_SHARE);
    return{n,honey:G.honey*SPLIT_HONEY,nectar:G.nectar*SPLIT_HONEY};
}
function doSplit(k){
    const c=canSplit();if(!c.ok){toast(c.reason,'warn');return false;}
    const err=siteError(k);if(err){toast(err,'warn');return false;}
    const t=G.tiles[k],parent=H(),plan=splitPlan();
    // the new hive
    const id=++G._hid;
    const nh=makeHive(t.q,t.r,`Hive ${G.hives.length+1}`,id);
    nh.bees=plan.n;nh.honey=plan.honey;nh.nectar=plan.nectar;
    nh.nurses=Math.max(2,Math.round(plan.n*.12));nh.processors=Math.max(1,Math.round(plan.n*.08));nh.builders=Math.max(1,Math.round(plan.n*.05));
    nh.qMode=owns('a_queen')?'auto':parent.qMode;nh.frad=plan.n>=100?2:1;
    // the old hive
    parent.bees-=plan.n;parent.honey-=plan.honey;parent.nectar-=plan.nectar;parent.swarm=0;
    withHive(parent,rebalance);
    // the tile becomes a hive; foragers working it have to go
    t.type='HIVE_BOX';t.stage=3;delete G.restore[k];
    G.hives.forEach(h=>{delete h.fa[k];delete h.pa[k];});
    G.hives.push(nh);
    checkShop();
    G._ach.sp=true;
    withHive(nh,()=>ACT.autoforage());   // give the new hive a working start
    toast(`A new hive is founded with ${plan.n} bees.${nh.qMode==='auto'?' Its queen lays on her own (Auto).':''}`,'mile');hap([60,30,60,30,100]);
    G.placing=false;G.ci=G.hives.indexOf(nh);
    closePanel();
    return true;
}
