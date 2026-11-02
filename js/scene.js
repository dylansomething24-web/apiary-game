// ── BEE MANAGER ───────────────────────────────────────────────────────────────
class BeeManager{
    constructor(scene){this.s=scene;this.bees=[];}
    sync(){
        this.bees.forEach(b=>b.destroy());this.bees=[];
        if(G.view==='hive')return;
        Object.entries(G.fa).forEach(([k,n])=>{
            const t=G.tiles[k];if(!t)return;
            const{x:tx,y:ty}=h2p(t.q,t.r);
            const hx=h2p(0,0).x,hy=h2p(0,0).y;
            const cnt=Math.min(n,3);
            for(let i=0;i<cnt;i++){
                const b=this.s.add.text(hx,hy,'🐝',{font:'13px serif'}).setOrigin(.5,.5).setDepth(6);
                const pct=i/Math.max(cnt,1);
                b._tx=tx;b._ty=ty;b._hx=hx;b._hy=hy;
                b._t=pct;b._dir=1;b._amp=6+Math.random()*6;b._spd=.0008+Math.random()*.0004;
                b._off=Math.random()*Math.PI*2;
                this.bees.push(b);
            }
        });
    }
    update(time){
        this.bees.forEach(b=>{
            b._t+=b._spd*b._dir;
            if(b._t>=1){b._t=1;b._dir=-1;b.setScale(-1,1);}
            if(b._t<=0){b._t=0;b._dir=1;b.setScale(1,1);}
            const t=b._t;
            const dx=b._tx-b._hx,dy=b._ty-b._hy;
            const nx=-dy/Math.sqrt(dx*dx+dy*dy+.001),ny=dx/Math.sqrt(dx*dx+dy*dy+.001);
            const wave=Math.sin(time*.003+b._off)*b._amp;
            b.setPosition(b._hx+dx*t+nx*wave,b._hy+dy*t+ny*wave);
        });
    }
    clear(){this.bees.forEach(b=>b.destroy());this.bees=[];}
}

// ── PARTICLES ─────────────────────────────────────────────────────────────────
class Particles{
    constructor(scene){this.s=scene;this.pts=[];}
    burst(x,y){
        for(let i=0;i<3;i++){
            const p=this.s.add.graphics().setDepth(7);
            p.fillStyle(0xe09a18,.85);p.fillCircle(0,0,3);
            p.setPosition(x,y);
            p._vx=(Math.random()-.5)*1.2;p._vy=-1.5-Math.random()*1.5;p._l=1;
            this.pts.push(p);
        }
    }
    update(dt){
        this.pts=this.pts.filter(p=>{
            p._l-=dt*.003;p._vy+=dt*.02;
            p.setPosition(p.x+p._vx*dt*.016,p.y+p._vy*dt*.016);
            p.setAlpha(p._l);if(p._l<=0){p.destroy();return false;}return true;
        });
    }
}

// ── PHASER SCENE ─────────────────────────────────────────────────────────────
class GameScene extends Phaser.Scene{
    constructor(){super('G');}
    create(){
        window._S=this;
        this.bgG=this.add.graphics().setDepth(0);
        this.hvG=this.add.graphics().setDepth(0).setVisible(false);
        this.hlG=this.add.graphics().setDepth(4);
        this.fxG=this.add.graphics().setDepth(5);
        this.cam=this.cameras.main;
        this.cam.setScroll(-this.cam.width/2,-this.cam.height/2);
        this.bees=new BeeManager(this);
        this.parts=new Particles(this);
        this.fTx={};
        this._drag=false;this._moved=false;

        const loaded=load();
        if(!loaded){
            G.tiles=makeMap();G.fog=makeFog(G.tiles);
            setTimeout(()=>ovShow('ov-i'),50);
        }
        this.drawMap();this.bees.sync();
        this.pulse();hud();

        this.input.on('pointerdown',p=>{this._drag=true;this._moved=false;this._px=p.x;this._py=p.y;this._sx=this.cam.scrollX;this._sy=this.cam.scrollY;Snd._start();});
        this.input.on('pointermove',p=>{if(!this._drag)return;const dx=p.x-this._px,dy=p.y-this._py;if(Math.abs(dx)>6||Math.abs(dy)>6){this._moved=true;const z=this.cam.zoom;this.cam.setScroll(this._sx-dx/z,this._sy-dy/z);}});
        this.input.on('pointerup',p=>{
            this._drag=false;if(this._moved)return;
            if(G.view==='hive'){
                const wp=this.cam.getWorldPoint(p.x,p.y);
                const{q,r}=p2h(wp.x,wp.y,HS);
                const dist=hdist(q,r,0,0);
                if(dist===0)openHiveCell('queen');
                else if(dist===1)openHiveCell('b1');
                else if(dist===2)openHiveCell(G.season==='Winter'||G.season==='Fall'?'honey':'b2');
                else if(dist===3)openHiveCell('honey');
                else if(G.panelOpen)closePanel();
                return;
            }
            const wp=this.cam.getWorldPoint(p.x,p.y);
            const{q,r}=p2h(wp.x,wp.y);const k=hkey(q,r);
            if(G.tiles[k]){this._hl(q,r);openPanel(k);}
            else if(G.fog[k]&&G.fog[k].level===1){
                const f=G.fog[k];const adj=nbrs(f.q,f.r).some(([nq,nr])=>G.tiles[hkey(nq,nr)]);
                if(adj){this._hlFog(f.q,f.r);openFogPanel(k,f.q,f.r);}else if(G.panelOpen)closePanel();
            }else if(G.panelOpen)closePanel();
        });
    }

    _hex(g,cx,cy,sz){const p=cors(cx,cy,sz-1.5);g.beginPath();g.moveTo(p[0],p[1]);for(let i=2;i<12;i+=2)g.lineTo(p[i],p[i+1]);g.closePath();}

    drawMap(){
        const g=this.bgG;g.clear();
        Object.values(G.fog).forEach(({q,r,level})=>{
            const{x,y}=h2p(q,r);const a=level===1?.45:.2;
            g.fillStyle(0x050a05,a);g.lineStyle(1,0x0b170b,a*.7);this._hex(g,x,y,SZ);g.fillPath();g.strokePath();
            if(level===1&&G.scouts.find(m=>m.k===hkey(q,r))){g.fillStyle(0xe09a18,.12);this._hex(g,x,y,SZ);g.fillPath();}
        });
        Object.values(G.tiles).forEach(t=>{
            const{x,y}=h2p(t.q,t.r);const d=TD[t.type];const s=t.stage;
            g.fillStyle(d.fill[s],1);g.lineStyle(1.5,d.rim[s],.9);this._hex(g,x,y,SZ);g.fillPath();g.strokePath();
            if(t.type==='WATER'){g.fillStyle(0x2050a0,.8);g.fillCircle(x,y,5.5);g.fillStyle(0x4070c0,.45);g.fillCircle(x,y,3);}
            else if(t.type==='STRUCTURE'){g.fillStyle(0x585848,.52);g.fillRect(x-5.5,y-4.5,11,9);g.lineStyle(1,0x787868,.4);g.strokeRect(x-5.5,y-4.5,11,9);}
            else if(t.type==='DEAD_ZONE'){
                const prog=G.restore[hkey(t.q,t.r)]||0;
                if(prog>0){g.fillStyle(0x30a040,prog/100*.38);this._hex(g,x,y,SZ-2);g.fillPath();}
                g.lineStyle(1.2,0x3a2010,prog>0?.3:.5);g.lineBetween(x-5,y-4,x+5,y+4);g.lineBetween(x+5,y-4,x-5,y+4);
            }
            else if(t.type==='SUNFLOWER'&&s>=2){g.fillStyle(0xe8c028,.85);g.fillCircle(x,y,5);for(let i=0;i<8;i++){const a=i*Math.PI/4;g.fillStyle(0xf4d820,.5);g.fillCircle(x+7.5*Math.cos(a),y+7.5*Math.sin(a),2.5);}}
            else if(t.type==='CLOVER'&&s>=2){g.fillStyle(0x48c848,.7);[[0,-3.5],[-3,2],[3,2]].forEach(([dx,dy])=>g.fillCircle(x+dx,y+dy,3));}
            else if(t.type==='WILDFLOWER'&&s>=2){g.fillStyle(0xe04888,.65);g.fillCircle(x+16,y-11,3.5);g.fillStyle(0xd8b020,.6);g.fillCircle(x-14,y+12,3);}
            else if(t.type==='FOREST'&&s>=2){g.fillStyle(0x186018,.75);[-6,0,6].forEach((dx)=>{const h=dx===0?9:7;g.fillTriangle(x+dx,y-h,x+dx-4,y+3,x+dx+4,y+3);});}
        });
        const hp=h2p(0,0);
        g.fillStyle(0xe09a18,1);g.fillCircle(hp.x,hp.y,7);g.lineStyle(2,0xf0bc40,.85);g.strokeCircle(hp.x,hp.y,9.5);
        g.lineStyle(1,0xe09a18,.12);g.strokeCircle(hp.x,hp.y,SZ*S3*G.frad*1.02);
    }

    drawHive(){
        const g=this.hvG;g.clear();
        const hx=(cx,cy)=>{const p=cors(cx,cy,HS-1.5);g.beginPath();g.moveTo(p[0],p[1]);for(let i=2;i<12;i+=2)g.lineTo(p[i],p[i+1]);g.closePath();};
        const nn=Math.max(1,Math.ceil(G.bees/20)),ok=G.nurses>=nn;
        const r1o=ring(1).filter(([q,r])=>hdist(q,r,0,0)===1);
        const r2o=ring(2).filter(([q,r])=>hdist(q,r,0,0)===2);
        const r3o=ring(3).filter(([q,r])=>hdist(q,r,0,0)===3);
        const HM=Math.max(90,~~(G.bees*.5));
        ring(3).forEach(([q,r])=>{
            const dist=hdist(q,r,0,0);const{x,y}=hv2p(q,r);
            let fill,rim,dot=null,dr=0;
            if(dist===0){fill=0xb07010;rim=0xf0c040;dot=0xffe060;dr=4.5;}
            else if(dist===1){
                const ci=r1o.findIndex(([a,b])=>a===q&&b===r);
                const age=(G.brood+ci*3)%21,dis=G._distress.includes(ci);
                if(!ok){fill=0x0c0906;rim=0x160d06;}
                else if(dis){fill=0x3a0808;rim=0x7a1010;dot=0xff4030;dr=2.5;}
                else if(age<=2){fill=0x1c1610;rim=0x2e2a1e;dot=0xe8e8d8;dr=3;}
                else if(age<=8){fill=0x2c2618;rim=0x4a3e28;dot=0xd0c088;dr=5;}
                else{fill=0x7a5030;rim=0xa07040;}
            }else if(dist===2){
                if(G.season==='Winter'||G.season==='Fall'){
                    const idx=r2o.findIndex(([a,b])=>a===q&&b===r);
                    const f=idx<~~(Math.min(1,G.honey/HM)*12);
                    fill=f?0xd08010:0x221808;rim=f?0xe8a830:0x382412;
                }else{
                    const ci=r2o.findIndex(([a,b])=>a===q&&b===r);
                    const age=(G.brood+ci*7+r*5+8)%21;
                    if(!ok){fill=0x0c0906;rim=0x160d06;}
                    else if(age<=2){fill=0x1c1610;rim=0x2e2a1e;dot=0xc8c8b8;dr=2;}
                    else if(age<=8){fill=0x2a2216;rim=0x483c26;dot=0xb8a870;dr=4;}
                    else{fill=0x604020;rim=0x806040;}
                }
            }else{
                const idx=r3o.findIndex(([a,b])=>a===q&&b===r);
                const pct=Math.min(1,G.honey/HM),th=~~(pct*18);
                if(idx<th){fill=0xe09a18;rim=0xf0bc40;}
                else if(idx===th&&G.honey>0){fill=0x7a5010;rim=0xb07820;}
                else{fill=0x1c1408;rim=0x2c1e0e;}
            }
            g.fillStyle(fill,1);g.lineStyle(1.5,rim,.9);hx(x,y);g.fillPath();g.strokePath();
            if(dot!==null){g.fillStyle(dot,.9);g.fillCircle(x,y,dr);}
        });
    }

    _hl(q,r){const{x,y}=h2p(q,r);this.hlG.clear();this.hlG.lineStyle(2.5,0xe09a18,.75);this._hex(this.hlG,x,y,SZ);this.hlG.strokePath();}
    _hlFog(q,r){const{x,y}=h2p(q,r);this.hlG.clear();this.hlG.lineStyle(1.5,0xe09a18,.3);this._hex(this.hlG,x,y,SZ);this.hlG.strokePath();}

    pulse(){
        const{x,y}=h2p(0,0);const st={r:SZ*.5,a:.55};
        this._pt=this.tweens.add({targets:st,r:SZ*1.8,a:0,duration:2500,repeat:-1,ease:'Sine.easeOut',
            onUpdate:()=>{this.fxG.clear();this.fxG.lineStyle(1.5,0xe09a18,st.a);this.fxG.strokeCircle(x,y,st.r);}});
    }
    restartPulse(){if(this._pt)this._pt.stop();this.fxG.clear();this.pulse();}

    refresh(){
        if(G.view==='hive'){this.drawHive();return;}
        this.drawMap();
        Object.values(this.fTx).forEach(t=>t.destroy());this.fTx={};
        Object.entries(G.fa).forEach(([k,n])=>{
            const t=G.tiles[k];if(!t)return;const{x,y}=h2p(t.q,t.r);
            this.fTx[k]=this.add.text(x,y+SZ*.58,`${n}`,{font:'11px Courier New',fill:'#e09a18',stroke:'#040804',strokeThickness:3}).setOrigin(.5,.5).setDepth(3);
        });
        Object.entries(G.pa).forEach(([k,n])=>{
            const t=G.tiles[k];if(!t)return;const{x,y}=h2p(t.q,t.r);
            this.fTx['p_'+k]=this.add.text(x,y-SZ*.1,`${n}🌿`,{font:'10px Courier New',fill:'#58c858',stroke:'#040804',strokeThickness:3}).setOrigin(.5,.5).setDepth(3);
        });
        this.bees.sync();
    }

    rebuild(){
        this.bees.clear();this.parts.pts.forEach(p=>p.destroy());this.parts.pts=[];
        Object.values(this.fTx).forEach(t=>t.destroy());this.fTx={};
        this.fxG.clear();this.restartPulse();this.refresh();
    }

    update(time,delta){
        G._dt+=delta*G.speed;
        if(G._dt>=G.ms){
            G._dt-=G.ms;tick();
            if(_hday>.2&&G.view==='map'){
                Object.keys(G.fa).forEach(k=>{const t=G.tiles[k];if(!t)return;const{x,y}=h2p(t.q,t.r);if(Math.random()<.4)this.parts.burst(x,y);});
                if(Math.random()<.3)Snd.honey();
            }
        }
        this.bees.update(time);this.parts.update(delta);
    }
}

// ── LAUNCH ────────────────────────────────────────────────────────────────────
const game=new Phaser.Game({
    type:Phaser.AUTO,backgroundColor:'#060c06',
    width:window.innerWidth,height:window.innerHeight,
    scene:[GameScene],
    scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},
    input:{activePointers:2},
});
window.addEventListener('resize',()=>game.scale.resize(window.innerWidth,window.innerHeight));

if('serviceWorker' in navigator)
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
