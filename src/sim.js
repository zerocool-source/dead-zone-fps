// The Simulation — owns the world, all beings, the tribes, time, knowledge, reproduction,
// death, ecology, and the Chronicle. Engine-agnostic: no rendering here.
import { RNG, hashStringToSeed } from './rng.js';
import { World } from './world.js';
import { Being } from './being.js';
import { Tribe } from './tribe.js';
import { Chronicle } from './chronicle.js';
import { makeName } from './names.js';
import {
  DAY_SECONDS, YEAR_DAYS, TIME_SCALES, POP, FOOD, TECH, LIFE, RES, FAUNA, JOBS, RACES, TRIBES, COMBAT,
} from './config.js';

export class Sim {
  constructor(seedStr = 'pangaea') {
    this.seedStr = seedStr;
    this.rng = new RNG(hashStringToSeed(seedStr));
    this.world = new World(this.rng);
    this.chronicle = new Chronicle();
    this.yearDays = YEAR_DAYS;

    this.day = 0; this.year = 0;
    this.speedIndex = 1;
    this.beings = [];
    this.tribes = [];
    this.fauna = [];
    this.dead = [];
    this.births = 0; this.deaths = 0;
    this.DEER_FOOD = FAUNA.DEER_FOOD;
    this.FAUNA_RESPAWN = FAUNA.RESPAWN_DAYS;
    this._jobTimer = 0;

    this._seedTribes();
    this._seedFauna();
    for (const t of this.tribes) this.assignJobs(t);
    this.chronicle.add(0, 0, '🌅', `Across a new world, ${this.tribes.length} peoples open their eyes.`, 'epoch');
  }

  // ---- world setup ----
  _seedTribes() {
    const keys = Object.keys(RACES);
    // always start with dawnfolk, then distinct others
    const chosen = ['dawnfolk'];
    const rest = keys.filter(k => k !== 'dawnfolk');
    while (chosen.length < TRIBES.COUNT && rest.length) {
      chosen.push(rest.splice(this.rng.int(0, rest.length - 1), 1)[0]);
    }
    const homes = [];
    for (const key of chosen) {
      const race = RACES[key];
      const home = this.world.spawnInBiome(this.rng, race.biome, homes, this.world.size * 0.22);
      home.y = this.world.heightAt(home.x, home.z);
      homes.push(home);
      const tribe = new Tribe(this.rng, key, race, home);
      this.tribes.push(tribe);
      this._seedMembers(tribe);
      this.chronicle.add(0, 0, '🏕️', `The ${tribe.name} (${race.name}) settle the ${race.biome}.`, 'epoch');
    }
    this.home = this.tribes[0].home; // camera default
  }

  _seedMembers(tribe) {
    for (let i = 0; i < TRIBES.START_POP; i++) {
      const a = this.rng.range(0, Math.PI * 2), r = this.rng.range(2, 12);
      let x = tribe.home.x + Math.cos(a) * r, z = tribe.home.z + Math.sin(a) * r;
      if (!this.world.isLand(x, z)) { x = tribe.home.x; z = tribe.home.z; }
      const traits = {};
      for (const k of ['brave', 'curious', 'kind', 'devout', 'social']) {
        traits[k] = Math.max(-1, Math.min(1, this.rng.gauss((tribe.race.trait?.[k]) || 0, 0.45)));
      }
      const b = new Being(this.rng, x, z, {
        hue: tribe.hue + this.rng.gauss(0, 0.012),
        build: tribe.race.build + this.rng.gauss(0, 0.05),
        traits,
      });
      b.tribe = tribe;
      this.beings.push(b);
    }
  }

  _seedFauna() {
    for (let i = 0; i < FAUNA.DEER_COUNT; i++) {
      const p = this.world.spawnPoint(this.rng);
      this.fauna.push({ x: p.x, z: p.z, y: this.world.heightAt(p.x, p.z), tx: p.x, tz: p.z, alive: true, respawn: 0 });
    }
  }

  // ---- compat getters ----
  get speed() { return TIME_SCALES[this.speedIndex]; }
  setSpeed(i) { this.speedIndex = Math.max(0, Math.min(TIME_SCALES.length - 1, i)); }
  cycleSpeed(dir) { this.setSpeed(this.speedIndex + dir); }
  get population() { return this.beings.length; }
  get tribeName() { return this.tribes[0] ? this.tribes[0].name : 'the people'; }
  believers() { return this.beings.filter(b => b.godAwareness > 0.25).length; }
  membersOf(tribe) { return this.beings.filter(b => b.tribe === tribe); }
  get leader() { return this.tribes[0] ? this.beings.find(b => b.id === this.tribes[0].leaderId) : null; }

  // ---- main tick ----
  update(dtReal) {
    const dt = Math.min(dtReal, 0.05);
    const speed = this.speed;
    if (speed === 0) return 0;
    const total = (dt * speed) / DAY_SECONDS;

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

    for (const t of this.tribes) this._discoveries(t);

    this._jobTimer -= total;
    if (this._jobTimer <= 0) {
      this._jobTimer = 0.34;
      for (const t of this.tribes) { this.assignJobs(t); this.assignHomes(t); this._maybeFarms(t); }
      this._diplomacy();
    }
    return total;
  }

  _onYear() {
    if (this.year > 0 && this.year % 25 === 0) {
      this.chronicle.add(this.day, this.year, '📜', `${this.year} years pass. ${this.population} souls across ${this.tribes.length} peoples.`, 'epoch');
    }
  }

  // ---- spatial queries ----
  neighbors(b, radius, livingOnly = false) {
    const out = [], r2 = radius * radius;
    for (const o of this.beings) {
      if (o === b || (livingOnly && !o.alive)) continue;
      const dx = o.x - b.x, dz = o.z - b.z;
      if (dx * dx + dz * dz <= r2) out.push(o);
    }
    return out;
  }
  nearestNeighbor(b, radius, livingOnly = false, sameTribe = false) {
    let best = null, bd = radius * radius;
    for (const o of this.beings) {
      if (o === b || (livingOnly && !o.alive)) continue;
      if (sameTribe && o.tribe !== b.tribe) continue;
      const dx = o.x - b.x, dz = o.z - b.z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  nearestBush(x, z) { return this._nearestNode(this.world.bushes, x, z, n => n.berries > 0); }
  nearestTree(x, z) { return this._nearestNode(this.world.trees, x, z, n => n.wood > 0); }
  nearestRock(x, z) { return this._nearestNode(this.world.rocks, x, z, n => n.stone > 0); }
  nearestFarm(tribe, x, z) { return this._nearestNode(tribe.farms, x, z, n => n.yield > 0); }
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
  findMate(b) {
    let best = null, bd = Infinity;
    for (const o of this.beings) {
      if (o === b || o.tribe !== b.tribe || !o.alive || !o.fertile || o.sex === b.sex || o.gestating) continue;
      if (this.day - o.lastMateDay < LIFE.MATE_COOLDOWN_DAYS) continue;
      const dx = o.x - b.x, dz = o.z - b.z, d = dx * dx + dz * dz;
      const bias = 1 - b.bondTo(o.id) / 200;
      if (d * bias < bd) { bd = d * bias; best = o; }
    }
    return best;
  }

  // ---- economy ----
  storePos(b) { return b.tribe ? b.tribe.home : this.home; }
  deposit(b, type, amount) { const r = (b.tribe || this).res; r[type] = (r[type] || 0) + amount; }
  addInsight(b, g) { if (b.tribe) b.tribe.insight += g; }

  buildSite(tribe) {
    const wantHuts = Math.min(24, Math.ceil(this.membersOf(tribe).length / 3));
    if (tribe.huts.length < wantHuts && tribe.res.wood >= RES.HUT_COST.wood && tribe.res.stone >= RES.HUT_COST.stone) {
      const i = tribe.huts.length;
      const ang = (i / 6) * Math.PI * 2 + 0.7, r = 7 + Math.floor(i / 6) * 4.5;
      let x = tribe.home.x + Math.cos(ang) * r, z = tribe.home.z + Math.sin(ang) * r;
      if (!this.world.isLand(x, z)) { x = tribe.home.x; z = tribe.home.z; }
      return { kind: 'hut', x, z, y: this.world.heightAt(x, z), tribe };
    }
    return null;
  }
  tryBuild(site, builder) {
    const tribe = site.tribe || builder.tribe;
    if (site.kind === 'hut') {
      if (tribe.res.wood < RES.HUT_COST.wood || tribe.res.stone < RES.HUT_COST.stone) return;
      if (tribe.huts.some(h => Math.hypot(h.x - site.x, h.z - site.z) < 3)) return;
      tribe.res.wood -= RES.HUT_COST.wood; tribe.res.stone -= RES.HUT_COST.stone;
      tribe.huts.push({ x: site.x, z: site.z, y: site.y, occupants: [], tribe });
      builder.skills.build = Math.min(1, builder.skills.build + 0.03);
      if (builder.rng.chance(0.5)) builder.remember('build', `raised a new home for the ${tribe.name}`, 2);
    }
  }

  // ---- jobs (per tribe) ----
  assignJobs(tribe) {
    const adults = this.membersOf(tribe).filter(b => b.stage === 'adult');
    if (!adults.length) return;
    if (!tribe.leaderId || !adults.some(a => a.id === tribe.leaderId)) {
      const cand = adults.reduce((a, c) =>
        (c.traits.social + c.traits.devout + c.age / 60) > (a.traits.social + a.traits.devout + a.age / 60) ? c : a);
      tribe.leaderId = cand.id;
      if (tribe.tech.includes('language')) {
        this.chronicle.add(this.day, this.year, '👑', `${cand.name} rises as leader of the ${tribe.name}.`, 'gov');
      }
    }
    const n = adults.length;
    const atWar = tribe._wars && tribe._wars.size > 0;
    const aggr = (tribe.race.trait?.brave || 0) > 0.2;
    const need = {
      warrior: atWar ? Math.max(2, Math.round(n * 0.32)) : Math.round(n * (aggr ? 0.12 : 0.07)),
      hunter: Math.round(n * 0.16),
      woodcutter: Math.round(n * 0.15),
      miner: Math.round(n * 0.11),
      builder: Math.max(1, Math.round(n * 0.11)),
      farmer: tribe.tech.includes('farming') ? Math.round(n * 0.18) : 0,
    };
    const leader = adults.find(a => a.id === tribe.leaderId);
    if (leader) leader.job = 'leader';
    const pool = adults.filter(a => a.id !== tribe.leaderId);
    const score = (a, job) => {
      if (job === 'warrior') return a.traits.brave * 1.4 + (a.build - 1) + a.skills.craft;
      if (job === 'hunter') return a.traits.brave + a.skills.forage;
      if (job === 'woodcutter' || job === 'miner') return (a.build - 1) + a.skills.craft + a.traits.brave * 0.3;
      if (job === 'builder') return a.skills.build + a.skills.craft;
      return a.skills.forage + a.traits.kind * 0.2;
    };
    const taken = new Set();
    for (const job of ['warrior', 'builder', 'hunter', 'woodcutter', 'miner', 'farmer']) {
      const want = need[job] || 0;
      const ranked = pool.filter(a => !taken.has(a.id)).sort((x, y) => score(y, job) - score(x, job));
      for (let i = 0; i < want && i < ranked.length; i++) { ranked[i].job = job; taken.add(ranked[i].id); }
    }
    for (const a of pool) if (!taken.has(a.id)) a.job = 'forager';
    for (const b of this.membersOf(tribe)) if (b.stage !== 'adult') b.job = b.stage === 'elder' ? 'forager' : null;
  }

  assignHomes(tribe) {
    if (!tribe.huts.length) return;
    for (const h of tribe.huts) h.occupants = [];
    for (const b of this.membersOf(tribe)) {
      if (b.homeHut && tribe.huts.includes(b.homeHut) && b.homeHut.occupants.length < 5) { b.homeHut.occupants.push(b.id); continue; }
      let best = null, bd = Infinity;
      for (const h of tribe.huts) {
        if (h.occupants.length >= 5) continue;
        const d = Math.hypot(h.x - b.x, h.z - b.z) + h.occupants.length * 4;
        if (d < bd) { bd = d; best = h; }
      }
      if (best) { b.homeHut = best; best.occupants.push(b.id); }
    }
  }

  _maybeFarms(tribe) {
    if (!tribe.tech.includes('farming') || tribe.farms.length) return;
    for (let i = 0; i < 6; i++) {
      const ang = i / 6 * Math.PI * 2, r = 15 + i;
      const x = tribe.home.x + Math.cos(ang) * r, z = tribe.home.z + Math.sin(ang) * r;
      if (!this.world.isLand(x, z)) continue;
      tribe.farms.push({ x, z, y: this.world.heightAt(x, z), yield: 6, max: 6, regrow: 0 });
    }
  }

  // ---- knowledge per tribe ----
  _discoveries(tribe) {
    for (const tech of TECH) {
      if (tribe.tech.includes(tech.id)) continue;
      if (tribe.insight >= tech.needInsight && this.membersOf(tribe).length >= tech.needPop) {
        tribe.tech.push(tech.id);
        const adults = this.membersOf(tribe).filter(x => x.stage === 'adult');
        const inv = adults.length
          ? adults.reduce((a, c) => (c.traits.curious + c.insight / 50 > a.traits.curious + a.insight / 50 ? c : a)) : null;
        if (inv) inv.remember('discovery', `helped the ${tribe.name} discover ${tech.name}`, 4);
        if (tech.id === 'ritual') for (const x of this.membersOf(tribe)) x.godAwareness = Math.min(1, x.godAwareness + 0.3);
        this.chronicle.add(this.day, this.year, '💡',
          `${inv ? inv.name + ' leads the ' : 'The '}${tribe.name} to discover ${tech.name}. — ${tech.desc}`, 'tech');
      }
    }
  }

  // ---- reproduction & death ----
  tryConceive(a, b) {
    const female = a.sex === 'f' ? a : b, male = a.sex === 'f' ? b : a;
    if (female.gestating) return;
    a.lastMateDay = b.lastMateDay = this.day;
    a.mateId = b.id; b.mateId = a.id;
    a.bondWith(b.id, 8); b.bondWith(a.id, 8);
    if (this.membersOf(a.tribe).length >= POP.SOFT_CAP) return;
    if (this.rng.chance(0.7)) female.gestating = { fatherId: male.id, dueDay: this.day + LIFE.GESTATION_DAYS };
  }

  _gestation() {
    for (const b of this.beings) {
      if (b.gestating && this.day >= b.gestating.dueDay) {
        const father = this.beings.find(x => x.id === b.gestating.fatherId);
        const hue = (b.hue + (father ? father.hue : b.hue)) / 2 + this.rng.gauss(0, 0.02);
        const traits = {};
        for (const k of ['brave', 'curious', 'kind', 'devout', 'social']) {
          const fa = b.traits[k], fb = father ? father.traits[k] : 0;
          traits[k] = Math.max(-1, Math.min(1, (fa + fb) / 2 + this.rng.gauss(0, 0.22)));
        }
        const fb = father ? father.build : b.build;
        const childBuild = (b.build + fb) / 2 + this.rng.gauss(0, 0.04);
        const child = new Being(this.rng, b.x + this.rng.range(-1, 1), b.z + this.rng.range(-1, 1), {
          age: 0, bornDay: this.day, traits, hue, build: childBuild,
          parents: father ? [b.id, father.id] : [b.id], name: makeName(this.rng),
        });
        child.tribe = b.tribe;
        child.hunger = 30; child.energy = 90;
        b.children.push(child.id); if (father) father.children.push(child.id);
        b.bondWith(child.id, 40); child.bondWith(b.id, 40);
        b.gestating = null;
        this.beings.push(child); this.births++;
        if (this.membersOf(b.tribe).length <= 40 || this.rng.chance(0.2)) {
          this.chronicle.add(this.day, this.year, '👶', `${child.name} is born to ${b.name}${father ? ' and ' + father.name : ''}.`, 'birth');
        }
      }
    }
  }

  onDeath(b, cause) {
    this.deaths++;
    this.dead.push({ name: b.name, year: this.year, cause, age: Math.floor(b.age) });
    for (const o of this.beings) {
      if (o === b) continue;
      if (o.bondTo(b.id) > 20) { o.remember('loss', `mourned ${b.name}`, 3); o.social = Math.max(0, o.social - 20); }
    }
    const tribe = b.tribe;
    if (!tribe || this.membersOf(tribe).length <= 40 || b.godAwareness > 0.4 || this.rng.chance(0.2)) {
      this.chronicle.add(this.day, this.year, '⚰️', `${b.name} dies of ${cause} at ${Math.floor(b.age)}.`, 'death');
    }
    if (tribe && this.membersOf(tribe).length <= 1) {
      this.chronicle.add(this.day, this.year, '🕯️', `The ${tribe.name} are no more. Their fires go cold.`, 'epoch');
    }
  }

  // ---- ecology ----
  _food(dDays) {
    const rate = dDays / FOOD.REGROW_DAYS;
    for (const bush of this.world.bushes) if (bush.berries < bush.max) { bush.regrow += rate; if (bush.regrow >= 1) { bush.berries += 1; bush.regrow = 0; } }
  }
  _resources(dDays) {
    for (const t of this.world.trees) if (t.wood < t.max) { t.regrow += dDays / 6; if (t.regrow >= 1) { t.wood++; t.regrow = 0; } }
    for (const r of this.world.rocks) if (r.stone < r.max) { r.regrow += dDays / 12; if (r.regrow >= 1) { r.stone++; r.regrow = 0; } }
    for (const tribe of this.tribes) for (const f of tribe.farms) if (f.yield < f.max) { f.regrow += dDays / 1.5; if (f.regrow >= 1) { f.yield++; f.regrow = 0; } }
  }
  _fauna(dDays) {
    for (const d of this.fauna) {
      if (!d.alive) { d.respawn -= dDays; if (d.respawn <= 0) { const p = this.world.spawnPoint(this.rng); d.x = p.x; d.z = p.z; d.tx = p.x; d.tz = p.z; d.alive = true; } continue; }
      const threat = this.nearestHunter(d.x, d.z, FAUNA.FLEE_RADIUS);
      if (threat) { const a = Math.atan2(d.z - threat.z, d.x - threat.x); d.tx = d.x + Math.cos(a) * 12; d.tz = d.z + Math.sin(a) * 12; }
      else if (Math.hypot(d.tx - d.x, d.tz - d.z) < 1.5) { const a = this.rng.range(0, 6.28); d.tx = d.x + Math.cos(a) * 10; d.tz = d.z + Math.sin(a) * 10; }
      const dx = d.tx - d.x, dz = d.tz - d.z, dist = Math.hypot(dx, dz);
      if (dist > 0.3) {
        const sp = (threat ? 22 : 9) * dDays;
        const nx = d.x + dx / dist * Math.min(dist, sp), nz = d.z + dz / dist * Math.min(dist, sp);
        if (!this.world.isLand(nx, nz)) { d.tx = d.x; d.tz = d.z; } else { d.x = nx; d.z = nz; }
      }
      d.y = this.world.heightAt(d.x, d.z);
    }
  }
  atWar(a, b) { return a && b && a !== b && a.standing(b.id) <= COMBAT.WAR_THRESHOLD; }
  nearestEnemy(b, radius) {
    if (!b.tribe) return null;
    let best = null, bd = radius * radius;
    for (const o of this.beings) {
      if (!o.alive || !o.tribe || o.tribe === b.tribe) continue;
      if (!this.atWar(b.tribe, o.tribe)) continue;
      const dx = o.x - b.x, dz = o.z - b.z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
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

  // ---- culture & diplomacy ----
  onConverse(a, b) {
    if (a.tribe === b.tribe) {
      if (a.insight > b.insight) { const d = (a.insight - b.insight) * 0.02; b.insight += d; a.tribe.insight += d; }
    } else if (a.tribe && b.tribe) {
      // strangers meet — standing shifts with their kindness; ideas (rarely) cross
      const warmth = (a.traits.kind + b.traits.kind) * 0.5;
      a.tribe.adjustStanding(b.tribe.id, warmth);
      b.tribe.adjustStanding(a.tribe.id, warmth);
    }
  }

  _diplomacy() {
    const T = this.tribes.filter(t => this.membersOf(t).length > 0);
    for (let i = 0; i < T.length; i++) {
      for (let j = i + 1; j < T.length; j++) {
        const a = T[i], b = T[j];
        a._wars = a._wars || new Set(); b._wars = b._wars || new Set();
        const dist = Math.hypot(a.home.x - b.home.x, a.home.z - b.home.z);
        const near = dist < this.world.size * 0.5;
        const aggr = (a.race.trait?.brave || 0) + (b.race.trait?.brave || 0);
        const scarce = (a.res.food < 14 ? 0.5 : 0) + (b.res.food < 14 ? 0.5 : 0);
        // tension rises with aggression, hunger, and proximity; eases with distance & time
        let drift = 0.18 - (near ? aggr * 0.45 + scarce * 0.35 : 0) + (near ? 0 : 0.15);
        drift += this.rng.gauss(0, 0.22);
        a.adjustStanding(b.id, drift); b.adjustStanding(a.id, drift);
        const s = a.standing(b.id);
        if (s <= COMBAT.WAR_THRESHOLD && !a._wars.has(b.id)) {
          a._wars.add(b.id); b._wars.add(a.id);
          this.chronicle.add(this.day, this.year, '⚔️', `War breaks out between the ${a.name} and the ${b.name}!`, 'war');
        } else if (s > COMBAT.PEACE_THRESHOLD && a._wars.has(b.id)) {
          a._wars.delete(b.id); b._wars.delete(a.id);
          this.chronicle.add(this.day, this.year, '🕊️', `The ${a.name} and the ${b.name} lay down their arms.`, 'gov');
        }
      }
    }
  }

  _faithTick() {}
}
