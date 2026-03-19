/**
 * WeaponSprite — 2D PNG weapon viewmodel overlay.
 *
 * NEW APPROACH: Anchor-point based positioning.
 * Instead of calculating bottom/left offsets, we:
 *   1. Place a container div at SCREEN CENTER (top:50%, left:50%)
 *   2. Offset the image so the SIGHT PIXEL sits at the container origin
 *   3. During ADS: container = screen center, so sight = crosshair. Done.
 *   4. During hip: shift container down+right for relaxed gun position
 *
 * Bullets always come from camera center (weapon.js). Gun is visual only.
 */

// ═══════════════════════════════════════════════════════════
// SIGHT POSITION on the idle.png (measured from green tritium dots)
// These are fractions of the image dimensions
// ═══════════════════════════════════════════════════════════
const SIGHT_X = 0.443; // 44.3% from left edge
const SIGHT_Y = 0.149; // 14.9% from top edge

// ═══════════════════════════════════════════════════════════
// TRANSFORMS (in pixels, relative to screen center)
// ═══════════════════════════════════════════════════════════
const HIP = {
  x: 0, // px right of center
  y: 160, // px below center — barrel tip near crosshair at 65%
  widthVW: 38,
};

const ADS = {
  x: 0, // sight on crosshair
  y: 162, // same Y as hip — crosshair is at 65% not 50%, so ADS = 15% of viewport below center
  widthVW: 38,
};

// Recoil
const RECOIL_KICK_UP = 15;
const RECOIL_KICK_SIDE = 4;
const RECOIL_DECAY = 12;

// Motion
const SWAY_X = 1.5,
  SWAY_Y = 1.0,
  SWAY_SPEED = 1.0;
const BOB_X = 4,
  BOB_Y = 6,
  BOB_SPEED = 10,
  SPRINT_MULT = 1.6;
const RELOAD_DIP = 70;
const SHOOT_DURATION = 0.1;
const ADS_SPEED = 14;

// Weapon PNG paths
const WEAPON_SPRITES = {
  pistol: { idle: "/weapons/idle.png", shoot: "/weapons/shoot.png" },
  smg: { idle: "/weapons/idle.png", shoot: "/weapons/shoot.png" },
  ak47: { idle: "/weapons/ak/idle.png", shoot: "/weapons/ak/shoot.png" },
  rifle: { idle: "/weapons/ak/idle.png", shoot: "/weapons/ak/shoot.png" },
  shotgun: { idle: "/weapons/idle.png", shoot: "/weapons/shoot.png" },
  lmg: { idle: "/weapons/idle.png", shoot: "/weapons/shoot.png" },
};

// ═══════════════════════════════════════════════════════════
// Fallback canvas pistol
// ═══════════════════════════════════════════════════════════
function makeFallbackIdle() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");
  const cx = 256;
  ctx.fillStyle = "#333";
  ctx.fillRect(cx - 18, 200, 36, 140);
  ctx.fillStyle = "#222";
  ctx.fillRect(cx - 16, 198, 8, 14);
  ctx.fillRect(cx + 8, 198, 8, 14);
  ctx.fillStyle = "#0f4";
  ctx.shadowColor = "#0f4";
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.arc(cx - 12, 204, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 12, 204, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - 3, 193, 6, 10);
  ctx.beginPath();
  ctx.arc(cx, 196, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(cx - 22, 330, 44, 70);
  ctx.fillStyle = "#1e1e1e";
  ctx.beginPath();
  ctx.moveTo(cx + 10, 380);
  ctx.quadraticCurveTo(cx + 40, 440, cx + 70, 512);
  ctx.lineTo(cx + 100, 512);
  ctx.quadraticCurveTo(cx + 60, 430, cx + 45, 370);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 30, 390);
  ctx.quadraticCurveTo(cx - 50, 450, cx - 70, 512);
  ctx.lineTo(cx - 30, 512);
  ctx.quadraticCurveTo(cx - 20, 440, cx - 10, 380);
  ctx.closePath();
  ctx.fill();
  return c.toDataURL("image/png");
}

function makeFallbackShoot() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");
  const cx = 256;
  const g = ctx.createRadialGradient(cx, 170, 0, cx, 170, 60);
  g.addColorStop(0, "rgba(255,255,230,1)");
  g.addColorStop(0.3, "rgba(255,180,50,0.7)");
  g.addColorStop(1, "rgba(255,80,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, 170, 60, 0, Math.PI * 2);
  ctx.fill();
  return c.toDataURL("image/png");
}

// ═══════════════════════════════════════════════════════════
// WeaponSprite
// ═══════════════════════════════════════════════════════════
export class WeaponSprite {
  constructor() {
    this.container = document.getElementById("weapon-sprite-container");
    this.imgElement = document.getElementById("weapon-sprite");

    this.time = 0;
    this.visible = false;
    this._ads = 0;
    this._shootTimer = 0;
    this._isShootFrame = false;
    this._imgAspect = 1.5;

    // Recoil (layered on top of hip/ADS)
    this._recoilX = 0;
    this._recoilY = 0;

    // Debug tune
    this._tuneX = 0;
    this._tuneY = 0;
    this._debug = false;

    // Fallbacks
    this._idleSrc = makeFallbackIdle();
    this._shootSrc = makeFallbackShoot();

    // Load real PNGs
    this._loadPNG("/weapons/idle.png", (url) => {
      this._idleSrc = url;
      if (!this._isShootFrame) this.imgElement.src = url;
    });
    this._loadPNG("/weapons/shoot.png", (url) => {
      this._shootSrc = url;
    });

    this.imgElement.src = this._idleSrc;

    // ── CSS setup ──
    // Container sits at screen center. We move it with transform for hip/ADS.
    Object.assign(this.container.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      width: `${HIP.widthVW}vw`,
      pointerEvents: "none",
      zIndex: "45",
      // No translateX(-50%) here — we handle centering manually via the image offset
      transform: "translate(0, 0)",
    });

    Object.assign(this.imgElement.style, {
      width: "100%",
      height: "auto",
      display: "block",
      filter: "drop-shadow(0 0 4px rgba(0,0,0,0.5))",
      // KEY: offset image so the SIGHT PIXEL is at the container origin (0,0)
      // sight is at SIGHT_X from left, SIGHT_Y from top
      // so we shift left by SIGHT_X% and up by SIGHT_Y% of the image
      // Using negative margins based on image percentage
      position: "relative",
    });

    this._setupDebug();
  }

  // ── PNG loading ─────────────────────────────────────────

  _loadPNG(src, onOk) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => {
      this._imgAspect = img.width / img.height;

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const corner = ctx.getImageData(0, 0, 1, 1).data;

      if ((corner[0] + corner[1] + corner[2]) / 3 > 220) {
        // Remove white bg
        const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          const b = (d[i] + d[i + 1] + d[i + 2]) / 3;
          const s =
            Math.max(d[i], d[i + 1], d[i + 2]) -
            Math.min(d[i], d[i + 1], d[i + 2]);
          if (b > 230 && s < 30) d[i + 3] = 0;
          else if (b > 200 && s < 40)
            d[i + 3] = Math.floor((1 - (b - 200) / 55) * 255);
        }
        ctx.putImageData(id, 0, 0);
        onOk(canvas.toDataURL("image/png"));
      } else {
        onOk(src);
      }
    };
    img.onerror = () => {};
  }

  // ── Debug ───────────────────────────────────────────────

  _setupDebug() {
    document.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "g" && e.ctrlKey) {
        this._debug = !this._debug;
        console.log(
          `[ADS Debug] ${this._debug ? "ON" : "OFF"} — tune: X=${this._tuneX} Y=${this._tuneY}`,
        );
      }
      if (!this._debug || this._ads < 0.3) return;
      const s = e.shiftKey ? 10 : 2;
      let hit = false;
      if (e.key === "ArrowLeft") {
        this._tuneX -= s;
        hit = true;
      }
      if (e.key === "ArrowRight") {
        this._tuneX += s;
        hit = true;
      }
      if (e.key === "ArrowUp") {
        this._tuneY -= s;
        hit = true;
      }
      if (e.key === "ArrowDown") {
        this._tuneY += s;
        hit = true;
      }
      if (hit) {
        e.preventDefault();
        console.log(`[Tune] X=${this._tuneX} Y=${this._tuneY}`);
      }
    });
  }

  // ── API ─────────────────────────────────────────────────

  switchWeapon(key) {
    const sp = WEAPON_SPRITES[key];
    if (!sp) return;
    this._loadPNG(sp.idle, (u) => {
      this._idleSrc = u;
      if (!this._isShootFrame) this.imgElement.src = u;
    });
    this._loadPNG(sp.shoot, (u) => {
      this._shootSrc = u;
    });
  }

  show() {
    this.visible = true;
    this.container.style.display = "block";
  }
  hide() {
    this.visible = false;
    this.container.style.display = "none";
  }

  triggerShoot() {
    this._shootTimer = SHOOT_DURATION;
    this._isShootFrame = true;
    this.imgElement.src = this._shootSrc;
    this._recoilY = -RECOIL_KICK_UP; // negative = up
    this._recoilX = (Math.random() - 0.5) * RECOIL_KICK_SIDE * 2;
  }

  // ── Frame update ────────────────────────────────────────

  update(dt, isMoving, isSprinting, isReloading, reloadProgress, isAiming) {
    if (!this.visible) return;
    this.time += dt;

    // Shoot frame
    if (this._shootTimer > 0) {
      this._shootTimer -= dt;
      if (this._shootTimer <= 0) {
        this._isShootFrame = false;
        this.imgElement.src = this._idleSrc;
      }
    }

    // ADS lerp
    this._ads += ((isAiming ? 1 : 0) - this._ads) * Math.min(1, dt * ADS_SPEED);

    // Recoil decay
    this._recoilX *= Math.pow(0.001, dt * RECOIL_DECAY);
    this._recoilY *= Math.pow(0.001, dt * RECOIL_DECAY);

    // Sway + bob (fade out during ADS)
    let swayX = Math.sin(this.time * SWAY_SPEED * 6.28) * SWAY_X;
    let swayY = Math.cos(this.time * SWAY_SPEED * 4.4) * SWAY_Y;
    if (isMoving) {
      const m = isSprinting ? SPRINT_MULT : 1;
      const sp = isSprinting ? BOB_SPEED * 1.4 : BOB_SPEED;
      swayX += Math.cos(this.time * sp * 0.5) * BOB_X * m;
      swayY += Math.sin(this.time * sp) * BOB_Y * m;
    }
    if (isReloading) {
      swayY += Math.sin(reloadProgress * Math.PI) * RELOAD_DIP;
    }
    const swayFade = 1 - this._ads;

    // ── Compute image dimensions ──
    const vw = window.innerWidth;
    const imgW = (HIP.widthVW / 100) * vw;
    const imgH = imgW / this._imgAspect;

    // ── The key trick: offset image so sight pixel = container origin ──
    // Image left offset = -SIGHT_X * imgW (shift left so sight X aligns with container X)
    // Image top offset  = -SIGHT_Y * imgH (shift up so sight Y aligns with container Y)
    const imgOffX = -SIGHT_X * imgW;
    const imgOffY = -SIGHT_Y * imgH;

    // ── Container position = lerp(hip, ads) ──
    // ADS: container at screen center (0,0 offset from top:50% left:50%) → sight = crosshair
    // Hip: container shifted down + optionally right
    const containerX = HIP.x * (1 - this._ads) + ADS.x * this._ads;
    const containerY = HIP.y * (1 - this._ads) + ADS.y * this._ads;

    // ── Add sway, recoil, debug tune ──
    const totalX =
      containerX + swayX * swayFade + this._recoilX + this._tuneX * this._ads;
    const totalY =
      containerY + swayY * swayFade + this._recoilY + this._tuneY * this._ads;

    // ── Apply ──
    // Container transform: moves the container from its CSS position (screen center)
    this.container.style.transform = `translate(${totalX}px, ${totalY}px)`;

    // Image offset: positions image so sight pixel is at container origin
    this.imgElement.style.transform = `translate(${imgOffX}px, ${imgOffY}px)`;
  }
}
