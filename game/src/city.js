// Bahía Sol itself: streets, buildings with lit windows, the beach, the
// marina, palms and street props. Everything is procedural — no model files.
// The city also answers collision queries (circle vs building AABB) and tells
// the game where the roads and sidewalks are.
import * as THREE from 'three';
import { CITY, STREETS, PALETTE } from './config.js';
import { mulberry32, pick, range, rangeInt } from './random.js';

function windowTexture(rng, base, floors, cols) {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 128);
  const cw = 64 / cols; const ch = 128 / floors;
  for (let f = 0; f < floors; f += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = rng() < 0.42;
      g.fillStyle = lit ? '#ffe9a8' : '#2c3542';
      g.fillRect(c * cw + 2, f * ch + 3, cw - 4, ch - 6);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = '#2e3138';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#e8e8e8';
  g.fillRect(62, 0, 4, 128);
  g.fillStyle = '#3a3e46';
  for (let i = 0; i < 200; i += 1) g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene, seed = 1) {
    this.scene = scene;
    this.rng = mulberry32(seed);
    this.buildings = []; // {minX,maxX,minZ,maxZ,height}
    this.palms = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.buildGround();
    this.buildBlocks();
    this.buildBeachAndMarina();
    this.buildProps();
  }

  buildGround() {
    const size = CITY.half * 2 + 260;
    const roadTex = roadTexture();
    roadTex.repeat.set(size / 14, size / 14);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshLambertMaterial({ map: roadTex }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 0);
    ground.receiveShadow = true;
    this.group.add(ground);
    // Sidewalk tint: a slightly raised plane per block is too many draws;
    // instead the road texture reads as asphalt and blocks read as pavement
    // via their base slabs below.
  }

  buildBlocks() {
    const rng = this.rng;
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const slabGeo = new THREE.BoxGeometry(1, 0.4, 1);
    const slabMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
    const mats = {};
    for (let bx = 0; bx < CITY.blocks; bx += 1) {
      for (let bz = 0; bz < CITY.blocks; bz += 1) {
        const x0 = STREETS[bx] + CITY.street / 2;
        const x1 = STREETS[bx + 1] - CITY.street / 2;
        const z0 = STREETS[bz] + CITY.street / 2;
        const z1 = STREETS[bz + 1] - CITY.street / 2;
        // Pavement slab for the whole block.
        const slab = new THREE.Mesh(slabGeo, slabMat);
        slab.scale.set(x1 - x0, 1, z1 - z0);
        slab.position.set((x0 + x1) / 2, 0.2, (z0 + z1) / 2);
        slab.receiveShadow = true;
        this.group.add(slab);
        // Plaza blocks stay open (a park or a plaza, with palms).
        if (rng() < 0.16) { this.plazaTrees(x0, x1, z0, z1); continue; }
        const count = rangeInt(rng, 1, 3);
        for (let n = 0; n < count; n += 1) {
          const w = range(rng, 12, Math.min(24, x1 - x0 - 4));
          const d = range(rng, 12, Math.min(24, z1 - z0 - 4));
          const cx = range(rng, x0 + w / 2 + 2, x1 - w / 2 - 2);
          const cz = range(rng, z0 + d / 2 + 2, z1 - d / 2 - 2);
          const h = range(rng, 12, 52) * (rng() < 0.12 ? 1.8 : 1);
          const base = pick(rng, PALETTE.building);
          const key = base + '|' + Math.max(3, Math.round(h / 4));
          if (!mats[key]) {
            mats[key] = new THREE.MeshLambertMaterial({
              map: windowTexture(rng, '#' + base.toString(16).padStart(6, '0'), Math.max(3, Math.round(h / 4)), 4),
            });
          }
          const b = new THREE.Mesh(boxGeo, mats[key]);
          b.scale.set(w, h, d);
          b.position.set(cx, h / 2 + 0.4, cz);
          b.castShadow = true;
          b.receiveShadow = true;
          this.group.add(b);
          // Rooftop box for skyline variety.
          if (rng() < 0.5) {
            const roof = new THREE.Mesh(boxGeo, mats[key]);
            roof.scale.set(w * 0.45, range(rng, 2, 5), d * 0.45);
            roof.position.set(cx + range(rng, -3, 3), h + 0.4 + roof.scale.y / 2, cz + range(rng, -3, 3));
            this.group.add(roof);
          }
          this.buildings.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, height: h });
        }
      }
    }
  }

  plazaTrees(x0, x1, z0, z1) {
    const rng = this.rng;
    for (let i = 0; i < 5; i += 1) {
      this.palms.push({ x: range(rng, x0 + 3, x1 - 3), z: range(rng, z0 + 3, z1 - 3) });
    }
  }

  buildBeachAndMarina() {
    // Sand strip along the south edge, water beyond it and past the marina.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.half * 2 + 260, CITY.beachZ - CITY.half),
      new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.05, (CITY.half + CITY.beachZ) / 2);
    sand.receiveShadow = true;
    this.group.add(sand);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshPhongMaterial({ color: PALETTE.water, shininess: 120, transparent: true, opacity: 0.92 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.4, 700);
    this.group.add(water);
    const waterEast = water.clone();
    waterEast.position.set(700, -0.4, 0);
    this.group.add(waterEast);
    // Marina docks on the east edge.
    const dockMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
    for (let i = 0; i < 4; i += 1) {
      const dock = new THREE.Mesh(new THREE.BoxGeometry(26, 0.6, 4), dockMat);
      dock.position.set(CITY.half + 16, 0.3, -140 + i * 80);
      this.group.add(dock);
      // A moored boat: hull + cabin.
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(9, 2.2, 3.4),
        new THREE.MeshLambertMaterial({ color: pick(this.rng, [0xe8e8e8, 0x2e6fc2, 0xc23b2e]) }),
      );
      hull.position.set(CITY.half + 22, 0.6, -140 + i * 80 + 6);
      hull.castShadow = true;
      this.group.add(hull);
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(4, 2, 2.6),
        new THREE.MeshLambertMaterial({ color: 0xf5f0e0 }),
      );
      cabin.position.set(CITY.half + 22, 2.6, -140 + i * 80 + 6);
      this.group.add(cabin);
    }
  }

  buildProps() {
    const rng = this.rng;
    // Palm trees: trunk + fronds, scattered on sidewalks, the beach and plazas.
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
    const frondGeo = new THREE.ConeGeometry(3.2, 2.4, 6);
    const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e });
    const spots = [...this.palms];
    for (let i = 0; i < 90; i += 1) {
      const onBeach = rng() < 0.4;
      spots.push(onBeach
        ? { x: range(rng, -CITY.half, CITY.half), z: range(rng, CITY.half + 6, CITY.beachZ - 6) }
        : { x: pick(rng, STREETS) + range(rng, -6, 6), z: range(rng, -CITY.half, CITY.half) });
    }
    for (const s of spots) {
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(s.x, 3.5, s.z);
      trunk.castShadow = true;
      this.group.add(trunk);
      const fronds = new THREE.Mesh(frondGeo, frondMat);
      fronds.position.set(s.x, 8, s.z);
      fronds.castShadow = true;
      this.group.add(fronds);
    }
    // Street lamps at intersections.
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 6);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x333a44 });
    const lampGeo = new THREE.SphereGeometry(0.45, 8, 6);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (const sx of STREETS) {
      for (const sz of STREETS) {
        if (rng() < 0.5) continue;
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(sx + 8, 3, sz + 8);
        this.group.add(pole);
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(sx + 8, 6.1, sz + 8);
        this.group.add(lamp);
      }
    }
  }

  // Circle (x, z, radius) vs building AABBs. Returns a corrected position.
  collideCircle(x, z, radius) {
    let px = x; let pz = z;
    for (const b of this.buildings) {
      const cx = Math.max(b.minX, Math.min(px, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pz, b.maxZ));
      const dx = px - cx; const dz = pz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          px = cx + (dx / d) * radius;
          pz = cz + (dz / d) * radius;
        } else {
          pz = b.maxZ + radius;
        }
      }
    }
    // Keep everything inside the playable area.
    px = Math.max(-CITY.half - 6, Math.min(CITY.marinaX - 4, px));
    pz = Math.max(-CITY.half - 6, Math.min(CITY.beachZ - 4, pz));
    return { x: px, z: pz };
  }

  nearestStreetCoord(v) {
    let best = STREETS[0]; let bd = Infinity;
    for (const s of STREETS) { const d = Math.abs(v - s); if (d < bd) { bd = d; best = s; } }
    return best;
  }

  // Is this point on a road (within a street's width)?
  onRoad(x, z) {
    const nearX = Math.min(...STREETS.map((s) => Math.abs(x - s)));
    const nearZ = Math.min(...STREETS.map((s) => Math.abs(z - s)));
    return nearX < CITY.street / 2 + 1 || nearZ < CITY.street / 2 + 1;
  }

  randomRoadPoint(rng) {
    const along = pick(rng, STREETS) + range(rng, -3, 3);
    const across = range(rng, -CITY.half + 10, CITY.half - 10);
    return rng() < 0.5 ? { x: along, z: across } : { x: across, z: along };
  }
}
