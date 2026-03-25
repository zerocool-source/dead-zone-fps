/**
 * Procedural sound effects using Web Audio API.
 * Enhanced with heavier gunshots, meatier impacts, ambient drone, and footsteps.
 */

let ctx = null;
let ambientGain = null;
let ambientStarted = false;
let masterGainNode = null;

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGainNode = ctx.createGain();
    masterGainNode.gain.value = 0.7;
    masterGainNode.connect(ctx.destination);
  }
  return ctx;
}

/** Get master output node (use instead of ctx.destination) */
function getMaster() {
  getCtx();
  return masterGainNode;
}

/** Set master volume 0-1 */
export function setMasterVolume(vol) {
  getCtx();
  if (masterGainNode) {
    masterGainNode.gain.value = Math.max(0, Math.min(1, vol));
  }
}

let musicElement = null;

export function resumeAudio() {
  const c = getCtx();
  if (c.state === "suspended") c.resume();
  startAmbient();
  startMusic();
}

// Soundtrack playlist
const SOUNDTRACK = [
  { src: "/music_dead_sector.mp3", name: "Dead Sector Descent" },
  { src: "/music_grave_circuit.mp3", name: "Grave Circuit Ascent" },
  { src: "/music_graveyard.mp3", name: "Graveyard Checkpoint" },
  { src: "/music_rotten.mp4", name: "Rotten Run Cycle" },
  { src: "/music.mp3", name: "Original Theme" },
];
let currentTrackIndex = 0;

/** Start looping soundtrack */
function startMusic() {
  if (musicElement) return;
  musicElement = new Audio(SOUNDTRACK[currentTrackIndex].src);
  musicElement.loop = false; // play through playlist
  musicElement.volume = 0.35;
  musicElement.addEventListener("ended", () => {
    // Next track
    currentTrackIndex = (currentTrackIndex + 1) % SOUNDTRACK.length;
    musicElement.src = SOUNDTRACK[currentTrackIndex].src;
    musicElement.play().catch(() => {});
  });
  musicElement.play().catch(() => {});
}

/** Get current track name */
export function getCurrentTrackName() {
  return SOUNDTRACK[currentTrackIndex].name;
}

/** Skip to next track */
export function nextTrack() {
  if (!musicElement) return;
  currentTrackIndex = (currentTrackIndex + 1) % SOUNDTRACK.length;
  musicElement.src = SOUNDTRACK[currentTrackIndex].src;
  musicElement.play().catch(() => {});
  return SOUNDTRACK[currentTrackIndex].name;
}

/** Set music volume (separate from SFX) */
export function setMusicVolume(vol) {
  if (musicElement) musicElement.volume = Math.max(0, Math.min(1, vol));
}

/** Gunshot sound — uses real MP3 file */
let _gunshotBuffer = null;
let _gunshotLoading = false;

// Preload gunshot MP3
function _preloadGunshot() {
  if (_gunshotBuffer || _gunshotLoading) return;
  _gunshotLoading = true;
  fetch("/gunshot.mp3")
    .then((r) => r.arrayBuffer())
    .then((buf) => getCtx().decodeAudioData(buf))
    .then((decoded) => {
      _gunshotBuffer = decoded;
    })
    .catch(() => {
      _gunshotLoading = false;
    });
}

export function playGunshot() {
  const c = getCtx();
  _preloadGunshot();

  if (_gunshotBuffer) {
    // Play the real gunshot MP3
    const source = c.createBufferSource();
    source.buffer = _gunshotBuffer;

    const gain = c.createGain();
    gain.gain.value = 0.7;

    source.connect(gain).connect(getMaster());
    source.start(0);
  } else {
    // Fallback: quick procedural shot while MP3 loads
    const now = c.currentTime;
    const bufferSize = c.sampleRate * 0.08;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2.5);
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    noise.connect(gain).connect(getMaster());
    noise.start(now);
    noise.stop(now + 0.08);
  }
}

/** Reload click-clack */
export function playReload() {
  const c = getCtx();
  const now = c.currentTime;

  playClick(c, now, 800, 0.05, 0.3);
  playClick(c, now + 0.3, 600, 0.04, 0.25);
  playClick(c, now + 0.8, 1200, 0.06, 0.2);
}

function playClick(c, time, freq, dur, vol) {
  const bufSize = c.sampleRate * dur;
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 8);
  }
  const src = c.createBufferSource();
  src.buffer = buf;

  const filt = c.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.value = freq;
  filt.Q.value = 5;

  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

  src.connect(filt).connect(gain).connect(getMaster());
  src.start(time);
  src.stop(time + dur);
}

/** Zombie hit — meatier impact with squelch */
export function playZombieHit() {
  const c = getCtx();
  const now = c.currentTime;

  // Impact thud
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(250, now);
  osc.frequency.exponentialRampToValueAtTime(50, now + 0.12);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  osc.connect(gain).connect(getMaster());
  osc.start(now);
  osc.stop(now + 0.18);

  // Squelch noise
  const sqBuf = c.createBuffer(1, c.sampleRate * 0.06, c.sampleRate);
  const sqData = sqBuf.getChannelData(0);
  for (let i = 0; i < sqData.length; i++) {
    sqData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / sqData.length, 4);
  }
  const sqSrc = c.createBufferSource();
  sqSrc.buffer = sqBuf;
  const sqFilt = c.createBiquadFilter();
  sqFilt.type = "bandpass";
  sqFilt.frequency.value = 400;
  sqFilt.Q.value = 2;
  const sqGain = c.createGain();
  sqGain.gain.setValueAtTime(0.15, now);
  sqGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  sqSrc.connect(sqFilt).connect(sqGain).connect(getMaster());
  sqSrc.start(now);
  sqSrc.stop(now + 0.06);
}

/** Zombie death groan — longer with pitch variation */
export function playZombieDeath() {
  const c = getCtx();
  const now = c.currentTime;

  const baseFreq = 90 + Math.random() * 50;

  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.6);

  const filt = c.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = 500;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  osc.connect(filt).connect(gain).connect(getMaster());
  osc.start(now);
  osc.stop(now + 0.6);

  // Secondary harmonic
  const osc2 = c.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(baseFreq * 0.5, now);
  osc2.frequency.exponentialRampToValueAtTime(20, now + 0.5);
  const gain2 = c.createGain();
  gain2.gain.setValueAtTime(0.1, now + 0.05);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc2.connect(gain2).connect(getMaster());
  osc2.start(now + 0.05);
  osc2.stop(now + 0.5);
}

/** Player hurt sound */
export function playHurt() {
  const c = getCtx();
  const now = c.currentTime;

  const bufSize = c.sampleRate * 0.15;
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 2);
  }
  const src = c.createBufferSource();
  src.buffer = buf;

  const filt = c.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = 800;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  src.connect(filt).connect(gain).connect(getMaster());
  src.start(now);
  src.stop(now + 0.15);
}

/** Empty gun click */
export function playEmpty() {
  const c = getCtx();
  const now = c.currentTime;
  playClick(c, now, 2000, 0.03, 0.2);
}

/** Procedural footstep — triggered by head bob cycle */
export function playFootstep(isSprinting) {
  const c = getCtx();
  const now = c.currentTime;

  const freq = 100 + Math.random() * 60;
  const dur = 0.04 + Math.random() * 0.02;
  const vol = isSprinting ? 0.12 : 0.07;

  const bufSize = c.sampleRate * dur;
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 6);
  }
  const src = c.createBufferSource();
  src.buffer = buf;

  const filt = c.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = freq;

  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  src.connect(filt).connect(gain).connect(getMaster());
  src.start(now);
  src.stop(now + dur);
}

/** Door open sound */
export function playDoorOpen() {
  const c = getCtx();
  const now = c.currentTime;

  // Heavy metallic scrape
  const bufSize = c.sampleRate * 0.6;
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.5) * 0.5;
  }
  const src = c.createBufferSource();
  src.buffer = buf;

  const filt = c.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.setValueAtTime(300, now);
  filt.frequency.linearRampToValueAtTime(150, now + 0.6);
  filt.Q.value = 3;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  src.connect(filt).connect(gain).connect(getMaster());
  src.start(now);
  src.stop(now + 0.6);
}

/** Start looping ambient drone */
function startAmbient() {
  if (ambientStarted) return;
  ambientStarted = true;

  const c = getCtx();

  ambientGain = c.createGain();
  ambientGain.gain.value = 0.06;
  ambientGain.connect(getMaster());

  // Low drone
  const drone = c.createOscillator();
  drone.type = "sine";
  drone.frequency.value = 40;
  const droneGain = c.createGain();
  droneGain.gain.value = 0.04;
  drone.connect(droneGain).connect(ambientGain);
  drone.start();

  // Wind-like noise
  const windBuf = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
  const windData = windBuf.getChannelData(0);
  for (let i = 0; i < windData.length; i++) {
    windData[i] = (Math.random() * 2 - 1) * 0.3;
  }
  const windSrc = c.createBufferSource();
  windSrc.buffer = windBuf;
  windSrc.loop = true;

  const windFilt = c.createBiquadFilter();
  windFilt.type = "lowpass";
  windFilt.frequency.value = 200;

  const windGain = c.createGain();
  windGain.gain.value = 0.03;

  windSrc.connect(windFilt).connect(windGain).connect(ambientGain);
  windSrc.start();

  // Subtle heartbeat pulse
  const heartbeat = c.createOscillator();
  heartbeat.type = "sine";
  heartbeat.frequency.value = 1.2; // ~72 BPM
  const heartGain = c.createGain();
  heartGain.gain.value = 0;
  heartbeat.connect(heartGain).connect(ambientGain);
  heartbeat.start();

  // Modulate drone volume with heartbeat for subtle pulse
  const lfo = c.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.08; // very slow
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.015;
  lfo.connect(lfoGain).connect(droneGain.gain);
  lfo.start();
}
