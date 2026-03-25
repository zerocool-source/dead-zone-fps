import * as THREE from "three";
import {
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  MOVE_SPEED,
  SPRINT_MULTIPLIER,
  JUMP_FORCE,
  GRAVITY,
  MOUSE_SENSITIVITY,
  PLAYER_MAX_HEALTH,
  ROOM_WIDTH,
  ROOM_DEPTH,
} from "./constants.js";

/**
 * First-person player controller.
 * Handles movement, jumping, collision, mouse look,
 * and head bob.
 */
export class Player {
  constructor(camera) {
    this.camera = camera;
    this.camera.position.set(0, PLAYER_HEIGHT, 0);

    // Pitch object wraps camera for vertical look
    this.pitchObject = new THREE.Object3D();
    this.pitchObject.add(this.camera);

    // Yaw object for horizontal look
    this.yawObject = new THREE.Object3D();
    this.yawObject.position.set(0, PLAYER_HEIGHT, 0);
    this.yawObject.add(this.pitchObject);

    this.velocity = new THREE.Vector3();
    this._moveDir = new THREE.Vector3();
    this._upAxis = new THREE.Vector3(0, 1, 0);
    this._newPos = new THREE.Vector3();
    this._forwardDir = new THREE.Vector3();
    this.sensitivityMult = 1.0; // adjustable from pause menu
    this.onGround = false;
    this.health = PLAYER_MAX_HEALTH;
    this.alive = true;
    this.groundLevel = 0; // dynamic ground Y — set by level loader
    this.invulnTime = 0;

    // Input state
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      shift: false,
      space: false,
    };

    // Track keyboard shift separately so gamepad sprint doesn't stick
    this._keyboardShift = false;

    // Gamepad input (merged with keyboard)
    this.gamepadMove = { x: 0, z: 0 };
    this.gamepadLook = { x: 0, y: 0 };

    // Head bob
    this.bobTime = 0;
    this.bobAmount = 0;

    this._setupInput();
  }

  get position() {
    return this.yawObject.position;
  }

  get forward() {
    this.camera.getWorldDirection(this._forwardDir);
    return this._forwardDir;
  }

  _setupInput() {
    document.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();
      if (key === "w") this.keys.w = true;
      if (key === "a") this.keys.a = true;
      if (key === "s") this.keys.s = true;
      if (key === "d") this.keys.d = true;
      if (key === "shift") {
        this.keys.shift = true;
        this._keyboardShift = true;
      }
      if (key === " ") {
        this.keys.space = true;
        e.preventDefault();
      }
    });

    document.addEventListener("keyup", (e) => {
      const key = e.key.toLowerCase();
      if (key === "w") this.keys.w = false;
      if (key === "a") this.keys.a = false;
      if (key === "s") this.keys.s = false;
      if (key === "d") this.keys.d = false;
      if (key === "shift") {
        this.keys.shift = false;
        this._keyboardShift = false;
      }
      if (key === " ") this.keys.space = false;
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.alive) return;
      // Only process mouse look when pointer is locked (game is active, not paused)
      if (!document.pointerLockElement) return;
      const sens = MOUSE_SENSITIVITY * this.sensitivityMult;
      this.yawObject.rotation.y -= e.movementX * sens;
      this.pitchObject.rotation.x -= e.movementY * sens;
      this.pitchObject.rotation.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, this.pitchObject.rotation.x),
      );
    });
  }

  /** Apply recoil kick to camera pitch */
  applyRecoil(amount) {
    this.pitchObject.rotation.x += amount;
    this.pitchObject.rotation.x = Math.min(
      Math.PI / 2,
      this.pitchObject.rotation.x,
    );
  }

  takeDamage(amount) {
    if (!this.alive || this.invulnTime > 0) return;
    this.health = Math.max(0, this.health - amount);
    this.invulnTime = 0.5; // brief invulnerability
    if (this.health <= 0) {
      this.alive = false;
    }
  }

  update(dt, obstacles) {
    if (!this.alive) return;

    this.invulnTime = Math.max(0, this.invulnTime - dt);

    // Apply gamepad look input
    if (this.alive) {
      this.yawObject.rotation.y -= this.gamepadLook.x;
      this.pitchObject.rotation.x -= this.gamepadLook.y;
      this.pitchObject.rotation.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, this.pitchObject.rotation.x),
      );
    }

    // Movement direction (keyboard + gamepad merged) — reuse cached vectors
    this._moveDir.set(0, 0, 0);
    if (this.keys.w) this._moveDir.z -= 1;
    if (this.keys.s) this._moveDir.z += 1;
    if (this.keys.a) this._moveDir.x -= 1;
    if (this.keys.d) this._moveDir.x += 1;
    this._moveDir.x += this.gamepadMove.x;
    this._moveDir.z += this.gamepadMove.z;
    if (this._moveDir.length() > 1) this._moveDir.normalize();

    // Rotate direction by yaw
    this._moveDir.applyAxisAngle(this._upAxis, this.yawObject.rotation.y);
    const moveDir = this._moveDir;

    const isSprinting = this.keys.shift;
    const speed = MOVE_SPEED * (isSprinting ? SPRINT_MULTIPLIER : 1);
    const isMoving = moveDir.lengthSq() > 0;

    // Horizontal velocity
    this.velocity.x = moveDir.x * speed;
    this.velocity.z = moveDir.z * speed;

    // Gravity
    this.velocity.y -= GRAVITY * dt;

    // Jump
    if (this.keys.space && this.onGround) {
      this.velocity.y = JUMP_FORCE;
      this.onGround = false;
    }

    // Tentative new position — reuse cached vector
    const newPos = this._newPos;
    newPos.copy(this.yawObject.position);
    newPos.x += this.velocity.x * dt;
    newPos.y += this.velocity.y * dt;
    newPos.z += this.velocity.z * dt;

    // Ground collision — uses dynamic ground level set by the level loader
    const floorY = this.groundLevel + PLAYER_HEIGHT;
    if (newPos.y <= floorY) {
      newPos.y = floorY;
      this.velocity.y = 0;
      this.onGround = true;
    }

    // Wall collision (room bounds)
    const hw = ROOM_WIDTH / 2 - PLAYER_RADIUS;
    const hd = ROOM_DEPTH / 2 - PLAYER_RADIUS;
    newPos.x = Math.max(-hw, Math.min(hw, newPos.x));
    newPos.z = Math.max(-hd, Math.min(hd, newPos.z));

    // Obstacle collision (AABB vs sphere) with step-up support
    const MAX_STEP_HEIGHT = 0.6; // increased — must be > stair step height (0.286)
    const feetY = newPos.y - PLAYER_HEIGHT; // y position of player's feet

    for (const obs of obstacles) {
      // Skip if player is fully above obstacle
      if (feetY >= obs.max.y) continue;

      const closestX = Math.max(obs.min.x, Math.min(newPos.x, obs.max.x));
      const closestZ = Math.max(obs.min.z, Math.min(newPos.z, obs.max.z));
      const dx = newPos.x - closestX;
      const dz = newPos.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < PLAYER_RADIUS * PLAYER_RADIUS) {
        const stepHeight = obs.max.y - feetY;

        if (stepHeight > 0 && stepHeight <= MAX_STEP_HEIGHT && this.onGround) {
          // Step up onto the obstacle
          newPos.y = obs.max.y + PLAYER_HEIGHT;
          this.velocity.y = 0;
          this.onGround = true;
        } else if (stepHeight > MAX_STEP_HEIGHT) {
          // Too tall to step over — push away horizontally
          const dist = Math.sqrt(distSq) || 0.001;
          const push = PLAYER_RADIUS - dist;
          newPos.x += (dx / dist) * push;
          newPos.z += (dz / dist) * push;
        }
      }
    }

    // Check if standing on top of any obstacle
    for (const obs of obstacles) {
      const onTopX =
        newPos.x >= obs.min.x - PLAYER_RADIUS &&
        newPos.x <= obs.max.x + PLAYER_RADIUS;
      const onTopZ =
        newPos.z >= obs.min.z - PLAYER_RADIUS &&
        newPos.z <= obs.max.z + PLAYER_RADIUS;
      const feetNow = newPos.y - PLAYER_HEIGHT;

      if (
        onTopX &&
        onTopZ &&
        feetNow >= obs.max.y - 0.1 &&
        feetNow <= obs.max.y + 0.3
      ) {
        if (this.velocity.y <= 0) {
          newPos.y = obs.max.y + PLAYER_HEIGHT;
          this.velocity.y = 0;
          this.onGround = true;
        }
      }
    }

    this.yawObject.position.copy(newPos);

    // Head bob
    if (isMoving && this.onGround) {
      const bobSpeed = this.keys.shift ? 14 : 10;
      this.bobTime += dt * bobSpeed;
      this.bobAmount = THREE.MathUtils.lerp(this.bobAmount, 1, dt * 5);
    } else {
      this.bobAmount = THREE.MathUtils.lerp(this.bobAmount, 0, dt * 5);
    }

    const bobOffsetY = Math.sin(this.bobTime) * 0.04 * this.bobAmount;
    const bobOffsetX = Math.cos(this.bobTime * 0.5) * 0.02 * this.bobAmount;
    this.camera.position.y = bobOffsetY;
    this.camera.position.x = bobOffsetX;
  }
}
