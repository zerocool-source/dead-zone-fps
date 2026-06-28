// A Tribe — a people of one race with their own home, stockpile, knowledge, leader,
// culture, and diplomacy. Beings belong to a tribe; the Sim owns the list of tribes.
import { RES } from './config.js';
import { makeTribeName } from './names.js';

let NEXT = 1;

export class Tribe {
  constructor(rng, raceKey, race, home) {
    this.id = NEXT++;
    this.rng = rng;
    this.raceKey = raceKey;
    this.race = race;                       // RACES[raceKey]
    this.name = makeTribeName(rng);
    this.home = home;                       // {x,z,y}
    this.hue = race.hue + rng.gauss(0, 0.01);
    this.color = race.hue;

    this.res = { ...RES.START };            // own stockpile
    this.huts = [];                         // {x,z,y,occupants}
    this.buildings = [];                     // player-placed {type,x,z,y,built,progress,work}
    this.defense = 0;                        // sum of built defensive structures
    this.farms = [];
    this.insight = 0;
    this.tech = [];
    this.leaderId = null;
    this.government = 'band';                // band → council → chiefdom (emergent)
    this.relations = new Map();             // otherTribeId -> -100..100 standing
    this.lastDecisionDay = 0;
    this._jobTimer = 0;
  }

  get members() { return this._members || []; }
  set members(v) { this._members = v; }

  standing(otherId) { return this.relations.get(otherId) ?? 0; }
  adjustStanding(otherId, d) {
    this.relations.set(otherId, Math.max(-100, Math.min(100, this.standing(otherId) + d)));
  }
}
