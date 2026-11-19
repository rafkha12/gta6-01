// Bahía Sol — the game itself. Boots the renderer, owns the loop, and wires
// the city, the player, traffic, police, missions, the HUD and the sound
// together. Dario Cruz, getaway driver, one last summer of jobs.
import * as THREE from 'three';
import { CITY, STREETS, PLAYER, CAR, MISSIONS, SAVE_KEY } from './config.js';
import { mulberry32 } from './random.js';
import { City } from './city.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { Player, makePlayerMesh } from './player.js';
import { Car, makeCarMesh } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { stageShot } from './shots.js';

const HOSPITAL = { x: -200, z: 220 };
const POLICE_STATION = { x: 220, z: -200 };

export class Game {
  constructor() {
    const params = new URLSearchParams(window.location.search);
    this.seed = Number(params.get('seed') || 1);
    this.shotName = params.get('shot') || null;
    this.rng = mulberry32(this.seed);
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87bfe8);
    this.scene.fog = new THREE.Fog(0xcfe4f2, 180, 620);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    // Golden-afternoon sun.
    const sun = new THREE.DirectionalLight(0xfff2d0, 2.4);
    sun.position.set(180, 260, 120);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -320; sun.shadow.camera.right = 320;
    sun.shadow.camera.top = 320; sun.shadow.camera.bottom = -320;
    sun.shadow.camera.far = 800;
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 0.9));

    this.city = new City(this.scene, this.seed);
    this.traffic = new Traffic(this.scene, this.city, this.seed + 6);
    this.police = new Police(this.scene, this.city, this.seed + 20);
    this.audio = new AudioEngine();
    this.input = new Input(this.canvas);
    this.hud = new HUD(document.getElementById('hud'));
    this.missions = new Missions(this.scene, this.city, this);
    this.player = new Player(makePlayerMesh(), STREETS[1], STREETS[1]);
    this.scene.add(this.player.mesh);

    this.state = 'menu';
    this.mode = 'foot';
    this.playerCar = null;
    this.money = 150;
    this.policeEverWanted = false;
    this.nearCar = null;
    this.crimeCooldown = 0;
    this.damageCooldown = 0;
    this.shake = 0;
    this.cameraYaw = 0.6;
    this.cameraPitch = 0.3;
    this.camTarget = new THREE.Vector3();
    this.muzzle = null;
    this.tracer = null;
    this.sparks = [];
    this.loadGame();
    this.buildMenus();
    this.hud.setMoney(this.money);
    this.hud.setHealth(this.player.health);
    window.__game = this; // handy for debugging and play-tests

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    if (this.shotName) {
      // Screenshot mode: no menu, no pointer lock, staged scene.
      document.getElementById('menu').style.display = 'none';
      this.state = 'playing';
      this.audio.ensure();
      const label = stageShot(this, this.shotName);
      document.title = 'Bahía Sol — ' + label;
      this.hud.tickToast(0);
    }
    this.lastTime = performance.now();
    const loop = (t) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - this.lastTime) / 1000 || 0.016);
      this.lastTime = t;
      if (this.state === 'playing' && !this.shotName) this.update(dt, null);
      else if (this.state === 'playing' && this.shotName) this.update(dt, { forward: 0, strafe: 0, steer: 0, run: false, jump: false, shoot: false, punch: false });
      this.render(dt);
    };
    requestAnimationFrame(loop);
  }

  // ----- persistence -----
  saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: this.money, missionIndex: this.missions.index,
        completed: this.missions.completed,
      }));
    } catch { /* storage unavailable: the game still plays */ }
  }

  loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.money === 'number') this.money = s.money;
      if (typeof s.missionIndex === 'number') this.missions.index = Math.min(s.missionIndex, MISSIONS.length);
      if (typeof s.completed === 'number') this.missions.completed = s.completed;
    } catch { /* ignore a corrupt save */ }
  }

  clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  }

  // ----- menus -----
  buildMenus() {
    const menu = document.getElementById('menu');
    const hasSave = this.money !== 150 || this.missions.index > 0 || this.missions.completed > 0;
    menu.innerHTML = `
      <div class="panel">
        <h1>BAHÍA SOL</h1>
        <p class="tag">An open-world crime story in the sun</p>
        <p class="story">Dario Cruz came home to drive straight. Doña Maribel has other
        plans — four jobs, one summer, and the whole city watching. Steal cars,
        outrun the police, and finish what you started.</p>
        <div class="controls">WASD move &nbsp;·&nbsp; Mouse camera &nbsp;·&nbsp; SHIFT run
        &nbsp;·&nbsp; E enter / exit car &nbsp;·&nbsp; Click shoot &nbsp;·&nbsp; F punch
        &nbsp;·&nbsp; M next job &nbsp;·&nbsp; ESC pause</div>
        <button id="btn-start">${hasSave ? 'Continue' : 'Start'}</button>
        <button id="btn-new" class="ghost">New game</button>
        <p class="fine">Jobs completed: ${this.missions.completed} / ${MISSIONS.length}
        &nbsp;·&nbsp; Money: $${this.money.toLocaleString('en-US')}</p>
      </div>`;
    document.getElementById('btn-start').addEventListener('click', () => this.startGame({}));
    document.getElementById('btn-new').addEventListener('click', () => {
      this.clearSave();
      this.money = 150;
      this.missions.index = 0;
      this.missions.completed = 0;
      this.startGame({});
    });
    document.getElementById('btn-pause-resume').addEventListener('click', () => this.setPaused(false));
    document.getElementById('btn-pause-quit').addEventListener('click', () => {
      this.setPaused(false);
      this.state = 'menu';
      document.getElementById('menu').style.display = 'flex';
      this.buildMenus();
    });
    document.getElementById('btn-overlay').addEventListener('click', () => {
      document.getElementById('overlay').style.display = 'none';
      if (this.state === 'busted' || this.state === 'wasted') {
        this.respawn();
      } else if (this.state === 'complete') {
        this.state = 'playing';
      }
    });
    document.getElementById('btn-mission-accept').addEventListener('click', () => {
      document.getElementById('mission-card').style.display = 'none';
      this.missions.start();
      this.toast(`${this.missions.active.def.title} — ${this.missions.active.def.objective}`);
    });
    document.getElementById('btn-mission-decline').addEventListener('click', () => {
      document.getElementById('mission-card').style.display = 'none';
    });
    document.getElementById('btn-job').addEventListener('click', () => this.offerMission());
  }

  startGame({ silent = false } = {}) {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
    this.state = 'playing';
    this.audio.ensure();
    if (!silent) {
      this.toast('Bahía Sol. Press M for your next job.');
      if (!this.missions.active && this.missions.index === 0) this.offerMission();
    }
  }

  offerMission() {
    if (this.missions.active || this.missions.done) {
      if (this.missions.done) this.toast('All four jobs are done. Bahía Sol is yours — free roam.');
      return;
    }
    const def = this.missions.currentDef;
    const card = document.getElementById('mission-card');
    card.querySelector('.m-title').textContent = def.title;
    card.querySelector('.m-giver').textContent = 'Doña Maribel';
    card.querySelector('.m-brief').textContent = def.brief;
    card.querySelector('.m-objective').textContent = 'Objective: ' + def.objective;
    card.querySelector('.m-payout').textContent = 'Payout: $' + def.payout + '  ·  Time: ' + Math.round(def.timeLimit / 60) + ' min';
    card.style.display = 'flex';
  }

  setPaused(paused) {
    if (paused && this.state === 'playing') {
      this.state = 'paused';
      document.getElementById('pause').style.display = 'flex';
      document.exitPointerLock?.();
    } else if (!paused && this.state === 'paused') {
      this.state = 'playing';
      document.getElementById('pause').style.display = 'none';
    }
  }

  showOverlay(title, text, button) {
    const o = document.getElementById('overlay');
    o.querySelector('.o-title').textContent = title;
    o.querySelector('.o-text').textContent = text;
    document.getElementById('btn-overlay').textContent = button;
    o.style.display = 'flex';
  }

  toast(text, seconds) { this.hud.toast(text, seconds); }

  // ----- world helpers -----
  placePlayerOnFoot(x, z) {
    if (this.mode === 'car') this.exitCar(true);
    this.player.x = x; this.player.z = z; this.player.y = 0; this.player.vy = 0;
    this.player.updateMesh();
  }

  spawnPlayerCar(x, z, heading, color) {
    const mesh = makeCarMesh(color);
    this.scene.add(mesh);
    const car = new Car(mesh, x, z, heading);
    car.isPlayerOwned = true;
    return car;
  }

  registerWorldCar(car) { /* mission cars are tracked by the mission itself */ }
  unregisterWorldCar(car) { /* nothing to deregister */ }

  enterCar(car) {
    this.playerCar = car;
    this.mode = 'car';
    this.player.mesh.visible = false;
    if (car.isMissionCar) car.isMissionCar = false;
    this.audio.blip(520, 0.1);
  }

  exitCar(silent = false) {
    if (!this.playerCar) return;
    const car = this.playerCar;
    const side = 2.6;
    this.player.x = car.x + Math.sin(car.heading) * side;
    this.player.z = car.z + Math.cos(car.heading) * side;
    const fixed = this.city.collideCircle(this.player.x, this.player.z, 0.6);
    this.player.x = fixed.x; this.player.z = fixed.z;
    this.player.y = 0;
    this.player.mesh.visible = true;
    this.playerCar = null;
    this.mode = 'foot';
    if (!silent) this.audio.blip(420, 0.08);
  }

  nearestStealableCar(maxDist = 4.5) {
    let best = null; let bd = maxDist;
    const consider = (car) => {
      const d = Math.hypot(car.x - this.player.x, car.z - this.player.z);
      if (d < bd) { bd = d; best = car; }
    };
    for (const c of this.traffic.cars) consider(c);
    if (this.missions.active && this.missions.active.car) consider(this.missions.active.car);
    return best;
  }

  respawn() {
    const wasBusted = this.state === 'busted';
    this.player.health = PLAYER.health;
    this.police.clear();
    this.policeEverWanted = false;
    if (this.mode === 'car') this.exitCar(true);
    const spot = wasBusted ? POLICE_STATION : HOSPITAL;
    this.placePlayerOnFoot(spot.x, spot.z);
    this.state = 'playing';
    this.hud.setHealth(this.player.health);
    this.toast(wasBusted ? 'Busted. The cops took their cut.' : 'Patched up at Solmar General.');
  }
}

// ----- per-frame update -----
Game.prototype.update = function update(dt, override) {
  const input = override || null;
  const inp = this.input;
  if (!override) {
    if (inp.wasPressed('Escape')) { this.setPaused(true); return; }
    if (inp.wasPressed('KeyM')) this.offerMission();
    if (inp.wasPressed('KeyE')) this.toggleCar();
  }
  const mouse = inp.consumeMouse();
  if (mouse.dx || mouse.dy) {
    this.cameraYaw -= mouse.dx * 0.0032;
    this.cameraPitch = Math.max(0.08, Math.min(1.1, this.cameraPitch + mouse.dy * 0.0024));
  }
  this.crimeCooldown = Math.max(0, this.crimeCooldown - dt);
  this.damageCooldown = Math.max(0, this.damageCooldown - dt);

  const px = this.mode === 'car' ? this.playerCar.x : this.player.x;
  const pz = this.mode === 'car' ? this.playerCar.z : this.player.z;

  // --- movement ---
  if (this.mode === 'foot') {
    const f = input ? input.forward : inp.forward;
    const s = input ? input.strafe : inp.strafe;
    const run = input ? input.run : inp.run;
    const sin = Math.sin(this.cameraYaw); const cos = Math.cos(this.cameraYaw);
    const mx = (sin * f - cos * s);
    const mz = (cos * f + sin * s);
    this.player.step(mx, mz, run, dt);
    if (!override && inp.wasPressed('Space')) this.player.jump();
    const fixed = this.city.collideCircle(this.player.x, this.player.z, PLAYER.radius);
    this.player.x = fixed.x; this.player.z = fixed.z;
    this.player.updateMesh();
    if (!override && (inp.mouseDown || inp.wasPressed('KeyF'))) this.tryAttack();
    else if (override && override.shoot) this.tryAttack();
    else if (override && override.punch) this.tryPunch();
    if (!override && inp.wasPressed('KeyF')) this.tryPunch();
  } else {
    const car = this.playerCar;
    const f = input ? input.forward : inp.forward;
    const steerIn = input ? (input.steer || 0) : (inp.strafe * -1);
    const handbrake = !override && inp.keys.has('Space');
    car.drive(f, steerIn, dt);
    if (handbrake) car.speed *= (1 - 1.6 * dt);
    const fixed = this.city.collideCircle(car.x, car.z, 2.1);
    const hitBuilding = (fixed.x !== car.x || fixed.z !== car.z) && Math.abs(car.speed) > 14;
    if (fixed.x !== car.x || fixed.z !== car.z) {
      if (Math.abs(car.speed) > 6) {
        car.speed *= 0.55;
        this.shake = Math.min(0.6, Math.abs(car.speed) * 0.02 + 0.25);
        this.hurtPlayer(Math.min(14, Math.abs(car.speed) * 0.4));
        this.audio.noiseBurst(0.2, 0.3);
      }
      car.x = fixed.x; car.z = fixed.z;
      car.updateMesh();
    }
    // Running over a pedestrian is a crime.
    for (const ped of this.traffic.peds) {
      if (Math.abs(car.speed) > 5 && Math.hypot(ped.x - car.x, ped.z - car.z) < 2.2) {
        ped.panic = 4;
        if (this.crimeCooldown <= 0) {
          this.police.addStars(1, 'hit pedestrian');
          this.policeEverWanted = true;
          this.crimeCooldown = 2;
          this.toast('You hit a pedestrian! The police are coming.');
        }
      }
    }
    // Scrape traffic cars.
    for (const other of this.traffic.cars) {
      const d = Math.hypot(other.x - car.x, other.z - car.z);
      if (d < 3.4 && d > 0.01) {
        const push = (3.4 - d) / 2;
        const nx = (car.x - other.x) / d; const nz = (car.z - other.z) / d;
        car.x += nx * push; car.z += nz * push;
        other.x -= nx * push; other.z -= nz * push;
        car.speed *= 0.9;
        other.speed *= 0.9;
        car.updateMesh(); other.updateMesh();
      }
    }
  }

  // --- traffic + police ---
  const danger = {
    x: px, z: pz,
    radius: this.mode === 'car' ? 26 : 12,
    loud: this.police.stars > 0,
  };
  this.traffic.step(dt, danger);
  const result = this.police.step(dt, {
    x: px, z: pz,
    inCar: this.mode === 'car',
    car: this.playerCar,
  }, (kind) => {
    if (kind === 'ram' && this.damageCooldown <= 0) {
      this.hurtPlayer(3);
      this.shake = Math.max(this.shake, 0.3);
      this.damageCooldown = 1;
    }
  });
  if (result === 'busted') return this.getBusted();
  if (this.police.stars > 0) this.policeEverWanted = true;

  // --- missions ---
  if (this.missions.active) {
    const near = this.mode === 'car' ? this.playerCar : this.nearestStealableCar(5);
    const outcome = this.missions.step(dt, px, pz, this.mode === 'car', near);
    if (outcome === 'complete') {
      if (this.missions.done) {
        this.state = 'complete';
        this.showOverlay('The Big Score — done', 'Four jobs, one summer, and Bahía Sol is yours. Free roam, Dario.', 'Keep playing');
      } else {
        this.toast('Job complete! Press M for the next job.');
      }
    } else if (outcome === 'failed') {
      this.toast('Job failed. Press M to try again.');
    }
    const a = this.missions.active;
    if (a) {
      this.hud.setObjective(`${a.def.title} — ${a.def.objective}  ·  ${Math.max(0, Math.ceil(a.timer))}s`);
    }
  } else {
    this.hud.setObjective(this.shotObjective || (this.missions.done
      ? 'All jobs done — free roam. Explore Bahía Sol.'
      : 'Press M for your next job.'));
  }

  // --- health regen + audio + HUD ---
  if (this.police.stars === 0 && this.player.health < PLAYER.health) {
    this.player.health = Math.min(PLAYER.health, this.player.health + 2 * dt);
    this.hud.setHealth(this.player.health);
  }
  this.audio.setEngine(this.mode === 'car' ? this.playerCar.speed01 : 0, this.mode === 'car');
  this.audio.setSiren(this.police.stars > 0, this.police.sirenNear);
  this.hud.setMoney(this.money);
  this.hud.setWanted(this.police.stars);
  this.hud.setSpeed(this.mode === 'car' ? Math.abs(this.playerCar.speed) * 3.6 : 0, this.mode === 'car');
  this.hud.tickToast(dt);
  this.hud.drawMinimap({
    x: px, z: pz, heading: this.mode === 'car' ? this.playerCar.heading : this.player.heading,
    police: [...this.police.cars.map((c) => ({ x: c.x, z: c.z })), ...this.police.officers.map((o) => ({ x: o.x, z: o.z }))],
    missionTarget: this.missions.active ? this.missions.active.target : null,
  });
  this.input.endFrame();
  // Spark effects fade.
  for (let i = this.sparks.length - 1; i >= 0; i -= 1) {
    const s = this.sparks[i];
    s.life -= dt;
    s.mesh.material.opacity = Math.max(0, s.life / s.max);
    if (s.life <= 0) { this.scene.remove(s.mesh); this.sparks.splice(i, 1); }
  }
  if (this.muzzle) {
    this.muzzle.life -= dt;
    if (this.muzzle.life <= 0) { this.scene.remove(this.muzzle.light); this.muzzle = null; }
  }
  if (this.tracer) {
    this.tracer.life -= dt;
    this.tracer.mesh.material.opacity = Math.max(0, this.tracer.life / 0.12);
    if (this.tracer.life <= 0) { this.scene.remove(this.tracer.mesh); this.tracer = null; }
  }
};

Game.prototype.toggleCar = function toggleCar() {
  if (this.mode === 'car') { this.exitCar(); return; }
  const car = this.nearestStealableCar(4.5);
  if (!car) return;
  // Stealing a traffic car is a crime; the mission car is the job.
  const isTraffic = this.traffic.cars.includes(car);
  if (isTraffic) {
    const idx = this.traffic.cars.indexOf(car);
    this.traffic.cars.splice(idx, 1);
    if (this.crimeCooldown <= 0) {
      this.police.addStars(1, 'stole a car');
      this.policeEverWanted = true;
      this.crimeCooldown = 2;
      this.toast('You stole a car! Someone called the police.');
    }
    // Traffic replaces it later.
    setTimeout(() => { if (this.traffic.cars.length < 14) this.traffic.spawnCar(); }, 8000);
  }
  this.enterCar(car);
};

Game.prototype.hurtPlayer = function hurtPlayer(n) {
  if (this.damageCooldown > 0 && n < 5) return;
  this.player.health = Math.max(0, this.player.health - n);
  this.hud.setHealth(this.player.health);
  if (this.player.health <= 0) return this.getWasted();
  return null;
};

Game.prototype.getBusted = function getBusted() {
  this.state = 'busted';
  const fine = Math.min(300, this.money);
  this.money -= fine;
  this.saveGame();
  this.audio.fail();
  this.showOverlay('BUSTED', `The Bahía Sol police caught up with you. Fine: $${fine}. Your jobs wait — press M when you are back on the street.`, 'Back on the street');
  this.hud.setMoney(this.money);
};

Game.prototype.getWasted = function getWasted() {
  this.state = 'wasted';
  const bill = Math.min(200, this.money);
  this.money -= bill;
  this.saveGame();
  this.audio.fail();
  this.showOverlay('WASTED', `Solmar General patched you up. Hospital bill: $${bill}.`, 'Back on the street');
  this.hud.setMoney(this.money);
};

Game.prototype.tryPunch = function tryPunch() {
  this.player.punch();
  const px = this.player.x; const pz = this.player.z;
  const fx = Math.cos(this.player.heading); const fz = -Math.sin(this.player.heading);
  const hit = (list, onHit) => {
    for (const o of list) {
      const dx = o.x - px; const dz = o.z - pz;
      const d = Math.hypot(dx, dz);
      if (d < 2.2 && (dx * fx + dz * fz) > 0) { onHit(o, dx, dz, d); return true; }
    }
    return false;
  };
  if (hit(this.police.officers, (o, dx, dz, d) => {
    o.x += (dx / d) * 3; o.z += (dz / d) * 3;
    this.audio.noiseBurst(0.08, 0.2);
  })) return;
  if (hit(this.traffic.peds, (p, dx, dz, d) => {
    p.panic = 5;
    p.x += (dx / d) * 2; p.z += (dz / d) * 2;
    if (this.crimeCooldown <= 0) {
      this.police.addStars(1, 'assault');
      this.policeEverWanted = true;
      this.crimeCooldown = 2;
    }
  })) return;
};

Game.prototype.tryAttack = function tryAttack() {
  if (this.mode !== 'foot') return;
  this.audio.shot();
  this.shake = Math.max(this.shake, 0.12);
  const dir = new THREE.Vector3();
  this.camera.getWorldDirection(dir);
  const origin = this.camera.position.clone();
  // Muzzle flash at the player's hand.
  const flash = new THREE.PointLight(0xffc860, 12, 14);
  flash.position.set(this.player.x + Math.cos(this.player.heading) * 0.8, 1.5, this.player.z - Math.sin(this.player.heading) * 0.8);
  this.scene.add(flash);
  this.muzzle = { light: flash, life: 0.06 };
  // Find the closest thing the shot would hit.
  let best = null; let bd = 70;
  const test = (x, z, kind, obj) => {
    const dx = x - origin.x; const dz = z - origin.z;
    const along = dx * dir.x + dz * dir.z;
    if (along < 1 || along > bd) return;
    const perp = Math.abs(dx * dir.z - dz * dir.x);
    if (perp < 1.6) { bd = along; best = { x, z, kind, obj, along }; }
  };
  for (const p of this.traffic.peds) test(p.x, p.z, 'ped', p);
  for (const o of this.police.officers) test(o.x, o.z, 'cop', o);
  for (const c of this.traffic.cars) test(c.x, c.z, 'car', c);
  for (const c of this.police.cars) test(c.x, c.z, 'copcar', c);
  const end = best
    ? new THREE.Vector3(best.x, 1.2, best.z)
    : origin.clone().add(dir.clone().multiplyScalar(60));
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([origin, end]);
  const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
  this.scene.add(tracer);
  this.tracer = { mesh: tracer, life: 0.12 };
  if (best) {
    this.spawnSparks(best.x, 1.2, best.z);
    if (best.kind === 'ped') {
      best.obj.panic = 5;
      best.obj.x += dir.x * 2; best.obj.z += dir.z * 2;
      if (this.crimeCooldown <= 0) { this.police.addStars(2, 'shot a pedestrian'); this.policeEverWanted = true; this.crimeCooldown = 2; }
    } else if (best.kind === 'cop') {
      best.obj.x += dir.x * 3; best.obj.z += dir.z * 3;
      if (this.crimeCooldown <= 0) { this.police.addStars(2, 'shot a cop'); this.policeEverWanted = true; this.crimeCooldown = 2; }
    } else if (best.kind === 'car' || best.kind === 'copcar') {
      best.obj.speed *= 0.6;
    }
  }
};

Game.prototype.spawnSparks = function spawnSparks(x, y, z) {
  const geo = new THREE.BufferGeometry();
  const n = 14;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    pos[i * 3] = x + (Math.random() - 0.5) * 0.8;
    pos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.8;
    pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.8;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffd23a, size: 0.28, transparent: true, opacity: 1 });
  const points = new THREE.Points(geo, mat);
  this.scene.add(points);
  this.sparks.push({ mesh: points, life: 0.4, max: 0.4 });
};

// ----- camera + render -----
Game.prototype.render = function render(dt) {
  const target = this.mode === 'car' && this.playerCar
    ? new THREE.Vector3(this.playerCar.x, 1.4, this.playerCar.z)
    : new THREE.Vector3(this.player.x, 1.6, this.player.z);
  this.camTarget.lerp(target, 0.35);
  const dist = this.mode === 'car' ? 11 : 8.5;
  const height = dist * Math.sin(this.cameraPitch);
  const flat = dist * Math.cos(this.cameraPitch);
  const camDir = new THREE.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
  // Pull the camera in only when its final spot is inside a building.
  let distNow = dist;
  let camPos = null;
  for (let tries = 0; tries < 12; tries += 1) {
    const h = distNow * Math.sin(this.cameraPitch);
    const f = distNow * Math.cos(this.cameraPitch);
    camPos = new THREE.Vector3(
      this.camTarget.x - Math.sin(this.cameraYaw) * f,
      this.camTarget.y + h,
      this.camTarget.z - Math.cos(this.cameraYaw) * f,
    );
    const inside = this.city.buildings.some((b) => camPos.x > b.minX - 0.4 && camPos.x < b.maxX + 0.4 && camPos.z > b.minZ - 0.4 && camPos.z < b.maxZ + 0.4 && camPos.y < b.height);
    if (!inside || distNow <= 3) break;
    distNow -= 0.8;
  }
  camPos.y = Math.max(1.4, camPos.y);
  if (this.shake > 0) {
    camPos.x += (Math.random() - 0.5) * this.shake;
    camPos.y += (Math.random() - 0.5) * this.shake;
    this.shake = Math.max(0, this.shake - dt * 1.8);
  }
  this.camera.position.copy(camPos);
  this.camera.lookAt(this.camTarget);
  this.renderer.render(this.scene, this.camera);
};

// ----- boot -----
new Game();
