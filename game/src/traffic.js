// Traffic cars that drive the street grid and pedestrians who walk the
// sidewalks — and run when things get loud.
import * as THREE from 'three';
import { CITY, STREETS } from './config.js';
import { Car, makeCarMesh, randomCarColor } from './vehicles.js';
import { mulberry32, range, rangeInt, pick } from './random.js';

const LANE = 3.5;

export class Traffic {
  constructor(scene, city, seed = 7) {
    this.scene = scene;
    this.city = city;
    this.rng = mulberry32(seed);
    this.cars = [];
    this.peds = [];
    this.pedGroup = new THREE.Group();
    scene.add(this.pedGroup);
    for (let i = 0; i < 14; i += 1) this.spawnCar(true);
    for (let i = 0; i < 26; i += 1) this.spawnPed(true);
  }

  spawnCar(anywhere = false) {
    const rng = this.rng;
    const p = this.city.randomRoadPoint(rng);
    const alongX = Math.abs(p.x - this.city.nearestStreetCoord(p.x)) < 1;
    const heading = alongX ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const mesh = makeCarMesh(randomCarColor(rng), { taxi: rng() < 0.12 });
    this.scene.add(mesh);
    const car = new Car(mesh, p.x, p.z, heading);
    car.cruise = range(rng, 7, 12);
    car.wait = 0;
    this.cars.push(car);
    return car;
  }

  spawnPed(anywhere = false) {
    const rng = this.rng;
    const p = this.city.randomRoadPoint(rng);
    const mesh = this.makePedMesh(pick(rng, [0xc23b2e, 0x2e6fc2, 0x3aa655, 0xe8b93a, 0x7a4a9e, 0xd06a2a]));
    this.pedGroup.add(mesh);
    const ped = {
      mesh, x: p.x, z: p.z, heading: rng() * Math.PI * 2,
      speed: range(rng, 1.2, 2.2), panic: 0, phase: rng() * 6,
    };
    this.peds.push(ped);
    return ped;
  }

  makePedMesh(shirtColor) {
    const g = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: pick(this.rng, [0xc98d64, 0x8a5a3b, 0xe8b48a]) });
    const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), pants);
    legs.position.y = 0.4;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.65, 0.34), shirt);
    torso.position.y = 1.12;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.36), skin);
    head.position.y = 1.66;
    for (const m of [legs, torso, head]) { m.castShadow = true; g.add(m); }
    return g;
  }

  // Reposition some traffic and pedestrians near a point so the frame is busy.
  populateNear(x, z) {
    const rng = this.rng;
    let placed = 0;
    for (const car of this.cars) {
      if (placed >= 4) break;
      if (rng() < 0.5) {
        // On a north-south street near x, somewhere along z.
        car.x = this.city.nearestStreetCoord(x + range(rng, -30, 30)) + range(rng, -3, 3);
        car.z = z + range(rng, -30, 30);
        car.heading = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        // On an east-west street near z, somewhere along x.
        car.x = x + range(rng, -30, 30);
        car.z = this.city.nearestStreetCoord(z + range(rng, -30, 30)) + range(rng, -3, 3);
        car.heading = rng() < 0.5 ? 0 : Math.PI;
      }
      car.speed = car.cruise;
      car.updateMesh();
      placed += 1;
    }
    let peds = 0;
    for (const ped of this.peds) {
      if (peds >= 6) break;
      // On a block corner: off both the nearest north-south street and the
      // nearest east-west street, so nobody stands in traffic.
      ped.x = this.city.nearestStreetCoord(x + range(rng, -30, 30)) + (rng() < 0.5 ? -1 : 1) * range(rng, 9, 13);
      ped.z = this.city.nearestStreetCoord(z + range(rng, -30, 30)) + (rng() < 0.5 ? -1 : 1) * range(rng, 9, 13);
      const fixed = this.city.collideCircle(ped.x, ped.z, 0.5);
      ped.x = fixed.x; ped.z = fixed.z;
      ped.heading = rng() * Math.PI * 2;
      peds += 1;
    }
  }

  step(dt, danger) {
    // danger: {x, z, radius, loud} — peds flee it, traffic slows near it.
    for (const car of this.cars) {
      // At an intersection, sometimes turn.
      const nearX = this.city.nearestStreetCoord(car.x);
      const nearZ = this.city.nearestStreetCoord(car.z);
      const atX = Math.abs(car.x - nearX) < 1.2;
      const atZ = Math.abs(car.z - nearZ) < 1.2;
      if ((atX || atZ) && car.wait <= 0 && this.rng() < 0.02) {
        car.heading += (this.rng() < 0.5 ? 1 : -1) * Math.PI / 2;
      }
      // Slow for the car ahead.
      let blocked = false;
      for (const other of this.cars) {
        if (other === car) continue;
        const dx = other.x - car.x; const dz = other.z - car.z;
        const ahead = dx * Math.cos(car.heading) - dz * Math.sin(car.heading);
        const side = Math.abs(dx * Math.sin(car.heading) + dz * Math.cos(car.heading));
        if (ahead > 0 && ahead < 9 && side < 2.4) { blocked = true; break; }
      }
      if (danger && Math.hypot(car.x - danger.x, car.z - danger.z) < 12) blocked = true;
      const target = blocked ? 0 : car.cruise;
      car.speed += (target - car.speed) * Math.min(1, 2 * dt);
      car.x += Math.cos(car.heading) * car.speed * dt;
      car.z -= Math.sin(car.heading) * car.speed * dt;
      // Wrap around the city edge instead of driving into the sea.
      if (car.x > CITY.half + 4) car.x = -CITY.half - 2;
      if (car.x < -CITY.half - 4) car.x = CITY.half + 2;
      if (car.z > CITY.half + 4) car.z = -CITY.half - 2;
      if (car.z < -CITY.half - 4) car.z = CITY.half + 2;
      car.updateMesh();
    }
    for (const ped of this.peds) {
      let mx = Math.cos(ped.heading); let mz = -Math.sin(ped.heading);
      if (danger) {
        const dx = ped.x - danger.x; const dz = ped.z - danger.z;
        const d = Math.hypot(dx, dz);
        if (d < danger.radius) {
          ped.panic = 3;
          mx = dx / (d || 1); mz = dz / (d || 1);
        }
      }
      if (ped.panic > 0) {
        ped.panic -= dt;
        ped.x += mx * 4.5 * dt; ped.z += mz * 4.5 * dt;
      } else {
        // Wander the sidewalks; turn at random.
        if (this.rng() < 0.004) ped.heading += (this.rng() < 0.5 ? 1 : -1) * Math.PI / 2;
        ped.x += mx * ped.speed * dt; ped.z += mz * ped.speed * dt;
      }
      const fixed = this.city.collideCircle(ped.x, ped.z, 0.5);
      ped.x = fixed.x; ped.z = fixed.z;
      ped.phase += dt * (ped.panic > 0 ? 14 : 6);
      ped.mesh.position.set(ped.x, Math.abs(Math.sin(ped.phase)) * 0.06, ped.z);
      ped.mesh.rotation.y = Math.atan2(-mz, mx);
    }
  }
}
