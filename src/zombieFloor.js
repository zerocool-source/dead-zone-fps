/**
 * ZombieFloor.js — Cracked concrete floor with blood stains.
 * Canvas-generated texture, no external assets needed.
 * Uses MeshBasicMaterial for consistent rendering.
 */

import * as THREE from "three";

function generateConcreteTexture(tilesX, tilesZ, goreLevel) {
  const TILE_PX = 128;
  const W = tilesX * TILE_PX;
  const H = tilesZ * TILE_PX;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Base concrete
  ctx.fillStyle = "#1c1c1c";
  ctx.fillRect(0, 0, W, H);

  for (let tx = 0; tx < tilesX; tx++) {
    for (let tz = 0; tz < tilesZ; tz++) {
      const px = tx * TILE_PX;
      const py = tz * TILE_PX;

      // Random shade per tile
      const shade = 28 + Math.floor(Math.random() * 20);
      ctx.fillStyle = `rgb(${shade},${shade},${shade - 2})`;
      ctx.fillRect(px + 1, py + 1, TILE_PX - 2, TILE_PX - 2);

      // Noise grain
      for (let g = 0; g < 60; g++) {
        const gx = px + Math.random() * TILE_PX;
        const gy = py + Math.random() * TILE_PX;
        const gs = Math.random() * 3;
        const gv = Math.floor(Math.random() * 30);
        ctx.fillStyle = `rgba(${gv},${gv},${gv},0.4)`;
        ctx.fillRect(gx, gy, gs, gs);
      }

      // Cracks
      const crackCount = 1 + Math.floor(Math.random() * 3);
      for (let c = 0; c < crackCount; c++) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(0,0,0,${0.4 + Math.random() * 0.4})`;
        ctx.lineWidth = 0.5 + Math.random();
        const sx = px + Math.random() * TILE_PX;
        const sy = py + Math.random() * TILE_PX;
        ctx.moveTo(sx, sy);
        let cx2 = sx;
        let cy2 = sy;
        const segments = 3 + Math.floor(Math.random() * 4);
        for (let s = 0; s < segments; s++) {
          cx2 += (Math.random() - 0.5) * 30;
          cy2 += (Math.random() - 0.5) * 30;
          ctx.lineTo(cx2, cy2);
        }
        ctx.stroke();
      }

      // Blood stains
      if (goreLevel > 0 && Math.random() < goreLevel * 0.4) {
        const bx = px + 10 + Math.random() * (TILE_PX - 20);
        const by = py + 10 + Math.random() * (TILE_PX - 20);
        const br = 4 + Math.random() * 20;
        const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        grad.addColorStop(0, "rgba(120,0,0,0.85)");
        grad.addColorStop(0.5, "rgba(80,0,0,0.5)");
        grad.addColorStop(1, "rgba(60,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();

        // Splatter droplets
        const drops = Math.floor(Math.random() * 6);
        for (let d = 0; d < drops; d++) {
          const dx = bx + (Math.random() - 0.5) * br * 2.5;
          const dy = by + (Math.random() - 0.5) * br * 2.5;
          ctx.fillStyle = "rgba(100,0,0,0.6)";
          ctx.beginPath();
          ctx.arc(dx, dy, 1 + Math.random() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Green bio-glow patches
      if (Math.random() < 0.08) {
        const gx2 = px + Math.random() * TILE_PX;
        const gy2 = py + Math.random() * TILE_PX;
        const gr2 = 8 + Math.random() * 18;
        const glowGrad = ctx.createRadialGradient(gx2, gy2, 0, gx2, gy2, gr2);
        glowGrad.addColorStop(0, "rgba(40,120,20,0.3)");
        glowGrad.addColorStop(1, "rgba(20,60,10,0)");
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(gx2, gy2, gr2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Tile grout lines
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 2;
  for (let tx = 0; tx <= tilesX; tx++) {
    ctx.beginPath();
    ctx.moveTo(tx * TILE_PX, 0);
    ctx.lineTo(tx * TILE_PX, H);
    ctx.stroke();
  }
  for (let tz = 0; tz <= tilesZ; tz++) {
    ctx.beginPath();
    ctx.moveTo(0, tz * TILE_PX);
    ctx.lineTo(W, tz * TILE_PX);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates a zombie-themed floor with cracked concrete and blood stains.
 * @param {object} options
 * @param {number} [options.width=40]
 * @param {number} [options.depth=40]
 * @param {number} [options.tileSize=2]
 * @param {number} [options.goreLevel=0.5] - 0 = clean, 1 = heavy blood
 * @param {number} [options.yOffset=0]
 * @returns {THREE.Group}
 */
export function createZombieFloor(options = {}) {
  const {
    width = 40,
    depth = 40,
    tileSize = 2,
    goreLevel = 0.5,
    yOffset = 0,
  } = options;

  const tilesX = Math.ceil(width / tileSize);
  const tilesZ = Math.ceil(depth / tileSize);

  const colorMap = generateConcreteTexture(tilesX, tilesZ, goreLevel);

  const floorGeo = new THREE.PlaneGeometry(width, depth, tilesX, tilesZ);
  const floorMat = new THREE.MeshBasicMaterial({ map: colorMap });

  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = yOffset;
  floorMesh.name = "ZombieFloor";

  // Subtle green under-glow
  const glowGeo = new THREE.PlaneGeometry(width * 1.1, depth * 1.1);
  const glowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x0a1f05),
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  glowMesh.rotation.x = -Math.PI / 2;
  glowMesh.position.y = yOffset - 0.01;

  const group = new THREE.Group();
  group.name = "ZombieFloorGroup";
  group.add(glowMesh);
  group.add(floorMesh);

  return group;
}
