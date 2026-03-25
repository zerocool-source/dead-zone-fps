import * as THREE from "three";
import {
  ROOM_WIDTH,
  ROOM_DEPTH,
  ROOM_HEIGHT,
  SECOND_FLOOR_HEIGHT,
} from "./constants.js";
import { playDoorOpen } from "./audio.js";

const hw = ROOM_WIDTH / 2;
const hd = ROOM_DEPTH / 2;

/**
 * Door definitions — thick wall segments that block passage until purchased.
 * Each door gates off a section of the map.
 */
const DOOR_DEFS = [
  {
    id: "door_warehouse",
    cost: 750,
    label: "Warehouse",
    position: new THREE.Vector3(17, 2.5, 20),
    size: new THREE.Vector3(0.4, 5, 4),
    promptPos: new THREE.Vector3(16, 1.5, 20),
    radius: 4.0,
  },
  {
    id: "door_building",
    cost: 1000,
    label: "Ruined Building",
    position: new THREE.Vector3(-18, 3, -25),
    size: new THREE.Vector3(0.4, 6, 4),
    promptPos: new THREE.Vector3(-17, 1.5, -25),
    radius: 4.0,
  },
  {
    id: "door_shack",
    cost: 500,
    label: "Supply Shack",
    position: new THREE.Vector3(30, 1.75, -28),
    size: new THREE.Vector3(0.3, 3.5, 2),
    promptPos: new THREE.Vector3(29, 1.5, -28),
    radius: 3.5,
  },
];

/**
 * Manages purchasable doors that gate map areas.
 */
export class DoorManager {
  constructor(scene, obstacles) {
    this.scene = scene;
    this.obstacles = obstacles;
    this.doors = [];

    this._initDoors();
  }

  _initDoors() {
    const doorMat = new THREE.MeshBasicMaterial({
      color: 0x6a5a4a,
    });

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.5,
      metalness: 0.4,
    });

    for (const def of DOOR_DEFS) {
      // Door mesh
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(def.size.x, def.size.y, def.size.z),
        doorMat.clone(),
      );
      mesh.position.copy(def.position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // Door frame trim (slightly larger)
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(
          def.size.x + 0.1,
          def.size.y + 0.1,
          def.size.z + 0.1,
        ),
        frameMat,
      );
      frame.position.copy(def.position);
      this.scene.add(frame);

      // Cost label (glowing text placeholder — small bright box)
      const labelMat = new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        emissive: 0xffaa00,
        emissiveIntensity: 0.6,
      });
      const label = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.3, 0.05),
        labelMat,
      );
      label.position.set(
        def.promptPos.x,
        def.promptPos.y + 0.5,
        def.promptPos.z,
      );
      this.scene.add(label);

      // No PointLight — emissive label handles glow

      // Collision obstacle
      const hs = def.size.clone().multiplyScalar(0.5);
      const obstacle = {
        min: new THREE.Vector3(
          def.position.x - hs.x,
          def.position.y - hs.y,
          def.position.z - hs.z,
        ),
        max: new THREE.Vector3(
          def.position.x + hs.x,
          def.position.y + hs.y,
          def.position.z + hs.z,
        ),
      };
      this.obstacles.push(obstacle);

      this.doors.push({
        ...def,
        mesh,
        frame,
        label,
        glow: null,
        obstacle,
        opened: false,
      });
    }
  }

  /**
   * Check if player is near any closed door.
   * Returns { door, prompt } or null.
   */
  getNearbyDoor(playerPos) {
    for (const door of this.doors) {
      if (door.opened) continue;
      const dist = playerPos.distanceTo(door.promptPos);
      if (dist < door.radius) {
        return door;
      }
    }
    return null;
  }

  /**
   * Open a door — remove mesh and obstacle.
   */
  openDoor(door) {
    if (door.opened) return;

    door.opened = true;
    playDoorOpen();

    // Remove visual elements
    this.scene.remove(door.mesh);
    this.scene.remove(door.frame);
    this.scene.remove(door.label);
    if (door.glow) this.scene.remove(door.glow);

    // Remove obstacle from collision array
    const idx = this.obstacles.indexOf(door.obstacle);
    if (idx !== -1) {
      this.obstacles.splice(idx, 1);
    }
  }
}
