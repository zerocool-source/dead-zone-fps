import * as THREE from "three";

/**
 * Texture system — loads REAL PNG assets with brightness boosting
 * for MeshBasicMaterial + NoToneMapping + LinearSRGBColorSpace.
 * Procedural canvas fallbacks for detail textures.
 */

// ═══════════════════════════════════════════════════════════
// PNG LOADER — brightens dark textures for MeshBasicMaterial
// ═══════════════════════════════════════════════════════════

function loadPNG(path, repeatX, repeatY, boost = 2.5) {
  // Fixed canvas size: must not change after the CanvasTexture is created,
  // or Three.js's texSubImage2D update will overflow the original GPU allocation.
  const SIZE = 512;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx2d = canvas.getContext("2d", { willReadFrequently: true });

  // Fill with visible gray immediately (not black) while PNG loads
  ctx2d.fillStyle = "#6a6a68";
  ctx2d.fillRect(0, 0, SIZE, SIZE);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.LinearSRGBColorSpace;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = path;
  img.onload = () => {
    ctx2d.drawImage(img, 0, 0, SIZE, SIZE);

    // Brighten all pixels so dark textures are visible with MeshBasicMaterial
    const imageData = ctx2d.getImageData(0, 0, SIZE, SIZE);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.round(data[i] * boost));
      data[i + 1] = Math.min(255, Math.round(data[i + 1] * boost));
      data[i + 2] = Math.min(255, Math.round(data[i + 2] * boost));
      if (data[i + 3] < 200) {
        const a = data[i + 3] / 255;
        data[i] = Math.round(data[i] * a + 80 * (1 - a));
        data[i + 1] = Math.round(data[i + 1] * a + 75 * (1 - a));
        data[i + 2] = Math.round(data[i + 2] * a + 70 * (1 - a));
        data[i + 3] = 255;
      }
    }
    ctx2d.putImageData(imageData, 0, 0);
    tex.needsUpdate = true;
    console.log(`[Textures] Loaded ${path} (${img.width}x${img.height})`);
  };
  img.onerror = () => {
    console.warn(`[Textures] Failed to load ${path}, using gray fallback`);
  };

  return tex;
}

// ═══════════════════════════════════════════════════════════
// UTILITY HELPERS
// ═══════════════════════════════════════════════════════════

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function addNoise(ctx, w, h, intensity = 12) {
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * intensity;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(id, 0, 0);
}

function addCracks(ctx, w, h, count = 5, color = "rgba(0,0,0,0.35)") {
  for (let i = 0; i < count; i++) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    ctx.beginPath();
    let x = Math.random() * w;
    let y = Math.random() * h;
    ctx.moveTo(x, y);
    const segs = 3 + Math.floor(Math.random() * 5);
    for (let s = 0; s < segs; s++) {
      x += (Math.random() - 0.5) * 35;
      y += (Math.random() - 0.3) * 25;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Highlight edge for depth
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x + 1, y + 1);
    ctx.lineTo(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10);
    ctx.stroke();
  }
}

function addStains(ctx, w, h, count = 3, baseColor = [40, 35, 30]) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 8 + Math.random() * 25;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(
      0,
      `rgba(${baseColor[0]},${baseColor[1]},${baseColor[2]},0.25)`,
    );
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function addBloodStains(ctx, w, h, count = 2) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 5 + Math.random() * 18;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(100,10,5,0.5)");
    g.addColorStop(0.6, "rgba(70,5,0,0.2)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // Splatter drops
    for (let d = 0; d < 4; d++) {
      const dx = x + (Math.random() - 0.5) * r * 3;
      const dy = y + (Math.random() - 0.5) * r * 3;
      ctx.fillStyle = "rgba(90,5,0,0.35)";
      ctx.beginPath();
      ctx.arc(dx, dy, 1 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function toTex(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

// ═══════════════════════════════════════════════════════════
// FLOOR TEXTURES — detailed tile patterns
// ═══════════════════════════════════════════════════════════

/** Main floor — loads cracked_concrete.png asset, tiled across floor */
export function createFloorTexture() {
  return loadPNG("/textures/cracked_concrete.png", 8, 8, 3.0);
}

/** UNUSED procedural fallback kept for reference */
function _createFloorTextureFallback() {
  const S = 1024;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d");

  // Black border/vignette base
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, S, S);

  const margin = 20;
  const inner = S - margin * 2;
  const tileW = inner / 2;
  const tileH = inner / 2;

  // Draw each of the 4 tiles
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      const px = margin + tx * tileW;
      const py = margin + ty * tileH;

      // Base stone color with per-tile variation
      const base = 130 + Math.floor(Math.random() * 25);
      const warm = Math.floor(Math.random() * 10);
      ctx.fillStyle = `rgb(${base + warm},${base - 2},${base - 8})`;
      ctx.fillRect(px + 4, py + 4, tileW - 8, tileH - 8);

      // Large surface variation patches (stone texture)
      for (let p = 0; p < 25; p++) {
        const sx = px + 8 + Math.random() * (tileW - 16);
        const sy = py + 8 + Math.random() * (tileH - 16);
        const sw = 20 + Math.random() * 80;
        const sh = 20 + Math.random() * 80;
        const v = base + Math.floor((Math.random() - 0.5) * 35);
        ctx.fillStyle = `rgba(${v + warm},${v - 2},${v - 8},0.35)`;
        ctx.fillRect(sx, sy, sw, sh);
      }

      // Fine stone grain (tiny dots)
      for (let g = 0; g < 200; g++) {
        const gx = px + 6 + Math.random() * (tileW - 12);
        const gy = py + 6 + Math.random() * (tileH - 12);
        const gv = base + Math.floor((Math.random() - 0.5) * 40);
        ctx.fillStyle = `rgba(${gv},${gv - 3},${gv - 8},0.3)`;
        ctx.fillRect(gx, gy, 1 + Math.random() * 3, 1 + Math.random() * 3);
      }

      // Weathered rounded patches (lighter worn areas)
      for (let w = 0; w < 4; w++) {
        const wx = px + 30 + Math.random() * (tileW - 60);
        const wy = py + 30 + Math.random() * (tileH - 60);
        const wr = 30 + Math.random() * 60;
        const g = ctx.createRadialGradient(wx, wy, 0, wx, wy, wr);
        const wv = base + 15 + Math.floor(Math.random() * 15);
        g.addColorStop(0, `rgba(${wv},${wv - 3},${wv - 6},0.3)`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(wx, wy, wr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Deep cracks within each tile
      const crackCount = 2 + Math.floor(Math.random() * 3);
      for (let cr = 0; cr < crackCount; cr++) {
        // Main crack line
        ctx.strokeStyle = "rgba(20,18,15,0.7)";
        ctx.lineWidth = 1.5 + Math.random() * 2;
        ctx.beginPath();
        let cx2 = px + 20 + Math.random() * (tileW - 40);
        let cy2 = py + 20 + Math.random() * (tileH - 40);
        ctx.moveTo(cx2, cy2);
        const segs = 4 + Math.floor(Math.random() * 5);
        for (let s = 0; s < segs; s++) {
          cx2 += (Math.random() - 0.5) * 60;
          cy2 += (Math.random() - 0.5) * 60;
          ctx.lineTo(cx2, cy2);
        }
        ctx.stroke();
        // Crack highlight edge
        ctx.strokeStyle = "rgba(160,155,145,0.15)";
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Branch cracks
        if (Math.random() > 0.4) {
          ctx.strokeStyle = "rgba(25,22,18,0.5)";
          ctx.lineWidth = 0.5 + Math.random();
          ctx.beginPath();
          ctx.moveTo(cx2, cy2);
          ctx.lineTo(
            cx2 + (Math.random() - 0.5) * 40,
            cy2 + (Math.random() - 0.5) * 40,
          );
          ctx.stroke();
        }
      }

      // Edge darkening per tile
      const edgeG = ctx.createRadialGradient(
        px + tileW / 2,
        py + tileH / 2,
        tileW * 0.3,
        px + tileW / 2,
        py + tileH / 2,
        tileW * 0.7,
      );
      edgeG.addColorStop(0, "transparent");
      edgeG.addColorStop(1, "rgba(0,0,0,0.12)");
      ctx.fillStyle = edgeG;
      ctx.fillRect(px, py, tileW, tileH);
    }
  }

  // Deep grout lines between tiles
  ctx.fillStyle = "#1a1815";
  // Horizontal grout
  ctx.fillRect(margin, margin + tileH - 3, inner, 6);
  // Vertical grout
  ctx.fillRect(margin + tileW - 3, margin, 6, inner);

  // Rubble/pebbles at grout intersections
  const centerX = margin + tileW;
  const centerY = margin + tileH;
  for (let r = 0; r < 12; r++) {
    const rx = centerX + (Math.random() - 0.5) * 30;
    const ry = centerY + (Math.random() - 0.5) * 30;
    const rr = 2 + Math.random() * 6;
    const rv = 80 + Math.floor(Math.random() * 50);
    ctx.fillStyle = `rgb(${rv + 10},${rv - 5},${rv - 15})`;
    ctx.beginPath();
    ctx.ellipse(
      rx,
      ry,
      rr,
      rr * (0.6 + Math.random() * 0.4),
      Math.random() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  // Rubble along grout lines
  for (let side = 0; side < 4; side++) {
    for (let r = 0; r < 6; r++) {
      const along = Math.random() * inner;
      let rx2, ry2;
      if (side < 2) {
        rx2 = margin + along;
        ry2 = centerY + (Math.random() - 0.5) * 12;
      } else {
        rx2 = centerX + (Math.random() - 0.5) * 12;
        ry2 = margin + along;
      }
      const rr2 = 1 + Math.random() * 4;
      const rv2 = 70 + Math.floor(Math.random() * 40);
      ctx.fillStyle = `rgb(${rv2 + 8},${rv2 - 3},${rv2 - 12})`;
      ctx.beginPath();
      ctx.arc(rx2, ry2, rr2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Overall vignette
  const vig = ctx.createRadialGradient(
    S / 2,
    S / 2,
    S * 0.25,
    S / 2,
    S / 2,
    S * 0.55,
  );
  vig.addColorStop(0, "transparent");
  vig.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, S, S);

  addNoise(ctx, S, S, 10);
  return toTex(c, 6, 6);
}

/** Hallway floor — uses real PNG gritty tiles */
export function createHallwayFloorTexture() {
  return loadPNG("/textures/gritty_tiles_1.png", 6, 6, 3.0);
}
function _createHallwayFloorTextureFallback() {
  const S = 512;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d");
  const tileW = S / 8;
  const tileH = S / 8;

  for (let ty = 0; ty < 8; ty++) {
    for (let tx = 0; tx < 8; tx++) {
      const offset = (ty % 2) * (tileW / 2);
      const px = tx * tileW + offset;
      const py = ty * tileH;
      const base = 70 + Math.floor(Math.random() * 20);
      ctx.fillStyle = `rgb(${base + 5},${base},${base - 5})`;
      ctx.fillRect(px + 1, py + 1, tileW - 2, tileH - 2);

      // Worn spots
      if (Math.random() > 0.6) {
        const g = ctx.createRadialGradient(
          px + tileW / 2,
          py + tileH / 2,
          0,
          px + tileW / 2,
          py + tileH / 2,
          tileW / 3,
        );
        g.addColorStop(0, `rgba(${base - 15},${base - 15},${base - 18},0.5)`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(px, py, tileW, tileH);
      }
    }
  }

  // Grout
  ctx.strokeStyle = "#222220";
  ctx.lineWidth = 1.5;
  for (let ty = 0; ty <= 8; ty++) {
    for (let tx = 0; tx <= 8; tx++) {
      const offset = (ty % 2) * (tileW / 2);
      ctx.strokeRect(tx * tileW + offset, ty * tileH, tileW, tileH);
    }
  }

  addNoise(ctx, S, S, 10);
  addStains(ctx, S, S, 5, [35, 30, 25]);
  return toTex(c, 6, 6);
}

/** Balcony floor — uses real PNG */
export function createBalconyFloorTexture() {
  return loadPNG("/textures/gritty_tiles_2.png", 4, 4, 3.0);
}
function _createBalconyFloorTextureFallback() {
  const S = 512;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d");
  const tileSize = S / 6;

  for (let ty = 0; ty < 6; ty++) {
    for (let tx = 0; tx < 6; tx++) {
      const px = tx * tileSize;
      const py = ty * tileSize;
      const base = 80 + Math.floor(Math.random() * 18);
      ctx.fillStyle = `rgb(${base},${base + 2},${base - 2})`;
      ctx.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
      // Subtle veining
      ctx.strokeStyle = `rgba(${base + 15},${base + 15},${base + 10},0.2)`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(px + Math.random() * tileSize, py);
      ctx.bezierCurveTo(
        px + Math.random() * tileSize,
        py + tileSize * 0.3,
        px + Math.random() * tileSize,
        py + tileSize * 0.7,
        px + Math.random() * tileSize,
        py + tileSize,
      );
      ctx.stroke();
    }
  }

  ctx.fillStyle = "#252320";
  for (let i = 0; i <= 6; i++) {
    ctx.fillRect(0, i * tileSize - 1, S, 2);
    ctx.fillRect(i * tileSize - 1, 0, 2, S);
  }

  addNoise(ctx, S, S, 6);
  return toTex(c, 4, 4);
}

/** Stair step texture — uses real PNG */
export function createStairTexture() {
  return loadPNG("/textures/stair_tile.png", 1, 1, 2.5);
}
function _createStairTextureFallback() {
  const c = makeCanvas(256, 128);
  const ctx = c.getContext("2d");

  // Step surface
  ctx.fillStyle = "#7a7570";
  ctx.fillRect(0, 0, 256, 128);

  // Worn front edge
  const g = ctx.createLinearGradient(0, 0, 0, 20);
  g.addColorStop(0, "rgba(100,95,88,0.8)");
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 20);

  // Step riser shadow
  const g2 = ctx.createLinearGradient(0, 108, 0, 128);
  g2.addColorStop(0, "transparent");
  g2.addColorStop(1, "rgba(30,28,25,0.6)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 108, 256, 20);

  // Anti-slip grooves
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const y = 10 + i * 12;
    ctx.beginPath();
    ctx.moveTo(5, y);
    ctx.lineTo(251, y);
    ctx.stroke();
  }

  addNoise(ctx, 256, 128, 10);
  return toTex(c, 1, 1);
}

/** Dirt/rubble ground — uses real PNG */
export function createDirtTexture() {
  return loadPNG("/textures/dirt_rubble.png", 3, 3, 2.5);
}
function _createDirtTextureFallback() {
  const S = 512;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d");

  // Base dirt
  ctx.fillStyle = "#5a4a35";
  ctx.fillRect(0, 0, S, S);

  // Varied dirt patches
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 5 + Math.random() * 25;
    const base = 60 + Math.floor(Math.random() * 30);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${base + 10},${base - 5},${base - 20},0.5)`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Small stones/pebbles
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 1 + Math.random() * 4;
    const v = 50 + Math.floor(Math.random() * 40);
    ctx.fillStyle = `rgb(${v + 5},${v},${v - 5})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rubble chunks
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const w = 8 + Math.random() * 15;
    const h = 6 + Math.random() * 10;
    const v = 55 + Math.floor(Math.random() * 25);
    ctx.fillStyle = `rgb(${v},${v - 5},${v - 10})`;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.random() * Math.PI);
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }

  addNoise(ctx, S, S, 15);
  return toTex(c, 3, 3);
}

// ═══════════════════════════════════════════════════════════
// WALL TEXTURES — detailed patterns
// ═══════════════════════════════════════════════════════════

/** Bunker wall — loads wall_concrete.png asset, tiled on walls */
export function createWallConcreteTexture() {
  return loadPNG("/textures/wall_concrete.png", 8, 3, 3.2);
}

/** UNUSED procedural fallback */
function _createWallConcreteTextureFallback() {
  const S = 1024;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d");

  ctx.fillStyle = "#0a0a08";
  ctx.fillRect(0, 0, S, S);

  const margin = 12;
  const cols = 3,
    rows = 4;
  const bw = (S - margin * 2) / cols;
  const bh = (S - margin * 2) / rows;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const bx = margin + col * bw;
      const by = margin + row * bh;
      const base = 120 + Math.floor(Math.random() * 25);
      const warm = Math.floor(Math.random() * 8);
      ctx.fillStyle = `rgb(${base + warm},${base - 3},${base - 10})`;
      ctx.fillRect(bx + 4, by + 4, bw - 8, bh - 8);

      // Surface patches
      for (let p = 0; p < 15; p++) {
        const v = base + Math.floor((Math.random() - 0.5) * 30);
        ctx.fillStyle = `rgba(${v + warm},${v - 2},${v - 8},0.3)`;
        ctx.fillRect(
          bx + 8 + Math.random() * (bw - 16),
          by + 8 + Math.random() * (bh - 16),
          15 + Math.random() * 50,
          15 + Math.random() * 50,
        );
      }
      // Fine grain
      for (let g = 0; g < 100; g++) {
        const gv = base + Math.floor((Math.random() - 0.5) * 35);
        ctx.fillStyle = `rgba(${gv},${gv - 3},${gv - 6},0.25)`;
        ctx.fillRect(
          bx + 6 + Math.random() * (bw - 12),
          by + 6 + Math.random() * (bh - 12),
          1 + Math.random() * 2,
          1 + Math.random() * 2,
        );
      }
      // Cracks
      for (let cr = 0; cr < 1 + Math.floor(Math.random() * 3); cr++) {
        ctx.strokeStyle = `rgba(20,18,12,${0.4 + Math.random() * 0.3})`;
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.beginPath();
        let cx2 = bx + 15 + Math.random() * (bw - 30);
        let cy2 = by + 15 + Math.random() * (bh - 30);
        ctx.moveTo(cx2, cy2);
        for (let s = 0; s < 3 + Math.floor(Math.random() * 4); s++) {
          cx2 += (Math.random() - 0.5) * 40;
          cy2 += (Math.random() - 0.5) * 30;
          ctx.lineTo(cx2, cy2);
        }
        ctx.stroke();
      }
      // Block edge darkening
      const eg = ctx.createRadialGradient(
        bx + bw / 2,
        by + bh / 2,
        Math.min(bw, bh) * 0.2,
        bx + bw / 2,
        by + bh / 2,
        Math.min(bw, bh) * 0.6,
      );
      eg.addColorStop(0, "transparent");
      eg.addColorStop(1, "rgba(0,0,0,0.1)");
      ctx.fillStyle = eg;
      ctx.fillRect(bx, by, bw, bh);
    }
  }

  // Deep mortar lines
  ctx.fillStyle = "#15130f";
  for (let row = 0; row <= rows; row++)
    ctx.fillRect(margin - 2, margin + row * bh - 3, S - margin * 2 + 4, 6);
  for (let col = 0; col <= cols; col++)
    ctx.fillRect(margin + col * bw - 3, margin - 2, 6, S - margin * 2 + 4);

  // Metal rivets
  function drawRivet(x, y) {
    const r = 9 + Math.random() * 3;
    ctx.fillStyle = "rgba(15,12,10,0.6)";
    ctx.beginPath();
    ctx.arc(x, y, r + 2, 0, Math.PI * 2);
    ctx.fill();
    const bv = 75 + Math.floor(Math.random() * 20);
    const bg = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, r);
    bg.addColorStop(0, `rgb(${bv + 20},${bv + 15},${bv + 10})`);
    bg.addColorStop(0.7, `rgb(${bv},${bv - 5},${bv - 10})`);
    bg.addColorStop(1, `rgb(${bv - 15},${bv - 20},${bv - 25})`);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(200,195,185,0.25)";
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(30,25,20,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.4, y);
    ctx.lineTo(x + r * 0.4, y);
    ctx.stroke();
  }

  // Rivets at outer corners and midpoints
  const rp = [
    [margin + 14, margin + 14],
    [S - margin - 14, margin + 14],
    [margin + 14, S - margin - 14],
    [S - margin - 14, S - margin - 14],
    [margin + 14, margin + bh * 2],
    [S - margin - 14, margin + bh * 2],
    [margin + bw, margin + 14],
    [margin + bw * 2, margin + 14],
    [margin + bw, S - margin - 14],
    [margin + bw * 2, S - margin - 14],
  ];
  for (const [rx, ry] of rp) drawRivet(rx, ry);

  // Vignette
  const vig = ctx.createRadialGradient(
    S / 2,
    S / 2,
    S * 0.2,
    S / 2,
    S / 2,
    S * 0.55,
  );
  vig.addColorStop(0, "transparent");
  vig.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, S, S);

  addNoise(ctx, S, S, 8);
  return toTex(c, 6, 2);
}

/** Exposed brick wall — uses real PNG asset */
export function createWallBrickTexture() {
  return loadPNG("/textures/wall_brick_exposed.png", 8, 3, 3.2);
}
function _createWallBrickTextureFallback() {
  const S = 512;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d");

  // Mortar base
  ctx.fillStyle = "#5a5550";
  ctx.fillRect(0, 0, S, S);

  const bw = 40;
  const bh = 18;
  const mortarW = 2;

  for (let row = 0; row < Math.ceil(S / bh); row++) {
    const offset = (row % 2) * (bw / 2);
    for (let col = -1; col < Math.ceil(S / bw) + 1; col++) {
      const bx = col * bw + offset;
      const by = row * bh;

      // Brick color variation
      const r = 110 + Math.floor(Math.random() * 45);
      const g = 55 + Math.floor(Math.random() * 25);
      const b = 38 + Math.floor(Math.random() * 18);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(
        bx + mortarW,
        by + mortarW,
        bw - mortarW * 2,
        bh - mortarW * 2,
      );

      // Brick surface texture
      for (let n = 0; n < 3; n++) {
        const nx = bx + mortarW + Math.random() * (bw - mortarW * 2);
        const ny = by + mortarW + Math.random() * (bh - mortarW * 2);
        const nw = 3 + Math.random() * 8;
        const nh = 2 + Math.random() * 4;
        const dv = Math.floor((Math.random() - 0.5) * 20);
        ctx.fillStyle = `rgba(${r + dv},${g + dv},${b + dv},0.4)`;
        ctx.fillRect(nx, ny, nw, nh);
      }

      // Occasional damaged/missing brick
      if (Math.random() > 0.92) {
        ctx.fillStyle = "#3a3530";
        ctx.fillRect(
          bx + mortarW + 2,
          by + mortarW + 2,
          bw - mortarW * 2 - 4,
          bh - mortarW * 2 - 4,
        );
      }
    }
  }

  // Mortar highlight
  ctx.strokeStyle = "rgba(80,75,70,0.3)";
  ctx.lineWidth = 0.5;
  for (let row = 0; row <= Math.ceil(S / bh); row++) {
    ctx.beginPath();
    ctx.moveTo(0, row * bh + 1);
    ctx.lineTo(S, row * bh + 1);
    ctx.stroke();
  }

  addNoise(ctx, S, S, 8);
  return toTex(c, 8, 2);
}

/** Dark stained wall — uses real PNG asset */
export function createWallDarkTexture() {
  return loadPNG("/textures/wall_dark_stained.png", 8, 3, 3.2);
}
function _createWallDarkTextureFallback() {
  const S = 512;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d");

  // Dark base
  ctx.fillStyle = "#4a4845";
  ctx.fillRect(0, 0, S, S);

  // Mold patches
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 15 + Math.random() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const v = 25 + Math.floor(Math.random() * 15);
    g.addColorStop(0, `rgba(${v},${v + 8},${v},0.5)`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Drip stains from top
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * S;
    ctx.strokeStyle = "rgba(30,28,22,0.4)";
    ctx.lineWidth = 2 + Math.random() * 6;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    let cy = 0;
    for (let s = 0; s < 10; s++) {
      cy += 15 + Math.random() * 40;
      ctx.lineTo(x + (Math.random() - 0.5) * 6, cy);
    }
    ctx.stroke();
  }

  // Peeling paint patches
  for (let i = 0; i < 4; i++) {
    const px = Math.random() * S;
    const py = Math.random() * S;
    const pw = 20 + Math.random() * 50;
    const ph = 15 + Math.random() * 40;
    ctx.fillStyle = `rgba(${60 + Math.random() * 20},${55 + Math.random() * 15},${50 + Math.random() * 15},0.5)`;
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pw, ph);
  }

  addNoise(ctx, S, S, 12);
  addCracks(ctx, S, S, 5, "rgba(0,0,0,0.3)");
  return toTex(c, 8, 2);
}

/** Damaged wall — uses real PNG asset */
export function createWallDamagedTexture() {
  return loadPNG("/textures/wall_damaged.png", 8, 3, 3.2);
}
function _createWallDamagedTextureFallback() {
  const S = 512;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d");

  // Plaster base
  ctx.fillStyle = "#7a7568";
  ctx.fillRect(0, 0, S, S);

  // Exposed brick areas (damage holes)
  for (let i = 0; i < 5; i++) {
    const hx = Math.random() * S;
    const hy = Math.random() * S;
    const hw2 = 25 + Math.random() * 60;
    const hh = 20 + Math.random() * 45;

    // Dark hole
    ctx.fillStyle = "#3a3025";
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    for (let s = 0; s < 8; s++) {
      const angle = (s / 8) * Math.PI * 2;
      const r2 = (hw2 / 2) * (0.7 + Math.random() * 0.6);
      ctx.lineTo(
        hx + Math.cos(angle) * r2,
        hy + Math.sin(angle) * r2 * (hh / hw2),
      );
    }
    ctx.closePath();
    ctx.fill();

    // Brick pattern inside hole
    for (let by = hy - hh / 2; by < hy + hh / 2; by += 10) {
      for (let bx = hx - hw2 / 2; bx < hx + hw2 / 2; bx += 22) {
        const br = 90 + Math.floor(Math.random() * 35);
        const bg = 45 + Math.floor(Math.random() * 20);
        const bb = 30 + Math.floor(Math.random() * 15);
        ctx.fillStyle = `rgb(${br},${bg},${bb})`;
        ctx.fillRect(bx + 1, by + 1, 20, 8);
      }
    }

    // Crumble edge
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Plaster texture
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const w = 8 + Math.random() * 20;
    const h = 8 + Math.random() * 20;
    const v = 95 + Math.floor(Math.random() * 30);
    ctx.fillStyle = `rgba(${v},${v - 5},${v - 10},0.2)`;
    ctx.fillRect(x, y, w, h);
  }

  addNoise(ctx, S, S, 10);
  addCracks(ctx, S, S, 10, "rgba(0,0,0,0.3)");
  addStains(ctx, S, S, 4, [45, 40, 35]);
  return toTex(c, 8, 2);
}

// ═══════════════════════════════════════════════════════════
// DETAIL TEXTURES
// ═══════════════════════════════════════════════════════════

/** Concrete detail (for columns, platforms) */
export function createConcreteTexture(size = 512) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#7a7a78";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 25; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 15 + Math.random() * 50;
    const h = 15 + Math.random() * 50;
    const v = 100 + Math.floor(Math.random() * 30);
    ctx.fillStyle = `rgba(${v},${v},${v},0.2)`;
    ctx.fillRect(x, y, w, h);
  }
  addNoise(ctx, size, size, 10);
  addCracks(ctx, size, size, 6, "rgba(0,0,0,0.3)");
  addStains(ctx, size, size, 3);
  return toTex(c, 2, 2);
}

/** Torn wallpaper — ornate pattern with peeling sections */
export function createWallpaperTexture(size = 512) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d");

  // Base wallpaper color
  ctx.fillStyle = "#6a4a42";
  ctx.fillRect(0, 0, size, size);

  // Diamond pattern
  const ps = size / 8;
  ctx.fillStyle = "rgba(100,65,55,0.25)";
  for (let py = 0; py < size; py += ps) {
    for (let px = 0; px < size; px += ps) {
      ctx.beginPath();
      ctx.moveTo(px + ps / 2, py);
      ctx.lineTo(px + ps, py + ps / 2);
      ctx.lineTo(px + ps / 2, py + ps);
      ctx.lineTo(px, py + ps / 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Peeling/torn sections revealing dark wall beneath
  for (let i = 0; i < 5; i++) {
    const tx = Math.random() * size;
    const ty = Math.random() * size;
    const tw = 25 + Math.random() * 70;
    const th = 20 + Math.random() * 50;
    ctx.fillStyle = `rgba(${28 + Math.floor(Math.random() * 10)},${24 + Math.floor(Math.random() * 8)},${20 + Math.floor(Math.random() * 8)},0.85)`;
    // Irregular torn edge
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    for (let e = 0; e < 8; e++) {
      const angle = (e / 8) * Math.PI * 2;
      const r = (tw / 2) * (0.6 + Math.random() * 0.8);
      ctx.lineTo(
        tx + tw / 2 + Math.cos(angle) * r,
        ty + th / 2 + Math.sin(angle) * r * (th / tw),
      );
    }
    ctx.closePath();
    ctx.fill();
  }

  addNoise(ctx, size, size, 8);
  addStains(ctx, size, size, 4);
  addCracks(ctx, size, size, 3);
  return toTex(c, 3, 2);
}

/** Wood plank texture with grain detail */
export function createWoodTexture(size = 256) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d");

  // Base wood color
  ctx.fillStyle = "#8a6030";
  ctx.fillRect(0, 0, size, size);

  // Plank divisions
  const plankH = size / 5;
  for (let p = 0; p < 5; p++) {
    const py = p * plankH;
    const base = 110 + Math.floor(Math.random() * 30);
    const g = Math.floor(base * 0.6);
    const b = Math.floor(base * 0.3);
    ctx.fillStyle = `rgb(${base},${g},${b})`;
    ctx.fillRect(0, py + 1, size, plankH - 2);

    // Wood grain lines
    ctx.strokeStyle = `rgba(${base - 20},${g - 10},${b - 5},0.25)`;
    for (let i = 0; i < 12; i++) {
      const gy = py + 3 + Math.random() * (plankH - 6);
      ctx.lineWidth = 0.5 + Math.random();
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x < size; x += 8) {
        ctx.lineTo(x, gy + (Math.random() - 0.5) * 2);
      }
      ctx.stroke();
    }

    // Knot (rare)
    if (Math.random() > 0.75) {
      const kx = 20 + Math.random() * (size - 40);
      const ky = py + plankH / 2;
      const kr = 4 + Math.random() * 6;
      ctx.fillStyle = `rgba(${base - 30},${g - 15},${b},0.6)`;
      ctx.beginPath();
      ctx.ellipse(kx, ky, kr, kr * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      // Rings around knot
      ctx.strokeStyle = `rgba(${base - 20},${g - 10},${b},0.2)`;
      ctx.lineWidth = 0.5;
      for (let ring = 1; ring < 3; ring++) {
        ctx.beginPath();
        ctx.ellipse(
          kx,
          ky,
          kr + ring * 3,
          (kr + ring * 3) * 0.7,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
    }
  }

  // Plank gap shadows
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  for (let p = 1; p < 5; p++) {
    ctx.fillRect(0, p * plankH - 1, size, 2);
  }

  addNoise(ctx, size, size, 6);
  return toTex(c);
}

/** Metal texture with brushed finish */
export function createMetalTexture(size = 256) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d");

  ctx.fillStyle = "#5a5a60";
  ctx.fillRect(0, 0, size, size);

  // Brushed metal lines
  for (let i = 0; i < 80; i++) {
    const y = Math.random() * size;
    const v = 70 + Math.floor(Math.random() * 25);
    ctx.strokeStyle = `rgba(${v},${v},${v + 5},0.15)`;
    ctx.lineWidth = 0.3 + Math.random() * 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (Math.random() - 0.5) * 2);
    ctx.stroke();
  }

  // Scratches
  ctx.strokeStyle = "rgba(120,120,125,0.2)";
  for (let i = 0; i < 5; i++) {
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.lineTo(Math.random() * size, Math.random() * size);
    ctx.stroke();
  }

  // Rust spots
  for (let i = 0; i < 2; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 3 + Math.random() * 8;
    ctx.fillStyle = "rgba(90,50,25,0.3)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  addNoise(ctx, size, size, 5);
  return toTex(c);
}

/** Blood splatter */
export function createBloodTexture(size = 128) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  addBloodStains(ctx, size, size, 6);
  return toTex(c);
}

/** Ceiling texture — acoustic panels with stains */
export function createCeilingTexture(size = 512) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d");

  ctx.fillStyle = "#4a4a48";
  ctx.fillRect(0, 0, size, size);

  // Panel grid
  const panelSize = size / 4;
  for (let py = 0; py < 4; py++) {
    for (let px = 0; px < 4; px++) {
      const x = px * panelSize;
      const y = py * panelSize;
      const v = 60 + Math.floor(Math.random() * 15);
      ctx.fillStyle = `rgb(${v},${v},${v - 2})`;
      ctx.fillRect(x + 3, y + 3, panelSize - 6, panelSize - 6);

      // Acoustic dot pattern
      ctx.fillStyle = `rgba(${v - 10},${v - 10},${v - 12},0.3)`;
      for (let dy = 8; dy < panelSize - 8; dy += 10) {
        for (let dx = 8; dx < panelSize - 8; dx += 10) {
          ctx.beginPath();
          ctx.arc(x + dx, y + dy, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Grid lines
  ctx.fillStyle = "#2a2a28";
  for (let i = 0; i <= 4; i++) {
    ctx.fillRect(0, i * panelSize - 1, size, 3);
    ctx.fillRect(i * panelSize - 1, 0, 3, size);
  }

  addNoise(ctx, size, size, 6);
  addStains(ctx, size, size, 3, [38, 35, 32]);

  // Water damage stain on random panel
  if (Math.random() > 0.5) {
    const sx = (1 + Math.floor(Math.random() * 2)) * panelSize;
    const sy = (1 + Math.floor(Math.random() * 2)) * panelSize;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, panelSize * 0.4);
    g.addColorStop(0, "rgba(50,45,35,0.4)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(sx - panelSize / 2, sy - panelSize / 2, panelSize, panelSize);
  }

  return toTex(c, 2, 2);
}

// ═══════════════════════════════════════════════════════════
// LEGACY COMPATIBILITY — PNG texture loaders (fallback to procedural)
// ═══════════════════════════════════════════════════════════

export function createMansionFloorTexture() {
  return createFloorTexture();
}
