// Deterministic, seedable PRNG so a world can be reproduced/forked (Genesis Seed §3.1).

export class RNG {
  constructor(seed = 1) {
    // mulberry32
    this.s = seed >>> 0;
  }
  next() {
    this.s |= 0; this.s = (this.s + 0x6D2B79F5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  // gaussian-ish via central limit
  gauss(mean = 0, sd = 1) {
    let s = 0; for (let i = 0; i < 4; i++) s += this.next();
    return mean + (s - 2) / 0.816 * sd;
  }
}

export function hashStringToSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
