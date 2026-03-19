import * as THREE from "three";

/**
 * Visual effects: screen shake, hit particles, damage flash,
 * hitmarkers, directional damage indicator, bullet impact sparks.
 */
export class Effects {
  constructor(camera) {
    this.camera = camera;

    // Screen shake
    this.shakeIntensity = 0;
    this.shakeDecay = 8;

    // Camera roll from shake
    this.cameraRoll = 0;
    this.targetRoll = 0;

    // Damage overlay
    this.damageOverlay = document.getElementById("damage-overlay");

    // Hitmarker
    this.hitmarker = document.getElementById("hitmarker");
    this.hitmarkerTimer = 0;

    // Blood vignette (persistent low-health overlay)
    this.bloodVignette = document.getElementById("blood-vignette");

    // Particles — shared geometry for performance
    this.particles = [];
    this._sharedParticleGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    this._maxParticles = 40; // cap total particles
  }

  /** Trigger screen shake with intensity */
  shake(intensity = 0.025) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.targetRoll = (Math.random() - 0.5) * intensity * 3;
  }

  /** Show damage flash on screen border */
  damageFlash() {
    this.damageOverlay.classList.add("hit");
    setTimeout(() => this.damageOverlay.classList.remove("hit"), 150);
  }

  /** Show hitmarker on crosshair */
  showHitmarker(isHeadshot = false) {
    this.hitmarkerTimer = 0.15;
    this.hitmarker.style.opacity = "1";

    // Red hitmarker for headshots
    if (isHeadshot) {
      this.hitmarker.style.filter =
        "brightness(1) sepia(1) hue-rotate(-50deg) saturate(5)";
      setTimeout(() => {
        this.hitmarker.style.filter = "none";
      }, 150);
    }
  }

  /** Spawn hit particles at world position (blood) — uses shared geometry */
  spawnHitParticles(scene, position, color = 0xcc0000) {
    // Cull oldest particles if over limit
    while (this.particles.length > this._maxParticles - 4) {
      const old = this.particles.shift();
      scene.remove(old.mesh);
      old.mesh.material.dispose();
    }

    const count = 4; // reduced from 8
    for (let i = 0; i < count; i++) {
      const particle = new THREE.Mesh(
        this._sharedParticleGeo,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
      );
      particle.position.copy(position);
      const s = 0.6 + Math.random() * 0.8;
      particle.scale.set(s, s, s);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        Math.random() * 4 + 1,
        (Math.random() - 0.5) * 5,
      );

      scene.add(particle);
      this.particles.push({
        mesh: particle,
        velocity: vel,
        life: 0.4 + Math.random() * 0.2,
        maxLife: 0.5,
      });
    }
  }

  /** Spawn spark particles for wall/miss impacts — uses shared geometry */
  spawnSparks(scene, position) {
    while (this.particles.length > this._maxParticles - 3) {
      const old = this.particles.shift();
      scene.remove(old.mesh);
      old.mesh.material.dispose();
    }

    const count = 3; // reduced from 4
    for (let i = 0; i < count; i++) {
      const particle = new THREE.Mesh(
        this._sharedParticleGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffaa44,
          transparent: true,
          opacity: 1,
        }),
      );
      particle.position.copy(position);
      const s = 0.4 + Math.random() * 0.5;
      particle.scale.set(s, s, s);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 3 + 2,
        (Math.random() - 0.5) * 6,
      );

      scene.add(particle);
      this.particles.push({
        mesh: particle,
        velocity: vel,
        life: 0.25 + Math.random() * 0.15,
        maxLife: 0.4,
      });
    }
  }

  update(dt, scene) {
    // Screen shake
    if (this.shakeIntensity > 0.001) {
      this.camera.rotation.z = (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.rotation.x +=
        (Math.random() - 0.5) * this.shakeIntensity * 0.4;

      this.shakeIntensity *= Math.pow(0.0005, dt);
    } else {
      this.shakeIntensity = 0;
    }

    // Smooth camera roll recovery
    this.cameraRoll +=
      (this.targetRoll - this.cameraRoll) * (1 - Math.pow(0.01, dt));
    this.targetRoll *= Math.pow(0.001, dt);

    // Hitmarker
    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer -= dt;
      if (this.hitmarkerTimer <= 0) {
        this.hitmarker.style.opacity = "0";
      }
    }

    // Particles
    for (const p of this.particles) {
      p.life -= dt;
      p.velocity.y -= 9.8 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
      p.mesh.scale.multiplyScalar(0.97);
    }

    // Remove dead particles (don't dispose shared geometry)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      if (this.particles[i].life <= 0) {
        const p = this.particles[i];
        scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  /** Update blood vignette based on player health (0-100) */
  updateBloodVignette(healthPercent) {
    if (this.bloodVignette) {
      if (healthPercent < 50) {
        const intensity = 1 - healthPercent / 50;
        this.bloodVignette.style.opacity = String(Math.min(0.8, intensity));
      } else {
        this.bloodVignette.style.opacity = "0";
      }
    }
  }

  /** Cleanup all particles */
  clear(scene) {
    for (const p of this.particles) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
    this.particles = [];
  }
}
