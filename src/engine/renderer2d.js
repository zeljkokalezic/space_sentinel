/**
 * renderer2d.js — 2D HUD overlay rendering on canvas.
 * No React imports. No Three.js scene logic.
 */

// Radar sweep angle persists across frames
let radarAngle = 0;

/**
 * Draw the 2D HUD overlay on the canvas element.
 * @param {THREE.PerspectiveCamera} camera — Three.js camera for world-to-screen projection
 * @param {object} g — Game state
 * @param {HTMLCanvasElement} canvasEl — 2D canvas element
 * @param {object} statusRef — Ref holding current gameState string
 * @param {function} projectFn — projectToScreen function from renderer3d
 */
export const draw2DFrame = (camera, g, canvasEl, statusRef, projectFn) => {
  if (!canvasEl || (statusRef.current !== 'playing' && statusRef.current !== 'shop')) return;
  const w = window.innerWidth, h = window.innerHeight;
  canvasEl.width = w; canvasEl.height = h;
  const c = canvasEl.getContext('2d');
  c.clearRect(0, 0, w, h);

  // Top bar
  c.fillStyle='rgba(0,0,0,0.4)'; c.fillRect(0,0,w,60);
  c.fillStyle='#ef4444'; c.fillRect(20,15,200,12);
  c.fillStyle='#22c55e'; c.fillRect(20,15,200*Math.max(0,g.player.hp/g.player.maxHp),12);
  if (g.player.maxShield>0) { c.fillStyle='rgba(255,255,255,0.2)'; c.fillRect(20,32,200,6); c.fillStyle='#3b82f6'; c.fillRect(20,32,200*Math.max(0,g.player.shield/g.player.maxShield),6); }
  c.fillStyle='#ffffff'; c.font='bold 12px sans-serif'; c.textAlign='left';
  c.fillText(`HULL: ${Math.ceil(g.player.hp)} / ${g.player.maxHp}`, 230, 25);
  c.fillStyle='#facc15'; c.font='bold 24px monospace'; c.textAlign='right';
  c.fillText(`SCRAP: ${g.scrap}`, w-20, 35);

  // Dev mode badge
  if (g.devMode) {
    c.fillStyle='rgba(251,146,60,0.8)'; c.font='bold 11px monospace'; c.textAlign='right';
    c.fillText('DEV MODE [`]', w-20, 55);
  }

  c.fillStyle='#ffffff'; c.font='bold 20px monospace'; c.textAlign='center';
  c.fillText(`TIME: ${Math.floor(g.totalTime/60)}:${Math.floor(g.totalTime%60).toString().padStart(2,'0')}`, w/2, 50);

  // Mission bar
  const mBarW=300, mProg=Math.max(0,Math.min(1,g.mission.current/g.mission.target));
  c.fillStyle='rgba(0,0,0,0.5)'; c.fillRect(w/2-mBarW/2,10,mBarW,10);
  c.fillStyle='#39ff14'; c.fillRect(w/2-mBarW/2,10,mBarW*mProg,10);
  c.fillStyle='#fff'; c.font='bold 16px sans-serif'; c.textAlign='center';
  const mTxt = g.mission.type==='survive'
    ? `LEVEL ${g.level}: ${g.mission.title} [${Math.floor(g.mission.current)}s / ${g.mission.target}s]`
    : g.mission.type==='escort'
    ? `LEVEL ${g.level}: ${g.mission.title} [${Math.floor(g.mission.current)}m / ${g.mission.target}m]`
    : g.mission.type==='defend'
    ? `LEVEL ${g.level}: ${g.mission.title} [${Math.floor(g.mission.current)}s / ${g.mission.target}s]`
    : g.mission.type==='sabotage'
    ? `LEVEL ${g.level}: ${g.mission.title} [${g.mission.current} / ${g.mission.target}]`
    : `LEVEL ${g.level}: ${g.mission.title} [${Math.floor(g.mission.current)} / ${g.mission.target}]`;
  c.fillText(mTxt, w/2, 18);

  // Touch joystick
  if (g.touchBase && g.touchCurrent) {
    c.beginPath(); c.arc(g.touchBase.x,g.touchBase.y,60,0,Math.PI*2);
    c.fillStyle='rgba(255,255,255,0.1)'; c.fill(); c.lineWidth=2; c.strokeStyle='rgba(255,255,255,0.3)'; c.stroke();
    let tx=g.touchCurrent.x-g.touchBase.x, ty=g.touchCurrent.y-g.touchBase.y;
    const d=Math.hypot(tx,ty); if(d>60){tx=tx/d*60;ty=ty/d*60;}
    c.beginPath(); c.arc(g.touchBase.x+tx,g.touchBase.y+ty,25,0,Math.PI*2);
    c.fillStyle='rgba(255,255,255,0.4)'; c.fill();
  }

  // Enemy HP bars
  for (let e of g.enemies) {
    if (!e.active || e.hp>=e.maxHp) continue;
    const sp=projectFn(camera,e.x,e.y,0); if(!sp.visible) continue;
    c.fillStyle='rgba(57,255,20,0.2)'; c.fillRect(sp.x-20,sp.y-20,40,4);
    c.fillStyle='#39ff14'; c.fillRect(sp.x-20,sp.y-20,40*Math.max(0,e.hp/e.maxHp),4);
  }

  // Escort drone HP bar
  if (g.escort.active && g.escort.hp > 0 && g.escort.respawnTimer <= 0) {
    const esc = g.escort;
    const esp = projectFn(camera, esc.x, esc.y, 0);
    if (esp.visible) {
      c.fillStyle='rgba(34,211,238,0.2)'; c.fillRect(esp.x-25,esp.y-25,50,5);
      c.fillStyle='#22d3ee'; c.fillRect(esp.x-25,esp.y-25,50*Math.max(0,esc.hp/esc.maxHp),5);
      c.fillStyle='#22d3ee'; c.font='bold 10px monospace'; c.textAlign='center';
      c.fillText(`DRONE [${esc.lives} lives]`, esp.x, esp.y-30);
    }
  }

  // Escort destination screen marker
  if (g.escort.active && g.escort.hp > 0) {
    const destSp = projectFn(camera, g.escort.targetX, g.escort.targetY, 0);
    if (destSp.visible) {
      c.strokeStyle='#22ff22'; c.lineWidth=2;
      c.beginPath(); c.arc(destSp.x, destSp.y, 12, 0, Math.PI*2); c.stroke();
      c.fillStyle='#22ff22'; c.font='bold 10px monospace'; c.textAlign='center';
      c.fillText('DEST', destSp.x, destSp.y - 18);
    }
  }

  // Beacon HP bar
  if (g.beacon && g.beacon.active && g.beacon.hp > 0) {
    const bc = g.beacon;
    const bsp = projectFn(camera, bc.x, bc.y, 0);
    if (bsp.visible) {
      c.fillStyle='rgba(34,211,238,0.2)'; c.fillRect(bsp.x-25,bsp.y-25,50,5);
      c.fillStyle='#22d3ee'; c.fillRect(bsp.x-25,bsp.y-25,50*Math.max(0,bc.hp/bc.maxHp),5);
      c.fillStyle='#22d3ee'; c.font='bold 10px monospace'; c.textAlign='center';
      c.fillText(`BEACON [${Math.ceil(bc.hp)}HP]`, bsp.x, bsp.y-30);
    }
  }

  // Sabotage structure HP bars
  if (g.sabotage && g.sabotage.active) {
    for (const s of g.sabotage.structures) {
      if (!s.active || s.hp <= 0) continue;
      const ssp = projectFn(camera, s.x, s.y, 0);
      if (ssp.visible) {
        c.fillStyle='rgba(249,115,22,0.2)'; c.fillRect(ssp.x-25,ssp.y-25,50,5);
        c.fillStyle='#f97316'; c.fillRect(ssp.x-25,ssp.y-25,50*Math.max(0,s.hp/s.maxHp),5);
        c.fillStyle='#f97316'; c.font='bold 10px monospace'; c.textAlign='center';
        c.fillText(`TURRET [${Math.ceil(s.hp)}HP]`, ssp.x, ssp.y-30);
      }
    }
  }

  // Effects (damage numbers, mission banner)
  for (let e of g.effects) {
    if (e.type==='dmg') {
      const sp=projectFn(camera,e.x,e.y,0); if(!sp.visible) continue;
      c.fillStyle=`rgba(57,255,20,${Math.min(1,e.life*2)})`; c.font='bold 16px monospace'; c.textAlign='center';
      c.fillText(e.text, sp.x, sp.y);
    } else if (e.type==='mission_complete') {
      c.fillStyle=`rgba(250,204,21,${Math.min(1,e.life)})`; c.font='bold 36px monospace'; c.textAlign='center';
      c.fillText(e.text, w/2, h/3+Math.sin(e.life*Math.PI)*10);
    }
  }

  // ── Tactical Radar ───────────────────────────────────────────────────────────
  const rR=90, rX=w-rR-20, rY=h-rR-20, rRange=1500;
  c.save();
  c.beginPath(); c.arc(rX,rY,rR,0,Math.PI*2); c.fillStyle='rgba(0,8,0,0.82)'; c.fill();
  c.lineWidth=2; c.strokeStyle='#39ff14'; c.stroke();
  c.beginPath(); c.arc(rX,rY,rR-1,0,Math.PI*2); c.clip();

  [0.33,0.66,1.0].forEach(f=>{ c.beginPath(); c.arc(rX,rY,rR*f,0,Math.PI*2); c.strokeStyle='rgba(57,255,20,0.15)'; c.lineWidth=1; c.stroke(); });
  c.strokeStyle='rgba(57,255,20,0.12)'; c.lineWidth=1;
  c.beginPath(); c.moveTo(rX-rR,rY); c.lineTo(rX+rR,rY); c.stroke();
  c.beginPath(); c.moveTo(rX,rY-rR); c.lineTo(rX,rY+rR); c.stroke();

  radarAngle=(radarAngle+1.2*(Math.PI/180))%(Math.PI*2);
  const sw=radarAngle;
  for(let t=0;t<12;t++){ const a=sw-(t/12)*(Math.PI/2); c.beginPath(); c.moveTo(rX,rY); c.lineTo(rX+Math.cos(a)*rR,rY+Math.sin(a)*rR); c.strokeStyle=`rgba(57,255,20,${0.25-t*0.02})`; c.lineWidth=1.5; c.stroke(); }
  c.beginPath(); c.moveTo(rX,rY); c.lineTo(rX+Math.cos(sw)*rR,rY+Math.sin(sw)*rR); c.strokeStyle='rgba(57,255,20,0.95)'; c.lineWidth=1.5; c.stroke();

  const pYaw=g.player.yaw||0, rRot=Math.PI/2-pYaw;
  const toR=(wx,wy)=>{ const dx=wx-g.player.x, dy=wy-g.player.y; return { px:rX+(dx*Math.cos(rRot)-dy*Math.sin(rRot))/rRange*rR, py:rY-(dx*Math.sin(rRot)+dy*Math.cos(rRot))/rRange*rR }; };

  for (let e of g.enemies) {
    if (!e.active||Math.hypot(e.x-g.player.x,e.y-g.player.y)>rRange) continue;
    const{px,py}=toR(e.x,e.y);
    let bc='#ef4444'; if(e.type==='shielded')bc='#3b82f6'; else if(e.type==='shooter')bc='#a855f7'; else if(e.type==='missile_boat')bc='#d946ef'; else if(e.type==='heavy')bc='#f97316'; else if(e.type==='interceptor')bc='#eab308';
    c.beginPath(); c.arc(px,py,e.type==='heavy'?3.5:2.5,0,Math.PI*2); c.fillStyle=bc; c.fill();
  }
  for (let p of g.pickups) {
    if (!p.active||Math.hypot(p.x-g.player.x,p.y-g.player.y)>rRange) continue;
    const{px,py}=toR(p.x,p.y); c.fillStyle='#facc15'; c.beginPath(); c.moveTo(px,py-4); c.lineTo(px+3,py); c.lineTo(px,py+4); c.lineTo(px-3,py); c.closePath(); c.fill();
  }

  // Escort drone on radar
  if (g.escort.active && g.escort.hp > 0 && g.escort.respawnTimer <= 0) {
    const esc = g.escort;
    const ed = Math.hypot(esc.x-g.player.x, esc.y-g.player.y);
    if (ed <= rRange) {
      const {px,py} = toR(esc.x, esc.y);
      c.fillStyle='#22d3ee'; c.beginPath(); c.arc(px,py,4,0,Math.PI*2); c.fill();
      c.strokeStyle='#22d3ee'; c.lineWidth=1; c.stroke();
    }
  }

  // Escort destination on radar
  if (g.escort.active && g.escort.hp > 0) {
    const destD = Math.hypot(g.escort.targetX-g.player.x, g.escort.targetY-g.player.y);
    if (destD <= rRange) {
      const {px,py} = toR(g.escort.targetX, g.escort.targetY);
      c.strokeStyle='#22ff22'; c.lineWidth=1; c.beginPath(); c.arc(px,py,5,0,Math.PI*2); c.stroke();
    }
  }

  // Beacon on radar
  if (g.beacon && g.beacon.active && g.beacon.hp > 0) {
    const bc = g.beacon;
    const bd = Math.hypot(bc.x-g.player.x, bc.y-g.player.y);
    if (bd <= rRange) {
      const {px,py} = toR(bc.x, bc.y);
      c.fillStyle='#22d3ee'; c.beginPath();
      c.moveTo(px,py-5); c.lineTo(px+4,py); c.lineTo(px,py+5); c.lineTo(px-4,py);
      c.closePath(); c.fill();
    }
  }

  // Sabotage structures on radar
  if (g.sabotage && g.sabotage.active) {
    for (const s of g.sabotage.structures) {
      if (!s.active || s.hp <= 0) continue;
      const sd = Math.hypot(s.x-g.player.x, s.y-g.player.y);
      if (sd <= rRange) {
        const {px,py} = toR(s.x, s.y);
        c.fillStyle='#f97316';
        c.fillRect(px-3, py-3, 6, 6);
      }
    }
  }

  c.beginPath(); c.moveTo(rX,rY-18); c.lineTo(rX-8,rY+6); c.lineTo(rX,rY+2); c.lineTo(rX+8,rY+6); c.closePath(); c.fillStyle='#ffffff'; c.fill();
  c.font='bold 9px monospace'; c.fillStyle='rgba(57,255,20,0.7)'; c.textAlign='center'; c.fillText('FWD',rX,rY-rR+11);
  const nA=-(Math.PI/2-pYaw)-Math.PI/2; c.fillStyle='#ef4444'; c.font='bold 9px monospace'; c.textAlign='center'; c.fillText('N',rX+Math.cos(nA)*(rR-6),rY+Math.sin(nA)*(rR-6)+4);
  c.font='bold 9px monospace'; c.fillStyle='rgba(57,255,20,0.5)'; c.textAlign='center'; c.fillText('TACTICAL',rX,rY+rR+14);
  c.restore();
};
