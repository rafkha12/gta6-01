// Dario Cruz on foot: a low-poly figure with a third-person orbit camera,
// walk/run/jump, punching and shooting.
import * as THREE from 'three';
import { PLAYER } from './config.js';

export function makePlayerMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2e6fc2 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.32), pants);
  legs.position.y = 0.43;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.36), shirt);
  torso.position.y = 1.2;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
  head.position.y = 1.78;
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.44), hair);
  hairTop.position.y = 2.02;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt);
  armL.position.set(-0.42, 1.2, 0);
  const armR = armL.clone();
  armR.position.x = 0.42;
  for (const m of [legs, torso, head, hairTop, armL, armR]) { m.castShadow = true; group.add(m); }
  group.userData.armL = armL;
  group.userData.armR = armR;
  return group;
}

export class Player {
  constructor(mesh, x, z) {
    this.mesh = mesh;
    this.x = x; this.z = z;
    this.y = 0; this.vy = 0;
    this.heading = 0; // facing, radians
    this.health = PLAYER.health;
    this.onGround = true;
    this.walkPhase = 0;
    this.punchTimer = 0;
    this.updateMesh();
  }

  updateMesh() {
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = -this.heading;
    const swing = Math.sin(this.walkPhase) * 0.5;
    this.mesh.userData.armL.rotation.x = swing;
    this.mesh.userData.armR.rotation.x = -swing;
  }

  // moveX/moveZ are world-space wish directions; camHeading rotates them.
  step(moveX, moveZ, running, dt) {
    const len = Math.hypot(moveX, moveZ);
    if (len > 0.01) {
      const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const nx = moveX / len; const nz = moveZ / len;
      this.x += nx * speed * dt;
      this.z += nz * speed * dt;
      this.heading = Math.atan2(nz, nx);
      this.walkPhase += dt * speed * 1.6;
    }
    if (this.onGround && this.vy === 0 && arguments[3] !== undefined) { /* jump handled by caller */ }
    this.vy -= PLAYER.gravity * dt;
    this.y += this.vy * dt;
    if (this.y <= 0) { this.y = 0; this.vy = 0; this.onGround = true; }
    this.updateMesh();
  }

  jump() {
    if (this.onGround) { this.vy = PLAYER.jumpSpeed; this.onGround = false; }
  }

  punch() { this.punchTimer = 0.35; }
}
