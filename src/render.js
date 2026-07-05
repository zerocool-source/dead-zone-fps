// Renderer — a stylized "God's Table" view of the sim. Heightmap terrain with biome
// vertex colors, water, trees, food, and a legible token per being. Orbital camera that
// can swoop to street level. No game logic here; it only reads sim state.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { WORLD } from './config.js';
import { BIOME } from './world.js';

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

export class Renderer {
  constructor(sim, assets = null) {
    this.sim = sim;
    this.assets = assets;        // AssetStore (may be null → primitive fallback)
    this.beingMeshes = new Map(); // id -> THREE.Group
    this.selected = null;
    this.possessed = null;
    this.tmp = new THREE.Vector3();
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
    if (type === 'hut' && this._has('hut')) { g.add(this.assets.clone('hut')); return g; }
    if (type === 'totem' && this._has('totem')) { g.add(this.assets.clone('totem')); return g; }
    if (type === 'granary' && this._has('granary')) { g.add(this.assets.clone('granary')); return g; }
    if (type === 'watchtower' && this._has('watchtower')) { g.add(this.assets.clone('watchtower')); return g; }
    if (type === 'well' && this._has('well')) { g.add(this.assets.clone('well')); return g; }
    if (type === 'ship' && this._has('ship')) { g.add(this.assets.clone('ship')); return g; }
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

  // ---- fauna (deer / boar / wolf) ----
  _makeBeast(type) {
    // generated low-poly GLB if available (already normalized: base at y=0, scaled)
    if (this._has(type)) {
      const g = new THREE.Group();
      const m = this.assets.clone(type);
      m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.add(m);
      this.scene.add(g);
      return g;
    }
    const SPEC = {
      deer: { c: 0x9a7048, s: 1.0, len: 0.7, r: 0.30, legH: 1.0, antler: true },
      boar: { c: 0x4a3a2e, s: 1.05, len: 0.8, r: 0.44, legH: 0.6, antler: false },
      wolf: { c: 0x74777f, s: 0.92, len: 0.85, r: 0.24, legH: 0.62, antler: false },
    }[type] || { c: 0x8a6a44, s: 1, len: 0.7, r: 0.3, legH: 1.0 };
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: SPEC.c, roughness: 0.95 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(SPEC.r, SPEC.len, 4, 8), mat);
    body.rotation.z = Math.PI / 2; body.position.y = SPEC.legH + SPEC.r; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(SPEC.r * 0.62, 8, 8), mat);
    head.position.set(SPEC.len * 0.7 + SPEC.r, SPEC.legH + SPEC.r + (type === 'deer' ? 0.45 : 0.05), 0); g.add(head);
    if (SPEC.antler) {
      const am = new THREE.MeshStandardMaterial({ color: 0xb8a070, roughness: 1 });
      for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.4, 4), am); a.position.set(SPEC.len * 0.7 + SPEC.r, SPEC.legH + SPEC.r + 0.8, s * 0.1); g.add(a); }
    }
    for (const dx of [-0.28, 0.28]) for (const dz of [-0.16, 0.16]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, SPEC.legH, 4), mat);
      leg.position.set(dx, SPEC.legH / 2, dz); g.add(leg);
    }
    g.scale.setScalar(SPEC.s);
    this.scene.add(g);
    return g;
  }
  syncFauna() {
    if (!this.beastMeshes) this.beastMeshes = [];
    const fauna = this.sim.fauna;
    for (let i = 0; i < fauna.length; i++) {
      const d = fauna[i];
      let g = this.beastMeshes[i];
      if (!g) { g = this._makeBeast(d.type); this.beastMeshes[i] = g; }
      if (d.alive) { g.position.set(d.x, d.y, d.z); g.rotation.y = -Math.atan2(d.tz - d.z, d.tx - d.x); }
      g.visible = d.alive && this.camera.position.distanceTo(g.position) < 320;
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
          g.userData.mixer.update(this._dt || 0.016);
          // stride speed follows measured ground speed; faint sway at rest
          g.userData.walk.setEffectiveWeight(b.moving ? 1 : 0.12);
          g.userData.walk.timeScale = b.moving ? Math.max(0.7, Math.min(2.3, vel / 2.4)) : 0.35;
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
