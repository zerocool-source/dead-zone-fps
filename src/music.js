// Music system — plays the game's soundtrack by state with crossfades.
// States: TITLE (menu), DAY, NIGHT, WAR (fighting near your world).
// Tracks live in public/music/. Browser autoplay rules mean nothing sounds
// until the first user gesture — unlock() is called from the menu click.
const TRACKS = {
  title: '/music/title.mp3',
  day: ['/music/day.mp3', '/music/day2.mp3'], // rotates each daybreak
  night: '/music/night.mp3',
  war: '/music/war.mp3',
};

const FADE_S = 2.2;

export class Music {
  constructor() {
    this.enabled = true;
    this.volume = +(localStorage.getItem('aeon_music_vol') ?? 0.7);
    this.players = new Map();   // src -> HTMLAudioElement
    this.current = null;        // src currently ramping to full
    this.state = null;
    this.dayIx = 0;
    this.unlocked = false;
  }

  _get(src) {
    let a = this.players.get(src);
    if (!a) {
      a = new Audio(src);
      a.loop = true;
      a.volume = 0;
      a.preload = 'auto';
      this.players.set(src, a);
    }
    return a;
  }

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.state) this._play(this._srcFor(this.state));
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    localStorage.setItem('aeon_music_vol', String(this.volume));
    if (this.current) { const a = this.players.get(this.current); if (a) a.volume = this.volume; }
  }

  _srcFor(state) {
    const t = TRACKS[state];
    if (Array.isArray(t)) return t[this.dayIx % t.length];
    return t;
  }

  setState(state) {
    if (state === this.state) return;
    if (state === 'day' && this.state) this.dayIx++;   // rotate day tracks
    this.state = state;
    if (!this.unlocked) return;
    this._play(this._srcFor(state));
  }

  _play(src) {
    if (src === this.current) return;
    const prev = this.current ? this.players.get(this.current) : null;
    const next = this._get(src);
    this.current = src;
    next.currentTime = 0;
    next.play().catch(() => {});
    // crossfade
    const steps = 24, dt = (FADE_S * 1000) / steps;
    let i = 0;
    const startPrev = prev ? prev.volume : 0;
    clearInterval(this._fadeTimer);
    this._fadeTimer = setInterval(() => {
      i++;
      const t = i / steps;
      next.volume = this.volume * t;
      if (prev) prev.volume = startPrev * (1 - t);
      if (i >= steps) {
        clearInterval(this._fadeTimer);
        if (prev && prev !== next) prev.pause();
      }
    }, dt);
  }

  // called every frame with the sim — decides day/night/war
  update(sim, inMenu) {
    if (inMenu) { this.setState('title'); return; }
    const fighting = sim.beings.some((b) => b.action === 'fighting');
    if (fighting) { this.setState('war'); return; }
    const f = sim.day % 1;
    this.setState(f >= 0.8 || f < 0.22 ? 'night' : 'day');
  }
}
