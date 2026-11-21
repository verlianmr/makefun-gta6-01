// Cars: one arcade vehicle model shared by traffic, police and the player, so everything on
// the road feels the same. Traffic follows its lane from aim point to aim point and turns at
// intersections; police and the player steer the same cars their own way (police.js, main.js).

import { AVENUES_X, CAR_COLORS, CAR_TYPES, LANE_OFFSET, STREETS_Y, TRAFFIC_TYPES } from './config.js';
import { collideCircle, nearestRoadPoint } from './city.js';

export const angleOf = (dx, dy) => Math.atan2(dy, dx);
export function angleDiff(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}
export const forwardSpeed = (car) => car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
export const speedOf = (car) => Math.hypot(car.vx, car.vy);

let nextCarId = 1;
export function makeCar(type, x, y, angle, options = {}) {
  const spec = CAR_TYPES[type];
  return {
    id: nextCarId++,
    type,
    name: spec.name,
    spec,
    x, y, angle,
    vx: 0, vy: 0,
    hp: spec.hp,
    color: options.color ?? '#f6f0e6',
    parked: options.parked ?? false,
    cop: options.cop ?? false,
    missionCar: options.missionCar ?? false,
    playerIn: false,
    wrecked: false,
    traffic: null,
    stuckTime: 0,
    sirenPhase: Math.random() * Math.PI * 2,
  };
}

/** Lane centre coordinate for a car on a road: right-hand traffic, both axes. */
export function laneCoord(axis, index, dir) {
  return axis === 'v' ? AVENUES_X[index] - LANE_OFFSET * dir : STREETS_Y[index] + LANE_OFFSET * dir;
}
export function headingAngle(axis, dir) {
  return axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
}

/** Fill the lots with stealable parked cars and set traffic rolling. Called once per world. */
export function spawnVehicles(G) {
  const rng = G.rng;
  for (const lot of G.city.lots) {
    lot.spots.forEach((spot, index) => {
      if (lot.police) {
        G.cars.push(makeCar('interceptor', spot.x, spot.y, spot.angle, { parked: true, cop: true, color: '#f6f0e6' }));
        return;
      }
      const isMarina = Math.abs(lot.x + lot.w / 2 - 3240) < 90 && Math.abs(lot.y + lot.h / 2 - 1290) < 110;
      if (isMarina && index === 0) {
        const sable = makeCar('sable', spot.x, spot.y, spot.angle, { parked: true, missionCar: true, color: '#e63946' });
        G.missionCar = sable;
        G.cars.push(sable);
        return;
      }
      if (rng.chance(0.68)) {
        G.cars.push(makeCar(rng.pick(TRAFFIC_TYPES), spot.x, spot.y, spot.angle, { parked: true, color: rng.pick(CAR_COLORS) }));
      }
    });
  }
  // Two working vans down at the docks.
  G.cars.push(makeCar('mule', 2740, 2248, 0, { parked: true, color: '#84ceeb' }));
  G.cars.push(makeCar('mule', 3030, 2248, Math.PI, { parked: true, color: '#ffb35c' }));
  for (let index = 0; index < 13; index += 1) G.cars.push(spawnTrafficCar(G, true));
}

export function spawnTrafficCar(G, anywhere = false) {
  const rng = G.rng;
  const axis = rng.chance(0.5) ? 'v' : 'h';
  const index = axis === 'v' ? rng.int(0, AVENUES_X.length - 1) : rng.int(0, STREETS_Y.length - 1);
  const dir = rng.chance(0.5) ? 1 : -1;
  let along = axis === 'v' ? rng.range(80, 2440) : rng.range(80, 3760);
  if (!anywhere) {
    // Respawn near the player but out of sight, on the road the player is closest to.
    const focus = G.player;
    along = axis === 'v'
      ? Math.max(60, Math.min(2460, focus.y + rng.range(-950, 950)))
      : Math.max(60, Math.min(3780, focus.x + rng.range(-950, 950)));
  }
  const lane = laneCoord(axis, index, dir);
  const car = makeCar(rng.pick(TRAFFIC_TYPES), axis === 'v' ? lane : along, axis === 'v' ? along : lane,
    headingAngle(axis, dir), { color: rng.pick(CAR_COLORS) });
  car.traffic = { axis, index, dir, decidedAt: -1, turning: null, cruise: rng.range(0.42, 0.58) };
  return car;
}

/**
 * Advance one car one step under a control { steer: -1..1, throttle: -1..1, handbrake }.
 * Handles drift, building and car collisions, pedestrian hits and skid marks, and reports
 * crimes through G.reportCrime when the player is the one driving.
 */
export function stepVehicle(G, car, control, dt) {
  if (car.wrecked) {
    car.vx *= 0.9;
    car.vy *= 0.9;
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    return;
  }
  const spec = car.spec;
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  let fSpeed = car.vx * cos + car.vy * sin;
  let rSpeed = car.vx * -sin + car.vy * cos;

  if (control.throttle > 0) fSpeed += spec.accel * control.throttle * dt * (fSpeed < 0 ? 2.2 : 1);
  else if (control.throttle < 0) fSpeed += spec.accel * control.throttle * dt * (fSpeed > 12 ? 2.4 : 0.62);
  fSpeed -= fSpeed * 0.42 * dt;
  if (fSpeed > spec.maxSpeed) fSpeed = Math.max(spec.maxSpeed, fSpeed - 260 * dt);
  if (fSpeed < -spec.maxSpeed * 0.36) fSpeed = -spec.maxSpeed * 0.36;

  const grip = control.handbrake ? 2.1 : 8.5;
  rSpeed *= Math.exp(-grip * dt);
  const authority = Math.max(-1, Math.min(1, fSpeed / 130));
  car.angle += control.steer * 2.25 * authority * dt * (control.handbrake ? 1.45 : 1);

  const ncos = Math.cos(car.angle);
  const nsin = Math.sin(car.angle);
  car.vx = ncos * fSpeed - nsin * rSpeed;
  car.vy = nsin * fSpeed + ncos * rSpeed;

  const beforeX = car.x;
  const beforeY = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // Skid marks while the rear steps out or the tyres are lit up from a standstill.
  if ((Math.abs(rSpeed) > 52 && Math.abs(fSpeed) > 60) || (control.handbrake && Math.abs(fSpeed) > 40)) {
    G.skids.push({ x: car.x - ncos * 14, y: car.y - nsin * 14, t: 0 });
    if (G.skids.length > 420) G.skids.splice(0, G.skids.length - 420);
  }

  const radius = spec.length * 0.37;
  const resolved = collideCircle(G.city, car.x, car.y, radius);
  if (resolved.hit > 0) {
    const impact = Math.hypot(car.x - resolved.x, car.y - resolved.y) / Math.max(dt, 0.001);
    car.x = resolved.x;
    car.y = resolved.y;
    if (impact > 130) {
      damageCar(G, car, (impact - 110) * 0.05, car.x, car.y);
      if (car.playerIn) G.shake = Math.min(14, (impact - 110) * 0.03);
      G.audio.crash(impact > 320);
    }
    car.vx *= 0.42;
    car.vy *= 0.42;
  }

  // Car against car: a soft push apart, damage and heat when it is hard.
  for (const other of G.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const minDist = radius + other.spec.length * 0.37;
    const distSq = dx * dx + dy * dy;
    if (distSq >= minDist * minDist || distSq === 0) continue;
    const dist = Math.sqrt(distSq);
    const push = (minDist - dist) / 2;
    const nx = dx / dist;
    const ny = dy / dist;
    const otherShare = other.parked ? 0.25 : 0.5;
    car.x -= nx * push * (1 - otherShare + 0.25);
    car.y -= ny * push * (1 - otherShare + 0.25);
    other.x += nx * push * otherShare;
    other.y += ny * push * otherShare;
    const relSpeed = Math.abs((car.vx - other.vx) * nx + (car.vy - other.vy) * ny);
    if (relSpeed > 90) {
      damageCar(G, other, (relSpeed - 70) * 0.06, other.x, other.y);
      damageCar(G, car, (relSpeed - 70) * 0.05, car.x, car.y);
      if (car.playerIn || other.playerIn) {
        G.audio.crash(relSpeed > 240);
        G.shake = Math.min(12, relSpeed * 0.03);
        if (other.cop) G.reportCrime?.('copHit', other.x, other.y);
        else G.reportCrime?.('carHit', other.x, other.y);
      } else if (other.cop && car.cop === false && car.traffic) {
        // Traffic clipping a police car is the city's problem, not the player's.
      }
    }
    if (other.parked) other.parked = false; // a shunted parked car is loose now
    car.vx *= 0.7;
    car.vy *= 0.7;
  }

  // Pedestrians in the path: only a moving car knocks anyone down.
  const speed = speedOf(car);
  if (speed > 55) {
    for (const ped of G.peds) {
      if (ped.state === 'down') continue;
      const dx = ped.x - car.x;
      const dy = ped.y - car.y;
      if (dx * dx + dy * dy < (radius + 10) * (radius + 10)) {
        ped.state = 'down';
        ped.timer = 7;
        ped.x += car.vx * 0.12;
        ped.y += car.vy * 0.12;
        G.spawnParticles?.(ped.x, ped.y, 8, '#e8ddc4');
        if (car.playerIn) {
          G.reportCrime?.('pedHit', ped.x, ped.y);
          G.shake = Math.max(G.shake, 5);
          G.audio.crash(false);
        }
      }
    }
  }
  void beforeX;
  void beforeY;
}

export function damageCar(G, car, amount, x, y) {
  if (amount <= 0 || car.wrecked) return;
  car.hp -= amount;
  G.spawnParticles?.(x, y, 5, '#ffd94d');
  if (car.hp <= 0) {
    car.hp = 0;
    car.wrecked = true;
    G.spawnParticles?.(x, y, 18, '#8a8f98');
    if (car.playerIn) G.notify?.('This car is wrecked — get out and find another.');
  }
}

/** One traffic car thinking: follow the lane, mind the car ahead, turn at intersections. */
export function updateTrafficCar(G, car, dt) {
  const t = car.traffic;
  if (!t) return;
  const crossings = t.axis === 'v' ? STREETS_Y : AVENUES_X;
  const along = t.axis === 'v' ? car.y : car.x;

  if (!t.turning) {
    for (let ci = 0; ci < crossings.length; ci += 1) {
      const centre = crossings[ci];
      const passed = t.dir > 0 ? along - centre : centre - along;
      if (passed > 0 && passed < 26 && t.decidedAt !== ci) {
        t.decidedAt = ci;
        const roll = G.rng.next();
        if (roll > 0.64) {
          const turnSign = roll > 0.82 ? 1 : -1;
          const newAngle = car.angle + turnSign * (Math.PI / 2);
          const newAxis = t.axis === 'v' ? 'h' : 'v';
          const newDir = newAxis === 'h' ? (Math.cos(newAngle) > 0 ? 1 : -1) : (Math.sin(newAngle) > 0 ? 1 : -1);
          t.turning = { axis: newAxis, index: ci, dir: newDir, centre };
        }
      }
    }
  }

  let aimX;
  let aimY;
  if (t.turning) {
    const lane = laneCoord(t.turning.axis, t.turning.index, t.turning.dir);
    if (t.turning.axis === 'v') {
      aimX = lane;
      aimY = t.turning.centre + t.turning.dir * 110;
    } else {
      aimX = t.turning.centre + t.turning.dir * 110;
      aimY = lane;
    }
    const alongNew = t.turning.axis === 'v' ? car.y : car.x;
    const past = t.turning.dir > 0 ? alongNew - t.turning.centre : t.turning.centre - alongNew;
    if (past > 62 && Math.abs(angleDiff(car.angle, headingAngle(t.turning.axis, t.turning.dir))) < 0.4) {
      t.axis = t.turning.axis;
      t.index = t.turning.index;
      t.dir = t.turning.dir;
      t.turning = null;
      t.decidedAt = -1;
    }
  } else {
    const lane = laneCoord(t.axis, t.index, t.dir);
    if (t.axis === 'v') {
      aimX = lane;
      aimY = car.y + t.dir * 130;
    } else {
      aimX = car.x + t.dir * 130;
      aimY = lane;
    }
  }

  // Something ahead? Match it or stop: bumpers are expensive.
  let desired = car.spec.maxSpeed * t.cruise;
  const probeX = car.x + Math.cos(car.angle) * 54;
  const probeY = car.y + Math.sin(car.angle) * 54;
  for (const other of G.cars) {
    if (other === car) continue;
    const dx = other.x - probeX;
    const dy = other.y - probeY;
    if (dx * dx + dy * dy < 34 * 34) {
      desired = Math.min(desired, Math.max(0, forwardSpeed(other) - 4));
    }
  }
  const player = G.player;
  if (!player.inCar) {
    const dx = player.x - probeX;
    const dy = player.y - probeY;
    if (dx * dx + dy * dy < 32 * 32) desired = 0;
  }
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    const dx = ped.x - probeX;
    const dy = ped.y - probeY;
    if (dx * dx + dy * dy < 30 * 30) desired = 0;
  }

  const fSpeed = forwardSpeed(car);
  const steer = Math.max(-1, Math.min(1, angleDiff(car.angle, angleOf(aimX - car.x, aimY - car.y)) * 2.4));
  const throttle = fSpeed < desired - 6 ? 0.72 : fSpeed > desired + 14 ? -0.5 : 0;
  stepVehicle(G, car, { steer, throttle, handbrake: false }, dt);

  // Keep the city populated around the player; recycle cars that wander too far off.
  const far = Math.hypot(car.x - player.x, car.y - player.y) > 1500;
  if (far || (Math.abs(fSpeed) < 3 && desired > 30)) {
    car.stuckTime = far ? car.stuckTime + dt * 4 : car.stuckTime + dt;
    if (car.stuckTime > 5) {
      const fresh = spawnTrafficCar(G);
      car.x = fresh.x;
      car.y = fresh.y;
      car.angle = fresh.angle;
      car.vx = 0;
      car.vy = 0;
      car.traffic = fresh.traffic;
      car.stuckTime = 0;
    }
  } else {
    car.stuckTime = 0;
  }
}

/** The nearest car to a point within a radius, optionally only ones a person can take. */
export function nearestCar(G, x, y, radius, stealableOnly = false) {
  let best = null;
  let bestDist = radius;
  for (const car of G.cars) {
    if (car.wrecked) continue;
    if (stealableOnly && car.cop && !car.parked) continue;
    const dist = Math.hypot(car.x - x, car.y - y);
    if (dist < bestDist) {
      best = car;
      bestDist = dist;
    }
  }
  return best;
}

export { nearestRoadPoint };
