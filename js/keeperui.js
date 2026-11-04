// ── SUPERS VIEW (replaces the Hive view once the beekeeper is here) ───────────
let _supPick=-1;          // which empty slot is choosing a box
function superSVG(s){
    const z=9.5,w=SUP_W*S3*z+S3*z/2+2,h=(SUP_H-1)*1.5*z+2*z+2;
    const cap=supCap(s),fill=cap?s.honey/cap:0,hc=Math.round(fill*s.d),capped=fill>=0.9;
    let out=`<svg class="supsvg" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" width="100%">`;
    for(let i=0;i<SUP_CELLS;i++){
        const row=Math.floor(i/SUP_W),col=i%SUP_W,yr=SUP_H-1-row;
        const cx=1+S3*z*(col+0.5+(yr%2?0.5:0)),cy=1+z+yr*1.5*z;
        const p=cors(cx,cy,z-0.8).map(v=>v.toFixed(1)).join(' ');
        let f='none',st='#3a3a26',sw=0.7;
        if(i<s.d){f=i<hc?(capped?'#b07818':'#e8a020'):'#4a4228';st=i<hc?'#ffc848':'#9a8a56';sw=1;}
        else if(i===s.d&&s.d<SUP_CELLS){st='#c89a50';sw=1.2;}
        out+=`<polygon points="${p}" fill="${f}" stroke="${st}" stroke-width="${sw}"/>`;
        if(s.d>=SUP_CELLS&&i<s.dp)out+=`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="1.6" fill="#fff3c0" opacity=".8"/>`;
    }
    return out+'</svg>';
}
function supWork(s){
    if(s.d<SUP_CELLS)return s.d?`Drawing comb: ${s.d} / ${SUP_CELLS} cells`:'Undrawn. The bees will draw it first.';
    if(s.L<3)return`Deepening to L${s.L+1}: ${s.dp} / ${SUP_CELLS} cells`;
    return'Fully deepened (L3)';
}
function renderSupers(){
    const k=K();if(!k)return;
    const cap=capacity(),bf=cap?(G.honey+G.nectar)/cap*100:0,bs=broodStats(),winter=G.season==='Winter';
    let h='';
    if(k.guide<GUIDE.length)h+=`<section class="card guide"><b>Next step</b><span>${GUIDE[k.guide]}</span></section>`;
    h+=`<section class="card"><h3>${H().name} <span class="sub">brood box</span></h3>
      <div class="kv"><span>Bees</span><b>${G.bees}</b></div>
      <div class="kv"><span>Brood box stores</span><b class="${bf>=90?'good':''}">${~~bf}%</b></div>${bar(bf,bf>=90?'greenbar':'')}
      <div class="kv"><span>Brood</span><b>${bs.total} cells</b></div>
      <p class="hint">${G.sup.length?(G._up?`The bees are up in the supers. ${Math.floor(G.bees*SUP_CREW)} of them build there${winter?' slowly, for winter':''}.`:`The bees move up when the brood box is ${SUP_UP*100}% full.`):'No supers on this hive yet.'} They never take the honey they need for winter.</p>
      ${btn('Look inside the brood box','view','data-v="hive"','wide ghost')}
    </section>`;
    // the stack, top box first
    h+=`<section class="card"><h3>Supers <span class="sub">${G.sup.length} / ${MAX_SUP} · ${f1(supHoney())} lb</span></h3>`;
    if(winter)h+=`<p class="note warn">Winter: the supers are locked on the hive until spring.</p>`;
    for(let i=MAX_SUP-1;i>=0;i--){
        const s=G.sup[i];
        if(s){
            const c=supCap(s),pc=c?s.honey/c*100:0;
            h+=`<div class="supbox"><div class="row-top"><span class="rname">Super ${i+1} <span class="lvtag">${supLevelName(s)}</span></span><span class="rnum">${~~pc}%</span></div>
              ${superSVG(s)}
              <div class="rdesc">${f1(s.honey)} / ${f1(c)} lb honey · ${supWork(s)}</div>
              ${winter?'':btn('Pull this super','suppull',`data-i="${i}"`,'wide'+(supFull(s)?'':' ghost'))}</div>`;
        }else if(i===G.sup.length){
            const st=k.st,opts=[['u','Undrawn',st.u],['d','Drawn',st.d],['l1','L1',st.l1],['l2','L2',st.l2]];
            h+=`<div class="supbox empty"><div class="rname">Empty slot</div>`+
              (winter?'<p class="hint">Supers go on in spring.</p>':
               _supPick===i?`<p class="rdesc">Pick a box from the Storehouse:</p><div class="seg four">${opts.map(([t,l,n])=>btn(`${l}<small>${n}</small>`,'supput',`data-t="${t}" ${n?'':'disabled'}`)).join('')}</div>${btn('Cancel','suppick','data-i="-1"','wide ghost')}`
               :boxesStored()?btn('Put on a super','suppick',`data-i="${i}"`,'wide'):'<p class="hint">No spare supers in the Storehouse.</p>')+`</div>`;
        }
    }
    const full=G.sup.filter(s=>supFull(s)).length;
    if(full&&!winter)h+=btn(`Pull all full supers (${full})`,'suppullall','','wide');
    h+=`</section>`;
    const st=k.st;
    h+=`<section class="card"><h3>Storehouse <span class="sub">shelf ${shelfUsed()} / ${k.shelf}</span></h3>
      <div class="kv"><span>Undrawn · Drawn · L1 · L2</span><b>${st.u} · ${st.d} · ${st.l1} · ${st.l2}</b></div>
      <div class="kv"><span>Full supers waiting</span><b>${st.full.length}</b></div>
      <p class="hint">Drawn boxes start filling the day they go on. Undrawn ones take the bees about 11 days to draw.</p>
    </section>`;
    $('sbody').innerHTML=h;
}

// ── HONEY HOUSE ───────────────────────────────────────────────────────────────
const HTABS=[['floor','Floor'],['store','Storehouse'],['goods','Goods'],['town','Town'],['ledger','Ledger']];
let _fsel=null,_fmove=null,_coopLb=0,_debtV=0,_lastHtab='';
const ABBR={in:'In',out:'Out',unc:'Uncap',ext:'Extract',tank:'Tank',bot:'Bottle',melt:'Melt',cand:'Candle',belt:''};
const FCOL={in:'#2c4a6a',out:'#2c5a3a',unc:'#5a4a22',ext:'#6a5418',tank:'#7a5a10',bot:'#5a3a1a',melt:'#4a3a2a',cand:'#5a2a3a',belt:'#2a2a24'};
function floorSVG(){
    const k=K(),R=k.fl.R,z=Math.min(34,330/((2*R+1)*S3)),W=(2*R+1)*S3*z+4,Hh=(2*R)*1.5*z+2*z+4;
    let out=`<svg class="floorsvg" viewBox="${(-W/2).toFixed(0)} ${(-Hh/2).toFixed(0)} ${W.toFixed(0)} ${Hh.toFixed(0)}" width="100%">`;
    floorCells(R).forEach(([q,r])=>{
        const key=hkey(q,r),c=k.fl.c[key],x=z*S3*(q+r/2),y=z*1.5*r,sel=_fsel===key;
        const p=cors(x,y,z-1).map(v=>v.toFixed(1)).join(' ');
        out+=`<g data-a="flsel" data-k="${key}"><polygon points="${p}" fill="${c?FCOL[c.k]:'#121a13'}" stroke="${sel?'#ffd060':c?'#8a7a4a':'#26342a'}" stroke-width="${sel?3:1}"/>`;
        if(c){
            if(c.k==='belt'){out+=`<circle cx="${x}" cy="${y}" r="${z*.28}" fill="none" stroke="#8a8a6a" stroke-width="2" stroke-dasharray="3 2"/>`;}
            else{
                out+=`<text x="${x}" y="${y-z*.08}" class="fl-t" style="font-size:${(z*.36).toFixed(1)}px">${ABBR[c.k]}</text>`;
                if(MACH[c.k])out+=`<text x="${x}" y="${y+z*.34}" class="fl-l" style="font-size:${(z*.28).toFixed(1)}px">${c.k==='tank'?`${money(c.h)} lb`:`L${c.lv}${MACH[c.k].op?' · '+fmtPile(key):''}`}</text>`;
            }
            const w=workerAt(key),bk=k.bk.at===key&&!k._mkt;
            if(w||bk)out+=`<text x="${x+z*.5}" y="${y-z*.45}" style="font-size:${(z*.42).toFixed(1)}px">${bk?'🧑‍🌾':''}${w?'👷':''}</text>`;
        }else if(_fmove)out+=`<circle cx="${x}" cy="${y}" r="3" fill="#60e080"/>`;
        out+=`</g>`;
    });
    return out+'</svg>';
}
function fmtPile(key){const p=pile(key);return p>=10?Math.round(p):f1(p).replace('.0','');}
function stationWhy(key){
    const k=K(),c=k.fl.c[key];
    if(canUnit(key))return null;
    switch(c.k){
        case'unc':return c.tray.length?'Waiting: the extractor tray is full':linked(key,'ext').length?'Waiting for full supers':'Not linked to an extractor';
        case'ext':return c.tray.length?(linked(key,'tank').length?'Waiting: the tank is full':'Not linked to a tank'):'Waiting for uncapped boxes';
        case'bot':return!linked(key,'tank').length?'Not linked to a tank':!linked(key,'out').length?'Not linked to an Out dock':!nextJar()?'Out of empty jars. Buy more in Town.':'Waiting for honey in the tank';
        case'melt':return meltable()<0.01?`Waiting for wax (${WAX_RES} lb is kept for foundation)`:'Not linked to a candle bench or Out dock';
        case'cand':return!linked(key,'out').length?'Not linked to an Out dock':!k.st.wick?'Out of wicks. Buy more in Town.':'Waiting for melted wax';
    }
    return null;
}
function renderFloorSel(){
    const k=K(),key=_fsel;if(!key)return'<p class="hint">Tap a space on the floor to build, or a machine to see it.</p>';
    const c=k.fl.c[key];
    if(_fmove)return`<section class="card"><h3>Moving the ${MACH[k.fl.c[_fmove].k]?MACH[k.fl.c[_fmove].k].name.toLowerCase():'piece'}</h3><p class="hint">Tap an empty space.</p>${btn('Cancel','flmove','data-c="1"','wide ghost')}</section>`;
    if(!c){
        let h=`<section class="card"><h3>Empty space</h3><p class="hint">Money: $${money(k.money)} · Boards: ${k.st.boards}</p>`;
        Object.entries(MACH).forEach(([t,M])=>{
            h+=`<div class="frow"><div class="fi"><div class="rname">${M.name}</div><div class="rdesc">${M.lv[0]} · ${t==='tank'?`holds ${M.cap[0]} lb`:`${M.rate[0]} ${M.unit}/day`}</div></div>
              <div class="fs">${btn('$'+money(M.cost[0]),'flbuild',`data-t="${t}" ${k.money>=M.cost[0]?'':'disabled'}`,'buybtn')}</div></div>`;
        });
        h+=`<div class="frow"><div class="fi"><div class="rname">Belt</div><div class="rdesc">Links machines that don't touch. Belts can merge.</div></div><div class="fs">${btn(`$${BELT_COST}+1 board`,'flbuild',`data-t="belt" ${k.money>=BELT_COST&&k.st.boards>=1?'':'disabled'}`,'buybtn')}</div></div>`;
        ['in','out'].forEach(t=>h+=`<div class="frow"><div class="fi"><div class="rname">${DOCK[t].name}</div><div class="rdesc">${t==='in'?'Feeds full supers to a linked uncapper':'Sends finished goods to the Goods room'}</div></div><div class="fs">${btn('$'+DOCK[t].cost,'flbuild',`data-t="${t}" ${k.money>=DOCK[t].cost?'':'disabled'}`,'buybtn')}</div></div>`);
        return h+'</section>';
    }
    const M=MACH[c.k];
    let h=`<section class="card"><h3>${M?M.name:c.k==='belt'?'Belt':DOCK[c.k].name}${M?` <span class="sub">${M.lv[c.lv-1]} · L${c.lv}</span>`:''}</h3>`;
    if(c.k==='tank')h+=`<div class="kv"><span>Honey</span><b>${money(c.h)} / ${money(tankCap(c))} lb</b></div>${bar(c.h/tankCap(c)*100)}`;
    else if(M){
        const why=stationWhy(key),w=workerAt(key);
        h+=`<div class="kv"><span>Speed</span><b>${f1(rate(c)).replace('.0','')} ${M.unit}/day${cold(c)<1?' (cold honey, half speed)':''}</b></div>
          <div class="kv"><span>Waiting here</span><b>${fmtPile(key)} ${M.unit}</b></div>
          <p class="note ${why?'warn':'good'}">${why||'Ready to work'}</p>
          <div class="kv"><span>Worker</span><b>${w?`${w.name}${w.today?'':' (laid off today)'}`:'None'}</b></div>`;
        if(w)h+=btn(`Take ${w.name} off`,'floff','','wide ghost');
        else{
            const free=k.ws.filter(x=>!x.at);
            h+=free.length?`<div class="pair">${free.map(x=>btn(`Put ${x.name} here`,'flwork',`data-w="${x.id}"`,'wide')).join('')}</div>`:`<p class="hint">${k.ws.length?'Everyone hired is busy.':'No workers yet.'} Hire in Town. A worker here is paid $${WAGE.op*c.lv} for each day there is work.</p>`;
        }
    }else if(c.k==='in')h+=`<p class="desc">Full supers from the Storehouse come in here. ${k.st.full.length} waiting.</p>`;
    else if(c.k==='out')h+='<p class="desc">Finished jars, wax and candles go out to the Goods room.</p>';
    else h+='<p class="desc">Carries things between the machines it touches.</p>';
    if(M&&c.lv<3)h+=btn(`Upgrade to ${M.lv[c.lv]} ($${money(M.cost[c.lv])})`,'flup','',`wide${k.money>=M.cost[c.lv]?'':' off'}`);
    h+=`<div class="pair">${btn('Move','flmove','','wide ghost')}${btn('Remove','flrm','','wide danger')}</div></section>`;
    return h;
}
function renderHouse(){
    const k=K();if(!k)return;
    if(!HTABS.some(t=>t[0]===G.htab))G.htab='floor';
    const tab=G.htab;let h='';
    const st=k.st,g=k.goods;
    h+=`<div class="hh-top"><span>$${money(k.money)}</span>${k.debt?`<span class="bad">owe $${money(k.debt)}</span>`:''}<span class="sub">${k.name||'Beekeeper'}: ${k.bk.txt}</span></div>`;
    if(tab==='floor'){
        h+=`<section class="card flcard">${floorSVG()}<p class="hint">Machines that touch pass things along. Belts link ones that don't. Anything with nowhere to send its work stops.</p></section>`;
        h+=renderFloorSel();
        const nx=FLOOR_SIZES[k.fl.R+1];
        h+=`<section class="card"><h3>Floor <span class="sub">${floorCells(k.fl.R).length} spaces</span></h3>
          ${nx?btn(`Grow to ${floorCells(k.fl.R+1).length} spaces (${nx.boards} boards + $${money(nx.money)})`,'flexpand','',`wide${k.money>=nx.money&&st.boards>=nx.boards?'':' off'}`):'<p class="hint">The floor is as big as it gets.</p>'}
          <p class="hint">${k.name||'The beekeeper'} works one station at a time, always the most backed-up one, a quarter of its pile at a go. Hired workers keep a station running all day.</p></section>`;
    }
    if(tab==='store'){
        h+=`<section class="card"><h3>Boxes <span class="sub">shelf ${shelfUsed()} / ${k.shelf}</span></h3>
          <div class="kv"><span>Undrawn</span><b>${st.u}</b></div><div class="kv"><span>Drawn</span><b>${st.d}</b></div>
          <div class="kv"><span>L1</span><b>${st.l1}</b></div><div class="kv"><span>L2</span><b>${st.l2}</b></div>
          <div class="kv"><span>Full supers waiting</span><b>${st.full.length}</b></div>
          ${btn(`More shelf: +${SHELF_ADD.slots} boxes (${SHELF_ADD.boards} boards + $${SHELF_ADD.money})`,'shelfx','',`wide${k.money>=SHELF_ADD.money&&st.boards>=SHELF_ADD.boards?'':' off'}`)}
          <p class="hint">Supers can't be bought. New ones come from your lumber mills.</p></section>`;
        h+=`<section class="card"><h3>Supplies</h3>
          <div class="kv"><span>Honey in tanks</span><b>${money(allTankHoney())} lb</b></div>
          <div class="kv"><span>Raw wax</span><b>${f1(st.wax)} lb</b></div>
          <div class="kv"><span>Boards</span><b>${st.boards}</b></div>
          <div class="kv"><span>Empty pints · quarts</span><b>${st.pint} · ${st.quart}</b></div>
          <div class="kv"><span>Wicks</span><b>${st.wick}</b></div>
          <p class="hint">The first ${WAX_RES} lb of raw wax is kept for foundation in new supers. Only wax above that goes to the melter.</p></section>`;
        h+=`<section class="card"><h3>Cutting out comb <span class="sub">${k.set.cut?'on':'off'}</span></h3>
          <p class="desc">When it's on, the extractor cuts all the comb out of extra drawn boxes for wax. The box comes back undrawn.</p>
          <div class="seg">${btn('Off','cut','data-v="0"',k.set.cut?'':'on')}${btn('On','cut','data-v="1"',k.set.cut?'on':'')}</div>
          <div class="kv"><span>Always keep this many drawn boxes</span><b>${k.set.keep}</b></div>${steps('keep','',false)}
          <div class="kv"><span>Drawn boxes you own now</span><b>${drawnOwned()}</b></div>
          <p class="hint">It never goes below 6.</p></section>`;
        h+=`<section class="card"><h3>Bottling mix</h3>
          <div class="kv"><span>Pints for every quart</span><b>${k.set.mix}</b></div>${steps('mix','',false)}</section>`;
        const ms=Object.entries(k.mills);
        h+=`<section class="card"><h3>Lumber mills <span class="sub">${ms.length}</span></h3>`;
        if(!ms.length)h+=`<p class="hint">Mills go on Thriving forest edges. Tap one on the Map to build a sawpit ($${money(MILL[1].cost)}). The bees stop foraging that tile.</p>`;
        ms.forEach(([tk,m])=>{
            const L=MILL[m.lv],hands=k.ws.filter(w=>w.at==='mill:'+tk),free=k.ws.filter(w=>!w.at);
            h+=`<div class="row"><div class="row-top"><span class="rname">${L.name} <span class="lvtag">L${m.lv}</span></span><span class="rnum">${hands.length}/${L.hands}</span></div>
              <div class="rdesc">${L.rate} boards/day with ${L.hands} hand${L.hands>1?'s':''} · on site: ${Math.floor(m.boards+m.pool)} / ${L.keepB} boards, ${m.sup} / ${L.keepS} supers</div>
              ${m.why?`<p class="note warn">${m.why}</p>`:''}
              <div class="kv"><span>Boards into supers</span><b>${Math.round(m.split*100)}%</b></div>
              <div class="seg five">${[0,.25,.5,.75,1].map(v=>btn(Math.round(v*100)+'%','millsplit',`data-k="${tk}" data-v="${v}"`,m.split===v?'on':'')).join('')}</div>
              <div class="kv"><span>Send supers while the shelf has more than</span><b>${m.keepFree} free</b></div>${steps('millfree',`data-k="${tk}"`,false)}
              <div class="seg">${btn('Send boards','millsend',`data-k="${tk}" data-v="1"`,m.sendB?'on':'')}${btn('Keep boards','millsend',`data-k="${tk}" data-v="0"`,m.sendB?'':'on')}</div>
              ${hands.length?`<div class="pair">${hands.map(w=>btn(`Take ${w.name} off`,'millhand',`data-k="${tk}" data-w="${w.id}" data-d="-1"`,'wide ghost')).join('')}</div>`:''}
              ${hands.length<L.hands?(free.length?`<div class="pair">${free.map(w=>btn(`Put ${w.name} here`,'millhand',`data-k="${tk}" data-w="${w.id}" data-d="1"`,'wide')).join('')}</div>`:'<p class="hint">Hire mill hands in Town ($18 a day worked).</p>'):''}
              ${m.lv<3?btn(`Upgrade to ${MILL[m.lv+1].name} ($${money(MILL[m.lv+1].cost)} + ${MILL[m.lv+1].boards} boards)`,'millup',`data-k="${tk}"`,`wide${k.money>=MILL[m.lv+1].cost&&st.boards>=MILL[m.lv+1].boards?'':' off'}`):''}
            </div>`;
        });
        h+=`<p class="hint">Each super takes ${SUPER_BOARDS} boards and ${SUPER_WAX} lb of wax. A mill that fills up stops, and its hands aren't paid.</p></section>`;
    }
    if(tab==='goods'){
        const val=g.pint*15+g.quart*25+Math.floor(g.block)*10+g.votive*4+g.pillar*14;
        h+=`<section class="card"><h3>Goods <span class="sub">about $${money(val)}</span></h3>
          <div class="kv"><span>Pints ($15)</span><b>${g.pint}</b></div><div class="kv"><span>Quarts ($25)</span><b>${g.quart}</b></div>
          <div class="kv"><span>Wax blocks ($10)</span><b>${Math.floor(g.block)}</b></div>
          <div class="kv"><span>Votive candles ($4)</span><b>${g.votive}</b></div><div class="kv"><span>Pillar candles ($14)</span><b>${g.pillar}</b></div></section>`;
        h+=`<section class="card"><h3>Where it sells</h3>
          <div class="kv"><span>Roadside stand</span><b>${ROAD[G.season]} jars/day</b></div>
          <div class="kv"><span>Farmers market</span><b>${k.stall?'30 jars/week, +10%':'no stall'}</b></div>
          <div class="kv"><span>General store</span><b>${k.jarsSold>=200?'20 jars/week at 85%':`opens at 200 jars sold (${k.jarsSold})`}</b></div>
          <div class="kv"><span>Gift shop</span><b>${k.candlesMade>=50?'15 items/week':`opens at 50 candles made (${k.candlesMade})`}</b></div>
          <p class="hint">Everything here sells on its own. Bulk honey goes to the co-op in Town.</p></section>`;
    }
    if(tab==='town'){
        const tank=allTankHoney();_coopLb=Math.min(_coopLb,Math.floor(tank));
        h+=`<section class="card"><h3>Town co-op <span class="sub">$${cents(coopPrice())}/lb now</span></h3>
          <div class="kv"><span>Honey in your tanks</span><b>${money(tank)} lb</b></div>
          <input type="range" class="slide" data-slide="coop" min="0" max="${Math.floor(tank)}" step="${tank>200?10:1}" value="${_coopLb}">
          <div class="kv"><span>Sell</span><b id="coop-prev">${money(_coopLb)} lb for $${money(coopValue(_coopLb))}</b></div>
          ${btn('Sell to the co-op','coopsell',tank>=1?'':'disabled','wide')}
          <p class="hint">The co-op always buys. Price by season: spring $3.20, summer $2.60, fall $3.00, winter $3.60. It drops 10% for every 500 lb sold in one week, and recovers the next week. ${money(k.coopWk)} lb sold this week.</p></section>`;
        h+=`<section class="card"><h3>Buy supplies <span class="sub">$${money(k.money)}</span></h3>
          ${[['pint','Pint jars + lids'],['quart','Quart jars + lids'],['wick','Wicks']].map(([t,l])=>{const ns=t==='wick'?[50,200]:[12,60];
            return`<div class="frow"><div class="fi"><div class="rname">${l}</div><div class="rdesc">$${cents(SUPPLY[t])} each · you have ${st[t]}</div></div>
            <div class="fs">${ns.map(n=>btn(`+${n}`,'buy',`data-t="${t}" data-n="${n}" ${k.money>=SUPPLY[t]*n?'':'disabled'}`,'buybtn')).join('')}</div></div>`;}).join('')}</section>`;
        const seller=k.ws.find(w=>w.at==='market'),free=k.ws.filter(w=>!w.at);
        h+=`<section class="card"><h3>Farmers market <span class="sub">${k.stall?'stall rented':'no stall'}</span></h3>
          <p class="desc">Once a week, spring to fall: up to 30 jars at 10% more. The stall is $20 a week. If nobody is hired to sell, ${k.name||'the beekeeper'} goes, and the floor runs without them that day.</p>
          <div class="seg">${btn('No stall','stall','data-v="0"',k.stall?'':'on')}${btn('Rent the stall','stall','data-v="1"',k.stall?'on':'')}</div>
          <div class="kv"><span>Seller</span><b>${seller?seller.name:'None'}</b></div>
          ${seller?btn(`Take ${seller.name} off`,'seller',`data-w="${seller.id}" data-d="-1"`,'wide ghost'):free.length?`<div class="pair">${free.map(w=>btn(`Put ${w.name} on the stall`,'seller',`data-w="${w.id}" data-d="1"`,'wide')).join('')}</div>`:'<p class="hint">Hire a seller below ($60 per market day).</p>'}
        </section>`;
        h+=`<section class="card"><h3>Workers <span class="sub">${k.ws.length} hired</span></h3>
          ${k.ws.map(w=>`<div class="frow"><div class="fi"><div class="rname">${w.name}</div><div class="rdesc">${wherePretty(w)} · ${w.at?(w.today?'worked today':'laid off today'):'waiting for a spot'} · $${money(w.owed)} earned this week</div></div>
            <div class="fs">${btn('Let go','fire',`data-w="${w.id}"`,'buybtn')}</div></div>`).join('')}
          ${btn(k.debt>0?'Pay your debt before hiring':'Hire a worker','hire',k.debt>0?'disabled':'','wide')}
          <p class="hint">Pay is per day worked: $15 × the machine's level for a station, $18 for a mill hand, $60 per market day. No work or backed up means no pay that day. Wages go out every 7 days. Anyone not fully paid walks off, and what they're owed becomes debt.</p></section>`;
        if(k.debt>0){
            _debtV=Math.min(_debtV||Math.min(k.debt,k.money),k.debt,Math.max(0,k.money));
            h+=`<section class="card"><h3>Debt <span class="sub bad">$${money(k.debt)}</span></h3>
              <input type="range" class="slide" data-slide="debt" min="0" max="${Math.floor(Math.min(k.debt,Math.max(0,k.money)))}" step="1" value="${Math.floor(_debtV)}">
              <div class="kv"><span>Pay</span><b id="debt-prev">$${money(_debtV)}</b></div>
              ${btn('Pay debt','debtpay',k.money>=1?'':'disabled','wide')}
              <p class="hint">Debt doesn't grow. It waits until you pay it, and nobody can be hired until it's gone.</p></section>`;
        }
    }
    if(tab==='ledger'){
        const sumv=o=>Object.values(o).reduce((a,b)=>a+b,0),wi=k.wk.in,wo=k.wk.out;
        const IN={road:'Roadside',market:'Farmers market',store:'General store',gift:'Gift shop',coop:'Co-op'},OUT={jars:'Jars',wicks:'Wicks',stall:'Market stall',wages:'Wages',build:'Building',debt:'Debt paid'};
        h+=`<section class="card"><h3>This week <span class="sub">day ${k.wd+1} of 7</span></h3><div class="ledger">
          ${Object.keys(IN).filter(c=>wi[c]).map(c=>`<div><span>${IN[c]}</span><b class="good">+$${money(wi[c])}</b></div>`).join('')}
          ${Object.keys(OUT).filter(c=>wo[c]).map(c=>`<div><span>${OUT[c]}</span><b class="bad">−$${money(wo[c])}</b></div>`).join('')}
          <div class="tot"><span>Net</span><b class="${sumv(wi)-sumv(wo)>=0?'good':'bad'}">${sgnM(sumv(wi)-sumv(wo))}</b></div></div>
          <div class="kv"><span>Wages owed so far</span><b>$${money(k.ws.reduce((a,w)=>a+w.owed,0))}</b></div></section>`;
        h+=`<section class="card"><h3>Year ${k.yr.y}</h3>
          <div class="kv"><span>Money in</span><b class="good">$${money(k.yr.in)}</b></div><div class="kv"><span>Money out</span><b class="bad">$${money(k.yr.out)}</b></div>
          <div class="kv"><span>All-time money in</span><b>$${money(k.life)}</b></div>
          <div class="kv"><span>Jars sold · candles made</span><b>${k.jarsSold} · ${k.candlesMade}</b></div></section>`;
        h+=`<section class="card"><h3>Past weeks</h3>${k.hist.length?k.hist.map(w=>`<div class="kv"><span>Y${w.y} ${w.s}, day ${w.d}</span><b><span class="good">+$${money(w.in)}</span> <span class="bad">−$${money(w.out)}</span></b></div>`).join(''):'<p class="hint">Nothing yet.</p>'}</section>`;
    }
    $('htabs').innerHTML=HTABS.map(([v,l])=>btn(l,'htab',`data-v="${v}"`,tab===v?'on':'')).join('');
    $('hbody').innerHTML=h;
    if(_lastHtab!==tab){$('hbody').scrollTop=0;_lastHtab=tab;}
}
function sgnM(v){return(v>=0?'+$':'−$')+money(Math.abs(v));}
function wherePretty(w){
    if(!w.at)return'Unassigned';if(w.at==='market')return'Market stall';
    if(w.at.startsWith('mill:'))return MILL[K().mills[w.at.slice(5)].lv].name;
    const c=K().fl.c[w.at];return c?MACH[c.k].name:'Unassigned';
}
// sliders update their preview text without a full redraw
document.addEventListener('input',ev=>{
    const s=ev.target.dataset&&ev.target.dataset.slide;if(!s)return;
    _holdUntil=performance.now()+1500;
    if(s==='coop'){_coopLb=+ev.target.value;$('coop-prev').textContent=`${money(_coopLb)} lb for $${money(coopValue(_coopLb))}`;}
    if(s==='debt'){_debtV=+ev.target.value;$('debt-prev').textContent=`$${money(_debtV)}`;}
});

// ── ACTIONS ───────────────────────────────────────────────────────────────────
Object.assign(ACT,{
    kpbegin(){keeperBegin();},
    suppick(d){_supPick=+d.i;},
    supput(d){putSuper(d.t);_supPick=-1;},
    suppull(d){if(pullSuper(+d.i))toast('Super pulled. It waits in the Storehouse for the Honey House.','green');},
    suppullall(){let n=0;for(let i=G.sup.length-1;i>=0;i--)if(supFull(G.sup[i])&&pullSuper(i))n++;if(n)toast(`${n} full super${n>1?'s':''} pulled`,'green');},
    htab(d){G.htab=d.v;_fsel=null;_fmove=null;},
    flsel(d){
        if(_fmove){if(!K().fl.c[d.k]&&moveTo(_fmove,d.k)){_fsel=d.k;_fmove=null;}else toast('Pick an empty space','warn');return;}
        _fsel=_fsel===d.k?null:d.k;
    },
    flbuild(d){if(buildAt(_fsel,d.t))toast(`${d.t==='belt'?'Belt':DOCK[d.t]?DOCK[d.t].name:MACH[d.t].name} built`,'green');},
    flup(){upgradeAt(_fsel);},
    flmove(d){_fmove=d.c?null:_fsel;},
    flrm(d,b){
        if(!b.dataset.armed){b.dataset.armed='1';b.textContent='Tap again to remove (no refund)';setTimeout(()=>{if(b.isConnected){delete b.dataset.armed;b.textContent='Remove';}},3000);return'norender';}
        removeAt(_fsel);_fsel=null;
    },
    flwork(d){const w=K().ws.find(x=>x.id===+d.w);if(w){w.at=_fsel;toast(`${w.name} runs this station now`,'green');}},
    floff(){const w=workerAt(_fsel);if(w)w.at=null;},
    flexpand(){expandFloor();},
    shelfx(){expandShelf();},
    cut(d){K().set.cut=d.v==='1';},
    keep(d){K().set.keep=clamp(K().set.keep+ +d.d,6,99);},
    mix(d){K().set.mix=clamp(K().set.mix+ +d.d,0,6);},
    millsplit(d){K().mills[d.k].split=+d.v;},
    millsend(d){K().mills[d.k].sendB=d.v==='1';},
    millfree(d){const m=K().mills[d.k];m.keepFree=clamp(m.keepFree+ +d.d,0,40);},
    millup(d){upgradeMill(d.k);},
    millhand(d){const w=K().ws.find(x=>x.id===+d.w);if(!w)return;
        if(+d.d>0){if(K().ws.filter(x=>x.at==='mill:'+d.k).length>=MILL[K().mills[d.k].lv].hands){toast('This mill has all the hands it can use','warn');return;}w.at='mill:'+d.k;}else w.at=null;},
    millbuild(d){if(buildMill(d.k))closePanel();},
    coopsell(){if(_coopLb<1){toast('Slide to choose how much to sell','warn');return;}sellCoop(_coopLb);_coopLb=0;},
    buy(d){buySupply(d.t,+d.n);},
    stall(d){K().stall=d.v==='1';if(K().stall)toast('Stall rented. Market day comes once a week, spring to fall.','green');},
    seller(d){const k=K(),w=k.ws.find(x=>x.id===+d.w);if(!w)return;if(+d.d>0){k.ws.forEach(x=>{if(x.at==='market')x.at=null;});w.at='market';}else w.at=null;},
    hire(){hire();},
    fire(d,b){
        if(!b.dataset.armed){b.dataset.armed='1';b.textContent='Sure?';setTimeout(()=>{if(b.isConnected){delete b.dataset.armed;b.textContent='Let go';}},3000);return'norender';}
        const k=K(),w=k.ws.find(x=>x.id===+d.w);if(!w)return;
        const p=Math.min(Math.max(0,k.money),w.owed);if(p>0)spend('wages',p);if(w.owed-p>0.01)k.debt+=w.owed-p;
        k.ws=k.ws.filter(x=>x!==w);toast(`${w.name} has been let go`,'info');
    },
    debtpay(){payDebt(_debtV||0);_debtV=0;},
});
