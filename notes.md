# Costa Brisa — Neon Shores · entry notes (gta6-01)

A static open-world game built from scratch for this bounty: an original city, an original
name, an original story. No Rockstar assets, names, music or map — every sprite, sound and
line of text was made for this entry. `main.ts` is only the hand-in: it copies `game/` and
`screenshots/` into the output directory and writes `dossier.json` with the kit's vendored
`buildDossier`, exactly the bytes the scorer rebuilds and compares.

## The game, against the judging criteria

1. **A complete open world, visible in the screenshots.** Costa Brisa is a full city on a
   7×6 road grid with a beach and sea to the east, a marina with boats, and named places:
   the Marlin Club, Puerto Brisa docks and warehouse, Banco del Sol, San Brisa Hospital,
   the CBPD station, Tito's Chop Shop, the Hotel Coralina, the Palms Mall, Lighthouse Point.
   Screenshot 1 alone shows a live police chase, a 3-star wanted level, the mission
   objective with distance, the full-city minimap and the HUD at once.
2. **Depth.** A three-mission story arc for dock fixer Mara Voss (dock pickup → club
   delivery; steal the crimson Vantek Sable → chop shop delivery; a heat run to Lighthouse
   Point), then repeatable courier jobs from the dock board. Systems: walking and driving,
   AI traffic, 42 pedestrians, car theft with a witness rule (heat only when a pedestrian
   is within 170 px or a police car within 330 px), a 5-star wanted system with pursuit
   and a bust meter, hitscan pistol combat, cash, bust fines and hospital/station respawns.
3. **Feel and polish.** Camera follows on foot and in car, HUD with cash / respect tier /
   health and car bars, a whole-city minimap with objective marker, objective banner with
   live distance, start / pause / busted / wasted screens, progress saved to localStorage,
   and synthesized WebAudio sound (engine, sirens, cash, pickups) — no audio files.
4. **An original, bright, modern city with its own names and story** — see the place list
   above; the fiction (Rio, Mara Voss, the crate, the Sable) is written for this entry.
5. **One-task-per-file source.** `game/src/` holds 15 small modules — `rng.js`, `config.js`,
   `city.js`, `audio.js`, `input.js`, `save.js`, `cars.js`, `peds.js`, `police.js`,
   `combat.js`, `missions.js`, `render.js`, `hud.js`, `main.js`, `shots.js` — plus
   `index.html` and `style.css`. `vendor/makefun-game.ts` is the kit's file, intact.

## Playtest evidence

Both drivers are our own CDP clients (in the build workspace, not in this entry); both
collect every console error, exception and failed request and fail the run if any appear.

- **Keyboard playtest (first builder, `drive.cjs play`): 12/12 assertions PASS, 0 console
  errors** — new game, walk, talk to Mara (mission 1 starts), steal a parked car, drive
  (peak ≈197 px/s), wanted rises to 2 stars, exit car, fire the pistol, pause/resume,
  save present in localStorage.
- **Mission 1 end-to-end (closing session, `mission.cjs`): full run CLEAN, 0 console
  errors.** Leg out: stage `m1_go → m1_deliver` (package picked up at the docks, driven
  over real road routes). Leg back: busted once mid-route, recovered the way a player
  would (walk out of the station, take another car, re-drive), then `m1_deliver →
  m2_talk` — package delivered to the Marlin Club. Cash $250 → $675 ($600 payout minus a
  bust fine); `stats.storyDone = 1`.
  Two driver bugs were found and fixed in the driver only (the game was never bent to
  satisfy it): the final assertion expected `storyDone === 0`, but `missions.js` counts
  completed story missions (its `reward()` adds 1 per titled completion), so 1 is the
  correct value; and the route's last waypoint sat 44 px from the club door while the
  driver's waypoint tolerance was 64 px, so the car could stop ~108 px out — outside the
  game's 48 px arrival radius — and the delivery never fired. The driver now ends routes
  on the objective point, settles precisely to within 44 px, and after a bust prefers a
  civilian car over the station's own Interceptor (stealing that, witnessed, made the
  next bust near-certain and drained the cash to $0 in one run — that run is recorded in
  the session transcript as it happened).

## Screenshots (all 1280×720, JPEG, captured from `shots.json` scenes, `?shot=…&seed=1`)

Re-captured in the closing session, after the last source edits (gold ring marking the
player's car in `render.js`, pink hero car and 0.95 zoom in the drive scene in
`shots.js`, the `combat.shots` counter in `combat.js`), with 0 console errors; each was
visually inspected before being kept.

| File | Bytes | Shows |
|---|---|---|
| `screenshots/1-chase.jpg` | 101,098 | Police chase at 3 wanted stars: police cars on the player's ring-marked car, mission objective + distance, minimap, HUD, 79 km/h |
| `screenshots/2-drive.jpg` | 84,554 | Driving the pink Meridian Sedan on the coast road — beach, sea, boats, minimap, 78 km/h |
| `screenshots/3-mission.jpg` | 84,696 | At the Marlin Club door: "E — Talk to Mara Voss" prompt, objective marker, named buildings |
| `screenshots/4-city.jpg` | 109,460 | Free roam over the marina district: parking lots, taxis, traffic, pedestrians, courier-board objective line |

All four are ≤ 256 KiB and at least 1280×480, as the gate requires.

## Determinism and kit check

- `node main.ts` run twice into separate output directories: **dossier.json byte-identical,
  sha256 `4480df2ec72d43511b6bcbbced8621b717d3a60e9608e3c25f5a2e83a79ccdd3`**, and the two
  whole output trees identical. `game/` is 17 files, 107,586 bytes (caps: 993 files, 48 MiB).
- Kit `check --worktree` (official kit, run in the closing session): **4 passed, 0 failed**
  — `competition_open`, `snapshot` (27 files, 550,277 bytes), `license_osi` (MIT,
  SPDX line present), `entrypoint` (`main.ts`, node22). 17 checks skipped because the
  site runs them on the transcripts it builds from the sealed recordings; 5 are
  submission-stage (repo public, repo owner, repo created after open, commit in repo,
  duplicate snapshot) — those belong to the submit step.

## Sessions and recordings

This entry was built in two recorded sessions, because the runtime hosting the first
recorder restarted mid-build and killed it; its state survived intact on disk and it had
already witnessed the main build (server-acknowledged fingerprints), so it is being
sealed with `record --finish` rather than discarded. The closing session started only
after the second recorder was running.

- Main build — agent `5730cf23-94b0-4b87-8af0-a5bca6ec43c7`, recording
  `01a1fdb9-dbb7-77df-bc3d-4dd5bd41c53b`
- Closing session (mission verification, screenshot re-capture, determinism, kit check,
  these notes) — agent `4a50ab5b-bbe6-403b-b65f-b9ce40242ca7`, recording
  `01a1fdd2-8af7-70df-bbb2-b0e2f7034607`

The submit should carry both recording ids.
