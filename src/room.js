import * as THREE from "three";
import {
  ROOM_WIDTH,
  ROOM_DEPTH,
  ROOM_HEIGHT,
  SECOND_FLOOR_HEIGHT,
  FLOOR_THICKNESS,
  STAIR_STEP_COUNT,
  STAIR_STEP_HEIGHT,
  STAIR_STEP_DEPTH,
  STAIR_WIDTH,
} from "./constants.js";
import {
  createConcreteTexture,
  createFloorTexture,
  createMansionFloorTexture,
  createWallpaperTexture,
  createWoodTexture,
  createMetalTexture,
  createBloodTexture,
  createCeilingTexture,
  createHallwayFloorTexture,
  createBalconyFloorTexture,
  createStairTexture,
  createDirtTexture,
  createWallConcreteTexture,
  createWallBrickTexture,
  createWallDarkTexture,
  createWallDamagedTexture,
} from "./textures.js";

// ============================================================
// THEATER LEVEL — "The Grand Hall"
// A ruined theater/ceremonial hall with:
//   - Large downstairs arena (central hall + wings)
//   - Full upstairs balcony wrapping 3 sides
//   - Left staircase + Right staircase
//   - Zombie spawn windows, doors, wall buys, power switch
// ============================================================

const HW = ROOM_WIDTH / 2; // 30
const HD = ROOM_DEPTH / 2; // 30
const SFH = SECOND_FLOOR_HEIGHT; // 4
const FT = FLOOR_THICKNESS; // 0.25

export function createRoom(scene) {
  const obstacles = [];
  const flickerLights = [];
  const stairWaypoints = [];
  const spawnPoints = { downstairs: [], upstairs: [] };

  // --- Materials ---
  const mats = buildMaterials();

  // ===========================
  // FLOOR
  // ===========================
  addMesh(scene, new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH), mats.floor, {
    rx: -Math.PI / 2,
    shadow: "receive",
  });

  // ===========================
  // CEILING
  // ===========================
  addMesh(
    scene,
    new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH),
    mats.ceiling,
    { y: ROOM_HEIGHT, rx: Math.PI / 2, shadow: "receive" },
  );

  // ===========================
  // OUTER WALLS (4 sides, thick)
  // ===========================
  const WT = 0.5; // wall thickness
  // Back wall (-Z) — dark stained concrete
  addBox(
    scene,
    obstacles,
    mats.wallDark,
    ROOM_WIDTH,
    ROOM_HEIGHT,
    WT,
    0,
    ROOM_HEIGHT / 2,
    -HD,
  );
  // Front wall (+Z) — concrete with cracks
  addBox(
    scene,
    obstacles,
    mats.wallConcrete,
    ROOM_WIDTH,
    ROOM_HEIGHT,
    WT,
    0,
    ROOM_HEIGHT / 2,
    HD,
  );
  // Left wall (-X) — exposed brick
  addBox(
    scene,
    obstacles,
    mats.wallBrick,
    WT,
    ROOM_HEIGHT,
    ROOM_DEPTH,
    -HW,
    ROOM_HEIGHT / 2,
    0,
  );
  // Right wall (+X) — damaged plaster
  addBox(
    scene,
    obstacles,
    mats.wallDamaged,
    WT,
    ROOM_HEIGHT,
    ROOM_DEPTH,
    HW,
    ROOM_HEIGHT / 2,
    0,
  );

  // ===========================
  // HALLWAY FLOOR ZONES (different texture from main floor)
  // ===========================
  // Left corridor floor (under left balcony)
  addMesh(
    scene,
    new THREE.PlaneGeometry(7, ROOM_DEPTH - 10),
    mats.hallwayFloor,
    {
      rx: -Math.PI / 2,
      x: -HW + 3.5,
      y: 0.01,
      z: 0,
      shadow: "receive",
    },
  );
  // Right corridor floor (under right balcony)
  addMesh(
    scene,
    new THREE.PlaneGeometry(7, ROOM_DEPTH - 10),
    mats.hallwayFloor,
    {
      rx: -Math.PI / 2,
      x: HW - 3.5,
      y: 0.01,
      z: 0,
      shadow: "receive",
    },
  );
  // Back area floor (near stage, dirt/rubble)
  addMesh(scene, new THREE.PlaneGeometry(ROOM_WIDTH - 16, 10), mats.dirtFloor, {
    rx: -Math.PI / 2,
    y: 0.01,
    z: -HD + 12,
    shadow: "receive",
  });

  // ===========================
  // STAGE PLATFORM (back center — elevated area)
  // ===========================
  const stageW = 20,
    stageH = 0.8,
    stageD = 8;
  addBox(
    scene,
    obstacles,
    mats.darkWood,
    stageW,
    stageH,
    stageD,
    0,
    stageH / 2,
    -HD + stageD / 2 + 1,
  );
  // Stage front lip
  addBox(
    scene,
    null,
    mats.metalDark,
    stageW + 0.2,
    0.1,
    0.3,
    0,
    stageH,
    -HD + stageD + 1,
  );

  // ===========================
  // CENTER ARENA — The Grand Hall
  // Open area for kiting and combat
  // ===========================

  // Central chandelier anchor (decorative)
  const chandelier = createChandelier(
    scene,
    flickerLights,
    0,
    ROOM_HEIGHT - 0.5,
    0,
  );

  // 6 structural columns — positioned to NOT block stair access
  // Stairs are at x≈-21 and x≈21, z=5 going toward -Z
  const colPositions = [
    [-10, -10],
    [10, -10], // back pair
    [-10, 8],
    [10, 8], // front pair
    [-16, -2],
    [16, -2], // side pair (away from stairs)
  ];
  for (const [cx, cz] of colPositions) {
    createOrnateColumn(scene, obstacles, mats, cx, cz);
  }

  // ===========================
  // UPSTAIRS BALCONY — U-shape wrapping left, back, right
  // ===========================
  const balcW = 7; // balcony depth from wall

  // Back balcony (behind stage, full width)
  createBalconyPlatform(
    scene,
    obstacles,
    mats,
    0,
    -HD + balcW / 2,
    ROOM_WIDTH - 1,
    balcW,
  );

  // Left balcony — split into two sections with gap for staircase opening
  // Stairs come up at z ≈ stairStartZ to stairStartZ + 11.2
  // Gap from z=-21 to z=-21+14*0.8 = z=-9.8, so gap center ≈ z=-15
  const stairGapStart = -HD + balcW + 2; // z=-21
  const stairGapEnd = stairGapStart + STAIR_STEP_COUNT * STAIR_STEP_DEPTH + 2; // z≈-7.8
  const leftBalcBackLen = stairGapStart - (-HD + balcW); // section before stair gap
  const leftBalcFrontLen = HD - 2 - stairGapEnd; // section after stair gap

  // Left balcony — back section (from back balcony to stair gap)
  if (leftBalcBackLen > 1) {
    createBalconyPlatform(
      scene,
      obstacles,
      mats,
      -HW + balcW / 2,
      -HD + balcW + leftBalcBackLen / 2,
      balcW,
      leftBalcBackLen,
    );
  }
  // Left balcony — front section (from stair gap to front)
  if (leftBalcFrontLen > 1) {
    createBalconyPlatform(
      scene,
      obstacles,
      mats,
      -HW + balcW / 2,
      stairGapEnd + leftBalcFrontLen / 2,
      balcW,
      leftBalcFrontLen,
    );
  }

  // Right balcony — same split for right staircase
  if (leftBalcBackLen > 1) {
    createBalconyPlatform(
      scene,
      obstacles,
      mats,
      HW - balcW / 2,
      -HD + balcW + leftBalcBackLen / 2,
      balcW,
      leftBalcBackLen,
    );
  }
  if (leftBalcFrontLen > 1) {
    createBalconyPlatform(
      scene,
      obstacles,
      mats,
      HW - balcW / 2,
      stairGapEnd + leftBalcFrontLen / 2,
      balcW,
      leftBalcFrontLen,
    );
  }

  // Balcony underside ceilings
  const totalSideLen = leftBalcBackLen + leftBalcFrontLen;
  addMesh(
    scene,
    new THREE.PlaneGeometry(ROOM_WIDTH - 1, balcW),
    mats.undersideMat,
    { y: SFH - 0.01, rx: Math.PI / 2, z: -HD + balcW / 2 },
  );
  // Left side underside (skip stair gap region)
  if (leftBalcBackLen > 1) {
    addMesh(
      scene,
      new THREE.PlaneGeometry(balcW, leftBalcBackLen),
      mats.undersideMat,
      {
        y: SFH - 0.01,
        rx: Math.PI / 2,
        x: -HW + balcW / 2,
        z: -HD + balcW + leftBalcBackLen / 2,
      },
    );
  }
  if (leftBalcFrontLen > 1) {
    addMesh(
      scene,
      new THREE.PlaneGeometry(balcW, leftBalcFrontLen),
      mats.undersideMat,
      {
        y: SFH - 0.01,
        rx: Math.PI / 2,
        x: -HW + balcW / 2,
        z: stairGapEnd + leftBalcFrontLen / 2,
      },
    );
  }
  // Right side underside
  if (leftBalcBackLen > 1) {
    addMesh(
      scene,
      new THREE.PlaneGeometry(balcW, leftBalcBackLen),
      mats.undersideMat,
      {
        y: SFH - 0.01,
        rx: Math.PI / 2,
        x: HW - balcW / 2,
        z: -HD + balcW + leftBalcBackLen / 2,
      },
    );
  }
  if (leftBalcFrontLen > 1) {
    addMesh(
      scene,
      new THREE.PlaneGeometry(balcW, leftBalcFrontLen),
      mats.undersideMat,
      {
        y: SFH - 0.01,
        rx: Math.PI / 2,
        x: HW - balcW / 2,
        z: stairGapEnd + leftBalcFrontLen / 2,
      },
    );
  }

  // ===========================
  // RAILINGS (inner edges of balcony, with gap at stair openings)
  // ===========================
  const railH = 1.1;
  // Back balcony front railing
  createRailing(
    scene,
    obstacles,
    mats.rail,
    0,
    -HD + balcW,
    ROOM_WIDTH - balcW * 2 - 2,
    railH,
    "z",
  );

  // Left balcony railing — back section
  if (leftBalcBackLen > 1) {
    createRailing(
      scene,
      obstacles,
      mats.rail,
      -HW + balcW,
      -HD + balcW + leftBalcBackLen / 2,
      leftBalcBackLen,
      railH,
      "x",
    );
  }
  // Left balcony railing — front section
  if (leftBalcFrontLen > 1) {
    createRailing(
      scene,
      obstacles,
      mats.rail,
      -HW + balcW,
      stairGapEnd + leftBalcFrontLen / 2,
      leftBalcFrontLen,
      railH,
      "x",
    );
  }
  // Right balcony railing — back section
  if (leftBalcBackLen > 1) {
    createRailing(
      scene,
      obstacles,
      mats.rail,
      HW - balcW,
      -HD + balcW + leftBalcBackLen / 2,
      leftBalcBackLen,
      railH,
      "x",
    );
  }
  // Right balcony railing — front section
  if (leftBalcFrontLen > 1) {
    createRailing(
      scene,
      obstacles,
      mats.rail,
      HW - balcW,
      stairGapEnd + leftBalcFrontLen / 2,
      leftBalcFrontLen,
      railH,
      "x",
    );
  }

  // ===========================
  // LEFT STAIRCASE — along left wall, goes toward -Z (back wall)
  // Positioned INSIDE the left balcony footprint so the top connects
  // ===========================
  const leftStairX = -HW + balcW / 2; // x=-26.5, inside left balcony (x=-30 to -23)
  const stairStartZ = -HD + balcW + 2; // z=-21, starts just past the back balcony
  buildStaircase(
    scene,
    obstacles,
    stairWaypoints,
    mats,
    leftStairX,
    stairStartZ,
    0,
    1, // direction: goes toward front (+Z), UP from the back corner
    "L",
  );

  // Landing platform at stair top — bridges stairs to open balcony area
  const stairTopZ_L = stairStartZ + STAIR_STEP_COUNT * STAIR_STEP_DEPTH;
  addBox(
    scene,
    obstacles,
    mats.balconyFloor,
    STAIR_WIDTH + 2,
    FT,
    2,
    leftStairX,
    SFH,
    stairTopZ_L + 1,
  );

  // Stair approach lights (bottom and top)
  const stairLightL = new THREE.PointLight(0xffaa44, 2.0, 12, 2);
  stairLightL.position.set(leftStairX, 2, stairStartZ);
  scene.add(stairLightL);
  const stairLightL2 = new THREE.PointLight(0xffaa44, 1.5, 8, 2);
  stairLightL2.position.set(leftStairX, SFH + 2, stairTopZ_L);
  scene.add(stairLightL2);

  // ===========================
  // RIGHT STAIRCASE — along right wall, goes toward +Z (front)
  // Positioned INSIDE the right balcony footprint so the top connects
  // ===========================
  const rightStairX = HW - balcW / 2; // x=26.5, inside right balcony (x=23 to 30)
  buildStaircase(
    scene,
    obstacles,
    stairWaypoints,
    mats,
    rightStairX,
    stairStartZ,
    0,
    1, // direction: goes toward front (+Z)
    "R",
  );

  // Landing platform at stair top
  const stairTopZ_R = stairStartZ + STAIR_STEP_COUNT * STAIR_STEP_DEPTH;
  addBox(
    scene,
    obstacles,
    mats.balconyFloor,
    STAIR_WIDTH + 2,
    FT,
    2,
    rightStairX,
    SFH,
    stairTopZ_R + 1,
  );

  // Stair approach lights
  const stairLightR = new THREE.PointLight(0xffaa44, 2.0, 12, 2);
  stairLightR.position.set(rightStairX, 2, stairStartZ);
  scene.add(stairLightR);
  const stairLightR2 = new THREE.PointLight(0xffaa44, 1.5, 8, 2);
  stairLightR2.position.set(rightStairX, SFH + 2, stairTopZ_R);
  scene.add(stairLightR2);

  // ===========================
  // ZOMBIE SPAWN POINTS
  // ===========================
  // Downstairs windows (4)
  const windowSpawns = [
    { x: -20, z: -HD + 0.3, rotY: 0 },
    { x: 15, z: -HD + 0.3, rotY: 0 },
    { x: -HW + 0.3, z: 5, rotY: Math.PI / 2 },
    { x: HW - 0.3, z: -5, rotY: Math.PI / 2 },
    { x: -HW + 0.3, z: 18, rotY: Math.PI / 2 },
    { x: HW - 0.3, z: 15, rotY: Math.PI / 2 },
  ];
  for (const ws of windowSpawns) {
    createBoardedWindow(scene, mats, ws.x, ws.z, ws.rotY);
    spawnPoints.downstairs.push(
      new THREE.Vector3(
        ws.x + (ws.rotY === 0 ? 0 : Math.sign(ws.x) * -2),
        0,
        ws.z + (ws.rotY === 0 ? 2 : 0),
      ),
    );
  }

  // Downstairs hall spawns (2) — from main door area
  spawnPoints.downstairs.push(new THREE.Vector3(-8, 0, HD - 3));
  spawnPoints.downstairs.push(new THREE.Vector3(8, 0, HD - 3));

  // Upstairs spawns (2)
  spawnPoints.upstairs.push(new THREE.Vector3(-HW + 3, SFH + 0.2, -HD + 3));
  spawnPoints.upstairs.push(new THREE.Vector3(HW - 3, SFH + 0.2, -HD + 3));

  // Staircase pressure spawns (near stair bases)
  spawnPoints.downstairs.push(
    new THREE.Vector3(leftStairX, 0, stairStartZ - 2),
  );
  spawnPoints.downstairs.push(
    new THREE.Vector3(rightStairX, 0, stairStartZ - 2),
  );

  // ===========================
  // MAIN ENTRANCE (front wall, damaged double doors)
  // ===========================
  createMainDoor(scene, 0, HD - 0.3, mats);

  // ===========================
  // COVER OBJECTS — Crates, barrels, overturned furniture
  // ===========================
  const coverConfigs = [
    // Center arena cover (kiting obstacles)
    { p: [0, 0.6, 3], s: [2, 1.2, 2], m: mats.crate },
    { p: [-5, 0.5, 0], s: [1.8, 1.0, 1.2], m: mats.crate },
    { p: [6, 0.5, -3], s: [1.2, 1.0, 1.8], m: mats.crate },
    // Left wing (moved away from stairs at x=-21)
    { p: [-18, 0.6, 16], s: [1.5, 1.2, 1.2], m: mats.crate },
    { p: [-16, 0.6, 20], s: [1.2, 1.2, 1.5], m: mats.crate },
    // Right wing (moved away from stairs at x=21)
    { p: [18, 0.6, 16], s: [1.2, 1.2, 1.2], m: mats.crate },
    { p: [16, 0.6, 20], s: [1.5, 1.2, 1.0], m: mats.crate },
    // Near front entrance
    { p: [5, 0.6, 22], s: [2, 1.2, 1], m: mats.crate },
    { p: [-7, 0.6, 20], s: [1.2, 1.2, 1.5], m: mats.crate },
    // Stage area flanks
    { p: [-12, 0.5, -20], s: [1.5, 1.0, 1.2], m: mats.crate },
    { p: [12, 0.5, -18], s: [1.2, 1.0, 1.5], m: mats.crate },
  ];
  for (const c of coverConfigs) {
    addBox(scene, obstacles, c.m, ...c.s, ...c.p);
  }

  // Barrels
  const barrelCfg = [
    [20, -20],
    [-15, 22],
    [14, 22],
    [-8, 15],
    [0, 16],
    [-20, -16],
    [20, -16],
  ];
  for (const [bx, bz] of barrelCfg) {
    createBarrel(scene, obstacles, mats, bx, bz);
  }

  // Overturned tables
  createTable(scene, obstacles, mats, -10, 6, 0.4);
  createTable(scene, obstacles, mats, 8, 18, -0.2);
  createTable(scene, obstacles, mats, -4, -10, Math.PI / 2 + 0.3);

  // Scattered chairs
  const chairPos = [
    [-8, 8],
    [12, -8],
    [5, 22],
    [-14, -14],
    [20, 10],
    [-3, 12],
  ];
  for (const [cx, cz] of chairPos) {
    createChair(scene, mats, cx, cz);
  }

  // ===========================
  // UPSTAIRS FEATURES
  // ===========================
  // Mystery box (back balcony center)
  createMysteryBox(scene, obstacles, 0, SFH, -HD + 3);
  // Perk machine (left balcony)
  createPerkMachine(scene, obstacles, -HW + 3, SFH, 5);
  // Power switch (right balcony)
  createPowerSwitch(scene, HW - 3, SFH + FT / 2 + 1, 0);

  // ===========================
  // WEAPON WALL (left wall, ground floor)
  // ===========================
  createWeaponWall(scene, -HW + 0.6, 0);

  // ===========================
  // AMMO STATION (right side ground floor)
  // ===========================
  createAmmoStation(scene, HW - 2, 8);

  // ===========================
  // DEBRIS
  // ===========================
  scatterDebris(scene, mats, 40, 0, ROOM_WIDTH - 6, ROOM_DEPTH - 6);
  scatterDebris(
    scene,
    mats,
    15,
    SFH + FT / 2,
    8,
    ROOM_DEPTH - 10,
    -HW + 4,
    -HD + 2,
  );

  // ===========================
  // HANGING CABLES & ROPES
  // ===========================
  for (let i = 0; i < 15; i++) {
    const cx = (Math.random() - 0.5) * (ROOM_WIDTH - 12);
    const cz = (Math.random() - 0.5) * (ROOM_DEPTH - 12);
    const hangLen = 0.4 + Math.random() * 2.5;
    addMesh(
      scene,
      new THREE.CylinderGeometry(0.01, 0.01, hangLen, 4),
      new THREE.MeshBasicMaterial({ color: 0x222222 }),
      { x: cx, y: ROOM_HEIGHT - hangLen / 2, z: cz },
    );
  }

  // ===========================
  // BLOOD STAINS
  // ===========================
  createBloodStains(scene);

  // ===========================
  // LIGHTING
  // ===========================
  setupLighting(scene, flickerLights);

  // ===========================
  // FOG & SKY
  // ===========================
  scene.fog = new THREE.FogExp2(0x020204, 0.006);
  scene.background = new THREE.Color(0x020204);

  return { obstacles, flickerLights, stairWaypoints, spawnPoints };
}

// ============================================================
// MATERIALS
// ============================================================
function buildMaterials() {
  return {
    // Real PNG textures for floors (tiled, not stretched)
    floor: new THREE.MeshStandardMaterial({
      map: createMansionFloorTexture(),
      roughness: 0.85,
      metalness: 0.05,
    }),
    hallwayFloor: new THREE.MeshStandardMaterial({
      map: createHallwayFloorTexture(),
      roughness: 0.8,
      metalness: 0.05,
    }),
    balconyFloor: new THREE.MeshStandardMaterial({
      map: createBalconyFloorTexture(),
      roughness: 0.75,
      metalness: 0.05,
    }),
    step: new THREE.MeshStandardMaterial({
      map: createStairTexture(),
      roughness: 0.7,
      metalness: 0.1,
    }),
    dirtFloor: new THREE.MeshStandardMaterial({
      map: createDirtTexture(),
      roughness: 0.9,
    }),
    // Real PNG wall textures (tiled per zone)
    wallConcrete: new THREE.MeshStandardMaterial({
      map: createWallConcreteTexture(),
      roughness: 0.85,
    }),
    wallBrick: new THREE.MeshStandardMaterial({
      map: createWallBrickTexture(),
      roughness: 0.8,
    }),
    wallDark: new THREE.MeshStandardMaterial({
      map: createWallDarkTexture(),
      roughness: 0.85,
    }),
    wallDamaged: new THREE.MeshStandardMaterial({
      map: createWallDamagedTexture(),
      roughness: 0.9,
    }),
    // Procedural textures for details
    ceiling: new THREE.MeshStandardMaterial({
      map: createCeilingTexture(),
      roughness: 0.95,
    }),
    wallpaper: new THREE.MeshStandardMaterial({
      map: createWallpaperTexture(),
      roughness: 0.85,
    }),
    concrete: new THREE.MeshStandardMaterial({
      map: createConcreteTexture(),
      roughness: 0.85,
      metalness: 0.1,
    }),
    wood: new THREE.MeshStandardMaterial({
      map: createWoodTexture(),
      roughness: 0.75,
    }),
    darkWood: new THREE.MeshStandardMaterial({
      color: 0x2a1a0e,
      roughness: 0.7,
    }),
    metal: new THREE.MeshStandardMaterial({
      map: createMetalTexture(),
      roughness: 0.4,
      metalness: 0.7,
    }),
    metalDark: new THREE.MeshStandardMaterial({
      color: 0x2a2a2e,
      roughness: 0.4,
      metalness: 0.7,
    }),
    crate: new THREE.MeshStandardMaterial({
      map: createWoodTexture(),
      roughness: 0.7,
    }),
    rail: new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.5,
      metalness: 0.6,
    }),
    undersideMat: new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.9,
    }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }),
    chair: new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8 }),
    barrel: new THREE.MeshStandardMaterial({
      color: 0x334433,
      roughness: 0.6,
      metalness: 0.3,
    }),
    columnBase: new THREE.MeshStandardMaterial({
      map: createConcreteTexture(),
      roughness: 0.7,
      metalness: 0.2,
    }),
    columnTop: new THREE.MeshStandardMaterial({
      color: 0x444440,
      roughness: 0.6,
      metalness: 0.3,
    }),
  };
}

// ============================================================
// HELPERS
// ============================================================

function addMesh(scene, geo, mat, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (opts.x) m.position.x = opts.x;
  if (opts.y) m.position.y = opts.y;
  if (opts.z) m.position.z = opts.z;
  if (opts.rx) m.rotation.x = opts.rx;
  if (opts.ry) m.rotation.y = opts.ry;
  if (opts.shadow === "receive") m.receiveShadow = true;
  if (opts.shadow === "cast") m.castShadow = true;
  if (opts.shadow === "both") {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  scene.add(m);
  return m;
}

function addBox(scene, obstacles, mat, w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (obstacles) {
    obstacles.push({
      min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
      max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
    });
  }
  return mesh;
}

// ============================================================
// BALCONY PLATFORM
// ============================================================
function createBalconyPlatform(scene, obstacles, mats, x, z, w, d) {
  addBox(scene, obstacles, mats.balconyFloor, w, FT, d, x, SFH, z);

  // Support columns underneath
  const spacing = Math.max(w, d) > 15 ? 5 : 4;
  const startX = x - w / 2 + 1.5;
  const endX = x + w / 2 - 1.5;
  const startZ = z - d / 2 + 1.5;
  const endZ = z + d / 2 - 1.5;
  for (let bx = startX; bx <= endX; bx += spacing) {
    for (let bz = startZ; bz <= endZ; bz += spacing) {
      addBox(scene, null, mats.concrete, 0.25, SFH, 0.25, bx, SFH / 2, bz);
    }
  }
}

// ============================================================
// RAILING
// ============================================================
function createRailing(scene, obstacles, mat, x, z, length, height, axis) {
  const thick = 0.08;
  const w = axis === "z" ? length : thick;
  const d = axis === "z" ? thick : length;
  const ry = SFH + height / 2 + FT / 2;

  const rail = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), mat);
  rail.position.set(x, ry, z);
  rail.castShadow = true;
  scene.add(rail);

  obstacles.push({
    min: new THREE.Vector3(x - w / 2, SFH, z - d / 2),
    max: new THREE.Vector3(x + w / 2, SFH + height + FT, z + d / 2),
  });

  // Posts
  const count = Math.floor(length / 2.5);
  for (let i = 0; i <= count; i++) {
    const t = i / count - 0.5;
    const px = axis === "z" ? x + t * length : x;
    const pz = axis === "z" ? z : z + t * length;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, height, 6),
      mat,
    );
    post.position.set(px, ry, pz);
    scene.add(post);
  }
}

// ============================================================
// STAIRCASE
// ============================================================
function buildStaircase(
  scene,
  obstacles,
  stairWaypoints,
  mats,
  baseX,
  baseZ,
  dirX,
  dirZ,
  id,
) {
  const waypoints = [];

  for (let i = 0; i < STAIR_STEP_COUNT; i++) {
    const stepY = (i + 0.5) * STAIR_STEP_HEIGHT;
    const stepX = baseX + dirX * (i + 0.5) * STAIR_STEP_DEPTH;
    const stepZ = baseZ + dirZ * (i + 0.5) * STAIR_STEP_DEPTH;

    addBox(
      scene,
      obstacles,
      mats.step,
      STAIR_WIDTH,
      STAIR_STEP_HEIGHT,
      STAIR_STEP_DEPTH,
      stepX,
      stepY,
      stepZ,
    );
    // Each step obstacle: top face is walkable, extends down to previous step
    const lastObs = obstacles[obstacles.length - 1];
    lastObs.min.y = i * STAIR_STEP_HEIGHT;

    waypoints.push(
      new THREE.Vector3(stepX, (i + 1) * STAIR_STEP_HEIGHT, stepZ),
    );
  }

  // Side railing
  for (let i = 0; i < STAIR_STEP_COUNT; i += 3) {
    const sy = (i + 1) * STAIR_STEP_HEIGHT;
    const sx = baseX + dirX * (i + 0.5) * STAIR_STEP_DEPTH;
    const sz = baseZ + dirZ * (i + 0.5) * STAIR_STEP_DEPTH;
    const perpX = dirZ !== 0 ? STAIR_WIDTH / 2 - 0.1 : 0;
    const perpZ = dirX !== 0 ? STAIR_WIDTH / 2 - 0.1 : 0;

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 1.0, 6),
      mats.rail,
    );
    post.position.set(sx + perpX, sy + 0.5, sz + perpZ);
    scene.add(post);
  }

  const bottomPos = new THREE.Vector3(baseX, 0, baseZ);
  const topPos = new THREE.Vector3(
    baseX + dirX * STAIR_STEP_COUNT * STAIR_STEP_DEPTH,
    SFH,
    baseZ + dirZ * STAIR_STEP_COUNT * STAIR_STEP_DEPTH,
  );

  stairWaypoints.push({
    id,
    bottom: bottomPos,
    top: topPos,
    waypoints,
    dirX,
    dirZ,
  });
}

// ============================================================
// ORNATE COLUMN
// ============================================================
function createOrnateColumn(scene, obstacles, mats, cx, cz) {
  const r = 0.5;
  // Main shaft
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, ROOM_HEIGHT, 12),
    mats.columnBase,
  );
  shaft.position.set(cx, ROOM_HEIGHT / 2, cz);
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  scene.add(shaft);

  // Base
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(r + 0.2, r + 0.25, 0.4, 12),
    mats.columnTop,
  );
  base.position.set(cx, 0.2, cz);
  scene.add(base);

  // Capital
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(r + 0.25, r + 0.15, 0.35, 12),
    mats.columnTop,
  );
  cap.position.set(cx, ROOM_HEIGHT - 0.175, cz);
  scene.add(cap);

  obstacles.push({
    min: new THREE.Vector3(cx - r - 0.1, 0, cz - r - 0.1),
    max: new THREE.Vector3(cx + r + 0.1, ROOM_HEIGHT, cz + r + 0.1),
  });
}

// ============================================================
// CHANDELIER
// ============================================================
function createChandelier(scene, flickerLights, x, y, z) {
  // Central ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.06, 8, 24),
    new THREE.MeshStandardMaterial({
      color: 0x8b7333,
      metalness: 0.8,
      roughness: 0.3,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, y, z);
  scene.add(ring);

  // Chain to ceiling
  const chain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4),
    new THREE.MeshStandardMaterial({ color: 0x666655, metalness: 0.7 }),
  );
  chain.position.set(x, ROOM_HEIGHT - 0.25, z);
  scene.add(chain);

  // Candle lights around the ring
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const lx = x + Math.cos(angle) * 1.5;
    const lz = z + Math.sin(angle) * 1.5;

    // Candle holder
    const holder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6),
      new THREE.MeshStandardMaterial({ color: 0x8b7333, metalness: 0.7 }),
    );
    holder.position.set(lx, y - 0.06, lz);
    scene.add(holder);

    // Flame glow
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffaa44 }),
    );
    flame.position.set(lx, y + 0.02, lz);
    scene.add(flame);
  }

  // Main chandelier light
  const light = new THREE.PointLight(0xffaa55, 4.0, 35, 2);
  light.position.set(x, y, z);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  scene.add(light);

  flickerLights.push({
    light,
    bulb: ring,
    baseIntensity: 4.0,
    flickerSpeed: 3 + Math.random() * 2,
    flickerAmount: 0.12,
    phase: 0,
  });
}

// ============================================================
// BOARDED WINDOW
// ============================================================
function createBoardedWindow(scene, mats, x, z, rotY) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  // Dark recess
  const recess = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2, 0.4), mats.dark);
  recess.position.set(0, 2.5, 0);
  g.add(recess);

  // Boards
  const boardMat = mats.wood.clone();
  const boards = [
    { y: 1.8, rot: 0.05, w: 2.4 },
    { y: 2.2, rot: -0.08, w: 2.2 },
    { y: 2.6, rot: 0.03, w: 2.5 },
    { y: 3.0, rot: -0.1, w: 2.0 },
    { y: 3.3, rot: 0.06, w: 2.3 },
  ];
  for (const b of boards) {
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(b.w, 0.12, 0.06),
      boardMat,
    );
    board.position.set(0, b.y, 0.22);
    board.rotation.z = b.rot;
    board.castShadow = true;
    g.add(board);
  }

  // Faint light leak
  const leak = new THREE.PointLight(0x6688aa, 0.25, 5, 2);
  leak.position.set(0, 2.5, 0.5);
  g.add(leak);

  scene.add(g);
}

// ============================================================
// MAIN DOOR
// ============================================================
function createMainDoor(scene, x, z, mats) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const fW = 3.5,
    fH = 5;
  // Frame
  addMesh(scene, new THREE.BoxGeometry(0.2, fH, 0.25), mats.metalDark, {
    x: x - fW / 2,
    y: fH / 2,
    z,
  });
  addMesh(scene, new THREE.BoxGeometry(0.2, fH, 0.25), mats.metalDark, {
    x: x + fW / 2,
    y: fH / 2,
    z,
  });
  addMesh(scene, new THREE.BoxGeometry(fW + 0.4, 0.2, 0.25), mats.metalDark, {
    x,
    y: fH,
    z,
  });

  // Door (ajar)
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(fW * 0.48, fH - 0.3, 0.08),
    mats.metalDark,
  );
  door.geometry.translate(fW * 0.24, 0, 0);
  door.position.set(x - fW / 2 + 0.1, fH / 2, z);
  door.rotation.y = -0.3;
  door.castShadow = true;
  scene.add(door);

  // Light through
  const doorLight = new THREE.SpotLight(0x556677, 0.5, 10, Math.PI / 6, 0.5);
  doorLight.position.set(x, 3, z + 1);
  doorLight.target.position.set(x, 0, z - 3);
  scene.add(doorLight);
  scene.add(doorLight.target);
}

// ============================================================
// BARREL
// ============================================================
function createBarrel(scene, obstacles, mats, x, z) {
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 1.2, 10),
    mats.barrel,
  );
  barrel.position.set(x, 0.6, z);
  barrel.castShadow = true;
  scene.add(barrel);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.025, 6, 10),
    mats.metal,
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(x, 1.2, z);
  scene.add(rim);

  obstacles.push({
    min: new THREE.Vector3(x - 0.5, 0, z - 0.5),
    max: new THREE.Vector3(x + 0.5, 1.2, z + 0.5),
  });
}

// ============================================================
// TABLE (overturned)
// ============================================================
function createTable(scene, obstacles, mats, x, z, rotZ) {
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.08, 1.2),
    mats.darkWood,
  );
  top.position.set(x, 0.5, z);
  top.rotation.z = rotZ;
  top.castShadow = true;
  scene.add(top);
  obstacles.push({
    min: new THREE.Vector3(x - 1.2, 0, z - 0.8),
    max: new THREE.Vector3(x + 1.2, 1.0, z + 0.8),
  });
}

// ============================================================
// CHAIR
// ============================================================
function createChair(scene, mats, x, z) {
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.05, 0.5),
    mats.chair,
  );
  seat.position.set(x, 0.45, z);
  seat.rotation.y = Math.random() * Math.PI * 2;
  scene.add(seat);
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.55, 0.05),
    mats.chair,
  );
  back.position.set(0, 0.28, -0.22);
  seat.add(back);
  for (const [lx, lz] of [
    [-0.2, -0.2],
    [0.2, -0.2],
    [-0.2, 0.2],
    [0.2, 0.2],
  ]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.45, 0.04),
      mats.chair,
    );
    leg.position.set(lx, -0.22, lz);
    seat.add(leg);
  }
}

// ============================================================
// MYSTERY BOX
// ============================================================
function createMysteryBox(scene, obstacles, x, baseY, z) {
  const by = baseY + FT / 2 + 0.35;
  addBox(
    scene,
    obstacles,
    new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.6 }),
    1.2,
    0.7,
    0.6,
    x,
    by,
    z,
  );
  // Lid
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.06, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x3a2a1a }),
  );
  lid.position.set(x, by + 0.38, z + 0.1);
  lid.rotation.x = -0.2;
  scene.add(lid);
  // ? mark
  const qMat = new THREE.MeshStandardMaterial({
    color: 0xffcc00,
    emissive: 0xffaa00,
    emissiveIntensity: 0.8,
  });
  addMesh(scene, new THREE.BoxGeometry(0.08, 0.25, 0.02), qMat, {
    x,
    y: by + 0.05,
    z: z + 0.31,
  });
  addMesh(scene, new THREE.BoxGeometry(0.08, 0.08, 0.02), qMat, {
    x,
    y: by - 0.17,
    z: z + 0.31,
  });
  scene.add(
    new THREE.PointLight(0xffcc00, 1.0, 5, 2)
      .translateX(x)
      .translateY(by + 0.5)
      .translateZ(z),
  );
}

// ============================================================
// PERK MACHINE
// ============================================================
function createPerkMachine(scene, obstacles, x, baseY, z) {
  const my = baseY + FT / 2;
  addBox(
    scene,
    obstacles,
    new THREE.MeshStandardMaterial({ color: 0x1a2a1a, roughness: 0.7 }),
    0.8,
    2.0,
    0.6,
    x,
    my + 1,
    z,
  );
  // Screen
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    emissive: 0x00ff66,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.9,
  });
  addMesh(scene, new THREE.BoxGeometry(0.6, 0.8, 0.02), screenMat, {
    x,
    y: my + 1.3,
    z: z + 0.31,
  });
  const glow = new THREE.PointLight(0x00ff66, 0.6, 4, 2);
  glow.position.set(x, my + 1.5, z + 0.5);
  scene.add(glow);
}

// ============================================================
// POWER SWITCH
// ============================================================
function createPowerSwitch(scene, x, y, z) {
  // Panel
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.8, 0.08),
    new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.7,
      metalness: 0.4,
    }),
  );
  panel.position.set(x, y, z);
  scene.add(panel);

  // Switch handle
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.3, 0.06),
    new THREE.MeshStandardMaterial({
      color: 0xcc3333,
      roughness: 0.5,
      metalness: 0.3,
    }),
  );
  handle.position.set(x, y + 0.1, z + 0.06);
  scene.add(handle);

  // Warning label
  const label = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.12, 0.01),
    new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      emissive: 0xff8800,
      emissiveIntensity: 0.3,
    }),
  );
  label.position.set(x, y + 0.48, z + 0.05);
  scene.add(label);

  // Small indicator light (red = off)
  const indicator = new THREE.PointLight(0xff2200, 0.3, 2, 2);
  indicator.position.set(x, y + 0.5, z + 0.1);
  scene.add(indicator);
}

// ============================================================
// WEAPON WALL
// ============================================================
function createWeaponWall(scene, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  function addToGroup(geo, mat, px, py, pz) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    g.add(m);
    return m;
  }

  // Backboard
  addToGroup(
    new THREE.BoxGeometry(0.1, 3, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8 }),
    0,
    2.5,
    0,
  );

  // Gun outlines with glow
  const gunMat = new THREE.MeshStandardMaterial({
    color: 0x00ff44,
    emissive: 0x00ff44,
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.7,
  });

  addToGroup(new THREE.BoxGeometry(0.03, 0.08, 1.0), gunMat, 0.08, 3.4, -2);
  addToGroup(
    new THREE.BoxGeometry(0.03, 0.1, 1.3),
    gunMat.clone(),
    0.08,
    2.7,
    0,
  );
  addToGroup(
    new THREE.BoxGeometry(0.03, 0.08, 0.9),
    gunMat.clone(),
    0.08,
    2.0,
    2,
  );

  // Price labels
  const labelMat = new THREE.MeshStandardMaterial({
    color: 0xffcc00,
    emissive: 0xffaa00,
    emissiveIntensity: 0.5,
  });
  addToGroup(new THREE.BoxGeometry(0.02, 0.08, 0.4), labelMat, 0.08, 3.0, -2);
  addToGroup(
    new THREE.BoxGeometry(0.02, 0.08, 0.4),
    labelMat.clone(),
    0.08,
    2.3,
    0,
  );
  addToGroup(
    new THREE.BoxGeometry(0.02, 0.08, 0.4),
    labelMat.clone(),
    0.08,
    1.6,
    2,
  );

  // Glow light
  const glow = new THREE.PointLight(0x00ff44, 0.4, 6, 2);
  glow.position.set(0.5, 2.5, 0);
  g.add(glow);

  // Header bar
  const headerMat = new THREE.MeshStandardMaterial({
    color: 0x00ff44,
    emissive: 0x00ff44,
    emissiveIntensity: 0.6,
  });
  addToGroup(new THREE.BoxGeometry(0.02, 0.15, 4), headerMat, 0.08, 4.0, 0);

  scene.add(g);
}

// ============================================================
// AMMO STATION
// ============================================================
function createAmmoStation(scene, x, z) {
  // Green ammo crate
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.6, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.7 }),
  );
  crate.position.set(x, 0.3, z);
  crate.castShadow = true;
  scene.add(crate);

  // Ammo label
  const label = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.2, 0.02),
    new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      emissive: 0xff8800,
      emissiveIntensity: 0.4,
    }),
  );
  label.position.set(x, 0.5, z + 0.31);
  scene.add(label);

  // Small glow
  const glow = new THREE.PointLight(0xffaa00, 0.3, 3, 2);
  glow.position.set(x, 0.8, z);
  scene.add(glow);
}

// ============================================================
// DEBRIS SCATTER
// ============================================================
function scatterDebris(
  scene,
  mats,
  count,
  baseY,
  rangeW,
  rangeD,
  offsetX = 0,
  offsetZ = 0,
) {
  const debrisMat = new THREE.MeshStandardMaterial({
    color: 0x444444,
    roughness: 0.9,
  });
  for (let i = 0; i < count; i++) {
    const size = 0.08 + Math.random() * 0.2;
    const d = new THREE.Mesh(
      new THREE.BoxGeometry(size, size * 0.4, size * 0.7),
      debrisMat,
    );
    d.position.set(
      offsetX + (Math.random() - 0.5) * rangeW,
      baseY + size * 0.2,
      offsetZ + (Math.random() - 0.5) * rangeD,
    );
    d.rotation.set(0, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3);
    scene.add(d);
  }
}

// ============================================================
// BLOOD STAINS
// ============================================================
function createBloodStains(scene) {
  const bloodTex = createBloodTexture();
  const bloodMat = new THREE.MeshBasicMaterial({
    map: bloodTex,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const stains = [
    [-4, -6, 2.2],
    [6, 10, 1.8],
    [-10, 14, 2.5],
    [14, -4, 1.6],
    [0, -12, 2],
    [-12, 2, 1.3],
    [20, 16, 2],
    [-22, -16, 1.8],
    [8, -24, 2],
    [0, 22, 1.5],
  ];
  for (const [sx, sz, ss] of stains) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(ss, ss), bloodMat.clone());
    s.rotation.x = -Math.PI / 2;
    s.rotation.z = Math.random() * Math.PI * 2;
    s.position.set(sx, 0.01, sz);
    scene.add(s);
  }
}

// ============================================================
// LIGHTING
// ============================================================
function setupLighting(scene, flickerLights) {
  // Ambient fill — bright enough to clearly see geometry
  scene.add(new THREE.AmbientLight(0x556677, 2.0));
  scene.add(new THREE.HemisphereLight(0x889aaa, 0x443322, 1.0));

  // Overhead warm lights
  const configs = [
    // Warm fill lights
    { p: [-10, ROOM_HEIGHT - 0.5, -10], c: 0xff9944, i: 2.0, r: 22 },
    { p: [10, ROOM_HEIGHT - 0.5, 10], c: 0xff9944, i: 2.0, r: 22 },
    { p: [-10, ROOM_HEIGHT - 0.5, 16], c: 0xff8833, i: 1.8, r: 20 },
    { p: [10, ROOM_HEIGHT - 0.5, -16], c: 0xff8833, i: 1.8, r: 20 },
    // Cold blue corners
    { p: [-26, ROOM_HEIGHT - 0.5, -26], c: 0x4466aa, i: 1.2, r: 18 },
    { p: [26, ROOM_HEIGHT - 0.5, -26], c: 0x4466aa, i: 1.2, r: 18 },
    { p: [-26, ROOM_HEIGHT - 0.5, 26], c: 0x4466aa, i: 1.2, r: 18 },
    { p: [26, ROOM_HEIGHT - 0.5, 26], c: 0x5577bb, i: 1.2, r: 18 },
    // Balcony warm lights
    { p: [-22, SFH + 3, -22], c: 0xff6633, i: 1.5, r: 12 },
    { p: [22, SFH + 3, -22], c: 0xff6633, i: 1.5, r: 12 },
    { p: [-26, SFH + 3, 10], c: 0xff7744, i: 1.2, r: 10 },
    { p: [26, SFH + 3, 10], c: 0xff7744, i: 1.2, r: 10 },
    // Red emergency accent
    { p: [22, 2.5, -18], c: 0xff1111, i: 0.8, r: 8 },
    { p: [-22, 2.5, 20], c: 0xff1111, i: 0.8, r: 8 },
    // Stage spotlights
    { p: [-5, ROOM_HEIGHT - 0.5, -24], c: 0xffaa66, i: 2.5, r: 15 },
    { p: [5, ROOM_HEIGHT - 0.5, -24], c: 0xffaa66, i: 2.5, r: 15 },
  ];

  for (const lc of configs) {
    const light = new THREE.PointLight(lc.c, lc.i, lc.r, 2);
    light.position.set(...lc.p);
    light.castShadow = lc.i >= 2.0;
    if (light.castShadow) light.shadow.mapSize.set(512, 512);
    scene.add(light);

    // Fixture
    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.25, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 }),
    );
    housing.position.set(lc.p[0], lc.p[1] + 0.08, lc.p[2]);
    scene.add(housing);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 6, 6),
      new THREE.MeshBasicMaterial({ color: lc.c }),
    );
    bulb.position.set(lc.p[0], lc.p[1] - 0.04, lc.p[2]);
    scene.add(bulb);

    flickerLights.push({
      light,
      bulb,
      baseIntensity: lc.i,
      flickerSpeed: 2 + Math.random() * 4,
      flickerAmount: 0.15 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

/** Animate flickering lights each frame */
export function updateFlickerLights(flickerLights, time) {
  for (const fl of flickerLights) {
    const sine = Math.sin(time * fl.flickerSpeed + fl.phase);
    const noise = (Math.random() - 0.5) * 0.08;
    const flicker = 1 + sine * fl.flickerAmount + noise;
    const cutout = Math.random() > 0.998 ? 0.05 : 1;
    fl.light.intensity = fl.baseIntensity * flicker * cutout;
    if (fl.bulb && fl.bulb.material) {
      fl.bulb.material.opacity = Math.max(0.3, flicker * cutout);
    }
  }
}
