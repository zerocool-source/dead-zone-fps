import * as THREE from "three";
import {
  ROOM_HEIGHT,
  SECOND_FLOOR_HEIGHT,
  FLOOR_THICKNESS,
} from "./constants.js";

/**
 * Outdoor Level — "Dead City Streets"
 * An open outdoor zombie map with:
 *   - Large ground area (100x100) with grass/dirt terrain
 *   - Ruined buildings for cover and elevated positions
 *   - Street with wrecked vehicles
 *   - Perimeter fence/walls (zombies break through)
 *   - Skybox (dark stormy sky)
 *   - Streetlights and fire barrels for atmosphere
 *   - Multiple spawn points from all edges
 */

const MAP_W = 100;
const MAP_D = 100;
const HW = MAP_W / 2;
const HD = MAP_D / 2;

// ════════════════════════════════════════════════════════════
// TEXTURE GENERATORS
// ════════════════════════════════════════════════════════════

function makeGrassTexture() {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d");

  // Dark earth base
  ctx.fillStyle = "#2a3518";
  ctx.fillRect(0, 0, S, S);

  // Earth color variation
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 20 + Math.random() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const v = 30 + Math.floor(Math.random() * 15);
    g.addColorStop(0, `rgba(${v + 8},${v + 15},${v},0.4)`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Individual grass blade strokes
  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const len = 3 + Math.random() * 8;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    const g = 35 + Math.floor(Math.random() * 50);
    const r = 18 + Math.floor(Math.random() * 20);
    ctx.strokeStyle = `rgba(${r},${g},${Math.floor(r * 0.4)},0.6)`;
    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  // Dirt patches
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 10 + Math.random() * 25;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(55,40,28,0.6)");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dead leaf debris
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    ctx.fillStyle = `rgba(${50 + Math.random() * 20},${35 + Math.random() * 15},${15 + Math.random() * 10},0.4)`;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.random() * Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(
      0,
      0,
      2 + Math.random() * 3,
      1 + Math.random() * 1.5,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }

  // Pixel noise for texture
  const id = ctx.getImageData(0, 0, S, S);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 8;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(id, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 12);
  return tex;
}

function makeAsphaltTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(0, 0, 256, 256);
  // Asphalt noise
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = 40 + Math.floor(Math.random() * 30);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  // Cracks
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    let x = Math.random() * 256;
    let y = Math.random() * 256;
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (Math.random() - 0.5) * 40;
      y += (Math.random() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Road line
  ctx.fillStyle = "#8a8a40";
  ctx.fillRect(120, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 20);
  return tex;
}

function makeBrickWallTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  const bw = 32;
  const bh = 16;
  for (let row = 0; row < 256 / bh; row++) {
    const offset = (row % 2) * (bw / 2);
    for (let col = -1; col < 256 / bw + 1; col++) {
      const x = col * bw + offset;
      const y = row * bh;
      const r = 100 + Math.floor(Math.random() * 40);
      const g = 50 + Math.floor(Math.random() * 20);
      const b = 35 + Math.floor(Math.random() * 15);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
    }
  }
  // Mortar lines
  ctx.fillStyle = "#555550";
  for (let row = 0; row <= 256 / bh; row++) {
    ctx.fillRect(0, row * bh, 256, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeConcreteTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#6a6a68";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = 80 + Math.floor(Math.random() * 40);
    ctx.fillStyle = `rgba(${v},${v},${v},0.3)`;
    ctx.fillRect(x, y, 2 + Math.random() * 5, 2 + Math.random() * 5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makePlywoodTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#7a5a30";
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 20; i++) {
    const y = Math.random() * 128;
    ctx.strokeStyle = `rgba(${60 + Math.random() * 30},${35 + Math.random() * 15},${15},0.4)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(128, y + (Math.random() - 0.5) * 4);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════

function addBox(scene, obstacles, mat, w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  scene.add(mesh);
  if (obstacles) {
    obstacles.push({
      min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
      max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
    });
  }
  return mesh;
}

// ════════════════════════════════════════════════════════════
// MAIN: Create outdoor level
// ════════════════════════════════════════════════════════════

export function createOutdoorLevel(scene) {
  const obstacles = [];
  const flickerLights = [];
  const stairWaypoints = [];
  const spawnPoints = { downstairs: [], upstairs: [] };

  // Materials
  const grassMat = new THREE.MeshBasicMaterial({ map: makeGrassTexture() });
  const asphaltMat = new THREE.MeshBasicMaterial({ map: makeAsphaltTexture() });
  const brickTex = makeBrickWallTexture();
  const brickMat = new THREE.MeshBasicMaterial({ map: brickTex });
  const concreteTex = makeConcreteTexture();
  const concreteMat = new THREE.MeshBasicMaterial({ map: concreteTex });
  const plywoodTex = makePlywoodTexture();
  const plywoodMat = new THREE.MeshBasicMaterial({ map: plywoodTex });
  const metalMat = new THREE.MeshBasicMaterial({ color: 0x505058 });
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  const roofMat = new THREE.MeshBasicMaterial({ color: 0x3a3a3a });
  const fenceMat = new THREE.MeshBasicMaterial({
    color: 0x666666,
    wireframe: true,
  });
  const windowMat = new THREE.MeshBasicMaterial({
    color: 0x1a2a3a,
    transparent: true,
    opacity: 0.6,
  });
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
  const barrelMat = new THREE.MeshBasicMaterial({ color: 0x4a4a40 });

  // ═══════════════════════════
  // SKY — dark stormy gradient
  // ═══════════════════════════
  const skyGeo = new THREE.SphereGeometry(200, 16, 16);
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = 512;
  skyCanvas.height = 512;
  const skyCtx = skyCanvas.getContext("2d");
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 512);
  skyGrad.addColorStop(0, "#0a0a12");
  skyGrad.addColorStop(0.3, "#141420");
  skyGrad.addColorStop(0.5, "#1a1a28");
  skyGrad.addColorStop(0.7, "#222230");
  skyGrad.addColorStop(1, "#2a2a35");
  skyCtx.fillStyle = skyGrad;
  skyCtx.fillRect(0, 0, 512, 512);
  // Stars
  for (let i = 0; i < 80; i++) {
    const sx = Math.random() * 512;
    const sy = Math.random() * 256;
    const brightness = 100 + Math.floor(Math.random() * 155);
    skyCtx.fillStyle = `rgba(${brightness},${brightness},${brightness + 30},0.8)`;
    skyCtx.fillRect(sx, sy, 1 + Math.random(), 1 + Math.random());
  }
  // Moon
  skyCtx.fillStyle = "rgba(200,200,180,0.3)";
  skyCtx.beginPath();
  skyCtx.arc(380, 80, 25, 0, Math.PI * 2);
  skyCtx.fill();
  skyCtx.fillStyle = "rgba(230,230,210,0.5)";
  skyCtx.beginPath();
  skyCtx.arc(380, 80, 18, 0, Math.PI * 2);
  skyCtx.fill();
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  const skyMat = new THREE.MeshBasicMaterial({
    map: skyTex,
    side: THREE.BackSide,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Fog
  scene.fog = new THREE.FogExp2(0x0a0a12, 0.012);

  // ═══════════════════════════
  // GROUND — grass terrain
  // ═══════════════════════════
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_W, MAP_D),
    grassMat,
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // ═══════════════════════════
  // MAIN STREET — asphalt road running through center
  // ═══════════════════════════
  const road = new THREE.Mesh(new THREE.PlaneGeometry(10, MAP_D), asphaltMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  scene.add(road);

  // Cross street
  const crossRoad = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_W, 8),
    asphaltMat,
  );
  crossRoad.rotation.x = -Math.PI / 2;
  crossRoad.position.set(0, 0.01, 10);
  scene.add(crossRoad);

  // Sidewalks along main street
  const sidewalkMat = new THREE.MeshBasicMaterial({ color: 0x7a7a75 });
  for (const side of [-1, 1]) {
    const sidewalk = new THREE.Mesh(
      new THREE.BoxGeometry(3, 0.15, MAP_D),
      sidewalkMat,
    );
    sidewalk.position.set(side * 8, 0.075, 0);
    scene.add(sidewalk);
  }

  // ═══════════════════════════
  // PERIMETER WALLS — keeps player in map
  // ═══════════════════════════
  // Chain-link fence sections on all 4 sides
  const fenceHeight = 4;
  // North fence
  addBox(
    scene,
    obstacles,
    fenceMat,
    MAP_W,
    fenceHeight,
    0.3,
    0,
    fenceHeight / 2,
    -HD,
  );
  // South fence
  addBox(
    scene,
    obstacles,
    fenceMat,
    MAP_W,
    fenceHeight,
    0.3,
    0,
    fenceHeight / 2,
    HD,
  );
  // East fence
  addBox(
    scene,
    obstacles,
    fenceMat,
    0.3,
    fenceHeight,
    MAP_D,
    HW,
    fenceHeight / 2,
    0,
  );
  // West fence
  addBox(
    scene,
    obstacles,
    fenceMat,
    0.3,
    fenceHeight,
    MAP_D,
    -HW,
    fenceHeight / 2,
    0,
  );

  // Concrete fence posts every 10 units
  for (let i = -HW; i <= HW; i += 10) {
    addBox(
      scene,
      null,
      concreteMat,
      0.5,
      fenceHeight + 0.5,
      0.5,
      i,
      (fenceHeight + 0.5) / 2,
      -HD,
    );
    addBox(
      scene,
      null,
      concreteMat,
      0.5,
      fenceHeight + 0.5,
      0.5,
      i,
      (fenceHeight + 0.5) / 2,
      HD,
    );
  }
  for (let i = -HD; i <= HD; i += 10) {
    addBox(
      scene,
      null,
      concreteMat,
      0.5,
      fenceHeight + 0.5,
      0.5,
      -HW,
      (fenceHeight + 0.5) / 2,
      i,
    );
    addBox(
      scene,
      null,
      concreteMat,
      0.5,
      fenceHeight + 0.5,
      0.5,
      HW,
      (fenceHeight + 0.5) / 2,
      i,
    );
  }

  // ═══════════════════════════
  // RUINED BUILDING 1 — NW corner (2-story, climbable)
  // ═══════════════════════════
  const b1x = -25;
  const b1z = -25;
  const b1w = 14;
  const b1d = 12;
  const b1h = 6;
  // Walls
  brickTex.repeat.set(4, 2);
  addBox(
    scene,
    obstacles,
    brickMat,
    b1w,
    b1h,
    0.4,
    b1x,
    b1h / 2,
    b1z - b1d / 2,
  ); // back
  addBox(
    scene,
    obstacles,
    brickMat,
    b1w,
    b1h,
    0.4,
    b1x,
    b1h / 2,
    b1z + b1d / 2,
  ); // front
  addBox(
    scene,
    obstacles,
    brickMat,
    0.4,
    b1h,
    b1d,
    b1x - b1w / 2,
    b1h / 2,
    b1z,
  ); // left
  // Right wall with doorway gap
  addBox(
    scene,
    obstacles,
    brickMat,
    0.4,
    b1h,
    4,
    b1x + b1w / 2,
    b1h / 2,
    b1z - 4,
  );
  addBox(
    scene,
    obstacles,
    brickMat,
    0.4,
    b1h,
    4,
    b1x + b1w / 2,
    b1h / 2,
    b1z + 4,
  );
  addBox(scene, obstacles, brickMat, 0.4, 2, 4, b1x + b1w / 2, b1h - 1, b1z); // above door
  // Floor inside (second story)
  const secondFloor1 = new THREE.Mesh(
    new THREE.BoxGeometry(b1w - 0.8, 0.25, b1d - 0.8),
    plywoodMat,
  );
  secondFloor1.position.set(b1x, 3, b1z);
  scene.add(secondFloor1);
  obstacles.push({
    min: new THREE.Vector3(b1x - b1w / 2 + 0.4, 2.875, b1z - b1d / 2 + 0.4),
    max: new THREE.Vector3(b1x + b1w / 2 - 0.4, 3.125, b1z + b1d / 2 - 0.4),
  });
  // Roof
  addBox(scene, null, roofMat, b1w + 1, 0.2, b1d + 1, b1x, b1h, b1z);
  // Windows (dark holes)
  for (const wz of [b1z - 3, b1z + 3]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.5), windowMat);
    win.position.set(b1x - b1w / 2 - 0.01, 4.5, wz);
    win.rotation.y = Math.PI / 2;
    scene.add(win);
  }
  // Stairs inside building (ramp to second floor)
  const ramp1 = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 8), concreteMat);
  ramp1.position.set(b1x - 4, 1.5, b1z);
  ramp1.rotation.x = -Math.atan2(3, 8);
  scene.add(ramp1);
  // Stair waypoints for zombies
  const b1StairWPs = [];
  for (let i = 0; i < 6; i++) {
    b1StairWPs.push(
      new THREE.Vector3(b1x + b1w / 2 + 1, i * 0.5, b1z + (i - 3)),
    );
  }
  stairWaypoints.push({
    bottom: new THREE.Vector3(b1x + b1w / 2 + 1, 0, b1z - 3),
    top: new THREE.Vector3(b1x + b1w / 2 + 1, 3, b1z + 3),
    waypoints: b1StairWPs,
  });

  // ═══════════════════════════
  // RUINED BUILDING 2 — SE corner (warehouse)
  // ═══════════════════════════
  const b2x = 25;
  const b2z = 20;
  const b2w = 16;
  const b2d = 10;
  const b2h = 5;
  addBox(
    scene,
    obstacles,
    concreteMat,
    b2w,
    b2h,
    0.4,
    b2x,
    b2h / 2,
    b2z - b2d / 2,
  );
  addBox(
    scene,
    obstacles,
    concreteMat,
    b2w,
    b2h,
    0.4,
    b2x,
    b2h / 2,
    b2z + b2d / 2,
  );
  addBox(
    scene,
    obstacles,
    concreteMat,
    0.4,
    b2h,
    b2d,
    b2x + b2w / 2,
    b2h / 2,
    b2z,
  );
  // Left wall with gap
  addBox(
    scene,
    obstacles,
    concreteMat,
    0.4,
    b2h,
    3,
    b2x - b2w / 2,
    b2h / 2,
    b2z - 3.5,
  );
  addBox(
    scene,
    obstacles,
    concreteMat,
    0.4,
    b2h,
    3,
    b2x - b2w / 2,
    b2h / 2,
    b2z + 3.5,
  );
  addBox(
    scene,
    obstacles,
    concreteMat,
    0.4,
    1.5,
    4,
    b2x - b2w / 2,
    b2h - 0.75,
    b2z,
  );
  // Roof (partial — collapsed)
  addBox(scene, null, roofMat, b2w * 0.6, 0.15, b2d + 0.5, b2x + 3, b2h, b2z);

  // ═══════════════════════════
  // RUINED BUILDING 3 — NE corner (small shack)
  // ═══════════════════════════
  const b3x = 30;
  const b3z = -30;
  addBox(scene, obstacles, plywoodMat, 6, 3.5, 0.3, b3x, 1.75, b3z - 3);
  addBox(scene, obstacles, plywoodMat, 6, 3.5, 0.3, b3x, 1.75, b3z + 3);
  addBox(scene, obstacles, plywoodMat, 0.3, 3.5, 6, b3x - 3, 1.75, b3z);
  addBox(scene, obstacles, plywoodMat, 0.3, 3.5, 2, b3x + 3, 1.75, b3z - 2);
  addBox(scene, obstacles, plywoodMat, 0.3, 3.5, 2, b3x + 3, 1.75, b3z + 2);
  addBox(scene, null, metalMat, 7, 0.1, 7, b3x, 3.5, b3z); // tin roof

  // ═══════════════════════════
  // WRECKED VEHICLES — cover on the street
  // ═══════════════════════════
  const carMat = new THREE.MeshBasicMaterial({ color: 0x4a3030 });
  const carMat2 = new THREE.MeshBasicMaterial({ color: 0x304a30 });
  // Wrecked car 1
  addBox(scene, obstacles, carMat, 2.2, 1.3, 4.5, -1, 0.65, -8);
  addBox(scene, null, darkMat, 1.8, 0.8, 2, -1, 1.7, -8); // cabin
  // Wrecked car 2 (flipped on side)
  const car2 = addBox(scene, obstacles, carMat2, 2.2, 1.3, 4.5, 2, 0.65, 5);
  // Wrecked truck (larger)
  addBox(scene, obstacles, metalMat, 2.5, 2, 6, 1, 1, -25);
  addBox(scene, null, darkMat, 2.3, 1.5, 3, 1, 3, -25); // cab
  // Bus wreck
  addBox(
    scene,
    obstacles,
    new THREE.MeshBasicMaterial({ color: 0x3a5a3a }),
    2.8,
    2.5,
    10,
    -2,
    1.25,
    28,
  );

  // ═══════════════════════════
  // BARRICADES & COVER
  // ═══════════════════════════
  // Sandbag walls
  const sandbagMat = new THREE.MeshBasicMaterial({ color: 0x6a6a50 });
  addBox(scene, obstacles, sandbagMat, 5, 1.2, 0.8, 15, 0.6, 0);
  addBox(scene, obstacles, sandbagMat, 0.8, 1.2, 4, 17, 0.6, 2);
  addBox(scene, obstacles, sandbagMat, 5, 1.2, 0.8, -15, 0.6, 5);
  addBox(scene, obstacles, sandbagMat, 3, 1.2, 0.8, -20, 0.6, -10);

  // Concrete barriers (jersey barriers)
  const barrierMat = new THREE.MeshBasicMaterial({ color: 0x808078 });
  addBox(scene, obstacles, barrierMat, 1.5, 1, 4, 8, 0.5, -15);
  addBox(scene, obstacles, barrierMat, 1.5, 1, 4, -8, 0.5, 15);
  addBox(scene, obstacles, barrierMat, 4, 1, 1.5, 20, 0.5, -5);

  // Dumpsters
  addBox(
    scene,
    obstacles,
    new THREE.MeshBasicMaterial({ color: 0x2a4a2a }),
    2,
    1.5,
    1.5,
    -12,
    0.75,
    -20,
  );
  addBox(
    scene,
    obstacles,
    new THREE.MeshBasicMaterial({ color: 0x3a3a5a }),
    2,
    1.5,
    1.5,
    22,
    0.75,
    30,
  );

  // ═══════════════════════════
  // FIRE BARRELS — atmospheric light
  // ═══════════════════════════
  const firePositions = [
    { x: -10, z: 0 },
    { x: 12, z: -18 },
    { x: -20, z: 15 },
    { x: 25, z: 8 },
    { x: 0, z: -35 },
    { x: -30, z: -15 },
  ];
  for (const fp of firePositions) {
    // Barrel
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.45, 1.0, 8),
      barrelMat,
    );
    barrel.position.set(fp.x, 0.5, fp.z);
    scene.add(barrel);

    // Fire glow on top
    const fire = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), fireMat);
    fire.position.set(fp.x, 1.1, fp.z);
    scene.add(fire);

    // Point light
    const light = new THREE.PointLight(0xff6622, 3, 15, 1);
    light.position.set(fp.x, 2, fp.z);
    scene.add(light);
    flickerLights.push(light);
  }

  // ═══════════════════════════
  // STREETLIGHTS
  // ═══════════════════════════
  const lampPositions = [
    { x: -6, z: -20 },
    { x: 6, z: -20 },
    { x: -6, z: 0 },
    { x: 6, z: 0 },
    { x: -6, z: 20 },
    { x: 6, z: 20 },
    { x: -6, z: 40 },
    { x: 6, z: 40 },
  ];
  for (const lp of lampPositions) {
    // Pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 5, 6),
      metalMat,
    );
    pole.position.set(lp.x, 2.5, lp.z);
    scene.add(pole);
    // Lamp arm
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.08, 0.08),
      metalMat,
    );
    arm.position.set(lp.x + (lp.x > 0 ? -0.6 : 0.6), 5, lp.z);
    scene.add(arm);
    // Light fixture
    const fixture = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.15, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xffeeaa }),
    );
    fixture.position.set(lp.x + (lp.x > 0 ? -1.1 : 1.1), 4.9, lp.z);
    scene.add(fixture);
    // Light
    const streetLight = new THREE.PointLight(0xffeebb, 2, 20, 1);
    streetLight.position.set(lp.x + (lp.x > 0 ? -1.1 : 1.1), 4.8, lp.z);
    scene.add(streetLight);
  }

  // ═══════════════════════════
  // TREES (dead/bare trees)
  // ═══════════════════════════
  const treeMat = new THREE.MeshBasicMaterial({ color: 0x3a2a1a });
  const leafMat = new THREE.MeshBasicMaterial({ color: 0x1a2a10 });
  const treePositions = [
    { x: -35, z: -10 },
    { x: -38, z: 20 },
    { x: -40, z: -35 },
    { x: 35, z: -15 },
    { x: 40, z: 10 },
    { x: 38, z: 35 },
    { x: -15, z: -40 },
    { x: 20, z: -42 },
    { x: -25, z: 40 },
    { x: 15, z: 38 },
    { x: -42, z: 5 },
    { x: 42, z: -30 },
  ];
  for (const tp of treePositions) {
    const trunkH = 3 + Math.random() * 3;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.25, trunkH, 6),
      treeMat,
    );
    trunk.position.set(tp.x, trunkH / 2, tp.z);
    scene.add(trunk);

    // Some trees have sparse leaves, others are bare
    if (Math.random() > 0.4) {
      const canopy = new THREE.Mesh(
        new THREE.SphereGeometry(1.5 + Math.random(), 6, 6),
        leafMat,
      );
      canopy.position.set(tp.x, trunkH + 0.5, tp.z);
      canopy.scale.y = 0.7;
      scene.add(canopy);
    }
  }

  // ═══════════════════════════
  // LIGHTING — moonlit outdoor
  // ═══════════════════════════
  const ambient = new THREE.AmbientLight(0x334455, 4);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x334466, 0x1a1a0a, 3);
  scene.add(hemi);

  // Moonlight (directional)
  const moon = new THREE.DirectionalLight(0x8888aa, 2);
  moon.position.set(30, 40, -20);
  scene.add(moon);

  // Secondary fill
  const fill = new THREE.DirectionalLight(0x443322, 1);
  fill.position.set(-20, 30, 25);
  scene.add(fill);

  // ═══════════════════════════
  // SPAWN POINTS — zombies come from edges
  // ═══════════════════════════
  // North edge
  for (let x = -40; x <= 40; x += 20) {
    spawnPoints.downstairs.push(new THREE.Vector3(x, 0, -HD + 3));
  }
  // South edge
  for (let x = -40; x <= 40; x += 20) {
    spawnPoints.downstairs.push(new THREE.Vector3(x, 0, HD - 3));
  }
  // East edge
  for (let z = -40; z <= 40; z += 20) {
    spawnPoints.downstairs.push(new THREE.Vector3(HW - 3, 0, z));
  }
  // West edge
  for (let z = -40; z <= 40; z += 20) {
    spawnPoints.downstairs.push(new THREE.Vector3(-HW + 3, 0, z));
  }

  // Building 1 second floor spawn
  spawnPoints.upstairs.push(new THREE.Vector3(b1x, 3.2, b1z));

  return { obstacles, flickerLights, stairWaypoints, spawnPoints };
}

// Flicker light animation (reuse from room.js)
export function updateOutdoorFlickerLights(lights, time) {
  for (const light of lights) {
    const base = light.intensity || 3;
    const flicker =
      Math.sin(time * 8 + light.position.x) * 0.5 +
      Math.sin(time * 13 + light.position.z) * 0.3;
    light.intensity = Math.max(0.5, base + flicker);
  }
}
