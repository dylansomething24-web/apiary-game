// ── THE BEEKEEPER ─────────────────────────────────────────────────────────────
// Arrives the spring after the 3rd hive. Supers on the hives catch the honey the brood boxes
// can't hold; the Honey House turns it into money. The player puts supers on, pulls them, buys,
// builds, hires and sells to the co-op. Everything else runs on its own each day.
const SUP_CELLS=80,SUP_W=10,SUP_H=8,MAX_SUP=3;
const SUP_CREW=0.06;          // share of a hive's bees that build in the supers
const SUP_UP=0.9;             // brood box stores full enough that the bees move up
const WAX_DRAW=0.05,WAX_CAP=0.02;   // lb wax per trimmed drawn cell, per cell of one level
const JAR_LB={pint:1.35,quart:2.6},JAR_PRICE={pint:15,quart:25};
const SUPPLY={pint:1.25,quart:1.75,wick:0.15};
const WAXG={block:{lb:1,price:10,name:'Wax block'},votive:{lb:0.1,price:4,name:'Votive candle'},pillar:{lb:0.5,price:14,name:'Pillar candle'}};
const COOP={Spring:3.2,Summer:2.6,Fall:3.0,Winter:3.6};
const ROAD={Spring:3,Summer:4,Fall:6,Winter:2};
const WAX_RES=6;              // lb raw wax kept back for foundation
const MACH={
    unc: {name:'Uncapper',    lv:['Knife table','Heated knife','Uncapping machine'],rate:[2,5,12],cost:[150,600,3000],unit:'boxes',op:true},
    ext: {name:'Extractor',   lv:['Hand crank','Motor 6-frame','Radial 20-frame'],rate:[1,4,12],cost:[300,1500,6000],unit:'boxes',op:true,cold:true},
    tank:{name:'Tank',        lv:['Buckets','Settling tank','Bulk tank'],cap:[360,1500,5000],cost:[100,1200,4000]},
    bot: {name:'Bottler',     lv:['Hand table','Gate bottler','Auto bottler'],rate:[60,200,600],cost:[100,800,5000],unit:'jars',op:true,cold:true},
    melt:{name:'Wax melter',  lv:['Double boiler','Solar melter','Steam melter'],rate:[5,20,60],cost:[150,600,2500],unit:'lb',op:true},
    cand:{name:'Candle bench',lv:['Hand molds','Pouring bench','Candle line'],rate:[10,40,120],cost:[200,900,3000],unit:'candles',op:true},
};
const DOCK={in:{name:'In dock',cost:50},out:{name:'Out dock',cost:50}};
const BELT_COST=20;
const FLOOR_SIZES=[null,{boards:0,money:0},{boards:40,money:1000},{boards:120,money:4000},{boards:300,money:12000}];
const SHELF_ADD={slots:12,boards:30,money:400};
const MILL=[null,
    {name:'Sawpit',  cost:1200,boards:0,  hands:1,rate:3, keepB:30,keepS:4},
    {name:'Box shop',cost:2500,boards:60, hands:2,rate:6, keepB:40,keepS:8},
    {name:'Mill',    cost:6000,boards:150,hands:4,rate:12,keepB:60,keepS:12}];
const SUPER_BOARDS=4,SUPER_WAX=1;
const WAGE={op:15,mill:18,seller:60};
const LINE=['unc','ext','bot','melt','cand'];
const CAND_MIX=['votive','votive','pillar'];
const CAND_WAX=(0.1+0.1+0.5)/3;

function newKeeper(hh){
    const c={};
    ['in','unc','ext','tank','bot','out'].forEach((k,i)=>{const[q,r]=ringCells(1)[i];c[hkey(q,r)]={k,lv:1,tray:[],h:0,w:0,prog:0};});
    return{name:'',money:0,debt:0,hh,since:G.year,
        st:{u:6,d:0,l1:0,l2:0,full:[],wax:0,boards:0,pint:24,quart:12,wick:0},shelf:12,
        goods:{pint:0,quart:0,block:0,votive:0,pillar:0},
        fl:{R:1,c},bk:{at:null,txt:'Waiting for the first supers'},
        ws:[],_wid:0,mills:{},stall:false,
        set:{cut:false,keep:6,mix:2},
        wd:0,coopWk:0,acc:{road:0,store:0,gift:0},
        jarsSold:0,candlesMade:0,
        wk:{in:{},out:{}},hist:[],yr:{y:G.year,in:0,out:0},life:0,
        guide:0,_bot:0,_cand:0,_road:0,_mkt:false};
}
const K=()=>G.kp;

// ── MONEY ─────────────────────────────────────────────────────────────────────
function earn(cat,v){const k=K();if(v<=0)return;k.money+=v;k.wk.in[cat]=(k.wk.in[cat]||0)+v;k.yr.in+=v;k.life+=v;}
function spend(cat,v){const k=K();k.money-=v;k.wk.out[cat]=(k.wk.out[cat]||0)+v;k.yr.out+=v;}
function pay(cat,v,what){
    if(K().money<v-1e-6){toast(`Not enough money for ${what} ($${money(v)} needed)`,'warn');return false;}
    spend(cat,v);return true;
}
function money(v){return Math.round(v).toLocaleString('en-US');}
function cents(v){return v.toFixed(2);}

// ── SUPERS ON THE HIVES (G.* is the active hive) ──────────────────────────────
function boxOf(t){return t==='u'?{d:0,L:0,dp:0,honey:0}:{d:SUP_CELLS,L:t==='d'?0:+t[1],dp:0,honey:0};}
function boxState(b){return b.d<SUP_CELLS?'u':b.L===0?'d':'l'+Math.min(2,b.L);}
function supCap(s){
    if(s.d<SUP_CELLS)return s.d*DEEP_CAPS[0];
    return SUP_CELLS*DEEP_CAPS[s.L]+(s.L<3?s.dp*(DEEP_CAPS[s.L+1]-DEEP_CAPS[s.L]):0);
}
function supFull(s){return s.d>=SUP_CELLS&&supFill(s)>=0.9;}
function supFill(s){const c=supCap(s);return c?s.honey/c:0;}
function supLevelName(s){return s.d<SUP_CELLS?(s.d?'Drawing':'Undrawn'):s.L===0?'Drawn':'L'+s.L;}
function supRoom(){return (G.sup||[]).reduce((a,s)=>a+Math.max(0,supCap(s)-s.honey),0);}
function supHoney(h){return ((h||H()).sup||[]).reduce((a,s)=>a+s.honey,0);}
// the bees only move up once the brood box is nearly full of stores
function hiveUp(){
    const cap=capacity();if(!cap)return false;
    const f=(G.honey+G.nectar)/cap;
    if(f>=SUP_UP)G._up=true;else if(f<0.7)G._up=false;
    return!!G._up;
}
// honey above 90% of the brood box goes up into the supers, lowest box first
function superFlow(){
    if(!G.sup||!G.sup.length||G.season==='Winter')return;
    // keep the brood box at 90% (honey plus nectar), so there is always room for new nectar
    const cap=capacity();let extra=Math.min(G.honey,G.honey+G.nectar-cap*SUP_UP);
    if(extra<=0)return;
    for(const s of G.sup){
        if(extra<=0)break;
        const room=Math.max(0,supCap(s)-s.honey);const m=Math.min(room,extra);
        s.honey+=m;G.honey-=m;extra-=m;
    }
}
// the super crew draws comb, then deepens it, paying in honey above the winter reserve
function superBuild(){
    if(!G.sup||!G.sup.length||!hiveUp())return;
    const winter=G.season==='Winter',f=winter?0.25:1;
    const crew=Math.floor(G.bees*SUP_CREW);if(!crew)return;
    const daysLeft=winter?Math.max(0,YEAR-G.day+1):0;
    const reserve=winter?G.bees*WINTER_COST*daysLeft:winterNeed()*1.15;
    const s=G.sup.find(b=>b.d<SUP_CELLS||b.L<3);if(!s){G._sbf=0;return;}
    if(s.d<SUP_CELLS){
        G._sbf=(G._sbf||0)+crew*BUILD_RATE*f;
        while(G._sbf>=1&&s.d<SUP_CELLS&&G.honey-CELL_COST>reserve){s.d++;G.honey-=CELL_COST;G._sbf-=1;}
    }else{
        G._sbf=(G._sbf||0)+crew*DEEP_RATE*f;
        while(G._sbf>=1&&s.L<3&&G.honey-DEEP_COST[s.L]>reserve){
            s.dp++;G.honey-=DEEP_COST[s.L];G._sbf-=1;
            if(s.dp>=SUP_CELLS){s.L++;s.dp=0;}
        }
    }
    if(G._sbf>2)G._sbf=2;
}
// winter, last resort: a starving hive eats from its supers
function eatSupers(){
    if(G.honey>=0||!G.sup)return;
    for(let i=G.sup.length-1;i>=0&&G.honey<0;i--){const s=G.sup[i],m=Math.min(s.honey,-G.honey);s.honey-=m;G.honey+=m;}
}
function shelfUsed(){
    const k=K(),st=k.st;let n=st.u+st.d+st.l1+st.l2+st.full.length;
    Object.values(k.fl.c).forEach(c=>{if(c.tray)n+=c.tray.length;});
    return n;
}
function shelfFree(){return K().shelf-shelfUsed();}
function boxesStored(){const st=K().st;return st.u+st.d+st.l1+st.l2;}
// drawn boxes owned (drawn, L1, L2 or better, anywhere)
function drawnOwned(){
    const k=K(),st=k.st;let n=st.d+st.l1+st.l2+st.full.filter(b=>b.d>=SUP_CELLS).length;
    G.hives.forEach(h=>(h.sup||[]).forEach(s=>{if(s.d>=SUP_CELLS)n++;}));
    Object.values(k.fl.c).forEach(c=>(c.tray||[]).forEach(b=>{if(b.d>=SUP_CELLS)n++;}));
    return n;
}
function putSuper(t){
    const k=K(),key=t==='u'?'u':t==='d'?'d':t;
    if(G.season==='Winter'){toast('The hives stay closed in winter. Supers go on in spring.','warn');return;}
    if(G.sup.length>=MAX_SUP){toast(`A hive takes ${MAX_SUP} supers at most`,'warn');return;}
    if(!(k.st[key]>0)){toast('None of those in the Storehouse','warn');return;}
    k.st[key]--;G.sup.push(boxOf(t));
    if(k.guide<1)k.guide=1;
    toast(`${{u:'An undrawn',d:'A drawn',l1:'An L1',l2:'An L2'}[t]} super goes on ${H().name}`,'green');
}
function pullSuper(i){
    if(G.season==='Winter'){toast('Supers are locked on the hives until spring','warn');return false;}
    const s=G.sup[i];if(!s)return false;
    if(shelfFree()<1){toast('The Storehouse shelf is full. Expand it, or let the Honey House catch up.','warn');return false;}
    G.sup.splice(i,1);
    // an empty box skips the line: it is trimmed and knocked down right away
    if(s.honey<0.5){uncapBox(s);delete s.unc;K().st[boxState(s)]++;return true;}
    K().st.full.push(s);
    if(K().guide<3)K().guide=3;
    return true;
}

// ── HARVEST RULES ─────────────────────────────────────────────────────────────
// uncapping knocks a box down one level (L3 → L2 ...). Plain drawn comb is kept.
// Partly drawn boxes and partly deepened levels are trimmed back, and the wax kept.
function uncapBox(b){
    if(b.unc)return 0;
    let wax=0;
    if(b.d<SUP_CELLS){wax+=b.d*WAX_DRAW;b.d=0;b.L=0;b.dp=0;}
    else{
        if(b.dp>0){wax+=b.dp*WAX_CAP;b.dp=0;}
        if(b.L>=1){wax+=SUP_CELLS*WAX_CAP;b.L--;}
    }
    b.unc=true;K().st.wax+=wax;return wax;
}
// after extraction the empty box goes back to the shelf (cut out for wax if allowed)
function returnBox(b){
    const k=K();
    if(k.set.cut&&b.d>=SUP_CELLS&&drawnOwned()>Math.max(6,k.set.keep)){
        k.st.wax+=SUP_CELLS*WAX_DRAW+b.L*SUP_CELLS*WAX_CAP;b.d=0;b.L=0;
    }
    const s=boxState(b);k.st[s]++;
}

// ── THE FLOOR ─────────────────────────────────────────────────────────────────
function floorCells(R){const out=[];for(let i=0;i<=R;i++)ringCells(i).forEach(c=>out.push(c));return out;}
function onFloor(q,r){return hdist(q,r)<=K().fl.R;}
// two stations are linked if they touch, or both touch the same run of belts
let _lk={sig:'',m:{}};
function floorLinks(){
    const c=K().fl.c,sig=Object.keys(c).map(k=>k+c[k].k).join('|');
    if(sig===_lk.sig)return _lk.m;
    const m={},isBelt=k=>c[k]&&c[k].k==='belt';
    const comp={};let id=0;
    Object.keys(c).filter(isBelt).forEach(k=>{
        if(comp[k]!=null)return;const stack=[k];comp[k]=id;
        while(stack.length){const x=stack.pop(),{q,r}=kq(x);nbrs(q,r).forEach(([a,b])=>{const n=hkey(a,b);if(isBelt(n)&&comp[n]==null){comp[n]=id;stack.push(n);}});}
        id++;
    });
    const touch={};
    Object.keys(c).filter(k=>!isBelt(k)).forEach(k=>{
        const{q,r}=kq(k);m[k]=new Set();
        nbrs(q,r).forEach(([a,b])=>{const n=hkey(a,b);if(!c[n])return;
            if(isBelt(n)){(touch[comp[n]]=touch[comp[n]]||new Set()).add(k);}else m[k].add(n);});
    });
    Object.values(touch).forEach(set=>set.forEach(a=>set.forEach(b=>{if(a!==b)m[a].add(b);})));
    _lk={sig,m};return m;
}
function linked(key,type){const c=K().fl.c;return[...(floorLinks()[key]||[])].filter(n=>c[n].k===type);}
function cold(c){return MACH[c.k]&&MACH[c.k].cold&&G.season==='Winter'?0.5:1;}
function rate(c){return MACH[c.k].rate[c.lv-1]*cold(c);}
function tankCap(c){return MACH.tank.cap[c.lv-1];}
function trayCap(c){
    if(c.k==='unc'||c.k==='ext')return Math.max(2,MACH[c.k].rate[c.lv-1]*2);
    if(c.k==='cand')return MACH.cand.rate[c.lv-1]*2*CAND_WAX;
    return 0;
}
function tankHoney(key){return linked(key,'tank').reduce((a,n)=>a+K().fl.c[n].h,0);}
function takeHoney(key,lb){for(const n of linked(key,'tank')){const t=K().fl.c[n],m=Math.min(t.h,lb);t.h-=m;lb-=m;if(lb<=1e-9)break;}}
function allTankHoney(){return Object.values(K().fl.c).filter(c=>c.k==='tank').reduce((a,c)=>a+c.h,0);}
function meltable(){return Math.max(0,K().st.wax-WAX_RES);}
// the next unit this station would make, and whether it has somewhere to go
function nextJar(){const k=K(),st=k.st,mix=k.set.mix;
    const wantQ=(k._bot%(mix+1))===mix;
    if(wantQ&&st.quart>0)return'quart';if(st.pint>0)return'pint';if(st.quart>0)return'quart';return null;}
function canUnit(key){
    const k=K(),c=k.fl.c[key];
    switch(c.k){
        case'unc':return c.tray.length>0&&linked(key,'ext').some(n=>k.fl.c[n].tray.length<trayCap(k.fl.c[n]));
        case'ext':{if(!c.tray.length)return false;const b=c.tray[0];
            return linked(key,'tank').reduce((a,n)=>a+tankCap(k.fl.c[n])-k.fl.c[n].h,0)>=b.honey-1e-6;}
        case'bot':{const j=nextJar();return!!j&&tankHoney(key)>=JAR_LB[j]&&linked(key,'out').length>0;}
        case'melt':return meltable()>=0.01&&(linked(key,'cand').some(n=>k.fl.c[n].w<trayCap(k.fl.c[n]))||linked(key,'out').length>0);
        case'cand':{const t=CAND_MIX[k._cand%3];return c.w>=WAXG[t].lb&&k.st.wick>0&&linked(key,'out').length>0;}
    }
    return false;
}
// how many units are waiting at a station (its pile)
function pile(key){
    const k=K(),c=k.fl.c[key];
    switch(c.k){
        case'unc':case'ext':return c.tray.length;
        case'bot':{const jars=k.st.pint+k.st.quart;return Math.min(jars,Math.floor(tankHoney(key)/1.8));}
        case'melt':return meltable();
        case'cand':return Math.min(k.st.wick,Math.floor(c.w/CAND_WAX));
    }
    return 0;
}
function finishUnit(key){
    const k=K(),c=k.fl.c[key];
    switch(c.k){
        case'unc':{const b=c.tray.shift();uncapBox(b);
            const ex=linked(key,'ext').map(n=>k.fl.c[n]).filter(e=>e.tray.length<trayCap(e)).sort((a,b)=>a.tray.length-b.tray.length)[0];
            ex.tray.push(b);break;}
        case'ext':{const b=c.tray.shift();let lb=b.honey;
            for(const n of linked(key,'tank')){const t=k.fl.c[n],m=Math.min(tankCap(t)-t.h,lb);t.h+=m;lb-=m;if(lb<=1e-9)break;}
            b.honey=0;delete b.unc;returnBox(b);break;}
        case'bot':{const j=nextJar();takeHoney(key,JAR_LB[j]);k.st[j]--;k.goods[j]++;k._bot++;break;}
        case'cand':{const t=CAND_MIX[k._cand%3];c.w-=WAXG[t].lb;k.st.wick--;k.goods[t]++;k._cand++;k.candlesMade++;break;}
    }
}
// do up to `units` of work at a station; returns the work actually done
function work(key,units){
    const k=K(),c=k.fl.c[key];let done=0;
    if(c.k==='melt'){
        let lb=Math.min(units,meltable());
        // melted wax goes to a candle bench that has room, the rest out as blocks
        for(const n of linked(key,'cand')){const cb=k.fl.c[n],m=Math.min(lb,trayCap(cb)-cb.w);if(m>0){cb.w+=m;k.st.wax-=m;lb-=m;done+=m;}}
        if(lb>0&&linked(key,'out').length){k.st.wax-=lb;k.goods.block+=lb;done+=lb;}
        return done;
    }
    while(units>1e-9){
        if(!canUnit(key)){if(c.k!=='unc'&&c.k!=='ext')c.prog=0;break;}
        const use=Math.min(1-c.prog,units);
        c.prog+=use;units-=use;done+=use;
        if(c.prog>=1-1e-9){c.prog=0;finishUnit(key);}
    }
    return done;
}
function stations(){return Object.keys(K().fl.c).filter(n=>MACH[K().fl.c[n].k]&&MACH[K().fl.c[n].k].op);}
function workerAt(key){return K().ws.find(w=>w.at===key);}
function lineIdx(key){return LINE.indexOf(K().fl.c[key].k);}

// ── ONE DAY IN THE HONEY HOUSE ────────────────────────────────────────────────
function keeperDay(){
    const k=K();if(!k)return;
    const worked=new Set();
    millsDay(worked);
    feedIn();
    // the market comes first: the beekeeper goes if nobody is hired to sell
    k._mkt=false;
    if(k.wd===4&&k.stall&&G.season!=='Winter'&&k.goods.pint+k.goods.quart>0){
        const seller=k.ws.find(w=>w.at==='market');
        if(seller)worked.add(seller.id);else k._mkt=true;
        marketDay();
    }
    // hired workers run their stations all day
    stations().sort((a,b)=>lineIdx(b)-lineIdx(a)).forEach(key=>{
        const w=workerAt(key);if(!w)return;
        const c=k.fl.c[key];
        if(work(key,rate(c))>1e-6)worked.add(w.id);
    });
    feedIn();
    // the beekeeper works the most backed-up station, in 25% chunks
    if(k._mkt)k.bk={at:null,txt:'At the farmers market today'};
    else beekeeperDay();
    feedIn();
    sellDay();
    // wages for the day
    k.ws.forEach(w=>{
        if(!worked.has(w.id))return;
        w.owed+=w.at==='market'?WAGE.seller:w.at&&w.at.startsWith('mill:')?WAGE.mill:WAGE.op*(k.fl.c[w.at]?k.fl.c[w.at].lv:1);
        w.days++;
    });
    k.ws.forEach(w=>w.today=worked.has(w.id));
    // the week turns over
    if(++k.wd>=7)weekEnd();
    if(G.year!==k.yr.y){k.yr={y:G.year,in:0,out:0};}
    keeperGuide();
}
function feedIn(){
    const k=K();
    Object.keys(k.fl.c).filter(n=>k.fl.c[n].k==='in').forEach(n=>{
        linked(n,'unc').map(u=>k.fl.c[u]).sort((a,b)=>a.tray.length-b.tray.length).forEach(u=>{
            while(k.st.full.length&&u.tray.length<trayCap(u))u.tray.push(k.st.full.shift());
        });
    });
}
function beekeeperDay(){
    const k=K();let time=1,guard=0,last=null;const skip=new Set();
    while(time>1e-4&&guard++<60){
        const ready=stations().filter(n=>!skip.has(n)&&canUnit(n));
        let pool=ready.filter(n=>!workerAt(n));
        if(!pool.length)pool=ready;           // help at a manned station only when nothing else needs him
        if(!pool.length)break;
        const days=n=>pile(n)/rate(k.fl.c[n]);
        pool.sort((a,b)=>days(b)-days(a)||lineIdx(a)-lineIdx(b));
        const key=pool[0],c=k.fl.c[key],r=rate(c);
        const chunk=Math.max(c.k==='melt'?1:1,pile(key)*0.25);
        const done=work(key,Math.min(chunk,time*r));
        if(done<1e-6){skip.add(key);continue;}
        time-=done/r;last=key;
    }
    if(last){const c=k.fl.c[last];k.bk={at:last,txt:`Working the ${MACH[c.k].name.toLowerCase()}`};}
    else{
        // say what is holding the line up, if anything is
        const stuck=stations().find(n=>{const w=stationWhy(n);return w&&!/^Waiting for/.test(w);});
        k.bk={at:k.bk.at,txt:stuck?`Stuck. ${MACH[k.fl.c[stuck].k].name}: ${stationWhy(stuck).replace(/^Waiting: /,'')}`:'Nothing to do right now'};
    }
}
function sellJar(price,cat){
    const k=K(),g=k.goods;
    const wantQ=(k._road%3)===2;k._road++;
    const j=wantQ&&g.quart>0?'quart':g.pint>0?'pint':g.quart>0?'quart':null;
    if(!j)return false;
    g[j]--;earn(cat,JAR_PRICE[j]*price);k.jarsSold++;return true;
}
function sellDay(){
    const k=K(),g=k.goods;
    k.acc.road+=ROAD[G.season];
    while(k.acc.road>=1){k.acc.road--;if(!sellJar(1,'road')){k.acc.road=0;break;}}
    if(k.jarsSold>=200){
        k.acc.store+=20/7;
        while(k.acc.store>=1){k.acc.store--;if(!sellJar(0.85,'store')){k.acc.store=0;break;}}
    }
    if(k.candlesMade>=50){
        k.acc.gift+=15/7;
        while(k.acc.gift>=1){
            k.acc.gift--;
            const t=g.pillar>0?'pillar':g.votive>0?'votive':g.block>=1?'block':null;
            if(!t){k.acc.gift=0;break;}
            g[t]-=1;earn('gift',WAXG[t].price);
        }
    }
}
function marketDay(){
    let n=0;while(n<30&&sellJar(1.1,'market'))n++;
    if(n)toast(`Farmers market: ${n} jars sold`,'green');
}
function weekEnd(){
    const k=K();k.wd=0;k.coopWk=0;
    if(k.stall&&G.season!=='Winter'){
        if(k.money>=20)spend('stall',20);
        else{k.stall=false;toast('Not enough money for the market stall. It has been given up.','warn');}
    }
    payday();
    const sumv=o=>Object.values(o).reduce((a,b)=>a+b,0);
    k.hist.unshift({y:G.year,s:G.season,d:dayInSeason(G.day),in:sumv(k.wk.in),out:sumv(k.wk.out),wi:k.wk.in,wo:k.wk.out});
    if(k.hist.length>16)k.hist.pop();
    k.wk={in:{},out:{}};
}
function payday(){
    const k=K();const left=[];
    k.ws.slice().sort((a,b)=>a.id-b.id).forEach(w=>{
        if(w.owed<=0)return;
        const p=Math.min(Math.max(0,k.money),w.owed);
        if(p>0)spend('wages',p);
        if(p<w.owed-1e-6){k.debt+=w.owed-p;left.push(w);}
        w.owed=0;
    });
    if(left.length){
        k.ws=k.ws.filter(w=>!left.includes(w));
        toast(`Payday came up short. ${left.length} worker${left.length>1?'s':''} walked off. You owe $${money(k.debt)}, and can't hire until it's paid.`,'warn');
        hap([200,100,200]);
    }
}

// ── MILLS ─────────────────────────────────────────────────────────────────────
function millsDay(worked){
    const k=K();
    Object.entries(k.mills).forEach(([tk,m])=>{
        const L=MILL[m.lv],hands=k.ws.filter(w=>w.at==='mill:'+tk);
        m.why='';
        if(!hands.length){m.why='No mill hands';return;}
        const r=L.rate*Math.min(1,hands.length/L.hands);
        const room=L.keepB-m.boards-m.pool;
        const b=Math.max(0,Math.min(r,room));
        let did=b>1e-6;
        m.pool+=b*m.split;m.boards+=b*(1-m.split);
        while(m.pool>=SUPER_BOARDS&&m.sup<L.keepS){
            if(k.st.wax<SUPER_WAX){m.why='Supers waiting on wax for foundation';break;}
            m.pool-=SUPER_BOARDS;k.st.wax-=SUPER_WAX;m.sup++;did=true;
        }
        if(m.sendB&&m.boards>=1){const n=Math.floor(m.boards);m.boards-=n;k.st.boards+=n;}
        while(m.sup>0&&shelfFree()>m.keepFree){m.sup--;k.st.u++;}
        if(!did)m.why=m.why||'Backed up. The mill store is full, so the hands are laid off.';
        if(did)hands.forEach(w=>worked.add(w.id));
    });
}
function canMill(tk){const t=G.tiles[tk];return!!(K()&&t&&t.type==='FOREST'&&t.stage>=3&&!K().mills[tk]);}
function buildMill(tk){
    if(!canMill(tk)){toast('Mills can only go on a Thriving forest edge','warn');return false;}
    if(!pay('build',MILL[1].cost,'a sawpit'))return false;
    K().mills[tk]={lv:1,boards:0,pool:0,sup:0,split:0.5,sendB:true,keepFree:3,why:''};
    G.hives.forEach(h=>{delete h.fa[tk];});
    toast('A sawpit goes up at the forest edge. The bees no longer forage there.','mile');
    return true;
}
function upgradeMill(tk){
    const m=K().mills[tk];if(!m||m.lv>=3)return;const L=MILL[m.lv+1];
    if(K().st.boards<L.boards){toast(`Needs ${L.boards} boards in the Storehouse`,'warn');return;}
    if(!pay('build',L.cost,L.name))return;
    K().st.boards-=L.boards;m.lv++;toast(`The mill is now a ${L.name}`,'green');
}

// ── TOWN ──────────────────────────────────────────────────────────────────────
function coopPrice(extra){return COOP[G.season]*Math.pow(0.9,Math.floor(((K().coopWk||0)+(extra||0))/500));}
function coopValue(lb){let v=0,sold=0;while(sold<lb-1e-6){const c=Math.min(50,lb-sold);v+=c*coopPrice(sold);sold+=c;}return v;}
function sellCoop(lb){
    const k=K();lb=Math.min(lb,allTankHoney());if(lb<1)return;
    const v=coopValue(lb);
    let left=lb;Object.values(k.fl.c).filter(c=>c.k==='tank').forEach(t=>{const m=Math.min(t.h,left);t.h-=m;left-=m;});
    k.coopWk+=lb;earn('coop',v);
    toast(`Sold ${money(lb)} lb to the co-op for $${money(v)}`,'green');
}
function buySupply(t,n){
    const v=SUPPLY[t]*n;
    if(!pay(t==='wick'?'wicks':'jars',v,`${n} ${t}s`))return;
    K().st[t]+=n;
}
function hire(){
    const k=K();
    if(k.debt>0){toast(`You owe $${money(k.debt)}. Pay it before hiring anyone.`,'warn');return;}
    k.ws.push({id:++k._wid,name:WORKER_NAMES[(k._wid-1)%WORKER_NAMES.length],at:null,owed:0,days:0,today:false});
    toast('Someone new is ready to work. Put them on a station, a mill or the market stall.','green');
}
const WORKER_NAMES=['Ada','Bo','Cal','Dee','Eli','Fern','Gus','Hal','Ivy','Jo','Kit','Lou','Mae','Ned','Ola','Pip','Rue','Sal','Tam','Vic'];
function payDebt(v){
    const k=K();v=Math.min(v,k.debt,k.money);if(v<=0)return;
    spend('debt',v);k.debt-=v;if(k.debt<0.01)k.debt=0;
    toast(k.debt?`Paid $${money(v)}. $${money(k.debt)} still owed.`:'Debt paid off. You can hire again.','green');
}

// ── BUILDING THE FLOOR ────────────────────────────────────────────────────────
function buildAt(key,type){
    const k=K(),{q,r}=kq(key);
    if(!onFloor(q,r)||k.fl.c[key]){toast('That spot is taken','warn');return false;}
    if(type==='belt'){
        if(k.st.boards<1){toast('A belt needs 1 board from the Storehouse','warn');return false;}
        if(!pay('build',BELT_COST,'a belt'))return false;
        k.st.boards--;
    }else if(DOCK[type]){if(!pay('build',DOCK[type].cost,'a dock'))return false;}
    else if(!pay('build',MACH[type].cost[0],MACH[type].name))return false;
    k.fl.c[key]={k:type,lv:1,tray:[],h:0,w:0,prog:0};
    return true;
}
function upgradeAt(key){
    const c=K().fl.c[key],M=MACH[c.k];if(!M||c.lv>=3)return;
    if(!pay('build',M.cost[c.lv],M.lv[c.lv]))return;
    c.lv++;toast(`Upgraded to the ${M.lv[c.lv-1]}`,'green');
}
function removeAt(key){
    const k=K(),c=k.fl.c[key];if(!c)return;
    if(c.k==='tank'&&c.h>0){toast('Empty the tank first (bottle it or sell to the co-op)','warn');return;}
    // boxes in its tray go back to wait in the Storehouse
    (c.tray||[]).forEach(b=>k.st.full.unshift(b));
    if(c.k==='cand'&&c.w>0)k.st.wax+=c.w;
    k.ws.forEach(w=>{if(w.at===key)w.at=null;});
    delete k.fl.c[key];
    if(k.bk.at===key)k.bk.at=null;
}
function moveTo(from,to){
    const k=K(),{q,r}=kq(to);
    if(!onFloor(q,r)||k.fl.c[to])return false;
    k.fl.c[to]=k.fl.c[from];delete k.fl.c[from];
    k.ws.forEach(w=>{if(w.at===from)w.at=to;});
    if(k.bk.at===from)k.bk.at=to;
    return true;
}
function expandFloor(){
    const k=K(),n=k.fl.R+1,c=FLOOR_SIZES[n];if(!c)return;
    if(k.st.boards<c.boards){toast(`Needs ${c.boards} boards in the Storehouse`,'warn');return;}
    if(!pay('build',c.money,'the floor'))return;
    k.st.boards-=c.boards;k.fl.R=n;toast(`The Honey House floor grows to ${floorCells(n).length} spaces`,'green');
}
function expandShelf(){
    const k=K();
    if(k.st.boards<SHELF_ADD.boards){toast(`Needs ${SHELF_ADD.boards} boards in the Storehouse`,'warn');return;}
    if(!pay('build',SHELF_ADD.money,'more shelf'))return;
    k.st.boards-=SHELF_ADD.boards;k.shelf+=SHELF_ADD.slots;toast(`The shelf now holds ${k.shelf} boxes`,'green');
}

// ── ARRIVAL ───────────────────────────────────────────────────────────────────
function honeyHouseSite(){
    const h=G.hives[0]||{q:0,r:0};
    const st=Object.keys(G.tiles).filter(k=>G.tiles[k].type==='STRUCTURE').sort((a,b)=>{const A=G.tiles[a],B=G.tiles[b];return hdist(A.q,A.r,h.q,h.r)-hdist(B.q,B.r,h.q,h.r);})[0];
    if(st)return{k:st,camp:false};
    const nb=nbrs(h.q,h.r).map(([q,r])=>hkey(q,r)).filter(k=>G.tiles[k]&&G.tiles[k].type!=='HIVE_BOX'&&G.tiles[k].type!=='DEAD_ZONE');
    return{k:nb.find(k=>G.tiles[k].type==='WATER')||nb[0]||hkey(h.q+1,h.r),camp:true};
}
function keeperArrive(){
    if(G.kp||!G._kDue)return;
    const site=honeyHouseSite();
    G.kp=newKeeper(site.k);G.kp.camp=site.camp;
    G.hives.forEach(h=>{if(!h.sup)h.sup=[];});
    $('kp-where').textContent=site.camp
        ?'There are no old buildings nearby, so the beekeeper makes camp beside the home hive.'
        :'They set up in the old building nearby. It will be the Honey House.';
    $('kp-name-in').value='';
    ovShow('ov-k');
    if(window._S){setView('map');window._S.truck(site.k);}
}
function keeperBegin(){
    const nm=$('kp-name-in').value.trim();K().name=nm||'The beekeeper';
    ovHide('ov-k');renderAll();
    toast(`${K().name} has 6 empty supers. Open Supers and put them on your hives.`,'mile');
}
// short guided steps, each shown only once it matters
const GUIDE=['Put your first supers on. Open Supers, then tap an empty slot.',
    'Supers are on. The bees move up once the brood box is 90% full of stores.',
    'A super is nearly full. Pull it, and it goes to the Storehouse to wait for the Honey House.',
    'Pulled supers wait in the Storehouse. The beekeeper uncaps, extracts and bottles them on their own.',
    'Jars sell at the roadside stand by themselves. Extra honey can go to the co-op in Town.'];
function keeperGuide(){
    const k=K();
    if(k.guide===1&&G.hives.some(h=>(h.sup||[]).some(s=>supFull(s))))k.guide=2;
    if(k.guide===3&&k.goods.pint+k.goods.quart>0)k.guide=4;
    if(k.guide===4&&k.jarsSold>0)k.guide=5;
}
