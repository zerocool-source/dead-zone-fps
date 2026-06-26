// The Chronicle — the auto-generated history of your world (§6 meta tools).
export class Chronicle {
  constructor() { this.events = []; this.listeners = []; }

  add(day, year, icon, text, kind = 'event') {
    const e = { day, year, icon, text, kind, t: this.events.length };
    this.events.push(e);
    if (this.events.length > 400) this.events.shift();
    for (const l of this.listeners) l(e);
    return e;
  }
  onAdd(fn) { this.listeners.push(fn); }
  recent(n = 40) { return this.events.slice(-n).reverse(); }
}
