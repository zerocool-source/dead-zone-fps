/**
 * AK-47 Sprite Generator — creates detailed first-person weapon sprites
 * via canvas drawing. Returns data URLs for idle, shoot, and wall mount views.
 *
 * Based on classic AK-47 silhouette with wood furniture, curved magazine,
 * and distinctive front sight post.
 */

// ═══════════════════════════════════════════════════════════
// Color palette
// ═══════════════════════════════════════════════════════════
const WOOD = "#6b3a1f";
const WOOD_DARK = "#4a2610";
const WOOD_LIGHT = "#8a5430";
const METAL = "#3a3a3e";
const METAL_LIGHT = "#585860";
const METAL_DARK = "#252528";
const METAL_HIGHLIGHT = "#6a6a70";
const HAND_BASE = "#4a3828";
const HAND_DARK = "#3a2818";
const HAND_LIGHT = "#5a4838";
const GLOVE = "#3a3530";
const GLOVE_LIGHT = "#4a4540";

// ═══════════════════════════════════════════════════════════
// Helper: draw rounded rect
// ═══════════════════════════════════════════════════════════
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ═══════════════════════════════════════════════════════════
// Draw gloved hand
// ═══════════════════════════════════════════════════════════
function drawHand(ctx, x, y, scale, mirror) {
  const s = scale;
  const m = mirror ? -1 : 1;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(m, 1);

  // Glove body
  ctx.fillStyle = GLOVE;
  roundRect(ctx, -25 * s, -15 * s, 50 * s, 55 * s, 8 * s);
  ctx.fill();

  // Knuckle highlights
  ctx.fillStyle = GLOVE_LIGHT;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(-15 * s + i * 10 * s, -10 * s, 4 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Thumb
  ctx.fillStyle = GLOVE;
  ctx.beginPath();
  ctx.ellipse(28 * s, 10 * s, 12 * s, 8 * s, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Wrist wrap
  ctx.fillStyle = HAND_DARK;
  roundRect(ctx, -28 * s, 35 * s, 56 * s, 15 * s, 4 * s);
  ctx.fill();

  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
// AK-47 IDLE — First Person View (looking down barrel)
// ═══════════════════════════════════════════════════════════
export function makeAKIdle() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1024;
  const ctx = c.getContext("2d");
  const cx = 512;

  // ── Barrel (top center, pointing away from player) ──
  // Barrel shroud / gas tube
  ctx.fillStyle = METAL;
  roundRect(ctx, cx - 12, 40, 24, 280, 4);
  ctx.fill();

  // Barrel highlight (left edge)
  ctx.fillStyle = METAL_HIGHLIGHT;
  ctx.fillRect(cx - 12, 50, 3, 260);

  // Front sight post
  ctx.fillStyle = METAL_DARK;
  ctx.fillRect(cx - 2, 30, 4, 20);
  // Sight ears
  ctx.fillRect(cx - 14, 35, 6, 12);
  ctx.fillRect(cx + 8, 35, 6, 12);

  // Gas block
  ctx.fillStyle = METAL;
  roundRect(ctx, cx - 18, 250, 36, 20, 3);
  ctx.fill();

  // ── Handguard (wood, below gas block) ──
  ctx.fillStyle = WOOD;
  roundRect(ctx, cx - 22, 270, 44, 100, 6);
  ctx.fill();
  // Wood grain lines
  ctx.strokeStyle = WOOD_DARK;
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 18, 280 + i * 18);
    ctx.lineTo(cx + 18, 282 + i * 18);
    ctx.stroke();
  }
  // Handguard ventilation holes
  ctx.fillStyle = METAL_DARK;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(cx, 290 + i * 25, 3, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Receiver (metal body) ──
  ctx.fillStyle = METAL;
  roundRect(ctx, cx - 28, 370, 56, 80, 4);
  ctx.fill();
  // Receiver cover (top)
  ctx.fillStyle = METAL_LIGHT;
  roundRect(ctx, cx - 24, 370, 48, 16, 3);
  ctx.fill();
  // Rear sight notch
  ctx.fillStyle = METAL_DARK;
  ctx.fillRect(cx - 4, 374, 8, 8);

  // Ejection port
  ctx.fillStyle = METAL_DARK;
  roundRect(ctx, cx + 10, 395, 14, 20, 2);
  ctx.fill();

  // ── Magazine (curved, iconic AK feature) ──
  ctx.fillStyle = METAL;
  ctx.save();
  ctx.translate(cx, 450);
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.quadraticCurveTo(-22, 60, -28, 120);
  ctx.lineTo(-14, 122);
  ctx.quadraticCurveTo(-10, 62, -6, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.quadraticCurveTo(0, 60, -6, 120);
  ctx.lineTo(8, 122);
  ctx.quadraticCurveTo(12, 62, 16, 0);
  ctx.closePath();
  ctx.fill();
  // Magazine ribbing
  ctx.strokeStyle = METAL_HIGHLIGHT;
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(-18 + i * 1, 10 + i * 16);
    ctx.lineTo(10 - i * 0.5, 10 + i * 16);
    ctx.stroke();
  }
  ctx.restore();

  // ── Trigger guard ──
  ctx.strokeStyle = METAL;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 14, 450);
  ctx.quadraticCurveTo(cx - 14, 480, cx, 480);
  ctx.quadraticCurveTo(cx + 14, 480, cx + 14, 450);
  ctx.stroke();
  // Trigger
  ctx.fillStyle = METAL_DARK;
  ctx.fillRect(cx - 2, 455, 4, 18);

  // ── Pistol grip (wood) ──
  ctx.fillStyle = WOOD;
  ctx.save();
  ctx.translate(cx + 5, 460);
  ctx.rotate(0.15);
  roundRect(ctx, -14, 0, 28, 90, 6);
  ctx.fill();
  // Grip texture
  ctx.strokeStyle = WOOD_DARK;
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-10, 15 + i * 18);
    ctx.lineTo(10, 15 + i * 18);
    ctx.stroke();
  }
  ctx.restore();

  // ── Stock (wood, extends down-right) ──
  ctx.fillStyle = WOOD;
  ctx.save();
  ctx.translate(cx + 10, 430);
  ctx.rotate(0.08);
  roundRect(ctx, -12, 0, 50, 170, 5);
  ctx.fill();
  ctx.fillStyle = WOOD_DARK;
  roundRect(ctx, -8, 130, 42, 35, 8);
  ctx.fill();
  ctx.restore();

  // ── Hands (gloved, gripping the weapon) ──
  // Right hand on grip
  drawHand(ctx, cx + 8, 510, 0.9, false);
  // Left hand on handguard
  drawHand(ctx, cx - 5, 340, 0.85, true);

  // ── Subtle lighting / shadow ──
  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, "rgba(255,255,255,0.05)");
  grad.addColorStop(0.5, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.2)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);

  return c.toDataURL("image/png");
}

// ═══════════════════════════════════════════════════════════
// AK-47 SHOOT — First Person View with muzzle flash
// ═══════════════════════════════════════════════════════════
export function makeAKShoot() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1024;
  const ctx = c.getContext("2d");

  // Draw the base idle frame first (slightly kicked back)
  const idleCanvas = document.createElement("canvas");
  idleCanvas.width = 1024;
  idleCanvas.height = 1024;
  const idleCtx = idleCanvas.getContext("2d");

  // Reuse idle drawing with slight offset for recoil
  ctx.save();
  ctx.translate(0, 8); // slight kick-back
  // Copy idle frame (we'll redraw it inline for simplicity)
  const idleUrl = makeAKIdle();
  // Instead, just draw the idle elements shifted

  const cx = 512;

  // ── Muzzle flash (big, dramatic) ──
  // Outer glow
  const g1 = ctx.createRadialGradient(cx, 20, 0, cx, 20, 120);
  g1.addColorStop(0, "rgba(255,255,230,1)");
  g1.addColorStop(0.15, "rgba(255,220,100,0.9)");
  g1.addColorStop(0.4, "rgba(255,140,30,0.5)");
  g1.addColorStop(0.7, "rgba(255,80,0,0.2)");
  g1.addColorStop(1, "rgba(255,40,0,0)");
  ctx.fillStyle = g1;
  ctx.beginPath();
  ctx.arc(cx, 20, 120, 0, Math.PI * 2);
  ctx.fill();

  // Inner flash spikes
  ctx.fillStyle = "rgba(255,255,200,0.9)";
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + Math.random() * 0.3;
    const len = 40 + Math.random() * 30;
    ctx.save();
    ctx.translate(cx, 20);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.lineTo(0, -len);
    ctx.lineTo(3, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Smoke wisps
  ctx.fillStyle = "rgba(200,200,200,0.15)";
  ctx.beginPath();
  ctx.ellipse(cx - 20, 5, 30, 15, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 25, 10, 25, 12, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // ── Barrel (kicked back slightly) ──
  ctx.fillStyle = METAL;
  roundRect(ctx, cx - 12, 55, 24, 275, 4);
  ctx.fill();
  ctx.fillStyle = METAL_HIGHLIGHT;
  ctx.fillRect(cx - 12, 65, 3, 255);

  // Front sight
  ctx.fillStyle = METAL_DARK;
  ctx.fillRect(cx - 2, 45, 4, 18);
  ctx.fillRect(cx - 14, 50, 6, 10);
  ctx.fillRect(cx + 8, 50, 6, 10);

  // Gas block
  ctx.fillStyle = METAL;
  roundRect(ctx, cx - 18, 260, 36, 20, 3);
  ctx.fill();

  // Handguard
  ctx.fillStyle = WOOD;
  roundRect(ctx, cx - 22, 280, 44, 100, 6);
  ctx.fill();
  ctx.strokeStyle = WOOD_DARK;
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 18, 290 + i * 18);
    ctx.lineTo(cx + 18, 292 + i * 18);
    ctx.stroke();
  }

  // Receiver
  ctx.fillStyle = METAL;
  roundRect(ctx, cx - 28, 380, 56, 80, 4);
  ctx.fill();
  ctx.fillStyle = METAL_LIGHT;
  roundRect(ctx, cx - 24, 380, 48, 16, 3);
  ctx.fill();

  // Ejection port with brass casing being ejected
  ctx.fillStyle = "#c4a840";
  ctx.save();
  ctx.translate(cx + 22, 400);
  ctx.rotate(0.3);
  roundRect(ctx, 0, 0, 6, 14, 1);
  ctx.fill();
  ctx.restore();

  // Magazine
  ctx.fillStyle = METAL;
  ctx.save();
  ctx.translate(cx, 460);
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.quadraticCurveTo(-22, 60, -28, 120);
  ctx.lineTo(-14, 122);
  ctx.quadraticCurveTo(-10, 62, -6, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.quadraticCurveTo(0, 60, -6, 120);
  ctx.lineTo(8, 122);
  ctx.quadraticCurveTo(12, 62, 16, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Trigger guard + trigger
  ctx.strokeStyle = METAL;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 14, 460);
  ctx.quadraticCurveTo(cx - 14, 490, cx, 490);
  ctx.quadraticCurveTo(cx + 14, 490, cx + 14, 460);
  ctx.stroke();
  ctx.fillStyle = METAL_DARK;
  ctx.fillRect(cx - 2, 465, 4, 18);

  // Grip
  ctx.fillStyle = WOOD;
  ctx.save();
  ctx.translate(cx + 5, 470);
  ctx.rotate(0.15);
  roundRect(ctx, -14, 0, 28, 90, 6);
  ctx.fill();
  ctx.restore();

  // Stock
  ctx.fillStyle = WOOD;
  ctx.save();
  ctx.translate(cx + 10, 440);
  ctx.rotate(0.08);
  roundRect(ctx, -12, 0, 50, 170, 5);
  ctx.fill();
  ctx.fillStyle = WOOD_DARK;
  roundRect(ctx, -8, 130, 42, 35, 8);
  ctx.fill();
  ctx.restore();

  // Hands
  drawHand(ctx, cx + 8, 520, 0.9, false);
  drawHand(ctx, cx - 5, 350, 0.85, true);

  ctx.restore();

  return c.toDataURL("image/png");
}

// ═══════════════════════════════════════════════════════════
// AK-47 WALL MOUNT — Side profile for buy station display
// ═══════════════════════════════════════════════════════════
export function makeAKWallMount() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d");

  ctx.save();
  ctx.translate(30, 60);

  // ── Stock (wood) ──
  ctx.fillStyle = WOOD;
  ctx.beginPath();
  ctx.moveTo(0, 80);
  ctx.lineTo(40, 60);
  ctx.lineTo(80, 55);
  ctx.lineTo(80, 85);
  ctx.lineTo(40, 90);
  ctx.lineTo(0, 100);
  ctx.closePath();
  ctx.fill();
  // Stock buttplate
  ctx.fillStyle = METAL_DARK;
  ctx.fillRect(0, 78, 6, 24);

  // ── Receiver ──
  ctx.fillStyle = METAL;
  ctx.beginPath();
  ctx.moveTo(80, 50);
  ctx.lineTo(260, 45);
  ctx.lineTo(260, 75);
  ctx.lineTo(80, 80);
  ctx.closePath();
  ctx.fill();

  // Receiver cover
  ctx.fillStyle = METAL_LIGHT;
  ctx.beginPath();
  ctx.moveTo(100, 50);
  ctx.lineTo(220, 47);
  ctx.lineTo(220, 55);
  ctx.lineTo(100, 58);
  ctx.closePath();
  ctx.fill();

  // ── Rear sight ──
  ctx.fillStyle = METAL_DARK;
  ctx.fillRect(115, 43, 8, 10);

  // ── Pistol grip ──
  ctx.fillStyle = WOOD;
  ctx.beginPath();
  ctx.moveTo(130, 78);
  ctx.lineTo(140, 78);
  ctx.lineTo(148, 130);
  ctx.lineTo(122, 135);
  ctx.lineTo(120, 80);
  ctx.closePath();
  ctx.fill();

  // ── Trigger guard ──
  ctx.strokeStyle = METAL;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(125, 78);
  ctx.quadraticCurveTo(140, 100, 155, 78);
  ctx.stroke();
  // Trigger
  ctx.fillStyle = METAL_DARK;
  ctx.fillRect(138, 80, 3, 12);

  // ── Magazine (curved) ──
  ctx.fillStyle = METAL;
  ctx.beginPath();
  ctx.moveTo(155, 75);
  ctx.lineTo(170, 75);
  ctx.quadraticCurveTo(175, 110, 180, 140);
  ctx.lineTo(165, 142);
  ctx.quadraticCurveTo(158, 112, 148, 80);
  ctx.closePath();
  ctx.fill();

  // ── Handguard (wood) ──
  ctx.fillStyle = WOOD;
  ctx.beginPath();
  ctx.moveTo(185, 50);
  ctx.lineTo(310, 44);
  ctx.lineTo(310, 70);
  ctx.lineTo(185, 76);
  ctx.closePath();
  ctx.fill();
  // Wood grain
  ctx.strokeStyle = WOOD_DARK;
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 4; i++) {
    const y = 54 + i * 5;
    ctx.beginPath();
    ctx.moveTo(190, y);
    ctx.lineTo(305, y - 2);
    ctx.stroke();
  }

  // Gas tube (on top)
  ctx.fillStyle = METAL_LIGHT;
  ctx.fillRect(220, 42, 90, 5);

  // ── Barrel ──
  ctx.fillStyle = METAL;
  ctx.fillRect(310, 52, 100, 8);
  // Barrel end / muzzle brake
  ctx.fillStyle = METAL_DARK;
  ctx.fillRect(400, 48, 20, 16);
  ctx.fillRect(415, 50, 8, 12);

  // ── Front sight post ──
  ctx.fillStyle = METAL_DARK;
  ctx.fillRect(380, 38, 4, 16);
  // Sight base
  ctx.fillRect(374, 46, 16, 8);

  // ── Cleaning rod (below barrel) ──
  ctx.fillStyle = METAL_HIGHLIGHT;
  ctx.fillRect(220, 72, 190, 2);

  ctx.restore();

  return c.toDataURL("image/png");
}
