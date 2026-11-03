// ── FORAGER FLIGHTS ───────────────────────────────────────────────────────────
class BeeManager{
    constructor(s){this.s=s;this.bees=[];this.sig='';}
    sync(force){
        const sig=JSON.stringify(G.fa);
        if(!force&&sig===this.sig)return;
        this.sig=sig;this.clear();
        Object.entries(G.fa).forEach(([k,n])=>{
            const t=G.tiles[k];if(!t)return;const p=h2p(t.q,t.r);
            for(let i=0;i<Math.min(n,3);i++){
                const b=this.s.add.text(0,0,'🐝',{font:'13px serif'}).setOrigin(.5).setDepth(6);
                Object.assign(b,{_tx:p.x,_ty:p.y,_t:i/3,_dir:1,_amp:5+Math.random()*6,_spd:.004+Math.random()*.003,_off:Math.random()*6});
                b.setVisible(G.view==='map');this.bees.push(b);
            }
        });
    }
    update(time){
        if(G.view!=='map'||G.season==='Winter'){this.bees.forEach(b=>b.setVisible(false));return;}
        this.bees.forEach(b=>{
            b.setVisible(true);
            b._t+=b._spd*b._dir;
            if(b._t>=1){b._t=1;b._dir=-1;}if(b._t<=0){b._t=0;b._dir=1;}
            b.setScale(b._dir,1);
            const len=Math.hypot(b._tx,b._ty)||1,nx=-b._ty/len,ny=b._tx/len,w=Math.sin(time*.004+b._off)*b._amp;
            b.setPosition(b._tx*b._t+nx*w,b._ty*b._t+ny*w);
        });
    }
    clear(){this.bees.forEach(b=>b.destroy());this.bees=[];}
}

class Particles{
    constructor(s){this.s=s;this.pts=[];}
    burst(x,y){for(let i=0;i<3;i++){const p=this.s.add.circle(x,y,3,0xf0b030,.9).setDepth(7);Object.assign(p,{_vx:(Math.random()-.5)*1.2,_vy:-1.4-Math.random(),_l:1});this.pts.push(p);}}
    update(dt){this.pts=this.pts.filter(p=>{p._l-=dt*.0025;p._vy+=dt*.003;p.x+=p._vx*dt*.05;p.y+=p._vy*dt*.05;p.setAlpha(p._l);if(p._l<=0){p.destroy();return false;}return true;});}
    clear(){this.pts.forEach(p=>p.destroy());this.pts=[];}
}

// ── SCENE ─────────────────────────────────────────────────────────────────────
class GameScene extends Phaser.Scene{
    constructor(){super('G');}
    create(){
        window._S=this;
        this.mapG=this.add.graphics().setDepth(0);
        this.hiveG=this.add.graphics().setDepth(0).setVisible(false);
        this.hlG=this.add.graphics().setDepth(4);
        this.cam=this.cameras.main;
        this.bees=new BeeManager(this);this.parts=new Particles(this);
        this.labels=[];

        const loaded=load();
        if(!loaded)setTimeout(()=>ovShow('ov-i'),60);
        this.scale.getParentBounds();this.scale.refresh();
        this.resetCams();
        this.refresh();renderAll();

        const canvas=this.game.canvas;
        this.input.on('pointerdown',p=>{
            if(p.downElement&&p.downElement!==canvas)return;
            Snd._start();
            const p1=this.input.pointer1,p2=this.input.pointer2;
            if(p1.isDown&&p2.isDown){this._pinch={d:Phaser.Math.Distance.Between(p1.x,p1.y,p2.x,p2.y),z:this.cam.zoom};this._down=false;return;}
            this._down=true;this._moved=false;this._sx=this.cam.scrollX;this._sy=this.cam.scrollY;this._px=p.x;this._py=p.y;
            this._paint=G.view==='hive'&&G.hmode!=='inspect';this._last=null;
            if(this._paint)this.paintAt(p);
        });
        this.input.on('pointermove',p=>{
            if(this._pinch){
                const p1=this.input.pointer1,p2=this.input.pointer2;
                if(p1.isDown&&p2.isDown){const d=Phaser.Math.Distance.Between(p1.x,p1.y,p2.x,p2.y);this.setZoom(this._pinch.z*d/this._pinch.d);}
                return;
            }
            if(!this._down)return;
            if(this._paint){this.paintAt(p);return;}
            const dx=p.x-this._px,dy=p.y-this._py;
            if(this._moved||Math.abs(dx)>8||Math.abs(dy)>8){this._moved=true;this.cam.setScroll(this._sx-dx/this.cam.zoom,this._sy-dy/this.cam.zoom);}
        });
        this.input.on('pointerup',p=>{
            if(this._pinch){if(!this.input.pointer1.isDown&&!this.input.pointer2.isDown)this._pinch=null;return;}
            if(!this._down)return;this._down=false;
            if(this._paint){this._paint=false;save();renderAll();return;}
            if(this._moved)return;
            this.tap(p);
        });
        this.input.on('wheel',(p,o,dx,dy)=>this.setZoom(this.cam.zoom*(dy>0?.9:1.1)));
        this.scale.on('resize',()=>{const m=this.cam.midPoint,x=m.x,y=m.y;this.cam.centerOn(x,y);});
    }

    // Camera helpers
    resetCams(){
        const w=this.cam.width;
        G.cams.map={x:0,y:0,z:clamp(w/(SZ*S3*8.5),.55,1.3)};
        G.cams.hive=null;
        this.applyCam('map');
    }
    applyCam(v){
        if(v==='colony')return;
        if(v==='hive'&&!G.cams.hive){this.fitHive();return;}
        const c=G.cams[v];this.cam.setZoom(c.z);this.cam.centerOn(c.x,c.y);
    }
    saveCam(){if(G.view==='colony')return;const m=this.cam.midPoint;G.cams[G.view]={x:m.x,y:m.y,z:this.cam.zoom};}
    setZoom(z){const m=this.cam.midPoint,x=m.x,y=m.y;this.cam.setZoom(clamp(z,.4,3));this.cam.centerOn(x,y);}
    zoomBy(d){this.setZoom(this.cam.zoom*(d>0?1.25:.8));}
    fitHive(){
        let R=1;Object.keys(G.comb).forEach(k=>R=Math.max(R,kdist(k)));R+=1;
        const w=this.cam.width,h=this.cam.height-90;
        const z=Math.min(w/(HS*S3*(2*R+1)),h/(HS*1.5*(2*R+1)+HS));
        this.cam.setZoom(clamp(z*.95,.5,2.6));this.cam.centerOn(0,0);
    }
    showView(v){
        this.mapG.setVisible(v!=='hive');this.hiveG.setVisible(v==='hive');
        this.labels.forEach(l=>l.setVisible(v!=='hive'));
        this.clearHl();this.applyCam(v);this.refresh();
    }

    tap(p){
        const wp=this.cam.getWorldPoint(p.x,p.y);
        if(G.view==='hive'){
            const{q,r}=p2h(wp.x,wp.y,HS),k=hkey(q,r);
            if(G.comb[k]){this.hl(q,r,HS);openSel({kind:'cell',k});}else closePanel();
            return;
        }
        if(G.view!=='map')return;
        const{q,r}=p2h(wp.x,wp.y),k=hkey(q,r);
        if(G.tiles[k]){this.hl(q,r,SZ);openSel({kind:'tile',k});}
        else if(G.fog[k]){this.hl(q,r,SZ);openSel({kind:'fog',k});}
        else closePanel();
    }
    paintAt(p){
        const wp=this.cam.getWorldPoint(p.x,p.y);
        const{q,r}=p2h(wp.x,wp.y,HS),k=hkey(q,r);
        if(k===this._last||!G.comb[k])return;this._last=k;
        if(setCell(k,G.hmode,true)){hap(8);this.drawHive();}
    }
    hl(q,r,sz){
        const{x,y}=sz===SZ?h2p(q,r):hv2p(q,r);
        this.hlG.clear();this.hlG.lineStyle(3,0xffd060,.95);this.hex(this.hlG,x,y,sz);this.hlG.strokePath();
    }
    clearHl(){this.hlG.clear();}
    hex(g,cx,cy,sz){const p=cors(cx,cy,sz-1.5);g.beginPath();g.moveTo(p[0],p[1]);for(let i=2;i<12;i+=2)g.lineTo(p[i],p[i+1]);g.closePath();}

    // ── MAP ──────────────────────────────────────────────────────────────────
    drawMap(){
        const g=this.mapG;g.clear();
        Object.entries(G.fog).forEach(([k,{q,r,level}])=>{
            const{x,y}=h2p(q,r);
            const sc=G.scouts.find(s=>s.k===k);
            g.fillStyle(level===1?0x161f17:0x0c120d,1);g.lineStyle(1,level===1?0x2a3a2c:0x141c15,1);
            this.hex(g,x,y,SZ);g.fillPath();g.strokePath();
            if(sc){g.fillStyle(0xe09a18,.25);this.hex(g,x,y,SZ);g.fillPath();}
            else if(level===1&&scoutable(k)){g.fillStyle(0x3a4a3c,1);g.fillCircle(x,y,2.5);}
        });
        Object.entries(G.tiles).forEach(([k,t])=>{
            const{x,y}=h2p(t.q,t.r),d=TD[t.type],s=t.stage,ok=inRange(t);
            const fill=d.fill[s];
            g.fillStyle(fill,1);g.lineStyle(1.5,lighten(fill,28),1);this.hex(g,x,y,SZ);g.fillPath();g.strokePath();
            if(t.type==='WATER'){g.fillStyle(0x3a78c8,.9);g.fillEllipse(x,y,22,12);g.fillStyle(0x6aa0e0,.6);g.fillEllipse(x-3,y-2,10,4);}
            else if(t.type==='STRUCTURE'){g.fillStyle(0x6a6858,1);g.fillRect(x-8,y-5,16,11);g.fillStyle(0x4a483e,1);g.fillTriangle(x-10,y-5,x+10,y-5,x,y-13);}
            else if(t.type==='DEAD_ZONE'){
                const pr=G.restore[k]||0;
                if(pr>0){g.fillStyle(0x40b050,pr/100*.55);this.hex(g,x,y,SZ-3);g.fillPath();}
                g.lineStyle(2,0x5a3a28,.9);g.lineBetween(x-7,y-6,x+7,y+6);g.lineBetween(x+7,y-6,x-7,y+6);
            }
            else if(t.type==='SUNFLOWER'){const n=s>=2?3:s>=1?2:1;[[0,0],[-11,8],[11,8]].slice(0,n).forEach(([dx,dy])=>{for(let i=0;i<8;i++){const a=i*Math.PI/4;g.fillStyle(0xf4d020,.85);g.fillCircle(x+dx+5*Math.cos(a),y+dy+5*Math.sin(a),2.2);}g.fillStyle(0x5a3a10,1);g.fillCircle(x+dx,y+dy,3);});}
            else if(t.type==='CLOVER'){const n=s>=2?3:s>=1?2:1;[[0,-4],[-10,7],[10,7]].slice(0,n).forEach(([dx,dy])=>{g.fillStyle(0xe8e8f0,.9);[[0,-3],[-3,2],[3,2]].forEach(([a,b])=>g.fillCircle(x+dx+a,y+dy+b,2.6));});}
            else if(t.type==='WILDFLOWER'){const pts=[[0,0,0xe85090],[-12,6,0xf0c030],[12,6,0xa070e0],[-6,-10,0xf0f0f0],[8,-9,0xe85090]];pts.slice(0,s+2).forEach(([dx,dy,c])=>{g.fillStyle(c,.9);g.fillCircle(x+dx,y+dy,3);});}
            else if(t.type==='FOREST'){[-9,0,9].slice(0,s+1).forEach(dx=>{g.fillStyle(0x1e6a2a,1);g.fillTriangle(x+dx,y-12,x+dx-7,y+6,x+dx+7,y+6);});}
            if(t.type==='HIVE_BOX'){g.fillStyle(0xf0b030,1);g.fillCircle(x,y,9);g.lineStyle(2.5,0xffe080,1);g.strokeCircle(x,y,13);}
            else if(!ok){g.fillStyle(0x000000,.45);this.hex(g,x,y,SZ);g.fillPath();}
            else if(d.forage||t.type==='DEAD_ZONE'){g.lineStyle(1.5,0xe09a18,.35);this.hex(g,x,y,SZ-3);g.strokePath();}
        });
    }
    drawLabels(){
        this.labels.forEach(l=>l.destroy());this.labels=[];
        const mk=(x,y,txt,col)=>{const l=this.add.text(x,y,txt,{fontFamily:'Courier New',fontSize:'13px',fontStyle:'bold',color:col,stroke:'#050805',strokeThickness:4}).setOrigin(.5).setDepth(3);l.setVisible(G.view!=='hive');this.labels.push(l);};
        Object.entries(G.fa).forEach(([k,n])=>{const t=G.tiles[k];if(!t)return;const{x,y}=h2p(t.q,t.r);mk(x,y+SZ*.55,'🐝'+n,'#ffc040');});
        Object.entries(G.pa).forEach(([k,n])=>{const t=G.tiles[k];if(!t)return;const{x,y}=h2p(t.q,t.r);mk(x,y+SZ*.55,'🌱'+n,'#70e070');});
        G.scouts.forEach(s=>{const f=G.fog[s.k];if(!f)return;const{x,y}=h2p(f.q,f.r);mk(x,y,s.days+'d','#e0a030');});
    }

    // ── HIVE INTERIOR ─────────────────────────────────────────────────────────
    drawHive(){
        const g=this.hiveG;g.clear();
        const store=Object.keys(G.comb).filter(k=>G.comb[k].t==='s').sort((a,b)=>kdist(a)-kdist(b)||a.localeCompare(b));
        const honeyCells=G.honey/CELL_CAP,allCells=(G.honey+G.nectar)/CELL_CAP;
        const sIdx={};store.forEach((k,i)=>sIdx[k]=i);
        const fk=nextFrontier();
        if(fk&&G.builders>0){const{q,r}=kq(fk),{x,y}=hv2p(q,r);g.lineStyle(1.5,0xc89a50,.35+.5*G._bf);this.hex(g,x,y,HS);g.strokePath();g.fillStyle(0xc89a50,.15*G._bf);this.hex(g,x,y,HS);g.fillPath();}
        Object.entries(G.comb).forEach(([k,c])=>{
            const{q,r}=kq(k),{x,y}=hv2p(q,r);
            let fill,rim;
            if(c.t==='q'){fill=0xb07818;rim=0xffd860;}
            else if(c.t==='b'){
                if(c.d>0){fill=0x5a1a12;rim=0xb03828;}
                else if(c.a<0){fill=0x2e2014;rim=0x6a4a2a;}
                else if(c.a<=8){fill=0x3e2c1a;rim=0x7a5a34;}
                else{fill=0xb88040;rim=0xe0aa60;}
            }else{
                const i=sIdx[k];
                if(i<Math.floor(honeyCells)){fill=0xe8a020;rim=0xffc848;}
                else if(i<honeyCells){fill=0xb07818;rim=0xffc848;}
                else if(i<allCells){fill=0x8a8a40;rim=0xd8d070;}
                else{fill=0x1c1a0c;rim=0x9a8636;}
            }
            g.fillStyle(fill,1);g.lineStyle(1.5,rim,1);this.hex(g,x,y,HS);g.fillPath();g.strokePath();
            if(c.t==='s'&&sIdx[k]>=allCells){g.lineStyle(1,0x9a8636,.7);this.hex(g,x,y,HS*.55);g.strokePath();}
            if(c.t==='q'){g.fillStyle(0xffe080,1);g.fillEllipse(x,y,9,14);g.fillStyle(0x3a2208,1);g.fillRect(x-4,y-1,8,2);g.fillRect(x-4,y+3,8,2);}
            else if(c.t==='b'&&!(c.d>0)&&c.a>=0){
                if(c.a<=2){g.fillStyle(0xf4f0e0,1);g.fillEllipse(x,y,3,6);}
                else if(c.a<=8){const s=3+(c.a-3)*.9;g.fillStyle(0xf0e6c8,1);g.fillCircle(x,y,s);g.fillStyle(0x3e2c1a,1);g.fillCircle(x+s*.35,y-s*.2,s*.45);}
                else{g.lineStyle(1,0x8a5a28,.8);g.strokeCircle(x,y,HS*.45);}
            }
            if(c.p){g.lineStyle(2,0xffc848,.9);g.strokeCircle(x,y,HS*.6);}
        });
    }

    refresh(){
        if(G.view==='hive'){this.drawHive();return;}
        this.drawMap();this.drawLabels();this.bees.sync();
    }
    rebuild(){this.bees.clear();this.parts.clear();this.bees.sig='';this.resetCams();this.refresh();}
    burstForage(){Object.keys(G.fa).forEach(k=>{const t=G.tiles[k];if(t&&Math.random()<.5){const p=h2p(t.q,t.r);this.parts.burst(p.x,p.y-8);}});}

    update(time,delta){
        if(!ovOpen()){
            G._dt+=delta*G.speed;
            if(G._dt>=3000){G._dt=0;tick();}
        }
        this.bees.update(time);this.parts.update(delta);
    }
}

// ── LAUNCH ────────────────────────────────────────────────────────────────────
const game=new Phaser.Game({
    type:Phaser.AUTO,parent:'game',backgroundColor:'#0a110b',
    scale:{mode:Phaser.Scale.RESIZE,width:'100%',height:'100%'},
    scene:[GameScene],
    input:{activePointers:3,windowEvents:false},
});
if(window.ResizeObserver)new ResizeObserver(()=>requestAnimationFrame(()=>{game.scale.getParentBounds();game.scale.refresh();})).observe(document.getElementById('game'));
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
