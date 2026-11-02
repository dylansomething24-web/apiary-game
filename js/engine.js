// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const S3=Math.sqrt(3),SZ=38,HS=30;
const SEASONS=['Spring','Summer','Fall','Winter'];
const SLEN=[25,35,25,15]; // days per season
const SC={Spring:0x50cc70,Summer:0xe8c030,Fall:0xc86020,Winter:0x78a8d8};
const STG=['Dead','Sparse','Recovering','Thriving'];
const STAGE_NAMES=['','New Swarm','Wintered Colony','Thriving Colony','Proven Colony','Legacy Colony'];

const TD={
    WILDFLOWER:{label:'Wildflower Meadow',forage:3,fill:[0x181008,0x1c200c,0x2a3814,0x407020],rim:[0x281808,0x303818,0x485828,0x608838]},
    FOREST:    {label:'Forest Edge',      forage:2,fill:[0x100c06,0x161408,0x203010,0x2c4818],rim:[0x201408,0x28200e,0x384820,0x4a6028]},
    CLOVER:    {label:'Clover Field',     forage:4,fill:[0x141008,0x1e2010,0x2a3818,0x386030],rim:[0x281808,0x303818,0x486028,0x508848]},
    SUNFLOWER: {label:'Sunflower Field',  forage:4,fill:[0x180c04,0x20180a,0x2c2810,0x504018],rim:[0x281408,0x382810,0x4a3818,0x786030]},
    WATER:     {label:'Freshwater',       forage:0,fill:[0x080c18,0x0c1428,0x10203a,0x183050],rim:[0x101828,0x182030,0x203848,0x285060]},
    DEAD_ZONE: {label:'Dead Zone',        forage:0,fill:[0x0c0804,0x120c06,0x160e08,0x1a1008],rim:[0x1a1008,0x201408,0x241608,0x2a1808]},
    STRUCTURE: {label:'Old Structure',    forage:0,fill:[0x141210,0x1a1814,0x201e18,0x282420],rim:[0x242018,0x2a2620,0x302c28,0x383430]},
    HIVE_BOX:  {label:'Your Hive',        forage:0,fill:[0x382808,0x483810,0x584818,0x685820],rim:[0x503c10,0x604c18,0x705c20,0x806c30]},
};

// ── HEX MATH ──────────────────────────────────────────────────────────────────
function h2p(q,r){return{x:SZ*S3*(q+r*.5),y:SZ*1.5*r};}
function hv2p(q,r){return{x:HS*S3*(q+r*.5),y:HS*1.5*r};}
function p2h(px,py,sz=SZ){const r=py/(sz*1.5),q=px/(sz*S3)-r*.5;const rq=Math.round(q),rr=Math.round(r),rs=Math.round(-q-r);const dq=Math.abs(rq-q),dr=Math.abs(rr-r),ds=Math.abs(rs-(-q-r));if(dq>dr&&dq>ds)return{q:-rr-rs,r:rr};if(dr>ds)return{q:rq,r:-rq-rs};return{q:rq,r:rs};}
function hkey(q,r){return`${q},${r}`;}
function hdist(q1,r1,q2,r2){return(Math.abs(q1-q2)+Math.abs(q1+r1-q2-r2)+Math.abs(r1-r2))/2;}
function nbrs(q,r){return[[q+1,r],[q-1,r],[q,r+1],[q,r-1],[q+1,r-1],[q-1,r+1]];}
function ring(rad){const pts=[];for(let s=0;s<6;s++){const dq=[1,0,-1,-1,0,1][s],dr=[0,1,1,0,-1,-1][s];for(let i=0;i<rad;i++)pts.push([dq*rad+(dr-dq)*i,dr*rad+(-dr)*i]);}return pts;}
function cors(cx,cy,sz){const p=[];for(let i=0;i<6;i++){const a=Math.PI/180*(60*i-30);p.push(cx+sz*Math.cos(a),cy+sz*Math.sin(a));}return p;}

// ── MAP GENERATION ────────────────────────────────────────────────────────────
const MAP_WEIGHTS={WILDFLOWER:3,FOREST:2,CLOVER:2,SUNFLOWER:1,DEAD_ZONE:1};
function randType(){const pool=[];Object.entries(MAP_WEIGHTS).forEach(([t,w])=>{for(let i=0;i<w;i++)pool.push(t);});return pool[~~(Math.random()*pool.length)];}
function makeMap(){
    const tiles={};
    tiles[hkey(0,0)]={q:0,r:0,type:'HIVE_BOX',stage:2};
    for(let rad=1;rad<=3;rad++){
        ring(rad).forEach(([q,r])=>{
            let t=randType();
            if(rad===1&&t==='DEAD_ZONE')t='WILDFLOWER';
            tiles[hkey(q,r)]={q,r,type:t,stage:rad===1?1:0};
        });
    }
    return tiles;
}
function makeFog(tiles){
    const fog={};
    Object.values(tiles).forEach(({q,r})=>{
        nbrs(q,r).forEach(([nq,nr])=>{
            const k=hkey(nq,nr);
            if(!tiles[k]&&!fog[k])fog[k]={q:nq,r:nr,level:1};
        });
    });
    Object.keys(fog).forEach(k=>{
        const{q,r}=fog[k];
        nbrs(q,r).forEach(([nq,nr])=>{
            const fk=hkey(nq,nr);
            if(!tiles[fk]&&!fog[fk])fog[fk]={q:nq,r:nr,level:2};
        });
    });
    return fog;
}

// ── GAME STATE ────────────────────────────────────────────────────────────────
const G0=()=>({
    bees:15,honey:0,nectar:0,
    nurses:2,guards:0,processors:1,
    season:'Spring',day:1,year:1,
    frad:1,fa:{},pa:{},restore:{},
    brood:0,scouts:[],tiles:{},fog:{},
    view:'map',selKey:null,panelOpen:false,fogPanel:null,
    speed:1,ms:3000,_dt:0,_hf:0,_nf:0,
    swarm:0,_col:0,
    _wH:false,_wW:false,_nt:40,
    _totH:0,_peakB:15,_ach:{},
    qMode:'normal',_distress:[],_hbWarn:false,
    _wintersS:0,_tilesRestored:0,_stagePrev:1,_colonyName:'',_w82:false,
    _wasLow:false,
});
let G=G0();

// ── SAVE / LOAD ───────────────────────────────────────────────────────────────
const SK='apiary_v5';
const SF=['bees','honey','nectar','nurses','guards','processors','season','day','year',
    'frad','fa','pa','restore','brood','scouts','tiles','fog','speed','swarm','_col',
    '_wH','_wW','_nt','_hf','_nf','_totH','_peakB','_ach','qMode','_distress','_hbWarn',
    '_wintersS','_tilesRestored','_stagePrev','_colonyName','_w82','_wasLow'];
function save(){try{const o={};SF.forEach(k=>o[k]=G[k]);localStorage.setItem(SK,JSON.stringify(o));}catch(e){}}
function load(){
    try{
        const raw=localStorage.getItem(SK);
        if(!raw)return false;
        const o=JSON.parse(raw);
        SF.forEach(k=>{if(k in o)G[k]=o[k];});
        G.ms=G.speed===3?1000:G.speed===2?2000:3000;
        return true;
    }catch(e){return false;}
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function foragerTotal(){return Object.values(G.fa).reduce((a,b)=>a+b,0);}
function pollTotal(){return Object.values(G.pa).reduce((a,b)=>a+b,0);}
function occupied(){return G.nurses+G.guards+G.processors+foragerTotal()+pollTotal();}
function free(){return Math.max(0,G.bees-occupied());}
function clamp(v,mn,mx){return Math.max(mn,Math.min(mx,v));}
function doyStr(d){let n=d,i=0;while(n>SLEN[i]){n-=SLEN[i];i++;}return SEASONS[i%4];}
function doyNum(d){let n=d,i=0;while(n>SLEN[i]){n-=SLEN[i];i++;}return n;}
function sfrom(s){let start=0;const idx=SEASONS.indexOf(s);for(let i=0;i<idx;i++)start+=SLEN[i];return start+1;}

// ── HIVE STAGE SYSTEM ─────────────────────────────────────────────────────────
function restorationPct(){
    const tiles=Object.values(G.tiles);
    const cands=tiles.filter(t=>t.type!=='HIVE_BOX'&&t.type!=='WATER'&&t.type!=='STRUCTURE');
    if(!cands.length)return 0;
    return(cands.filter(t=>t.stage>=2).length/cands.length)*100;
}
function getStage(){
    if(G._wintersS>=3&&G.bees>=300&&restorationPct()>=60)return 5;
    if(G._wintersS>=2&&G.bees>=200&&restorationPct()>=40)return 4;
    if(G.bees>=100&&G._tilesRestored>=1)return 3;
    if(G._wintersS>=1)return 2;
    return 1;
}
function stageNextDesc(){
    const s=getStage();
    if(s===1)return'Survive first winter with 15+ bees';
    if(s===2)return`100 bees (${G.bees}/100) · restore 1 dead zone (${G._tilesRestored}/1)`;
    if(s===3){const rp=~~restorationPct();return`200 bees (${G.bees}/200) · 2 winters (${G._wintersS}/2) · 40% healed (${rp}%/40%)`;}
    if(s===4){const rp=~~restorationPct();return`300 bees (${G.bees}/300) · 3 winters (${G._wintersS}/3) · 60% healed (${rp}%/60%)`;}
    return'Legacy achieved — Phase 2 available';
}
function genColonyName(){
    const counts={};
    Object.entries(G.fa).forEach(([k,n])=>{const t=G.tiles[k];if(t&&TD[t.type]&&TD[t.type].forage>0)counts[t.type]=(counts[t.type]||0)+n;});
    const typeNames={WILDFLOWER:'Meadow',FOREST:'Forest Edge',CLOVER:'Clover',SUNFLOWER:'Sunflower',DEAD_ZONE:'Barren'};
    const primary=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
    const dirs=['North','South','East','West'];
    const dir=dirs[~~(Math.random()*dirs.length)];
    const type=primary?(typeNames[primary[0]]||'Wild'):'Wild';
    if(Math.random()<0.5)return`The ${dir} ${type} Colony`;
    return`The ${G.season} Colony, Year ${G.year}`;
}
function onStageAdvance(stage){
    const msgs={
        2:'The colony has known cold and kept its warmth. The queen resumes her laying — a second season begins.',
        3:'Where the bees have worked, the land has changed. The dead zone is alive again — thin, sparse, but alive.',
        4:'Two winters. A hive that has bent and held. The colony knows what cold costs and what spring is worth.',
        5:'Three winters. Hundreds of thousands of foraging runs. A landscape that looks different than it did when they arrived.',
    };
    if(msgs[stage])setTimeout(()=>toast(msgs[stage],'mile'),800);
    hap([40,20,40,20,40]);
    if(stage===2&&!G._colonyName){
        G._colonyName=genColonyName();
        setTimeout(()=>toast(`Colony named: ${G._colonyName}`,'green'),2200);
    }
    if(stage===5)setTimeout(()=>toast('Someone has been watching. The researcher has noticed your territory.','mile'),3800);
}

// ── MILESTONES ────────────────────────────────────────────────────────────────
const MS=[
    {id:'b30',  chk:()=>G.bees>=30,                            msg:'Colony growing — 30 bees'},
    {id:'b60',  chk:()=>G.bees>=60,                            msg:'A thriving hive — 60 bees'},
    {id:'b100', chk:()=>G.bees>=100,                           msg:'One hundred strong'},
    {id:'b200', chk:()=>G.bees>=200,                           msg:'The hive is roaring with life'},
    {id:'h30',  chk:()=>G._totH>=30,                           msg:'Thirty pounds of honey stored'},
    {id:'h75',  chk:()=>G._totH>=75,                           msg:'The stores grow heavy'},
    {id:'h150', chk:()=>G._totH>=150,                          msg:'A season\'s worth of honey'},
    {id:'s3',   chk:()=>G.scouts.filter(s=>s.revealed).length>=3, msg:'Three territories mapped'},
    {id:'w1',   chk:()=>G._wintersS>=1,                        msg:'First winter — survived'},
    {id:'w2',   chk:()=>G._wintersS>=2,                        msg:'A second winter endured'},
    {id:'w5',   chk:()=>G._wintersS>=5,                        msg:'Five winters. The colony endures.'},
    {id:'sp',   chk:()=>!!G._ach.sp,                           msg:'Swarm instinct redirected'},
    {id:'rcv',  chk:()=>G._wasLow&&G.bees>50&&G._peakB>50,    msg:'They pulled back from the edge'},
];
function checkMS(){
    MS.forEach(m=>{
        if(!G._ach[m.id]&&m.chk()){
            G._ach[m.id]=true;
            toast(m.msg,'mile');
            hap([40,20,40]);
        }
    });
}

// ── AUDIO ─────────────────────────────────────────────────────────────────────
const Snd=(()=>{
    let ctx,o1,o2,gn,ready=false;
    function _start(){
        if(ready)return;
        ctx=new(window.AudioContext||window.webkitAudioContext)();
        gn=ctx.createGain();gn.gain.value=0.012;gn.connect(ctx.destination);
        o1=ctx.createOscillator();o1.frequency.value=238;o1.connect(gn);o1.start();
        o2=ctx.createOscillator();o2.frequency.value=242;o2.connect(gn);o2.start();
        ready=true;
    }
    function _tone(freq,dur=60,type='sine',vol=0.04){
        if(!ready)return;
        const g=ctx.createGain();g.gain.setValueAtTime(vol,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur/1000);g.connect(ctx.destination);
        const o=ctx.createOscillator();o.type=type;o.frequency.value=freq;o.connect(g);o.start();o.stop(ctx.currentTime+dur/1000+0.05);
    }
    function setVol(){if(!ready)return;const f=foragerTotal()/Math.max(1,G.bees);gn.gain.value=0.008+f*0.037;}
    return{
        _start,setVol,
        tap:()=>_tone(420,30),
        honey:()=>{_tone(660,40);setTimeout(()=>_tone(880,40),60);},
        danger:()=>_tone(280,120,'sawtooth',0.06),
        mile:()=>{_tone(528,80);setTimeout(()=>_tone(660,80),100);setTimeout(()=>_tone(792,120),200);},
        revive:()=>{_tone(440,100);setTimeout(()=>_tone(550,100),120);setTimeout(()=>_tone(660,150),240);},
    };
})();
function hap(pat){if(navigator.vibrate)navigator.vibrate(pat);}

// ── OVERLAYS ──────────────────────────────────────────────────────────────────
function ovShow(id){document.querySelectorAll('.ov').forEach(o=>o.style.display='none');const el=document.getElementById(id);if(el)el.style.display='flex';}
function ovHide(id){const el=document.getElementById(id);if(el)el.style.display='none';}
function beginGame(){
    const nm=document.getElementById('col-name-in').value.trim();
    if(nm)G._colonyName=nm;
    ovHide('ov-i');
    G.tiles=makeMap();G.fog=makeFog(G.tiles);
    if(window._S){window._S.drawMap();window._S.bees.sync();}
    hud();
}
function newGame(){
    if(!confirm('Start a new colony? All progress will be lost.'))return;
    G=G0();
    G.tiles=makeMap();G.fog=makeFog(G.tiles);
    save();
    if(window._S)window._S.rebuild();
    closePanel();hud();
}

document.getElementById('begin-btn').addEventListener('click',beginGame);
