// Renderer — a stylized "God's Table" view of the sim. Heightmap terrain with biome
// vertex colors, water, trees, food, and a legible token per being. Orbital camera that
// can swoop to street level. No game logic here; it only reads sim state.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { WORLD } from './config.js';
import { BIOME } from './world.js';

const BIOME_COLOR = {
  [BIOME.OCEAN]: [0.05, 0.18, 0.32],
  [BIOME.BEACH]: [0.78, 0.71, 0.48],
  [BIOME.GRASS]: [0.32, 0.48, 0.22],
  [BIOME.FOREST]: [0.18, 0.34, 0.16],
  [BIOME.ROCK]: [0.42, 0.40, 0.38],
  [BIOME.SNOW]: [0.92, 0.94, 0.97],
};

export class Renderer {
  constructor(sim) {
    this.sim = sim;
    this.beingMeshes = new Map(); // id -> THREE.Group
    this.selected = null;
    this.possessed = null;
    this.tmp = new THREE.Vector3();
  }

  mount(parent) {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    parent.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0d14);
    this.scene.fog = new THREE.Fog(0x0a0d14, WORLD.SIZE * 0.7, WORLD.SIZE * 1.7);

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.5, 2000);
    const home = this.sim.home;
    this.camera.position.set(home.x + 38, 34, home.z + 48);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 6;
    this.controls.maxDistance = WORLD.SIZE * 1.4;
    this.controls.target.set(this.sim.home.x, 0, this.sim.home.z);

    // lights
    this.hemi = new THREE.HemisphereLight(0xbcd0ff, 0x4a3826, 0.7);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe6b8, 1.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.near = 1; sc.far = WORLD.SIZE * 2;
    sc.left = sc.bottom = -WORLD.SIZE * 0.6; sc.right = sc.top = WORLD.SIZE * 0.6;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this._buildTerrain();
    this._buildWater();
    this._buildTrees();
    this._buildBushes();
    this._buildSelection();

    this._initBubbles();
    this._initLabel();
    this.structGroup = new THREE.Group();
    this.scene.add(this.structGroup);
    this.huts = [];
    this.campfire = null;
    this.farms = null;
    this._elev = 1;

    this.raycaster = new THREE.Raycaster();
    this.effects = [];

    // screen flash overlay (smite)
    this.flashEl = document.createElement('div');
    this.flashEl.style.cssText = 'position:fixed;inset:0;background:#ff7a3a;opacity:0;pointer-events:none;z-index:80;transition:opacity .08s;mix-blend-mode:screen;';
    document.body.appendChild(this.flashEl);

    window.addEventListener('resize', () => this._resize());
    return this;
  }

  // ---- thought bubbles: a glanceable icon of each being's current mind-state ----
  _emojiTexture(emoji, bg) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(32, 32, 28, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.font = '34px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.fillText(emoji, 32, 35);
    const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; return t;
  }
  _initBubbles() {
    const B = {
      foraging: ['🍓', '#b8893a'], eating: ['🍖', '#b8893a'], hungry: ['🍗', '#c0502a'],
      sleeping: ['💤', '#5a78b0'], resting: ['💤', '#5a78b0'],
      talking: ['💬', '#8a6ab8'], courting: ['❤', '#c05a7a'],
      wandering: ['•', '#6a6a6a'], seeking: ['✨', '#d8b85a'], grieving: ['🖤', '#4a4a4a'],
    };
    this.bubbleMats = {};
    for (const k in B) {
      this.bubbleMats[k] = new THREE.SpriteMaterial({ map: this._emojiTexture(B[k][0], B[k][1]), depthTest: false, transparent: true });
    }
  }
  _bubbleKey(b) {
    if (b.hunger > 88 && (b.action === 'foraging' || b.action === 'wandering')) return 'hungry';
    if (b.inspiration) return 'seeking';
    return this.bubbleMats[b.action] ? b.action : 'wandering';
  }

  _initLabel() {
    this.labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
    this.labelSprite.visible = false;
    this.labelSprite.renderOrder = 999;
    this.scene.add(this.labelSprite);
    this._labelFor = null;
  }
  _setLabel(b) {
    if (!b) { this.labelSprite.visible = false; this._labelFor = null; return; }
    const text = b.name;
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.font = 'bold 30px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(text, 128, 34);
    ctx.fillStyle = '#e8c87a'; ctx.fillText(text, 128, 34);
    if (this.labelSprite.material.map) this.labelSprite.material.map.dispose();
    this.labelSprite.material.map = new THREE.CanvasTexture(c);
    this.labelSprite.scale.set(8, 2, 1);
    this.labelSprite.visible = true;
    this._labelFor = b;
  }

  // ---- the village physically grows as the tribe discovers things ----
  updateStructures() {
    const tech = this.sim.tech, home = this.sim.home, pop = this.sim.population;
    if (tech.includes('fire') && !this.campfire) this._buildCampfire(home);
    if (tech.includes('shelter')) {
      const want = Math.min(14, Math.floor(pop / 3));
      while (this.huts.length < want) this._addHut(home, this.huts.length);
    }
    if (tech.includes('farming') && !this.farms) this._buildFarms(home);
  }
  _buildCampfire(home) {
    const g = new THREE.Group();
    const logs = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1 }));
    logs.position.y = 0.2; g.add(logs);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.0, 7),
      new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.92 }));
    flame.position.y = 0.9; g.add(flame);
    const light = new THREE.PointLight(0xff7a2a, 0, 26, 2); light.position.y = 1.2; g.add(light);
    g.position.set(home.x, this.sim.world.heightAt(home.x, home.z), home.z);
    this.structGroup.add(g);
    this.campfire = { group: g, flame, light };
  }
  _addHut(home, i) {
    const ang = (i / 8) * Math.PI * 2 + 0.6, r = 7 + Math.floor(i / 8) * 4;
    let x = home.x + Math.cos(ang) * r, z = home.z + Math.sin(ang) * r;
    if (!this.sim.world.isLand(x, z)) { x = home.x; z = home.z; }
    const y = this.sim.world.heightAt(x, z);
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 1 }));
    wall.position.y = 0.8; wall.castShadow = true; g.add(wall);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.3, 4),
      new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 1 }));
    roof.position.y = 2.25; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
    g.position.set(x, y, z); g.rotation.y = this.sim.rng ? ang : 0;
    this.structGroup.add(g);
    this.huts.push(g);
  }
  _buildFarms(home) {
    this.farms = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x6a5a2a, roughness: 1 });
    for (let i = 0; i < 5; i++) {
      const ang = i / 5 * Math.PI * 2, r = 16 + i;
      let x = home.x + Math.cos(ang) * r, z = home.z + Math.sin(ang) * r;
      if (!this.sim.world.isLand(x, z)) continue;
      const patch = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 4), mat);
      patch.position.set(x, this.sim.world.heightAt(x, z) + 0.1, z);
      this.farms.add(patch);
    }
    this.structGroup.add(this.farms);
  }

  spawnEffect(x, z, color, radius) {
    const y = this.sim.world.heightAt(x, z) + 0.2;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 1.0, 36),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y, z);
    this.scene.add(ring);
    // a vertical beam of light
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.5, radius * 0.15, 40, 20, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.set(x, y + 20, z);
    this.scene.add(beam);
    this.effects.push({ ring, beam, life: 0, dur: 1.1, radius });
  }

  flash(amount = 0.5) {
    this.flashEl.style.opacity = amount;
    setTimeout(() => (this.flashEl.style.opacity = 0), 90);
  }

  _updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life += dt;
      const t = e.life / e.dur;
      const s = 1 + t * e.radius;
      e.ring.scale.set(s, s, s);
      e.ring.material.opacity = Math.max(0, 0.9 * (1 - t));
      e.beam.material.opacity = Math.max(0, 0.18 * (1 - t));
      e.beam.scale.y = 1 + t * 0.5;
      if (t >= 1) {
        this.scene.remove(e.ring); this.scene.remove(e.beam);
        e.ring.geometry.dispose(); e.beam.geometry.dispose();
        this.effects.splice(i, 1);
      }
    }
  }

  _terrainGeometry() {
    const { world } = this.sim;
    const n = world.seg, S = WORLD.SIZE;
    const geo = new THREE.PlaneGeometry(S, S, n, n);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const ix = i % (n + 1), iy = Math.floor(i / (n + 1));
      const id = world.idx(ix, iy);
      let hgt = world.h[id];
      pos.setY(i, Math.max(hgt, WORLD.SEA_LEVEL - 0.6));
      const c = BIOME_COLOR[world.biome[id]] || [0.3, 0.3, 0.3];
      // subtle height shading
      const shade = 0.85 + Math.min(0.25, Math.max(-0.15, hgt / WORLD.MAX_HEIGHT * 0.3));
      colors[i * 3] = c[0] * shade; colors[i * 3 + 1] = c[1] * shade; colors[i * 3 + 2] = c[2] * shade;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }

  _buildTerrain() {
    const geo = this._terrainGeometry();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.0, flatShading: false });
    this.terrain = new THREE.Mesh(geo, mat);
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
  }

  refreshTerrain() {
    const geo = this._terrainGeometry();
    this.terrain.geometry.dispose();
    this.terrain.geometry = geo;
  }

  _buildWater() {
    const geo = new THREE.PlaneGeometry(WORLD.SIZE * 1.6, WORLD.SIZE * 1.6);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1b4a6b, transparent: true, opacity: 0.82, roughness: 0.25, metalness: 0.3,
    });
    this.water = new THREE.Mesh(geo, mat);
    this.water.position.y = WORLD.SEA_LEVEL + 0.15;
    this.scene.add(this.water);
  }

  _buildTrees() {
    const { world } = this.sim;
    const positions = [];
    // scatter trees on forest tiles
    const n = world.seg;
    for (let iy = 0; iy < n; iy += 2) {
      for (let ix = 0; ix < n; ix += 2) {
        const id = world.idx(ix, iy);
        if (world.biome[id] === BIOME.FOREST && Math.random() < 0.18) {
          const x = (ix / n - 0.5) * WORLD.SIZE, z = (iy / n - 0.5) * WORLD.SIZE;
          positions.push([x, world.h[id], z]);
        }
      }
    }
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.6, 5);
    const leafGeo = new THREE.ConeGeometry(1.4, 3.2, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4b3a26, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2c4a22, roughness: 1 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, positions.length);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, positions.length);
    leaves.castShadow = true;
    const m = new THREE.Matrix4();
    positions.forEach((p, i) => {
      const s = 0.7 + Math.random() * 0.7;
      m.makeTranslation(p[0], p[1] + 0.8 * s, p[2]); m.scale(new THREE.Vector3(s, s, s));
      trunks.setMatrixAt(i, m);
      m.makeTranslation(p[0], p[1] + 2.4 * s, p[2]); m.scale(new THREE.Vector3(s, s, s));
      leaves.setMatrixAt(i, m);
    });
    this.scene.add(trunks); this.scene.add(leaves);
  }

  _buildBushes() {
    const { world } = this.sim;
    const geo = new THREE.IcosahedronGeometry(0.6, 0);
    this.bushMat = new THREE.MeshStandardMaterial({ color: 0x3a5a2a, roughness: 1 });
    this.berryMat = new THREE.MeshStandardMaterial({ color: 0x8a2240, emissive: 0x3a0814, roughness: 0.7 });
    this.bushMeshes = [];
    for (const bush of world.bushes) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(geo, this.bushMat);
      body.castShadow = true;
      g.add(body);
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), this.berryMat);
      berry.position.y = 0.4; g.add(berry);
      g.position.set(bush.x, bush.y + 0.5, bush.z);
      g.userData.bush = bush; g.userData.berry = berry;
      this.scene.add(g);
      this.bushMeshes.push(g);
    }
  }

  _buildSelection() {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.5, 28),
      new THREE.MeshBasicMaterial({ color: 0xe8c87a, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    this.selRing = ring;
    this.scene.add(ring);
  }

  _makeBeingMesh(b) {
    const g = new THREE.Group();
    const col = new THREE.Color().setHSL(b.hue, 0.55, 0.55);
    const bodyH = b.stage === 'child' ? 0.7 : 1.2;
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, bodyH, 4, 8),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 })
    );
    body.position.y = bodyH / 2 + 0.3; body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xe8c9a0, roughness: 0.7 })
    );
    head.position.y = bodyH + 0.7; head.castShadow = true;
    g.add(head);
    // faith halo (hidden until devout)
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.42, 18),
      new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.0, side: THREE.DoubleSide })
    );
    halo.rotation.x = -Math.PI / 2; halo.position.y = bodyH + 1.05;
    g.add(halo);
    // thought bubble
    const bubble = new THREE.Sprite(this.bubbleMats.wandering);
    bubble.scale.set(0.9, 0.9, 0.9);
    bubble.position.y = bodyH + 1.7;
    bubble.renderOrder = 998;
    g.add(bubble);
    g.userData = { being: b, head, body, halo, bodyH, bubble, bubbleKey: 'wandering' };
    this.scene.add(g);
    return g;
  }

  syncBeings() {
    const live = new Set();
    for (const b of this.sim.beings) {
      live.add(b.id);
      let g = this.beingMeshes.get(b.id);
      if (!g) { g = this._makeBeingMesh(b); this.beingMeshes.set(b.id, g); }
      g.position.set(b.x, b.y, b.z);
      g.rotation.y = -b.heading + Math.PI / 2 || 0;
      g.userData.halo.material.opacity = Math.min(0.85, b.godAwareness);
      // walk bob
      if (b.moving) g.userData.body.position.y = g.userData.bodyH / 2 + 0.3 + Math.sin(performance.now() * 0.012 + b.id) * 0.06;
      // thought bubble (LOD: hide when far to keep the view clean)
      const key = this._bubbleKey(b);
      if (key !== g.userData.bubbleKey) { g.userData.bubble.material = this.bubbleMats[key]; g.userData.bubbleKey = key; }
      const dist = this.camera.position.distanceTo(g.position);
      g.userData.bubble.visible = dist < 95;
    }
    // remove gone
    for (const [id, g] of this.beingMeshes) {
      if (!live.has(id)) { this.scene.remove(g); this.beingMeshes.delete(id); if (this.selected && this.selected.id === id) this.clearSelection(); }
    }
  }

  setSelected(b) { this.selected = b; }
  clearSelection() { this.selected = null; this.selRing.visible = false; }

  focusOn(b, close = false) {
    if (!b) return;
    this.controls.target.set(b.x, b.y + 1, b.z);
    const dist = close ? 7 : 14;
    this.camera.position.set(b.x + dist, b.y + dist * (close ? 0.5 : 0.7), b.z + dist);
  }

  raycastBeing(ndc) {
    this.raycaster.setFromCamera(ndc, this.camera);
    const meshes = [];
    for (const g of this.beingMeshes.values()) meshes.push(g.children[0], g.children[1]);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length) {
      let o = hits[0].object;
      while (o && !(o.userData && o.userData.being)) o = o.parent;
      if (o) return o.userData.being;
    }
    return null;
  }

  raycastGround(ndc) {
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.terrain, false);
    if (hits.length) return { x: hits[0].point.x, z: hits[0].point.z, y: hits[0].point.y };
    return null;
  }

  _updateSky() {
    // day/night cycle from fractional day
    const f = this.sim.day % 1;                     // 0..1 within a day
    const ang = f * Math.PI * 2 - Math.PI / 2;       // sunrise at f=0.25
    const elev = Math.sin(f * Math.PI);              // 0 at night edges, 1 at noon
    const R = WORLD.SIZE * 0.9;
    this.sun.position.set(Math.cos(ang) * R, Math.max(8, elev * R), Math.sin(ang * 0.6) * R * 0.4 + 40);
    this.sun.target.position.set(this.sim.home.x, 0, this.sim.home.z);
    this.sun.intensity = 0.3 + elev * 1.6;
    const warm = new THREE.Color(0xffd9a0), cool = new THREE.Color(0x6a86c0);
    this.sun.color.copy(cool).lerp(warm, Math.min(1, elev + 0.2));
    this.hemi.intensity = 0.25 + elev * 0.7;
    this._elev = elev;
    const night = new THREE.Color(0x0a0d14), dusk = new THREE.Color(0x1a2336), day = new THREE.Color(0x9fc0e8);
    const skyc = elev < 0.25 ? night.clone().lerp(dusk, elev / 0.25) : dusk.clone().lerp(day, (elev - 0.25) / 0.75);
    this.scene.background.copy(skyc);
    this.scene.fog.color.copy(skyc);
  }

  update(dt) {
    this.syncBeings();
    this.updateStructures();
    // bush berry visibility
    for (const g of this.bushMeshes) g.userData.berry.visible = g.userData.bush.berries > 0;

    // campfire flicker, brighter at night
    if (this.campfire) {
      const night = 1 - this._elev;
      const f = 0.7 + 0.3 * Math.sin(performance.now() * 0.02) + 0.15 * Math.sin(performance.now() * 0.057);
      this.campfire.light.intensity = (1.2 + night * 2.6) * f;
      this.campfire.flame.scale.y = 0.85 + 0.3 * f;
      this.campfire.flame.material.opacity = 0.8 + 0.2 * Math.sin(performance.now() * 0.03);
    }

    // name label follows the possessed being, else the selected one
    const labelTarget = (this.possessed && this.possessed.alive) ? this.possessed
      : (this.selected && this.selected.alive ? this.selected : null);
    if (labelTarget !== this._labelFor) this._setLabel(labelTarget);
    if (this._labelFor) {
      const g = this.beingMeshes.get(this._labelFor.id);
      if (g) this.labelSprite.position.set(g.position.x, g.position.y + g.userData.bodyH + 2.6, g.position.z);
    }
    // selection ring
    if (this.selected && this.selected.alive) {
      this.selRing.visible = true;
      this.selRing.position.set(this.selected.x, this.selected.y + 0.1, this.selected.z);
      this.selRing.rotation.z += dt * 1.5;
    } else this.selRing.visible = false;

    if (this.possessed && this.possessed.alive) {
      const p = this.possessed;
      this.controls.target.lerp(this.tmp.set(p.x, p.y + 1.2, p.z), 0.15);
    }
    this._updateEffects(dt);
    this._updateSky();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
