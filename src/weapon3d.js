import * as THREE from 'three';

/**
 * 3D first-person weapon model attached to the camera.
 * The gun always points where the camera aims — no alignment issues.
 * Includes visual recoil kick, idle sway, walk bob, reload animation, and muzzle flash.
 */
export class Weapon3D {
  constructor(camera) {
    this.camera = camera;

    // Container for weapon (child of camera)
    this.container = new THREE.Group();
    // Position: lower-right, slightly forward
    this.container.position.set(0.35, -0.35, -0.6);
    this.camera.add(this.container);

    // Build the gun model
    this.gunGroup = new THREE.Group();
    this.container.add(this.gunGroup);

    this._buildGun();
    this._buildMuzzleFlash();

    // Animation state
    this.time = 0;
    this.recoilKick = 0;       // 0-1, decays
    this.recoilRotX = 0;       // pitch kick
    this.recoilRotZ = 0;       // roll kick
    this.recoilPosZ = 0;       // push back
    this.bobAmount = 0;
    this.reloading = false;
    this.reloadProgress = 0;
    this.muzzleFlashTimer = 0;
  }

  _buildGun() {
    const g = this.gunGroup;

    // Materials
    const metalDark = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.4, metalness: 0.7 });
    const metalMed = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.5, metalness: 0.6 });
    const metalLight = new THREE.MeshStandardMaterial({ color: 0x4a4a4e, roughness: 0.45, metalness: 0.5 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.8, metalness: 0.1 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.7, metalness: 0.05 });

    // === RECEIVER (main body) ===
    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.06, 0.35),
      metalMed
    );
    receiver.position.set(0, 0, 0);
    receiver.castShadow = true;
    g.add(receiver);

    // === BARREL ===
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.35, 8),
      metalDark
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.005, -0.34);
    g.add(barrel);

    // Barrel shroud / handguard
    const handguard = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.045, 0.22),
      metalDark
    );
    handguard.position.set(0, -0.005, -0.22);
    g.add(handguard);

    // M-LOK rail slots on handguard
    for (let i = 0; i < 4; i++) {
      const slot = new THREE.Mesh(
        new THREE.BoxGeometry(0.042, 0.005, 0.015),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
      );
      slot.position.set(0, -0.028, -0.14 - i * 0.04);
      g.add(slot);
    }

    // Flash hider
    const flashHider = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.014, 0.04, 8),
      metalDark
    );
    flashHider.rotation.x = Math.PI / 2;
    flashHider.position.set(0, 0.005, -0.52);
    g.add(flashHider);

    // === MAGAZINE ===
    const magazine = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.12, 0.06),
      metalDark
    );
    magazine.position.set(0, -0.09, 0.02);
    g.add(magazine);

    // Mag well
    const magWell = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.02, 0.06),
      metalMed
    );
    magWell.position.set(0, -0.03, 0.02);
    g.add(magWell);

    // === PISTOL GRIP ===
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.1, 0.04),
      gripMat
    );
    grip.position.set(0, -0.08, 0.1);
    grip.rotation.x = 0.2;
    g.add(grip);

    // Grip texture lines
    for (let i = 0; i < 6; i++) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.036, 0.002, 0.041),
        new THREE.MeshStandardMaterial({ color: 0x282828 })
      );
      line.position.set(0, -0.04 - i * 0.012, 0.1);
      line.rotation.x = 0.2;
      g.add(line);
    }

    // === STOCK ===
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.05, 0.15),
      metalMed
    );
    stock.position.set(0, 0.005, 0.24);
    g.add(stock);

    // Stock tube
    const stockTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.12, 6),
      metalLight
    );
    stockTube.rotation.x = Math.PI / 2;
    stockTube.position.set(0, 0.01, 0.2);
    g.add(stockTube);

    // Butt pad
    const buttPad = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.055, 0.015),
      gripMat
    );
    buttPad.position.set(0, 0.005, 0.32);
    g.add(buttPad);

    // === TRIGGER GUARD ===
    const triggerGuard = new THREE.Mesh(
      new THREE.TorusGeometry(0.02, 0.003, 4, 8, Math.PI),
      metalDark
    );
    triggerGuard.rotation.y = Math.PI / 2;
    triggerGuard.rotation.z = Math.PI;
    triggerGuard.position.set(0, -0.045, 0.06);
    g.add(triggerGuard);

    // Trigger
    const trigger = new THREE.Mesh(
      new THREE.BoxGeometry(0.005, 0.02, 0.005),
      metalDark
    );
    trigger.position.set(0, -0.04, 0.06);
    g.add(trigger);

    // === RED DOT SIGHT ===
    // Mount rail
    const sightMount = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.01, 0.06),
      metalLight
    );
    sightMount.position.set(0, 0.04, -0.05);
    g.add(sightMount);

    // Sight body
    const sightBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.025, 0.045),
      metalMed
    );
    sightBody.position.set(0, 0.058, -0.05);
    g.add(sightBody);

    // Sight lens (dark circle)
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.1, metalness: 0.3 });
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.002, 8),
      lensMat
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0.058, -0.073);
    g.add(lens);

    // Red dot (glowing)
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.002, 6, 6),
      dotMat
    );
    dot.position.set(0, 0.058, -0.074);
    g.add(dot);

    // Red dot glow
    const dotLight = new THREE.PointLight(0xff0000, 0.1, 0.3);
    dotLight.position.set(0, 0.058, -0.074);
    g.add(dotLight);

    // === FRONT SIGHT ===
    const frontSight = new THREE.Mesh(
      new THREE.BoxGeometry(0.004, 0.015, 0.004),
      metalDark
    );
    frontSight.position.set(0, 0.035, -0.33);
    g.add(frontSight);

    // Front sight tritium dot
    const tritium = new THREE.Mesh(
      new THREE.SphereGeometry(0.002, 4, 4),
      new THREE.MeshBasicMaterial({ color: 0x00ff44 })
    );
    tritium.position.set(0, 0.043, -0.33);
    g.add(tritium);

    // === CHARGING HANDLE ===
    const chHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.008, 0.015),
      metalLight
    );
    chHandle.position.set(0, 0.035, 0.12);
    g.add(chHandle);

    // === EJECTION PORT ===
    const ejPort = new THREE.Mesh(
      new THREE.BoxGeometry(0.002, 0.02, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    ejPort.position.set(0.026, 0.01, 0.0);
    g.add(ejPort);

    // Brass casing visible
    const brass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.012, 6),
      new THREE.MeshStandardMaterial({ color: 0xbb9933, metalness: 0.8 })
    );
    brass.rotation.z = Math.PI / 2;
    brass.position.set(0.027, 0.01, 0.0);
    g.add(brass);

    // === HAND (right, on grip) ===
    const handMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const rightHand = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.04, 0.06),
      handMat
    );
    rightHand.position.set(0, -0.05, 0.1);
    rightHand.rotation.x = 0.2;
    g.add(rightHand);

    // Right fingers
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.035, 0.015),
        handMat
      );
      finger.position.set(-0.018 + i * 0.012, -0.04, 0.07 + i * 0.003);
      finger.rotation.x = 0.5;
      g.add(finger);
    }

    // === HAND (left, on handguard) ===
    const leftHand = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.04, 0.06),
      handMat
    );
    leftHand.position.set(0, -0.03, -0.18);
    g.add(leftHand);

    // Left fingers
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.03, 0.015),
        handMat
      );
      finger.position.set(-0.018 + i * 0.012, -0.032, -0.20 + i * 0.003);
      finger.rotation.x = 0.6;
      g.add(finger);
    }

    // Left thumb on top
    const leftThumb = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.012, 0.035),
      handMat
    );
    leftThumb.position.set(0.015, -0.005, -0.19);
    g.add(leftThumb);
  }

  _buildMuzzleFlash() {
    // Muzzle flash light
    this.muzzleLight = new THREE.PointLight(0xff8800, 0, 8);
    this.muzzleLight.position.set(0, 0.005, -0.55);
    this.gunGroup.add(this.muzzleLight);

    // Muzzle flash sprite (billboard)
    const flashMat = new THREE.SpriteMaterial({
      color: 0xffaa44,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    this.muzzleFlashSprite = new THREE.Sprite(flashMat);
    this.muzzleFlashSprite.scale.set(0.15, 0.15, 1);
    this.muzzleFlashSprite.position.set(0, 0.005, -0.55);
    this.gunGroup.add(this.muzzleFlashSprite);
  }

  /** Call when weapon fires */
  triggerShoot() {
    this.recoilKick = 1.0;
    this.recoilRotX = 0.06 + Math.random() * 0.03;  // pitch up
    this.recoilRotZ = (Math.random() - 0.5) * 0.04;  // roll
    this.recoilPosZ = 0.04;  // push back

    // Muzzle flash
    this.muzzleFlashTimer = 0.06;
    this.muzzleLight.intensity = 5;
    this.muzzleFlashSprite.material.opacity = 1;
    this.muzzleFlashSprite.scale.set(
      0.1 + Math.random() * 0.1,
      0.1 + Math.random() * 0.1,
      1
    );
    this.muzzleFlashSprite.material.rotation = Math.random() * Math.PI * 2;
  }

  /** Call when reload starts */
  startReload(duration) {
    this.reloading = true;
    this.reloadProgress = 0;
    this._reloadDuration = duration;
  }

  /** Call when reload completes */
  endReload() {
    this.reloading = false;
    this.reloadProgress = 0;
  }

  update(dt, isMoving, isSprinting, isAiming) {
    this.time += dt;

    // === Recoil recovery ===
    this.recoilKick *= Math.pow(0.0001, dt); // slow decay = heavy feel
    this.recoilRotX *= Math.pow(0.0005, dt);
    this.recoilRotZ *= Math.pow(0.001, dt);
    this.recoilPosZ *= Math.pow(0.0005, dt);

    // === Muzzle flash ===
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleLight.intensity = 0;
        this.muzzleFlashSprite.material.opacity = 0;
      } else {
        const t = this.muzzleFlashTimer / 0.06;
        this.muzzleLight.intensity = 5 * t;
        this.muzzleFlashSprite.material.opacity = t;
      }
    }

    // === Idle sway ===
    const swayX = Math.sin(this.time * 1.2 * Math.PI * 2) * 0.003;
    const swayY = Math.cos(this.time * 0.84 * Math.PI * 2) * 0.002;

    // === Walk bob ===
    let bobX = 0, bobY = 0;
    if (isMoving) {
      const speed = isSprinting ? 14 : 10;
      const mult = isSprinting ? 1.5 : 1.0;
      bobY = Math.sin(this.time * speed) * 0.008 * mult;
      bobX = Math.cos(this.time * speed * 0.5) * 0.005 * mult;
      this.bobAmount = Math.min(1, this.bobAmount + dt * 5);
    } else {
      this.bobAmount = Math.max(0, this.bobAmount - dt * 5);
    }

    // === Reload animation ===
    let reloadDip = 0;
    if (this.reloading) {
      this.reloadProgress += dt / (this._reloadDuration || 1.8);
      if (this.reloadProgress >= 1) {
        this.reloadProgress = 1;
      }
      reloadDip = Math.sin(this.reloadProgress * Math.PI) * 0.15;
    }

    // === ADS ===
    const aimMult = isAiming ? 0.15 : 1;

    // === Apply transforms ===
    // Base position
    const baseX = isAiming ? 0 : 0.35;
    const baseY = isAiming ? -0.28 : -0.35;
    const baseZ = isAiming ? -0.45 : -0.6;

    this.container.position.set(
      baseX + (swayX + bobX * this.bobAmount) * aimMult,
      baseY + (swayY + bobY * this.bobAmount) * aimMult - reloadDip,
      baseZ + this.recoilPosZ
    );

    this.container.rotation.set(
      -this.recoilRotX,
      0,
      this.recoilRotZ
    );
  }

  /** Show/hide the weapon */
  setVisible(visible) {
    this.container.visible = visible;
  }
}
