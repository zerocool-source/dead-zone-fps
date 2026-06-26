# AEON — God of Pangaea

A living-world god-sim where an autonomous Stone-Age tribe evolves on a procedural
island while you watch, nudge, and occasionally play god. Built with Three.js + Vite.

This repo is the **Phase 0 vertical slice** described in [`GAME_CONCEPT.md`](./GAME_CONCEPT.md):
one island, a small tribe of fully-autonomous beings, player-controlled time, a handful
of god powers, possession, and an emergent Chronicle — all running in the browser with
no backend or API keys.

> The beings are driven by a utility-AI brain (needs + personality + memory +
> relationships). The architecture leaves a `soul` hook on each being so a real LLM
> "soul" can later drive promoted/possessed individuals (concept §4.2) without touching
> the rest of the sim.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000, click **ENTER THE WORLD**, and watch your tribe live.
Add `?seed=yourword` to the URL to grow a specific, reproducible world.

## How to Play

You are not a player — you are a witness, a gardener, and occasionally a god.

| Control | Action |
|---------|--------|
| **Drag / scroll** | Orbit and zoom the world (from orbital down to street level) |
| **Space** | Pause / resume time |
| **1–5** | Time scale: pause → lived → days → seasons → ages |
| **Observe** tool | Click a being to read its mind (needs, nature, bonds, memory, belief) |
| **Inspire** ✨ | Click a being, then a place — plant an urge they may follow (costs faith) |
| **Bless** 🌟 | Click the land — food, healing, and devotion in a radius (costs faith) |
| **Smite** 🔥 | Click the land — fire and terror; reshapes belief into fear (costs faith) |
| **Possess** 👁 | Click a being — walk beside its life; WASD *suggests* a path (it may resist) |

**Faith** is earned passively from beings who believe in you, and spent on powers. How
you treat the world (gardener vs. tyrant) shapes the title they worship you by, and the
**Chronicle** (bottom-right) records the history your world writes for itself.

## What's Simulated

- **Procedural island** — seedable value-noise heightmap with biomes (ocean, beach,
  grass, forest, rock, snow), regrowing food, and god-terraformable terrain.
- **Autonomous beings** — each has needs (hunger/energy/social), a personality trait
  vector, episodic memory, relationships/bonds, skills, a life arc (child→adult→elder→
  death), and beliefs about you. Decisions come from utility scoring over candidate
  actions.
- **Lineages** — beings court, conceive, and raise children who inherit blended traits;
  the tribe grows, ages, mourns, and turns over across generations.
- **Emergent knowledge** — culture-wide discoveries (Fire → Tools → Shelter → Language →
  Ritual → Farming) unlock from accumulated insight and population, each crediting an
  emergent "inventor."
- **Deep time** — a sub-stepped clock that stays stable from lived-time up to fast
  fast-forward, so you can scrub centuries and read what happened.

## Project Structure

```
src/
├── main.js        Entry point, input, and the game loop
├── config.js      All tunable constants (world, needs, life, tech, god powers)
├── rng.js         Seedable deterministic PRNG (reproducible/forkable worlds)
├── names.js       Procedural being + tribe naming (a tiny evolving conlang feel)
├── world.js       Procedural island: heightmap, biomes, resources, terraforming
├── being.js       The Being: needs, personality, memory, relationships, utility AI
├── sim.js         The Simulation: population, time, reproduction, death, discoveries
├── god.js         Faith economy + powers (inspire, bless, smite)
├── chronicle.js   The auto-generated history of your world
├── render.js      Three.js "God's Table" view: terrain, beings, sky, effects, camera
└── hud.js         All on-screen UI: time, faith, powers, being inspector, Chronicle
```

## Tuning

Everything balance-related lives in `src/config.js` — need drain rates, lifespans,
fertility, food density, tech thresholds, and faith costs. The renderer reads sim state
only; the simulation has no rendering dependencies, so the whole world model is portable
to a higher-fidelity engine later (concept §9).

## Roadmap

This slice is Phase 0. Next up (see `GAME_CONCEPT.md` §13): procedural Pangaea with
plate tectonics, multiple diverging cultures, cognitive level-of-detail, and the LLM
soul layer for promoted beings.
