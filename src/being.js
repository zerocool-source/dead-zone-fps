// A Being ("bean") — an autonomous agent. Needs + personality + memory + relationships
// + a utility-AI brain. Architected so a promoted being can later defer to an LLM "soul"
// (see decide(): the hook is `this.soul`).
import { NEEDS, LIFE } from './config.js';
import { BIOME } from './world.js';
import { makeName } from './names.js';

let NEXT_ID = 1;

export const ACTION = {
  IDLE: 'resting', FORAGE: 'foraging', EAT: 'eating', REST: 'sleeping',
  SOCIAL: 'talking', MATE: 'courting', WANDER: 'wandering', SEEK: 'seeking', GRIEVE: 'grieving',
};

export class Being {
  constructor(rng, x, z, opts = {}) {
    this.id = NEXT_ID++;
    this.rng = rng;
    this.name = opts.name || makeName(rng);
    this.sex = opts.sex || (rng.chance(0.5) ? 'f' : 'm');
    this.x = x; this.z = z; this.y = 0;
    this.tx = x; this.tz = z;                 // move target
    this.age = opts.age != null ? opts.age : rng.range(16, 40);
    this.bornDay = opts.bornDay ?? 0;
    this.alive = true;
    this.deathCause = null;

    // needs (0..100). hunger: high = bad. energy/social: high = good.
    this.hunger = rng.range(10, 40);
    this.energy = rng.range(60, 100);
    this.social = rng.range(40, 80);

    // personality trait vector (-1..1)
    this.traits = opts.traits || {
      brave: rng.gauss(0, 0.5), curious: rng.gauss(0, 0.5),
      kind: rng.gauss(0.1, 0.5), devout: rng.gauss(0, 0.5), social: rng.gauss(0.1, 0.5),
    };

    this.skills = { forage: rng.range(0.1, 0.4), craft: 0.1, build: 0.1 };
    this.insight = 0;                          // personal contribution to culture knowledge
    this.memory = [];                          // {day,type,text,weight}
    this.bonds = new Map();                    // beingId -> -100..100
    this.parents = opts.parents || [];
    this.children = [];
    this.mateId = null;
    this.lastMateDay = -999;
    this.gestating = null;                     // {fatherId, dueDay}

    // belief about the god (you)
    this.godAwareness = 0;                     // 0..1, rises with ritual + witnessed miracles
    this.godMood = 0;                          // -1 fearful .. +1 loving
    this.trust = rng.range(0.2, 0.5);          // willingness to heed influence

    this.action = ACTION.IDLE;
    this.actTarget = null;                     // {kind, ref}
    this.inspiration = null;                   // god-planted urge {kind, x, z, ttl}
    this.deathAge = LIFE.MAX_AGE + rng.gauss(0, LIFE.DEATH_AGE_VARIANCE);

    // appearance (warm, legible, Sims-like) — hue + build are heritable genes that
    // drift across generations, so isolated lineages slowly diverge in look (concept §5.1)
    this.hue = opts.hue != null ? opts.hue : rng.range(0, 1);
    this.build = opts.build != null ? Math.max(0.78, Math.min(1.25, opts.build)) : (1 + rng.gauss(0, 0.06));
    this.soul = null;                          // future: LLM reasoner for promoted beings
    this.promoted = false;
  }

  get stage() {
    if (this.age < LIFE.CHILD_UNTIL) return 'child';
    if (this.age >= LIFE.ELDER_FROM) return 'elder';
    return 'adult';
  }
  get fertile() {
    return this.stage === 'adult' && this.age >= LIFE.FERTILE_FROM && this.age <= LIFE.FERTILE_UNTIL;
  }
  // world units travelled per in-game DAY (so movement tracks the time scale, not real fps)
  get speed() {
    const base = this.stage === 'child' ? 42 : this.stage === 'elder' ? 46 : 64;
    return base * (0.6 + 0.4 * (this.energy / 100));
  }

  remember(type, text, weight = 1) {
    this.memory.push({ day: this._day, type, text, weight });
    if (this.memory.length > 18) this.memory.shift();
  }

  bondWith(id, delta) {
    const cur = this.bonds.get(id) || 0;
    this.bonds.set(id, Math.max(-100, Math.min(100, cur + delta)));
  }
  bondTo(id) { return this.bonds.get(id) || 0; }

  // ---- simulation step; dDays in in-game days (sub-stepped by the Sim for stability) ----
  update(dDays, sim) {
    if (!this.alive) return;
    this._day = sim.day;
    this.age += dDays / sim.yearDays;

    // need drains (children are cared for by the band, so they hunger slowly)
    const hungerRise = NEEDS.HUNGER_RISE * (this.stage === 'child' ? 0.3 : 1);
    this.hunger = Math.min(100, this.hunger + hungerRise * dDays);
    this.energy = Math.max(0, this.energy - NEEDS.ENERGY_FALL * dDays);
    this.social = Math.max(0, this.social - NEEDS.SOCIAL_FALL * dDays);

    // belief decays slowly toward neutrality unless reinforced
    this.godAwareness = Math.max(0, this.godAwareness - 0.02 * dDays);

    // curiosity feeds culture insight (children barely contribute)
    const wonder = (0.5 + this.traits.curious * 0.5) * (this.energy / 100);
    const gain = wonder * dDays * 0.5 * (0.5 + this.skills.forage) * (this.stage === 'child' ? 0.2 : 1);
    this.insight += gain;
    sim.addInsight(gain);

    if (this.inspiration) { this.inspiration.ttl -= dDays; if (this.inspiration.ttl <= 0) this.inspiration = null; }

    this._decideAndAct(dDays, sim);
    this._checkLife(dDays, sim);
  }

  // ---- decision: utility scoring over candidate actions ----
  _decideAndAct(dDays, sim) {
    // re-decide periodically or when current action resolves
    this._think = (this._think || 0) - dDays;
    if (this._think <= 0 || !this.actTarget) {
      this._think = this.rng.range(0.25, 0.6);
      this.action = this.soul ? this.soul.decide(this, sim) : this._utilityDecide(sim);
    }
    this._move(dDays, sim);
    this._resolve(dDays, sim);
  }

  _utilityDecide(sim) {
    const t = this.traits;
    const scores = [];
    // EAT
    scores.push([ACTION.FORAGE, (this.hunger / 100) ** 1.5 * 1.3]);
    // REST
    scores.push([ACTION.REST, ((100 - this.energy) / 100) ** 1.6 * (this.stage === 'elder' ? 1.2 : 1.0)]);
    // SOCIAL
    const near = sim.neighbors(this, 18, true);
    scores.push([ACTION.SOCIAL, ((100 - this.social) / 100) * (0.5 + t.social * 0.5) * (near.length ? 1.1 : 0.15)]);
    // MATE
    if (this.fertile && !this.gestating && this._day - this.lastMateDay > LIFE.MATE_COOLDOWN_DAYS
        && this.hunger < 60 && this.energy > 35) {
      const m = sim.findMate(this);
      scores.push([ACTION.MATE, m ? 0.7 + this.bondTo(m.id) / 250 : 0]);
    }
    // INSPIRATION (god nudge) — weighted by trust
    if (this.inspiration) scores.push([ACTION.SEEK, 0.55 + this.trust * 0.9]);
    // WANDER / explore
    scores.push([ACTION.WANDER, 0.12 + Math.max(0, t.curious) * 0.3]);

    scores.sort((a, b) => b[1] - a[1]);
    const chosen = scores[0][0];
    this._setupAction(chosen, sim);
    return chosen;
  }

  _setupAction(action, sim) {
    this.actTarget = null;
    if (action === ACTION.FORAGE) {
      const bush = sim.nearestBush(this.x, this.z);
      if (bush) { this.actTarget = { kind: 'bush', ref: bush }; this.tx = bush.x; this.tz = bush.z; }
      else { this.action = ACTION.WANDER; this._wanderTarget(sim); }
    } else if (action === ACTION.SOCIAL) {
      const friend = sim.nearestNeighbor(this, 24, true);
      if (friend) { this.actTarget = { kind: 'being', ref: friend }; this.tx = friend.x; this.tz = friend.z; }
      else this._wanderTarget(sim);
    } else if (action === ACTION.MATE) {
      const m = sim.findMate(this);
      if (m) { this.actTarget = { kind: 'mate', ref: m }; this.tx = m.x; this.tz = m.z; }
      else { this.action = ACTION.WANDER; this._wanderTarget(sim); }
    } else if (action === ACTION.SEEK && this.inspiration) {
      this.tx = this.inspiration.x; this.tz = this.inspiration.z;
      this.actTarget = { kind: 'inspire' };
    } else if (action === ACTION.REST) {
      this.actTarget = { kind: 'rest' };
      const home = sim.home;
      this.tx = home.x + this.rng.range(-6, 6); this.tz = home.z + this.rng.range(-6, 6);
    } else {
      this._wanderTarget(sim);
    }
  }

  _wanderTarget(sim) {
    this.actTarget = { kind: 'wander' };
    const ang = this.rng.range(0, Math.PI * 2);
    const dist = this.rng.range(8, 26);
    let nx = this.x + Math.cos(ang) * dist, nz = this.z + Math.sin(ang) * dist;
    if (!sim.world.isLand(nx, nz)) { nx = sim.home.x; nz = sim.home.z; }
    this.tx = nx; this.tz = nz;
  }

  _move(dDays, sim) {
    const dx = this.tx - this.x, dz = this.tz - this.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.4) {
      const step = Math.min(d, this.speed * dDays);
      let nx = this.x + dx / d * step, nz = this.z + dz / d * step;
      if (!sim.world.isLand(nx, nz)) { nx = this.x; nz = this.z; this.tx = sim.home.x; this.tz = sim.home.z; }
      this.x = nx; this.z = nz;
      this.moving = true;
    } else this.moving = false;
    this.y = sim.world.heightAt(this.x, this.z);
    // gentle bob facing
    this.heading = Math.atan2(dz, dx);
  }

  _resolve(dDays, sim) {
    if (!this.actTarget) return;
    const reached = Math.hypot(this.tx - this.x, this.tz - this.z) < 1.4;
    const k = this.actTarget.kind;

    if (k === 'bush' && reached) {
      const bush = this.actTarget.ref;
      if (bush.berries > 0) {
        // eat enough to mostly sate (up to 2 berries), don't strip the whole bush
        let eaten = 0;
        while (bush.berries > 0 && eaten < 2 && this.hunger > 12) {
          bush.berries -= 1; eaten += 1;
          this.hunger = Math.max(0, this.hunger - NEEDS.EAT_GAIN * 0.55);
        }
        this.skills.forage = Math.min(1, this.skills.forage + 0.01);
        this.action = ACTION.EAT;
        this.actTarget = null; this._think = this.rng.range(0.2, 0.5);
      } else { this.actTarget = null; this._think = 0; }
    } else if (k === 'rest') {
      this.energy = Math.min(100, this.energy + NEEDS.REST_GAIN * dDays * 2);
      if (this.energy > 92) { this.actTarget = null; this._think = 0; }
    } else if (k === 'being' && reached) {
      const other = this.actTarget.ref;
      if (other.alive) {
        this.social = Math.min(100, this.social + NEEDS.SOCIAL_GAIN);
        other.social = Math.min(100, other.social + NEEDS.SOCIAL_GAIN * 0.6);
        const warmth = 2 + this.traits.kind * 2;
        this.bondWith(other.id, warmth); other.bondWith(this.id, warmth);
        if (this.rng.chance(0.04)) this.remember('social', `shared a moment with ${other.name}`, 1);
      }
      this.action = ACTION.SOCIAL; this.actTarget = null; this._think = this.rng.range(0.3, 0.7);
    } else if (k === 'mate' && reached) {
      const m = this.actTarget.ref;
      if (m.alive && m.fertile && this.fertile) sim.tryConceive(this, m);
      this.actTarget = null; this._think = this.rng.range(0.4, 0.8);
    } else if (k === 'inspire' && reached) {
      // arriving where the god pointed: chance of insight / belief
      this.insight += 3; sim.addInsight(3);
      this.godAwareness = Math.min(1, this.godAwareness + 0.18);
      this.godMood = Math.min(1, this.godMood + 0.1);
      this.trust = Math.min(1, this.trust + 0.05);
      this.remember('inspire', 'felt a pull toward something, and followed it', 2);
      this.inspiration = null; this.actTarget = null; this._think = 0;
    } else if (k === 'wander' && reached) {
      this.actTarget = null; this._think = 0;
    }
  }

  _checkLife(dDays, sim) {
    // starvation timer (children are cared for and don't starve to death)
    if (this.hunger >= 99 && this.stage !== 'child') {
      this._starve = (this._starve || 0) + dDays;
      if (this._starve > LIFE.STARVE_DEATH_DAYS && this.rng.chance(0.4 * dDays + 0.01)) {
        return this.die('hunger', sim);
      }
    } else {
      this._starve = Math.max(0, (this._starve || 0) - dDays);
    }
    // old age
    if (this.age >= this.deathAge && this.rng.chance(0.25 * dDays + 0.004)) {
      return this.die('old age', sim);
    }
  }

  die(cause, sim) {
    if (!this.alive) return;
    this.alive = false;
    this.deathCause = cause;
    sim.onDeath(this, cause);
  }
}
