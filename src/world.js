// Procedural island: value-noise heightmap + radial falloff, biomes, and resources
// (food bushes, harvestable trees for wood, rock clusters for stone).
import { WORLD, FOOD } from './config.js';

export const BIOME = {
  OCEAN: 0, BEACH: 1, GRASS: 2, FOREST: 3, ROCK: 4, SNOW: 5,
};

export class World {
  constructor(rng) {
    this.rng = rng;
    this.size = WORLD.SIZE;
    this.seg = WORLD.SEG;
    this.h = new Float32Array((this.seg + 1) * (this.seg + 1)); // heights
    this.biome = new Uint8Array((this.seg + 1) * (this.seg + 1));
    this.bushes = [];
    this.trees = [];     // {x,z,y, wood, max, regrow}
    this.rocks = [];     // {x,z,y, stone, max, regrow}
    this._gen();
    this._scatterFood();
    this._scatterTrees();
    this._scatterRocks();
  }

  idx(ix, iy) { return iy * (this.seg + 1) + ix; }

  // --- value noise ---
  _noiseField(freq, seedOff) {
    const g = freq + 1;
    const grid = new Float32Array(g * g);
    for (let i = 0; i < grid.length; i++) grid[i] = this.rng.next();
    const smooth = (t) => t * t * (3 - 2 * t);
    return (nx, ny) => {
      const x = nx * freq, y = ny * freq;
      const x0 = Math.floor(x), y0 = Math.floor(y);
      const fx = smooth(x - x0), fy = smooth(y - y0);
      const x1 = Math.min(x0 + 1, freq), y1 = Math.min(y0 + 1, freq);
      const a = grid[y0 * g + x0], b = grid[y0 * g + x1];
      const c = grid[y1 * g + x0], d = grid[y1 * g + x1];
      return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    };
  }

  _gen() {
    const oct = [this._noiseField(4, 1), this._noiseField(9, 2), this._noiseField(18, 3), this._noiseField(34, 4)];
    const amp = [1.0, 0.5, 0.26, 0.13];
    const n = this.seg;
    for (let iy = 0; iy <= n; iy++) {
      for (let ix = 0; ix <= n; ix++) {
        const nx = ix / n, ny = iy / n;
        let e = 0, sum = 0;
        for (let o = 0; o < oct.length; o++) { e += oct[o](nx, ny) * amp[o]; sum += amp[o]; }
        e /= sum;
        // radial island falloff
        const dx = nx - 0.5, dy = ny - 0.5;
        const d = Math.sqrt(dx * dx + dy * dy) * 2; // 0 center .. ~1.41 corner
        const fall = Math.pow(Math.max(0, 1 - d * 0.95), WORLD.ISLAND_FALLOFF);
        e = e * fall - (1 - fall) * 0.35;
        const height = e * WORLD.MAX_HEIGHT;
        const id = this.idx(ix, iy);
        this.h[id] = height;
        this.biome[id] = this._biomeFor(height, ny);
      }
    }
  }

  _biomeFor(height, ny) {
    if (height <= WORLD.SEA_LEVEL) return BIOME.OCEAN;
    if (height < 0.5) return BIOME.BEACH;
    if (height < 6) return (this.rng.next() < 0.42 ? BIOME.FOREST : BIOME.GRASS);
    if (height < 11) return BIOME.ROCK;
    return BIOME.SNOW;
  }

  // world (x,z) in [-size/2, size/2] -> height (bilinear)
  heightAt(x, z) {
    const n = this.seg;
    const u = (x / this.size + 0.5) * n;
    const v = (z / this.size + 0.5) * n;
    const ix = Math.max(0, Math.min(n - 1, Math.floor(u)));
    const iy = Math.max(0, Math.min(n - 1, Math.floor(v)));
    const fx = u - ix, fy = v - iy;
    const a = this.h[this.idx(ix, iy)], b = this.h[this.idx(ix + 1, iy)];
    const c = this.h[this.idx(ix, iy + 1)], d = this.h[this.idx(ix + 1, iy + 1)];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }

  biomeAt(x, z) {
    const n = this.seg;
    const ix = Math.max(0, Math.min(n, Math.round((x / this.size + 0.5) * n)));
    const iy = Math.max(0, Math.min(n, Math.round((z / this.size + 0.5) * n)));
    return this.biome[this.idx(ix, iy)];
  }

  isLand(x, z) { return this.heightAt(x, z) > WORLD.SEA_LEVEL + 0.05; }

  // mutate terrain (god terraform). Returns true if changed.
  raise(x, z, radius, delta) {
    const n = this.seg, changed = [];
    const cu = (x / this.size + 0.5) * n, cv = (z / this.size + 0.5) * n;
    const r = radius / this.size * n;
    for (let iy = Math.max(0, Math.floor(cv - r)); iy <= Math.min(n, Math.ceil(cv + r)); iy++) {
      for (let ix = Math.max(0, Math.floor(cu - r)); ix <= Math.min(n, Math.ceil(cu + r)); ix++) {
        const dd = Math.hypot(ix - cu, iy - cv);
        if (dd > r) continue;
        const fall = Math.pow(1 - dd / r, 2);
        const id = this.idx(ix, iy);
        this.h[id] += delta * fall;
        const ny = iy / n;
        this.biome[id] = this._biomeFor(this.h[id], ny);
        changed.push(id);
      }
    }
    return changed;
  }

  _scatterFood() {
    let tries = 0;
    while (this.bushes.length < FOOD.BUSH_COUNT && tries < FOOD.BUSH_COUNT * 30) {
      tries++;
      const x = this.rng.range(-this.size / 2, this.size / 2);
      const z = this.rng.range(-this.size / 2, this.size / 2);
      const b = this.biomeAt(x, z);
      if (b === BIOME.GRASS || b === BIOME.FOREST) {
        this.bushes.push({
          x, z, y: this.heightAt(x, z),
          berries: this.rng.int(2, FOOD.BUSH_MAX),
          max: FOOD.BUSH_MAX, regrow: 0,
        });
      }
    }
  }

  _scatterTrees() {
    const n = this.seg;
    for (let iy = 0; iy < n; iy += 2) {
      for (let ix = 0; ix < n; ix += 2) {
        const id = this.idx(ix, iy);
        if (this.biome[id] === BIOME.FOREST && this.rng.chance(0.16)) {
          const x = (ix / n - 0.5) * this.size, z = (iy / n - 0.5) * this.size;
          this.trees.push({ x, z, y: this.h[id], wood: 8, max: 8, regrow: 0, s: this.rng.range(0.75, 1.35) });
        }
      }
    }
  }

  _scatterRocks() {
    const n = this.seg;
    for (let iy = 0; iy < n; iy += 3) {
      for (let ix = 0; ix < n; ix += 3) {
        const id = this.idx(ix, iy);
        const bm = this.biome[id];
        if ((bm === BIOME.ROCK || bm === BIOME.GRASS) && this.rng.chance(bm === BIOME.ROCK ? 0.08 : 0.02)) {
          const x = (ix / n - 0.5) * this.size, z = (iy / n - 0.5) * this.size;
          this.rocks.push({ x, z, y: this.h[id], stone: 10, max: 10, regrow: 0, s: this.rng.range(0.6, 1.6) });
        }
      }
    }
  }

  // a reasonable spawn cluster: pick a grassy lowland near water
  spawnPoint(rng) {
    for (let i = 0; i < 400; i++) {
      const x = rng.range(-this.size * 0.34, this.size * 0.34);
      const z = rng.range(-this.size * 0.34, this.size * 0.34);
      const h = this.heightAt(x, z);
      if (h > 0.4 && h < 4) return { x, z };
    }
    return { x: 0, z: 0 };
  }

  // find a habitable spot favouring a race's preferred biome, away from `avoid` points
  spawnInBiome(rng, biomeName, avoid = [], minDist = 70) {
    const want = { grass: BIOME.GRASS, beach: BIOME.BEACH, forest: BIOME.FOREST, rock: BIOME.ROCK }[biomeName];
    let fallback = null;
    for (let i = 0; i < 1200; i++) {
      const x = rng.range(-this.size * 0.4, this.size * 0.4);
      const z = rng.range(-this.size * 0.4, this.size * 0.4);
      const h = this.heightAt(x, z);
      if (h <= 0.35 || h > 7) continue;                  // habitable land only
      if (avoid.some(p => Math.hypot(p.x - x, p.z - z) < minDist)) continue;
      if (!fallback) fallback = { x, z };
      if (this.biomeAt(x, z) === want) return { x, z };
    }
    return fallback || this.spawnPoint(rng);
  }
}
