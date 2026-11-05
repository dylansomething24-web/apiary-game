// ── UPGRADES SHOP ─────────────────────────────────────────────────────────────
// There are no levels. Each upgrade opens when something is done in the game (a winter survived,
// a hive founded, land healed, or another upgrade bought), and then it is bought. Bee upgrades
// cost honey, paid by the hive with the most honey above its winter reserve. One purchase covers
// every hive, including hives founded later. Design: vault note 13 Upgrades Shop Design.
function owns(id){return!!(G.up&&G.up[id]);}
const JOBS=['nurses','processors','guards','builders','foragers'];
function jobAuto(j){return owns('a_'+j);}
function anyJobAuto(){return JOBS.some(jobAuto);}
function allJobsAuto(){return JOBS.every(jobAuto);}
const maxReach=()=>Math.max(...G.hives.map(h=>h.frad));
const bought=id=>[UPG.find(u=>u.id===id).name+' bought',owns(id)?1:0,1,true];
const UPG=[
    {id:'poll',name:'Pollinators',cost:10,
     desc:'Send bees to bring dead zones back to life.',
     need:()=>[['Winters survived',G._wintersS,1]]},
    {id:'qmodes',name:'Queen laying modes',cost:10,
     desc:'Choose how hard the queen lays: conserve, normal or overdrive.',
     need:()=>[['Winters survived',G._wintersS,1]]},
    {id:'poll2',name:'Strong pollinators',cost:25,
     desc:'Pollinators restore dead zones 20% faster.',
     need:()=>[bought('poll'),['Dead-zone hexes healed',G._tilesRestored,3]]},
    {id:'split',name:'Splitting',cost:25,
     desc:'Split a crowded hive to found a new one, instead of losing bees to a swarm.',
     need:()=>[['Most bees at once',G._peakB,100],['Dead-zone hexes healed',G._tilesRestored,1],['Forage reach',maxReach(),3]]},
    {id:'a_queen',name:'Auto queen',cost:60,auto:true,
     desc:'Every queen follows the seasons: hard in spring, steady in summer, light in fall, resting in winter. She keeps only the brood room she can fill, and the rest becomes storage.',
     need:()=>[bought('qmodes'),['Hives founded',G._maxHives,2]]},
    {id:'a_nurses',name:'Auto nurses',cost:40,auto:true,
     desc:'Each hive keeps enough nurses for its larvae and the eggs about to hatch.',
     need:()=>[['Hives founded',G._maxHives,2]]},
    {id:'a_processors',name:'Auto processors',cost:40,auto:true,
     desc:'Each hive keeps enough processors for the nectar coming in.',
     need:()=>[bought('a_nurses')]},
    {id:'a_guards',name:'Auto guards',cost:30,auto:true,
     desc:'Guards follow the seasons: 3% of the bees in spring, 6% in summer and fall, none in winter.',
     need:()=>[bought('a_processors')]},
    {id:'a_builders',name:'Auto builders',cost:50,auto:true,
     desc:'Builders draw new comb, using only honey above the winter reserve.',
     need:()=>[['Hives founded',G._maxHives,3]]},
    {id:'a_deep',name:'Auto deepening',cost:50,auto:true,
     desc:'Once the comb is full size, builders deepen the storage cells on their own.',
     need:()=>[bought('a_builders')]},
    {id:'a_foragers',name:'Auto foragers',cost:60,auto:true,
     desc:'Every morning the spare bees go to the best open fields.',
     need:()=>[bought('a_builders')]},
];
const upById=id=>UPG.find(u=>u.id===id);
function upOpen(u){return!!(G._open&&G._open[u.id]);}
function needMet(u){return u.need().every(([,v,t])=>v>=t);}
// a locked item is shown once everything it needs to have been bought is bought
function upVisible(u){return u.need().every(([,v,t,b])=>!b||v>=t);}
// spare honey: what a hive holds above its winter reserve
function spareHoney(h){return withHive(h,()=>G.honey-winterReserve());}
function payer(){
    let best=null,sp=-Infinity;
    G.hives.forEach(h=>{const s=spareHoney(h);if(s>sp){sp=s;best=h;}});
    return{h:best,spare:sp};
}
function canAfford(u){return payer().spare>=u.cost;}
function buyUp(id,quiet){
    const u=upById(id);if(!u||owns(id))return false;
    if(!upOpen(u)){if(!quiet)toast('This upgrade hasn’t opened yet','warn');return false;}
    const p=payer();
    if(p.spare<u.cost){if(!quiet)toast(`Needs ${u.cost} lb of spare honey. The best hive has ${Math.max(0,Math.floor(p.spare))} lb above its winter reserve.`,'warn');return false;}
    p.h.honey-=u.cost;G.up[id]=true;
    if(id==='a_queen')G.hives.forEach(h=>h.qMode='auto');
    if(!quiet){toast(`${u.name} bought. ${p.h.name} paid ${u.cost} lb of honey.`,'mile');hap([40,20,40]);}
    checkShop(quiet);
    return true;
}
// called every day: opens whatever is now reached, and says so
let _newQ=[];
function checkShop(silent){
    G._maxHives=Math.max(G._maxHives||1,G.hives.length);
    const fresh=UPG.filter(u=>!upOpen(u)&&needMet(u));
    if(!fresh.length)return;
    fresh.forEach(u=>G._open[u.id]=true);
    if(silent)return;
    _newQ.push(...fresh.map(u=>u.id));hap([40,20,40,20,40]);
    showNewInShop();
}
function showNewInShop(){
    if(!_newQ.length)return;
    const us=_newQ.map(upById);
    document.getElementById('lv-n').textContent='Upgrades';
    document.getElementById('lv-name').textContent='New in the shop';
    document.getElementById('lv-story').textContent='The colony has opened something new. Buy it in Upgrades when the honey allows.';
    document.getElementById('lv-list').innerHTML=us.map(u=>`<div class="lv-inst"><b>${u.name} · ${u.cost} lb honey</b><span>${u.desc}</span></div>`).join('');
    if(!document.querySelector('#ov-l.show')){Snd.mile();ovShow('ov-l');}
}
// the Upgrades button's dot: something open can be bought right now
function shopDot(){const sp=payer().spare;return UPG.some(u=>upOpen(u)&&!owns(u.id)&&sp>=u.cost);}

function renderShop(){
    const p=payer(),sp=Math.max(0,Math.floor(p.spare));
    const open=UPG.filter(u=>upOpen(u)&&!owns(u.id));
    const next=UPG.filter(u=>!upOpen(u)&&upVisible(u));
    const hidden=UPG.filter(u=>!upOpen(u)&&!upVisible(u)).length;
    const run=UPG.filter(u=>owns(u.id));
    const needRow=([l,v,t,b])=>b?`<div class="kv"><span>${l.replace(' bought','')}</span><b class="${v>=t?'good':''}">${v>=t?'bought':'not yet'}</b></div>`
        :`<div class="kv"><span>${l}</span><b class="${v>=t?'good':''}">${Math.min(v,t)} / ${t}</b></div>${bar(v/t*100,v>=t?'greenbar':'')}`;
    let h=`<section class="card"><h3>Bees <span class="sub">paid in honey</span></h3>
      <div class="kv"><span>${G.hives.length>1?`Best hive to pay: ${p.h.name}`:'Spare honey'}</span><b>${sp} lb</b></div>
      <p class="hint">Spare honey is what a hive holds above its winter reserve. The hive with the most pays, and no hive is ever taken below its reserve. One purchase covers every hive.</p>`;
    h+=open.length?open.map(u=>{const ok=sp>=u.cost;
        return`<div class="row"><div class="row-top"><span class="rname">${u.name}</span><span class="rnum">${u.cost}<small class="sub"> lb</small></span></div>
          <div class="rdesc">${u.desc}</div>
          ${btn(ok?(G.hives.length>1?`Buy · ${p.h.name} pays`:'Buy'):`Needs ${Math.ceil(u.cost-p.spare)} lb more spare honey`,'buyup',`data-id="${u.id}" ${ok?'':'disabled'}`,'wide')}</div>`;}).join('')
      :`<p class="note">${next.length?'Nothing to buy right now. See what opens next below.':'Everything is bought.'}</p>`;
    h+=`</section>`;
    if(next.length)h+=`<section class="card"><h3>Opens next</h3>${next.map(u=>`<div class="row"><div class="row-top"><span class="rname">${u.name}</span><span class="rnum">${u.cost}<small class="sub"> lb</small></span></div>
        <div class="rdesc">${u.desc}</div>${u.need().map(needRow).join('')}</div>`).join('')}
        ${hidden?`<p class="hint">${hidden} more upgrade${hidden===1?'':'s'} open further along.</p>`:''}</section>`;
    if(run.length)h+=`<section class="card"><h3>Running <span class="sub">${run.length} / ${UPG.length}</span></h3>
        ${run.map(u=>`<div class="kv"><span>${u.name}</span><b class="good">on</b></div>`).join('')}</section>`;
    $('ubody').innerHTML=h;
}
