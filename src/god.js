// The God layer — your faith economy and powers (§6). You influence; you rarely command.
import { GOD } from './config.js';

export class God {
  constructor(sim) {
    this.sim = sim;
    this.faith = GOD.FAITH_START;
    this.disposition = 0; // running tally of how the world sees you (-1 tyrant .. +1 gardener)
    this.miracles = 0;
  }

  // passive faith from believers
  tick(dDays) {
    const believers = this.sim.believers();
    this.faith = Math.min(GOD.FAITH_MAX, this.faith + believers * GOD.FAITH_PER_BELIEVER_DAY * dDays);
  }

  can(cost) { return this.faith >= cost; }
  _spend(c) { this.faith = Math.max(0, this.faith - c); }

  // INSPIRE — plant an urge in one being to move toward a point/curiosity.
  inspire(being, x, z) {
    if (!this.can(GOD.COST_INSPIRE) || !being.alive) return false;
    this._spend(GOD.COST_INSPIRE);
    being.inspiration = { kind: 'seek', x, z, ttl: 4 };
    being.godAwareness = Math.min(1, being.godAwareness + 0.08);
    this.disposition += 0.01;
    this.sim.chronicle.add(this.sim.day, this.sim.year, '✨',
      `You whisper to ${being.name}, and they feel a strange pull.`, 'god');
    return true;
  }

  // BLESS — grant fertility/food and heal nearby beings; raises devotion.
  bless(x, z) {
    if (!this.can(GOD.COST_BLESS)) return false;
    this._spend(GOD.COST_BLESS);
    this.miracles++;
    // replenish bushes in radius, spawn a couple new ones
    for (const bush of this.sim.world.bushes) {
      if (Math.hypot(bush.x - x, bush.z - z) < GOD.BLESS_RADIUS) bush.berries = bush.max;
    }
    let touched = 0;
    for (const b of this.sim.beings) {
      if (Math.hypot(b.x - x, b.z - z) < GOD.BLESS_RADIUS) {
        b.hunger = Math.max(0, b.hunger - 50);
        b.energy = Math.min(100, b.energy + 30);
        b.godAwareness = Math.min(1, b.godAwareness + 0.25);
        b.godMood = Math.min(1, b.godMood + 0.25);
        b.trust = Math.min(1, b.trust + 0.06);
        b.remember('miracle', 'was touched by a warm light from the sky', 4);
        touched++;
      }
    }
    this.disposition += 0.04;
    this.sim.chronicle.add(this.sim.day, this.sim.year, '🌟',
      `A blessing falls upon the land. ${touched} of the ${this.sim.tribeName} feel your grace.`, 'god');
    return true;
  }

  // SMITE — terror and ruin; reshapes belief into fear. Costs more, costs goodwill.
  smite(x, z) {
    if (!this.can(GOD.COST_SMITE)) return false;
    this._spend(GOD.COST_SMITE);
    this.miracles++;
    let killed = 0, scared = 0;
    for (const b of this.sim.beings) {
      const d = Math.hypot(b.x - x, b.z - z);
      if (d < GOD.SMITE_RADIUS) {
        b.godAwareness = Math.min(1, b.godAwareness + 0.4);
        b.godMood = Math.max(-1, b.godMood - 0.5);
        b.trust = Math.max(0, b.trust - 0.1);
        b.remember('wrath', 'witnessed the sky turn to fire', 5);
        scared++;
        if (d < GOD.SMITE_RADIUS * 0.5 && this.sim.rng.chance(0.5)) { b.die('the wrath of the sky', this.sim); killed++; }
      }
    }
    this.disposition -= 0.06;
    this.sim.chronicle.add(this.sim.day, this.sim.year, '🔥',
      `Fire rains from the heavens. ${killed ? killed + ' perish; ' : ''}${scared} are struck with terror.`, 'god');
    return true;
  }

  get title() {
    if (this.miracles === 0) return 'The Silent One';
    if (this.disposition > 0.4) return 'The Gardener';
    if (this.disposition < -0.4) return 'The Vengeful';
    if (this.disposition < -0.1) return 'The Trickster';
    return 'The Watcher';
  }
}
