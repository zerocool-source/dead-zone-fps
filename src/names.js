// Procedural naming — a tiny evolving "conlang" feel (§8.2). Seeded for determinism.

const ONSET = ['', 'k', 't', 'm', 'n', 's', 'r', 'l', 'v', 'th', 'sh', 'br', 'dr', 'g', 'p', 'h', 'w', 'y'];
const VOWEL = ['a', 'e', 'i', 'o', 'u', 'a', 'e', 'i', 'ae', 'oo', 'ou'];
const CODA  = ['', '', 'n', 'r', 'l', 's', 'k', 'm', 'th'];

// Per-race phoneme flavors — the younger peoples each carry their own sound.
// Races without a pool fall back to the shared phonemes above.
const RACE_POOLS = {
  duskborn: { // soft dusk/star sounds
    onset: ['', 'l', 'v', 'n', 's', 'sh', 'th', 'm', 'y', 'sel'],
    vowel: ['a', 'e', 'i', 'ae', 'ei', 'ia', 'u'],
    coda:  ['', '', 'l', 'n', 'r', 's', 'th'],
  },
  stormkin: { // hard wind/thunder sounds
    onset: ['k', 'g', 'th', 'dr', 'br', 'gr', 'sk', 'r', 't', 'v'],
    vowel: ['a', 'o', 'u', 'au', 'oa', 'e'],
    coda:  ['k', 'r', 'n', 'g', 'rn', 'sk', ''],
  },
  oreborn: { // stony clipped sounds
    onset: ['d', 'g', 'k', 'b', 't', 'gr', 'kr', 'br', 'm', ''],
    vowel: ['o', 'u', 'a', 'o', 'u'],
    coda:  ['k', 'g', 'm', 't', 'd', 'r', 'n'],
  },
  giltfolk: { // golden regal sounds
    onset: ['', 'c', 'l', 'v', 's', 'm', 'r', 'gl', 'd'],
    vowel: ['a', 'e', 'i', 'o', 'ia', 'ea', 'au'],
    coda:  ['', 'n', 'l', 's', 'r', 'us', 'is'],
  },
};

export function makeName(rng, raceKey) {
  const pool = RACE_POOLS[raceKey];
  const onset = pool ? pool.onset : ONSET;
  const vowel = pool ? pool.vowel : VOWEL;
  const coda = pool ? pool.coda : CODA;
  const syl = rng.int(2, 3);
  let s = '';
  for (let i = 0; i < syl; i++) {
    s += rng.pick(onset) + rng.pick(vowel) + (i === syl - 1 ? rng.pick(coda) : '');
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Culture/tribe names lean on a fixed grand register.
const TRIBE_A = ['Sun', 'River', 'Stone', 'Ash', 'Dawn', 'Cinder', 'Salt', 'Reed', 'Elder', 'Hollow'];
const TRIBE_B = ['folk', 'kin', 'born', 'walkers', 'children', 'people', 'tribe', 'wardens'];

export function makeTribeName(rng) {
  return `${rng.pick(TRIBE_A)}${rng.pick(TRIBE_B)}`;
}
