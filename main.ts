// Costa Brisa — Neon Shores: the entry program for make.fun's "Make GTA 6" bounty (gta6-01).
//
// The game itself is the static site under game/ (open game/index.html in a desktop browser and
// play; it loads nothing from the network). This program is only the hand-in: it copies game/
// and screenshots/ into the output directory and writes dossier.json there with the kit's
// vendored buildDossier, exactly the bytes the scorer rebuilds and compares.
//
// Run it the way the grader does, or locally with an output directory of your choice:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const GAME_TITLE = 'Costa Brisa — Neon Shores';
const root = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's own caps (reference/gate.json): the dossier text cap shapes the bytes; the rest
// refuse an entry the scorer would refuse, so a bad hand-in fails here first, not at grading.
const GATE_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

mkdirSync(outputDir, { recursive: true });
cpSync(join(root, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  cpSync(join(root, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, GATE_LIMITS));
console.log(`${GAME_TITLE}: game, screenshots and dossier.json written to ${outputDir}`);
