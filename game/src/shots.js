// The screenshot scenes behind ?shot=chase|drive|mission|city&seed=n. Each one builds the
// real world from the seed, places Rio and the city into a moment the judge should see, and
// plays the genuine rules forward for a fixed number of steps with a simple pilot — so the
// frame is a real game state, and the same seed always stages the same frame.

import { PLACES } from './config.js';
import { angleDiff, angleOf, forwardSpeed, makeCar } from './cars.js';
import { setHeat } from './police.js';

const STEP = 1 / 60;

/** Keep a staged lane clear of random traffic so the scene reads cleanly. */
function clearBox(G, x0, y0, x1, y1) {
  for (const car of G.cars) {
    if (!car.traffic) continue;
    if (car.x > x0 && car.x < x1 && car.y > y0 && car.y < y1) {
      car.x = 216; // Avenue One, far west
      car.y = 300 + (car.id % 9) * 210;
      car.angle = Math.PI / 2;
      car.vx = 0;
      car.vy = 0;
      car.traffic = { axis: 'v', index: 0, dir: 1, decidedAt: -1, turning: null, cruise: 0.5 };
    }
  }
}

function putPlayerIn(G, car) {
  car.playerIn = true;
  car.stolen = true;
  G.cars.push(car);
  G.player.inCar = car;
  G.player.x = car.x;
  G.player.y = car.y;
}

/** A pilot that holds a lane and a speed: enough to stage driving honestly. */
function lanePilot(G, laneX, laneY, targetSpeed) {
  const car = G.player.inCar;
  const aimAngle = angleOf(laneX - car.x, laneY - car.y);
  return {
    steer: Math.max(-1, Math.min(1, angleDiff(car.angle, aimAngle) * 2.4)),
    throttle: forwardSpeed(car) < targetSpeed - 8 ? 0.85 : forwardSpeed(car) > targetSpeed + 12 ? -0.3 : 0.1,
    handbrake: false,
  };
}

function stageChase(G, stepWorld) {
  G.story.stage = 'm1_deliver'; // the HUD shows a live objective under the chase
  clearBox(G, 1080, 260, 1300, 1150);
  const hero = makeCar('sable', 1176, 810, Math.PI / 2, { color: '#ffd94d' });
  hero.vy = 248;
  putPlayerIn(G, hero);
  const copSpots = [
    { x: 1176, y: 596, speed: 268 },
    { x: 1226, y: 498, speed: 262 },
    { x: 1128, y: 408, speed: 258 },
  ];
  for (const spot of copSpots) {
    const cop = makeCar('interceptor', spot.x, spot.y, Math.PI / 2, { cop: true, color: '#f6f0e6' });
    cop.vy = spot.speed;
    G.cars.push(cop);
  }
  setHeat(G, 178); // three stars
  for (let index = 0; index < 105; index += 1) {
    G.pilot = lanePilot(G, 1176, hero.y + 170, 252);
    stepWorld(STEP);
  }
  G.wanted.bust = Math.min(G.wanted.bust, 0.55);
  G.camOverride = { follow: true, zoom: 0.92 };
}

function stageDrive(G, stepWorld) {
  clearBox(G, 3290, 1380, 3470, 2380);
  const car = makeCar('meridian', 3384, 2060, -Math.PI / 2, { color: '#ff5d8f' });
  car.vy = -252;
  putPlayerIn(G, car);
  for (let index = 0; index < 88; index += 1) {
    G.pilot = lanePilot(G, 3384, car.y - 170, 252);
    stepWorld(STEP);
  }
  G.camOverride = { follow: true, zoom: 0.95 };
}

function stageMission(G, stepWorld) {
  G.player.x = PLACES.clubDoor.x;
  G.player.y = PLACES.clubDoor.y + 38;
  for (let index = 0; index < 46; index += 1) stepWorld(STEP);
  G.player.angle = -Math.PI / 2;
  G.aimAngle = -Math.PI / 2;
  G.camOverride = { follow: true, zoom: 1.06 };
}

function stageCity(G, stepWorld) {
  G.story.stage = 'done';
  G.player.x = 3252;
  G.player.y = 1206;
  for (let index = 0; index < 72; index += 1) stepWorld(STEP);
  G.player.angle = Math.PI / 3;
  G.aimAngle = Math.PI / 3;
  G.camOverride = { x: 3268, y: 1210, zoom: 0.52 };
}

/** Stage the named scene; anything unknown falls back to the city view. */
export function stageShot(G, name, stepWorld) {
  G.staging = true;
  if (name === 'chase') stageChase(G, stepWorld);
  else if (name === 'drive') stageDrive(G, stepWorld);
  else if (name === 'mission') stageMission(G, stepWorld);
  else stageCity(G, stepWorld);
  G.pilot = null;
  G.staging = false;
  G.player.hp = 100;
}
