import * as THREE from "three";
import {
  ROOM_WIDTH,
  ROOM_DEPTH,
  SECOND_FLOOR_HEIGHT,
  FLOOR_THICKNESS,
} from "./constants.js";

const hw = ROOM_WIDTH / 2;
const hd = ROOM_DEPTH / 2;

/**
 * Weapon definitions — each tier has different stats.
 */
export const WEAPONS = {
  pistol: {
    name: "Pistol",
    damage: 25,
    fireRate: 0.18,
    magSize: 12,
    reserve: 60,
    spread: 0.008,
    recoil: 0.03,
    cost: 0,
    spriteKey: "pistol",
  },
  smg: {
    name: "SMG",
    damage: 20,
    fireRate: 0.08,
    magSize: 30,
    reserve: 150,
    spread: 0.015,
    recoil: 0.025,
    cost: 1000,
    spriteKey: "smg",
  },
  ak47: {
    name: "AK-47",
    damage: 40,
    fireRate: 0.1,
    magSize: 30,
    reserve: 180,
    spread: 0.012,
    recoil: 0.05,
    cost: 1500,
    spriteKey: "ak47",
  },
  rifle: {
    name: "Assault Rifle",
    damage: 35,
    fireRate: 0.1,
    magSize: 30,
    reserve: 180,
    spread: 0.01,
    recoil: 0.04,
    cost: 2500,
    spriteKey: "rifle",
  },
  shotgun: {
    name: "Shotgun",
    damage: 120,
    fireRate: 0.8,
    magSize: 6,
    reserve: 36,
    spread: 0.06,
    recoil: 0.07,
    cost: 1500,
    spriteKey: "shotgun",
  },
  lmg: {
    name: "LMG",
    damage: 30,
    fireRate: 0.07,
    magSize: 75,
    reserve: 300,
    spread: 0.025,
    recoil: 0.035,
    cost: 4000,
    spriteKey: "lmg",
  },
};

/**
 * Buy stations placed in the room (updated positions for expanded map).
 */
const BUY_STATIONS = [
  // AK-47 — right wall, ground floor (moved 3 units from wall for easy access)
  {
    position: new THREE.Vector3(hw - 3, 1.7, 0),
    radius: 5,
    weaponKey: "ak47",
    type: "wall",
  },
  // SMG — left wall, ground floor
  {
    position: new THREE.Vector3(-hw + 3, 1.7, 8),
    radius: 5,
    weaponKey: "smg",
    type: "wall",
  },
  // Rifle — left wall
  {
    position: new THREE.Vector3(-hw + 3, 1.7, 0),
    radius: 5,
    weaponKey: "rifle",
    type: "wall",
  },
  // Shotgun — left wall
  {
    position: new THREE.Vector3(-hw + 3, 1.7, -8),
    radius: 5,
    weaponKey: "shotgun",
    type: "wall",
  },
  // Ammo refill — near center
  {
    position: new THREE.Vector3(10, 1.5, 10),
    radius: 4,
    weaponKey: "ammo",
    type: "ammo",
    cost: 500,
  },
];

// Mystery box position (on the balcony - back area)
const MYSTERY_BOX = {
  position: new THREE.Vector3(
    -hw + 14,
    SECOND_FLOOR_HEIGHT + FLOOR_THICKNESS / 2 + 0.5,
    -hd + 5,
  ),
  radius: 2.5,
  cost: 950,
};

/**
 * Manages weapon upgrades and buy station interactions.
 */
export class WeaponUpgradeManager {
  constructor(weapon, hud, weaponSprite = null) {
    this.weapon = weapon;
    this.hud = hud;
    this.weaponSprite = weaponSprite;
    this.currentWeaponKey = "pistol";
    this.promptElement = document.getElementById("interact-prompt");
    this._interactPressed = false;
    this._buyCooldown = 0;
    this._wallDisplays = [];

    this._setupInput();
  }

  /** Create glowing wall weapon displays in the scene */
  createWallDisplays(scene) {
    const loader = new THREE.TextureLoader();

    for (const station of BUY_STATIONS) {
      if (station.type !== "wall") continue;
      const wpn = WEAPONS[station.weaponKey];
      if (!wpn) continue;

      // Glowing outline box behind weapon
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0x44ff88,
        transparent: true,
        opacity: 0.15,
      });
      const glowBox = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 1.2),
        glowMat,
      );
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

      // Glowing point light
      const light = new THREE.PointLight(0x44ff88, 0.5, 5);
      light.position.copy(station.position);
      scene.add(light);

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

      this._wallDisplays.push({ glowBox, light, label, station });
    }
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
      this.promptElement.textContent = `[F] Mystery Box — ${station.cost} points`;
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
      const keys = Object.keys(WEAPONS).filter((k) => k !== "pistol");
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      this._equipWeapon(randomKey);
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

    this.hud.showWeaponName(wpn.name);
    this.hud.announce(`${wpn.name.toUpperCase()} ACQUIRED`);
  }
}
