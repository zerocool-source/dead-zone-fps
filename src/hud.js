// HUD — all on-screen UI. Builds DOM into #ui-root, reflects sim/god state, and emits
// tool changes. Keeps the "beings & their minds" focus: a rich inspector for one being.
import { TIME_SCALES, TIME_LABELS, GOD, LIFE, eraOf } from './config.js';

const TOOLS = [
  { id: 'inspect', icon: '🔍', name: 'Observe', cost: 0, hint: 'Click a being to read their mind.' },
  { id: 'inspire', icon: '✨', name: 'Inspire', cost: GOD.COST_INSPIRE, hint: 'Click a being, then a place — plant an urge.' },
  { id: 'bless',   icon: '🌟', name: 'Bless',   cost: GOD.COST_BLESS, hint: 'Click the land — food, healing, devotion.' },
  { id: 'smite',   icon: '🔥', name: 'Smite',   cost: GOD.COST_SMITE, hint: 'Click the land — fire and terror.' },
  { id: 'shape',   icon: '⛰️', name: 'Shape Land', cost: GOD.COST_SHAPE, hint: 'Click to raise the land — hold Shift to lower it.' },
  { id: 'possess', icon: '👁', name: 'Possess', cost: 0, hint: 'Click a being — walk beside their life.' },
];

export class HUD {
  constructor(sim, god) {
    this.sim = sim; this.god = god;
    this.tool = 'inspect';
    this.onTool = () => {};
    this.onSpeed = () => {};
    this.onUnpossess = () => {};
    this.selected = null;
    this._build();
  }

  _el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  _build() {
    const root = document.getElementById('ui-root');
    root.innerHTML = '';

    // ---- top bar ----
    const top = this._el('div', 'panel pointer');
    top.style.cssText += 'position:absolute;top:14px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:14px;padding:8px 16px;';
    const speedBtns = TIME_SCALES.map((s, i) =>
      `<button data-sp="${i}" class="sp" style="background:none;border:1px solid var(--panel-edge);color:var(--text);
        border-radius:4px;padding:5px 9px;cursor:pointer;font-size:12px;font-family:inherit;">${TIME_LABELS[i].split(' ')[0]}</button>`
    ).join('');
    top.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;min-width:96px;">
        <div style="color:var(--gold);font-size:18px;font-weight:700;letter-spacing:1px;" id="hud-year">Year 0</div>
        <div style="color:var(--text-dim);font-size:10px;letter-spacing:1px;" id="hud-speed">Lived time</div>
      </div>
      <div style="display:flex;gap:5px;">${speedBtns}</div>
      <div style="width:1px;height:30px;background:var(--panel-edge);"></div>
      <div style="display:flex;flex-direction:column;align-items:center;min-width:70px;">
        <div style="color:var(--text);font-size:16px;font-weight:600;" id="hud-pop">0</div>
        <div style="color:var(--text-dim);font-size:10px;">souls</div>
      </div>
      <div style="width:1px;height:30px;background:var(--panel-edge);"></div>
      <div style="display:flex;gap:12px;font-size:13px;">
        <span title="Food">🍖 <b id="res-food" style="color:#e0b070;">0</b></span>
        <span title="Wood">🪵 <b id="res-wood" style="color:#c89060;">0</b></span>
        <span title="Stone">🪨 <b id="res-stone" style="color:#b0b4bc;">0</b></span>
      </div>`;
    root.appendChild(top);
    top.querySelectorAll('.sp').forEach(btn =>
      btn.addEventListener('click', () => this.onSpeed(+btn.dataset.sp)));
    this.elYear = top.querySelector('#hud-year');
    this.elSpeed = top.querySelector('#hud-speed');
    this.elPop = top.querySelector('#hud-pop');
    this.elFood = top.querySelector('#res-food');
    this.elWood = top.querySelector('#res-wood');
    this.elStone = top.querySelector('#res-stone');
    this.speedBtns = top.querySelectorAll('.sp');

    // ---- god / faith (top-left) ----
    const gp = this._el('div', 'panel');
    gp.style.cssText += 'position:absolute;top:14px;left:14px;padding:10px 14px;min-width:180px;';
    gp.innerHTML = `
      <div style="color:var(--gold);font-size:13px;letter-spacing:3px;font-weight:700;">AEON</div>
      <div style="color:var(--text-dim);font-size:10px;letter-spacing:2px;margin-bottom:8px;" id="god-title">THE SILENT ONE</div>
      <div style="color:var(--gold-dim);font-size:10px;letter-spacing:1px;">FAITH</div>
      <div style="height:8px;background:rgba(255,255,255,0.08);border-radius:4px;margin-top:3px;overflow:hidden;">
        <div id="faith-fill" style="height:100%;width:0%;background:linear-gradient(90deg,var(--gold-dim),var(--gold));transition:width .3s;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:3px;">
        <span id="faith-val" style="color:var(--text);font-size:11px;">0</span>
        <span id="believers" style="color:var(--text-dim);font-size:10px;">0 believers</span>
      </div>`;
    root.appendChild(gp);
    this.elGodTitle = gp.querySelector('#god-title');
    this.elFaithFill = gp.querySelector('#faith-fill');
    this.elFaithVal = gp.querySelector('#faith-val');
    this.elBelievers = gp.querySelector('#believers');

    // ---- power palette (left) ----
    const pal = this._el('div', 'panel pointer');
    pal.style.cssText += 'position:absolute;left:14px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:6px;padding:8px;';
    TOOLS.forEach(t => {
      const b = this._el('button', 'tool');
      b.dataset.tool = t.id;
      b.style.cssText = 'display:flex;align-items:center;gap:8px;background:none;border:1px solid transparent;color:var(--text);border-radius:5px;padding:7px 10px;cursor:pointer;font-family:inherit;width:128px;text-align:left;transition:.15s;';
      b.innerHTML = `<span style="font-size:18px;">${t.icon}</span>
        <span style="display:flex;flex-direction:column;line-height:1.15;">
          <span style="font-size:12px;">${t.name}</span>
          <span style="font-size:9px;color:var(--text-dim);">${t.cost ? t.cost + ' faith' : 'free'}</span>
        </span>`;
      b.addEventListener('click', () => this.setTool(t.id));
      b.addEventListener('mouseenter', () => this._flash(t.hint));
      pal.appendChild(b);
    });
    root.appendChild(pal);
    this.toolBtns = pal.querySelectorAll('.tool');

    // ---- hint line (bottom-center) ----
    this.elHint = this._el('div', 'panel');
    this.elHint.style.cssText += 'position:absolute;bottom:14px;left:50%;transform:translateX(-50%);padding:7px 16px;font-size:12px;color:var(--text-dim);letter-spacing:1px;';
    this.elHint.textContent = 'Observe your world. Select a being to read their mind.';
    root.appendChild(this.elHint);

    // ---- inspector (right) ----
    this.inspector = this._el('div', 'panel pointer');
    this.inspector.style.cssText += 'position:absolute;right:14px;top:14px;width:280px;max-height:calc(100vh - 200px);overflow-y:auto;padding:0;display:none;';
    root.appendChild(this.inspector);

    // ---- chronicle (bottom-right) ----
    this.chron = this._el('div', 'panel pointer');
    this.chron.style.cssText += 'position:absolute;right:14px;bottom:14px;width:280px;max-height:170px;overflow-y:auto;padding:10px 12px;display:none;';
    this.chron.innerHTML = `<div style="color:var(--gold-dim);font-size:10px;letter-spacing:2px;margin-bottom:6px;">CHRONICLE</div><div id="chron-list"></div>`;
    root.appendChild(this.chron);
    this.elChron = this.chron.querySelector('#chron-list');
    this.sim.chronicle.onAdd(() => this._renderChron());

    // possession banner
    this.posBanner = this._el('div', 'panel pointer');
    this.posBanner.style.cssText += 'position:absolute;bottom:54px;left:50%;transform:translateX(-50%);padding:8px 16px;display:none;align-items:center;gap:12px;';
    root.appendChild(this.posBanner);

    // tribes overview (left, below the power palette)
    this.tribesPanel = this._el('div', 'panel pointer');
    this.tribesPanel.style.cssText += 'position:absolute;left:14px;bottom:14px;width:170px;padding:8px 10px;';
    this.tribesPanel.innerHTML = `<div style="color:var(--gold-dim);font-size:10px;letter-spacing:2px;margin-bottom:5px;">PEOPLES</div><div id="tribes-list"></div>`;
    root.appendChild(this.tribesPanel);
    this.elTribes = this.tribesPanel.querySelector('#tribes-list');

    this.setTool('inspect');
    this._renderChron();
  }

  _renderTribes() {
    if (!this.elTribes) return;
    const s = this.sim;
    this.elTribes.innerHTML = s.tribes.map(t => {
      const pop = s.membersOf(t).length;
      const col = `hsl(${Math.round(t.color * 360)},55%,62%)`;
      const era = eraOf(t.tech) + ' Age';
      return `<div style="display:flex;align-items:center;gap:6px;margin:3px 0;font-size:11px;">
        <span style="width:9px;height:9px;border-radius:50%;background:${col};flex:none;"></span>
        <span style="flex:1;color:var(--text);">${t.name}</span>
        <span style="color:var(--text-dim);">${pop}</span></div>
        <div style="font-size:9px;color:var(--text-dim);margin:-1px 0 3px 15px;">${t.race.name} · ${era}${pop === 0 ? ' · ✝' : ''}</div>`;
    }).join('');
  }

  setTool(id) {
    this.tool = id;
    this.toolBtns.forEach(b => {
      const on = b.dataset.tool === id;
      b.style.borderColor = on ? 'var(--gold)' : 'transparent';
      b.style.background = on ? 'rgba(232,200,122,0.12)' : 'none';
    });
    const t = TOOLS.find(x => x.id === id);
    this._flash(t.hint);
    this.onTool(id);
  }

  _flash(msg) { this.elHint.textContent = msg; }
  message(msg) { this._flash(msg); }

  // ---------- dynamic refresh ----------
  update() {
    const s = this.sim, g = this.god;
    this.elYear.textContent = `Year ${s.year}`;
    this.elSpeed.textContent = TIME_LABELS[s.speedIndex].replace(/^[^ ]+ /, '') || 'Paused';
    this.elPop.textContent = s.population;
    const ft = (this.selected && this.selected.tribe) || s.tribes[0];
    if (this.elFood && ft) {
      this.elFood.textContent = Math.floor(ft.res.food);
      this.elWood.textContent = Math.floor(ft.res.wood);
      this.elStone.textContent = Math.floor(ft.res.stone);
    }
    this._renderTribes();
    this.speedBtns.forEach((b, i) => {
      const on = i === s.speedIndex;
      b.style.background = on ? 'rgba(232,200,122,0.18)' : 'none';
      b.style.color = on ? 'var(--gold)' : 'var(--text)';
    });
    this.elGodTitle.textContent = g.title.toUpperCase();
    this.elFaithFill.style.width = `${(g.faith / GOD.FAITH_MAX) * 100}%`;
    this.elFaithVal.textContent = Math.floor(g.faith);
    this.elBelievers.textContent = `${s.believers()} believers`;
    // disable powers we can't afford
    this.toolBtns.forEach(b => {
      const t = TOOLS.find(x => x.id === b.dataset.tool);
      const afford = !t.cost || g.faith >= t.cost;
      b.style.opacity = afford ? '1' : '0.4';
      b.style.pointerEvents = afford ? 'auto' : 'none';
    });
    if (this.selected && this.selected.alive) this._renderInspector();
    else if (this.selected) { this.selected = null; this.inspector.style.display = 'none'; }
  }

  selectBeing(b) {
    this.selected = b;
    this.inspector.style.display = b ? 'block' : 'none';
    if (b) this._renderInspector();
  }

  _bar(label, val, color, invert = false) {
    const v = Math.max(0, Math.min(100, val));
    const shown = invert ? 100 - v : v;
    return `<div style="margin:4px 0;">
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-dim);">
        <span>${label}</span><span>${Math.round(v)}</span></div>
      <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${shown}%;background:${color};"></div></div></div>`;
  }

  _traitRow(name, v) {
    const pct = (v + 1) / 2 * 100;
    return `<div style="display:flex;align-items:center;gap:6px;font-size:10px;margin:2px 0;">
      <span style="width:54px;color:var(--text-dim);">${name}</span>
      <div style="flex:1;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;position:relative;">
        <div style="position:absolute;left:50%;top:-1px;width:1px;height:6px;background:rgba(255,255,255,0.2);"></div>
        <div style="position:absolute;left:${Math.min(pct,50)}%;width:${Math.abs(pct-50)}%;height:100%;background:${v>=0?'#7fae6a':'#b5705a'};"></div>
      </div></div>`;
  }

  _renderInspector() {
    const b = this.selected, s = this.sim;
    const stageColor = b.stage === 'child' ? '#86b6e0' : b.stage === 'elder' ? '#c9a86a' : '#d8dae2';
    // top relationships
    const rels = [...b.bonds.entries()]
      .map(([id, v]) => ({ o: s.beings.find(x => x.id === id), v }))
      .filter(r => r.o && r.o.alive)
      .sort((a, c) => Math.abs(c.v) - Math.abs(a.v)).slice(0, 4);
    const relHtml = rels.length ? rels.map(r => {
      const kind = r.v > 55 ? 'beloved' : r.v > 15 ? 'friend' : r.v < -40 ? 'enemy' : r.v < -10 ? 'rival' : 'acquaintance';
      const col = r.v >= 0 ? '#7fae6a' : '#b5705a';
      return `<div style="display:flex;justify-content:space-between;font-size:11px;margin:2px 0;">
        <span class="rel-link" data-id="${r.o.id}" style="cursor:pointer;color:var(--text);">${r.o.name}</span>
        <span style="color:${col};">${kind}</span></div>`;
    }).join('') : `<div style="font-size:10px;color:var(--text-dim);">No bonds yet.</div>`;

    const mem = b.memory.slice(-5).reverse().map(m =>
      `<div style="font-size:10px;color:var(--text-dim);margin:2px 0;line-height:1.3;">• ${m.text}</div>`
    ).join('') || `<div style="font-size:10px;color:var(--text-dim);">No memories yet.</div>`;

    const godLine = b.godAwareness < 0.1 ? 'Unaware of you.'
      : (b.godMood > 0.2 ? 'Loves you' : b.godMood < -0.2 ? 'Fears you' : 'Senses you')
        + ` (${Math.round(b.godAwareness * 100)}% awareness)`;

    this.inspector.innerHTML = `
      <div style="padding:12px 14px;border-bottom:1px solid var(--panel-edge);">
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <span style="color:var(--gold);font-size:17px;font-weight:600;">${b.name}</span>
          <span style="color:${stageColor};font-size:11px;">${b.stage} · ${Math.floor(b.age)}y · ${b.sex === 'f' ? '♀' : '♂'}</span>
        </div>
        <div style="color:var(--text-dim);font-size:11px;margin-top:2px;">${this._actionVerb(b)}</div>
        ${b.tribe ? `<div style="margin-top:3px;font-size:10px;color:var(--gold-dim);">${b.tribe.name} · ${b.tribe.race.name}</div>` : ''}
        ${b.job ? `<div style="margin-top:5px;display:inline-block;font-size:10px;letter-spacing:1px;color:#0c0e14;background:${(b.tribe&&b.id===b.tribe.leaderId)?'#e8c87a':'var(--gold-dim)'};padding:2px 7px;border-radius:3px;">${(b.tribe&&b.id===b.tribe.leaderId)?'👑 LEADER':b.job.toUpperCase()}</div>` : ''}
      </div>
      <div style="padding:10px 14px;">
        ${b.health < 100 ? this._bar('Health', b.health, '#cc5544') : ''}
        ${this._bar('Hunger', b.hunger, '#c87a4a')}
        ${this._bar('Energy', b.energy, '#6aa0c8')}
        ${this._bar('Social', b.social, '#9a7ac8')}
        ${b.gestating ? `<div style="font-size:10px;color:#c89; margin-top:4px;">🤰 expecting a child</div>` : ''}
      </div>
      <div style="padding:4px 14px 10px;">
        <div style="color:var(--gold-dim);font-size:10px;letter-spacing:1px;margin-bottom:3px;">NATURE</div>
        ${this._traitRow('timid·brave', b.traits.brave)}
        ${this._traitRow('calm·curious', b.traits.curious)}
        ${this._traitRow('cold·kind', b.traits.kind)}
        ${this._traitRow('doubt·devout', b.traits.devout)}
      </div>
      <div style="padding:4px 14px 10px;">
        <div style="color:var(--gold-dim);font-size:10px;letter-spacing:1px;margin-bottom:3px;">BONDS</div>
        ${relHtml}
      </div>
      <div style="padding:4px 14px 10px;">
        <div style="color:var(--gold-dim);font-size:10px;letter-spacing:1px;margin-bottom:3px;">MEMORY</div>
        ${mem}
      </div>
      <div style="padding:4px 14px 12px;">
        <div style="color:var(--gold-dim);font-size:10px;letter-spacing:1px;margin-bottom:3px;">BELIEF</div>
        <div style="font-size:11px;color:${b.godMood<-0.2?'#b5705a':b.godMood>0.2?'#7fae6a':'var(--text-dim)'};">${godLine}</div>
      </div>`;

    this.inspector.querySelectorAll('.rel-link').forEach(el =>
      el.addEventListener('click', () => {
        const o = s.beings.find(x => x.id === +el.dataset.id);
        if (o) { this.selectBeing(o); this.onSelectLink && this.onSelectLink(o); }
      }));
  }

  _actionVerb(b) {
    const verbs = {
      resting: 'at rest', foraging: 'foraging for food', eating: 'eating', sleeping: 'asleep',
      talking: 'with others', courting: 'courting', wandering: 'wandering', seeking: 'following a strange urge', grieving: 'grieving',
      'chopping wood': 'chopping wood', 'mining stone': 'mining stone', hunting: 'hunting game',
      hauling: 'hauling goods home', building: 'building a home', farming: 'working the fields',
      playing: 'playing', leading: 'leading the people', fighting: 'in battle', fleeing: 'fleeing danger',
    };
    return (verbs[b.action] || b.action) + '.';
  }

  setPossessed(b) {
    if (b) {
      this.posBanner.style.display = 'flex';
      this.posBanner.innerHTML = `<span style="color:var(--gold);font-size:12px;">👁 Walking with <b>${b.name}</b></span>
        <span style="color:var(--text-dim);font-size:11px;">WASD to suggest a path · </span>
        <button id="unposs" style="background:none;border:1px solid var(--panel-edge);color:var(--text);border-radius:4px;padding:4px 10px;cursor:pointer;font-family:inherit;font-size:11px;">Let go</button>`;
      this.posBanner.querySelector('#unposs').addEventListener('click', () => this.onUnpossess());
    } else this.posBanner.style.display = 'none';
  }

  _renderChron() {
    if (!this.elChron) return;
    this.chron.style.display = 'block';
    const evs = this.sim.chronicle.recent(30);
    this.elChron.innerHTML = evs.map(e =>
      `<div style="font-size:11px;margin:3px 0;line-height:1.3;color:${this._chronColor(e.kind)};">
        <span style="color:var(--text-dim);">Y${e.year}</span> ${e.icon} ${e.text}</div>`
    ).join('');
  }
  _chronColor(kind) {
    return { god: '#e8c87a', tech: '#7fae6a', death: '#b5705a', epoch: '#c9a86a', birth: '#9ab5d0', war: '#d0594a', gov: '#e8c87a' }[kind] || 'var(--text)';
  }
}
