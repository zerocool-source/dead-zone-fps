/**
 * Perk machine system.
 * Players can buy permanent upgrades for the current run.
 */

export const PERK_DEFS = {
  quick_hands: {
    id: 'quick_hands',
    name: 'Quick Hands',
    description: 'Faster reload speed',
    cost: 2000,
    color: 0x00aaff,
    effect: { reloadMult: 0.6 },
  },
  steel_nerves: {
    id: 'steel_nerves',
    name: 'Steel Nerves',
    description: 'More max health (+50)',
    cost: 2500,
    color: 0xff4444,
    effect: { healthBonus: 50 },
  },
  marathon: {
    id: 'marathon',
    name: 'Marathon',
    description: 'Faster sprint speed',
    cost: 1500,
    color: 0xffaa00,
    effect: { sprintMult: 1.35 },
  },
  deadeye: {
    id: 'deadeye',
    name: 'Deadeye',
    description: 'Tighter weapon spread',
    cost: 3000,
    color: 0x44ff44,
    effect: { spreadMult: 0.5 },
  },
};

export class PerkManager {
  constructor() {
    this.ownedPerks = new Set();
  }

  hasPerk(perkId) {
    return this.ownedPerks.has(perkId);
  }

  buyPerk(perkId) {
    if (this.ownedPerks.has(perkId)) return false;
    this.ownedPerks.add(perkId);
    return true;
  }

  /** Get cumulative effect value */
  getEffect(effectKey, defaultValue = 1) {
    for (const perkId of this.ownedPerks) {
      const perk = PERK_DEFS[perkId];
      if (perk && perk.effect[effectKey] !== undefined) {
        return perk.effect[effectKey];
      }
    }
    return defaultValue;
  }

  get ownedList() {
    return [...this.ownedPerks].map(id => PERK_DEFS[id]).filter(Boolean);
  }
}
