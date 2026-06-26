# AEON: God of Pangaea — Godot 4 port (scaffold)

A native **Godot 4** port of the AEON god-sim, running in parallel with the web
(Three.js) build. It reuses the same simulation design and the **same generated
GLB character meshes** (Higgsfield, rigged + walk-animated) that the web build
uses — Godot imports glTF natively, animations included.

## Run it

1. Install **Godot 4.3** or newer (standard build, GDScript — no C# needed):
   https://godotengine.org/download
2. Open Godot → **Import** → select `godot/project.godot` in this repo.
3. Let it import the assets the first time (it generates `.import` files for the
   13 GLBs), then press **Play** (F5).

### Controls
- **WASD** — pan the camera
- **Mouse wheel** — zoom
- **Q / E** — rotate
- **1–5** — time speed (pause → lived → days → seasons → ages)
- **Space** — pause / resume

## Why Godot
The web build hits a ceiling on animated-crowd performance in the browser.
Godot gives native performance, real animation blending (`AnimationTree`),
pathfinding (`NavigationServer3D`), and exports to desktop, mobile, **and** web —
so this is the path to scale and shipping. The hard part (the simulation) is
engine-agnostic and ports cleanly; the GLBs drop straight in.

## What's in this scaffold
A runnable vertical slice that mirrors the web build's foundation:

- **Procedural climate world** (`WorldGen.gd`) — heightmap + radial island
  falloff + temperature×moisture biomes (desert/grass/forest/jungle/taiga/
  tundra/snow), rendered as a vertex-coloured `ArrayMesh` with water.
- **Six tribes of four races** (`Sim.gd`, `Tribe.gd`) settling their homelands,
  far apart, seeded deterministically (`RNG.gd` mirrors the web PRNG).
- **Autonomous beings** (`Being.gd`) — needs (hunger/energy/social), a daily
  routine (forage → eat → sleep → socialise), aging, reproduction with inherited
  traits, and death.
- **Rendering** (`Main.gd`) — each being instances its race's rigged GLB and
  plays the walk clip while moving; distance-culled. RTS camera + HUD (year,
  population, tribes, chronicle).

## What's next (to reach web-build parity)
Port the remaining systems and lean on Godot's strengths:
- Jobs/resource economy + building (huts/farms), hunting & fauna (boar/wolf)
- Government, war/combat, the souls/speech layer
- `MultiMeshInstance3D` + GPU-skinning LOD for **thousands** of agents
- `NavigationServer3D` pathfinding around water/mountains
- `AnimationTree` blend (idle ↔ walk ↔ run), god powers, minimap, save/load

## Layout
```
godot/
├── project.godot          Godot project config (autoloads Config)
├── scenes/Main.tscn       Root scene (Node3D + Main.gd)
├── scripts/
│   ├── Config.gd          Constants + races + biomes (autoload singleton)
│   ├── RNG.gd             Seedable PRNG (parity with web)
│   ├── Names.gd           Procedural naming
│   ├── WorldGen.gd        Heightmap + climate biomes + resources
│   ├── Tribe.gd           A people: race, home, stockpile, leader
│   ├── Being.gd           Autonomous agent: needs + routine + life arc
│   ├── Sim.gd             Owns world/tribes/beings, time, reproduction
│   └── Main.gd            Terrain mesh, being visuals, camera, HUD, loop
└── assets/models/*.glb    The 13 generated meshes (shared with the web build)
```
