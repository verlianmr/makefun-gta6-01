// Combat, kept simple and loud: on foot, Rio's pistol is a hitscan with a tracer, a crack
// of noise and a kick of heat. Cars dent, people go down (and get up), police take it badly.

import { damageCar } from './cars.js';

const RANGE = 430;
const FIRE_INTERVAL = 0.15;

export function createCombat() {
  return { cooldown: 0, shots: 0 };
}

/** Try to fire along aimAngle from the player; returns true when a shot actually left. */
export function tryFire(G, aimAngle) {
  const combat = G.combat;
  if (G.player.inCar || combat.cooldown > 0) return false;
  combat.cooldown = FIRE_INTERVAL;
  combat.shots += 1;
  const player = G.player;
  const startX = player.x + Math.cos(aimAngle) * 14;
  const startY = player.y + Math.sin(aimAngle) * 14;
  let endX = startX + Math.cos(aimAngle) * RANGE;
  let endY = startY + Math.sin(aimAngle) * RANGE;

  let bestT = 1;
  let hitPed = null;
  let hitCar = null;
  const steps = Math.floor(RANGE / 6);
  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    if (t >= bestT) break;
    const x = startX + Math.cos(aimAngle) * RANGE * t;
    const y = startY + Math.sin(aimAngle) * RANGE * t;
    let stop = false;
    for (const box of G.city.solids) {
      if (x > box.x && x < box.x + box.w && y > box.y && y < box.y + box.h) {
        stop = true;
        break;
      }
    }
    if (stop) {
      bestT = t;
      hitPed = null;
      hitCar = null;
      break;
    }
    for (const ped of G.peds) {
      if (ped.state === 'down') continue;
      if ((ped.x - x) ** 2 + (ped.y - y) ** 2 < 12 * 12) {
        bestT = t;
        hitPed = ped;
        hitCar = null;
        stop = true;
        break;
      }
    }
    if (stop) break;
    for (const car of G.cars) {
      if (car.playerIn) continue;
      const radius = car.spec.length * 0.42;
      if ((car.x - x) ** 2 + (car.y - y) ** 2 < radius * radius) {
        bestT = t;
        hitCar = car;
        hitPed = null;
        break;
      }
    }
  }
  endX = startX + Math.cos(aimAngle) * RANGE * bestT;
  endY = startY + Math.sin(aimAngle) * RANGE * bestT;

  G.tracers.push({ x1: startX, y1: startY, x2: endX, y2: endY, t: 0.07 });
  G.spawnParticles?.(startX, startY, 2, '#ffd94d');
  G.audio.shot();
  G.reportCrime?.('shot', player.x, player.y);

  if (hitPed) {
    hitPed.state = 'down';
    hitPed.timer = 9;
    G.reportCrime?.('pedHit', hitPed.x, hitPed.y);
    G.spawnParticles?.(endX, endY, 7, '#e8ddc4');
  } else if (hitCar) {
    damageCar(G, hitCar, 9, endX, endY);
    if (hitCar.cop) G.reportCrime?.('carHit', hitCar.x, hitCar.y);
  }
  return true;
}

export function updateCombat(G, dt) {
  G.combat.cooldown = Math.max(0, G.combat.cooldown - dt);
}
