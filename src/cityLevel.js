/**
 * CityLevel.js — Loads Seoul city GLB.
 * Simple approach: ground at y=0, player at y=2, no percentage guessing.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const CITY_MODEL_PATH = "/models/asian_city.glb";

// Zombie spawn points — Y updated after city loads
const CITY_SPAWN_POINTS = {
  downstairs: [
    new THREE.Vector3(5, 0, 5),
    new THREE.Vector3(-5, 0, 5),
    new THREE.Vector3(5, 0, -5),
    new THREE.Vector3(-5, 0, -5),
    new THREE.Vector3(10, 0, 0),
    new THREE.Vector3(-10, 0, 0),
    new THREE.Vector3(0, 0, 10),
    new THREE.Vector3(0, 0, -10),
    new THREE.Vector3(8, 0, 4),
    new THREE.Vector3(-8, 0, -4),
    new THREE.Vector3(4, 0, -8),
    new THREE.Vector3(-4, 0, 8),
    new THREE.Vector3(12, 0, 6),
    new THREE.Vector3(-12, 0, -6),
    new THREE.Vector3(3, 0, 12),
    new THREE.Vector3(-3, 0, -12),
  ],
  upstairs: [],
};

export function createCityLevel(scene) {
  const obstacles = [];
  const flickerLights = [];
  const stairWaypoints = [];
  const spawnPoints = CITY_SPAWN_POINTS;

  // ── Solid ground at y=0 — always visible, player walks on this ──
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.MeshBasicMaterial({ color: 0x222220, side: THREE.DoubleSide }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.name = "ground";
  scene.add(ground);

  // Player starts at y=2 (just above ground)
  scene.userData.playerStartY = 2;
  scene.userData.groundLevel = 0;

  // ── Load city ──
  const loader = new GLTFLoader();
  loader.load(
    CITY_MODEL_PATH,
    (gltf) => {
      const city = gltf.scene;

      // ── Step 1: Measure raw model ──
      city.updateMatrixWorld(true);
      const rawBox = new THREE.Box3().setFromObject(city);
      const rawSize = new THREE.Vector3();
      rawBox.getSize(rawSize);
      console.log(
        `[CityLevel] RAW: w=${rawSize.x.toFixed(0)} h=${rawSize.y.toFixed(0)} d=${rawSize.z.toFixed(0)}`,
      );
      console.log(
        `[CityLevel] RAW min: x=${rawBox.min.x.toFixed(1)} y=${rawBox.min.y.toFixed(1)} z=${rawBox.min.z.toFixed(1)}`,
      );
      console.log(
        `[CityLevel] RAW max: x=${rawBox.max.x.toFixed(1)} y=${rawBox.max.y.toFixed(1)} z=${rawBox.max.z.toFixed(1)}`,
      );

      // ── Step 2: Auto-scale so tallest dimension is ~30 game units ──
      // Player is 1.85m tall, buildings should be 10-30x taller
      const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z);
      const TARGET = 30;
      const scale = maxDim > 0 ? TARGET / maxDim : 0.01;
      city.scale.setScalar(scale);
      console.log(
        `[CityLevel] Scale: ${scale.toFixed(6)} (maxDim=${maxDim.toFixed(0)} → ${TARGET})`,
      );

      // ── Step 3: Detect if model is Z-up (Blender default) ──
      // If raw Y extent is very small compared to Z, model is probably Z-up
      city.updateMatrixWorld(true);
      const scaledBox = new THREE.Box3().setFromObject(city);
      const scaledSize = new THREE.Vector3();
      scaledBox.getSize(scaledSize);

      if (
        scaledSize.y < scaledSize.x * 0.1 ||
        scaledSize.y < scaledSize.z * 0.1
      ) {
        // Model is flat on Y — probably Z-up, rotate to Y-up
        console.log("[CityLevel] Detected Z-up model, rotating to Y-up");
        city.rotation.x = -Math.PI / 2;
        city.updateMatrixWorld(true);
      }

      // ── Step 4: Recalculate bounds after possible rotation ──
      const finalBox = new THREE.Box3().setFromObject(city);
      const finalSize = new THREE.Vector3();
      finalBox.getSize(finalSize);
      console.log(
        `[CityLevel] FINAL: w=${finalSize.x.toFixed(1)} h=${finalSize.y.toFixed(1)} d=${finalSize.z.toFixed(1)}`,
      );

      // ── Step 5: Position so bottom of model = y=0 ──
      // This puts streets/ground at y=0 where the player walks
      city.position.y -= finalBox.min.y;

      // Center horizontally
      const centerX = (finalBox.min.x + finalBox.max.x) / 2;
      const centerZ = (finalBox.min.z + finalBox.max.z) / 2;
      city.position.x -= centerX;
      city.position.z -= centerZ;

      city.updateMatrixWorld(true);

      const checkBox = new THREE.Box3().setFromObject(city);
      console.log(
        `[CityLevel] POSITIONED: min.y=${checkBox.min.y.toFixed(2)} max.y=${checkBox.max.y.toFixed(2)}`,
      );

      // ── Step 6: Fix materials for visibility ──
      city.traverse((child) => {
        if (child.isMesh) {
          child.frustumCulled = false;
          if (child.material) {
            // Don't clone — keep original textures intact
            child.material.side = THREE.DoubleSide;
            // Boost emissive for visibility in our lighting setup
            if (child.material.emissive) {
              child.material.emissive.setRGB(0.3, 0.28, 0.25);
              child.material.emissiveIntensity = 0.6;
            }
            child.material.needsUpdate = true;
          }
        }
      });

      scene.add(city);

      // ── Step 7: Place player on ground ──
      if (scene.userData.playerRef) {
        scene.userData.playerRef.position.set(0, 2, 0);
        if (scene.userData.playerVelocity) {
          scene.userData.playerVelocity.set(0, 0, 0);
        }
        console.log("[CityLevel] Player placed at y=2 (ground level)");
      }
      if (scene.userData.playerObject) {
        scene.userData.playerObject.groundLevel = 0;
      }

      // ── Step 8: Zombie spawns at ground ──
      for (const sp of CITY_SPAWN_POINTS.downstairs) {
        sp.y = 0;
      }

      console.log(`[CityLevel] City loaded successfully`);
    },
    (progress) => {
      if (progress.total > 0) {
        const pct = Math.round((progress.loaded / progress.total) * 100);
        if (pct % 25 === 0) console.log(`[CityLevel] Loading: ${pct}%`);
      }
    },
    (err) => {
      console.error("[CityLevel] Failed to load city:", err);
    },
  );

  // ── Lighting ──
  setupCityLighting(scene, flickerLights);

  // ── Fog ──
  scene.fog = new THREE.FogExp2(0x0a0a0f, 0.006);

  return { obstacles, flickerLights, stairWaypoints, spawnPoints };
}

function setupCityLighting(scene, flickerLights) {
  scene.add(new THREE.AmbientLight(0xffffff, 15.0));
  scene.add(new THREE.HemisphereLight(0xaabbdd, 0x665544, 10.0));

  const dirs = [
    { pos: [20, 30, 20], color: 0xffeedd, i: 8 },
    { pos: [-20, 30, -20], color: 0xddeeff, i: 6 },
    { pos: [20, 30, -20], color: 0xffeedd, i: 5 },
    { pos: [-20, 30, 20], color: 0xddeeff, i: 5 },
  ];
  for (const d of dirs) {
    const light = new THREE.DirectionalLight(d.color, d.i);
    light.position.set(...d.pos);
    scene.add(light);
  }

  const points = [
    { p: [0, 4, 0], c: 0xffcc88, i: 10, r: 50 },
    { p: [10, 4, 10], c: 0xffaa66, i: 8, r: 40 },
    { p: [-10, 4, -10], c: 0xffaa66, i: 8, r: 40 },
    { p: [10, 4, -10], c: 0x88aadd, i: 6, r: 35 },
    { p: [-10, 4, 10], c: 0x88aadd, i: 6, r: 35 },
    { p: [0, 4, 15], c: 0xff6633, i: 5, r: 30 },
    { p: [0, 4, -15], c: 0xff6633, i: 5, r: 30 },
    { p: [6, 1.5, 4], c: 0xff4400, i: 4, r: 15 },
    { p: [-8, 1.5, -6], c: 0xff4400, i: 4, r: 15 },
  ];

  for (const lc of points) {
    const light = new THREE.PointLight(lc.c, lc.i, lc.r, 1);
    light.position.set(...lc.p);
    scene.add(light);

    flickerLights.push({
      light,
      bulb: null,
      baseIntensity: lc.i,
      flickerSpeed: 1.5 + Math.random() * 3,
      flickerAmount: 0.08 + Math.random() * 0.1,
      phase: Math.random() * Math.PI * 2,
    });
  }
}
