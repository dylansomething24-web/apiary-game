// ── BOUGHT JOB AUTOMATIONS ────────────────────────────────────────────────────
// Each morning every hive re-plans the jobs that have been automated (see upgrades.js), in this
// order: nurses for the brood, processors for the nectar, guards for the season, builders only from
// honey above the winter reserve, and everyone else out to the best open fields. Jobs not bought
// yet keep the player's numbers; manually sent foragers give way when an automated job needs bees.
// Pollinators and scouts stay the player's call.
function winterReserve(){return Math.ceil(winterNeed()*1.15);}
// honey this hive still needs to get through the winter it is in
function winterLeft(){return G.bees*WINTER_COST*Math.max(0,YEAR-G.day+1);}
function freeForagers(n){
    while(idle()<n&&foragerTotal()>0){
        let wk=null,wy=1e9;for(const k of Object.keys(G.fa)){const y=tileYield(k);if(y<wy){wy=y;wk=k;}}
        if(--G.fa[wk]<=0)delete G.fa[wk];
    }
}
// send n bees to the best open fields; returns how many found no room
function placeForagers(n){
    G.fa={};
    const ks=Object.keys(G.tiles).filter(k=>inRange(G.tiles[k])&&TD[G.tiles[k].type].forage&&!isMill(k)).sort((a,b)=>tileYield(b)-tileYield(a));
    for(const k of ks){if(n<=0)break;const room=tileSlots(k)-tileForagers(k);if(room<=0)continue;const m=Math.min(room,n);G.fa[k]=m;n-=m;}
    return n;
}
function planJobs(){
    const winter=G.season==='Winter',A={};JOBS.forEach(j=>A[j]=jobAuto(j));
    const prev={nurses:G.nurses,processors:G.processors,guards:G.guards,builders:G.builders,foragers:foragerTotal()};
    let free=G.bees-pollTotal()-scoutTotal();
    ['nurses','processors','guards','builders'].forEach(j=>{if(!A[j])free-=G[j];});   // still run by hand
    free=Math.max(0,free);
    const take=v=>{const n=clamp(Math.round(v),0,free);free-=n;return n;};
    // 1. nurses: today's larvae plus eggs about to hatch
    if(A.nurses){
        let soon=0;for(const c of Object.values(G.comb))if(c.t==='b'&&!(c.d>0)&&c.a>=1&&c.a<=2)soon++;
        G.nurses=take(Math.max(1,Math.ceil((broodStats().larvae+soon)/NURSE_CAP)));
    }
    // 3. guards by season (worked out now, placed after processors)
    const gWant=!A.guards||winter?0:Math.max(guardsNeeded(),Math.ceil(G.bees*{Spring:.03,Summer:.06,Fall:.06}[G.season]));
    // 4. builders, only from honey above the winter reserve; comb first, then deepen (if that's bought too)
    let bWant=0;
    if(A.builders){
        const canBuild=!!nextFrontier(),lvl=G.combLvl||0;
        if(owns('a_deep'))G.deepen=!canBuild&&lvl<DEEP_CAPS.length-1;
        const dp=deepening();
        const perDay=dp?DEEP_RATE*DEEP_COST[lvl]:canBuild?BUILD_RATE*CELL_COST:0;
        if(perDay>0){
            const surplus=winter?G.honey-winterLeft():G.honey-winterReserve();
            if(surplus>0)bWant=Math.min(Math.ceil(G.bees*0.05)*(winter?0.25:1),Math.floor(surplus/(perDay*7)));
            // a hive with no room left can't ever reach its reserve, so it builds room first
            const cap=capacity(),full=cap?(G.honey+G.nectar)/cap:1;
            const tooSmall=!dp&&canBuild&&(full>=0.85||cap*SUP_UP<winterReserve()*1.2);
            if(!winter&&tooSmall&&G.honey>perDay*Math.ceil(G.bees*0.05)*3)bWant=Math.max(bWant,Math.ceil(G.bees*0.05));
            if(winter&&dp)bWant=0;   // deepening rests in winter
        }
    }
    // 2. processors: enough for today's nectar plus half of what is waiting
    if(A.processors){
        const rest=Math.max(0,free-gWant-bWant);let P=0;
        if(winter)P=Math.min(rest,Math.ceil(G.nectar*0.5/PROC_RATE));
        else for(let it=0;it<4;it++){
            G.processors=P;if(A.foragers)placeForagers(rest-P);
            const e=econ(),room=Math.max(0,e.cap-G.honey-G.nectar)+(G.kp?supRoom():0);
            const np=Math.min(rest,Math.ceil((Math.min(e.nectarIn,room)+G.nectar*0.5)/PROC_RATE));
            if(np===P)break;P=np;
        }
        G.processors=take(P);
    }
    if(A.guards)G.guards=take(gWant);
    if(A.builders)G.builders=take(bWant);
    if(A.foragers){
        if(winter){G.fa={};G._rest=0;}
        else G._rest=placeForagers(free);
    }else{
        G._rest=0;
        // foragers sent by hand give up their place to the automated jobs, the poorest fields first
        while(occupied()>G.bees&&foragerTotal()>0){
            let wk=null,wy=1e9;for(const k of Object.keys(G.fa)){const y=tileYield(k);if(y<wy){wy=y;wk=k;}}
            if(--G.fa[wk]<=0)delete G.fa[wk];
        }
    }
    instinctLog(prev);
}
const JOB_WORD={nurses:'nursing',processors:'processing',guards:'guarding',builders:'building',foragers:'foraging'};
function instinctLog(prev){
    const now={nurses:G.nurses,processors:G.processors,guards:G.guards,builders:G.builders,foragers:foragerTotal()};
    const ups=Object.keys(now).filter(k=>now[k]-prev[k]>=3).sort((a,b)=>(now[b]-prev[b])-(now[a]-prev[a]));
    if(!ups.length)return;
    const k=ups[0],n=now[k]-prev[k];
    const why={nurses:'more brood to feed',processors:G.nectar>5?'nectar backing up':'more nectar coming in',
        guards:'raiders are about this season',builders:G.deepen?'spare honey, deepening the comb':'spare honey, building comb',
        foragers:'fields open'}[k];
    const log=G._log||(G._log=[]);
    log.unshift(`${G.season} ${dayInSeason(G.day)}: moved ${n} bees to ${JOB_WORD[k]} (${why})`);
    if(log.length>6)log.length=6;
    if(G.builders===0&&prev.builders>0&&G.season==='Fall'&&G.honey<winterReserve()){log.unshift(`${G.season} ${dayInSeason(G.day)}: stopped building, saving honey for winter`);log.length=Math.min(log.length,6);}
}
