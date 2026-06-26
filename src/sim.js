// The Simulation — the real product. Owns the world, the population, time, knowledge,
// reproduction, death, and the Chronicle. Engine-agnostic: no rendering here.
import { RNG, hashStringToSeed } from './rng.js';
import { World } from './world.js';
import { Being } from './being.js';
import { Chronicle } from './chronicle.js';
import { makeTribeName, makeName } from './names.js';
import {
  DAY_SECONDS, YEAR_DAYS, TIME_SCALES, POP, FOOD, TECH, LIFE, RES, FAUNA, JOBS,
} from './config.js';

export class Sim {
  constructor(seedStr = 'pangaea') {
    this.seedStr = seedStr;
    this.rng = new RNG(hashStringToSeed(seedStr));
    this.world = new World(this.rng);
    this.chronicle = new Chronicle();
    this.yearDays = YEAR_DAYS;

    this.day = 0;          // total in-game days elapsed
    this.year = 0;
    this.speedIndex = 1;   // index into TIME_SCALES
    this.beings = [];
    this.dead = [];        // tombstones {name, year, cause}
    this.births = 0; this.deaths = 0;

    this.insight = 0;      // culture-wide knowledge pool
    this.tech = [];        // discovered tech ids
    this.tribeName = makeTribeName(this.rng);

    this.home = this.world.spawnPoint(this.rng);
    this.home.y = this.world.heightAt(this.home.x, this.home.z);

    // economy + civilization state
    this.res = { ...RES.START };        // tribe stockpile
    this.huts = [];                     // {x,z,y} homes built by builders
    this.farms = [];                    // {x,z,y,yield,max,regrow} farm plots
    this.fauna = [];                    // deer for hunting
    this.leaderId = null;               // emergent leader
    this.DEER_FOOD = FAUNA.DEER_FOOD;
    this.FAUNA_RESPAWN = FAUNA.RESPAWN_DAYS;
    this._jobTimer = 0;
    this._convoTimer = 0;

    this._seedTribe();
    this._seedFauna();
    this.assignJobs();
    this.chronicle.add(0, 0, '🌅', `The ${this.tribeName} awaken on the shore of a new world.`, 'epoch');
  }

  _seedFauna() {
    for (let i = 0; i < FAUNA.DEER_COUNT; i++) {
      const p = this.world.spawnPoint(this.rng);
      this.fauna.push({ x: p.x, z: p.z, y: this.world.heightAt(p.x, p.z),
        tx: p.x, tz: p.z, alive: true, respawn: 0 });
    }
  }

  _seedTribe() {
    const hue = this.rng.range(0.03, 0.12); // warm lineage hue
    for (let i = 0; i < POP.START; i++) {
      const a = this.rng.range(0, Math.PI * 2), r = this.rng.range(2, 12);
      let x = this.home.x + Math.cos(a) * r, z = this.home.z + Math.sin(a) * r;
      if (!this.world.isLand(x, z)) { x = this.home.x; z = this.home.z; }
      const b = new Being(this.rng, x, z, { hue: hue + this.rng.gauss(0, 0.015) });
      this.beings.push(b);
    }
  }

  get speed() { return TIME_SCALES[this.speedIndex]; }
  setSpeed(i) { this.speedIndex = Math.max(0, Math.min(TIME_SCALES.length - 1, i)); }
  cycleSpeed(dir) { this.setSpeed(this.speedIndex + dir); }

  get population() { return this.beings.length; }
  believers() { return this.beings.filter(b => b.godAwareness > 0.25).length; }

  // ---- main tick ----
  update(dtReal) {
    const dt = Math.min(dtReal, 0.05);   // clamp for stability
    const speed = this.speed;
    if (speed === 0) return 0;
    const total = (dt * speed) / DAY_SECONDS;

    // sub-step so need/movement dynamics stay stable at any time scale (cognitive-LOD lite)
    const STEP = 0.12;
    let remaining = total, guard = 0;
    while (remaining > 1e-5 && guard < 16) {
      const dDays = Math.min(STEP, remaining);
      remaining -= dDays; guard++;
      this.day += dDays;
      const newYear = Math.floor(this.day / this.yearDays);
      if (newYear !== this.year) { this.year = newYear; this._onYear(); }

      for (const b of this.beings) b.update(dDays, this);
      if (this.beings.some(b => !b.alive)) this.beings = this.beings.filter(b => b.alive);

      this._food(dDays);
      this._resources(dDays);
      this._fauna(dDays);
      this._gestation();
    }
    this._discoveries();

    // reassign jobs + homes a few times a day; spawn farms when farming is known
    this._jobTimer -= total;
    if (this._jobTimer <= 0) { this._jobTimer = 0.34; this.assignJobs(); this.assignHomes(); this._maybeFarms(); }
    return total;
  }

  _onYear() {
    // periodic flavor + slow ecology
    if (this.year > 0 && this.year % 25 === 0) {
      this.chronicle.add(this.day, this.year, '📜',
        `${this.year} years pass. The ${this.tribeName} number ${this.population}.`, 'epoch');
    }
  }

  // ---- queries used by beings ----
  neighbors(b, radius, livingOnly = false) {
    const out = [];
    const r2 = radius * radius;
    for (const o of this.beings) {
      if (o === b || (livingOnly && !o.alive)) continue;
      const dx = o.x - b.x, dz = o.z - b.z;
      if (dx * dx + dz * dz <= r2) out.push(o);
    }
    return out;
  }
  nearestNeighbor(b, radius, livingOnly = false) {
    let best = null, bd = radius * radius;
    for (const o of this.beings) {
      if (o === b || (livingOnly && !o.alive)) continue;
      const dx = o.x - b.x, dz = o.z - b.z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  nearestBush(x, z) {
    let best = null, bd = Infinity;
    for (const bush of this.world.bushes) {
      if (bush.berries <= 0) continue;
      const dx = bush.x - x, dz = bush.z - z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = bush; }
    }
    return best;
  }
  findMate(b) {
    let best = null, bd = Infinity;
    for (const o of this.beings) {
      if (o === b || !o.alive || !o.fertile || o.sex === b.sex || o.gestating) continue;
      if (this.day - o.lastMateDay < LIFE.MATE_COOLDOWN_DAYS) continue;
      const dx = o.x - b.x, dz = o.z - b.z, d = dx * dx + dz * dz;
      const bias = 1 - b.bondTo(o.id) / 200; // prefer beings they like
      if (d * bias < bd) { bd = d * bias; best = o; }
    }
    return best;
  }

  addInsight(g) { this.insight += g; }

  tryConceive(a, b) {
    const female = a.sex === 'f' ? a : b;
    const male = a.sex === 'f' ? b : a;
    if (female.gestating) return;
    a.lastMateDay = b.lastMateDay = this.day;
    a.mateId = b.id; b.mateId = a.id;
    a.bondWith(b.id, 8); b.bondWith(a.id, 8);
    if (this.population >= POP.SOFT_CAP) return; // space/food pressure suppresses births
    if (this.rng.chance(0.7)) {
      female.gestating = { fatherId: male.id, dueDay: this.day + LIFE.GESTATION_DAYS };
    }
  }

  _gestation() {
    for (const b of this.beings) {
      if (b.gestating && this.day >= b.gestating.dueDay) {
        const father = this.beings.find(x => x.id === b.gestating.fatherId);
        const hue = (b.hue + (father ? father.hue : b.hue)) / 2 + this.rng.gauss(0, 0.022);
        const traits = {};
        for (const k of ['brave', 'curious', 'kind', 'devout', 'social']) {
          const fa = b.traits[k], fb = father ? father.traits[k] : 0;
          traits[k] = Math.max(-1, Math.min(1, (fa + fb) / 2 + this.rng.gauss(0, 0.22)));
        }
        const fb = father ? father.build : b.build;
        const childBuild = (b.build + fb) / 2 + this.rng.gauss(0, 0.04); // heritable size, mutates
        const child = new Being(this.rng, b.x + this.rng.range(-1, 1), b.z + this.rng.range(-1, 1), {
          age: 0, bornDay: this.day, traits, hue, build: childBuild,
          parents: father ? [b.id, father.id] : [b.id],
          name: makeName(this.rng),
        });
        child.hunger = 30; child.energy = 90;
        b.children.push(child.id); if (father) father.children.push(child.id);
        b.bondWith(child.id, 40); child.bondWith(b.id, 40);
        b.gestating = null;
        this.beings.push(child);
        this.births++;
        if (this.population <= 40 || this.rng.chance(0.25)) {
          this.chronicle.add(this.day, this.year, '👶',
            `${child.name} is born to ${b.name}${father ? ' and ' + father.name : ''}.`, 'birth');
        }
      }
    }
  }

  onDeath(b, cause) {
    this.deaths++;
    this.dead.push({ name: b.name, year: this.year, cause, age: Math.floor(b.age) });
    // grief: bonded survivors remember
    for (const o of this.beings) {
      if (o === b) continue;
      const bond = o.bondTo(b.id);
      if (bond > 20) { o.remember('loss', `mourned ${b.name}`, 3); o.social = Math.max(0, o.social - 20); }
    }
    if (this.population <= 40 || b.godAwareness > 0.4 || this.rng.chance(0.2)) {
      this.chronicle.add(this.day, this.year, '⚰️',
        `${b.name} dies of ${cause} at ${Math.floor(b.age)}.`, 'death');
    }
    // extinction guard / story beat
    if (this.population <= 1) {
      this.chronicle.add(this.day, this.year, '🕯️',
        `The ${this.tribeName} are no more. The world falls silent.`, 'epoch');
    }
  }

  _food(dDays) {
    const rate = dDays / FOOD.REGROW_DAYS;
    for (const bush of this.world.bushes) {
      if (bush.berries < bush.max) {
        bush.regrow += rate;
        if (bush.regrow >= 1) { bush.berries += 1; bush.regrow = 0; }
      }
    }
  }

  _discoveries() {
    for (const tech of TECH) {
      if (this.tech.includes(tech.id)) continue;
      if (this.insight >= tech.needInsight && this.population >= tech.needPop) {
        this.tech.push(tech.id);
        // a being becomes the "inventor" (promote candidate)
        const adults = this.beings.filter(x => x.stage === 'adult');
        const inv = adults.length
          ? adults.reduce((a, c) => (c.traits.curious + c.insight / 50 > a.traits.curious + a.insight / 50 ? c : a))
          : null;
        if (inv) inv.remember('discovery', `helped the ${this.tribeName} discover ${tech.name}`, 4);
        if (tech.id === 'ritual') {
          for (const x of this.beings) x.godAwareness = Math.min(1, x.godAwareness + 0.3);
        }
        this.chronicle.add(this.day, this.year, '💡',
          `${inv ? inv.name + ' leads the ' : 'The '}${this.tribeName}${inv ? '' : ' '} to discover ${tech.name}. — ${tech.desc}`,
          'tech');
      }
    }
  }

  // ---- resource nodes & storehouse ----
  nearestTree(x, z) { return this._nearestNode(this.world.trees, x, z, n => n.wood > 0); }
  nearestRock(x, z) { return this._nearestNode(this.world.rocks, x, z, n => n.stone > 0); }
  nearestFarm(x, z) { return this._nearestNode(this.farms, x, z, n => n.yield > 0); }
  _nearestNode(arr, x, z, ok) {
    let best = null, bd = Infinity;
    for (const n of arr) {
      if (!ok(n)) continue;
      const dx = n.x - x, dz = n.z - z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
  nearestDeer(x, z) {
    let best = null, bd = Infinity;
    for (const d of this.fauna) {
      if (!d.alive) continue;
      const dx = d.x - x, dz = d.z - z, dd = dx * dx + dz * dz;
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  }
  storePos() { return this.home; }
  deposit(type, amount) { this.res[type] = (this.res[type] || 0) + amount; }

  // ---- building ----
  buildSite() {
    // want one hut per ~3 souls; build storehouse first conceptually (home acts as store)
    const wantHuts = Math.min(20, Math.ceil(this.population / 3));
    if (this.huts.length < wantHuts && this.res.wood >= RES.HUT_COST.wood && this.res.stone >= RES.HUT_COST.stone) {
      const i = this.huts.length;
      const ang = (i / 6) * Math.PI * 2 + 0.7, r = 7 + Math.floor(i / 6) * 4.5;
      let x = this.home.x + Math.cos(ang) * r, z = this.home.z + Math.sin(ang) * r;
      if (!this.world.isLand(x, z)) { x = this.home.x; z = this.home.z; }
      return { kind: 'hut', x, z, y: this.world.heightAt(x, z) };
    }
    return null;
  }
  tryBuild(site, builder) {
    if (site.kind === 'hut') {
      if (this.res.wood < RES.HUT_COST.wood || this.res.stone < RES.HUT_COST.stone) return;
      // avoid double-building the same spot
      if (this.huts.some(h => Math.hypot(h.x - site.x, h.z - site.z) < 3)) return;
      this.res.wood -= RES.HUT_COST.wood; this.res.stone -= RES.HUT_COST.stone;
      this.huts.push({ x: site.x, z: site.z, y: site.y, occupants: [] });
      builder.skills.build = Math.min(1, builder.skills.build + 0.03);
      if (builder.rng.chance(0.5)) builder.remember('build', `raised a new home for the ${this.tribeName}`, 2);
    }
  }

  // ---- jobs: allocate roles by tribe need + personality ----
  assignJobs() {
    const adults = this.beings.filter(b => b.stage === 'adult');
    if (!adults.length) return;
    // pick / keep a leader (most social+devout, long-lived)
    if (!this.leaderId || !adults.some(a => a.id === this.leaderId)) {
      const cand = adults.reduce((a, c) =>
        (c.traits.social + c.traits.devout + c.age / 60) > (a.traits.social + a.traits.devout + a.age / 60) ? c : a);
      this.leaderId = cand.id;
      if (this.tech.includes('language')) {
        this.chronicle.add(this.day, this.year, '👑', `${cand.name} rises as leader of the ${this.tribeName}.`, 'gov');
      }
    }
    // desired distribution of the workforce
    const n = adults.length;
    const need = {
      forager: Math.max(1, Math.round(n * (this.tech.includes('farming') ? 0.18 : 0.34))),
      hunter: Math.round(n * 0.18),
      woodcutter: Math.round(n * 0.16),
      miner: Math.round(n * 0.12),
      builder: Math.max(1, Math.round(n * 0.12)),
      farmer: this.tech.includes('farming') ? Math.round(n * 0.2) : 0,
    };
    // sort by aptitude so the right people get the right jobs
    const pool = adults.filter(a => a.id !== this.leaderId);
    const counts = {};
    for (const job of JOBS) counts[job] = 0;
    // leader
    const leader = adults.find(a => a.id === this.leaderId);
    if (leader) leader.job = 'leader';
    // greedy assignment biased by traits
    const score = (a, job) => {
      if (job === 'hunter') return a.traits.brave + a.skills.forage;
      if (job === 'woodcutter' || job === 'miner') return (a.build - 1) + a.skills.craft + a.traits.brave * 0.3;
      if (job === 'builder') return a.skills.build + a.skills.craft;
      if (job === 'forager' || job === 'farmer') return a.skills.forage + a.traits.kind * 0.2;
      return 0;
    };
    const order = ['builder', 'hunter', 'woodcutter', 'miner', 'farmer', 'forager'];
    const taken = new Set();
    for (const job of order) {
      const want = need[job] || 0;
      const ranked = pool.filter(a => !taken.has(a.id)).sort((x, y) => score(y, job) - score(x, job));
      for (let i = 0; i < want && i < ranked.length; i++) { ranked[i].job = job; taken.add(ranked[i].id); }
    }
    // leftovers forage
    for (const a of pool) if (!taken.has(a.id)) a.job = 'forager';
    // non-adults
    for (const b of this.beings) if (b.stage !== 'adult') b.job = b.stage === 'elder' ? 'forager' : null;
  }

  // ---- homes: give each being a hut to sleep in ----
  assignHomes() {
    if (!this.huts.length) return;
    for (const h of this.huts) h.occupants = [];
    for (const b of this.beings) {
      if (b.homeHut && this.huts.includes(b.homeHut) && b.homeHut.occupants.length < 5) {
        b.homeHut.occupants.push(b.id); continue;
      }
      // assign to the emptiest nearby hut
      let best = null, bd = Infinity;
      for (const h of this.huts) {
        if (h.occupants.length >= 5) continue;
        const d = Math.hypot(h.x - b.x, h.z - b.z) + h.occupants.length * 4;
        if (d < bd) { bd = d; best = h; }
      }
      if (best) { b.homeHut = best; best.occupants.push(b.id); }
    }
  }

  _maybeFarms() {
    if (!this.tech.includes('farming') || this.farms.length) return;
    for (let i = 0; i < 6; i++) {
      const ang = i / 6 * Math.PI * 2, r = 15 + i;
      const x = this.home.x + Math.cos(ang) * r, z = this.home.z + Math.sin(ang) * r;
      if (!this.world.isLand(x, z)) continue;
      this.farms.push({ x, z, y: this.world.heightAt(x, z), yield: 6, max: 6, regrow: 0 });
    }
  }

  // ---- ecology: regrow wood/stone/farm yield, move & respawn deer ----
  _resources(dDays) {
    for (const t of this.world.trees) if (t.wood < t.max) { t.regrow += dDays / 6; if (t.regrow >= 1) { t.wood++; t.regrow = 0; } }
    for (const r of this.world.rocks) if (r.stone < r.max) { r.regrow += dDays / 12; if (r.regrow >= 1) { r.stone++; r.regrow = 0; } }
    for (const f of this.farms) if (f.yield < f.max) { f.regrow += dDays / 1.5; if (f.regrow >= 1) { f.yield++; f.regrow = 0; } }
  }
  _fauna(dDays) {
    for (const d of this.fauna) {
      if (!d.alive) { d.respawn -= dDays; if (d.respawn <= 0) { const p = this.world.spawnPoint(this.rng); d.x = p.x; d.z = p.z; d.tx = p.x; d.tz = p.z; d.alive = true; } continue; }
      // wander; flee from nearby hunters
      const threat = this.nearestHunter(d.x, d.z, FAUNA.FLEE_RADIUS);
      if (threat) { const a = Math.atan2(d.z - threat.z, d.x - threat.x); d.tx = d.x + Math.cos(a) * 12; d.tz = d.z + Math.sin(a) * 12; }
      else if (Math.hypot(d.tx - d.x, d.tz - d.z) < 1.5) { const a = this.rng.range(0, 6.28); d.tx = d.x + Math.cos(a) * 10; d.tz = d.z + Math.sin(a) * 10; }
      const dx = d.tx - d.x, dz = d.tz - d.z, dist = Math.hypot(dx, dz);
      if (dist > 0.3) {
        const sp = (threat ? 22 : 9) * dDays;
        let nx = d.x + dx / dist * Math.min(dist, sp), nz = d.z + dz / dist * Math.min(dist, sp);
        if (!this.world.isLand(nx, nz)) { d.tx = d.x; d.tz = d.z; } else { d.x = nx; d.z = nz; }
      }
      d.y = this.world.heightAt(d.x, d.z);
    }
  }
  nearestHunter(x, z, radius) {
    let best = null, bd = radius * radius;
    for (const b of this.beings) {
      if (b.job !== 'hunter') continue;
      const dx = b.x - x, dz = b.z - z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  // conversation hook — culture/gossip now, LLM "souls" later
  onConverse(a, b) {
    this._convoTimer = (this._convoTimer || 0);
    // spread knowledge & relationship gossip; occasionally a memorable exchange
    if (a.insight > b.insight) { const d = (a.insight - b.insight) * 0.02; b.insight += d; this.insight += d; }
  }

  get leader() { return this.beings.find(b => b.id === this.leaderId) || null; }

  _faithTick() { /* god module handles faith; kept for ordering hook */ }
}
