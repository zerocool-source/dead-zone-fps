// The Simulation — the real product. Owns the world, the population, time, knowledge,
// reproduction, death, and the Chronicle. Engine-agnostic: no rendering here.
import { RNG, hashStringToSeed } from './rng.js';
import { World } from './world.js';
import { Being } from './being.js';
import { Chronicle } from './chronicle.js';
import { makeTribeName, makeName } from './names.js';
import {
  DAY_SECONDS, YEAR_DAYS, TIME_SCALES, POP, FOOD, TECH, LIFE,
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

    this._seedTribe();
    this.chronicle.add(0, 0, '🌅', `The ${this.tribeName} awaken on the shore of a new world.`, 'epoch');
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
      this._gestation();
    }
    this._discoveries();
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

  _faithTick() { /* god module handles faith; kept for ordering hook */ }
}
