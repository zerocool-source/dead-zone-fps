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

/** Start looping theme music */
function startMusic() {
  if (musicElement) return;
  musicElement = new Audio("/music.mp3");
  musicElement.loop = true;
  musicElement.volume = 0.3;
  musicElement.play().catch(() => {});
}

/** Set music volume (separate from SFX) */
export function setMusicVolume(vol) {
  if (musicElement) musicElement.volume = Math.max(0, Math.min(1, vol));
}

/** Heavy punchy gunshot — deeper bass, louder crack, distortion */
export function playGunshot() {
  const c = getCtx();
  const now = c.currentTime;

  // Noise burst for the crack (louder, longer)
  const bufferSize = c.sampleRate * 0.12;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2.5);
  }

  const noise = c.createBufferSource();
  noise.buffer = buffer;

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(4000, now);
  filter.frequency.exponentialRampToValueAtTime(200, now + 0.12);

  // Waveshaper for distortion crunch
  const distortion = c.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = i / 128 - 1;
    curve[i] = ((Math.PI + 4) * x) / (Math.PI + 4 * Math.abs(x));
  }
  distortion.curve = curve;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.8, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  noise.connect(filter).connect(distortion).connect(gain).connect(getMaster());
  noise.start(now);
  noise.stop(now + 0.15);

  // Deep bass thump (heavier)
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);

  const oscGain = c.createGain();
  oscGain.gain.setValueAtTime(0.6, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(oscGain).connect(getMaster());
  osc.start(now);
  osc.stop(now + 0.15);

  // High-frequency snap (mechanical click)
  const snap = c.createOscillator();
  snap.type = "square";
  snap.frequency.setValueAtTime(2000, now);
  snap.frequency.exponentialRampToValueAtTime(800, now + 0.02);

  const snapGain = c.createGain();
  snapGain.gain.setValueAtTime(0.15, now);
  snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

  snap.connect(snapGain).connect(getMaster());
  snap.start(now);
  snap.stop(now + 0.03);
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
