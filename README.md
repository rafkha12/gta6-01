# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rafkha12/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rafkha12/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6: a sun-soaked city to explore on foot and by car, with traffic, police, missions and a story.

You are Dario Cruz, a getaway driver trying to go straight in Bahía Sol — a coastal city of towers, beaches and a marina. Doña Maribel, who runs the Solmar garage, has four jobs for you: a first fare, a stolen Comet GT, a three-star heat run, and the big score at the Banco Sol plaza. Steal cars, lose the police, earn the payout.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network — the game is plain static files under `game/`, with three.js vendored under `game/vendor/`.

## How it works

- `game/src/city.js` builds Bahía Sol: a street grid of towers with lit windows, the beach to the south and the marina to the east.
- `game/src/player.js`, `game/src/vehicles.js` — Dario on foot and the arcade driving model.
- `game/src/traffic.js` — traffic cars that drive the grid and pedestrians who flee trouble.
- `game/src/police.js` — the wanted system: stars for crimes, police cars and officers who chase, ram and arrest.
- `game/src/missions.js` — the four-job story arc with objectives, timers and payouts.
- `game/src/hud.js` — health, money, wanted stars and a live minimap.
- `game/src/audio.js` — procedural WebAudio: engine, sirens, gunshots and a sunset chord loop.
- `game/src/shots.js` — the four staged screenshot scenes (`?shot=cover|drive|chase|mission&seed=1`).
- `main.ts` hands the game in: it copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.

## Controls

WASD move · Mouse camera · SHIFT run · E enter / exit car · Click shoot · F punch · M next job · ESC pause. Progress saves to localStorage.

Entered on [make.fun](https://make.fun/?ref=ksh7t1b1&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards
