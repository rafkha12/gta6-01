// Cars: low-poly builds from boxes, plus the arcade driving model the
// player and the traffic AI both use.
import * as THREE from 'three';
import { CAR, PALETTE } from './config.js';
import { pick } from './random.js';

let wheelGeo = null;
let wheelMat = null;

export function makeCarMesh(color, opts = {}) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2733 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(CAR.length, 0.75, CAR.width), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.65, 1.8), opts.police ? bodyMat : glassMat);
  cabin.position.set(-0.2, 1.3, 0);
  cabin.castShadow = true;
  group.add(cabin);
  if (opts.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    bar.position.set(-0.2, 1.72, 0);
    group.add(bar);
    group.userData.lightBar = bar;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(CAR.length + 0.02, 0.2, CAR.width + 0.02), new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
    stripe.position.y = 0.85;
    group.add(stripe);
  }
  if (opts.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.4), new THREE.MeshBasicMaterial({ color: PALETTE.taxi }));
    sign.position.set(-0.2, 1.75, 0);
    group.add(sign);
  }
  if (!wheelGeo) {
    wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
    wheelGeo.rotateX(Math.PI / 2);
    wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  }
  const wheels = [];
  for (const [wx, wz] of [[1.45, 0.95], [1.45, -0.95], [-1.45, 0.95], [-1.45, -0.95]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, 0.38, wz);
    group.add(w);
    wheels.push(w);
  }
  group.userData.wheels = wheels;
  // Headlights.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const z of [0.7, -0.7]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.3), lightMat);
    hl.position.set(CAR.length / 2, 0.7, z);
    group.add(hl);
  }
  return group;
}

export class Car {
  constructor(mesh, x, z, heading) {
    this.mesh = mesh;
    this.x = x; this.z = z;
    this.heading = heading; // radians, 0 = +x
    this.speed = 0;
    this.steerAngle = 0;
    this.color = 0xffffff;
    this.updateMesh();
  }

  updateMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * 0.016 / 0.38;
    for (const w of this.mesh.userData.wheels) w.rotation.z -= spin;
  }

  // Arcade driving: throttle -1..1, steer -1..1, dt seconds.
  drive(throttle, steer, dt) {
    const targetSteer = steer * CAR.steer;
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1, CAR.steerSpeed * dt);
    if (throttle > 0) this.speed += CAR.accel * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= CAR.brake * dt;
      else this.speed += CAR.reverseAccel * throttle * dt;
    } else {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 8 * dt);
    }
    this.speed -= this.speed * CAR.drag * dt * 0.4;
    this.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, this.speed));
    if (Math.abs(this.speed) > 0.05) {
      this.heading += (this.steerAngle * this.speed * dt) / (CAR.length * 0.9);
    }
    this.x += Math.cos(this.heading) * this.speed * dt;
    this.z -= Math.sin(this.heading) * this.speed * dt;
    this.updateMesh();
  }

  get speed01() { return Math.abs(this.speed) / CAR.maxSpeed; }
}

export function randomCarColor(rng) {
  return pick(rng, PALETTE.car);
}
