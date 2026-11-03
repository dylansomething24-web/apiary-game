// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const S3=Math.sqrt(3),SZ=38,HS=22;
const SEASONS=['Spring','Summer','Fall','Winter'],SLEN=[25,35,25,15],YEAR=100;
const SCOL={Spring:'#5fd07a',Summer:'#f0c838',Fall:'#e07a30',Winter:'#8ab8e8'};
const STG=['Barren','Sparse','Recovering','Thriving'];
const STAGE_MULT=[0.25,0.6,1,1.3];
const STAGE_NAMES=['','New Swarm','Wintered Colony','Thriving Colony','Proven Colony','Legacy Colony'];
const LAY={conserve:2,normal:4,overdrive:7};      // eggs per day
const CELL_CAP=1.5;      // lb of honey/nectar one storage cell holds
const CELL_COST=0.4;     // lb honey (as wax) per new cell
const BUILD_RATE=0.5;    // cells per builder per day
const PROC_RATE=1.2;     // lb nectar per processor per day
const PROC_EFF=0.75;     // nectar → honey
const NURSE_CAP=4;       // larvae one nurse can feed
const LARVA_COST=0.04;   // lb honey per larva per day
const ADULT_COST=0.04,WINTER_COST=0.06;
const FORAGE_K=0.07;     // nectar per bee per forage point per day
const MAX_COMB_R=10;
const SCOUT_BEES=2,SCOUT_DAYS=3;

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
        const t=pick({WILDFLOWER:4,FOREST:2,CLOVER:2,SUNFLOWER:1,DEAD_ZONE:3,WATER:1,STRUCTURE:R===3?1:0});
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
function newState(){
    const tiles=makeMap();
    const start=Object.keys(tiles).filter(k=>tiles[k].stage===1&&TD[tiles[k].type].forage).sort((a,b)=>TD[tiles[b].type].forage-TD[tiles[a].type].forage)[0];
    return{
        bees:15,honey:10,nectar:0,
        nurses:3,processors:2,builders:1,guards:0,
        fa:start?{[start]:8}:{},pa:{},restore:{},scouts:[],
        tiles,fog:makeFog(tiles),comb:makeComb(),
        qMode:'normal',newComb:'auto',hmode:'inspect',
        season:'Spring',day:1,year:1,frad:1,
        speed:1,swarm:0,
        _bf:0,_df:0,_low:0,_nt:30,_warn:{},
        _totH:0,_peakB:15,_ach:{},
        _wintersS:0,_tilesRestored:0,_stagePrev:1,_colonyName:'',
        _wW:false,_w82:false,_wasLow:false,
        _nIn:0,_hIn:0,_born:0,_died:0,
        view:'map',sel:null,_dt:0,cams:{},
    };
}
let G=newState();
const TRANSIENT=['view','sel','_dt','cams','paused'];
const SPEEDS=[0.5,1,2,4];
const SK='apiary_v6';
function save(){try{const o={};Object.keys(G).forEach(k=>{if(!TRANSIENT.includes(k))o[k]=G[k];});localStorage.setItem(SK,JSON.stringify(o));}catch(e){}}
function load(){
    try{const raw=localStorage.getItem(SK);if(!raw)return false;
        const o=JSON.parse(raw);const base=newState();
        G=Object.assign(base,o);G.view='map';G.sel=null;G._dt=0;G.cams={};
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
function inRange(t){return hdist(t.q,t.r)<=G.frad;}
function guardsNeeded(){return Math.max(2,Math.ceil(G.bees/30));}
function tileYield(k){
    const t=G.tiles[k];if(!t)return 0;const d=TD[t.type];if(!d.forage)return 0;
    const water=nbrs(t.q,t.r).some(([q,r])=>{const n=G.tiles[hkey(q,r)];return n&&n.type==='WATER';});
    return d.forage*STAGE_MULT[t.stage]*FORAGE_K*seasonMult()*(water?1.1:1);
}
function hasWater(t){return nbrs(t.q,t.r).some(([q,r])=>{const n=G.tiles[hkey(q,r)];return n&&n.type==='WATER';});}

// ── COMB ──────────────────────────────────────────────────────────────────────
function combCount(t){let n=0;for(const c of Object.values(G.comb))if(c.t===t)n++;return n;}
function capacity(){return combCount('s')*CELL_CAP;}
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
function newCellType(){
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
    const buildRate=canBuild?G.builders*BUILD_RATE:0;
    const buildCost=buildRate*CELL_COST;
    const layRate=winter?0:LAY[G.qMode];
    return{nectarIn,procCap,processed,honeyIn,adultCost,larvaCost,buildRate,buildCost,canBuild,
        net:honeyIn-adultCost-larvaCost-buildCost,bs,nurseCap,fedLarvae,layRate,cap:capacity()};
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

// ── HIVE STAGE SYSTEM ─────────────────────────────────────────────────────────
function restorationPct(){
    const c=Object.values(G.tiles).filter(t=>t.type!=='HIVE_BOX'&&t.type!=='WATER'&&t.type!=='STRUCTURE');
    return c.length?c.filter(t=>t.type!=='DEAD_ZONE'&&t.stage>=2).length/c.length*100:0;
}
function getStage(){
    const rp=restorationPct();
    if(G._wintersS>=3&&G._peakB>=300&&rp>=60)return 5;
    if(G._wintersS>=2&&G._peakB>=200&&rp>=40)return 4;
    if(G._peakB>=100&&G._tilesRestored>=1&&G._wintersS>=1)return 3;
    if(G._wintersS>=1)return 2;
    return 1;
}
function stageNextDesc(){
    const s=getStage(),rp=~~restorationPct();
    if(s===1)return'Survive your first winter';
    if(s===2)return`Reach 100 bees (${G._peakB}) and restore a dead zone (${G._tilesRestored}/1)`;
    if(s===3)return`200 bees (${G._peakB}) · 2 winters (${G._wintersS}) · 40% land healed (${rp}%)`;
    if(s===4)return`300 bees (${G._peakB}) · 3 winters (${G._wintersS}) · 60% land healed (${rp}%)`;
    return'Legacy reached';
}
function genColonyName(){
    const counts={};
    Object.entries(G.fa).forEach(([k,n])=>{const t=G.tiles[k];if(t)counts[t.type]=(counts[t.type]||0)+n;});
    const nm={WILDFLOWER:'Meadow',FOREST:'Forest Edge',CLOVER:'Clover',SUNFLOWER:'Sunflower'};
    const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
    const dir=['North','South','East','West'][~~(Math.random()*4)];
    return`The ${dir} ${top?(nm[top[0]]||'Wild'):'Wild'} Colony`;
}
function onStageAdvance(stage){
    const msgs={
        2:'The colony has known cold and kept its warmth. Queen laying modes and pollinators are now yours to command.',
        3:'Where the bees have worked, the land has changed. Pollinators now restore 20% faster.',
        4:'Two winters. A hive that has bent and held.',
        5:'Three winters. A landscape that looks different than it did when they arrived.',
    };
    if(msgs[stage])setTimeout(()=>toast(msgs[stage],'mile'),600);
    hap([40,20,40,20,40]);
    if(stage===2&&!G._colonyName){G._colonyName=genColonyName();setTimeout(()=>toast(`Your colony is now known as ${G._colonyName}`,'green'),2000);}
    if(stage===5)setTimeout(()=>toast('Someone has been watching. A researcher has noticed your territory.','mile'),3500);
}

// ── MILESTONES ────────────────────────────────────────────────────────────────
const MS=[
    {id:'b30', chk:()=>G.bees>=30, msg:'Colony growing — 30 bees'},
    {id:'b60', chk:()=>G.bees>=60, msg:'A busy hive — 60 bees'},
    {id:'b100',chk:()=>G.bees>=100,msg:'One hundred strong — forage range grows'},
    {id:'b200',chk:()=>G.bees>=200,msg:'The hive is roaring with life'},
    {id:'c60', chk:()=>Object.keys(G.comb).length>=61,msg:'The comb fills the frame'},
    {id:'h30', chk:()=>G._totH>=30, msg:'Thirty pounds of honey made'},
    {id:'h150',chk:()=>G._totH>=150,msg:"A season's worth of honey"},
    {id:'s3',  chk:()=>(G._ach._scouted||0)>=3,msg:'Three territories mapped'},
    {id:'w1',  chk:()=>G._wintersS>=1,msg:'First winter — survived'},
    {id:'w2',  chk:()=>G._wintersS>=2,msg:'A second winter endured'},
    {id:'w5',  chk:()=>G._wintersS>=5,msg:'Five winters. The colony endures.'},
    {id:'sp',  chk:()=>!!G._ach.sp,msg:'Swarm instinct redirected'},
    {id:'rcv', chk:()=>G._wasLow&&G.bees>50,msg:'They pulled back from the edge'},
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
    G=newState();save();
    ['ov-g','ov-c'].forEach(ovHide);
    if(window._S)window._S.rebuild();
    setView('map');closePanel();renderAll();
    document.getElementById('col-name-in').value='';
    ovShow('ov-i');
}
