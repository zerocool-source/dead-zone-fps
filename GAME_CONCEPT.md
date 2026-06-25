# AEON — *God of Pangaea*

### A living-world god-sim where AI-driven races evolve their own civilizations from the Stone Age into infinity.

> *"You are not a player. You are a witness, a gardener, and occasionally a god. The world does not need you — but it will remember you."*

---

## 1. The One-Line Pitch

You shape a primordial Earth, seed it with sentient races, and then **let go**. Every being is an autonomous AI agent with its own mind, memories, and ambitions. Civilizations rise, split, war, trade, and invent things you never planned — forever. You watch from orbit like a god, zoom down into a single street like *The Sims*, or **possess one being** and walk a life beside it. No two players' worlds are ever the same.

Think: **Spore × The Sims 4 × Civilization × Rimworld** — rendered with **GTA VI–grade fidelity** and powered end-to-end by autonomous AI.

---

## 2. The Core Fantasy

Three fantasies layered on top of each other, and you can drop between them at any moment:

| Layer | You are… | Camera | Inspiration |
|-------|----------|--------|-------------|
| **The God View** | An overseer of the whole planet | Orbital → continental | *Civilization*, *Black & White* |
| **The Watcher** | An invisible observer of one settlement / family | Street-level, cinematic | *The Sims 4* |
| **The Possessed** | A guiding spirit inside ONE chosen being | First/third person | *GTA VI*, *Souls* |

The magic is **continuity**: you can be orbiting Pangaea watching glaciers melt, swoop down into a Stone-Age village, pick a single hunter named *Oru*, and **live a day as his guardian spirit** — nudging him toward the cave that will become his tribe's first home. Then you let go, fast-forward 800 years, and find that Oru's descendants founded an empire that worships a "Sky Watcher" — *you*, remembered in myth.

You never **directly control** a being like a puppet. You **influence**: inspire, warn, gift, curse, reveal. The AI decides whether to listen.

---

## 3. The World: Procedural Pangaea

### 3.1 Two Ways to Begin
- **Template Pangaea** — start on a curated supercontinent, balanced for interesting outcomes. Best for first-time gods.
- **Genesis Seed** — start with a single landmass (or even bare ocean + one island) and let **tectonic simulation** carve continents over millennia. You don't know the map until it's born.

### 3.2 A Planet That Actually Moves
The world is a living system, simulated continuously:
- **Plate tectonics** — continents drift, collide (mountains), and rift apart (new oceans) over thousands of in-game years. *This is the engine of separation* — a single ancestral population gets split by a widening sea and diverges into distinct races over time.
- **Climate & seasons** — orbital tilt, ocean currents, ice ages, droughts, monsoons. Climate shapes where life thrives and triggers migrations.
- **Hydrology** — rivers carve valleys, lakes form and dry, coastlines shift. Civilizations cluster on water, exactly like real history.
- **Ecology** — flora and fauna are their own agent populations: predator/prey balance, extinctions, domestication candidates.
- **Disasters** — volcanoes, earthquakes, floods, meteor strikes, plagues. Some natural, some you can summon as a god (at a cost).

### 3.3 Deep Time
The clock runs from **the Stone Age into infinity**. Time scales are player-controlled:
- **1× (Lived time)** — a Sims-like day, for possession and watching.
- **Decade / Century / Millennium** — fast-forward; the sim summarizes events into a **Chronicle** you can scrub back through.
- **Pause** — freeze the planet to study it.

There is **no win condition and no end**. The goal is the story your world tells.

---

## 4. The Beings: Autonomous AI Agents

Every "bean" (being) is a real autonomous agent, not a scripted NPC. This is the heart of the game.

### 4.1 What Each Being Has
- **Needs** (Sims-style): hunger, rest, safety, social, purpose, curiosity. Drive moment-to-moment behavior.
- **Personality**: a trait vector (brave/timid, curious/conservative, kind/cruel, devout/skeptical, etc.) that biases decisions.
- **Memory**: a personal episodic log — who helped them, who wronged them, what they witnessed. Memories shape future choices and get retold (and distorted) as stories.
- **Relationships**: family, friends, rivals, mates. Bonds drive cooperation, feuds, marriages, betrayals.
- **Skills & Knowledge**: what this individual personally knows how to do — and what their culture has discovered.
- **Beliefs**: their model of how the world works, including their religion and their (mis)understanding of *you*, the god.
- **A life arc**: born → child → adult → elder → death. Lives are finite; **lineages** are the persistent unit.

### 4.2 How They Think (the AI stack)
A **three-tier hybrid** so it's affordable at planetary scale but rich up close:

1. **Utility/behavior-tree core (cheap, always-on)** — every being runs a fast local decision loop (eat, flee, build, socialize). This handles thousands of agents in real time, like *Rimworld*/*Dwarf Fortress* but smarter.
2. **LLM "soul" layer (selective, on-demand)** — when a being is near the player, possessed, or pivotal to a story (a chief, an inventor, a prophet), it gets promoted to **LLM-driven reasoning**: genuine dialogue, planning, invention, propaganda, scheming. This is where the "each being is something" magic lives.
3. **Culture/Civ director (regional)** — an aggregate agent representing each race/society, steering tech, religion, economy, and diplomacy as emergent summaries of its members' actions. Keeps macro-history coherent without simulating every peasant's LLM.

**Level-of-detail for minds**: just as graphics LOD reduces distant geometry, **cognitive LOD** reduces distant thought — far-off villages tick as statistical populations; the one you're watching runs full-fidelity individual agents. Promote/demote dynamically as the camera (or the story) moves.

### 4.3 Emergence, Not Scripting
Nothing is pre-written. Religions, languages, art styles, governments, taboos, and inventions **emerge** from agents reacting to their environment and each other. A drought + a charismatic survivor + a lucky harvest can birth a rain-god religion that lasts ten thousand years. You won't know what happens. Neither will we.

---

## 5. Races & Civilizations

### 5.1 One Origin, Then Divergence
**Everyone starts from one** — a single ancestral population in one place. Divergence is driven by:
- **Geographic separation** (tectonics, oceans, mountains) → isolated gene/culture pools.
- **Environmental pressure** (cold, heat, altitude, disease) → adaptation over generations.
- **Interbreeding & migration** → blending, hybrid cultures, new peoples.

Over a thousand+ years you get distinct **races**, each with its own:
- **Design/appearance** — procedurally evolved morphology and aesthetics tuned to their environment.
- **Narrative** — their myths, their history, their grudges, their golden ages.
- **Behavior** — cultural norms: are they traders or raiders? Nomads or builders? Theocratic or pragmatic?
- **Tech path** — they discover what *their* circumstances make discoverable. A coastal people invents sailing; a steppe people invents the saddle.

### 5.2 The Tech & Culture Web (open-ended)
Not a fixed tree — a **possibility web**. Discoveries unlock based on environment, resources, population, and accident:
- Fire → cooking → ceramics → metallurgy → …
- Language → writing → record-keeping → law → philosophy → …
- Eras flow naturally: **Stone → Bronze → Iron → Classical → Medieval → Renaissance → Industrial → Modern → ???** — and because it's infinite and emergent, different worlds reach **alternate futures** (a steampunk world, a theocratic stasis, a post-collapse retech, a spacefaring race). The web can branch into things we didn't author.

### 5.3 Civilization Dynamics
- **Settlements** grow into towns, cities, empires — with real layouts agents build over time.
- **Diplomacy & war** between cultures, emergent from resources, religion, and personalities of leaders (who are full LLM agents).
- **Trade & disease** spread along routes — ideas and plagues travel together.
- **Collapse & renewal** — civilizations fall (climate, war, decadence, plague) and the world keeps going. Ruins become the mysteries of the next age.

---

## 6. The God Powers (How You Interact)

You influence; you rarely command. Powers cost **Faith/Influence**, earned when beings believe in you (so cruelty and miracles both have consequences for your power).

**Gentle (subtle nudges):**
- *Inspire* — plant an idea/urge in a being (try the cave, cross the river, forgive him).
- *Reveal* — show a being something (a fertile valley, an enemy's approach).
- *Bless / Gift* — grant a resource, a good harvest, a healthy birth.
- *Whisper* — appear in dreams; how they interpret it is up to them.

**Dramatic (overt acts of god):**
- *Bless the land* — fertility, rain, mild winters.
- *Smite* — disasters, plagues, floods (terrifying; reshapes belief).
- *Raise/Lower land, divert rivers, spark fire* — terraforming.
- *Resurrect / Curse a lineage.*

**Meta (god tools):**
- **Possess** a being — guardian-spirit mode, walk their life (§7).
- **Chronicle** — the auto-generated history book of your world, with maps, lineages, and key events you can replay cinematically.
- **Lens** — overlays for climate, population, religion-spread, tech, happiness, migration, genetics.
- **Snapshots / Forks** — freeze a world and branch a "what if" timeline.

The relationship is the point: are you a **loving gardener**, an **absent god**, a **vengeful tyrant**, or a **trickster**? Beings will theologize about you accordingly — and that theology shapes their entire civilization.

---

## 7. Possession — "Be a Being"

The signature feature. You don't become the being, but you **inhabit it as its guiding spirit**:
- Camera drops to **first/third person** (GTA VI–style), full street-level fidelity.
- You experience their needs and senses; you can **suggest** actions, and the being's AI accepts or resists based on personality and trust.
- You can spend a single day or a whole lifetime with them. Help a hunter survive, guide an inventor to a breakthrough, steer a chief away from a war.
- When you **let go**, the being lives on autonomously — and your influence ripples forward through their lineage and culture.

This is the bridge between the Sims-scale intimacy and the Civ-scale grandeur: **one face in a planet of millions, and you chose them.**

---

## 8. Look & Feel — "GTA VI Graphics, Sims 4 Soul"

### 8.1 Visual Target
- **Photoreal-stylized**: GTA VI–level material fidelity, lighting, weather, and crowd density, but with the warmth, readability, and charm of *The Sims 4* so thousands of agents stay legible and lovable.
- **Seamless scale**: a single continuous render path from **orbital view of Pangaea** down to **the stubble on a possessed being's face** — no loading screens between scales (UE5 Nanite/virtualized-geometry + streaming).
- **Living world rendering**: dynamic time-of-day, volumetric weather, seasons that visibly change biomes, cities that physically grow building-by-building across centuries.
- **Era-accurate aesthetics**: each race's architecture, clothing, and art are procedurally generated from its culture and tech, so a city *looks* like its history.

### 8.2 Audio
- Adaptive, generative score that shifts with era, mood, and scale (orbital awe → village intimacy → battle).
- Emergent **conlangs**: each culture grows its own procedurally generated language (sound + script) you can watch evolve.
- Diegetic soundscape: markets, forges, prayers, weather, wildlife.

---

## 9. Technical Architecture (How It's Actually Built)

A god-sim at this scale is fundamentally a **simulation + AI** problem with a **rendering** problem bolted on. Recommended stack:

### 9.1 Engine
- **Unreal Engine 5** for the headline "GTA VI graphics" build (Nanite, Lumen, World Partition, MetaHuman-style crowds, mass-entity crowds via *Mass AI*).
- **This repo's Three.js/Vite base** is perfect for a **web-playable prototype / "God's Table" companion view** — a stylized, lower-fidelity version that proves the simulation and lets people play in a browser. Start here to validate the fun before the AAA render.

### 9.2 Simulation Core (engine-agnostic, the real product)
- **ECS (Entity-Component-System)** data-oriented sim so you can tick **hundreds of thousands of agents** efficiently (à la *Mass AI*, Bevy ECS, or DOTS).
- **Cognitive LOD scheduler** — promotes/demotes agents between cheap utility-AI and expensive LLM reasoning based on player attention and narrative weight.
- **Deterministic, fork-able world state** with event-sourced history → enables the Chronicle, snapshots, and "what-if" forks.
- **Background tick for off-screen regions** as statistical population models; reify into individuals on demand.

### 9.3 The AI Layer
- **Local fast brains**: utility AI + behavior trees + GOAP for moment-to-moment, runs on-device.
- **LLM souls**: a smaller, fast model (latest Claude Haiku-class for cost, Sonnet/Opus-class for pivotal agents) drives dialogue, planning, invention, and propaganda for promoted agents. Heavily **prompt-cached** per-culture context + per-being memory.
- **Memory store**: each being has a vector/episodic memory; cultures have a shared "myth & knowledge" store. Retrieval feeds the LLM context.
- **Cost control**: batch + cache aggressively; only a few hundred agents are ever "awake" at full LLM fidelity at once; the rest are statistical. **This is the key engineering constraint and the key innovation.**
- **Safety/coherence guardrails** so emergent behavior stays believable and within content bounds.

### 9.4 Networking / Persistence
- Single-player first (your private planet). Each world is a persistent, evolving save that keeps simulating (optionally) while you're away.
- Long-term: **shared galleries** — publish your Pangaea, let others fork it; spectate famous worlds; cross-pollinate seeds.

---

## 10. The Player Loop

**Moment-to-moment (Watcher/Possession):** observe → notice a being/problem → nudge or possess → see the consequence → bond with a lineage.

**Session (Hours):** pick an era goal of your own ("help this tribe survive the ice age," "see if a republic can emerge here"), influence, fast-forward, read the Chronicle, react to what emerged.

**Long-term (Weeks/Months):** shepherd a world across millennia, watch your influence become myth, branch alternate timelines, share your planet.

The retention engine is **emergent narrative + attachment**: you come back to find out *what your world did without you.*

---

## 11. Why It's Different
- **Truly autonomous** — the world doesn't wait for you and has no scripted plot.
- **Infinite & unique** — procedural planet + emergent AI = no two playthroughs alike, no ending.
- **Scale-fluid** — god, watcher, and being in one seamless experience.
- **AI-native** — built around modern LLM agents, not faking it with dialogue trees.
- **You become mythology** — your actions are remembered, distorted, and worshipped. The civilizations literally write you into their history.

---

## 12. Risks & Honest Hard Parts
| Challenge | Mitigation |
|-----------|-----------|
| **LLM cost at scale** | Cognitive LOD; only promote a few hundred agents; cache per-culture context; small models for most. |
| **Coherent long-term history** | Culture/Civ director agents + event-sourced Chronicle keep macro-history sane. |
| **Emergent chaos / incoherence** | Guardrails, plausibility constraints, and "narrative gravity" to keep stories believable. |
| **AAA graphics cost & time** | Ship the **web/stylized prototype first** (this repo) to prove the sim; UE5 fidelity later. |
| **Players feeling powerless** | Possession + god powers + the Chronicle give agency and payoff without breaking autonomy. |
| **Performance (100k+ agents)** | ECS/data-oriented sim, off-screen statistical modeling, aggressive LOD. |

---

## 13. Suggested Roadmap

**Phase 0 — Vertical Slice (web, this repo's stack):**
One small island, one ancestral tribe of ~30 fully-simulated beings (utility AI + a handful of LLM souls), real-time + fast-forward, basic god powers (inspire, bless, smite), and **possession of one being**. Prove the loop is fun in the browser. *This is the achievable MVP.*

**Phase 1 — A Living Continent:**
Procedural Pangaea + tectonics, multiple cultures diverging, the Chronicle, cognitive LOD, era progression Stone→Bronze.

**Phase 2 — Deep Time & Emergent Civ:**
Full tech/culture web, religions (with *you* in them), diplomacy/war, climate & disasters, lineages across millennia.

**Phase 3 — The AAA Render & Sharing:**
UE5 fidelity, seamless orbital→street camera, generative language/audio, world galleries & forking.

---

## 14. Names on the Table
**AEON: God of Pangaea** *(lead pick — deep time + the supercontinent)*
Alternates: **GENESIS**, **DEMIURGE**, **PANGAEA: Worlds Without End**, **THE WATCHERS**, **AGES**, **LIVING WORLD**.

---

### Suggested First Build
Given this repo already runs **Three.js + Vite** in the browser, the fastest path to something playable is **Phase 0 as a web prototype**: a single island, a small autonomous tribe, fast-forwardable time, a few god powers, and possession. If you want, I can scaffold that prototype next — repurposing the existing render/loop/HUD code into a god-sim shell.
