// Renderer — a stylized "God's Table" view of the sim. Heightmap terrain with biome
// vertex colors, water, trees, food, and a legible token per being. Orbital camera that
// can swoop to street level. No game logic here; it only reads sim state.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { WORLD, BUILDINGS } from './config.js';
import { BIOME } from './world.js';
import { RNG } from './rng.js';

const BIOME_COLOR = {
  [BIOME.OCEAN]: [0.05, 0.18, 0.32],
  [BIOME.BEACH]: [0.80, 0.73, 0.50],
  [BIOME.DESERT]: [0.82, 0.69, 0.40],
  [BIOME.SAVANNA]: [0.58, 0.55, 0.27],
  [BIOME.GRASS]: [0.34, 0.50, 0.23],
  [BIOME.FOREST]: [0.18, 0.36, 0.17],
  [BIOME.JUNGLE]: [0.12, 0.32, 0.14],
  [BIOME.TAIGA]: [0.24, 0.36, 0.30],
  [BIOME.TUNDRA]: [0.55, 0.58, 0.55],
  [BIOME.SNOW]: [0.92, 0.94, 0.97],
  [BIOME.ROCK]: [0.42, 0.40, 0.38],
};

// how thickly each biome grows blade-grass (unlisted biomes grow none)
const GRASS_DENSITY = {
  [BIOME.GRASS]: 1.0, [BIOME.SAVANNA]: 0.6, [BIOME.FOREST]: 0.5,
  [BIOME.JUNGLE]: 0.65, [BIOME.TAIGA]: 0.25,
};

export class Renderer {
  constructor(sim, assets = null) {
    this.sim = sim;
    this.assets = assets;        // AssetStore (may be null → primitive fallback)
    this.beingMeshes = new Map(); // id -> THREE.Group
    this.selected = null;
    this.possessed = null;
    this.tmp = new THREE.Vector3();
    // scratch objects reused every frame by the sky / shadow update
    this._sunDir = new THREE.Vector3();
    this._c1 = new THREE.Color(); this._c2 = new THREE.Color(); this._c3 = new THREE.Color();
  }
  _has(key) { return this.assets && this.assets.has(key); }

  mount(parent) {
    const w = window.innerWidth, h = window.innerHeight;
    // ?lowfx=1 — performance mode for low-end machines: no shadows, no AA, 1x pixels
    this.lowfx = new URLSearchParams(location.search).has('lowfx');
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.lowfx });
    this.renderer.setPixelRatio(this.lowfx ? 1 : Math.min(devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = !this.lowfx;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    parent.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0d14);
    this.scene.fog = new THREE.Fog(0x0a0d14, WORLD.SIZE * 0.7, WORLD.SIZE * 1.7);

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.5, 3000);
    const home = this.sim.home;
    this.camera.position.set(home.x + 52, 48, home.z + 66);

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
    this.sun.castShadow = !this.lowfx;
    // tight ortho shadow frustum that follows the camera target (see _updateSky);
    // the hemisphere light stays shadowless
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.near = 1; sc.far = 1000;
    sc.left = sc.bottom = -75; sc.right = sc.top = 75;
    sc.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.5;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this._buildTerrain();
    this._buildSky();
    this._buildGrass();
    this._buildWater();
    this._buildTrees();
    this._buildBushes();
    this._scatterRocks();
    this._buildSelection();

    this._initBubbles();
    this._initLabel();
    this.structGroup = new THREE.Group();
    this.scene.add(this.structGroup);
    this.huts = [];
    this.campfire = null;
    this.farms = null;
    this._elev = 1;

    this._buildRain();
    this.raycaster = new THREE.Raycaster();
    this.effects = [];

    // screen flash overlay (smite)
    this.flashEl = document.createElement('div');
    this.flashEl.style.cssText = 'position:fixed;inset:0;background:#ff7a3a;opacity:0;pointer-events:none;z-index:80;transition:opacity .08s;mix-blend-mode:screen;';
    document.body.appendChild(this.flashEl);

    window.addEventListener('resize', () => this._resize());
    return this;
  }

  // ---- rain: a particle field that follows the camera while a front passes ----
  _buildRain() {
    const N = 900, R = 90;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * R * 2;
      pos[i * 3 + 1] = Math.random() * 60;
      pos[i * 3 + 2] = (Math.random() - 0.5) * R * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x9fb8d8, size: 0.35, transparent: true, opacity: 0.55, depthWrite: false });
    this.rain = new THREE.Points(geo, mat);
    this.rain.visible = false;
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
    this._rainR = R;
  }
  _updateRain(dt) {
    const raining = this.sim.weather && this.sim.weather.state === 'rain';
    this.rain.visible = raining;
    if (!raining) return;
    const t = this.controls.target;
    this.rain.position.set(t.x, 0, t.z);
    const p = this.rain.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) - dt * 55;
      if (y < 0) y = 60;
      p.setY(i, y);
    }
    p.needsUpdate = true;
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
      'chopping wood': ['🪓', '#8a6a3a'], 'mining stone': ['⛏', '#7a7a82'], hunting: ['🏹', '#9a5a3a'],
      hauling: ['📦', '#a07a4a'], building: ['🔨', '#b08040'], farming: ['🌾', '#caa24a'],
      playing: ['🙂', '#7aa0c0'], leading: ['👑', '#d8b85a'],
      fighting: ['⚔', '#d0594a'], fleeing: ['🏃', '#d0a04a'], patrolling: ['🛡', '#7a8a9a'],
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
  // ---- speech bubbles: a being's spoken line floats above them briefly ----
  _speechTexture(text) {
    const words = text.split(' '); const lines = []; let line = '';
    for (const w of words) { if ((line + ' ' + w).trim().length > 24) { lines.push(line.trim()); line = w; } else line += ' ' + w; }
    if (line.trim()) lines.push(line.trim());
    const c = document.createElement('canvas'); const ctx = c.getContext('2d');
    const W = 340, H = 30 + lines.length * 34; c.width = W; c.height = H;
    ctx.font = '600 27px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(12,14,20,0.86)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(6, 4, W - 12, H - 14, 12); ctx.fill(); }
    else ctx.fillRect(6, 4, W - 12, H - 14);
    ctx.strokeStyle = 'rgba(232,200,122,0.4)'; ctx.lineWidth = 2; if (ctx.roundRect) ctx.stroke();
    ctx.fillStyle = '#eef0f6';
    lines.forEach((l, i) => ctx.fillText(l, W / 2, 22 + i * 34));
    const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
    return { tex, aspect: W / H };
  }
  _updateSpeech(dt) {
    if (!this.speeches) this.speeches = new Map();
    for (const b of this.sim.beings) {
      if (!b._say || !b._sayId) continue;
      const g = this.beingMeshes.get(b.id); if (!g) continue;
      if (this.camera.position.distanceTo(g.position) > 150) continue;
      const e = this.speeches.get(b.id);
      if (!e || e.sayId !== b._sayId) {
        if (e) { this.scene.remove(e.sprite); if (e.sprite.material.map) e.sprite.material.map.dispose(); }
        const { tex, aspect } = this._speechTexture(b._say);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
        const w = 6.5; sp.scale.set(w, w / aspect, 1); sp.renderOrder = 1000;
        this.scene.add(sp);
        this.speeches.set(b.id, { sprite: sp, ttl: 4.5, sayId: b._sayId });
      }
    }
    for (const [id, e] of this.speeches) {
      e.ttl -= dt;
      const g = this.beingMeshes.get(id);
      if (e.ttl <= 0 || !g) { this.scene.remove(e.sprite); if (e.sprite.material.map) e.sprite.material.map.dispose(); this.speeches.delete(id); continue; }
      e.sprite.position.set(g.position.x, g.position.y + (g.userData.bodyH || 1.6) + 3.1, g.position.z);
      e.sprite.material.opacity = e.ttl < 1 ? e.ttl : (e.ttl > 3.5 ? 4.5 - e.ttl : 1);
    }
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
    if (!this.campfires) this.campfires = [];
    for (const tribe of this.sim.tribes) {
      if (tribe.tech.includes('fire') && !tribe._campfire) this._buildCampfire(tribe);
      // huts are built by the tribe's builders — render one mesh per built hut
      tribe._hutCount = tribe._hutCount || 0;
      while (tribe._hutCount < tribe.huts.length) {
        this._addHutMesh(tribe.huts[tribe._hutCount], tribe._hutCount, tribe);
        tribe._hutCount++;
      }
      if (tribe.tech.includes('ritual') && !tribe._totem) this._buildTotem(tribe);
      if (tribe.farms.length && !tribe._farms) this._buildFarmsForTribe(tribe);
    }
    // player-placed buildings (skip 'hut' — rendered via the huts array)
    if (!this.buildingMeshes) this.buildingMeshes = new Map();
    for (const tribe of this.sim.tribes) {
      for (const b of tribe.buildings) {
        if (b.type === 'hut') continue;
        let rec = this.buildingMeshes.get(b);
        if (!rec) {
          const grp = new THREE.Group();
          const mesh = this._makeBuildingMesh(b.type);
          const scaffold = this._makeScaffold();
          grp.add(mesh); grp.add(scaffold);
          grp.position.set(b.x, b.y, b.z);
          this.structGroup.add(grp);
          rec = { grp, mesh, scaffold, type: b.type, baseY: b.y, phase: Math.random() * 6 };
          this.buildingMeshes.set(b, rec);
        }
        rec.mesh.scale.y = b.built ? 1 : (0.2 + 0.8 * Math.min(1, b.progress / b.work));
        rec.scaffold.visible = !b.built;
        // ships ride the water
        if (rec.type === 'ship' && b.built) {
          const t = performance.now() * 0.0012 + rec.phase;
          rec.grp.position.y = rec.baseY + Math.sin(t) * 0.09;
          rec.grp.rotation.z = Math.sin(t * 0.7) * 0.03;
        }
      }
    }
  }

  // a simple wooden work-frame shown while a site is under construction
  _makeScaffold() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xa08050, roughness: 1 });
    for (const dx of [-1.6, 1.6]) for (const dz of [-1.6, 1.6]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 5), mat);
      pole.position.set(dx, 1.6, dz);
      g.add(pole);
    }
    for (const [a, b2] of [[[-1.6, 1.6], [1.6, 1.6]], [[-1.6, -1.6], [1.6, -1.6]]]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 5), mat);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 2.6, a[1]);
      g.add(bar);
    }
    return g;
  }

  _makeBuildingMesh(type) {
    const g = new THREE.Group();
    const WOOD = 0x8a6a44, DARK = 0x5a3a22, STONE = 0x9a9690, STRAW = 0xc0a256;
    const box = (w, h, d, c, y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
      m.position.y = y + h / 2; m.castShadow = true; g.add(m); return m;
    };
    // any building whose config names a loaded GLB uses it; primitives below are the fallback
    const meshKey = BUILDINGS[type] && BUILDINGS[type].mesh;
    if (meshKey && this._has(meshKey)) { g.add(this.assets.clone(meshKey)); return g; }
    switch (type) {
      case 'storehouse': { box(4, 2, 3, WOOD, 0); const r = box(4.4, 0.4, 3.4, DARK, 2); break; }
      case 'granary': { box(2, 0.6, 2, WOOD, 0); const b = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.8, 10), new THREE.MeshStandardMaterial({ color: STRAW, roughness: 1 })); b.position.y = 1.5; b.castShadow = true; g.add(b); const r = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1, 10), new THREE.MeshStandardMaterial({ color: DARK })); r.position.y = 2.9; g.add(r); break; }
      case 'farm': { const m = new THREE.Mesh(new THREE.BoxGeometry(4, 0.16, 4), new THREE.MeshStandardMaterial({ color: 0x6a5a2a, roughness: 1 })); m.position.y = 0.08; g.add(m); break; }
      case 'lodge': { box(3, 1.6, 2.4, WOOD, 0); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.6, 6), new THREE.MeshStandardMaterial({ color: DARK })); l.rotation.z = Math.PI / 2; l.position.set(1.7, 0.3, 0); g.add(l); break; }
      case 'mine': { const mo = new THREE.Mesh(new THREE.ConeGeometry(2, 1.6, 6), new THREE.MeshStandardMaterial({ color: STONE, roughness: 1 })); mo.position.y = 0.8; mo.castShadow = true; g.add(mo); const e = box(1, 1, 0.5, 0x141414, 0); e.position.z = 1.5; break; }
      case 'monument': { box(2.4, 0.6, 2.4, STONE, 0); const ob = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 5, 4), new THREE.MeshStandardMaterial({ color: STONE, roughness: 1 })); ob.position.y = 3; ob.castShadow = true; g.add(ob); break; }
      case 'palisade': { for (let i = -2; i <= 2; i++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.2, 6), new THREE.MeshStandardMaterial({ color: DARK, roughness: 1 })); lg.position.set(i * 0.5, 1.1, 0); lg.castShadow = true; g.add(lg); const tp = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 6), new THREE.MeshStandardMaterial({ color: DARK })); tp.position.set(i * 0.5, 2.3, 0); g.add(tp); } break; }
      case 'watchtower': { for (const dx of [-0.8, 0.8]) for (const dz of [-0.8, 0.8]) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.4, 6), new THREE.MeshStandardMaterial({ color: WOOD })); lg.position.set(dx, 1.7, dz); g.add(lg); } box(2.4, 0.3, 2.4, WOOD, 3.2); const r = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1, 4), new THREE.MeshStandardMaterial({ color: DARK })); r.position.y = 4.2; r.rotation.y = Math.PI / 4; g.add(r); break; }
      case 'totem': { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 3.2, 6), new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 1 })); p.position.y = 1.6; p.castShadow = true; g.add(p); break; }
      case 'well': {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.7, 10, 1, true), new THREE.MeshStandardMaterial({ color: STONE, roughness: 1, side: THREE.DoubleSide }));
        ring.position.y = 0.35; g.add(ring);
        for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 5), new THREE.MeshStandardMaterial({ color: DARK })); post.position.set(s * 0.8, 0.8, 0); g.add(post); }
        const cap = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.5, 4), new THREE.MeshStandardMaterial({ color: STRAW })); cap.position.y = 1.8; cap.rotation.y = Math.PI / 4; g.add(cap);
        break;
      }
      case 'circle': {
        for (let i = 0; i < 7; i++) {
          const st = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3 + (i % 3) * 0.3, 0.35), new THREE.MeshStandardMaterial({ color: STONE, roughness: 1 }));
          const a = i / 7 * Math.PI * 2;
          st.position.set(Math.cos(a) * 1.7, 0.7, Math.sin(a) * 1.7);
          st.rotation.y = -a; st.castShadow = true; g.add(st);
        }
        break;
      }
      case 'dock': {
        const deck = box(1.6, 0.18, 5.5, WOOD, 0.5); deck.position.z = -1.6;
        for (const dz of [-3.8, -1.8, 0.2]) for (const dx of [-0.6, 0.6]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.4, 5), new THREE.MeshStandardMaterial({ color: DARK }));
          post.position.set(dx, 0, dz); g.add(post);
        }
        break;
      }
      case 'ship': {
        const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 2.4, 4, 8), new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.9 }));
        hull.rotation.z = Math.PI / 2; hull.scale.y = 0.55; hull.position.y = 0.3; hull.castShadow = true; g.add(hull);
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 6), new THREE.MeshStandardMaterial({ color: DARK }));
        mast.position.y = 1.4; g.add(mast);
        const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.1), new THREE.MeshStandardMaterial({ color: 0xd8c9a0, side: THREE.DoubleSide, roughness: 1 }));
        sail.position.set(0, 1.6, 0.02); g.add(sail);
        break;
      }
      default: box(2.2, 1.6, 2.2, WOOD, 0);
    }
    return g;
  }

  // ---- placement ghost ----
  showGhost(type, x, z, valid) {
    if (this._ghostType !== type) {
      if (this.ghost) this.scene.remove(this.ghost);
      this.ghost = this._makeBuildingMesh(type);
      this.ghost.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.5; o.castShadow = false; } });
      this.scene.add(this.ghost);
      this._ghostType = type;
    }
    this.ghost.visible = true;
    this.ghost.position.set(x, Math.max(0.05, this.sim.world.heightAt(x, z)), z);
    const col = valid ? 0x6ad06a : 0xd05a5a;
    this.ghost.traverse((o) => { if (o.isMesh && o.material.color) o.material.color.setHex(col); });
  }
  hideGhost() { if (this.ghost) this.ghost.visible = false; }
  _buildCampfire(tribe) {
    const home = tribe.home;
    const g = new THREE.Group();
    if (this._has('campfire')) {
      g.add(this.assets.clone('campfire'));
    } else {
      const logs = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1 }));
      logs.position.y = 0.2; g.add(logs);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.0, 7),
        new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.92 }));
      flame.position.y = 0.9; g.add(flame); g.userData.flame = flame;
    }
    const light = new THREE.PointLight(0xff7a2a, 0, 26, 2); light.position.y = 1.2; g.add(light);
    g.position.set(home.x, this.sim.world.heightAt(home.x, home.z), home.z);
    this.structGroup.add(g);
    tribe._campfire = { group: g, flame: g.userData.flame || null, light };
    this.campfires.push(tribe._campfire);
  }
  _addHutMesh(hut, i) {
    const x = hut.x, z = hut.z, y = hut.y;
    const ang = (i / 6) * Math.PI * 2 + 0.7;
    const g = new THREE.Group();
    if (this._has('hut')) {
      const h = this.assets.clone('hut');
      h.scale.multiplyScalar(0.85 + (i % 5) * 0.06);
      g.add(h);
    } else {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 2.2),
        new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 1 }));
      wall.position.y = 0.8; wall.castShadow = true; g.add(wall);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.3, 4),
        new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 1 }));
      roof.position.y = 2.25; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
    }
    g.position.set(x, y, z); g.rotation.y = ang;
    this.structGroup.add(g);
    this.huts.push(g);
  }
  _buildTotem(tribe) {
    const x = tribe.home.x + 3.5, z = tribe.home.z + 3.5, y = this.sim.world.heightAt(x, z);
    const g = new THREE.Group();
    if (this._has('totem')) g.add(this.assets.clone('totem'));
    else {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 3.2, 6),
        new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 1 }));
      pole.position.y = 1.6; pole.castShadow = true; g.add(pole);
    }
    g.position.set(x, y, z);
    this.structGroup.add(g);
    tribe._totem = g;
  }
  _scatterRocks() {
    if (!this._has('rock')) return;
    const pts = this.sim.world.rocks;
    if (!pts.length) return;
    const m = new THREE.Matrix4(), sv = new THREE.Vector3();
    const { geometry, material } = this.assets.instanced('rock');
    const rocks = new THREE.InstancedMesh(geometry, material, pts.length);
    rocks.castShadow = true; rocks.receiveShadow = true;
    pts.forEach((p, i) => {
      const s = p.s || 1;
      m.makeRotationY((i * 1.7) % (Math.PI * 2)); m.scale(sv.set(s, s, s)); m.setPosition(p.x, p.y, p.z);
      rocks.setMatrixAt(i, m);
    });
    this.scene.add(rocks);
  }
  _buildFarmsForTribe(tribe) {
    const grp = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x6a5a2a, roughness: 1 });
    for (const f of tribe.farms) {
      const patch = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 4), mat);
      patch.position.set(f.x, f.y + 0.1, f.z);
      grp.add(patch);
    }
    this.structGroup.add(grp);
    tribe._farms = grp;
  }

  // ---- fauna (deer / boar / wolf / mammoth) ----
  // Each beast is a yaw group (g) holding an inner gait group: yaw lives on g, while
  // procedural bob/pitch/roll live on the inner so they act in the beast's own frame
  // (the GLBs are single static meshes — no rigs — so the gait is fully procedural).
  _makeBeast(type) {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    g.add(inner);
    let bodyH;
    // generated low-poly GLB if available (already normalized: base at y=0, scaled)
    if (this._has(type)) {
      const m = this.assets.clone(type);
      m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      inner.add(m);
      bodyH = this.assets.assets[type].height || 1.2;
    } else {
      const SPEC = {
        deer: { c: 0x9a7048, s: 1.0, len: 0.7, r: 0.30, legH: 1.0, antler: true },
        boar: { c: 0x4a3a2e, s: 1.05, len: 0.8, r: 0.44, legH: 0.6, antler: false },
        wolf: { c: 0x74777f, s: 0.92, len: 0.85, r: 0.24, legH: 0.62, antler: false },
      }[type] || { c: 0x8a6a44, s: 1, len: 0.7, r: 0.3, legH: 1.0 };
      const mat = new THREE.MeshStandardMaterial({ color: SPEC.c, roughness: 0.95 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(SPEC.r, SPEC.len, 4, 8), mat);
      body.rotation.z = Math.PI / 2; body.position.y = SPEC.legH + SPEC.r; body.castShadow = true; inner.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(SPEC.r * 0.62, 8, 8), mat);
      head.position.set(SPEC.len * 0.7 + SPEC.r, SPEC.legH + SPEC.r + (type === 'deer' ? 0.45 : 0.05), 0); inner.add(head);
      if (SPEC.antler) {
        const am = new THREE.MeshStandardMaterial({ color: 0xb8a070, roughness: 1 });
        for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.4, 4), am); a.position.set(SPEC.len * 0.7 + SPEC.r, SPEC.legH + SPEC.r + 0.8, s * 0.1); inner.add(a); }
      }
      for (const dx of [-0.28, 0.28]) for (const dz of [-0.16, 0.16]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, SPEC.legH, 4), mat);
        leg.position.set(dx, SPEC.legH / 2, dz); inner.add(leg);
      }
      g.scale.setScalar(SPEC.s);
      bodyH = SPEC.legH + SPEC.r * 2;   // inner-local units; g.scale brings them to world
    }
    // stride: gait phase locked to distance travelled; move: smoothed 0..1 walk blend
    g.userData = { inner, bodyH, stride: Math.random() * Math.PI * 2, move: 0, seed: Math.random() * Math.PI * 2 };
    this.scene.add(g);
    return g;
  }
  syncFauna() {
    if (!this.beastMeshes) this.beastMeshes = [];
    const fauna = this.sim.fauna;
    const dtf = this._dt || 0.016;
    const world = this.sim.world;
    const now = performance.now() * 0.001;
    for (let i = 0; i < fauna.length; i++) {
      const d = fauna[i];
      let g = this.beastMeshes[i];
      if (!g) { g = this._makeBeast(d.type); this.beastMeshes[i] = g; }
      const st = g.userData;
      if (!d.alive) { if (g.visible) g.visible = false; st.lastX = undefined; continue; }
      // measured ground speed — drives both facing and gait cadence
      const px = st.lastX !== undefined ? st.lastX : d.x;
      const pz = st.lastX !== undefined ? st.lastZ : d.z;
      let vel = Math.hypot(d.x - px, d.z - pz) / dtf;
      if (vel > 40) vel = 0;   // respawn teleport — don't whip around or gallop in place
      st.lastX = d.x; st.lastZ = d.z;
      // grounding: sit exactly on the terrain every frame, slopes included
      g.position.set(d.x, world.heightAt(d.x, d.z), d.z);
      const vis = this.camera.position.distanceTo(g.position) < 320;
      if (g.visible !== vis) g.visible = vis;
      if (!vis) continue;
      // smooth facing: yaw-lerp toward the direction actually travelled (no snapping)
      if (vel > 0.4) {
        const ty = -Math.atan2(d.z - pz, d.x - px);
        let dr = ty - g.rotation.y;
        while (dr > Math.PI) dr -= Math.PI * 2;
        while (dr < -Math.PI) dr += Math.PI * 2;
        g.rotation.y += dr * Math.min(1, dtf * 9);
      }
      // gait: phase advances with distance travelled (faster animals cycle faster;
      // stride length scales with body size), blended out smoothly when idle
      st.move += ((vel > 0.4 ? 1 : 0) - st.move) * Math.min(1, dtf * 6);
      st.stride += vel * dtf * (Math.PI * 2 / (0.9 * st.bodyH));
      const inner = st.inner, mv = st.move;
      let bob = Math.sin(st.stride * 2) * st.bodyH * 0.025 * mv;   // two footfalls per cycle
      let pitch = Math.sin(st.stride) * 0.06 * mv;                 // ~3.5° nose rock
      inner.rotation.x = Math.cos(st.stride) * 0.03 * mv;          // tiny roll sway
      // idle life: occasional slow grazing head-dips so standing animals aren't frozen
      const idle = 1 - mv;
      if (idle > 0.05) {
        const nod = Math.max(0, Math.sin(now * 0.35 + st.seed * 1.7)) * Math.sin(now * 1.1 + st.seed);
        pitch += nod * -0.07 * idle;
        bob += -Math.abs(nod) * 0.012 * st.bodyH * idle;
      }
      inner.position.y = bob;
      inner.rotation.z = pitch;
    }
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
    // per-vertex texture-splat weights (grass, dirt, rock, sand) — lowfx keeps flat colour
    if (!this.lowfx) geo.setAttribute('splat', new THREE.BufferAttribute(this._terrainSplat(world, n), 4));
    geo.computeVertexNormals();
    return geo;
  }

  // splat weights per grid vertex from the same biome/height/slope data the vertex
  // colours use. A 3x3 blur pass softens biome borders so texture transitions are
  // gradual; weights are normalized to sum 1. Grid order matches plane vertex order.
  _terrainSplat(world, n) {
    // base weights per biome: [grass, dirt, rock, sand]
    const W = {
      [BIOME.OCEAN]: [0, 0.10, 0, 0.90],
      [BIOME.BEACH]: [0, 0.08, 0, 0.92],
      [BIOME.DESERT]: [0, 0.18, 0.02, 0.80],
      [BIOME.SAVANNA]: [0.42, 0.55, 0.03, 0],
      [BIOME.GRASS]: [0.92, 0.08, 0, 0],
      [BIOME.FOREST]: [0.78, 0.22, 0, 0],
      [BIOME.JUNGLE]: [0.85, 0.15, 0, 0],
      [BIOME.TAIGA]: [0.50, 0.42, 0.08, 0],
      [BIOME.TUNDRA]: [0.12, 0.62, 0.26, 0],
      [BIOME.SNOW]: [0, 0.08, 0.92, 0],   // rock texture × white vertex colour = snow
      [BIOME.ROCK]: [0.04, 0.18, 0.78, 0],
    };
    const stride = n + 1, count = stride * stride;
    const raw = new Float32Array(count * 4);
    const cell = WORLD.SIZE / n;
    const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let iy = 0; iy <= n; iy++) {
      for (let ix = 0; ix <= n; ix++) {
        const id = iy * stride + ix;
        const w = W[world.biome[id]] || W[BIOME.GRASS];
        // slope from central height differences — steep faces read as bare rock
        const xl = world.h[iy * stride + Math.max(0, ix - 1)], xr = world.h[iy * stride + Math.min(n, ix + 1)];
        const zl = world.h[Math.max(0, iy - 1) * stride + ix], zr = world.h[Math.min(n, iy + 1) * stride + ix];
        const slope = Math.hypot(xr - xl, zr - zl) / (2 * cell);
        const rk = sstep(0.45, 0.95, slope);
        const o = id * 4;
        raw[o] = w[0] * (1 - rk);
        raw[o + 1] = w[1] * (1 - rk) + 0.15 * rk;
        raw[o + 2] = w[2] + 0.85 * rk;
        raw[o + 3] = w[3] * (1 - rk);
      }
    }
    const out = new Float32Array(count * 4);
    for (let iy = 0; iy <= n; iy++) {
      for (let ix = 0; ix <= n; ix++) {
        let a = 0, b = 0, c = 0, d = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const jx = ix + dx, jy = iy + dy;
          if (jx < 0 || jx > n || jy < 0 || jy > n) continue;
          const jo = (jy * stride + jx) * 4;
          a += raw[jo]; b += raw[jo + 1]; c += raw[jo + 2]; d += raw[jo + 3];
        }
        const o = (iy * stride + ix) * 4, s = (a + b + c + d) || 1;
        out[o] = a / s; out[o + 1] = b / s; out[o + 2] = c / s; out[o + 3] = d / s;
      }
    }
    return out;
  }

  _buildTerrain() {
    const geo = this._terrainGeometry();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.0, flatShading: false });
    if (!this.lowfx) this._patchTerrainMat(mat);
    this.terrain = new THREE.Mesh(geo, mat);
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
  }

  // ---- terrain texture splatting: four tiling ground maps blended by the per-vertex
  // 'splat' weights, then MULTIPLIED into the existing biome vertex colour so tinting,
  // shadows, and the day/night lighting pipeline stay exactly as they were. Patched
  // via onBeforeCompile (the material stays a MeshStandardMaterial, so receiveShadow
  // and all lighting chunks survive). Skipped entirely under lowfx. ----
  _patchTerrainMat(mat) {
    const base = (import.meta.env && import.meta.env.BASE_URL) || '/';
    const loader = new THREE.TextureLoader();
    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this._terrU = {
      uTexGrass: { value: null }, uTexDirt: { value: null },
      uTexRock: { value: null }, uTexSand: { value: null },
      // per-map brightness compensation, auto-tuned from each image's mean luminance
      // so multiplying by the texture never darkens the ground (1.6 until measured)
      uTexBoost: { value: new THREE.Vector4(1.6, 1.6, 1.6, 1.6) },
      uTexAmt: { value: 0 },   // stays 0 (plain vertex colour) until all four maps arrive
    };
    let loaded = 0;
    ['Grass', 'Dirt', 'Rock', 'Sand'].forEach((nm, i) => {
      loader.load(base + 'textures/tex_' + nm.toLowerCase() + '.jpg', (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = aniso;
        this._terrU['uTex' + nm].value = tex;
        this._texBoostFromImage(tex, i);
        if (++loaded === 4) this._terrU.uTexAmt.value = 1;
      });
    });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this._terrU);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 splat;\nvarying vec4 vSplat;\nvarying vec3 vTerrPos;')
        .replace('#include <begin_vertex>', [
          '#include <begin_vertex>',
          'vSplat = splat;',
          'vTerrPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        ].join('\n'));
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', [
          '#include <common>',
          'uniform sampler2D uTexGrass, uTexDirt, uTexRock, uTexSand;',
          'uniform vec4 uTexBoost;',
          'uniform float uTexAmt;',
          'varying vec4 vSplat;',
          'varying vec3 vTerrPos;',
        ].join('\n'))
        .replace('#include <color_fragment>', [
          '#include <color_fragment>',
          '{',
          // world-space UVs: one texture tile per ~14 world units
          '  vec2 tuv = vTerrPos.xz / 14.0;',
          // fade textures out at distance so tiling never reads from orbit
          '  float texAmt = uTexAmt * (1.0 - smoothstep(180.0, 320.0, distance(cameraPosition, vTerrPos)));',
          '  vec4 sw = vSplat / max(vSplat.x + vSplat.y + vSplat.z + vSplat.w, 1e-3);',
          '  vec3 tcol = texture2D(uTexGrass, tuv).rgb * (sw.x * uTexBoost.x)',
          '            + texture2D(uTexDirt, tuv).rgb * (sw.y * uTexBoost.y)',
          '            + texture2D(uTexRock, tuv).rgb * (sw.z * uTexBoost.z)',
          '            + texture2D(uTexSand, tuv).rgb * (sw.w * uTexBoost.w);',
          '  diffuseColor.rgb *= mix(vec3(1.0), tcol, texAmt);',
          '}',
        ].join('\n'));
    };
  }

  // measure a ground map's mean linear-space luminance on a tiny canvas and set its
  // brightness-compensation component so (vertexColour × texture) matches the old
  // flat-colour brightness on average
  _texBoostFromImage(tex, idx) {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(tex.image, 0, 0, 32, 32);
      const px = ctx.getImageData(0, 0, 32, 32).data;
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) {
        sum += 0.2126 * Math.pow(px[i] / 255, 2.2)
             + 0.7152 * Math.pow(px[i + 1] / 255, 2.2)
             + 0.0722 * Math.pow(px[i + 2] / 255, 2.2);
      }
      const mean = sum / (px.length / 4);
      this._terrU.uTexBoost.value.setComponent(idx, Math.min(4, Math.max(1, 1.05 / Math.max(0.05, mean))));
    } catch (e) { /* canvas read blocked — keep the 1.6 default */ }
  }

  refreshTerrain() {
    const geo = this._terrainGeometry();
    this.terrain.geometry.dispose();
    this.terrain.geometry = geo;
    // terraforming moved the ground — regrow every grass cell against the new heights
    if (this._grassCells) {
      for (const slot of this._grassCells.values()) this._grassFree.push(slot);
      this._grassCells.clear();
      this._grassCX = null;   // forces the want-set rebuild next frame
    }
  }

  _buildWater() {
    const S = WORLD.SIZE * 1.6;
    // segments only when we animate; lowfx keeps the old single-quad static sheet
    const segs = this.lowfx ? 1 : 96;
    const geo = new THREE.PlaneGeometry(S, S, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1b4a6b, transparent: true, opacity: 0.82, roughness: 0.25, metalness: 0.3,
    });
    if (!this.lowfx) {
      // gentle vertex ripple + a fresnel-ish pale band where the water meets the horizon
      this._waterU = { uTime: { value: 0 } };
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = this._waterU.uTime;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vWaterPos;')
          .replace('#include <begin_vertex>', [
            '#include <begin_vertex>',
            'transformed.y += sin(position.x * 0.045 + uTime * 1.1) * 0.10',
            '  + sin(position.z * 0.062 - uTime * 0.8) * 0.08',
            '  + sin((position.x + position.z) * 0.021 + uTime * 0.55) * 0.06;',
            'vWaterPos = transformed;',
          ].join('\n'));
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vWaterPos;')
          .replace('#include <color_fragment>', [
            '#include <color_fragment>',
            '{',
            '  vec3 vdir = normalize(cameraPosition - vWaterPos);',
            '  float fres = pow(1.0 - clamp(vdir.y, 0.0, 1.0), 3.0);',
            '  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.52, 0.70, 0.78), fres * 0.55);',
            '  float shimmer = sin(vWaterPos.x * 0.55 + uTime * 1.6) * sin(vWaterPos.z * 0.47 - uTime * 1.2);',
            '  diffuseColor.rgb += vec3(0.028) * shimmer * (0.35 + fres);',
            '}',
          ].join('\n'));
      };
    }
    this.water = new THREE.Mesh(geo, mat);
    this.water.position.y = WORLD.SEA_LEVEL + 0.15;
    this.scene.add(this.water);
  }

  // ---- gradient sky dome: zenith→horizon blend with a warm glow around the sun ----
  _buildSky() {
    if (this.lowfx) return; // the flat background colour is enough in cheap mode
    this.skyU = {
      uTop: { value: new THREE.Color(0x0a0d14) },
      uHorizon: { value: new THREE.Color(0x0a0d14) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uWarm: { value: new THREE.Color(0xff8a45) },
      uWarmAmt: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyU,
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'varying vec3 vDir;',
        'uniform vec3 uTop, uHorizon, uWarm, uSunDir;',
        'uniform float uWarmAmt;',
        'void main(){',
        '  vec3 d = normalize(vDir);',
        '  vec3 col = mix(uHorizon, uTop, pow(clamp(d.y, 0.0, 1.0), 0.58));',
        '  col += uWarm * (pow(max(dot(d, uSunDir), 0.0), 5.0) * uWarmAmt);', // dawn/dusk glow
        '  gl_FragColor = vec4(col, 1.0);',
        '}',
      ].join('\n'),
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(2400, 24, 14), mat);
    this.skyDome.frustumCulled = false;
    this.skyDome.renderOrder = -1;
    this.scene.add(this.skyDome);
  }

  // ---- grass: one InstancedMesh of wind-blown blades around the camera target ----
  // Blades live in 16-unit cells keyed by integer coords; each cell fills from a
  // per-cell seeded RNG so the same cell always regrows the exact same tuft. As the
  // camera target moves, cells that fall out of range hand their slots to new cells,
  // and a shader fade scales blades to nothing near the outer radius (no hard edge).
  _buildGrass() {
    const CELL = 16, RADIUS = 120;
    const ring = [];                       // cell offsets that fall inside the radius
    const reach = RADIUS / CELL + 0.71;    // allow the cell diagonal
    for (let dz = -9; dz <= 9; dz++) for (let dx = -9; dx <= 9; dx++) {
      if (Math.hypot(dx + 0.5, dz + 0.5) <= reach) ring.push([dx, dz]);
    }
    // ~40k blades normally, ~6k under lowfx
    this._grassCfg = { CELL, ring, perCell: this.lowfx ? 28 : 190 };
    const slots = ring.length + 8;
    const count = slots * this._grassCfg.perCell;
    this._grassU = {
      uTime: { value: 0 },
      uWind: { value: 1 },
      uGrassEye: { value: new THREE.Vector3() },
    };
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this._grassU.uTime;
      shader.uniforms.uWind = this._grassU.uWind;
      shader.uniforms.uGrassEye = this._grassU.uGrassEye;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime, uWind;\nuniform vec3 uGrassEye;')
        .replace('#include <begin_vertex>', [
          '#include <begin_vertex>',
          '#ifdef USE_INSTANCING',
          '  vec3 gPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);',
          // shrink to nothing toward the outer radius so the field has no hard edge
          '  transformed *= 1.0 - smoothstep(90.0, 120.0, distance(gPos.xz, uGrassEye.xz));',
          // wind: a couple of drifting sine fields bend the blade tops
          '  float gw = position.y * position.y * uWind;',
          '  transformed.x += (sin(uTime * 1.7 + gPos.x * 0.35 + gPos.z * 0.25) + 0.45 * sin(uTime * 3.9 + gPos.x * 1.1)) * 0.16 * gw;',
          '  transformed.z += cos(uTime * 1.4 + gPos.z * 0.31 + gPos.x * 0.21) * 0.11 * gw;',
          '#endif',
        ].join('\n'));
    };
    const grass = new THREE.InstancedMesh(this._grassGeometry(), mat, count);
    grass.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    grass.castShadow = false; grass.receiveShadow = false;
    grass.frustumCulled = false;   // blades surround the target; the shader fade culls
    this.scene.add(grass);
    this.grass = grass;
    this._grassCells = new Map();  // 'cx,cz' -> slot
    this._grassFree = [];
    for (let i = slots - 1; i >= 0; i--) this._grassFree.push(i);
    this._grassQueue = [];
    this._grassCX = null; this._grassCZ = null;
    // scratch objects for cell fills
    this._gm = new THREE.Matrix4(); this._gq = new THREE.Quaternion();
    this._ge = new THREE.Euler(); this._gp = new THREE.Vector3(); this._gs = new THREE.Vector3();
    this._gc = new THREE.Color(); this._gc2 = new THREE.Color();
  }

  // one blade: two crossed, tapered strips of unit height (the instance scale sets the
  // real 0.5–0.9 height), vertex-coloured dark→light from root to tip
  _grassGeometry() {
    const pos = [], col = [], norm = [], idx = [];
    // [halfWidth, y, forward lean, r, g, b] at three levels up the blade
    const LVL = [
      [0.085, 0.0, 0.00, 0.36, 0.40, 0.34],
      [0.055, 0.55, 0.05, 0.68, 0.72, 0.60],
      [0.010, 1.0, 0.14, 1.00, 1.00, 0.82],
    ];
    for (const rot of [0, Math.PI / 2]) {
      const c = Math.cos(rot), s = Math.sin(rot);
      const o = pos.length / 3;
      for (const [hw, y, lean, r, g, b] of LVL) {
        for (const sgn of [-1, 1]) {
          pos.push(sgn * hw * c + lean * s, y, -sgn * hw * s + lean * c);
          norm.push(0, 1, 0);        // up-facing normals: blades take the ground's light
          col.push(r, g, b);
        }
      }
      idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2, o + 2, o + 3, o + 4, o + 3, o + 5, o + 4);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    return geo;
  }

  _grassFillCell(slot, cx, cz) {
    const { CELL, perCell } = this._grassCfg;
    const world = this.sim.world;
    // deterministic per-cell seed — a cell never pops differently on revisit
    const rng = new RNG((Math.imul(cx, 0x9E3779B1) ^ Math.imul(cz, 0x85EBCA77)) >>> 0);
    const m = this._gm, q = this._gq, e = this._ge, p = this._gp, s = this._gs, c = this._gc;
    const base = slot * perCell;
    for (let i = 0; i < perCell; i++) {
      const x = (cx + rng.next()) * CELL;
      const z = (cz + rng.next()) * CELL;
      const keep = rng.next();
      const h = world.heightAt(x, z);
      const biome = world.biomeAt(x, z);
      let ok = h > WORLD.SEA_LEVEL + 0.5 && keep < (GRASS_DENSITY[biome] || 0);
      if (ok) { // flat-ish ground only — no grass on cliff faces
        ok = Math.abs(world.heightAt(x + 1.2, z) - h) + Math.abs(world.heightAt(x, z + 1.2) - h) < 1.1;
      }
      const hgt = rng.range(0.5, 0.9), wid = rng.range(0.8, 1.25);
      e.set(rng.range(-0.13, 0.13), rng.next() * Math.PI * 2, rng.range(-0.13, 0.13));
      if (ok) m.compose(p.set(x, h - 0.02, z), q.setFromEuler(e), s.set(wid, hgt, wid));
      else m.makeScale(0, 0, 0);   // rejected blades collapse to nothing
      this.grass.setMatrixAt(base + i, m);
      // tint: green pulled toward the underlying biome colour, plus a little variance
      const bc = BIOME_COLOR[biome] || BIOME_COLOR[BIOME.GRASS];
      c.setRGB(0.36, 0.55, 0.25).lerp(this._gc2.setRGB(bc[0], bc[1], bc[2]), 0.4);
      c.offsetHSL(rng.range(-0.03, 0.03), rng.range(-0.05, 0.08), rng.range(-0.05, 0.05));
      this.grass.setColorAt(base + i, c);
    }
  }

  _updateGrass(dt) {
    if (!this.grass) return;
    const u = this._grassU, t = this.controls.target;
    u.uTime.value += dt;
    // wind picks up while a rain front passes
    const gale = this.sim.weather && this.sim.weather.state === 'rain' ? 2.1 : 1;
    u.uWind.value += (gale - u.uWind.value) * Math.min(1, dt * 0.6);
    u.uGrassEye.value.set(t.x, 0, t.z);
    // continental zoom: individual blades are subpixel — skip the draw entirely
    this.grass.visible = this.camera.position.distanceTo(t) < 500;
    if (!this.grass.visible) return;
    const { CELL, ring } = this._grassCfg;
    const ccx = Math.floor(t.x / CELL), ccz = Math.floor(t.z / CELL);
    if (ccx !== this._grassCX || ccz !== this._grassCZ) {
      this._grassCX = ccx; this._grassCZ = ccz;
      const want = new Set();
      for (const [dx, dz] of ring) want.add((ccx + dx) + ',' + (ccz + dz));
      for (const [key, slot] of this._grassCells) {
        if (!want.has(key)) { this._grassFree.push(slot); this._grassCells.delete(key); }
      }
      this._grassQueue.length = 0;
      for (const key of want) if (!this._grassCells.has(key)) this._grassQueue.push(key);
      // nearest cells fill first (queue pops from the end)
      const d2 = (k) => {
        const cm = k.indexOf(',');
        const gx = +k.slice(0, cm) - ccx, gz = +k.slice(cm + 1) - ccz;
        return gx * gx + gz * gz;
      };
      this._grassQueue.sort((a, b) => d2(b) - d2(a));
    }
    // fill a few cells per frame; far blades are shader-faded so latecomers never pop
    let budget = 24, filled = false;
    while (budget-- > 0 && this._grassQueue.length && this._grassFree.length) {
      const key = this._grassQueue.pop();
      const slot = this._grassFree.pop();
      this._grassCells.set(key, slot);
      const cm = key.indexOf(',');
      this._grassFillCell(slot, +key.slice(0, cm), +key.slice(cm + 1));
      filled = true;
    }
    if (filled) {
      this.grass.instanceMatrix.needsUpdate = true;
      this.grass.instanceColor.needsUpdate = true;
    }
  }

  _buildTrees() {
    const positions = this.sim.world.trees; // shared harvestable tree data
    const m = new THREE.Matrix4(), sv = new THREE.Vector3();
    if (this._has('tree')) {
      const { geometry, material } = this.assets.instanced('tree');
      const trees = new THREE.InstancedMesh(geometry, material, positions.length);
      trees.castShadow = true;
      positions.forEach((p, i) => {
        const s = p.s || 1;
        m.makeRotationY((i * 2.3) % (Math.PI * 2)); m.scale(sv.set(s, s, s)); m.setPosition(p.x, p.y, p.z);
        trees.setMatrixAt(i, m);
      });
      this.scene.add(trees);
      this.treeMesh = trees;
      return;
    }
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.6, 5);
    const leafGeo = new THREE.ConeGeometry(1.4, 3.2, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4b3a26, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2c4a22, roughness: 1 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, positions.length);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, positions.length);
    leaves.castShadow = true;
    positions.forEach((p, i) => {
      const s = (p.s || 1) * 0.9;
      m.makeTranslation(p.x, p.y + 0.8 * s, p.z); m.scale(new THREE.Vector3(s, s, s));
      trunks.setMatrixAt(i, m);
      m.makeTranslation(p.x, p.y + 2.4 * s, p.z); m.scale(new THREE.Vector3(s, s, s));
      leaves.setMatrixAt(i, m);
    });
    this.scene.add(trunks); this.scene.add(leaves);
  }

  _buildBushes() {
    const { world } = this.sim;
    const useGlb = this._has('bush');
    const geo = new THREE.IcosahedronGeometry(0.6, 0);
    this.bushMat = new THREE.MeshStandardMaterial({ color: 0x3a5a2a, roughness: 1 });
    this.berryMat = new THREE.MeshStandardMaterial({ color: 0x8a2240, emissive: 0x3a0814, roughness: 0.7 });
    this.bushMeshes = [];
    for (const bush of world.bushes) {
      const g = new THREE.Group();
      let berryY;
      if (useGlb) {
        const body = this.assets.clone('bush');
        const s = 0.8 + (bush.berries / bush.max) * 0.3;
        body.scale.multiplyScalar(s);
        g.add(body); g.position.set(bush.x, bush.y, bush.z);
        berryY = 1.1 * s + 0.1;
      } else {
        const body = new THREE.Mesh(geo, this.bushMat);
        body.castShadow = true; g.add(body);
        g.position.set(bush.x, bush.y + 0.5, bush.z);
        berryY = 0.4;
      }
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), this.berryMat);
      berry.position.y = berryY; g.add(berry);
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

  // which character model fits this being's race + sex + life stage (falls back to 'being')
  _beingKey(b) {
    let key;
    if (b.stage === 'child') key = 'child';
    else if (b.stage === 'elder') key = 'elder';
    else {
      const raceMesh = (b.tribe && b.tribe.race) ? b.tribe.race.mesh : 'being';
      key = raceMesh !== 'being' ? raceMesh : (b.sex === 'f' ? 'woman' : 'being');
    }
    return this._has(key) ? key : (this._has('being') ? 'being' : null);
  }

  _makeBeingMesh(b) {
    const g = new THREE.Group();
    const key = this._beingKey(b);
    // children/elders also a touch smaller even when a dedicated model exists
    const stageScale = (key === 'being' || key === 'woman')
      ? (b.stage === 'child' ? 0.62 : b.stage === 'elder' ? 0.9 : 1) : 1;
    const scale = stageScale * b.build;
    let body, bodyH, outMixer = null, outWalk = null;
    if (key) {
      // generated GLB character; tint slightly per-lineage so families read apart
      body = this.assets.clone(key);
      body.scale.multiplyScalar(scale);
      body.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.material = o.material.clone();
          if (o.material.color) o.material.color.offsetHSL((b.hue - 0.07), 0.05, 0);
        }
      });
      bodyH = (this.assets.assets[key].height) * scale;
      g.add(body);
      // rigged walk cycle: play the clip, weighted in only while the being moves
      if (this.assets.isAnimated(key)) {
        const clip = this.assets.clips(key)[0];
        outMixer = new THREE.AnimationMixer(body);
        outWalk = outMixer.clipAction(clip);
        outWalk.play(); outWalk.setEffectiveWeight(0);
        outWalk.timeScale = 1.2;
      }
    } else {
      const col = new THREE.Color().setHSL(b.hue, 0.55, 0.55);
      bodyH = (b.stage === 'child' ? 0.7 : 1.2);
      body = new THREE.Mesh(
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
    }
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
    const bodyBaseY = key ? 0 : (bodyH / 2 + 0.3);
    g.userData = { being: b, body, halo, bodyH, bodyBaseY, bubble, bubbleKey: 'wandering', modelKey: key, mixer: outMixer, walk: outWalk };
    this.scene.add(g);
    return g;
  }

  syncBeings() {
    const live = new Set();
    for (const b of this.sim.beings) {
      live.add(b.id);
      let g = this.beingMeshes.get(b.id);
      if (!g) { g = this._makeBeingMesh(b); this.beingMeshes.set(b.id, g); }
      // a being that has aged into a new life stage gets re-bodied (child→adult→elder)
      else if (g.userData.modelKey !== this._beingKey(b)) {
        this.scene.remove(g);
        g = this._makeBeingMesh(b); this.beingMeshes.set(b.id, g);
      }
      // measure actual velocity so the stride matches the ground speed (no foot-sliding)
      const dtf = this._dt || 0.016;
      let vel = 0;
      if (g.userData.lastX !== undefined) {
        vel = Math.hypot(b.x - g.userData.lastX, b.z - g.userData.lastZ) / dtf;
      }
      g.userData.lastX = b.x; g.userData.lastZ = b.z;
      g.position.set(b.x, b.y, b.z);
      // smooth turning instead of snapping
      const targetRot = (-b.heading + Math.PI / 2) || 0;
      let dr = targetRot - g.rotation.y;
      while (dr > Math.PI) dr -= Math.PI * 2;
      while (dr < -Math.PI) dr += Math.PI * 2;
      g.rotation.y += dr * Math.min(1, dtf * 10);
      const dist = this.camera.position.distanceTo(g.position);
      // cull distant beings entirely so wide / continental views stay fast
      const vis = dist < 320;
      if (g.visible !== vis) g.visible = vis;
      if (!vis) { g.userData.bubble.visible = false; continue; }
      g.userData.halo.material.opacity = Math.min(0.85, b.godAwareness);
      // locomotion: real rig walk if animated (LOD: only step the skeleton when near)
      if (g.userData.mixer) {
        if (dist < 200) {
          g.userData.mixer.update(dtf);
          // blend the walk in and out (fast fade to zero so nobody moonwalks in place)
          const targetW = b.moving ? 1 : 0;
          const w = g.userData.walkW || 0;
          const nw = w + (targetW - w) * Math.min(1, dtf * (b.moving ? 8 : 14));
          g.userData.walkW = nw;
          g.userData.walk.setEffectiveWeight(nw);
          // stride speed follows measured ground speed (no foot-sliding)
          if (b.moving) g.userData.walk.timeScale = Math.max(0.6, Math.min(1.6, vel / 3));
        }
        g.userData.body.position.y = g.userData.bodyBaseY;
      } else {
        g.userData.body.position.y = g.userData.bodyBaseY + (b.moving ? Math.abs(Math.sin(performance.now() * 0.011 + b.id)) * 0.08 : 0);
      }
      // work motion: a rhythmic strike/bow while chopping, mining, or building
      const working = !b.moving && (b.action === 'chopping wood' || b.action === 'mining stone' || b.action === 'building' || b.action === 'farming');
      g.userData.body.rotation.x = working && dist < 160
        ? Math.max(0, Math.sin(performance.now() * 0.008 + b.id)) * 0.42
        : 0;
      // a whisper of idle sway so standing beings don't look frozen
      g.userData.body.rotation.z = !b.moving && !working && dist < 160
        ? Math.sin(performance.now() * 0.0013 + b.id * 1.7) * 0.03
        : 0;
      // visible carried goods (log / stone / food) while hauling
      this._syncCarry(g, b);
      // thought bubble (LOD: hide when far to keep the view clean)
      const key = this._bubbleKey(b);
      if (key !== g.userData.bubbleKey) { g.userData.bubble.material = this.bubbleMats[key]; g.userData.bubbleKey = key; }
      g.userData.bubble.visible = dist < 130;
    }
    // remove gone
    for (const [id, g] of this.beingMeshes) {
      if (!live.has(id)) { this.scene.remove(g); this.beingMeshes.delete(id); if (this.selected && this.selected.id === id) this.clearSelection(); }
    }
  }

  // small shared meshes for goods a being visibly carries
  _carryMesh(type) {
    if (!this._carryGeo) {
      this._carryGeo = {
        wood: [new THREE.CylinderGeometry(0.11, 0.11, 1.1, 6), new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 })],
        stone: [new THREE.IcosahedronGeometry(0.26, 0), new THREE.MeshStandardMaterial({ color: 0x8f8b85, roughness: 1 })],
        food: [new THREE.SphereGeometry(0.24, 8, 8), new THREE.MeshStandardMaterial({ color: 0x9a3a30, roughness: 0.8 })],
      };
    }
    const [geo, mat] = this._carryGeo[type] || this._carryGeo.food;
    const m = new THREE.Mesh(geo, mat);
    if (type === 'wood') m.rotation.z = Math.PI / 2;
    m.castShadow = true;
    return m;
  }
  _syncCarry(g, b) {
    const type = b.carrying ? b.carrying.type : null;
    if (g.userData.carryType === type) return;
    if (g.userData.carry) { g.remove(g.userData.carry); g.userData.carry = null; }
    if (type) {
      const m = this._carryMesh(type);
      m.position.set(0.32, (g.userData.bodyH || 1.6) * 0.62, 0.28); // in their arms
      g.add(m);
      g.userData.carry = m;
    }
    g.userData.carryType = type;
  }

  setSelected(b) { this.selected = b; }
  clearSelection() { this.selected = null; this.selRing.visible = false; }

  focusOn(b, close = false) {
    if (!b) return;
    this.controls.target.set(b.x, b.y + 1, b.z);
    const dist = close ? 7 : 14;
    this.camera.position.set(b.x + dist, b.y + dist * (close ? 0.5 : 0.7), b.z + dist);
  }

  // fly the camera to a world location (used by the minimap / tribes panel)
  flyTo(x, z, dist = 46) {
    const y = this.sim.world.heightAt(x, z);
    this.controls.target.set(x, y + 2, z);
    this.camera.position.set(x + dist, y + dist * 0.7, z + dist);
  }
  get camTarget() { return this.controls ? this.controls.target : { x: 0, z: 0 }; }

  raycastBeing(ndc) {
    this.raycaster.setFromCamera(ndc, this.camera);
    const groups = [...this.beingMeshes.values()];
    const hits = this.raycaster.intersectObjects(groups, true); // recurse into GLB meshes
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
    const raining = this.sim.weather && this.sim.weather.state === 'rain';
    // sun direction along its arc (held just above the horizon so shadows stay sane)
    const dir = this._sunDir.set(Math.cos(ang), Math.max(0.12, elev), Math.sin(ang * 0.6) * 0.35 + 0.18).normalize();
    // the tight shadow frustum follows the camera target; snapping the follow point to
    // whole shadow texels stops the shadow edges shimmering as the camera pans
    const t = this.controls.target;
    const sc = this.sun.shadow.camera;
    const texel = (sc.right - sc.left) / this.sun.shadow.mapSize.x;
    const fx = Math.round(t.x / texel) * texel;
    const fz = Math.round(t.z / texel) * texel;
    this.sun.position.set(fx + dir.x * 400, dir.y * 400, fz + dir.z * 400);
    this.sun.target.position.set(fx, 0, fz);
    this.sun.intensity = 0.3 + elev * 1.6;
    const warm = this._c1.setHex(0xffd9a0), cool = this._c2.setHex(0x6a86c0);
    this.sun.color.copy(cool).lerp(warm, Math.min(1, elev + 0.2));
    // dawn/dusk pulls the low sun toward ember orange
    const duskAmt = Math.max(0, 1 - Math.abs(elev - 0.16) / 0.3);
    this.sun.color.lerp(this._c1.setHex(0xff7a38), duskAmt * 0.55);
    this.hemi.intensity = 0.25 + elev * 0.7;
    this._elev = elev;
    // zenith + horizon palette — the dome blends between them, fog matches the horizon
    const zen = this._c1, hor = this._c3, tmp = this._c2;
    if (elev < 0.25) zen.setHex(0x05070d).lerp(tmp.setHex(0x1b2540), elev / 0.25);
    else zen.setHex(0x1b2540).lerp(tmp.setHex(0x3f74c9), (elev - 0.25) / 0.75);
    if (elev < 0.25) hor.setHex(0x0d1019).lerp(tmp.setHex(0x4a4358), elev / 0.25);
    else hor.setHex(0x4a4358).lerp(tmp.setHex(0xbcd6e8), (elev - 0.25) / 0.75);
    hor.lerp(tmp.setHex(0xff9558), duskAmt * 0.4);   // warm band at dawn/dusk
    let warmAmt = duskAmt * 0.9;
    // rain fronts grey the sky and mute the light
    if (raining) {
      zen.lerp(tmp.setHex(0x4a525c), 0.55);
      hor.lerp(tmp.setHex(0x5a6470), 0.55);
      this.sun.intensity *= 0.45;
      this.hemi.intensity *= 0.75;
      warmAmt *= 0.15;
    }
    if (this.skyDome) {
      this.skyU.uTop.value.copy(zen);
      this.skyU.uHorizon.value.copy(hor);
      this.skyU.uSunDir.value.copy(dir);
      this.skyU.uWarmAmt.value = warmAmt;
      this.skyDome.position.copy(this.camera.position);  // horizon can never be outrun
    }
    this.scene.background.copy(hor).lerp(zen, 0.45);     // seen where the dome isn't (lowfx)
    this.scene.fog.color.copy(hor);
  }

  update(dt) {
    this._dt = dt;
    this.syncBeings();
    this.syncFauna();
    this.updateStructures();
    // bush berry visibility
    for (const g of this.bushMeshes) g.userData.berry.visible = g.userData.bush.berries > 0;

    // campfire flicker, brighter at night (one per tribe)
    if (this.campfires) {
      const night = 1 - this._elev;
      const f = 0.7 + 0.3 * Math.sin(performance.now() * 0.02) + 0.15 * Math.sin(performance.now() * 0.057);
      for (const c of this.campfires) {
        c.light.intensity = (1.2 + night * 2.6) * f;
        if (c.flame) {
          c.flame.scale.y = 0.85 + 0.3 * f;
          c.flame.material.opacity = 0.8 + 0.2 * Math.sin(performance.now() * 0.03);
        }
      }
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
    this._updateSpeech(dt);
    this._updateEffects(dt);
    this._updateRain(dt);
    this._updateGrass(dt);
    if (this._waterU) this._waterU.uTime.value += dt;
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
