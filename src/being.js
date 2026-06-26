// A Being ("bean") — an autonomous agent. Needs + personality + memory + relationships
// + a utility-AI brain. Architected so a promoted being can later defer to an LLM "soul"
// (see decide(): the hook is `this.soul`).
import { NEEDS, LIFE, RES, DAYTIME, COMBAT } from './config.js';
import { BIOME } from './world.js';
import { makeName } from './names.js';

let NEXT_ID = 1;

export const ACTION = {
  IDLE: 'resting', FORAGE: 'foraging', EAT: 'eating', REST: 'sleeping',
  SOCIAL: 'talking', MATE: 'courting', WANDER: 'wandering', SEEK: 'seeking', GRIEVE: 'grieving',
  CHOP: 'chopping wood', MINE: 'mining stone', HUNT: 'hunting', HAUL: 'hauling', BUILD: 'building',
  FARM: 'farming', PLAY: 'playing', LEAD: 'leading', FIGHT: 'fighting', FLEE: 'fleeing',
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
    this.health = 100;

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
    this.job = opts.job || null;               // assigned role (forager/hunter/woodcutter/...)
    this.carrying = null;                      // {type:'food'|'wood'|'stone', amount}
    this.homeHut = null;                       // assigned hut to sleep in
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

    // recover health when not actively fighting
    if (this.action !== ACTION.FIGHT && this.health < 100) this.health = Math.min(100, this.health + COMBAT.HEAL_PER_DAY * dDays);

    // curiosity feeds culture insight (children barely contribute)
    const wonder = (0.5 + this.traits.curious * 0.5) * (this.energy / 100);
    const gain = wonder * dDays * 0.5 * (0.5 + this.skills.forage) * (this.stage === 'child' ? 0.2 : 1);
    this.insight += gain;
    sim.addInsight(this, gain);

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

  // Daily routine: survival needs first, then time-of-day drives work / rest / social.
  _utilityDecide(sim) {
    const tod = sim.day % 1;                       // 0..1 within the day
    const night = tod >= DAYTIME.SLEEP || tod < DAYTIME.DAWN;

    // god nudge can interrupt
    if (this.inspiration && this.rng.chance(0.4 + this.trust * 0.5)) {
      this.tx = this.inspiration.x; this.tz = this.inspiration.z;
      this.actTarget = { kind: 'inspire' }; return ACTION.SEEK;
    }
    // danger: a predator stalks nearby
    const beast = sim.nearestPredator(this, 16);
    if (beast) {
      if (this.job === 'warrior' || this.job === 'hunter' || this.traits.brave > 0.45) {
        this.actTarget = { kind: 'attackBeast', ref: beast }; this.tx = beast.x; this.tz = beast.z; return ACTION.FIGHT;
      }
      const h = this.homeHut || (this.tribe ? this.tribe.home : sim.home);
      if (this.rng.chance(0.1)) sim.voice(this, 'afraid');
      this.actTarget = { kind: 'flee' }; this.tx = h.x; this.tz = h.z; return ACTION.FLEE;
    }
    // danger: an enemy is near and my people are at war with theirs
    const enemy = sim.nearestEnemy(this, COMBAT.SIGHT);
    if (enemy) {
      if (this.job === 'warrior' || (this.stage === 'adult' && this.traits.brave > 0.4 && this.health > 40)) {
        this.actTarget = { kind: 'attack', ref: enemy }; this.tx = enemy.x; this.tz = enemy.z; return ACTION.FIGHT;
      }
      // civilians flee toward home
      if (Math.hypot(enemy.x - this.x, enemy.z - this.z) < COMBAT.SIGHT * 0.55) {
        const h = this.homeHut || (this.tribe ? this.tribe.home : sim.home);
        if (this.rng.chance(0.12)) sim.voice(this, 'afraid');
        this.actTarget = { kind: 'flee' }; this.tx = h.x; this.tz = h.z; return ACTION.FLEE;
      }
    }
    // survival overrides
    if (this.hunger > 78) return this._goEat(sim);
    if (this.energy < 16 || night) return this._goSleep(sim);

    // children play & learn; elders advise near home
    if (this.stage === 'child') return this._goPlay(sim);

    // work hours
    if (tod < DAYTIME.WORK_END) {
      if (this.stage === 'elder' && this.rng.chance(0.5)) return this._goSocialize(sim);
      return this._doJob(sim);
    }
    // dusk — eat, bond, court, drift home
    if (this.hunger > 45) return this._goEat(sim);
    if (this.fertile && !this.gestating && this._day - this.lastMateDay > LIFE.MATE_COOLDOWN_DAYS
        && this.hunger < 60 && this.energy > 30 && this.rng.chance(0.4)) {
      const m = sim.findMate(this);
      if (m) { this.actTarget = { kind: 'mate', ref: m }; this.tx = m.x; this.tz = m.z; return ACTION.MATE; }
    }
    if (this.social < 60) return this._goSocialize(sim);
    return this._goSleep(sim);
  }

  // ---- job behaviour: gather a resource, then haul it to the storehouse ----
  _doJob(sim) {
    if (this.carrying) return this._goHaul(sim);
    switch (this.job) {
      case 'woodcutter': return this._goGather(sim, sim.nearestTree(this.x, this.z), 'wood', ACTION.CHOP);
      case 'miner':      return this._goGather(sim, sim.nearestRock(this.x, this.z), 'stone', ACTION.MINE);
      case 'hunter':     return this._goHunt(sim);
      case 'farmer':     return this._goFarm(sim);
      case 'builder':    return this._goBuild(sim);
      case 'warrior':    return this._goPatrol(sim);
      case 'leader':     return this._goLead(sim);
      case 'forager':
      default:           return this._goGather(sim, sim.nearestBush(this.x, this.z), 'food', ACTION.FORAGE);
    }
  }

  _goGather(sim, node, type, action) {
    if (!node) { this._wanderTarget(sim); return ACTION.WANDER; }
    this.actTarget = { kind: 'gather', ref: node, type };
    this.tx = node.x; this.tz = node.z; return action;
  }
  _goHunt(sim) {
    const prey = sim.nearestPrey(this.x, this.z);
    if (!prey) { this._wanderTarget(sim); return ACTION.WANDER; }
    this.actTarget = { kind: 'hunt', ref: prey };
    this.tx = prey.x; this.tz = prey.z; return ACTION.HUNT;
  }
  _goFarm(sim) {
    const plot = this.tribe ? sim.nearestFarm(this.tribe, this.x, this.z) : null;
    if (!plot) return this._goGather(sim, sim.nearestBush(this.x, this.z), 'food', ACTION.FORAGE);
    this.actTarget = { kind: 'gather', ref: plot, type: 'food' };
    this.tx = plot.x; this.tz = plot.z; return ACTION.FARM;
  }
  _goBuild(sim) {
    const site = sim.buildSite(this.tribe);
    if (!site) { // nothing to build → help cut wood
      return this._goGather(sim, sim.nearestTree(this.x, this.z), 'wood', ACTION.CHOP);
    }
    this.actTarget = { kind: 'build', ref: site };
    this.tx = site.x; this.tz = site.z; return ACTION.BUILD;
  }
  _goPatrol(sim) {
    // warriors hunt down enemies if at war, else guard the village
    const enemy = sim.nearestEnemy(this, COMBAT.SIGHT * 1.6);
    if (enemy) { this.actTarget = { kind: 'attack', ref: enemy }; this.tx = enemy.x; this.tz = enemy.z; return ACTION.FIGHT; }
    const h = this.tribe ? this.tribe.home : sim.home;
    this.actTarget = { kind: 'wander' };
    this.tx = h.x + this.rng.range(-12, 12); this.tz = h.z + this.rng.range(-12, 12);
    return ACTION.LEAD;
  }
  _goLead(sim) {
    // a leader walks the village, lifting spirits and binding the people together
    const friend = sim.nearestNeighbor(this, 30, true);
    if (friend) { this.actTarget = { kind: 'being', ref: friend }; this.tx = friend.x; this.tz = friend.z; }
    else this._wanderTarget(sim);
    return ACTION.LEAD;
  }
  _goHaul(sim) {
    const s = sim.storePos(this);
    this.actTarget = { kind: 'haul' }; this.tx = s.x; this.tz = s.z; return ACTION.HAUL;
  }
  _goEat(sim) {
    if (this.tribe && this.tribe.res.food >= RES.EAT_FROM_STORE) {
      const s = sim.storePos(this);
      this.actTarget = { kind: 'eatstore' }; this.tx = s.x; this.tz = s.z; return ACTION.EAT;
    }
    const bush = sim.nearestBush(this.x, this.z);
    if (bush) { this.actTarget = { kind: 'eatbush', ref: bush }; this.tx = bush.x; this.tz = bush.z; return ACTION.FORAGE; }
    this._wanderTarget(sim); return ACTION.WANDER;
  }
  _goSleep(sim) {
    const h = this.homeHut || sim.home;
    this.actTarget = { kind: 'sleep' };
    this.tx = h.x + this.rng.range(-2.5, 2.5); this.tz = h.z + this.rng.range(-2.5, 2.5);
    return ACTION.REST;
  }
  _goSocialize(sim) {
    const friend = sim.nearestNeighbor(this, 26, true);
    if (friend) { this.actTarget = { kind: 'being', ref: friend }; this.tx = friend.x; this.tz = friend.z; return ACTION.SOCIAL; }
    this._wanderTarget(sim); return ACTION.WANDER;
  }
  _goPlay(sim) {
    // children stay near the camp, play, and slowly learn
    if (this.rng.chance(0.5)) { const f = sim.nearestNeighbor(this, 16, true); if (f) { this.actTarget = { kind: 'being', ref: f }; this.tx = f.x; this.tz = f.z; return ACTION.SOCIAL; } }
    const h = this.homeHut || sim.home;
    this.actTarget = { kind: 'wander' };
    this.tx = h.x + this.rng.range(-7, 7); this.tz = h.z + this.rng.range(-7, 7);
    return ACTION.PLAY;
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
    const reached = Math.hypot(this.tx - this.x, this.tz - this.z) < 1.6;
    const k = this.actTarget.kind;

    if (k === 'gather' && reached) {
      const node = this.actTarget.ref, type = this.actTarget.type;
      const avail = type === 'food' ? (node.berries ?? node.yield ?? 0) : node[type] ?? 0;
      if (avail > 0) {
        const take = Math.min(RES.CARRY, avail, type === 'food' ? (node.berries ?? node.yield) : node[type]);
        if (type === 'food') { if (node.berries != null) node.berries -= take; else node.yield -= take; }
        else node[type] -= take;
        this.carrying = { type, amount: take * (type === 'food' ? RES.FOOD_PER_BERRY : 1) };
        this._skillUp(this.job);
      }
      this.actTarget = null; this._think = 0;
    } else if (k === 'hunt' && reached) {
      const prey = this.actTarget.ref;
      if (prey.alive) {
        const ok = this.rng.chance(0.55 + this.skills.forage * 0.3);
        if (ok) {
          prey.alive = false; prey.respawn = sim.FAUNA_RESPAWN;
          this.carrying = { type: 'food', amount: prey.def.food };
          this._skillUp('hunter');
          if (this.rng.chance(0.4)) this.remember('hunt', `brought down a ${prey.type} for the ${this.tribe ? this.tribe.name : 'tribe'}`, 2);
        } else if (prey.def.gore && this.rng.chance(0.4)) {
          // a cornered boar gores the hunter
          this.health = Math.max(1, this.health - prey.def.gore);
          this.remember('wound', `was gored by a boar and lived`, 3);
          if (this.rng.chance(0.5)) sim.voice(this, 'afraid');
        }
      }
      this.actTarget = null; this._think = 0;
    } else if (k === 'haul' && reached) {
      if (this.carrying) { sim.deposit(this, this.carrying.type, this.carrying.amount); this.carrying = null; }
      this.actTarget = null; this._think = 0;
    } else if (k === 'attack') {
      const foe = this.actTarget.ref;
      if (!foe || !foe.alive) { this.actTarget = null; this._think = 0; }
      else {
        this.tx = foe.x; this.tz = foe.z; // chase
        if (Math.hypot(foe.x - this.x, foe.z - this.z) < COMBAT.RANGE) {
          this.action = ACTION.FIGHT;
          const dmg = COMBAT.DAMAGE * (0.6 + this.skills.craft + Math.max(0, this.build - 1)) * dDays * 6;
          foe.health -= dmg;
          if (this.rng.chance(0.03)) sim.voice(this, 'war', { enemy: foe.tribe ? foe.tribe.name : '' });
          this.skills.craft = Math.min(1, this.skills.craft + 0.004);
          if (foe.health <= 0) {
            foe.die('slain in battle', sim);
            if (this.tribe) this.remember('battle', `slew a foe of the ${this.tribe.name}`, 4);
            this.actTarget = null; this._think = 0;
          }
        }
      }
    } else if (k === 'attackBeast') {
      const beast = this.actTarget.ref;
      if (!beast || !beast.alive) { this.actTarget = null; this._think = 0; }
      else {
        this.tx = beast.x; this.tz = beast.z;
        if (Math.hypot(beast.x - this.x, beast.z - this.z) < COMBAT.RANGE + 0.8) {
          this.action = ACTION.FIGHT;
          beast.health -= COMBAT.DAMAGE * (0.6 + this.skills.forage + Math.max(0, this.build - 1)) * dDays * 6;
          if (beast.health <= 0) {
            beast.alive = false; beast.respawn = sim.FAUNA_RESPAWN;
            if (beast.def.food) this.carrying = { type: 'food', amount: beast.def.food };
            this.remember('battle', 'drove off a wolf', 2);
            this.actTarget = null; this._think = 0;
          }
        }
      }
    } else if (k === 'flee') {
      this.action = ACTION.FLEE;
      if (reached) { this.actTarget = null; this._think = this.rng.range(0.2, 0.4); }
    } else if (k === 'build' && reached) {
      sim.tryBuild(this.actTarget.ref, this);
      this.actTarget = null; this._think = this.rng.range(0.3, 0.6);
    } else if (k === 'eatstore' && reached) {
      if (this.tribe && this.tribe.res.food >= RES.EAT_FROM_STORE) {
        this.tribe.res.food -= RES.EAT_FROM_STORE;
        this.hunger = Math.max(0, this.hunger - NEEDS.EAT_GAIN);
        this.action = ACTION.EAT;
      }
      this.actTarget = null; this._think = this.rng.range(0.2, 0.5);
    } else if (k === 'eatbush' && reached) {
      const bush = this.actTarget.ref;
      let eaten = 0;
      while (bush.berries > 0 && eaten < 2 && this.hunger > 12) {
        bush.berries -= 1; eaten += 1;
        this.hunger = Math.max(0, this.hunger - NEEDS.EAT_GAIN * 0.55);
      }
      this.action = ACTION.EAT; this.actTarget = null; this._think = this.rng.range(0.2, 0.5);
    } else if (k === 'sleep') {
      this.energy = Math.min(100, this.energy + NEEDS.REST_GAIN * dDays * 2.2);
      if (this.energy > 94 && (sim.day % 1) > DAYTIME.DAWN && (sim.day % 1) < DAYTIME.SLEEP) {
        this.actTarget = null; this._think = 0;
      }
    } else if (k === 'being' && reached) {
      const other = this.actTarget.ref;
      if (other.alive) {
        this.social = Math.min(100, this.social + NEEDS.SOCIAL_GAIN);
        other.social = Math.min(100, other.social + NEEDS.SOCIAL_GAIN * 0.6);
        const warmth = 2 + this.traits.kind * 2;
        this.bondWith(other.id, warmth); other.bondWith(this.id, warmth);
        sim.onConverse(this, other);
        if (this.rng.chance(0.04)) this.remember('social', `shared a moment with ${other.name}`, 1);
      }
      this.actTarget = null; this._think = this.rng.range(0.3, 0.7);
    } else if (k === 'mate' && reached) {
      const m = this.actTarget.ref;
      if (m.alive && m.fertile && this.fertile) sim.tryConceive(this, m);
      this.actTarget = null; this._think = this.rng.range(0.4, 0.8);
    } else if (k === 'inspire' && reached) {
      this.insight += 3; sim.addInsight(this, 3);
      this.godAwareness = Math.min(1, this.godAwareness + 0.18);
      this.godMood = Math.min(1, this.godMood + 0.1);
      this.trust = Math.min(1, this.trust + 0.05);
      this.remember('inspire', 'felt a pull toward something, and followed it', 2);
      this.inspiration = null; this.actTarget = null; this._think = 0;
    } else if (k === 'wander' && reached) {
      this.actTarget = null; this._think = 0;
    }
  }

  _skillUp(job) {
    const k = job === 'woodcutter' || job === 'miner' || job === 'builder' ? 'craft'
      : job === 'hunter' ? 'forage' : 'forage';
    this.skills[k] = Math.min(1, (this.skills[k] || 0) + 0.008);
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
