// The city of Costa Brisa, generated once from a seed: a grid of avenues and streets with
// pastel blocks between them, named landmarks, parking lots, palms, dock containers and the
// lighthouse point. Everything the game collides with, walks on or drives on comes from here.

import { AVENUES_X, BEACH_X, CAR_COLORS, STREETS_Y, WATER_X, WORLD } from './config.js';
import { makeRng } from './rng.js';

const BUILDING_COLORS = ['#ffd9a0', '#ffb997', '#ff8c69', '#f6f0e6', '#a8e6cf', '#84ceeb', '#c3aed6', '#fdf3a7', '#ffc4d6', '#b8f1cc', '#ffe5b4'];
const SIDEWALK_INSET = 26;

/** Block columns sit between consecutive avenues; rows between consecutive streets. */
function blockColumns() {
  const columns = [];
  for (let index = 0; index < AVENUES_X.length - 1; index += 1) {
    columns.push({ x0: AVENUES_X[index] + 48, x1: AVENUES_X[index + 1] - 48 });
  }
  return columns;
}
function blockRows() {
  const rows = [{ y0: 16, y1: 192 }];
  for (let index = 0; index < STREETS_Y.length - 1; index += 1) {
    rows.push({ y0: STREETS_Y[index] + 48, y1: STREETS_Y[index + 1] - 48 });
  }
  rows.push({ y0: 2388, y1: 2504 });
  return rows;
}

/** Named single-building blocks: the club, the station, the docks and friends. */
const LANDMARK_BLOCKS = {
  '2,2': { name: 'The Marlin Club', color: '#ff8c69', height: 30 },
  '2,1': { name: 'San Brisa Hospital', color: '#f6f0e6', height: 40 },
  '1,1': { name: 'CBPD Station', color: '#84ceeb', height: 34 },
  '4,1': { name: 'Hotel Coralina', color: '#ffc4d6', height: 76 },
  '3,3': { name: 'Banco del Sol', color: '#fdf3a7', height: 52 },
  '4,4': { name: 'Palms Mall', color: '#a8e6cf', height: 26 },
  '0,5': { name: "Tito's Chop Shop", color: '#c3aed6', height: 20 },
  '5,5': { name: 'Puerto Brisa Warehouse', color: '#ffb997', height: 24 },
};
/** Blocks that stay open ground: the park, the parking lots, the marina and the container yard. */
const OPEN_BLOCKS = { '0,2': 'park', '1,4': 'lot', '5,2': 'lot', '6,3': 'marina', '6,5': 'yard' };

function addBuilding(city, rng, x, y, w, h, options = {}) {
  const building = {
    x, y, w, h,
    height: options.height ?? rng.range(14, 58),
    color: options.color ?? rng.pick(BUILDING_COLORS),
    name: options.name ?? null,
    seed: rng.int(1, 1e9),
  };
  city.buildings.push(building);
  city.solids.push(building);
  return building;
}

/** Fill one ordinary block with one, two or four buildings, footpaths kept between them. */
function fillBlock(city, rng, x0, y0, x1, y1) {
  const w = x1 - x0;
  const h = y1 - y0;
  const layout = rng.pick(['single', 'pair', 'quad', 'pair', 'quad']);
  if (layout === 'single' || w < 200 || h < 200) {
    addBuilding(city, rng, x0 + SIDEWALK_INSET, y0 + SIDEWALK_INSET, w - SIDEWALK_INSET * 2, h - SIDEWALK_INSET * 2,
      rng.chance(0.3) ? { height: rng.range(56, 82) } : {});
    return;
  }
  if (layout === 'pair') {
    const gap = 30;
    if (w > h) {
      const each = (w - SIDEWALK_INSET * 2 - gap) / 2;
      addBuilding(city, rng, x0 + SIDEWALK_INSET, y0 + SIDEWALK_INSET, each, h - SIDEWALK_INSET * 2);
      addBuilding(city, rng, x0 + SIDEWALK_INSET + each + gap, y0 + SIDEWALK_INSET, each, h - SIDEWALK_INSET * 2);
    } else {
      const each = (h - SIDEWALK_INSET * 2 - gap) / 2;
      addBuilding(city, rng, x0 + SIDEWALK_INSET, y0 + SIDEWALK_INSET, w - SIDEWALK_INSET * 2, each);
      addBuilding(city, rng, x0 + SIDEWALK_INSET, y0 + SIDEWALK_INSET + each + gap, w - SIDEWALK_INSET * 2, each);
    }
    return;
  }
  const gap = 28;
  const eachW = (w - SIDEWALK_INSET * 2 - gap) / 2;
  const eachH = (h - SIDEWALK_INSET * 2 - gap) / 2;
  for (const dx of [0, 1]) {
    for (const dy of [0, 1]) {
      addBuilding(city, rng, x0 + SIDEWALK_INSET + dx * (eachW + gap), y0 + SIDEWALK_INSET + dy * (eachH + gap), eachW, eachH);
    }
  }
}

/** A parking lot with marked spots; spots come back as places to leave stealable cars. */
function addLot(city, x0, y0, x1, y1, spotCount, rng) {
  const lot = { x: x0 + 8, y: y0 + 8, w: x1 - x0 - 16, h: y1 - y0 - 16, spots: [] };
  const rows = lot.h >= 130 ? 2 : 1;
  const perRow = Math.ceil(spotCount / rows);
  for (let index = 0; index < spotCount; index += 1) {
    const row = Math.floor(index / perRow);
    const col = index % perRow;
    lot.spots.push({
      x: lot.x + 34 + col * ((lot.w - 60) / Math.max(1, perRow - 1 || 1)),
      y: rows === 1 ? lot.y + lot.h / 2 : lot.y + (row === 0 ? 34 : lot.h - 34),
      angle: row === 0 ? Math.PI / 2 : -Math.PI / 2,
    });
  }
  city.lots.push(lot);
  return lot;
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const city = { buildings: [], solids: [], lots: [], palms: [], containers: [], boats: [], lighthouse: { x: 3522, y: 118 } };
  const columns = blockColumns();
  const rows = blockRows();

  for (let col = 0; col < columns.length; col += 1) {
    for (let row = 0; row < rows.length; row += 1) {
      const { x0, x1 } = columns[col];
      const { y0, y1 } = rows[row];
      const key = `${col},${row}`;
      if (LANDMARK_BLOCKS[key]) {
        const mark = LANDMARK_BLOCKS[key];
        addBuilding(city, rng, x0 + 34, y0 + 30, x1 - x0 - 68, (y1 - y0) * 0.58, { name: mark.name, color: mark.color, height: mark.height });
      } else if (OPEN_BLOCKS[key] === 'park') {
        city.park = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        for (let index = 0; index < 26; index += 1) {
          city.palms.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), s: rng.range(0.8, 1.3) });
        }
      } else if (OPEN_BLOCKS[key] === 'lot') {
        addLot(city, x0, y0, x1, y1, 8, rng);
      } else if (OPEN_BLOCKS[key] === 'marina') {
        addLot(city, x0, y0, x1, y1, 6, rng);
      } else if (OPEN_BLOCKS[key] === 'yard') {
        for (let index = 0; index < 7; index += 1) {
          const box = { x: rng.range(x0 + 8, x1 - 62), y: rng.range(y0 + 10, y1 - 34), w: 54, h: 24, color: rng.pick(CAR_COLORS) };
          city.containers.push(box);
          city.solids.push(box);
        }
      } else {
        fillBlock(city, rng, x0, y0, x1, y1);
      }
    }
  }

  // Forecourt parking at the club and the mall, and two interceptors waiting at the station.
  addLot(city, columns[2].x0, rows[2].y1 - 96, columns[2].x1, rows[2].y1, 3, rng);
  addLot(city, columns[4].x0, rows[4].y1 - 96, columns[4].x1, rows[4].y1, 5, rng);
  const stationLot = addLot(city, columns[1].x0, rows[1].y1 - 96, columns[1].x1, rows[1].y1, 2, rng);
  stationLot.police = true;

  // Palms along the beach and scattered on street corners; boats resting off the marina.
  for (let index = 0; index < 34; index += 1) {
    city.palms.push({ x: rng.range(BEACH_X + 12, WATER_X - 26), y: rng.range(30, WORLD.height - 30), s: rng.range(0.8, 1.4) });
  }
  for (let index = 0; index < 40; index += 1) {
    city.palms.push({ x: rng.range(70, BEACH_X - 80), y: rng.range(70, WORLD.height - 70), s: rng.range(0.7, 1.1) });
  }
  for (let index = 0; index < 6; index += 1) {
    city.boats.push({ x: rng.range(WATER_X + 40, WORLD.width - 50), y: rng.range(980, 1620), angle: rng.range(-0.4, 0.4), color: rng.pick(CAR_COLORS) });
  }
  const lightBase = { x: city.lighthouse.x - 17, y: city.lighthouse.y - 17, w: 34, h: 34 };
  city.solids.push(lightBase);
  return city;
}

/** Which road a point sits on, if any: { axis: 'v' | 'h', index, center } or null. */
export function roadAt(x, y) {
  for (let index = 0; index < AVENUES_X.length; index += 1) {
    if (Math.abs(x - AVENUES_X[index]) <= 48) return { axis: 'v', index, center: AVENUES_X[index] };
  }
  for (let index = 0; index < STREETS_Y.length; index += 1) {
    if (Math.abs(y - STREETS_Y[index]) <= 48) return { axis: 'h', index, center: STREETS_Y[index] };
  }
  return null;
}

export function isOnRoad(x, y) {
  return roadAt(x, y) !== null;
}

/** The nearest point on any road centre line: where lost drivers and police aim to recover. */
export function nearestRoadPoint(x, y) {
  let best = null;
  for (const ax of AVENUES_X) {
    const d = Math.abs(x - ax);
    if (!best || d < best.d) best = { x: ax, y, d };
  }
  for (const sy of STREETS_Y) {
    const d = Math.abs(y - sy);
    if (d < best.d) best = { x, y: sy, d };
  }
  return best;
}

/**
 * Push a circle out of every solid and back inside the world; the sea stops land traffic cold.
 * Returns the corrected position and whether anything was hit (and how hard, by overlap).
 */
export function collideCircle(city, x, y, r) {
  let hit = 0;
  for (const box of city.solids) {
    const nearX = Math.max(box.x, Math.min(x, box.x + box.w));
    const nearY = Math.max(box.y, Math.min(y, box.y + box.h));
    const dx = x - nearX;
    const dy = y - nearY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= r * r) continue;
    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      x = nearX + (dx / dist) * r;
      y = nearY + (dy / dist) * r;
      hit = Math.max(hit, r - dist);
    } else {
      // Centre inside the box: leave by the shallowest face.
      const left = x - box.x;
      const right = box.x + box.w - x;
      const top = y - box.y;
      const bottom = box.y + box.h - y;
      const shallowest = Math.min(left, right, top, bottom);
      if (shallowest === left) x = box.x - r;
      else if (shallowest === right) x = box.x + box.w + r;
      else if (shallowest === top) y = box.y - r;
      else y = box.y + box.h + r;
      hit = Math.max(hit, r);
    }
  }
  if (x < r) { x = r; hit = Math.max(hit, 1); }
  if (y < r) { y = r; hit = Math.max(hit, 1); }
  if (x > WATER_X - r) { x = WATER_X - r; hit = Math.max(hit, 1); }
  if (y > WORLD.height - r) { y = WORLD.height - r; hit = Math.max(hit, 1); }
  return { x, y, hit };
}

/** Sidewalk corner nodes peds walk between: (±60, ±60) around every intersection. */
export function sidewalkNodes() {
  const nodes = [];
  for (let a = 0; a < AVENUES_X.length; a += 1) {
    for (let s = 0; s < STREETS_Y.length; s += 1) {
      for (const sx of [-60, 60]) {
        for (const sy of [-60, 60]) {
          nodes.push({ x: AVENUES_X[a] + sx, y: STREETS_Y[s] + sy, a, s, sx, sy });
        }
      }
    }
  }
  return nodes;
}

/** Nodes sharing a sidewalk line with this one: the next corner along the same road edge. */
export function sidewalkNeighbours(nodes, node) {
  return nodes.filter((other) => other !== node
    && ((other.a === node.a && other.sx === node.sx && Math.abs(other.s - node.s) === 1 && other.sy === node.sy)
      || (other.s === node.s && other.sy === node.sy && Math.abs(other.a - node.a) === 1 && other.sx === node.sx)
      || (other.a === node.a && other.s === node.s && other.sx === node.sx && other.sy !== node.sy)
      || (other.a === node.a && other.s === node.s && other.sy === node.sy && other.sx !== node.sx)));
}
