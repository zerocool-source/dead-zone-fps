import * as THREE from "three";
import {
  ROOM_WIDTH,
  ROOM_DEPTH,
  SECOND_FLOOR_HEIGHT,
  FLOOR_THICKNESS,
} from "./constants.js";
import { makeAKWallMount } from "./akSprites.js";

const hw = ROOM_WIDTH / 2;
const hd = ROOM_DEPTH / 2;

/**
 * Weapon definitions — each tier has different stats.
 */
export const WEAPONS = {
  pistol: {
    name: "M1911",
    damage: 25,
    fireRate: 0.15,
    magSize: 8,
    reserve: 48,
    spread: 0.006,
    recoil: 0.035,
    cost: 0,
    spriteKey: "pistol",
  },
  smg: {
    name: "MP40",
    damage: 15,
    fireRate: 0.05,
    magSize: 45,
    reserve: 270,
    spread: 0.02,
    recoil: 0.018,
    cost: 1000,
    spriteKey: "smg",
  },
  ak47: {
    name: "AK-47",
    damage: 50,
    fireRate: 0.08,
    magSize: 60,
    reserve: 300,
    spread: 0.015,
    recoil: 0.06,
    cost: 1500,
    spriteKey: "ak47",
  },
  rifle: {
    name: "M16",
    damage: 65,
    fireRate: 0.1,
    magSize: 30,
    reserve: 180,
    spread: 0.004,
    recoil: 0.04,
    cost: 2500,
    spriteKey: "rifle",
  },
  shotgun: {
    name: "SPAS-12",
    damage: 220,
    fireRate: 0.7,
    magSize: 12,
    reserve: 48,
    spread: 0.09,
    recoil: 0.1,
    cost: 1500,
    spriteKey: "shotgun",
  },
  lmg: {
    name: "MG42",
    damage: 35,
    fireRate: 0.045,
    magSize: 100,
    reserve: 500,
    spread: 0.03,
    recoil: 0.025,
    cost: 4000,
    spriteKey: "lmg",
  },
  raygun: {
    name: "Ray Gun",
    damage: 300, // one-shots most zombies
    fireRate: 0.3,
    magSize: 20,
    reserve: 120,
    spread: 0.003,
    recoil: 0.015,
    cost: 0,
    spriteKey: "pistol",
  },
  thunder: {
    name: "Wunderwaffe",
    damage: 500, // chain lightning, massive damage
    fireRate: 0.8, // slow but devastating
    magSize: 3,
    reserve: 18,
    spread: 0.002,
    recoil: 0.08,
    cost: 0,
    spriteKey: "rifle",
  },
  rpd: {
    name: "RPD",
    damage: 50,
    fireRate: 0.055,
    magSize: 100,
    reserve: 500,
    spread: 0.025,
    recoil: 0.04,
    cost: 5000,
    spriteKey: "lmg",
  },
  rocketLauncher: {
    name: "RPG-7",
    damage: 800,
    fireRate: 1.5,
    magSize: 1,
    reserve: 12,
    spread: 0.002,
    recoil: 0.12,
    cost: 6000,
    spriteKey: "rifle",
    explosive: true,
    blastRadius: 8,
  },
  flamethrower: {
    name: "FLAMETHROWER",
    damage: 8,
    fireRate: 0.03,
    magSize: 200,
    reserve: 600,
    spread: 0.06,
    recoil: 0.005,
    cost: 5500,
    spriteKey: "lmg",
    burn: true,
  },
  minigun: {
    name: "M134 MINIGUN",
    damage: 20,
    fireRate: 0.02,
    magSize: 300,
    reserve: 900,
    spread: 0.04,
    recoil: 0.008,
    cost: 7500,
    spriteKey: "lmg",
  },
};

/**
 * Buy stations placed in the room (updated positions for expanded map).
 */
const BUY_STATIONS = [
  // AK-47 — near NW building entrance
  {
    position: new THREE.Vector3(-18, 1.7, -25),
    radius: 5,
    weaponKey: "ak47",
    type: "wall",
  },
  // SMG — near sandbag barricade
  {
    position: new THREE.Vector3(15, 1.7, 2),
    radius: 5,
    weaponKey: "smg",
    type: "wall",
  },
  // Rifle — near warehouse entrance
  {
    position: new THREE.Vector3(17, 1.7, 20),
    radius: 5,
    weaponKey: "rifle",
    type: "wall",
  },
  // Shotgun — near shack
  {
    position: new THREE.Vector3(27, 1.7, -30),
    radius: 5,
    weaponKey: "shotgun",
    type: "wall",
  },
  // Ammo refill — center crossroads
  {
    position: new THREE.Vector3(0, 1.5, 10),
    radius: 4,
    weaponKey: "ammo",
    type: "ammo",
    cost: 500,
  },
  // LMG — NW building second floor
  {
    position: new THREE.Vector3(-25, SECOND_FLOOR_HEIGHT + 0.5, -25),
    radius: 5,
    weaponKey: "lmg",
    type: "wall",
  },
  // RPD — near wrecked truck
  {
    position: new THREE.Vector3(4, 1.7, -25),
    radius: 5,
    weaponKey: "rpd",
    type: "wall",
  },
  // Second ammo refill — south side
  {
    position: new THREE.Vector3(-15, 1.5, 25),
    radius: 4,
    weaponKey: "ammo",
    type: "ammo",
    cost: 500,
  },
  // === OUTDOOR SPECIAL WEAPONS ===
  // RPG-7 — behind bus wreck
  {
    position: new THREE.Vector3(-5, 1.7, 33),
    radius: 5,
    weaponKey: "rocketLauncher",
    type: "wall",
  },
  // Flamethrower — near south dumpster
  {
    position: new THREE.Vector3(20, 1.7, 32),
    radius: 5,
    weaponKey: "flamethrower",
    type: "wall",
  },
  // Minigun — inside NW building ground floor
  {
    position: new THREE.Vector3(-28, 1.7, -22),
    radius: 5,
    weaponKey: "minigun",
    type: "wall",
  },
  // Ammo refill — near fire barrel
  {
    position: new THREE.Vector3(-10, 1.5, 2),
    radius: 4,
    weaponKey: "ammo",
    type: "ammo",
    cost: 500,
  },
];

// Mystery box — inside warehouse building
const MYSTERY_BOX = {
  position: new THREE.Vector3(25, 0.5, 20),
  radius: 4,
  cost: 950,
};

// Pack-a-Punch — inside NW building second floor
const PACK_A_PUNCH = {
  position: new THREE.Vector3(-25, 3.5, -23),
  radius: 4,
  cost: 5000,
};

/**
 * Manages weapon upgrades and buy station interactions.
 */
export class WeaponUpgradeManager {
  constructor(weapon, hud, weaponSprite = null, weaponModel = null) {
    this.weapon = weapon;
    this.hud = hud;
    this.weaponSprite = weaponSprite;
    this.weaponModel = weaponModel;
    this.currentWeaponKey = "pistol";
    this.isPacked = false; // Pack-a-Punch applied
    this.promptElement = document.getElementById("interact-prompt");
    this._interactPressed = false;
    this._buyCooldown = 0;
    this._wallDisplays = [];

    // Mystery box special weapon pool (includes rare weapons)
    this._mysteryPool = [
      "smg",
      "ak47",
      "rifle",
      "shotgun",
      "lmg",
      "rpd",
      "raygun",
      "thunder",
      "rocketLauncher",
      "flamethrower",
      "minigun",
    ];

    this._setupInput();
  }

  /** Create glowing wall weapon displays in the scene */
  createWallDisplays(scene) {
    const loader = new THREE.TextureLoader();

    for (const station of BUY_STATIONS) {
      if (station.type !== "wall") continue;
      const wpn = WEAPONS[station.weaponKey];
      if (!wpn) continue;

      // Wall display — AK gets a detailed weapon silhouette, others get glow box
      let glowBox;
      if (station.weaponKey === "ak47") {
        // AK-47 wall mount with canvas-generated texture
        const mountImg = new Image();
        mountImg.src = makeAKWallMount();
        const mountTex = new THREE.Texture(mountImg);
        mountImg.onload = () => {
          mountTex.needsUpdate = true;
        };
        mountTex.needsUpdate = true;
        const mountMat = new THREE.MeshBasicMaterial({
          map: mountTex,
          transparent: true,
          side: THREE.DoubleSide,
        });
        glowBox = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.5), mountMat);
      } else {
        const glowMat = new THREE.MeshBasicMaterial({
          color: 0x44ff88,
          transparent: true,
          opacity: 0.15,
        });
        glowBox = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), glowMat);
      }
      glowBox.position.copy(station.position);
      // Face inward based on which wall
      if (station.position.x < 0) {
        glowBox.rotation.y = Math.PI / 2;
        glowBox.position.x += 0.05;
      } else {
        glowBox.rotation.y = -Math.PI / 2;
        glowBox.position.x -= 0.05;
      }
      scene.add(glowBox);

      // No PointLight — emissive glow box handles visibility

      // Price text sprite
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#44ff88";
      ctx.font = "bold 28px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${wpn.name} — $${wpn.cost}`, 128, 40);
      const labelTex = new THREE.CanvasTexture(canvas);
      const labelMat = new THREE.SpriteMaterial({
        map: labelTex,
        transparent: true,
      });
      const label = new THREE.Sprite(labelMat);
      label.scale.set(2, 0.5, 1);
      label.position.copy(station.position);
      label.position.y -= 0.9;
      scene.add(label);

      this._wallDisplays.push({ glowBox, light: null, label, station });
    }

    // Mystery Box display (upstairs) — golden glow
    this._addSpecialStation(
      scene,
      MYSTERY_BOX.position,
      "MYSTERY BOX — $950",
      0xffcc00,
      1.5,
    );

    // Pack-a-Punch display (upstairs) — purple glow
    this._addSpecialStation(
      scene,
      PACK_A_PUNCH.position,
      "PACK-A-PUNCH — $5000",
      0xaa44ff,
      2.0,
    );
  }

  /** Add a glowing special station (mystery box, pack-a-punch) */
  _addSpecialStation(scene, pos, labelText, color, lightIntensity) {
    // Glowing platform
    const platGeo = new THREE.BoxGeometry(2, 0.5, 1.5);
    const platMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.3,
    });
    const platform = new THREE.Mesh(platGeo, platMat);
    platform.position.copy(pos);
    scene.add(platform);

    // No PointLight — emissive materials handle glow

    // Label sprite
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#" + color.toString(16).padStart(6, "0");
    ctx.font = "bold 32px monospace";
    ctx.textAlign = "center";
    ctx.fillText(labelText, 256, 42);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const label = new THREE.Sprite(mat);
    label.scale.set(4, 0.5, 1);
    label.position.copy(pos);
    label.position.y += 1.2;
    scene.add(label);
  }

  _setupInput() {
    this._interactHeld = false;
    this._interactJustPressed = false;

    document.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();
      if (key === "f" || key === "e") {
        if (!this._interactHeld) {
          this._interactJustPressed = true; // edge-triggered
        }
        this._interactHeld = true;
      }
    });
    document.addEventListener("keyup", (e) => {
      const key = e.key.toLowerCase();
      if (key === "f" || key === "e") {
        this._interactHeld = false;
      }
    });
  }

  /**
   * Check proximity to buy stations and handle interaction.
   */
  update(playerPos, gamepadInteract, doorManager) {
    let nearestStation = null;
    let nearestDist = Infinity;
    let interactionType = null;

    // Check buy stations
    for (const station of BUY_STATIONS) {
      const dist = playerPos.distanceTo(station.position);
      if (dist < station.radius && dist < nearestDist) {
        nearestStation = station;
        nearestDist = dist;
        interactionType = "weapon";
      }
    }

    // Check mystery box
    const mysteryDist = playerPos.distanceTo(MYSTERY_BOX.position);
    if (mysteryDist < MYSTERY_BOX.radius && mysteryDist < nearestDist) {
      nearestStation = { ...MYSTERY_BOX, type: "mystery", weaponKey: null };
      nearestDist = mysteryDist;
      interactionType = "weapon";
    }

    // Check Pack-a-Punch
    const papDist = playerPos.distanceTo(PACK_A_PUNCH.position);
    if (papDist < PACK_A_PUNCH.radius && papDist < nearestDist) {
      nearestStation = { ...PACK_A_PUNCH, type: "pack", weaponKey: null };
      nearestDist = papDist;
      interactionType = "weapon";
    }

    // Check doors
    if (doorManager) {
      const nearbyDoor = doorManager.getNearbyDoor(playerPos);
      if (nearbyDoor && nearestDist > 2) {
        nearestStation = nearbyDoor;
        nearestDist = 0;
        interactionType = "door";
      }
    }

    const wantInteract = this._interactJustPressed || gamepadInteract;

    if (nearestStation) {
      if (interactionType === "door") {
        this._showDoorPrompt(nearestStation);
      } else {
        this._showPrompt(nearestStation);
      }

      if (wantInteract) {
        this._interactJustPressed = false;
        if (interactionType === "door") {
          this._tryOpenDoor(nearestStation, doorManager);
        } else {
          this._tryBuy(nearestStation);
        }
      }
    } else {
      this._hidePrompt();
    }

    // Always consume the edge trigger at end of frame
    this._interactJustPressed = false;
  }

  _showDoorPrompt(door) {
    if (!this.promptElement) return;
    this.promptElement.style.display = "block";
    this.promptElement.textContent = `[F] Open ${door.label} — ${door.cost} points`;
  }

  _showPrompt(station) {
    if (!this.promptElement) return;
    this.promptElement.style.display = "block";

    if (station.type === "ammo") {
      this.promptElement.textContent = `[F] Buy Ammo — ${station.cost} points`;
    } else if (station.type === "mystery") {
      this.promptElement.textContent = `[F] Mystery Box — ${station.cost} points (Random Weapon!)`;
    } else if (station.type === "pack") {
      if (this.isPacked) {
        this.promptElement.textContent = `Pack-a-Punch — ALREADY UPGRADED`;
      } else {
        this.promptElement.textContent = `[F] Pack-a-Punch — ${station.cost} points (2x Damage!)`;
      }
    } else {
      const wpn = WEAPONS[station.weaponKey];
      if (this.currentWeaponKey === station.weaponKey) {
        this.promptElement.textContent = `[F] Buy Ammo for ${wpn.name} — ${Math.floor(wpn.cost / 2)} points`;
      } else {
        this.promptElement.textContent = `[F] Buy ${wpn.name} — ${wpn.cost} points`;
      }
    }
  }

  _hidePrompt() {
    if (!this.promptElement) return;
    this.promptElement.style.display = "none";
  }

  _tryOpenDoor(door, doorManager) {
    const score = this.hud.score;
    if (score < door.cost) return;
    this.hud.addScore(-door.cost);
    doorManager.openDoor(door);
    this.hud.announce(`${door.label.toUpperCase()} OPENED`);
  }

  _tryBuy(station) {
    const score = this.hud.score;

    if (station.type === "ammo") {
      if (score < station.cost) return;
      this.hud.addScore(-station.cost);
      this.weapon.reserve = WEAPONS[this.currentWeaponKey].reserve;
      return;
    }

    if (station.type === "mystery") {
      if (score < station.cost) return;
      this.hud.addScore(-station.cost);
      const randomKey =
        this._mysteryPool[Math.floor(Math.random() * this._mysteryPool.length)];
      this._equipWeapon(randomKey);
      this.hud.announce(
        "MYSTERY BOX — " + WEAPONS[randomKey].name.toUpperCase(),
      );
      return;
    }

    if (station.type === "pack") {
      if (this.isPacked || score < station.cost) return;
      this.hud.addScore(-station.cost);
      this.isPacked = true;
      // Double current weapon damage
      this.weapon._damage *= 2;
      this.hud.announce("PACK-A-PUNCHED! 2x DAMAGE");
      return;
    }

    if (false) {
      // placeholder to keep else-if chain clean
      return;
    }

    const wpn = WEAPONS[station.weaponKey];
    if (this.currentWeaponKey === station.weaponKey) {
      const ammoCost = Math.floor(wpn.cost / 2);
      if (score < ammoCost) return;
      this.hud.addScore(-ammoCost);
      this.weapon.reserve = wpn.reserve;
    } else {
      if (score < wpn.cost) return;
      this.hud.addScore(-wpn.cost);
      this._equipWeapon(station.weaponKey);
    }
  }

  _equipWeapon(key) {
    const wpn = WEAPONS[key];
    this.currentWeaponKey = key;
    this.isPacked = false; // new weapon resets Pack-a-Punch

    this.weapon.ammo = wpn.magSize;
    this.weapon.reserve = wpn.reserve;
    this.weapon._magSize = wpn.magSize;
    this.weapon._fireRate = wpn.fireRate;
    this.weapon._damage = wpn.damage;
    this.weapon._spread = wpn.spread;
    this.weapon._recoilAmount = wpn.recoil;

    // Switch weapon sprite PNGs
    if (this.weaponSprite && wpn.spriteKey) {
      this.weaponSprite.switchWeapon(wpn.spriteKey);
    }

    // Switch 3D weapon model
    if (this.weaponModel) {
      this.weaponModel.switchWeapon(key);
    }

    this.hud.showWeaponName(wpn.name);
    this.hud.announce(`${wpn.name.toUpperCase()} ACQUIRED`);
  }
}
