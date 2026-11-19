// The wanted system: stars for crimes, police cars and officers who hunt
// the player, and the bust that ends a run of bad luck.
import * as THREE from 'three';
import { CITY, WANTED } from './config.js';
import { Car, makeCarMesh } from './vehicles.js';
import { mulberry32, range } from './random.js';

export class Police {
  constructor(scene, city, seed = 21) {
    this.scene = scene;
    this.city = city;
    this.rng = mulberry32(seed);
    this.stars = 0;
    this.cars = [];     // police Car objects
    this.officers = []; // on-foot police
    this.unseenTimer = 0;
    this.decayTimer = 0;
    this.bustTimer = 0;
    this.sirenNear = 0;
  }

  addStars(n, reason) {
    this.stars = Math.min(5, this.stars + n);
    this.unseenTimer = 0;
    this.decayTimer = 0;
    return this.stars;
  }

  clear() {
    this.stars = 0;
    this.unseenTimer = 0;
    this.decayTimer = 0;
    this.bustTimer = 0;
    for (const c of this.cars) this.scene.remove(c.mesh);
    for (const o of this.officers) this.scene.remove(o.mesh);
    this.cars = [];
    this.officers = [];
  }

  spawnCarNear(x, z) {
    const rng = this.rng;
    const angle = rng() * Math.PI * 2;
    const px = x + Math.cos(angle) * range(rng, 45, 70);
    const pz = z + Math.sin(angle) * range(rng, 45, 70);
    const clamped = this.city.collideCircle(px, pz, 3);
    const mesh = makeCarMesh(0x1c2f6e, { police: true });
    this.scene.add(mesh);
    const car = new Car(mesh, clamped.x, clamped.z, Math.atan2(-(z - clamped.z), x - clamped.x));
    car.cruise = 26;
    this.cars.push(car);
    return car;
  }

  spawnOfficerNear(x, z) {
    const rng = this.rng;
    const angle = rng() * Math.PI * 2;
    const px = x + Math.cos(angle) * range(rng, 12, 22);
    const pz = z + Math.sin(angle) * range(rng, 12, 22);
    const mesh = this.makeOfficerMesh();
    this.scene.add(mesh);
    const off = { mesh, x: px, z: pz, speed: 7.5 };
    this.officers.push(off);
    return off;
  }

  makeOfficerMesh() {
    const g = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x1c2f6e });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), navy);
    legs.position.y = 0.4;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.68, 0.36), navy);
    torso.position.y = 1.14;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.36), skin);
    head.position.y = 1.68;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.4), new THREE.MeshLambertMaterial({ color: 0x0e1a3d }));
    cap.position.y = 1.9;
    for (const m of [legs, torso, head, cap]) { m.castShadow = true; g.add(m); }
    return g;
  }

  // player: {x, z, inCar, car} — returns 'busted' | 'wasted' | null.
  step(dt, player, onCrime) {
    const want = WANTED.maxCops[this.stars];
    // Spawn to match the wanted level.
    if (this.stars > 0) {
      const needCars = Math.min(want, Math.ceil(want * 0.6));
      while (this.cars.length < needCars) this.spawnCarNear(player.x, player.z);
      const needOff = want - needCars;
      while (this.officers.length < needOff) this.spawnOfficerNear(player.x, player.z);
    }
    let nearest = Infinity;
    for (const car of this.cars) {
      // Chase: steer toward the player, faster than traffic.
      const dx = player.x - car.x; const dz = player.z - car.z;
      const dist = Math.hypot(dx, dz);
      nearest = Math.min(nearest, dist);
      const wantHeading = Math.atan2(-dz, dx);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.steerAngle = Math.max(-1, Math.min(1, dh * 1.4));
      car.speed += ((dist > 8 ? 30 : 18) - car.speed) * Math.min(1, 1.6 * dt);
      car.heading += (car.steerAngle * car.speed * dt) / 4.0;
      car.x += Math.cos(car.heading) * car.speed * dt;
      car.z -= Math.sin(car.heading) * car.speed * dt;
      const fixed = this.city.collideCircle(car.x, car.z, 2.2);
      car.x = fixed.x; car.z = fixed.z;
      car.updateMesh();
      // Ram the player's car.
      if (player.inCar && dist < 5.2) {
        player.car.speed *= 0.82;
        if (onCrime) onCrime('ram');
      }
      // Flash the light bar.
      const bar = car.mesh.userData.lightBar;
      if (bar) bar.material.color.setHex(Math.floor(performance.now() / 300) % 2 ? 0xff2a2a : 0x2a6bff);
    }
    // Officers chase on foot and try to arrest.
    let touching = false;
    for (const off of this.officers) {
      const dx = player.x - off.x; const dz = player.z - off.z;
      const dist = Math.hypot(dx, dz);
      nearest = Math.min(nearest, dist);
      if (dist > 0.5) {
        off.x += (dx / dist) * off.speed * dt;
        off.z += (dz / dist) * off.speed * dt;
      }
      const fixed = this.city.collideCircle(off.x, off.z, 0.5);
      off.x = fixed.x; off.z = fixed.z;
      off.mesh.position.set(off.x, 0, off.z);
      off.mesh.rotation.y = Math.atan2(-dz, dx);
      if (dist < 1.4 && !player.inCar) touching = true;
    }
    if (touching && this.stars > 0) {
      this.bustTimer += dt;
      if (this.bustTimer >= WANTED.bustSeconds) return 'busted';
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }
    // Wanted decays when the police cannot see the player.
    if (this.stars > 0) {
      if (nearest > 55) {
        this.unseenTimer += dt;
        if (this.unseenTimer > WANTED.decayDelay) {
          this.decayTimer += dt;
          if (this.decayTimer > WANTED.decayPerStar) {
            this.stars -= 1;
            this.decayTimer = 0;
            this.unseenTimer = 0;
            if (this.stars === 0) this.clear();
          }
        }
      } else {
        this.unseenTimer = 0;
        this.decayTimer = 0;
      }
    }
    // Trim excess units when stars fall.
    const wantNow = WANTED.maxCops[this.stars];
    while (this.cars.length > Math.ceil(wantNow * 0.6)) {
      const c = this.cars.pop();
      this.scene.remove(c.mesh);
    }
    while (this.officers.length > Math.max(0, wantNow - Math.ceil(wantNow * 0.6))) {
      const o = this.officers.pop();
      this.scene.remove(o.mesh);
    }
    this.sirenNear = this.stars > 0 ? Math.max(0, 1 - nearest / 120) : 0;
    return null;
  }
}
