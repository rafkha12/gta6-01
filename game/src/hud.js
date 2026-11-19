// The HUD: DOM overlay (health, money, wanted stars, objective, speed,
// messages) plus a live 2D minimap canvas.
import { CITY, STREETS } from './config.js';

export class HUD {
  constructor(root) {
    this.root = root;
    this.el = {};
    const mk = (id, cls, html = '') => {
      const d = document.createElement('div');
      d.id = id; d.className = cls; d.innerHTML = html;
      root.appendChild(d);
      this.el[id] = d;
      return d;
    };
    mk('hud-money', 'hud money', '$0');
    mk('hud-health', 'hud health', '<div class="bar"><div class="fill"></div></div><span>HEALTH</span>');
    mk('hud-wanted', 'hud wanted', '');
    mk('hud-objective', 'hud objective', '');
    mk('hud-speed', 'hud speed', '');
    mk('hud-toast', 'hud toast', '');
    mk('hud-mission', 'hud mission', '');
    const map = document.createElement('canvas');
    map.id = 'hud-minimap';
    map.className = 'hud minimap';
    map.width = 220; map.height = 220;
    root.appendChild(map);
    this.map = map;
    this.mapCtx = map.getContext('2d');
    this.toastTimer = 0;
  }

  setMoney(n) { this.el['hud-money'].textContent = '$' + n.toLocaleString('en-US'); }

  setHealth(h) {
    const fill = this.el['hud-health'].querySelector('.fill');
    fill.style.width = Math.max(0, h) + '%';
    fill.style.background = h > 50 ? '#3aff7a' : h > 25 ? '#ffb02a' : '#ff3a3a';
  }

  setWanted(stars) {
    this.el['hud-wanted'].innerHTML = '★'.repeat(stars) + '<span class="dim">' + '★'.repeat(5 - stars) + '</span>';
    this.el['hud-wanted'].style.display = stars > 0 ? 'block' : 'none';
  }

  setObjective(text) {
    this.el['hud-objective'].textContent = text;
    this.el['hud-objective'].style.display = text ? 'block' : 'none';
  }

  setSpeed(kmh, inCar) {
    this.el['hud-speed'].textContent = inCar ? Math.round(kmh) + ' km/h' : '';
    this.el['hud-speed'].style.display = inCar ? 'block' : 'none';
  }

  setMissionCard(html) {
    this.el['hud-mission'].innerHTML = html;
    this.el['hud-mission'].style.display = html ? 'block' : 'none';
  }

  toast(text, seconds = 4) {
    this.el['hud-toast'].textContent = text;
    this.el['hud-toast'].style.display = 'block';
    this.toastTimer = seconds;
  }

  tickToast(dt) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el['hud-toast'].style.display = 'none';
    }
  }

  // Top-down map: streets, beach, marina, player arrow, police, mission blip.
  drawMinimap(state) {
    const g = this.mapCtx;
    const S = 220;
    const scale = S / (CITY.half * 2 + 140);
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    g.clearRect(0, 0, S, S);
    g.fillStyle = 'rgba(12, 20, 28, 0.82)';
    g.fillRect(0, 0, S, S);
    // Water + sand.
    g.fillStyle = '#1d5f7a';
    g.fillRect(0, toMap(0, CITY.half)[1], S, S);
    g.fillStyle = '#c9b078';
    const [bx, by] = toMap(-CITY.half, CITY.half);
    g.fillRect(bx, by, CITY.half * 2 * scale, (CITY.beachZ - CITY.half) * scale);
    // Streets.
    g.strokeStyle = '#5a636e';
    g.lineWidth = 5;
    for (const s of STREETS) {
      const [x0, y0] = toMap(s, -CITY.half);
      const [x1, y1] = toMap(s, CITY.half);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      const [x2, y2] = toMap(-CITY.half, s);
      const [x3, y3] = toMap(CITY.half, s);
      g.beginPath(); g.moveTo(x2, y2); g.lineTo(x3, y3); g.stroke();
    }
    // Mission blip.
    if (state.missionTarget) {
      const [mx, my] = toMap(state.missionTarget.x, state.missionTarget.z);
      const pulse = 6 + Math.sin(performance.now() / 250) * 2;
      g.fillStyle = '#ffd23a';
      g.beginPath(); g.arc(mx, my, pulse, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1a1a1a';
      g.font = 'bold 11px sans-serif';
      g.textAlign = 'center';
      g.fillText('!', mx, my + 4);
    }
    // Police blips.
    g.fillStyle = '#3a7bff';
    for (const p of state.police) {
      const [px, py] = toMap(p.x, p.z);
      g.beginPath(); g.arc(px, py, 3.5, 0, Math.PI * 2); g.fill();
    }
    // Player arrow.
    const [px, py] = toMap(state.x, state.z);
    g.save();
    g.translate(px, py);
    g.rotate(state.heading);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(8, 0); g.lineTo(-6, -5); g.lineTo(-6, 5); g.closePath();
    g.fill();
    g.restore();
    // North tick.
    g.fillStyle = '#ffffff';
    g.font = 'bold 11px sans-serif';
    g.textAlign = 'left';
    g.fillText('N', 6, 14);
  }
}
