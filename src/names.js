// Procedural naming — a tiny evolving "conlang" feel (§8.2). Seeded for determinism.

const ONSET = ['', 'k', 't', 'm', 'n', 's', 'r', 'l', 'v', 'th', 'sh', 'br', 'dr', 'g', 'p', 'h', 'w', 'y'];
const VOWEL = ['a', 'e', 'i', 'o', 'u', 'a', 'e', 'i', 'ae', 'oo', 'ou'];
const CODA  = ['', '', 'n', 'r', 'l', 's', 'k', 'm', 'th'];

export function makeName(rng) {
  const syl = rng.int(2, 3);
  let s = '';
  for (let i = 0; i < syl; i++) {
    s += rng.pick(ONSET) + rng.pick(VOWEL) + (i === syl - 1 ? rng.pick(CODA) : '');
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Culture/tribe names lean on a fixed grand register.
const TRIBE_A = ['Sun', 'River', 'Stone', 'Ash', 'Dawn', 'Cinder', 'Salt', 'Reed', 'Elder', 'Hollow'];
const TRIBE_B = ['folk', 'kin', 'born', 'walkers', 'children', 'people', 'tribe', 'wardens'];

export function makeTribeName(rng) {
  return `${rng.pick(TRIBE_A)}${rng.pick(TRIBE_B)}`;
}
