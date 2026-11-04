// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const S3=Math.sqrt(3),SZ=38,HS=22;
const SEASONS=['Spring','Summer','Fall','Winter'],SLEN=[25,35,25,15],YEAR=100;
const SCOL={Spring:'#5fd07a',Summer:'#f0c838',Fall:'#e07a30',Winter:'#8ab8e8'};
const STG=['Barren','Sparse','Recovering','Thriving'];
const STAGE_MULT=[0.25,0.6,1,1.3];
const LAY={conserve:2,normal:4,overdrive:7};      // eggs per day
const DEEP_CAPS=[1.5,2,2.5,3];   // lb one storage cell holds, by comb level
const DEEP_COST=[0.15,0.25,0.35]; // lb honey (wax) to deepen one cell to the next level
const DEEP_RATE=1.5;     // cells one builder deepens per day
const CELL_COST=0.4;     // lb honey (as wax) per new cell
const BUILD_RATE=0.5;    // cells per builder per day
const PROC_RATE=1.2;     // lb nectar per processor per day
const PROC_EFF=0.75;     // nectar → honey
const NURSE_CAP=4;       // larvae one nurse can feed
const LARVA_COST=0.04;   // lb honey per larva per day
const ADULT_COST=0.04,WINTER_COST=0.06;
const FORAGE_K=0.07;     // nectar per bee per forage point per day
const MAX_COMB_R=12;      // 469 cells
const TILE_SLOTS=[8,12,16,20];   // foragers one tile can feed per day, by health stage (all hives together)
const DIST_LOSS=0.08;    // each tile beyond the first costs a forager 8% of its load (flight effort)
const PA_RATE=1.0;       // % of a dead zone one pollinator restores per day
const HEAL_RATE=0.006;   // daily chance per forager that its tile improves a stage
const SPLIT_REACH=3,SPLIT_MINDIST=2,SPLIT_MAXDIST=4,SPLIT_MIN_BEES=150,SPLIT_SHARE=0.4,SPLIT_HONEY=0.3,MAX_HIVES=6;
const AUTO_LAY={Spring:'overdrive',Summer:'normal',Fall:'conserve',Winter:'conserve'};
const SITE_TYPES=['WILDFLOWER','FOREST','CLOVER','SUNFLOWER'];

const TD={
    WILDFLOWER:{label:'Wildflower Meadow',forage:3,fill:[0x3a3222,0x4a5a2c,0x5a8a36,0x6cae44],desc:'Mixed blooms. Reliable all season and quick to heal.'},
    FOREST:    {label:'Forest Edge',      forage:2,fill:[0x2c2a1e,0x2e4a26,0x2c6232,0x26803c],desc:'Linden and basswood. Slower, but steady.'},
    CLOVER:    {label:'Clover Field',     forage:4,fill:[0x363222,0x406232,0x4c8c3e,0x5ab44a],desc:'Dense white clover. The best ground forage.'},
    SUNFLOWER: {label:'Sunflower Field',  forage:4,fill:[0x3c3218,0x5c5222,0x8c7622,0xb49424],desc:'Big heads, heavy nectar. Loves summer.'},
    WATER:     {label:'Freshwater',       forage:0,fill:[0x1c4478,0x1c4478,0x1c4478,0x1c4478],desc:'No nectar, but flowers beside water yield 10% more.'},
    DEAD_ZONE: {label:'Dead Zone',        forage:0,fill:[0x2c1e16,0x2c1e16,0x2c1e16,0x2c1e16],desc:'Touched by the Stillness. Pollinators can bring it back.'},
    STRUCTURE: {label:'Old Structure',    forage:0,fill:[0x4a4842,0x4a4842,0x4a4842,0x4a4842],desc:'Something people left behind.'},
    HIVE_BOX:  {label:'Your Hive',        forage:0,fill:[0x8a6010,0x8a6010,0x8a6010,0x8a6010],desc:'Home.'},
};
function lighten(c,a){const r=Math.min(255,((c>>16)&255)+a),g=Math.min(255,((c>>8)&255)+a),b=Math.min(255,(c&255)+a);return(r<<16)|(g<<8)|b;}

// ── HEX MATH (pointy-top axial) ───────────────────────────────────────────────
const DIRS=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
function h2p(q,r){return{x:SZ*S3*(q+r/2),y:SZ*1.5*r};}
function hv2p(q,r){return{x:HS*S3*(q+r/2),y:HS*1.5*r};}
function p2h(px,py,sz=SZ){
    const fr=py/(sz*1.5),fq=px/(sz*S3)-fr/2,fs=-fq-fr;
    let q=Math.round(fq),r=Math.round(fr),s=Math.round(fs);
    const dq=Math.abs(q-fq),dr=Math.abs(r-fr),ds=Math.abs(s-fs);
    if(dq>dr&&dq>ds)q=-r-s;else if(dr>ds)r=-q-s;
    return{q,r};
}
function hkey(q,r){return q+','+r;}
function kq(k){const[q,r]=k.split(',').map(Number);return{q,r};}
function hdist(q1,r1,q2=0,r2=0){return(Math.abs(q1-q2)+Math.abs(q1+r1-q2-r2)+Math.abs(r1-r2))/2;}
function kdist(k){const{q,r}=kq(k);return hdist(q,r);}
function nbrs(q,r){return DIRS.map(([dq,dr])=>[q+dq,r+dr]);}
function ringCells(R){if(R===0)return[[0,0]];const out=[];let q=-R,r=R;for(let s=0;s<6;s++)for(let i=0;i<R;i++){out.push([q,r]);q+=DIRS[s][0];r+=DIRS[s][1];}return out;}
function cors(cx,cy,sz){const p=[];for(let i=0;i<6;i++){const a=Math.PI/180*(60*i-30);p.push(cx+sz*Math.cos(a),cy+sz*Math.sin(a));}return p;}

// ── WORLD GENERATION ──────────────────────────────────────────────────────────
function pick(w){const pool=[];Object.entries(w).forEach(([t,n])=>{for(let i=0;i<n;i++)pool.push(t);});return pool[~~(Math.random()*pool.length)];}
function makeMap(){
    const tiles={};tiles['0,0']={q:0,r:0,type:'HIVE_BOX',stage:3};
    ringCells(1).forEach(([q,r],i)=>{
        const t=i===3?pick({WATER:1,WILDFLOWER:2}):pick({WILDFLOWER:3,CLOVER:2,SUNFLOWER:1,FOREST:1});
        tiles[hkey(q,r)]={q,r,type:t,stage:1};
    });
    for(let R=2;R<=3;R++)ringCells(R).forEach(([q,r])=>{
        const t=pick({WILDFLOWER:4,FOREST:2,CLOVER:2,SUNFLOWER:1,DEAD_ZONE:R===2?6:7,WATER:1,STRUCTURE:R===3?1:0});
        tiles[hkey(q,r)]={q,r,type:t,stage:0};
    });
    return tiles;
}
function makeFog(tiles){
    const fog={};
    ringCells(4).forEach(([q,r])=>fog[hkey(q,r)]={q,r,level:1});
    ringCells(5).forEach(([q,r])=>fog[hkey(q,r)]={q,r,level:2});
    return fog;
}
function makeComb(){
    const c={'0,0':{t:'q',a:-1}};
    // the swarm arrives with some brood already started, so hatching begins early
    for(let R=1;R<=3;R++)ringCells(R).forEach(([q,r],i)=>c[hkey(q,r)]={t:R<=2?'b':'s',a:R<=2&&i%3!==2?(i*5+R*3)%20:-1});
    return c;
}

// ── STATE ─────────────────────────────────────────────────────────────────────
// Everything that belongs to one hive lives on a hive object. G exposes the ACTIVE hive's fields
// (G.bees, G.honey, G.comb ...) through accessors, so the rest of the code reads like one hive.
function makeHive(q,r,name,id){
    return{id,q,r,name,
        bees:15,honey:10,nectar:0,nurses:3,processors:2,builders:1,guards:0,
        fa:{},pa:{},scouts:[],comb:makeComb(),qMode:'normal',newComb:'auto',swarm:0,frad:1,
        combLvl:0,deepDone:0,deepen:false,_dp:0,_bf:0,_df:0,_low:0,_warn:{},
        _nIn:0,_hIn:0,_born:0,_died:0,_wW:false,_w82:false,_wasLow:false,
        sup:[],_up:false,_sbf:0,_rest:0,_log:[]};
}
const HFIELDS=Object.keys(makeHive(0,0,'',0)).filter(k=>!['id','q','r','name'].includes(k));
function bindHive(g){
    HFIELDS.forEach(k=>Object.defineProperty(g,k,{get(){return this.hives[this.ci][k];},set(v){this.hives[this.ci][k]=v;},enumerable:false,configurable:true}));
    return g;
}
function newState(){
    const tiles=makeMap();
    const start=Object.keys(tiles).filter(k=>tiles[k].stage===1&&TD[tiles[k].type].forage).sort((a,b)=>TD[tiles[b].type].forage-TD[tiles[a].type].forage)[0];
    const home=makeHive(0,0,'Home hive',1);
    if(start)home.fa={[start]:8};
    return bindHive({
        tiles,fog:makeFog(tiles),restore:{},
        hives:[home],ci:0,_hid:1,
        hmode:'inspect',
        season:'Spring',day:1,year:1,speed:1,_spd3:true,trips:[],_tid:0,
        _nt:30,_totH:0,_peakB:15,_ach:{},
        _wintersS:0,_tilesRestored:0,_colonyName:'',_lvl:1,_maxHives:1,_landPrev:0,
        kp:null,_kDue:false,
        view:'map',sel:null,_dt:0,cams:{},
    });
}
let G=newState();
const TRANSIENT=['view','sel','_dt','cams','paused','ctab','placing'];
const SPEEDS=[0.5,1,2,3,6];   // 1x is half the old pace
const SK='apiary_v6';
function save(){try{const o={};Object.keys(G).forEach(k=>{if(!TRANSIENT.includes(k))o[k]=G[k];});localStorage.setItem(SK,JSON.stringify(o));}catch(e){}lifeSave();}
// lifetime record: kept under its own key, so it survives replays
const LK='apiary_life';
function lifeRec(){
    let L=null;try{L=JSON.parse(localStorage.getItem(LK));}catch(e){}
    L=Object.assign({runs:1,lvl:0,hives:0,bees:0,years:0},L||{});
    L.lvl=Math.max(L.lvl,G._lvl);L.hives=Math.max(L.hives,G._maxHives||1);L.bees=Math.max(L.bees,G._peakB);L.years=Math.max(L.years,G._wintersS);
    return L;
}
function lifeSave(L){try{localStorage.setItem(LK,JSON.stringify(L||lifeRec()));}catch(e){}}
function load(){
    try{const raw=localStorage.getItem(SK);if(!raw)return false;
        const o=JSON.parse(raw);const base=newState();
        // an old single-hive save has bees/comb/... at the top level; the accessors drop them into the home hive
        G=Object.assign(base,o);
        G.hives=G.hives.map(h=>Object.assign(makeHive(h.q,h.r,h.name,h.id),h));
        if(!(G.ci>=0&&G.ci<G.hives.length))G.ci=0;
        G._hid=Math.max(G._hid||1,...G.hives.map(h=>h.id));
        G.view='map';G.sel=null;G._dt=0;G.cams={};G.placing=false;
        if(o._lvl==null){checkLevel(true);G._landPrev=landRank();}   // save from before levels
        if(G.kp)G.kp.name='Rowan';
        // the slower pace applies to every save: keep the speed's label, never shift it to hold the old pace
        if(!o._spd3){G.speed=o._spd2?1:(SPEEDS.includes(o.speed)?o.speed:3);G._spd3=true;}
        // scouts from before area trips: let them finish now
        G.hives.forEach(h=>{h.scouts.filter(s=>s.k).forEach(s=>withHive(h,()=>revealTile(s.k,true)));h.scouts=h.scouts.filter(s=>!s.k);});
        // patch trips from before territories: each becomes a trip to the territory it started in, keeping its scouts
        G.trips=G.trips.filter(t=>{
            if(t.terr)return true;
            const k=(t.hexes||[]).find(x=>G.fog[x]);const id=k&&terrOfK(k);
            if(!id||G.trips.some(o=>o.terr===id)){G.hives.forEach(h=>h.scouts=h.scouts.filter(s=>s.t!==t.id));return false;}
            t.terr=id;t.name=terrName(id);t.total=terrHexes(id).length;t.work=0;delete t.hexes;delete t.done;delete t.found;
            return true;
        });
        openFog();
        return true;
    }catch(e){return false;}
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
const sum=o=>Object.values(o).reduce((a,b)=>a+b,0);
function foragerTotal(){return sum(G.fa);}
function pollTotal(){return sum(G.pa);}
function scoutTotal(){return G.scouts.reduce((a,s)=>a+s.n,0);}
function occupied(){return G.nurses+G.processors+G.builders+G.guards+foragerTotal()+pollTotal()+scoutTotal();}
function idle(){return Math.max(0,G.bees-occupied());}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function seasonOf(d){let n=d,i=0;while(i<3&&n>SLEN[i]){n-=SLEN[i];i++;}return SEASONS[i];}
function dayInSeason(d){let n=d,i=0;while(i<3&&n>SLEN[i]){n-=SLEN[i];i++;}return n;}
function seasonStart(s){let st=1;for(let i=0;i<SEASONS.indexOf(s);i++)st+=SLEN[i];return st;}
function seasonMult(){return{Spring:1,Summer:1.2,Fall:.6,Winter:0}[G.season];}
function H(){return G.hives[G.ci];}
function hiveDist(t,h){h=h||H();return hdist(t.q,t.r,h.q,h.r);}
function inRange(t){return hiveDist(t)<=G.frad;}
function totalBees(){return G.hives.reduce((a,h)=>a+h.bees,0);}
let _ctx=null;   // name of the hive being processed, so toasts can say which one
function withHive(h,fn){
    const i=G.hives.indexOf(h);if(i<0)return;
    const pv=G.hives[G.ci],pc=_ctx;G.ci=i;_ctx=G.hives.length>1?h.name:null;
    try{return fn();}finally{G.ci=Math.max(0,G.hives.indexOf(pv));_ctx=pc;}
}
function tileForagers(k){let n=0;for(const h of G.hives)n+=h.fa[k]||0;return n;}
function tileSlots(k){const t=G.tiles[k];return t?TILE_SLOTS[t.stage]:0;}
function guardsNeeded(){return Math.max(2,Math.ceil(G.bees/30));}
// nectar one forager of the ACTIVE hive brings from tile k: flight cost by distance, shared by everyone on the tile
function isMill(k){return!!(G.kp&&G.kp.mills[k]);}
function tileYield(k){
    const t=G.tiles[k];if(!t||isMill(k))return 0;const d=TD[t.type];if(!d.forage)return 0;
    const water=nbrs(t.q,t.r).some(([q,r])=>{const n=G.tiles[hkey(q,r)];return n&&n.type==='WATER';});
    const flight=Math.max(.4,1-DIST_LOSS*(Math.max(1,hiveDist(t))-1));
    const tot=tileForagers(k),slots=tileSlots(k),crowd=tot>slots?slots/tot:1;
    return d.forage*STAGE_MULT[t.stage]*FORAGE_K*seasonMult()*(water?1.1:1)*flight*crowd;
}
function hasWater(t){return nbrs(t.q,t.r).some(([q,r])=>{const n=G.tiles[hkey(q,r)];return n&&n.type==='WATER';});}

// ── COMB ──────────────────────────────────────────────────────────────────────
function combCount(t){let n=0;for(const c of Object.values(G.comb))if(c.t===t)n++;return n;}
function cellCapAt(l){return DEEP_CAPS[clamp(l|0,0,DEEP_CAPS.length-1)];}
function deepening(){return !!G.deepen&&(G.combLvl||0)<DEEP_CAPS.length-1&&combCount('s')>0;}
// storage cells already deepened to the next level hold the bigger amount
function capacity(){
    const n=combCount('s'),l=G.combLvl||0;if(!n)return 0;
    const bonus=l<DEEP_CAPS.length-1?Math.min(G.deepDone||0,n)*(cellCapAt(l+1)-cellCapAt(l)):0;
    return n*cellCapAt(l)+bonus;
}
function perCell(){const n=combCount('s');return n?capacity()/n:cellCapAt(G.combLvl);}
// the storage cell closest to the centre that sits nearer than distance d (for tidying brood inward)
function innerStorage(d){
    let best=null,bd=d;
    for(const[k,c]of Object.entries(G.comb)){if(c.t!=='s')continue;const kd=kdist(k);if(kd<bd||(kd===bd&&best&&k<best)){bd=kd;best=k;}}
    return bd<d?best:null;
}
function broodStats(){
    let eggs=0,larvae=0,capped=0,empty=0,dead=0,total=0;
    for(const c of Object.values(G.comb)){
        if(c.t!=='b')continue;total++;
        if(c.d>0)dead++;else if(c.a<0)empty++;else if(c.a<=2)eggs++;else if(c.a<=8)larvae++;else capped++;
    }
    return{eggs,larvae,capped,empty,dead,total};
}
function nextFrontier(){
    let best=null,bd=1e9;
    for(const k of Object.keys(G.comb)){
        const{q,r}=kq(k);
        for(const[nq,nr]of nbrs(q,r)){
            const nk=hkey(nq,nr);if(G.comb[nk])continue;
            const d=hdist(nq,nr);if(d>MAX_COMB_R)continue;
            const ang=Math.atan2(hv2p(nq,nr).y,hv2p(nq,nr).x);
            const score=d*10+ang;
            if(score<bd){bd=score;best=nk;}
        }
    }
    return best;
}
// the laying mode actually in force (Auto follows the seasons)
function effMode(){return G.qMode==='auto'?AUTO_LAY[G.season]:G.qMode;}
function layNow(){return G.season==='Winter'?0:LAY[effMode()];}
// Auto queen: brood cells she can use = the most she can fill in one 21-day cycle, plus a few spare
function autoBroodTarget(){
    const rate=layNow();if(!rate)return 0;
    return Math.min(rate*21+4,Math.floor((Object.keys(G.comb).length-1)*0.75));
}
function newCellType(){
    if(G.qMode==='auto')return's';
    if(G.newComb!=='auto')return G.newComb;
    // give the queen room for a full 21-day cycle, unless honey has nowhere to go
    const fill=(G.honey+G.nectar)/Math.max(1,capacity());
    if(broodStats().total<LAY[G.qMode]*21&&fill<0.95)return'b';
    return's';
}

// ── ECONOMY (single source of truth for rates) ────────────────────────────────
function econ(){
    let nectarIn=0;
    for(const[k,n]of Object.entries(G.fa))nectarIn+=tileYield(k)*n;
    const procCap=G.processors*PROC_RATE;
    const processed=Math.min(G.nectar+nectarIn,procCap);
    const honeyIn=processed*PROC_EFF;
    const winter=G.season==='Winter';
    const adultCost=G.bees*(winter?WINTER_COST:ADULT_COST);
    const bs=broodStats();
    const nurseCap=G.nurses*NURSE_CAP;
    const fedLarvae=Math.min(bs.larvae,nurseCap);
    const larvaCost=fedLarvae*LARVA_COST;
    const canBuild=!!nextFrontier();
    const dpg=deepening();
    const deepRate=dpg&&!winter?G.builders*DEEP_RATE:0;
    const deepCost=dpg?DEEP_COST[G.combLvl]:0;
    const buildRate=(!dpg&&canBuild)?G.builders*BUILD_RATE:0;
    const buildCost=buildRate*CELL_COST+deepRate*deepCost;
    const layRate=layNow();
    return{nectarIn,procCap,processed,honeyIn,adultCost,larvaCost,buildRate,buildCost,canBuild,
        net:honeyIn-adultCost-larvaCost-buildCost,bs,nurseCap,fedLarvae,layRate,cap:capacity(),dpg,deepRate,deepCost};
}
function winterNeed(){return Math.ceil(G.bees*0.9*WINTER_COST*SLEN[3]);}

// ── KEEP ROLES WITHIN POPULATION ──────────────────────────────────────────────
function rebalance(){
    let over=occupied()-G.bees;
    const biggest=o=>{let bk=null,bn=0;for(const[k,n]of Object.entries(o))if(n>bn){bn=n;bk=k;}return bk;};
    while(over>0){
        let k=biggest(G.fa);if(k){if(--G.fa[k]<=0)delete G.fa[k];over--;continue;}
        k=biggest(G.pa);if(k){if(--G.pa[k]<=0)delete G.pa[k];over--;continue;}
        if(G.builders>0){G.builders--;over--;continue;}
        if(G.guards>0){G.guards--;over--;continue;}
        if(G.processors>1){G.processors--;over--;continue;}
        if(G.nurses>1){G.nurses--;over--;continue;}
        if(G.processors>0){G.processors--;over--;continue;}
        if(G.nurses>0){G.nurses--;over--;continue;}
        break;
    }
}

// ── COLONY LEVELS ─────────────────────────────────────────────────────────────
// Levels only go up. Each one opens new things to do, and some give the hives a new instinct
// (a job the bees now handle on their own, for good). Levels past 5 get added as the game grows.
const LEVELS=[null,
    {name:'New Swarm',need:()=>[],
     opens:['Foraging and worker jobs','Scouting the fog','Painting brood and storage comb','Deepening the comb']},
    {name:'Wintered Colony',need:()=>[['Winters survived',G._wintersS,1]],
     opens:['Queen laying modes','Pollinators, to heal dead zones','A name for your colony'],
     story:'The colony has known cold and kept its warmth.'},
    {name:'Thriving Colony',need:()=>[['Most bees at once',G._peakB,100],['Dead zones restored',G._tilesRestored,1]],
     opens:['Pollinators work 20% faster','Splitting a hive (also needs a forage range of 3)'],
     story:'Where the bees have worked, the land has changed.'},
    {name:'Two Hives',need:()=>[['Hives founded',G._maxHives,2]],
     opens:['Hive chips and alerts across your hives'],
     inst:'Auto queen',instD:'Every queen follows the seasons on her own: hard in spring, steady in summer, light in fall, resting in winter. She keeps only the brood room she can fill.',
     story:'The colony is no longer one hive. It is spreading.'},
    {name:'The Colony',need:()=>[['Hives founded',G._maxHives,3]],
     opens:['A beekeeper arrives the next spring','A new Colony page: Hives, Land and Swarms'],
     inst:'Jobs and honey',instD:'Every hive plans its own day: nurses for the brood, processors for the nectar, guards for the season, and everyone else out to the best fields. Builders only use honey above the winter reserve, building comb first and then deepening it. Pollinators and scouts are still yours to send.',
     story:'Three hives, one colony. The bees begin to look after themselves.'},
];
const MAX_LEVEL=LEVELS.length-1;
function levelMet(n){return LEVELS[n].need().every(([,v,t])=>v>=t);}
let _lvlQ=[];
// silent: work out the level for an old save without the level-up cards
function checkLevel(silent){
    G._maxHives=Math.max(G._maxHives||1,G.hives.length);
    while(G._lvl<MAX_LEVEL&&levelMet(G._lvl+1)){
        G._lvl++;onLevelUp(G._lvl,silent);
    }
}
function onLevelUp(n,silent){
    if(n===2&&!G._colonyName)G._colonyName=genColonyName();
    if(n>=4)G.hives.forEach(h=>h.qMode='auto');   // the Auto queen instinct is permanent
    if(silent)return;
    _lvlQ.push(n);hap([40,20,40,20,40]);
    if(!document.querySelector('#ov-l.show'))showNextLevel();
}
function showNextLevel(){
    const n=_lvlQ.shift();if(!n)return;
    const L=LEVELS[n];
    document.getElementById('lv-n').textContent=`Level ${n}`;
    document.getElementById('lv-name').textContent=L.name;
    document.getElementById('lv-story').textContent=L.story||'';
    document.getElementById('lv-list').innerHTML=
        (L.inst?`<div class="lv-inst"><b>New hive instinct: ${L.inst}</b>${L.soon?' <em>(arrives next update)</em>':''}<span>${L.instD}</span></div>`:'')+
        `<div class="lv-h">Now open</div><ul>${L.opens.map(o=>`<li>${o}</li>`).join('')}</ul>`+
        (n===2&&G._colonyName?`<p class="lv-note">Your colony is now known as ${G._colonyName}.</p>`:'');
    Snd.mile();ovShow('ov-l');
}
function instincts(){return LEVELS.slice(1,G._lvl+1).filter(L=>L.inst);}

// ── LAND HEALING (its own track, beside the levels) ──────────────────────────
function restorationPct(){
    const c=Object.values(G.tiles).filter(t=>t.type!=='HIVE_BOX'&&t.type!=='WATER'&&t.type!=='STRUCTURE');
    return c.length?c.filter(t=>t.type!=='DEAD_ZONE'&&t.stage>=2).length/c.length*100:0;
}
const LAND_AT=[0,20,40,60];   // % healed for Barren, Sparse, Recovering, Thriving
function landRank(){const p=restorationPct();let r=0;LAND_AT.forEach((v,i)=>{if(p>=v)r=i;});return r;}
const LAND_MSG={1:'Green is creeping back into the land.',2:'The land is recovering. Fields that were dust are blooming again.',3:'A landscape that looks different than it did when they arrived. Varroa now does 25% less harm.'};
function checkLand(){
    const r=landRank();
    if(r>(G._landPrev||0)){
        G._landPrev=r;toast(LAND_MSG[r],'mile');
        if(r===3)setTimeout(()=>toast('Someone has been watching. A researcher has noticed your territory.','mile'),3500);
    }
}
function genColonyName(){
    const counts={};
    Object.entries(G.fa).forEach(([k,n])=>{const t=G.tiles[k];if(t)counts[t.type]=(counts[t.type]||0)+n;});
    const nm={WILDFLOWER:'Meadow',FOREST:'Forest Edge',CLOVER:'Clover',SUNFLOWER:'Sunflower'};
    const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
    const dir=['North','South','East','West'][~~(Math.random()*4)];
    return`The ${dir} ${top?(nm[top[0]]||'Wild'):'Wild'} Colony`;
}
// ── MILESTONES ────────────────────────────────────────────────────────────────
const MS=[
    {id:'b30', chk:()=>totalBees()>=30, msg:'Colony growing — 30 bees'},
    {id:'b60', chk:()=>totalBees()>=60, msg:'A busy hive — 60 bees'},
    {id:'b100',chk:()=>totalBees()>=100,msg:'One hundred strong — forage range grows'},
    {id:'b200',chk:()=>totalBees()>=200,msg:'The hive is roaring with life'},
    {id:'c60', chk:()=>G.hives.some(h=>Object.keys(h.comb).length>=61),msg:'The comb fills the frame'},
    {id:'h30', chk:()=>G._totH>=30, msg:'Thirty pounds of honey made'},
    {id:'h150',chk:()=>G._totH>=150,msg:"A season's worth of honey"},
    {id:'s3',  chk:()=>(G._ach._terr||0)>=3,msg:'Three territories mapped'},
    {id:'w1',  chk:()=>G._wintersS>=1,msg:'First winter — survived'},
    {id:'w2',  chk:()=>G._wintersS>=2,msg:'A second winter endured'},
    {id:'w5',  chk:()=>G._wintersS>=5,msg:'Five winters. The colony endures.'},
    {id:'hv2', chk:()=>G.hives.length>=2,msg:'A second hive — the colony spreads'},
    {id:'sp',  chk:()=>!!G._ach.sp,msg:'Swarm instinct redirected'},
    {id:'rcv', chk:()=>G.hives.some(h=>h._wasLow&&h.bees>50),msg:'They pulled back from the edge'},
];
function checkMS(){MS.forEach(m=>{if(!G._ach[m.id]&&m.chk()){G._ach[m.id]=true;toast(m.msg,'mile');hap([40,20,40]);}});}

// ── AUDIO ─────────────────────────────────────────────────────────────────────
const Snd=(()=>{
    let ctx,gn,ready=false;
    function _start(){
        if(ready)return;
        try{
            ctx=new(window.AudioContext||window.webkitAudioContext)();
            gn=ctx.createGain();gn.gain.value=0.01;gn.connect(ctx.destination);
            [238,242].forEach(f=>{const o=ctx.createOscillator();o.frequency.value=f;o.connect(gn);o.start();});
            ready=true;
        }catch(e){}
    }
    function tone(freq,dur=60,type='sine',vol=0.04){
        if(!ready)return;
        const g=ctx.createGain();g.gain.setValueAtTime(vol,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur/1000);g.connect(ctx.destination);
        const o=ctx.createOscillator();o.type=type;o.frequency.value=freq;o.connect(g);o.start();o.stop(ctx.currentTime+dur/1000+0.05);
    }
    return{
        _start,
        setVol(){if(ready)gn.gain.value=0.006+Math.min(1,foragerTotal()/Math.max(1,G.bees))*0.03;},
        tap:()=>tone(420,30),
        honey:()=>{tone(660,40);setTimeout(()=>tone(880,40),60);},
        danger:()=>tone(280,120,'sawtooth',0.05),
        mile:()=>{tone(528,80);setTimeout(()=>tone(660,80),100);setTimeout(()=>tone(792,120),200);},
        revive:()=>{tone(440,100);setTimeout(()=>tone(550,100),120);setTimeout(()=>tone(660,150),240);},
    };
})();
function hap(p){try{if(navigator.vibrate)navigator.vibrate(p);}catch(e){}}

// ── OVERLAYS ──────────────────────────────────────────────────────────────────
function ovShow(id){document.getElementById(id).classList.add('show');}
function ovHide(id){document.getElementById(id).classList.remove('show');}
function ovOpen(){return!!document.querySelector('.ov.show');}
function beginGame(){
    const nm=document.getElementById('col-name-in').value.trim();
    if(nm)G._colonyName=nm;
    ovHide('ov-i');save();renderAll();
    toast('Tap a green flower tile next to the hive to send foragers','green');
}
function newGame(){
    const L=lifeRec();L.runs++;lifeSave(L);
    G=newState();openFog();save();
    ['ov-g','ov-c'].forEach(ovHide);
    if(window._S)window._S.rebuild();
    setView('map');closePanel();renderAll();
    document.getElementById('col-name-in').value='';
    ovShow('ov-i');
}
