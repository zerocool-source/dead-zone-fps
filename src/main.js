// AEON — God of Pangaea. Phase 0 vertical slice entry point.
// Wires the simulation, the god layer, the renderer, and the HUD; owns input + the loop.
import { Sim } from './sim.js';
import { God } from './god.js';
import { Renderer } from './render.js';
import { HUD } from './hud.js';
import { AssetStore } from './assets.js';
import { Music } from './music.js';
import { RACES } from './config.js';
import { connectClaude, savedKey, saveKey, testKey } from './llm.js';

const seed = new URLSearchParams(location.search).get('seed') || 'pangaea-' + Math.floor(Math.random() * 1e6);

const sim = new Sim(seed);
const god = new God(sim);
let renderer;            // created after assets load
const hud = new HUD(sim, god);

let tool = 'inspect';
let inspireSource = null;     // first-click being for the Inspire two-step
let possessed = null;
let buildType = null;         // active city-builder placement
let focusTribe = null;        // which tribe you're building for
let inMenu = true;            // title screen showing
let paused = false;           // pause menu showing
let prevSpeed = 1;
const music = new Music();
const keys = new Set();
const ndcOf = (e) => ({ x: (e.clientX / window.innerWidth) * 2 - 1, y: -(e.clientY / window.innerHeight) * 2 + 1 });

// expose for debugging / console tinkering
window.AEON = { sim, god, renderer, hud, music };
// Plug in real Claude dialogue: window.AEON.setLLM(async ({being, context, prompt}) => "<line>")
// Promoted beings (leaders, the possessed one) will then speak LLM-generated lines.
window.AEON.setLLM = (fn) => sim.voices.setLLM(fn);

// ---------- boot ----------
async function boot() {
  const status = document.getElementById('veil-status');
  status.textContent = 'CARVING THE MESHES…';
  const assets = await new AssetStore().load((done, total) => {
    status.textContent = `CARVING THE MESHES… ${done}/${total}`;
  }); // GLBs (or graceful fallback — a stalled download can't wedge the load)

  renderer = new Renderer(sim, assets);
  window.AEON.renderer = renderer;
  hud.renderer = renderer;   // minimap + tribe-fly need the camera
  renderer.mount(document.body);
  // a couple of frames so terrain/beings exist before reveal
  renderer.syncBeings();
  renderer.update(0.016);

  // ---- title menu ----
  const veil = document.getElementById('veil');
  status.textContent = `${sim.tribes.length} peoples · seed “${seed}”`;
  status.classList.remove('loading');
  document.getElementById('menu-btns').classList.add('ready');
  music.setState('title');

  const RACE_DESC = {
    dawnfolk: 'Kind grassland folk. Balanced, welcoming, steady.',
    emberfolk: 'Fierce desert hunters. Brave, warlike, hard to cow.',
    frostborn: 'Stoic giants of the cold north. Strong and unyielding.',
    thornkin: 'Curious jungle people. Fast learners, first to invent.',
    ashkin: 'Mountain mystics of ash and ember. Devout and dangerous.',
    sunkin: 'Golden savanna runners. Social, clever, everywhere at once.',
    tidefolk: 'Coast dwellers who read the sea. Kind and curious.',
    mirekin: 'Cold-marsh believers. Insular, devout, patient.',
    duskborn: 'Twilight forest wanderers. Quiet, clever, star-guided.',
    stormkin: 'Cliff dwellers of the thunder coast. Utterly fearless.',
    oreborn: 'Deep-mountain smiths. Stone-patient, forge-proud.',
    giltfolk: 'A gilded elder civilization — already ages ahead.',
  };
  const grid = document.getElementById('race-grid');
  // every race tries its portrait; a missing jpg silently degrades to the letter tile
  grid.innerHTML = Object.entries(RACES).map(([key, r]) => `
    <div class="race-card" data-race="${key}">
      <img src="/races/${key}.jpg" alt="${r.name}" loading="lazy"
        onerror="this.style.display='none';this.nextElementSibling.style.display='grid'" />
      <div class="ph" style="display:none">${r.name[0]}</div>
      <div class="rc-name">${r.name}</div>
      <div class="rc-desc">${RACE_DESC[key] || ''}</div>
    </div>`).join('');

  const menuMain = document.getElementById('menu-main');
  const raceSelect = document.getElementById('race-select');
  function enterWorld(raceKey) {
    music.unlock();
    inMenu = false;
    if (raceKey) {
      const mine = sim.tribes.find((t) => t.raceKey === raceKey) || sim.tribes[0];
      focusTribe = mine;
      hud.playerTribe = mine;
      renderer.flyTo(mine.home.x, mine.home.z);
      sim.chronicle.add(sim.day, sim.year, '⭐', `You bind your fate to the ${mine.name}. Lead them well.`, 'god');
    }
    veil.classList.add('hidden');
    setTimeout(() => (veil.style.display = 'none'), 900);
  }
  document.getElementById('btn-watch').addEventListener('click', () => enterWorld(null));
  document.getElementById('btn-lead').addEventListener('click', () => {
    menuMain.style.display = 'none';
    raceSelect.style.display = 'flex';
  });
  document.getElementById('race-back').addEventListener('click', () => {
    raceSelect.style.display = 'none';
    menuMain.style.display = 'flex';
  });
  grid.querySelectorAll('.race-card').forEach((c) =>
    c.addEventListener('click', () => enterWorld(c.dataset.race)));

  // ---- pause menu ----
  const pauseEl = document.getElementById('pause');
  const volSlider = document.getElementById('pause-music');
  volSlider.value = String(Math.round(music.volume * 100));
  volSlider.addEventListener('input', () => music.setVolume(+volSlider.value / 100));
  document.getElementById('pause-resume').addEventListener('click', () => togglePause(false));
  window.togglePause = togglePause;
  function togglePause(on) {
    paused = on ?? !paused;
    pauseEl.style.display = paused ? 'flex' : 'none';
    if (paused) { prevSpeed = sim.speedIndex || 1; sim.setSpeed(0); }
    else sim.setSpeed(prevSpeed);
  }

  wireInput();
  focusTribe = sim.tribes[0];
  hud.onTool = (t) => { tool = t; inspireSource = null; if (t !== 'build') cancelBuild(); };
  hud.onSpeed = (i) => sim.setSpeed(i);
  hud.onUnpossess = () => unpossess();
  hud.onSelectLink = (b) => { renderer.setSelected(b); renderer.focusOn(b); if (b.tribe) focusTribe = b.tribe; };
  hud.onBuild = (t) => { buildType = t; if (!t) renderer.hideGhost(); };
  hud.onFocusTribe = (t) => { focusTribe = t; };

  // LLM souls: connect/disconnect Claude for promoted beings
  hud.onConnectLLM = async (key) => {
    try {
      const ok = await testKey(key);
      if (!ok) return false;
      saveKey(key);
      sim.voices.setLLM(connectClaude(key));
      return true;
    } catch { return false; }
  };
  hud.onDisconnectLLM = () => { saveKey(''); sim.voices.setLLM(null); };
  const existing = savedKey();
  if (existing) { sim.voices.setLLM(connectClaude(existing)); hud.setLLMStatus('claude ✦'); }

  requestAnimationFrame(loop);
}

// ---------- input ----------
function wireInput() {
  const canvas = renderer.canvas;
  let downX = 0, downY = 0, moved = false;

  canvas.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; moved = false; });
  canvas.addEventListener('pointermove', (e) => {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) moved = true;
    // live placement ghost
    if (buildType) {
      const g = renderer.raycastGround(ndcOf(e));
      if (g) renderer.showGhost(buildType, g.x, g.z, !sim.siteProblem(focusTribe, buildType, g.x, g.z));
      else renderer.hideGhost();
    }
  });
  canvas.addEventListener('contextmenu', (e) => { if (buildType) { e.preventDefault(); cancelBuild(); } });
  canvas.addEventListener('pointerup', (e) => {
    if (moved) return; // was an orbit drag
    const ndc = ndcOf(e);
    if (buildType) { placeBuild(ndc); return; }
    handleClick(ndc);
  });

  // number keys for speed, space pause
  window.addEventListener('keydown', (e) => {
    keys.add(e.key.toLowerCase());
    if (e.code === 'Space') { e.preventDefault(); sim.setSpeed(sim.speedIndex === 0 ? 1 : 0); }
    if (e.key >= '1' && e.key <= '5') sim.setSpeed(+e.key - 1);
    if (e.key === 'Escape') {
      if (buildType) cancelBuild();
      else if (possessed) unpossess();
      else if (!inMenu) window.togglePause();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
}

function placeBuild(ndc) {
  const g = renderer.raycastGround(ndc);
  if (!g) return;
  const problem = sim.siteProblem(focusTribe, buildType, g.x, g.z);
  if (problem) { hud.message(problem); return; }
  if (sim.placeBuilding(focusTribe, buildType, g.x, g.z)) {
    renderer.spawnEffect(g.x, g.z, 0xe8c87a, 4);
  }
}
function cancelBuild() {
  if (!buildType) return;
  buildType = null;
  renderer.hideGhost();
  hud.setBuild(null);
}

function handleClick(ndc) {
  if (tool === 'inspect') {
    const b = renderer.raycastBeing(ndc);
    if (b) { renderer.setSelected(b); hud.selectBeing(b); if (b.tribe) focusTribe = b.tribe; }
    else { renderer.clearSelection(); hud.selectBeing(null); }
    return;
  }
  if (tool === 'possess') {
    const b = renderer.raycastBeing(ndc);
    if (b) possess(b);
    return;
  }
  if (tool === 'inspire') {
    if (!inspireSource) {
      const b = renderer.raycastBeing(ndc);
      if (b) { inspireSource = b; renderer.setSelected(b); hud.selectBeing(b); hud.message(`Inspire ${b.name} — now click where to draw them.`); }
      else hud.message('Inspire: first click a being.');
    } else {
      const g = renderer.raycastGround(ndc);
      if (g) {
        if (god.inspire(inspireSource, g.x, g.z)) renderer.spawnEffect(g.x, g.z, 0xe8c87a, 6);
        else hud.message('Not enough faith.');
      }
      inspireSource = null;
    }
    return;
  }
  if (tool === 'bless' || tool === 'smite') {
    const g = renderer.raycastGround(ndc);
    if (!g) return;
    const ok = tool === 'bless' ? god.bless(g.x, g.z) : god.smite(g.x, g.z);
    if (ok) renderer.spawnEffect(g.x, g.z, tool === 'bless' ? 0x9fe0a0 : 0xff6a2a, tool === 'bless' ? 26 : 16);
    else hud.message('Not enough faith.');
    if (tool === 'smite') renderer.flash(0.5);
    return;
  }
  if (tool === 'shape') {
    const g = renderer.raycastGround(ndc);
    if (!g) return;
    const lower = keys.has('shift');
    if (god.shape(g.x, g.z, lower)) { renderer.refreshTerrain(); renderer.spawnEffect(g.x, g.z, 0xc9b97a, 14); }
    else hud.message('Not enough faith.');
  }
}

function possess(b) {
  possessed = b; b.promoted = true;
  renderer.possessed = b;
  renderer.setSelected(b); hud.selectBeing(b); hud.setPossessed(b);
  renderer.focusOn(b, true);
  sim.chronicle.add(sim.day, sim.year, '👁', `You descend into the life of ${b.name}.`, 'god');
}
function unpossess() {
  if (possessed) sim.chronicle.add(sim.day, sim.year, '🕊️', `You release ${possessed.name}. They live on.`, 'god');
  possessed = null; renderer.possessed = null; hud.setPossessed(null);
}

// possession: WASD = suggest a direction (influence, not control — trust decides compliance)
function applyPossessionInput() {
  if (!possessed || !possessed.alive) { if (possessed) unpossess(); return; }
  let dx = 0, dz = 0;
  if (keys.has('w')) dz -= 1; if (keys.has('s')) dz += 1;
  if (keys.has('a')) dx -= 1; if (keys.has('d')) dx += 1;
  if (dx || dz) {
    const len = Math.hypot(dx, dz);
    const tx = possessed.x + (dx / len) * 12, tz = possessed.z + (dz / len) * 12;
    // plant a short-lived urge; the being heeds it in proportion to trust
    possessed.inspiration = { kind: 'seek', x: tx, z: tz, ttl: 0.4 };
  }
}

// WASD pans the god camera (relative to view direction) when nobody is possessed.
function applyCameraPan(dt) {
  if (possessed || inMenu || paused) return;
  let px = 0, pz = 0;
  if (keys.has('w')) pz -= 1; if (keys.has('s')) pz += 1;
  if (keys.has('a')) px -= 1; if (keys.has('d')) px += 1;
  if (!px && !pz) return;
  const cam = renderer.camera, tgt = renderer.controls.target;
  // ground-plane forward/right from the camera's yaw
  const fx = tgt.x - cam.position.x, fz = tgt.z - cam.position.z;
  const fl = Math.hypot(fx, fz) || 1;
  const fwdX = fx / fl, fwdZ = fz / fl;
  const rightX = -fwdZ, rightZ = fwdX;
  const dist = cam.position.distanceTo(tgt);
  const speed = Math.max(14, dist * 0.9) * dt;
  const dxm = (fwdX * -pz + rightX * px) * speed;
  const dzm = (fwdZ * -pz + rightZ * px) * speed;
  tgt.x += dxm; tgt.z += dzm;
  cam.position.x += dxm; cam.position.z += dzm;
}

// ---------- loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  applyPossessionInput();
  applyCameraPan(dt);
  if (!paused) sim.update(dt);
  god.tick((dt * sim.speed) / 12);   // faith accrues with time
  music.update(sim, inMenu);
  renderer.update(dt);
  hud.update();

  requestAnimationFrame(loop);
}

boot();
