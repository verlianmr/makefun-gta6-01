// Costa Brisa — Neon Shores: the game itself. This module owns the world state and the
// loop: it builds the city, steps the simulation at a fixed rate (traffic, people, police,
// missions, combat), follows the player with the camera, and wires the menus and the save.
// Everything else is a specialist it calls: city.js builds, cars.js drives, police.js hunts,
// missions.js tells the story, render.js and hud.js draw.

import { CITY_SEED, PLACES } from './config.js';
import { buildCity, collideCircle } from './city.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { forwardSpeed, nearestCar, spawnVehicles, speedOf, stepVehicle, updateTrafficCar } from './cars.js';
import { spawnPeds, updatePeds } from './peds.js';
import { createWanted, reportCrime, respawnAtStation, setHeat, updatePolice } from './police.js';
import { createCombat, tryFire, updateCombat } from './combat.js';
import { createStory, currentInteract, currentObjective, doInteract, updateMissions } from './missions.js';
import { renderWorld } from './render.js';
import { drawHud } from './hud.js';
import { clearSave, loadSave, storeSave } from './save.js';
import { makeRng } from './rng.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const shotSeed = Number(params.get('seed') ?? 1) || 1;

const G = {
  mode: 'title',
  frozen: false,
  staging: false,
  pilot: null,
  time: 0,
  step: 0,
  playTime: 0,
  view: { width: innerWidth, height: innerHeight },
  camera: { x: 1500, y: 900, zoom: 0.62 },
  rng: makeRng(shotSeed * 7919 + 13),
  city: null,
  cars: [],
  peds: [],
  pedNodes: [],
  skids: [],
  tracers: [],
  particles: [],
  popups: [],
  notices: [],
  player: { x: PLACES.playerStart.x, y: PLACES.playerStart.y, vx: 0, vy: 0, angle: -Math.PI / 2, hp: 100, inCar: null, hitCooldown: 0 },
  stats: { cash: 250, storyDone: 0, jobsDone: 0 },
  wanted: createWanted(),
  combat: createCombat(),
  story: createStory(),
  missionCar: null,
  objective: null,
  prompt: null,
  banner: null,
  threat: null,
  shake: 0,
  hurtT: 0,
  aimAngle: -Math.PI / 2,
  audio: createAudio(),
  input: createInput(canvas),
  saveTimer: -1,
  lastObjectiveText: '',
};
window.__CB = G;

G.reportCrime = (kind, x, y) => reportCrime(G, kind, x, y);
G.spawnParticles = (x, y, count, color) => {
  for (let index = 0; index < count; index += 1) {
    const angle = G.rng.range(0, Math.PI * 2);
    const speed = G.rng.range(20, 130);
    G.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 26,
      t: 0,
      life: G.rng.range(0.35, 0.8),
      color,
      size: G.rng.range(2.4, 5),
    });
  }
};
G.popup = (x, y, text) => G.popups.push({ x, y, text, t: 0 });
G.notify = (text) => {
  G.notices.push({ text, t: 0 });
  if (G.notices.length > 4) G.notices.shift();
};
G.showBanner = (title, sub) => {
  G.banner = { title, sub, t: 0 };
};
G.saveSoon = () => {
  G.saveTimer = 1.4;
};
G.onBusted = () => {
  if (G.staging || G.mode !== 'play') return;
  const fine = Math.min(G.stats.cash, 150 + Math.round(G.stats.cash * 0.1));
  G.stats.cash -= fine;
  setHeat(G, 0);
  G.wanted.bust = 0;
  showEnd('BUSTED', `The CBPD got their collar. The fine is $${fine.toLocaleString('en-US')} and the night is gone — you walk out of the station at dawn.`);
  G.audio.fail();
};
G.framePrep = () => framePrep();

function buildWorld(stage = 'meet') {
  G.city = buildCity(CITY_SEED);
  G.cars = [];
  G.peds = [];
  G.skids = [];
  G.tracers = [];
  G.particles = [];
  G.popups = [];
  G.missionCar = null;
  spawnVehicles(G);
  spawnPeds(G, 42);
  G.story = createStory(stage);
  G.wanted = createWanted();
  G.player.x = PLACES.playerStart.x;
  G.player.y = PLACES.playerStart.y;
  G.player.vx = 0;
  G.player.vy = 0;
  G.player.hp = 100;
  G.player.inCar = null;
}

function snapshot() {
  return {
    cash: G.stats.cash,
    storyDone: G.stats.storyDone,
    jobsDone: G.stats.jobsDone,
    stage: G.story.stage,
    x: Math.round(G.player.x),
    y: Math.round(G.player.y),
  };
}

function applySave(data) {
  G.stats.cash = data.cash;
  G.stats.storyDone = data.storyDone ?? 0;
  G.stats.jobsDone = data.jobsDone ?? 0;
  buildWorld(data.stage ?? 'meet');
  if (typeof data.x === 'number' && typeof data.y === 'number' && !G.player.inCar) {
    const resolved = collideCircle(G.city, data.x, data.y, 11);
    G.player.x = resolved.x;
    G.player.y = resolved.y;
  }
}

// ---------- screens ----------

const titleScreen = document.getElementById('title-screen');
const pauseMenu = document.getElementById('pause-menu');
const endScreen = document.getElementById('end-screen');
const endTitle = document.getElementById('end-title');
const endText = document.getElementById('end-text');
const continueButton = document.getElementById('btn-continue');

function showEnd(title, text) {
  G.mode = title === 'BUSTED' ? 'busted' : 'wasted';
  endTitle.textContent = title;
  endText.textContent = text;
  endScreen.classList.remove('hidden');
}

function startPlay(fresh) {
  G.audio.unlock();
  if (fresh) {
    clearSave();
    G.stats = { cash: 250, storyDone: 0, jobsDone: 0 };
    buildWorld('meet');
  }
  titleScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  G.mode = 'play';
  G.playTime = 0;
}

document.getElementById('btn-new').addEventListener('click', () => startPlay(true));
continueButton.addEventListener('click', () => {
  const data = loadSave();
  if (data) applySave(data);
  startPlay(false);
});
document.getElementById('btn-resume').addEventListener('click', () => {
  pauseMenu.classList.add('hidden');
  G.mode = 'play';
});
document.getElementById('btn-restart').addEventListener('click', () => startPlay(true));
document.getElementById('btn-again').addEventListener('click', () => {
  endScreen.classList.add('hidden');
  if (G.mode === 'busted') {
    respawnAtStation(G);
  } else {
    G.player.x = PLACES.hospital.x;
    G.player.y = PLACES.hospital.y;
    G.player.inCar = null;
  }
  G.player.hp = 100;
  G.player.vx = 0;
  G.player.vy = 0;
  G.mode = 'play';
  G.saveSoon();
});
if (!loadSave()) continueButton.disabled = true;

// ---------- simulation ----------

function stepWorld(dt) {
  G.time += dt;
  G.step += 1;
  for (const car of G.cars) {
    if (car.traffic && !car.playerIn) updateTrafficCar(G, car, dt);
    else if (car.cop && !car.parked) {
      // Police are stepped by updatePolice; parked cars sleep.
    } else if (!car.parked && !car.playerIn && speedOf(car) > 2) {
      stepVehicle(G, car, { steer: 0, throttle: 0, handbrake: false }, dt); // a driverless car rolls out
    }
  }
  updatePeds(G, dt);
  if (G.mode === 'title') return;

  updatePlayer(dt);
  updatePolice(G, dt);
  updateCombat(G, dt);
  if (!G.staging) updateMissions(G, dt);

  // Effects and timers.
  for (const skid of G.skids) skid.t += dt;
  G.skids = G.skids.filter((skid) => skid.t < 40);
  for (const tracer of G.tracers) tracer.t -= dt;
  G.tracers = G.tracers.filter((tracer) => tracer.t > 0);
  for (const p of G.particles) {
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 190 * dt;
  }
  G.particles = G.particles.filter((p) => p.t < p.life);
  for (const popup of G.popups) popup.t += dt;
  G.popups = G.popups.filter((popup) => popup.t < 1.4);
  for (const notice of G.notices) notice.t += dt;
  G.notices = G.notices.filter((notice) => notice.t < 3.6);
  if (G.banner) {
    G.banner.t += dt;
    if (G.banner.t > 4.4) G.banner = null;
  }
  G.shake = Math.max(0, G.shake - dt * 26);
  G.hurtT = Math.max(0, G.hurtT - dt * 1.6);
  if (G.saveTimer > 0) {
    G.saveTimer -= dt;
    if (G.saveTimer <= 0) storeSave(snapshot());
  }
  // A wreck smoulders.
  for (const car of G.cars) {
    if (car.wrecked && G.step % 9 === 0) {
      G.spawnParticles(car.x + G.rng.range(-8, 8), car.y - 8, 1, '#6b7280');
    }
  }
}

function updatePlayer(dt) {
  const player = G.player;
  const input = G.input;
  player.hitCooldown = Math.max(0, player.hitCooldown - dt);
  G.playTime += dt;

  if (player.inCar) {
    const car = player.inCar;
    const axes = input.axes();
    const control = G.pilot ?? {
      steer: axes.x,
      throttle: -axes.y,
      handbrake: input.down('ShiftLeft', 'ShiftRight'),
    };
    stepVehicle(G, car, control, dt);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    if (input.justPressed('KeyE') && Math.abs(forwardSpeed(car)) < 26) exitCar();
    const ratio = Math.abs(forwardSpeed(car)) / car.spec.maxSpeed;
    G.audio.engine(ratio, true);
    return;
  }

  G.audio.engine(0, false);
  const axes = input.axes();
  const running = input.down('ShiftLeft', 'ShiftRight');
  const maxSpeed = running ? 219 : 148;
  const accel = 1500;
  player.vx += axes.x * accel * dt;
  player.vy += axes.y * accel * dt;
  const speed = Math.hypot(player.vx, player.vy);
  if (axes.x === 0 && axes.y === 0) {
    const drag = Math.exp(-9 * dt);
    player.vx *= drag;
    player.vy *= drag;
  } else if (speed > maxSpeed) {
    player.vx *= maxSpeed / speed;
    player.vy *= maxSpeed / speed;
  }
  const resolved = collideCircle(G.city, player.x + player.vx * dt, player.y + player.vy * dt, 11);
  player.x = resolved.x;
  player.y = resolved.y;
  if (speed > 12) player.angle = Math.atan2(player.vy, player.vx);

  // Traffic and police can still run Rio down.
  if (player.hitCooldown <= 0) {
    for (const car of G.cars) {
      if (car.parked) continue;
      const carSpeed = Math.hypot(car.vx, car.vy);
      if (carSpeed < 95) continue;
      if (Math.hypot(car.x - player.x, car.y - player.y) < car.spec.length * 0.37 + 12) {
        player.hp -= car.cop ? 15 : 11;
        player.vx += car.vx * 0.55;
        player.vy += car.vy * 0.55;
        player.hitCooldown = 0.9;
        G.hurtT = 1;
        G.shake = Math.max(G.shake, 6);
        G.audio.crash(false);
        break;
      }
    }
  }

  // Aim and fire.
  const worldMouse = screenToWorld(input.mouse.x, input.mouse.y);
  G.aimAngle = Math.atan2(worldMouse.y - player.y, worldMouse.x - player.x);
  if (input.mouse.down) tryFire(G, G.aimAngle);

  if (input.justPressed('KeyE')) {
    if (!doInteract(G)) {
      const car = nearestCar(G, player.x, player.y, 54);
      if (car) enterCar(car);
    }
  }

  // Slow recovery once the trouble is past.
  if (player.hp > 0 && player.hp < 100 && G.time - G.wanted.lastCrime > 5) {
    player.hp = Math.min(100, player.hp + dt * 1.5);
  }
  if (player.hp <= 0 && !G.staging) {
    const cost = Math.min(200, G.stats.cash);
    G.stats.cash -= cost;
    setHeat(G, Math.floor(G.wanted.heat / 2));
    showEnd('WASTED', `San Brisa patched Rio up and billed $${cost}. The city kept everything else.`);
    G.audio.fail();
  }
}

function enterCar(car) {
  const player = G.player;
  car.playerIn = true;
  car.parked = false;
  if (car.traffic) car.traffic = null;
  player.inCar = car;
  player.vx = 0;
  player.vy = 0;
  G.audio.door();
  if (!car.stolen) {
    car.stolen = true;
    // A theft needs a witness: a pedestrian close by, or any police in earshot.
    const witnessed = G.peds.some((ped) => Math.hypot(ped.x - car.x, ped.y - car.y) < 170)
      || G.cars.some((other) => other.cop && Math.hypot(other.x - car.x, other.y - car.y) < 330);
    if (witnessed) G.reportCrime('theft', car.x, car.y);
    if (car.cop) G.notify('You just stole a police interceptor. Bold.');
    else if (car.missionCar) G.notify('The Sable is yours. Tito is waiting.');
  }
  G.saveSoon();
}

function exitCar() {
  const car = G.player.inCar;
  if (!car) return;
  car.playerIn = false;
  const side = car.angle + Math.PI / 2;
  const resolved = collideCircle(G.city, car.x + Math.cos(side) * 30, car.y + Math.sin(side) * 30, 11);
  G.player.x = resolved.x;
  G.player.y = resolved.y;
  G.player.inCar = null;
  G.audio.door();
  G.audio.engine(0, false);
}

function screenToWorld(screenX, screenY) {
  const cam = G.camera;
  return {
    x: cam.x + (screenX - G.view.width / 2) / cam.zoom,
    y: cam.y + (screenY - G.view.height / 2) / cam.zoom,
  };
}

/** Objective, prompt and camera for the frame about to be drawn. */
function framePrep() {
  G.objective = currentObjective(G);
  const objectiveText = G.objective?.text ?? '';
  if (objectiveText !== G.lastObjectiveText) {
    G.lastObjectiveText = objectiveText;
    const status = document.getElementById('status');
    if (status) status.textContent = objectiveText;
  }
  computePrompt();
  updateCamera();
}

function computePrompt() {
  const player = G.player;
  if (G.mode !== 'play') {
    G.prompt = null;
    return;
  }
  if (player.inCar) {
    const car = player.inCar;
    G.prompt = car.wrecked
      ? 'E — Get out of the wreck'
      : Math.abs(forwardSpeed(car)) < 26
        ? `E — Exit the ${car.name}`
        : null;
    return;
  }
  const interact = currentInteract(G);
  if (interact) {
    G.prompt = interact.text;
    return;
  }
  const car = nearestCar(G, player.x, player.y, 54);
  if (car) {
    G.prompt = car.missionCar
      ? 'E — Steal the Vantek Sable'
      : car.cop
        ? 'E — Steal the CBPD Interceptor'
        : `E — Enter the ${car.name}`;
    return;
  }
  G.prompt = null;
}

const TITLE_WAYPOINTS = [
  { x: 1440, y: 880 },
  { x: 2400, y: 1290 },
  { x: 3300, y: 1290 },
  { x: 2880, y: 2140 },
  { x: 960, y: 420 },
];
let titleWaypoint = 0;

function updateCamera() {
  const cam = G.camera;
  if (G.camOverride) {
    const override = G.camOverride;
    if (override.follow) {
      const focus = G.player.inCar ?? G.player;
      cam.x = focus.x;
      cam.y = focus.y;
    } else {
      cam.x = override.x;
      cam.y = override.y;
    }
    cam.zoom = override.zoom;
    return;
  }
  let targetX;
  let targetY;
  let targetZoom;
  if (G.mode === 'title') {
    const point = TITLE_WAYPOINTS[titleWaypoint];
    targetX = point.x;
    targetY = point.y;
    targetZoom = 0.6;
    if (Math.hypot(cam.x - targetX, cam.y - targetY) < 60) {
      titleWaypoint = (titleWaypoint + 1) % TITLE_WAYPOINTS.length;
    }
  } else {
    const focus = G.player.inCar ?? G.player;
    targetX = focus.x + (focus.vx ?? 0) * 0.34;
    targetY = focus.y + (focus.vy ?? 0) * 0.34;
    targetZoom = G.player.inCar ? 0.84 - Math.min(0.12, Math.abs(forwardSpeed(G.player.inCar)) / G.player.inCar.spec.maxSpeed * 0.12) : 1.0;
    if (G.frozen) {
      cam.x = targetX;
      cam.y = targetY;
      cam.zoom = targetZoom;
    }
  }
  const rate = G.mode === 'title' ? 0.35 : 4.6;
  const blend = 1 - Math.exp(-rate * (1 / 60));
  cam.x += (targetX - cam.x) * blend;
  cam.y += (targetY - cam.y) * blend;
  cam.zoom += (targetZoom - cam.zoom) * blend;
  cam.x = Math.max(0, Math.min(3840, cam.x));
  cam.y = Math.max(0, Math.min(2520, cam.y));
}

// ---------- boot and loop ----------

function resize() {
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  canvas.dataset.dpr = String(dpr);
  G.view = { width: innerWidth, height: innerHeight };
}
window.addEventListener('resize', resize);
resize();

buildWorld('meet');

if (shotName) {
  titleScreen.classList.add('hidden');
  G.mode = 'play';
  stageShot(G, shotName, stepWorld);
  G.frozen = true;
  framePrep();
  renderFrame();
  window.__SHOT_READY = true;
}

function renderFrame() {
  const dpr = Number(canvas.dataset.dpr ?? 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (G.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
  }
  renderWorld(G, ctx);
  drawHud(G, ctx);
}

let lastTime = performance.now();
let accumulator = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let frameSeconds = (now - lastTime) / 1000;
  lastTime = now;
  if (frameSeconds > 0.25) frameSeconds = 0.25;
  if (G.frozen) {
    renderFrame();
    return;
  }
  // Pause and end screens hold the world still behind their panels.
  if (G.mode === 'pause' || G.mode === 'busted' || G.mode === 'wasted') {
    if (G.mode === 'pause' && (G.input.justPressed('KeyP') || G.input.justPressed('Escape'))) {
      pauseMenu.classList.add('hidden');
      G.mode = 'play';
    }
    renderFrame();
    G.input.endFrame();
    return;
  }
  accumulator += frameSeconds;
  let steps = 0;
  while (accumulator >= STEP && steps < 5) {
    stepWorld(STEP);
    accumulator -= STEP;
    steps += 1;
  }
  if (steps === 5) accumulator = 0;

  const input = G.input;
  if (G.mode === 'play' && (input.justPressed('KeyP') || input.justPressed('Escape'))) {
    G.mode = 'pause';
    pauseMenu.classList.remove('hidden');
    storeSave(snapshot());
  }
  if (input.justPressed('KeyM')) {
    G.audio.setMuted(!G.audio.isMuted());
    G.notify(G.audio.isMuted() ? 'Sound off.' : 'Sound on.');
  }
  framePrep();
  renderFrame();
  input.endFrame();
}
requestAnimationFrame(loop);
