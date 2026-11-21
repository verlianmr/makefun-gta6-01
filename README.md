# makefun-gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/verlianmr/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/verlianmr/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Costa Brisa — Neon Shores**: a complete open-world crime game in one static web page. Explore a sun-soaked coastal city on foot and by car: steal and drive five kinds of vehicles in live traffic, run a three-mission story for dock fixer Mara Voss (a dock pickup, a borrowed sports car, a hot ride to the lighthouse), take repeatable courier jobs, fight with a pistol, and outrun the Costa Brisa PD through a five-star wanted system with a bust meter — all with a full HUD, a whole-city minimap, synthesized engine/siren/combat audio, and a save that persists in your browser. Everything is original: the city, the people, the cars and the story were made for this game.

## Run it

```sh
node serve.ts
```

then open http://localhost:8080 — or serve `game/` with any static file server and open `index.html`. No build step, no network: every file the game loads sits under `game/`.

Play with keyboard and mouse: WASD/arrows move and drive, **E** enters cars and talks, the mouse aims and a click fires, Shift runs (and handbrakes in a car), P pauses, M mutes.

`node main.ts` is the make.fun hand-in program: it copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the kit's vendored library.

---

<sub>Entered on [make.fun](https://make.fun/?ref=cw40tr4n&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
