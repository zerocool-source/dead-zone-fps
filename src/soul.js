// Souls — what beings say. A generative "soul" turns a being's state (needs, mood,
// tribe, job, beliefs, relationships, era, war) into believable speech. Runs fully
// offline. If a Claude adapter is registered via setLLM(), promoted beings (leaders,
// the possessed one, on-camera) defer to it for richer dialogue — see Voices.request().
import { eraOf } from './config.js';

const pick = (rng, arr) => arr[Math.floor(rng.next() * arr.length)];

function mood(b) {
  if (b.health < 45) return 'hurt';
  if (b.hunger > 78) return 'hungry';
  if (b.energy < 22) return 'weary';
  if (b.godMood < -0.3) return 'afraid';
  if (b.social < 22) return 'lonely';
  if (b.godMood > 0.35) return 'devout';
  return 'content';
}

const GOD_NAMES = ['the Sky-Watcher', 'the One Above', 'the Unseen', 'the Great Eye', 'the Maker'];
function godName(b) { return GOD_NAMES[Math.floor((b.hue * 1000) % GOD_NAMES.length)]; }

export const Soul = {
  // returns a short line of speech for the given context, or null
  speak(b, ctx, sim, opts = {}) {
    const rng = b.rng;
    const tribe = b.tribe ? b.tribe.name : 'our people';
    const era = b.tribe ? eraOf(b.tribe.tech) : 'Stone';
    const m = mood(b);

    switch (ctx) {
      case 'greet':
        return pick(rng, [
          'Well met.', 'Peace to you.', 'You range far today.', 'The day holds.',
          `Strength to the ${tribe}.`, 'Good light to you, friend.',
        ]);

      case 'gossip': {
        const o = opts.other;
        const oname = o ? o.name : 'someone';
        const lines = [
          `Have you seen ${oname} of late?`,
          m === 'hungry' ? 'The stores run thin. I have not eaten well.' : 'The hunting was good this season.',
          b.job === 'builder' ? 'We will need more wood before the rains.' : 'There is work yet to do.',
          o && b.bondTo(o.id) > 30 ? `I am glad of you, ${oname}.` : `What word from the elders?`,
        ];
        return pick(rng, lines);
      }

      case 'work':
        return pick(rng, {
          'chopping wood': ['This trunk is stubborn.', 'Wood for the fires, wood for the homes.'],
          'mining stone': ['The stone gives slowly.', 'My hands are grey with dust.'],
          hunting: ['Quiet now — there, by the trees.', 'The herd moves east.'],
          foraging: ['Berries enough for the children.', 'The good bushes are picked over.'],
          building: ['Another home rises.', 'Lay the stone true.'],
          farming: ['The seed takes well here.', 'Rain would bless these rows.'],
        }[b.action] || ['There is always work.']);

      case 'pray': {
        const g = godName(b);
        if (b.godMood < -0.2) return pick(rng, [`${g}, spare us your wrath.`, `What have we done to anger ${g}?`, `${g} watches. I am afraid.`]);
        return pick(rng, [`${g}, watch over the ${tribe}.`, `We thank ${g} for this day.`, `${g}, send us rain and good hunting.`]);
      }

      case 'mourn':
        return pick(rng, [`I still see ${opts.who || 'them'} by the fire.`, `${opts.who || 'They'} are gone. The world is smaller.`, 'We will remember.']);

      case 'war':
        return pick(rng, [`For the ${tribe}!`, `The ${opts.enemy || 'enemy'} will pay!`, 'Stand fast! Hold the line!', 'Drive them from our land!']);

      case 'afraid':
        return pick(rng, ['Run! To the homes!', 'They are upon us!', 'Hide the little ones!']);

      case 'idle':
      default:
        return pick(rng, {
          hungry: ['I hunger.', 'When did we last eat well?'],
          weary: ['I must rest soon.', 'My legs are heavy.'],
          lonely: ['It is quiet today.', 'I would welcome company.'],
          devout: [`${godName(b)} is good to us.`, 'I feel watched over.'],
          afraid: ['Something is wrong.', 'I do not feel safe.'],
          content: ['A fair day.', `The ${tribe} endure.`, 'Life goes on.'],
          hurt: ['My wounds ache.', 'I am not yet whole.'],
        }[m]);
    }
  },

  // a leader's spoken rationale for a government decision (shown + can be LLM-upgraded)
  decree(leader, choice, sim, opts = {}) {
    const rng = leader.rng;
    const tribe = leader.tribe ? leader.tribe.name : 'our people';
    return {
      food: pick(rng, ['Our stores are thin. To the fields and the hunt!', 'No child of ours will go hungry. Gather!']),
      build: pick(rng, ['Raise the homes. We are a people, not wanderers.', 'Stone upon stone — we build to last.']),
      war: pick(rng, [`The ${opts.enemy || 'foe'} have wronged us. To arms!`, 'Sharpen the spears. We end this.']),
      peace: pick(rng, ['Enough blood. We will talk, not fight.', 'I am tired of burying our young. Make peace.']),
      threaten: pick(rng, [`The ${opts.enemy || 'others'} are no friends of ours.`, 'Watch the borders. Trust no stranger.']),
      trade: pick(rng, [`The ${opts.ally || 'others'} have what we lack. Let us deal.`, 'Better to trade than to bleed.']),
      feast: pick(rng, ['We have endured! Tonight, we feast.', 'Light the fires — tonight we are glad!']),
      monument: pick(rng, ['Let us raise a sign to the heavens.', 'Future kin will know we stood here.']),
      expand: pick(rng, ['The land is wide. Let us see it.', 'Range farther — there is more out there.']),
    }[choice] || `We are the ${tribe}, and we endure.`;
  },
};

// Voices — drives who speaks and routes promoted beings to an optional LLM adapter.
export class Voices {
  constructor(sim) {
    this.sim = sim;
    this.llm = null; // async ({being, context, prompt}) => string
  }
  setLLM(fn) { this.llm = fn; }

  // make a being say something now (offline immediate; LLM refines async if registered)
  say(being, text, opts = {}) {
    if (!text) return;
    being._say = text;
    being._sayId = (being._sayId || 0) + 1;
    if (opts.chronicle) this.sim.chronicle.add(this.sim.day, this.sim.year, opts.icon || '💬', `${being.name}: “${text}”`, 'speech');
    if (opts.promoted && this.llm) this._refine(being, opts);
  }

  async _refine(being, opts) {
    try {
      const prompt = this._prompt(being, opts);
      const better = await this.llm({ being, context: opts.context, prompt });
      if (better && being.alive) { being._say = better; being._sayId++; }
    } catch (_) { /* keep the offline line */ }
  }

  _prompt(b, opts) {
    const t = b.tribe;
    return [
      `You are ${b.name}, a ${b.stage} ${b.sex === 'f' ? 'woman' : 'man'} of the ${t ? t.name : 'people'}`,
      t ? `(${t.race.name}, ${eraOf(t.tech)} Age, a ${t.government})` : '',
      `Job: ${b.job || 'none'}. Mood: ${mood(b)}.`,
      opts.context === 'war' ? 'You are in battle.' : '',
      'Say one short, in-character line (max 12 words). No quotes.',
    ].filter(Boolean).join(' ');
  }
}
