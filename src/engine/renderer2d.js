/**
 * renderer2d.js — 2D HUD overlay rendering on canvas.
 * No React imports. No Three.js scene logic.
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import { getHostileTargets } from './targeting';

// Radar sweep angle persists across frames
let radarAngle = 0;

// Module-level radar coordinate transform (hoisted — avoids per-frame function creation)
const toRTransform = (wx, wy, pX, pY, rX, rY, rRange, rR, rRot) => {
  const dx = wx - pX, dy = wy - pY;
  return { px: rX + (dx * Math.cos(rRot) - dy * Math.sin(rRot)) / rRange * rR,
           py: rY - (dx * Math.sin(rRot) + dy * Math.cos(rRot)) / rRange * rR };
};

// FPS tracking
let fpsFrames = 0;
let fpsLastTime = 0;
let fpsValue = 60;

// Canvas size tracking — avoid per-frame resize when dimensions unchanged
let lastCanvasW = 0;
let lastCanvasH = 0;

// Module reset detection — reset state when a new game starts (totalTime goes to 0)
let prevTotalTime = -1;

// ── Mute button layout constants ──────────────────────────────────────────────
export const MUTE_BTN_X_OFFSET = 20;   // px from right edge
export const MUTE_BTN_Y        = 68;   // px from top (below the 60px top bar)
export const MUTE_BTN_SIZE     = 40;   // button is a square

/**
 * Draw the 2D HUD overlay on the canvas element.
 * @param {THREE.PerspectiveCamera} camera — Three.js camera for world-to-screen projection
 * @param {object} g — Game state
 * @param {HTMLCanvasElement} canvasEl — 2D canvas element
 * @param {object} statusRef — Ref holding current gameState string
 * @param {function} projectFn — projectToScreen function from renderer3d
 */
export const draw2DFrame = (camera, g, canvasEl, statusRef, projectFn) => {
  if (!canvasEl || (statusRef.current !== 'playing' && statusRef.current !== 'shop' && statusRef.current !== 'dev')) return;
  const w = window.innerWidth, h = window.innerHeight;
  // Only resize canvas when dimensions actually change (avoids context reset)
  if (w !== lastCanvasW || h !== lastCanvasH) {
    canvasEl.width = w;
    canvasEl.height = h;
    lastCanvasW = w;
    lastCanvasH = h;
  }
  // Cache 2D context — only recreate on resize
  if (!canvasEl._ctx) canvasEl._ctx = canvasEl.getContext('2d');
  const c = canvasEl._ctx;
  c.clearRect(0, 0, w, h);

  // Reset module-level state when a new game starts (totalTime goes to 0)
  if (prevTotalTime > 0 && g.totalTime <= 0) {
    radarAngle = 0;
    fpsFrames = 0;
    fpsLastTime = 0;
    fpsValue = 60;
  }
  prevTotalTime = g.totalTime;

  const C = GAME_CONFIG;

  // ── FPS tracking ─────────────────────────────────────────────────────────────
  fpsFrames++;
  const now = performance.now();
  if (fpsLastTime === 0) fpsLastTime = now; // lazy init on first frame
  const elapsed = now - fpsLastTime;
  if (elapsed >= 1000) {
    // Reset frame count if gap is too large (tab was hidden) to avoid artifact
    if (elapsed > 2000) { fpsFrames = 0; fpsLastTime = now; }
    else {
      const cappedElapsed = Math.min(elapsed, 5000);
      fpsValue = Math.round(fpsFrames * 1000 / cappedElapsed);
      fpsFrames = 0;
      fpsLastTime = now;
    }
  }

  // Top bar
  c.fillStyle='rgba(0,0,0,0.4)'; c.fillRect(0,0,w,60);
  c.fillStyle='#ef4444'; c.fillRect(20,15,200,12);
  c.fillStyle='#22c55e'; c.fillRect(20,15,200*Math.max(0,g.player.hp/g.player.maxHp),12);
  if (g.player.maxShield>0) { c.fillStyle='rgba(255,255,255,0.2)'; c.fillRect(20,32,200,6); c.fillStyle='#3b82f6'; c.fillRect(20,32,200*Math.max(0,g.player.shield/g.player.maxShield),6); }
  c.fillStyle='#ffffff'; c.font='bold 12px sans-serif'; c.textAlign='left';
  c.fillText(`HULL: ${Math.ceil(g.player.hp)} / ${g.player.maxHp}`, 230, 25);
  c.fillStyle='#facc15'; c.font='bold 24px monospace'; c.textAlign='right';
  c.fillText(`SCRAP: ${g.scrap}`, w-20, 35);

  // Combo counter
  if (g.combo && g.combo.count > 0) {
    const comboColors = { 1: '#ffffff', 1.5: '#fbbf24', 2: '#f97316', 3: '#ef4444' }
    const comboColor = comboColors[g.combo.multiplier] || '#ffffff'
    c.fillStyle = comboColor
    c.font = 'bold 24px monospace'
    c.textAlign = 'center'
    c.fillText(`${g.combo.count}x COMBO`, w / 2, 60)
    // Timer bar
    const barWidth = 120
    const barHeight = 6
    const timerRatio = g.combo.timer / GAME_CONFIG.combo.timerDuration
    c.fillStyle = 'rgba(255,255,255,0.3)'
    c.fillRect(w / 2 - barWidth / 2, 68, barWidth, barHeight)
    c.fillStyle = comboColor
    c.fillRect(w / 2 - barWidth / 2, 68, barWidth * timerRatio, barHeight)
  }

  // Active buff indicators
  let warnY = 85;
  if (g.activeBuffs) {
    for (const [type, buff] of Object.entries(g.activeBuffs)) {
      if (buff.timer > 0) {
        const cfg = C.powerups?.types?.[type];
        if (cfg) {
          c.fillStyle = cfg.color;
          c.font = 'bold 11px monospace';
          c.textAlign = 'left';
          c.fillText(`${cfg.icon} ${type.toUpperCase()} ${Math.ceil(buff.timer)}s`, 20, warnY);
          warnY += 16;
        }
      }
    }
  }

  // Hazard warning indicators
  if (g.hazards && g.hazards.length > 0) {
    for (const h of g.hazards) {
      if (!h || !h.active) continue;
      const pdist = Math.hypot(g.player.x - h.x, g.player.y - h.y);
      let warnText = null;
      let warnColor = '#ffffff';
      if (h.type === 'plasmaStorm') {
        if (h.respawning) {
          warnText = `⚡ STORM RETURNING ${Math.ceil(h.respawnTimer)}s`;
          warnColor = '#a855f7';
        } else if (pdist < h.radius) {
          warnText = '⚡ PLASMA STORM';
          warnColor = '#a855f7';
        } else if (pdist < h.radius * 3) {
          warnText = `⚡ STORM APPROACHING`;
          warnColor = 'rgba(168,85,247,0.7)';
        }
      } else if (h.type === 'emp') {
        if (h.empActive && pdist < h.radius) {
          warnText = `⚡ EMP — Weapons disabled`;
          warnColor = '#eab308';
        } else if (pdist < h.radius && !h.empActive && h.timer > 0) {
          warnText = `⚡ EMP CHARGING ${Math.ceil(h.timer)}s`;
          warnColor = 'rgba(234,179,8,0.7)';
        }
      } else if (h.type === 'gravityWell' && pdist < h.radius * 0.5) {
        warnText = '⚡ GRAVITY WELL';
        warnColor = '#7c3aed';
      }
      if (warnText) {
        c.fillStyle = warnColor;
        c.font = 'bold 11px monospace';
        c.textAlign = 'left';
        c.fillText(warnText, 20, warnY);
        warnY += 16;
      }
    }
  }

  // Dev mode badge
  if (g.devMode) {
    c.fillStyle='rgba(251,146,60,0.8)'; c.font='bold 11px monospace'; c.textAlign='right';
    c.fillText('DEV MODE [`]', w-20, 55);
  }

  c.fillStyle='#ffffff'; c.font='bold 20px monospace'; c.textAlign='center';
  c.fillText(`TIME: ${Math.floor(g.totalTime/60)}:${Math.floor(g.totalTime%60).toString().padStart(2,'0')}`, w/2, 50);

  // Mission bar
  if (g.mission) {
    const mBarW=300, mProg=g.mission.target>0?Math.max(0,Math.min(1,g.mission.current/g.mission.target)):0;
    c.fillStyle='rgba(0,0,0,0.5)'; c.fillRect(w/2-mBarW/2,10,mBarW,10);
    c.fillStyle='#39ff14'; c.fillRect(w/2-mBarW/2,10,mBarW*mProg,10);
    c.fillStyle='#fff'; c.font='bold 16px sans-serif'; c.textAlign='center';
    // Cache mission text — only rebuild when current/target/type change
    const mKey = `${g.mission.type}:${Math.floor(g.mission.current)}:${g.mission.target}`;
    if (g._missionTxtKey !== mKey) {
      g._missionTxt = g.mission.type==='survive'
        ? `LEVEL ${g.level}: ${g.mission.title} [${Math.floor(g.mission.current)}s / ${g.mission.target}s]`
        : g.mission.type==='escort'
        ? `LEVEL ${g.level}: ${g.mission.title} [${Math.floor(g.mission.current)}m / ${g.mission.target}m]`
        : g.mission.type==='defend'
        ? `LEVEL ${g.level}: ${g.mission.title} [${Math.floor(g.mission.current)}s / ${g.mission.target}s]`
        : g.mission.type==='sabotage'
        ? `LEVEL ${g.level}: ${g.mission.title} [${g.mission.current} / ${g.mission.target}]`
        : `LEVEL ${g.level}: ${g.mission.title} [${Math.floor(g.mission.current)} / ${g.mission.target}]`;
      g._missionTxtKey = mKey;
    }
    c.fillText(g._missionTxt, w/2, 18);
  }

  // ── Mute toggle button (top-right, below top bar) ──────────────────────────
  const muted = g.audio?.muted ?? false;
  const btnX = w - MUTE_BTN_X_OFFSET - MUTE_BTN_SIZE;
  const btnY = MUTE_BTN_Y;
  const btnCX = btnX + MUTE_BTN_SIZE / 2;
  const btnCY = btnY + MUTE_BTN_SIZE / 2;

  // Button background
  c.fillStyle = muted ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.12)';
  c.strokeStyle = muted ? '#ef4444' : 'rgba(255,255,255,0.5)';
  c.lineWidth = 2;
  c.beginPath();
  if (c.roundRect) {
    c.roundRect(btnX, btnY, MUTE_BTN_SIZE, MUTE_BTN_SIZE, 6);
  } else {
    c.rect(btnX, btnY, MUTE_BTN_SIZE, MUTE_BTN_SIZE);
  }
  c.fill(); c.stroke();

  // Speaker icon (triangle body + curved horn)
  c.fillStyle = muted ? '#ef4444' : '#ffffff';
  // Speaker body (left triangle)
  c.beginPath();
  c.moveTo(btnCX - 8, btnCY - 5);
  c.lineTo(btnCX - 8, btnCY + 5);
  c.lineTo(btnCX - 2, btnCY + 8);
  c.lineTo(btnCX - 2, btnCY - 8);
  c.closePath();
  c.fill();
  // Speaker cone
  c.beginPath();
  c.moveTo(btnCX - 2, btnCY - 4);
  c.lineTo(btnCX - 2, btnCY + 4);
  c.lineTo(btnCX + 3, btnCY + 7);
  c.lineTo(btnCX + 3, btnCY - 7);
  c.closePath();
  c.fill();
  // Sound waves (right arcs)
  c.lineWidth = 2;
  c.strokeStyle = muted ? '#ef4444' : '#ffffff';
  c.beginPath();
  c.arc(btnCX + 3, btnCY, 5, -0.6, 0.6);
  c.stroke();
  c.beginPath();
  c.arc(btnCX + 3, btnCY, 9, -0.45, 0.45);
  c.stroke();

  // Muted state: draw X through the icon
  if (muted) {
    c.strokeStyle = '#ef4444';
    c.lineWidth = 3;
    const xOff = 7;
    c.beginPath();
    c.moveTo(btnCX - xOff, btnCY - xOff);
    c.lineTo(btnCX + xOff, btnCY + xOff);
    c.stroke();
    c.beginPath();
    c.moveTo(btnCX + xOff, btnCY - xOff);
    c.lineTo(btnCX - xOff, btnCY + xOff);
    c.stroke();
  }

  // Mute label
  c.fillStyle = muted ? '#ef4444' : 'rgba(255,255,255,0.6)';
  c.font = 'bold 9px monospace';
  c.textAlign = 'center';
  c.fillText(muted ? 'MUTED' : 'AUDIO', btnCX, btnY + MUTE_BTN_SIZE + 12);

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
    c.fillStyle='rgba(239,68,68,0.2)'; c.fillRect(sp.x-20,sp.y-20,40,4);
    c.fillStyle='#ef4444'; c.fillRect(sp.x-20,sp.y-20,40*Math.max(0,e.hp/e.maxHp),4);
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

  // Boss HP bar (full width, below top bar)
  if (g.boss && g.boss.active && g.boss.hp > 0) {
    const boss = g.boss;
    const barW = 400;
    const barH = 16;
    const barX = w / 2 - barW / 2;
    const barY = 75;

    // Background
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);

    // HP bar
    c.fillStyle = '#7f1d1d';
    c.fillRect(barX, barY, barW, barH);
    c.fillStyle = '#dc2626';
    c.fillRect(barX, barY, barW * Math.max(0, boss.hp / boss.maxHp), barH);

    // Phase indicator
    c.fillStyle = '#ffffff';
    c.font = 'bold 12px monospace';
    c.textAlign = 'center';
    c.fillText(`${boss.name || 'BOSS'} [${Math.ceil(boss.hp)}HP] PHASE ${boss.phase}`, w / 2, barY + barH + 14);
  }

  // Mini-boss HP bar (below boss bar, orange theme)
  if (g.miniboss && g.miniboss.active && g.miniboss.hp > 0) {
    const mb = g.miniboss;
    const barW = 350;
    const barH = 14;
    const barX = w / 2 - barW / 2;
    const barY = g.boss && g.boss.active && g.boss.hp > 0 ? 105 : 75;

    // Background
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);

    // HP bar
    c.fillStyle = '#7c2d12';
    c.fillRect(barX, barY, barW, barH);
    c.fillStyle = '#f97316';
    c.fillRect(barX, barY, barW * Math.max(0, mb.hp / mb.maxHp), barH);

    // Label
    c.fillStyle = '#fdba74';
    c.font = 'bold 11px monospace';
    c.textAlign = 'center';
    c.fillText(`${mb.name || 'MINI-BOSS'} [${Math.ceil(mb.hp)}HP] PHASE ${mb.phase}`, w / 2, barY + barH + 13);
  }

  // Effects (damage numbers, mission banner)
  for (let e of g.effects) {
    if (e.type==='dmg') {
      const sp=projectFn(camera,e.x,e.y,0); if(!sp.visible) continue;

      const dnC = GAME_CONFIG.damageNumbers;
      const color = e.color || dnC.hullColor;
      const fontSizeMult = e.fontSizeMult || 1;
      const baseSize = dnC.baseFontSize;
      const fontSize = Math.round(baseSize * fontSizeMult);

      // Pop animation: start small, peak at popScale, settle to 1x
      let displayScale = 1;
      if (e.popTimer !== undefined && e.popTimer > 0) {
        const popProgress = Math.min(e.popTimer / dnC.popDuration, 1);
        if (popProgress < 0.5) {
          // Ramp up: 0.5 → popScale
          const t = popProgress / 0.5;
          displayScale = 0.5 + (dnC.popScale - 0.5) * t;
        } else {
          // Ramp down: popScale → 1
          const t = (popProgress - 0.5) / 0.5;
          displayScale = dnC.popScale - (dnC.popScale - 1) * t;
        }
      }

      // Fade alpha based on life
      const alpha = Math.min(1, (e.life / (e.maxLife || dnC.lifetime)) * 2);

      c.save();
      c.globalAlpha = alpha;
      c.fillStyle = color;
      c.font = `bold ${Math.round(fontSize * displayScale)}px monospace`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';

      // Text shadow for readability
      c.shadowColor = 'rgba(0,0,0,0.7)';
      c.shadowBlur = 3;
      c.fillText(e.text, sp.x, sp.y);
      c.restore();
    } else if (e.type==='shield_down') {
      const sp=projectFn(camera,e.x,e.y,0); if(!sp.visible) continue;
      const alpha = Math.min(1, e.life * 1.5);
      c.fillStyle = e.color || '#60a5fa';
      c.globalAlpha = alpha;
      c.font = 'bold 20px monospace';
      c.textAlign = 'center';
      c.fillText(e.text, sp.x, sp.y - 25);
      c.globalAlpha = 1;
    } else if (e.type==='mission_complete') {
      c.fillStyle=`rgba(250,204,21,${Math.min(1,e.life)})`; c.font='bold 36px monospace'; c.textAlign='center';
      c.fillText(e.text, w/2, h/3+Math.sin(e.life*Math.PI)*10);
    } else if (e.type==='boss_intro') {
      const alpha = Math.min(1, e.life);
      if (e.big) {
        c.fillStyle = `rgba(255,80,80,${alpha})`;
        c.font = 'bold 48px monospace';
        c.textAlign = 'center';
        c.fillText(e.text, w / 2, h / 3);
      } else {
        c.fillStyle = `rgba(255,255,255,${alpha * 0.8})`;
        c.font = 'bold 20px monospace';
        c.textAlign = 'center';
        c.fillText(e.text, w / 2, h / 3 - 40);
      }
    }
  }

  // ── Wave Announcement ────────────────────────────────────────────────────────
  if (g.waveAnnounce && g.waveAnnounce.active && GAME_CONFIG.waveAnnouncer) {
    const announce = g.waveAnnounce;
    const duration = GAME_CONFIG.waveAnnouncer.announcementDuration;
    const progress = 1 - (announce.timer / duration); // 0 at start, 1 at end
    // Fade in quickly, hold, fade out at end
    let alpha = 1;
    if (progress < 0.15) alpha = progress / 0.15;
    else if (progress > 0.85) alpha = (1 - progress) / 0.15;
    alpha = Math.max(0, Math.min(1, alpha));

    const waveText = `WAVE ${announce.wave}`;
    const fontSize = 72;

    // Text shadow for glow effect
    c.save();
    c.font = `bold ${fontSize}px monospace`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';

    // Outer glow
    c.shadowColor = '#ef4444';
    c.shadowBlur = 30;
    c.fillStyle = `rgba(239,68,68,${alpha * 0.6})`;
    c.fillText(waveText, w / 2, h / 2 - 20);

    // Main text
    c.shadowBlur = 15;
    c.shadowColor = '#ffffff';
    c.fillStyle = `rgba(255,255,255,${alpha})`;
    c.fillText(waveText, w / 2, h / 2 - 20);

    // Countdown indicator
    const remaining = Math.ceil(announce.timer);
    if (remaining > 0) {
      const countdownSize = 36;
      c.font = `bold ${countdownSize}px monospace`;
      c.shadowBlur = 10;
      c.shadowColor = '#facc15';
      c.fillStyle = `rgba(250,204,21,${alpha * 0.8})`;
      c.fillText(`${remaining}`, w / 2, h / 2 + 30);
    }

    // Formation name subtitle
    if (announce.formationName) {
      const formSize = 24;
      c.font = `bold ${formSize}px monospace`;
      c.shadowBlur = 8;
      c.shadowColor = '#a855f7';
      c.fillStyle = `rgba(168,85,247,${alpha * 0.9})`;
      c.fillText(announce.formationName, w / 2, h / 2 + 65);
    }

    c.restore();
  }

  // ── Attack Warning Indicators (telegraphing) ─────────────────────────────
  const pulseFreq = GAME_CONFIG.attackWarning.pulseFrequency;
  if (g.attackWarnings) {
    for (const aw of g.attackWarnings) {
      if (!aw.active) continue;
      const sp = projectFn(camera, aw.x, aw.y, 0);
      if (!sp.visible) continue;

      const lifeRatio = aw.maxLife > 0 ? aw.life / aw.maxLife : 0;
      // Pulse: faster as time runs out (urgency)
      const pulse = Math.sin(g.totalTime * pulseFreq * Math.PI * 2);
      const urgency = 1 - lifeRatio; // 0 at start, 1 at fire
      const alpha = 0.4 + 0.6 * (0.5 + 0.5 * pulse) * (0.5 + 0.5 * urgency);

      // Outer ring (pulsing)
      c.strokeStyle = `rgba(239,68,68,${alpha})`;
      c.lineWidth = 2 + urgency * 2;
      c.beginPath();
      c.arc(sp.x, sp.y, aw.radius, 0, Math.PI * 2);
      c.stroke();

      // Inner fill (fades in as fire approaches)
      c.fillStyle = `rgba(239,68,68,${alpha * 0.15 * urgency})`;
      c.beginPath();
      c.arc(sp.x, sp.y, aw.radius, 0, Math.PI * 2);
      c.fill();

      // Crosshair marks
      const crossLen = 8;
      c.strokeStyle = `rgba(239,68,68,${alpha * 0.7})`;
      c.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        c.beginPath();
        c.moveTo(sp.x + Math.cos(a) * (aw.radius - crossLen), sp.y + Math.sin(a) * (aw.radius - crossLen));
        c.lineTo(sp.x + Math.cos(a) * (aw.radius + crossLen), sp.y + Math.sin(a) * (aw.radius + crossLen));
        c.stroke();
      }

      // Center dot (blinks faster as fire approaches)
      if (Math.sin(g.totalTime * pulseFreq * 3 * Math.PI * 2) > 0) {
        c.fillStyle = `rgba(239,68,68,${alpha * 0.8})`;
        c.beginPath();
        c.arc(sp.x, sp.y, 3, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  // ── Tactical Radar ───────────────────────────────────────────────────────────
  const rR=90, rX=w-rR-20, rY=h-rR-20, rRange=1500;
  c.save();
  c.beginPath(); c.arc(rX,rY,rR,0,Math.PI*2); c.fillStyle='rgba(0,8,0,0.82)'; c.fill();
  c.lineWidth=2; c.strokeStyle='#39ff14'; c.stroke();
  c.beginPath(); c.arc(rX,rY,rR-1,0,Math.PI*2); c.clip();

  // Range rings with distance labels
  [0.33,0.66,1.0].forEach((f)=>{
    c.beginPath(); c.arc(rX,rY,rR*f,0,Math.PI*2); c.strokeStyle='rgba(57,255,20,0.15)'; c.lineWidth=1; c.stroke();
    // Distance label
    const dist = Math.round(rRange * f / 10) / 10;
    c.fillStyle='rgba(57,255,20,0.3)'; c.font='8px monospace'; c.textAlign='left';
    c.fillText(`${dist}k`, rX + rR * f + 2, rY - 4);
  });
  c.strokeStyle='rgba(57,255,20,0.12)'; c.lineWidth=1;
  c.beginPath(); c.moveTo(rX-rR,rY); c.lineTo(rX+rR,rY); c.stroke();
  c.beginPath(); c.moveTo(rX,rY-rR); c.lineTo(rX,rY+rR); c.stroke();

  radarAngle=(radarAngle+1.2*(Math.PI/180))%(Math.PI*2);
  const sw=radarAngle;
  for(let t=0;t<12;t++){ const a=sw-(t/12)*(Math.PI/2); c.beginPath(); c.moveTo(rX,rY); c.lineTo(rX+Math.cos(a)*rR,rY+Math.sin(a)*rR); c.strokeStyle=`rgba(57,255,20,${0.25-t*0.02})`; c.lineWidth=1.5; c.stroke(); }
  c.beginPath(); c.moveTo(rX,rY); c.lineTo(rX+Math.cos(sw)*rR,rY+Math.sin(sw)*rR); c.strokeStyle='rgba(57,255,20,0.95)'; c.lineWidth=1.5; c.stroke();

  const pYaw=g.player.yaw||0, rRot=Math.PI/2-pYaw;
  const toR = (wx, wy) => toRTransform(wx, wy, g.player.x, g.player.y, rX, rY, rRange, rR, rRot);

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

  // Power-ups on radar
  if (g.powerups) {
    for (const pu of g.powerups) {
      if (!pu.active || Math.hypot(pu.x - g.player.x, pu.y - g.player.y) > rRange) continue;
      const {px, py} = toR(pu.x, pu.y);
      c.fillStyle = pu.color || '#fbbf24';
      c.beginPath(); c.arc(px, py, 3, 0, Math.PI * 2); c.fill();
    }
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

  // Environmental hazards on radar
  if (g.hazards && g.hazards.length > 0) {
    for (const h of g.hazards) {
      if (!h || !h.active) continue;
      const hd = Math.hypot(h.x - g.player.x, h.y - g.player.y);
      if (hd > rRange) continue;
      const {px, py} = toR(h.x, h.y);
      if (h.type === 'asteroid') {
        c.fillStyle = '#6b7280';
        c.beginPath(); c.arc(px, py, 2, 0, Math.PI * 2); c.fill();
      } else if (h.type === 'gravityWell') {
        c.strokeStyle = '#7c3aed';
        c.lineWidth = 1;
        c.beginPath(); c.arc(px, py, 6, 0, Math.PI * 2); c.stroke();
        c.fillStyle = '#7c3aed';
        c.beginPath(); c.arc(px, py, 2, 0, Math.PI * 2); c.fill();
      } else if (h.type === 'plasmaStorm') {
        c.fillStyle = 'rgba(168,85,247,0.3)';
        c.beginPath(); c.arc(px, py, 12, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#c084fc';
        c.lineWidth = 1;
        c.beginPath(); c.arc(px, py, 12, 0, Math.PI * 2); c.stroke();
      } else if (h.type === 'emp') {
        c.strokeStyle = h.empActive ? '#eab308' : 'rgba(234,179,8,0.5)';
        c.lineWidth = h.empActive ? 2 : 1;
        // Draw hexagon
        c.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const hx = px + Math.cos(a) * 5;
          const hy = py + Math.sin(a) * 5;
          if (i === 0) c.moveTo(hx, hy); else c.lineTo(hx, hy);
        }
        c.closePath(); c.stroke();
      }
    }
  }

  // Death pulse shockwave rings on radar
  if (g.deathPulses) {
    for (const pulse of g.deathPulses) {
      if (!pulse.active) continue;
      const pd = Math.hypot(pulse.x - g.player.x, pulse.y - g.player.y);
      if (pd > rRange) continue;
      const {px, py} = toR(pulse.x, pulse.y);
      const lifeRatio = pulse.maxLife ? pulse.life / pulse.maxLife : 0;
      const radarRadius = (pulse.radius / rRange) * rR;
      c.strokeStyle = `rgba(249,115,22,${Math.max(0.1, lifeRatio * 0.7)})`;
      c.lineWidth = 1.5;
      c.beginPath(); c.arc(px, py, Math.max(2, radarRadius), 0, Math.PI * 2); c.stroke();
    }
  }

  // Attack warning indicators on radar
  if (g.attackWarnings) {
    for (const aw of g.attackWarnings) {
      if (!aw.active) continue;
      const awd = Math.hypot(aw.x - g.player.x, aw.y - g.player.y);
      if (awd > rRange) continue;
      const {px, py} = toR(aw.x, aw.y);
      const lifeRatio = aw.maxLife > 0 ? aw.life / aw.maxLife : 0;
      const urgency = 1 - lifeRatio;
      const alpha = 0.5 + 0.5 * urgency;
      c.strokeStyle = `rgba(239,68,68,${alpha})`;
      c.lineWidth = 1.5;
      c.beginPath(); c.arc(px, py, 4 + urgency * 2, 0, Math.PI * 2); c.stroke();
      // Center dot
      c.fillStyle = `rgba(239,68,68,${alpha * 0.8})`;
      c.beginPath(); c.arc(px, py, 2, 0, Math.PI * 2); c.fill();
    }
  }

  // Mission objective marker (for kill/collect missions, shows nearest enemy direction)
  if (g.mission && !g.mission.completed && (g.mission.type === 'kill' || g.mission.type === 'collect')) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const e of getHostileTargets(g)) {
      const d = Math.hypot(e.x - g.player.x, e.y - g.player.y);
      if (d < nearestDist) { nearestDist = d; nearest = e; }
    }
    if (nearest && nearestDist <= rRange * 2) {
      const {px, py} = toR(nearest.x, nearest.y);
      // Only draw if within extended range
      const markerDist = Math.hypot(px - rX, py - rY);
      if (markerDist <= rR * 1.5) {
        c.strokeStyle='#39ff14'; c.lineWidth=2;
        c.beginPath(); c.arc(px, py, 6, 0, Math.PI * 2); c.stroke();
        c.fillStyle='#39ff14'; c.font='bold 8px monospace'; c.textAlign='center';
        c.fillText('OBJ', px, py - 10);
      }
    }
  }

  c.beginPath(); c.moveTo(rX,rY-18); c.lineTo(rX-8,rY+6); c.lineTo(rX,rY+2); c.lineTo(rX+8,rY+6); c.closePath(); c.fillStyle='#ffffff'; c.fill();
  c.font='bold 9px monospace'; c.fillStyle='rgba(57,255,20,0.7)'; c.textAlign='center'; c.fillText('FWD',rX,rY-rR+11);
  const nA=-(Math.PI/2-pYaw)-Math.PI/2; c.fillStyle='#ef4444'; c.font='bold 9px monospace'; c.textAlign='center'; c.fillText('N',rX+Math.cos(nA)*(rR-6),rY+Math.sin(nA)*(rR-6)+4);
  c.font='bold 9px monospace'; c.fillStyle='rgba(57,255,20,0.5)'; c.textAlign='center'; c.fillText('TACTICAL',rX,rY+rR+14);
  c.restore();

  // ── Low HP Warning — Red Vignette ────────────────────────────────────────────
  if (g.lowHpWarning && g.lowHpWarning.active && g.lowHpWarning.intensity > 0) {
    const { lowHpWarning } = g;
    const C = GAME_CONFIG.lowHpWarning;

    // Pulsing: sine wave mapped to 0.5-1.0 range
    const pulsePhase = lowHpWarning.pulseTimer / C.pulsePeriod;
    const pulse = 0.5 + 0.5 * Math.sin(pulsePhase * Math.PI * 2);
    const alpha = lowHpWarning.intensity * (0.6 + 0.4 * pulse);

    // Radial gradient vignette (dark red from edges, transparent at center)
    const cx = w / 2, cy = h / 2;
    const maxDist = Math.hypot(cx, cy);
    const grad = c.createRadialGradient(cx, cy, maxDist * 0.3, cx, cy, maxDist);
    const baseAlpha = Math.min(0.7, alpha * 0.8);
    const isCrit = lowHpWarning.isCritical;
    const r = isCrit ? 180 : 120;
    const gv = isCrit ? 20 : 30;
    grad.addColorStop(0, `rgba(${r},${gv},0,0)`);
    grad.addColorStop(0.5, `rgba(${r},${gv},0,${baseAlpha * 0.3})`);
    grad.addColorStop(1, `rgba(${r},${gv},0,${baseAlpha})`);
    c.fillStyle = grad;
    c.fillRect(0, 0, w, h);

    // Pulsing border — thin red line around screen edges
    const borderAlpha = alpha * 0.5;
    c.strokeStyle = `rgba(${r},${gv},0,${borderAlpha})`;
    c.lineWidth = lowHpWarning.isCritical ? 4 : 2;
    c.strokeRect(1, 1, w - 2, h - 2);

    // "LOW HULL" warning text (only when critical)
    if (lowHpWarning.isCritical) {
      const textAlpha = alpha * 0.8;
      c.fillStyle = `rgba(239,68,68,${textAlpha})`;
      c.font = 'bold 16px monospace';
      c.textAlign = 'center';
      c.fillText('⚠ LOW HULL', w / 2, h / 2 + 40);
    }
  }

  // ── FPS display (overlay on top bar) ──────────────────────────────────────────
  const showFPS = g.settings?.showFPS ?? false;
  if (showFPS) {
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(0, 0, 80, 24);
    c.fillStyle = fpsValue >= 55 ? '#39ff14' : fpsValue >= 30 ? '#facc15' : '#ef4444';
    c.font = 'bold 14px monospace';
    c.textAlign = 'left';
    c.fillText(`${fpsValue} FPS`, 8, 16);
  }
};
