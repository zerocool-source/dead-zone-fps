import * as THREE from 'three';
import { ROOM_WIDTH, ROOM_DEPTH, ROOM_HEIGHT, SECOND_FLOOR_HEIGHT } from './constants.js';
import { playDoorOpen } from './audio.js';

const hw = ROOM_WIDTH / 2;
const hd = ROOM_DEPTH / 2;

/**
 * Door definitions — thick wall segments that block passage until purchased.
 * Each door gates off a section of the map.
 */
const DOOR_DEFS = [
  {
    id: 'door_left_wing',
    cost: 750,
    label: 'Left Wing',
    // Wall blocking access to left side area
    position: new THREE.Vector3(-15, ROOM_HEIGHT / 2, 10),
    size: new THREE.Vector3(0.4, ROOM_HEIGHT, 4),
    promptPos: new THREE.Vector3(-14, 1.5, 10),
    radius: 3.5,
  },
  {
    id: 'door_right_wing',
    cost: 750,
    label: 'Right Wing',
    // Wall blocking access to right side area
    position: new THREE.Vector3(15, ROOM_HEIGHT / 2, -10),
    size: new THREE.Vector3(0.4, ROOM_HEIGHT, 4),
    promptPos: new THREE.Vector3(14, 1.5, -10),
    radius: 3.5,
  },
  {
    id: 'door_back_room',
    cost: 1250,
    label: 'Back Room',
    // Wall blocking a back area
    position: new THREE.Vector3(10, ROOM_HEIGHT / 2, -18),
    size: new THREE.Vector3(4, ROOM_HEIGHT, 0.4),
    promptPos: new THREE.Vector3(10, 1.5, -17),
    radius: 3.5,
  },
  {
    id: 'door_balcony_room',
    cost: 1500,
    label: 'Balcony Access',
    // Blocks part of the upstairs balcony
    position: new THREE.Vector3(-hw + 5, SECOND_FLOOR_HEIGHT + ROOM_HEIGHT / 4, -hd + 12),
    size: new THREE.Vector3(0.4, ROOM_HEIGHT / 2, 3),
    promptPos: new THREE.Vector3(-hw + 6, SECOND_FLOOR_HEIGHT + 1, -hd + 12),
    radius: 3.0,
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
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x4a3a2a,
      roughness: 0.7,
      metalness: 0.2,
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
        doorMat.clone()
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
          def.size.z + 0.1
        ),
        frameMat
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
        labelMat
      );
      label.position.set(
        def.promptPos.x,
        def.promptPos.y + 0.5,
        def.promptPos.z
      );
      this.scene.add(label);

      // Small glow near door
      const glow = new THREE.PointLight(0xffaa00, 0.4, 4, 2);
      glow.position.copy(def.promptPos);
      glow.position.y += 0.5;
      this.scene.add(glow);

      // Collision obstacle
      const hs = def.size.clone().multiplyScalar(0.5);
      const obstacle = {
        min: new THREE.Vector3(
          def.position.x - hs.x,
          def.position.y - hs.y,
          def.position.z - hs.z
        ),
        max: new THREE.Vector3(
          def.position.x + hs.x,
          def.position.y + hs.y,
          def.position.z + hs.z
        ),
      };
      this.obstacles.push(obstacle);

      this.doors.push({
        ...def,
        mesh,
        frame,
        label,
        glow,
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
    this.scene.remove(door.glow);

    // Remove obstacle from collision array
    const idx = this.obstacles.indexOf(door.obstacle);
    if (idx !== -1) {
      this.obstacles.splice(idx, 1);
    }
  }
}
