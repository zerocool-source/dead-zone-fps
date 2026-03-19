import * as THREE from "three";

/**
 * Texture system — loads real PNG textures for floors/walls,
 * with procedural canvas fallbacks for materials without PNGs.
 */

const loader = new THREE.TextureLoader();

/** Load a PNG texture with tiling */
function loadTiled(path, repeatX, repeatY) {
  const tex = loader.load(path);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Load a PNG texture, fill transparent pixels with dark color,
 * then create a tiled CanvasTexture. Fixes white bleed from
 * transparent-background PNGs.
 */
function loadTiledFillTransparency(
  path,
  repeatX,
  repeatY,
  fillColor = [20, 18, 16],
) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const img = new Image();
  img.crossOrigin = "anonymous";

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;

  img.src = path;
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;

    // Fill background with dark color first
    ctx.fillStyle = `rgb(${fillColor[0]},${fillColor[1]},${fillColor[2]})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw image on top (transparent areas show the dark fill)
    ctx.drawImage(img, 0, 0);

    // Also process pixels: any remaining semi-transparent areas blend to dark
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 255) {
        const blend = a / 255;
        data[i] = Math.round(data[i] * blend + fillColor[0] * (1 - blend));
        data[i + 1] = Math.round(
          data[i + 1] * blend + fillColor[1] * (1 - blend),
        );
        data[i + 2] = Math.round(
          data[i + 2] * blend + fillColor[2] * (1 - blend),
        );
        data[i + 3] = 255; // fully opaque
      }
    }
    ctx.putImageData(imageData, 0, 0);

    tex.needsUpdate = true;
  };

  return tex;
}

// =============================================
// REAL PNG TEXTURES (from user's assets)
// =============================================

/** Main floor — cracked concrete (tiled) */
export function createFloorTexture() {
  return loadTiled("/textures/cracked_concrete.png", 8, 8);
}

/** Downstairs center floor — dirty concrete */
export function createMansionFloorTexture() {
  return loadTiled("/textures/downstairs_floor.png", 10, 10);
}

/** Hallway / corridor floor — gritty tiles */
export function createHallwayFloorTexture() {
  return loadTiled("/textures/gritty_tiles_1.png", 6, 6);
}

/** Upstairs balcony floor — cleaner gritty tiles */
export function createBalconyFloorTexture() {
  return loadTiled("/textures/gritty_tiles_2.png", 4, 4);
}

/** Stair steps — stair tile texture */
export function createStairTexture() {
  return loadTiled("/textures/stair_tile.png", 1, 1);
}

/** Dirt/rubble for damaged areas */
export function createDirtTexture() {
  return loadTiled("/textures/dirt_rubble.png", 3, 3);
}

// =============================================
// REAL PNG WALL TEXTURES
// =============================================

/** Main room walls — light cracked concrete (fill transparency with dark) */
export function createWallConcreteTexture() {
  return loadTiledFillTransparency(
    "/textures/wall_concrete.png",
    15,
    3,
    [30, 28, 26],
  );
}

/** Hallway walls — exposed brick under peeling plaster */
export function createWallBrickTexture() {
  return loadTiledFillTransparency(
    "/textures/wall_brick_exposed.png",
    15,
    3,
    [25, 20, 18],
  );
}

/** Dark stained walls — grimy with drip marks */
export function createWallDarkTexture() {
  return loadTiledFillTransparency(
    "/textures/wall_dark_stained.png",
    15,
    3,
    [18, 16, 14],
  );
}

/** Damaged walls — cracked and weathered */
export function createWallDamagedTexture() {
  return loadTiledFillTransparency(
    "/textures/wall_damaged.png",
    15,
    3,
    [22, 20, 18],
  );
}

// =============================================
// PROCEDURAL CANVAS TEXTURES (fallbacks, details)
// =============================================

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function addNoise(ctx, w, h, intensity = 20) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * intensity;
    data[i] += noise;
    data[i + 1] += noise;
    data[i + 2] += noise;
  }
  ctx.putImageData(imageData, 0, 0);
}

function addCracks(ctx, w, h, count = 5, color = "rgba(0,0,0,0.3)") {
  ctx.strokeStyle = color;
  for (let i = 0; i < count; i++) {
    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    ctx.beginPath();
    let x = Math.random() * w;
    let y = Math.random() * h;
    ctx.moveTo(x, y);
    const segments = 3 + Math.floor(Math.random() * 6);
    for (let s = 0; s < segments; s++) {
      x += (Math.random() - 0.5) * 40;
      y += (Math.random() - 0.3) * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function addStains(ctx, w, h, count = 3, color = "rgba(40,35,30,0.2)") {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 10 + Math.random() * 30;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** Concrete wall texture */
export function createConcreteTexture(size = 512) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#4a4a4a";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 20 + Math.random() * 60;
    const h = 20 + Math.random() * 60;
    const shade = 65 + Math.floor(Math.random() * 20);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(x, y, w, h);
  }
  addNoise(ctx, size, size, 15);
  addCracks(ctx, size, size, 8, "rgba(0,0,0,0.4)");
  addStains(ctx, size, size, 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

/** Torn wallpaper texture */
export function createWallpaperTexture(size = 512) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#3a2828";
  ctx.fillRect(0, 0, size, size);
  const patternSize = size / 8;
  ctx.fillStyle = "rgba(60,35,35,0.3)";
  for (let py = 0; py < size; py += patternSize) {
    for (let px = 0; px < size; px += patternSize) {
      ctx.beginPath();
      ctx.moveTo(px + patternSize / 2, py);
      ctx.lineTo(px + patternSize, py + patternSize / 2);
      ctx.lineTo(px + patternSize / 2, py + patternSize);
      ctx.lineTo(px, py + patternSize / 2);
      ctx.closePath();
      ctx.fill();
    }
  }
  for (let i = 0; i < 6; i++) {
    const tx = Math.random() * size;
    const ty = Math.random() * size;
    const tw = 30 + Math.random() * 80;
    const th = 20 + Math.random() * 60;
    ctx.fillStyle = `rgba(${25 + Math.floor(Math.random() * 10)},${20 + Math.floor(Math.random() * 8)},${18 + Math.floor(Math.random() * 8)},0.8)`;
    ctx.fillRect(tx, ty, tw, th);
  }
  addNoise(ctx, size, size, 10);
  addStains(ctx, size, size, 5);
  addCracks(ctx, size, size, 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

/** Wood plank texture */
export function createWoodTexture(size = 256) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#5a3a1a";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 40; i++) {
    const y = Math.random() * size;
    ctx.strokeStyle = `rgba(${80 + Math.random() * 30},${45 + Math.random() * 20},${15 + Math.random() * 15},0.3)`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < size; x += 10) {
      ctx.lineTo(x, y + (Math.random() - 0.5) * 3);
    }
    ctx.stroke();
  }
  addNoise(ctx, size, size, 8);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Dark metal texture */
export function createMetalTexture(size = 256) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#2a2a2e";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 60; i++) {
    const y = Math.random() * size;
    ctx.strokeStyle = `rgba(${50 + Math.random() * 20},${50 + Math.random() * 20},${55 + Math.random() * 20},0.2)`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  addNoise(ctx, size, size, 6);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Blood splatter texture */
export function createBloodTexture(size = 128) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2,
    cy = size / 2;
  for (let i = 0; i < 8; i++) {
    const x = cx + (Math.random() - 0.5) * size * 0.6;
    const y = cy + (Math.random() - 0.5) * size * 0.6;
    const r = 5 + Math.random() * 20;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, "rgba(120,10,5,0.8)");
    gradient.addColorStop(0.6, "rgba(80,5,2,0.4)");
    gradient.addColorStop(1, "rgba(60,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.transparent = true;
  return tex;
}

/** Ceiling texture */
export function createCeilingTexture(size = 512) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#252525";
  ctx.fillRect(0, 0, size, size);
  const panelSize = size / 4;
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 3;
  for (let x = 0; x <= size; x += panelSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let y = 0; y <= size; y += panelSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  addNoise(ctx, size, size, 8);
  addStains(ctx, size, size, 3);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}
