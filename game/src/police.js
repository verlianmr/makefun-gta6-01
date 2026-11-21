// The Costa Brisa PD: a heat ladder from a stern look to a full five-star swarm, interceptor
// drivers who hunt the player's position (and fall back to the roads when a building gets in
// the way), and the bust meter that fills while they sit on top of you and drains as you run.

import { CRIME_HEAT, HEAT_FOR_STAR, PLACES } from './config.js';
import { nearestRoadPoint } from './city.js';
import { angleDiff, angleOf, forwardSpeed, makeCar, speedOf, stepVehicle } from './cars.js';
import { makeThreat } from './peds.js';

export function createWanted() {
  return { heat: 0, stars: 0, lastCrime: -99, bust: 0, spawnCooldown: 0, ramCooldown: 0 };
}

export function starsForHeat(heat) {
  let stars = 0;
  for (let index = 1; index < HEAT_FOR_STAR.length; index += 1) {
    if (heat >= HEAT_FOR_STAR[index]) stars = index;
  }
  return stars;
}

/** A crime the city noticed: heat goes up, the block startles, the clock restarts. */
export function reportCrime(G, kind, x, y) {
  const heat = CRIME_HEAT[kind] ?? 0;
  if (heat <= 0) return;
  G.wanted.heat += heat;
  G.wanted.lastCrime = G.time;
  if (kind === 'shot' || kind === 'pedHit' || kind === 'copHit') makeThreat(G, x, y);
}

export function setHeat(G, heat) {
  G.wanted.heat = heat;
  G.wanted.lastCrime = G.time;
}

export function updatePolice(G, dt) {
  const wanted = G.wanted;
  const player = G.player;
  wanted.stars = starsForHeat(wanted.heat);

  // Heat cools only once the crimes stop and no interceptor is watching.
  const cops = G.cars.filter((car) => car.cop && !car.parked && !car.playerIn);
  let nearestCop = Infinity;
  for (const cop of cops) {
    nearestCop = Math.min(nearestCop, Math.hypot(cop.x - player.x, cop.y - player.y));
  }
  const cooling = G.time - wanted.lastCrime > 6 && nearestCop > 280;
  if (cooling && wanted.heat > 0) wanted.heat = Math.max(0, wanted.heat - 4.2 * dt);
  wanted.cooling = cooling && wanted.heat > 0;

  const desired = wanted.stars === 0 ? 0 : wanted.stars + 1;
  wanted.spawnCooldown -= dt;
  if (cops.length < desired && wanted.spawnCooldown <= 0) {
    spawnInterceptor(G);
    wanted.spawnCooldown = 1.4;
  }

  for (const cop of cops) {
    const dist = Math.hypot(cop.x - player.x, cop.y - player.y);
    if (wanted.stars === 0) {
      // The heat is gone: near cars just sit and watch, far ones drift back to patrol.
      if (dist > 200) cop.retired = true;
      continue;
    }
    if (dist > 1150 && wanted.stars < 3) {
      cop.retired = true;
      continue;
    }
    driveCop(G, cop, dt, dist);
  }
  G.cars = G.cars.filter((car) => !car.retired);

  // The bust meter: it fills while an interceptor sits on the player, drains as they break away.
  const playerSpeed = player.inCar ? Math.abs(forwardSpeed(player.inCar)) : Math.hypot(player.vx, player.vy);
  const bustRange = player.inCar ? 64 : 80;
  if (nearestCop < bustRange && playerSpeed < 48 && wanted.stars > 0) {
    wanted.bust = Math.min(1, wanted.bust + dt * 0.42);
  } else {
    wanted.bust = Math.max(0, wanted.bust - dt * 0.3);
  }
  if (wanted.bust >= 1) {
    G.onBusted?.();
    wanted.bust = 0;
  }

  // A fast interceptor clips a walking player hard.
  wanted.ramCooldown -= dt;
  if (!player.inCar && wanted.ramCooldown <= 0) {
    for (const cop of cops) {
      if (Math.hypot(cop.x - player.x, cop.y - player.y) < 30 && speedOf(cop) > 110) {
        player.hp -= 16;
        player.vx += cop.vx * 0.6;
        player.vy += cop.vy * 0.6;
        wanted.ramCooldown = 1.1;
        G.shake = Math.max(G.shake, 7);
        G.audio.crash(false);
        break;
      }
    }
  }

  const closeness = wanted.stars > 0 && nearestCop < 460 ? 1 - nearestCop / 460 : 0;
  G.audio.siren(closeness);
}

function spawnInterceptor(G) {
  const player = G.player;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const angle = G.rng.range(0, Math.PI * 2);
    const dist = G.rng.range(560, 720);
    const guess = {
      x: Math.max(40, Math.min(3580, player.x + Math.cos(angle) * dist)),
      y: Math.max(40, Math.min(2480, player.y + Math.sin(angle) * dist)),
    };
    const road = nearestRoadPoint(guess.x, guess.y);
    const cop = makeCar('interceptor', road.x, road.y, angleOf(player.x - road.x, player.y - road.y), { cop: true, color: '#f6f0e6' });
    G.cars.push(cop);
    return;
  }
}

function driveCop(G, cop, dt, distToPlayer) {
  const player = G.player;
  if (cop.wrecked) return;
  let aimX = player.x;
  let aimY = player.y;
  // If a building blocks the straight line, hunt the road nearest the player instead.
  const steps = 6;
  for (let index = 1; index <= steps; index += 1) {
    const x = cop.x + ((player.x - cop.x) * index) / steps;
    const y = cop.y + ((player.y - cop.y) * index) / steps;
    let blocked = false;
    for (const box of G.city.solids) {
      if (x > box.x && x < box.x + box.w && y > box.y && y < box.y + box.h) {
        blocked = true;
        break;
      }
    }
    if (blocked) {
      const road = nearestRoadPoint(player.x, player.y);
      aimX = road.x;
      aimY = road.y;
      break;
    }
  }
  const steer = Math.max(-1, Math.min(1, angleDiff(cop.angle, angleOf(aimX - cop.x, aimY - cop.y)) * 2.6));
  let throttle = 1;
  if (!player.inCar && distToPlayer < 62) throttle = forwardSpeed(cop) > 26 ? -0.7 : 0; // pull up beside a walker
  if (player.inCar && distToPlayer < 40) throttle = 0.25; // sit on the bumper, fill the meter
  stepVehicle(G, cop, { steer, throttle, handbrake: Math.abs(steer) > 0.9 && speedOf(cop) > 200 }, dt);
}

/** Where the busted wake up: the station steps, poorer and unhurried. */
export function respawnAtStation(G) {
  G.player.x = PLACES.policeStation.x;
  G.player.y = PLACES.policeStation.y;
  G.player.inCar = null;
}
