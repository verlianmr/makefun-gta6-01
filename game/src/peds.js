// Pedestrians: Brisa going about its day. They stroll the sidewalk corners from node to
// node, scatter when a shot cracks or a car mounts the kerb at speed, and get back up
// after a knock — this is a cartoon, nobody stays down.

import { collideCircle, sidewalkNeighbours, sidewalkNodes } from './city.js';

const SHIRTS = ['#ff6b9d', '#ffd94d', '#7fe3d0', '#f6f0e6', '#84ceeb', '#ffb35c', '#c3aed6', '#ff8c69'];
const SKIN = ['#f2c89b', '#c68863', '#8d5524', '#ffdbac', '#e0ac69'];

export function spawnPeds(G, count = 42) {
  const nodes = sidewalkNodes();
  G.pedNodes = nodes;
  for (let index = 0; index < count; index += 1) {
    const node = G.rng.pick(nodes);
    G.peds.push({
      x: node.x + G.rng.range(-8, 8),
      y: node.y + G.rng.range(-8, 8),
      angle: G.rng.range(0, Math.PI * 2),
      speed: G.rng.range(38, 62),
      shirt: G.rng.pick(SHIRTS),
      skin: G.rng.pick(SKIN),
      state: 'walk',
      timer: 0,
      node,
      prev: null,
      stride: G.rng.range(0, Math.PI * 2),
    });
  }
}

export function updatePeds(G, dt) {
  const threat = G.threat && G.time - G.threat.t < 2.6 ? G.threat : null;
  for (const ped of G.peds) {
    if (ped.state === 'down') {
      ped.timer -= dt;
      if (ped.timer <= 0) {
        ped.state = 'walk';
        const node = nearestNode(G, ped.x, ped.y);
        ped.node = node;
        ped.prev = null;
      }
      continue;
    }
    let targetX;
    let targetY;
    let speed = ped.speed;
    if (threat && Math.hypot(ped.x - threat.x, ped.y - threat.y) < 170) ped.state = 'flee';
    if (ped.state === 'flee') {
      const from = threat ?? { x: ped.x + 1, y: ped.y };
      const away = Math.atan2(ped.y - from.y, ped.x - from.x);
      targetX = ped.x + Math.cos(away) * 90;
      targetY = ped.y + Math.sin(away) * 90;
      speed = 178;
      ped.timer -= dt;
      if (!threat || ped.timer <= 0) {
        ped.state = 'walk';
        ped.node = nearestNode(G, ped.x, ped.y);
        ped.prev = null;
      }
    } else {
      if (!ped.node) ped.node = nearestNode(G, ped.x, ped.y);
      targetX = ped.node.x;
      targetY = ped.node.y;
      const dist = Math.hypot(targetX - ped.x, targetY - ped.y);
      if (dist < 7) {
        const options = sidewalkNeighbours(G.pedNodes, ped.node).filter((node) => node !== ped.prev);
        ped.prev = ped.node;
        ped.node = options.length ? G.rng.pick(options) : ped.node;
        continue;
      }
    }
    const angle = Math.atan2(targetY - ped.y, targetX - ped.x);
    ped.angle = angle;
    const resolved = collideCircle(G.city, ped.x + Math.cos(angle) * speed * dt, ped.y + Math.sin(angle) * speed * dt, 9);
    ped.x = resolved.x;
    ped.y = resolved.y;
    ped.stride += dt * speed * 0.09;
    if (ped.state === 'walk' && threat) ped.timer = 2.6;
    if (ped.state === 'flee' && ped.timer <= 0 && threat) ped.timer = 1.2;
  }
}

function nearestNode(G, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const node of G.pedNodes) {
    const dist = (node.x - x) ** 2 + (node.y - y) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = node;
    }
  }
  return best;
}

/** Shots, crashes and crimes make a noise the block remembers for a few seconds. */
export function makeThreat(G, x, y) {
  G.threat = { x, y, t: G.time };
}
