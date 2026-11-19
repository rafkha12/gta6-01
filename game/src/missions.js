// Missions: the story arc. Each mission is a small state machine —
// go here, do that, get paid. The game owns the world objects (markers,
// mission cars, the cash) and the mission just drives them.
import * as THREE from 'three';
import { CITY, STREETS, MISSIONS } from './config.js';
import { Car, makeCarMesh } from './vehicles.js';

function markerMesh(color = 0xffd23a) {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 4.5, 4),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }),
  );
  cone.rotation.x = Math.PI;
  cone.position.y = 5.5;
  g.add(cone);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3, 24),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  g.add(ring);
  g.userData.cone = cone;
  g.userData.ring = ring;
  return g;
}

export class Missions {
  constructor(scene, city, game) {
    this.scene = scene;
    this.city = city;
    this.game = game;
    this.index = 0;            // next mission to play
    this.active = null;        // {def, step, timer, marker, car, cash}
    this.completed = 0;
    this.marker = null;
  }

  get currentDef() { return MISSIONS[this.index] || null; }
  get done() { return this.index >= MISSIONS.length; }

  start() {
    if (!this.currentDef) return false;
    const def = this.currentDef;
    const a = { def, step: 0, timer: def.timeLimit, car: null, cash: null, target: null };
    this.active = a;
    // Heat Run opens with the cops already on you.
    if (def.id === 'heat') {
      this.game.police.addStars(3, 'tagged plates');
      this.game.policeEverWanted = true;
    }
    this.placeMarkerForStep();
    return true;
  }

  targetFor(missionId, step) {
    // Fixed, memorable spots so the story reads on the map.
    const S = STREETS;
    switch (missionId) {
      case 'fare':
        return step === 0
          ? { x: S[1], z: S[1], label: 'Solmar garage' }
          : { x: CITY.half + 12, z: -60, label: 'Marina hotel' };
      case 'wheels':
        return step === 0
          ? { x: S[6], z: S[3], label: 'Coral casino' }
          : { x: S[1], z: S[1], label: 'Solmar garage' };
      case 'heat':
        return step === 0
          ? { x: S[1], z: S[1], label: 'Hideout under the east bridge' }
          : { x: CITY.half + 12, z: -60, label: 'Marina hotel' };
      case 'score':
        return step === 0
          ? { x: 0, z: 0, label: 'Plaza — the vault truck' }
          : { x: CITY.half + 12, z: 140, label: 'The boat at the marina' };
      default: return { x: 0, z: 0, label: 'Bahía Sol' };
    }
  }

  placeMarkerForStep() {
    const a = this.active;
    if (!a) return;
    if (this.marker) { this.scene.remove(this.marker); this.marker = null; }
    a.target = this.targetFor(a.def.id, a.step);
    this.marker = markerMesh(a.def.id === 'score' ? 0x3aff7a : 0xffd23a);
    this.marker.position.set(a.target.x, 0, a.target.z);
    this.scene.add(this.marker);
    // Mission-specific props.
    if (a.def.id === 'wheels' && a.step === 0 && !a.car) {
      const mesh = makeCarMesh(0xf2c230);
      this.scene.add(mesh);
      a.car = new Car(mesh, a.target.x + 4, a.target.z + 4, 0);
      a.car.isMissionCar = true;
      this.game.registerWorldCar(a.car);
    }
    if (a.def.id === 'score' && a.step === 0 && !a.cash) {
      const cash = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.8, 0.9),
        new THREE.MeshLambertMaterial({ color: 0x2a7f3a }),
      );
      cash.position.set(a.target.x, 0.6, a.target.z);
      cash.castShadow = true;
      this.scene.add(cash);
      a.cash = cash;
    }
  }

  // Returns 'complete' | 'failed' | null. game supplies the player position.
  step(dt, px, pz, playerInCar, nearCar) {
    const a = this.active;
    if (!a) return null;
    a.timer -= dt;
    if (a.marker) {
      a.marker.userData.cone.rotation.y += dt * 2;
      a.marker.userData.cone.position.y = 5.5 + Math.sin(performance.now() / 300) * 0.5;
    }
    if (a.timer <= 0) return this.fail('Time ran out.');
    const t = a.target;
    const dist = Math.hypot(px - t.x, pz - t.z);
    const reach = dist < 6;
    switch (a.def.id) {
      case 'fare':
        if (a.step === 0 && reach && playerInCar) { a.step = 1; this.placeMarkerForStep(); this.game.toast('Client aboard — get him to the marina hotel.'); }
        else if (a.step === 1 && reach && playerInCar) return this.complete();
        break;
      case 'wheels':
        if (a.step === 0 && nearCar === a.car) { a.step = 1; this.placeMarkerForStep(); this.game.toast('The Comet GT is yours. Deliver it to the garage — quietly.'); }
        else if (a.step === 1 && reach && nearCar === a.car) return this.complete();
        break;
      case 'heat':
        if (a.step === 0 && this.game.police.stars === 0 && this.game.policeEverWanted) { a.step = 1; this.placeMarkerForStep(); this.game.toast('Clean. Now get to the hideout.'); }
        else if (a.step === 1 && reach) return this.complete();
        break;
      case 'score':
        if (a.step === 0 && reach && !playerInCar) {
          a.step = 1;
          this.placeMarkerForStep();
          if (a.cash) { this.scene.remove(a.cash); a.cash = null; }
          this.game.police.addStars(4, 'bank job');
          this.game.toast('Cash grabbed! The whole city is coming — reach the boat!');
        } else if (a.step === 1 && reach) return this.complete();
        break;
      default: break;
    }
    return null;
  }

  complete() {
    const a = this.active;
    this.cleanupActive();
    this.completed += 1;
    this.index += 1;
    const payout = a.def.payout;
    this.game.money += payout;
    this.game.audio.cash();
    this.game.toast(`Job done — ${a.def.title}. +$${payout}`);
    this.game.saveGame();
    return 'complete';
  }

  fail(reason) {
    this.cleanupActive();
    this.game.audio.fail();
    this.game.toast(`Job failed — ${reason}`);
    return 'failed';
  }

  cleanupActive() {
    const a = this.active;
    if (!a) return;
    if (this.marker) { this.scene.remove(this.marker); this.marker = null; }
    if (a.car) { this.game.unregisterWorldCar(a.car); this.scene.remove(a.car.mesh); }
    if (a.cash) this.scene.remove(a.cash);
    this.active = null;
  }

  abort() { this.cleanupActive(); }
}
