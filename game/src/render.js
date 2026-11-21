// The look of Costa Brisa: a bright, sun-soaked top-down city with a tilt — buildings lift
// their roofs toward the top-left so the streets read with depth, the sea sparkles to the
// east, and everything casts a soft shadow. All of it drawn from the city data, no images.

import { AVENUES_X, BEACH_X, STREETS_Y, WATER_X, WORLD } from './config.js';
import { makeRng } from './rng.js';

function shade(hex, factor) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((num >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((num >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((num & 255) * factor));
  return `rgb(${r},${g},${b})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function renderWorld(G, ctx) {
  const { width: viewW, height: viewH } = G.view;
  const cam = G.camera;
  ctx.fillStyle = '#118ab2';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.save();
  ctx.translate(viewW / 2, viewH / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  const view = {
    x0: cam.x - viewW / 2 / cam.zoom - 140,
    y0: cam.y - viewH / 2 / cam.zoom - 140,
    x1: cam.x + viewW / 2 / cam.zoom + 140,
    y1: cam.y + viewH / 2 / cam.zoom + 140,
  };
  const inView = (x, y, pad = 0) => x > view.x0 - pad && x < view.x1 + pad && y > view.y0 - pad && y < view.y1 + pad;

  drawSea(G, ctx, view);
  drawLand(G, ctx, view);
  drawRoads(ctx, view);
  drawLots(G, ctx, view);
  drawContainers(G, ctx, view);
  drawBuildings(G, ctx, view);
  drawPalms(G, ctx, view, inView);
  drawBoats(G, ctx, inView);
  drawLighthouse(G, ctx);
  drawSkids(G, ctx, inView);
  if (G.objective) drawBeacon(G, ctx);
  for (const ped of G.peds) if (inView(ped.x, ped.y, 30)) drawPed(G, ctx, ped);
  for (const car of G.cars) {
    if (!inView(car.x, car.y, 80)) continue;
    if (car.playerIn) {
      ctx.strokeStyle = 'rgba(255, 201, 60, 0.95)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(car.x, car.y, car.spec.length * 0.62, car.spec.width * 1.02, car.angle, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawCar(G, ctx, car);
  }
  if (G.mode !== 'title') drawPlayer(G, ctx);
  drawEffects(G, ctx);
  ctx.restore();
}

function drawSea(G, ctx, view) {
  const gradient = ctx.createLinearGradient(WATER_X, 0, WORLD.width, 0);
  gradient.addColorStop(0, '#2ec4b6');
  gradient.addColorStop(1, '#118ab2');
  ctx.fillStyle = gradient;
  ctx.fillRect(Math.max(view.x0, WATER_X - 60), view.y0, WORLD.width - WATER_X + 200, view.y1 - view.y0);
  // Sparkle: a fixed glitter grid, twinkling by step so screenshots stay deterministic.
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  const step = Math.floor(G.step / 18);
  for (let gx = Math.floor(view.x0 / 46) * 46; gx < view.x1; gx += 46) {
    for (let gy = Math.floor(view.y0 / 38) * 38; gy < view.y1; gy += 38) {
      if (gx < WATER_X) continue;
      const twinkle = (gx * 31 + gy * 17 + step * 13) % 7;
      if (twinkle < 2) ctx.fillRect(gx + (gy % 13), gy + (gx % 11), 7, 2);
    }
  }
  // The shoreline foam line.
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillRect(WATER_X - 3, view.y0, 4, view.y1 - view.y0);
}

function drawLand(G, ctx, view) {
  ctx.fillStyle = '#f6e3ae'; // beach sand, the whole east shore
  ctx.fillRect(view.x0, view.y0, WATER_X - view.x0, view.y1 - view.y0);
  ctx.fillStyle = '#ddd2b2'; // paved city earth
  ctx.fillRect(view.x0, view.y0, BEACH_X - view.x0, view.y1 - view.y0);
  if (G.city.park) {
    const park = G.city.park;
    ctx.fillStyle = '#8fd06a';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = '#a5da82';
    ctx.fillRect(park.x + 26, park.y + 26, park.w - 52, park.h - 52);
  }
}

function drawRoads(ctx, view) {
  ctx.fillStyle = '#efe6cc'; // sidewalks first, wider than the asphalt
  for (const ax of AVENUES_X) ctx.fillRect(ax - 66, view.y0, 132, view.y1 - view.y0);
  for (const sy of STREETS_Y) ctx.fillRect(view.x0, sy - 66, Math.min(view.x1, 3420) - view.x0, 132);
  ctx.fillStyle = '#494f57';
  for (const ax of AVENUES_X) ctx.fillRect(ax - 48, view.y0, 96, view.y1 - view.y0);
  for (const sy of STREETS_Y) ctx.fillRect(view.x0, sy - 48, Math.min(view.x1, 3420) - view.x0, 96);
  // Centre dashes.
  ctx.fillStyle = 'rgba(255,217,77,0.8)';
  for (const ax of AVENUES_X) {
    for (let y = Math.floor(view.y0 / 48) * 48; y < view.y1; y += 48) ctx.fillRect(ax - 2, y, 4, 26);
  }
  for (const sy of STREETS_Y) {
    for (let x = Math.floor(view.x0 / 48) * 48; x < Math.min(view.x1, 3420); x += 48) ctx.fillRect(x, sy - 2, 26, 4);
  }
  // Crosswalks at the intersections in view.
  ctx.fillStyle = 'rgba(246,240,230,0.75)';
  for (const ax of AVENUES_X) {
    for (const sy of STREETS_Y) {
      if (ax < view.x0 - 90 || ax > view.x1 + 90 || sy < view.y0 - 90 || sy > view.y1 + 90) continue;
      for (let stripe = -2; stripe <= 2; stripe += 1) {
        ctx.fillRect(ax - 62, sy + stripe * 15 - 4, 12, 8);
        ctx.fillRect(ax + 50, sy + stripe * 15 - 4, 12, 8);
        ctx.fillRect(ax + stripe * 15 - 4, sy - 62, 8, 12);
        ctx.fillRect(ax + stripe * 15 - 4, sy + 50, 8, 12);
      }
    }
  }
}

function drawLots(G, ctx, view) {
  for (const lot of G.city.lots) {
    if (lot.x > view.x1 || lot.x + lot.w < view.x0 || lot.y > view.y1 || lot.y + lot.h < view.y0) continue;
    ctx.fillStyle = '#5b6068';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(246,240,230,0.55)';
    ctx.lineWidth = 2;
    for (const spot of lot.spots) {
      ctx.save();
      ctx.translate(spot.x, spot.y);
      ctx.rotate(spot.angle);
      ctx.strokeRect(-11, -22, 22, 44);
      ctx.restore();
    }
  }
}

function drawContainers(G, ctx, view) {
  for (const box of G.city.containers) {
    if (box.x > view.x1 || box.x + box.w < view.x0 || box.y > view.y1 || box.y + box.h < view.y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(box.x + 5, box.y + 7, box.w, box.h);
    ctx.fillStyle = box.color;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let rib = 1; rib < 5; rib += 1) ctx.fillRect(box.x + rib * (box.w / 5), box.y, 2, box.h);
  }
}

function drawBuildings(G, ctx, view) {
  for (const b of G.city.buildings) {
    if (b.x > view.x1 || b.x + b.w < view.x0 || b.y > view.y1 + 60 || b.y + b.h < view.y0) continue;
    const liftX = -b.height * 0.38;
    const liftY = -b.height * 0.5;
    ctx.fillStyle = 'rgba(30,40,30,0.20)'; // ground shadow
    ctx.fillRect(b.x + 9, b.y + 13, b.w, b.h);
    ctx.fillStyle = shade(b.color, 0.72); // south face
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.lineTo(b.x + b.w + liftX, b.y + b.h + liftY);
    ctx.lineTo(b.x + liftX, b.y + b.h + liftY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(b.color, 0.86); // east face
    ctx.beginPath();
    ctx.moveTo(b.x + b.w, b.y);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.lineTo(b.x + b.w + liftX, b.y + b.h + liftY);
    ctx.lineTo(b.x + b.w + liftX, b.y + liftY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(b.color, 1.1); // the roof itself
    ctx.fillRect(b.x + liftX, b.y + liftY, b.w, b.h);
    ctx.strokeStyle = 'rgba(60,50,30,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + liftX, b.y + liftY, b.w, b.h);
    // Roof clutter from the building's own seed: tanks, vents, a helipad on the tall ones.
    const rng = makeRng(b.seed);
    ctx.fillStyle = 'rgba(90,90,90,0.35)';
    const props = rng.int(1, 3);
    for (let index = 0; index < props; index += 1) {
      const pw = rng.range(10, 26);
      const ph = rng.range(8, 20);
      ctx.fillRect(b.x + liftX + rng.range(8, Math.max(10, b.w - pw - 8)), b.y + liftY + rng.range(8, Math.max(10, b.h - ph - 8)), pw, ph);
    }
    if (b.height > 62) {
      ctx.strokeStyle = 'rgba(226,112,58,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x + liftX + b.w / 2, b.y + liftY + b.h / 2, Math.min(b.w, b.h) * 0.26, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (b.name && G.camera.zoom > 0.55) {
      ctx.fillStyle = 'rgba(40,34,24,0.78)';
      ctx.font = '700 17px "Avenir Next", "Segoe UI", Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.name.toUpperCase(), b.x + liftX + b.w / 2, b.y + liftY + b.h / 2 + 6);
    }
  }
}

function drawPalms(G, ctx, view, inView) {
  for (const palm of G.city.palms) {
    if (!inView(palm.x, palm.y, 40)) continue;
    const sway = Math.sin(G.step * 0.02 + palm.x * 0.05) * 0.06;
    ctx.fillStyle = 'rgba(30,40,30,0.18)';
    ctx.beginPath();
    ctx.ellipse(palm.x + 5, palm.y + 6, 13 * palm.s, 5 * palm.s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a5a33';
    ctx.lineWidth = 3.4 * palm.s;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.quadraticCurveTo(palm.x + 3, palm.y - 9 * palm.s, palm.x + 6, palm.y - 16 * palm.s);
    ctx.stroke();
    ctx.strokeStyle = '#2f9e44';
    ctx.lineWidth = 2.6 * palm.s;
    for (let frond = 0; frond < 6; frond += 1) {
      const angle = (frond / 6) * Math.PI * 2 + sway;
      ctx.beginPath();
      ctx.moveTo(palm.x + 6, palm.y - 16 * palm.s);
      ctx.quadraticCurveTo(
        palm.x + 6 + Math.cos(angle) * 11 * palm.s,
        palm.y - 16 * palm.s + Math.sin(angle) * 5 * palm.s - 3,
        palm.x + 6 + Math.cos(angle) * 17 * palm.s,
        palm.y - 16 * palm.s + Math.sin(angle) * 8 * palm.s + 4,
      );
      ctx.stroke();
    }
  }
}

function drawBoats(G, ctx, inView) {
  for (const boat of G.city.boats) {
    if (!inView(boat.x, boat.y, 60)) continue;
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.angle);
    ctx.fillStyle = 'rgba(0,40,60,0.25)';
    ctx.beginPath();
    ctx.ellipse(3, 5, 26, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f6f0e6';
    roundRect(ctx, -24, -8, 48, 16, 7);
    ctx.fill();
    ctx.fillStyle = boat.color;
    roundRect(ctx, -8, -5.5, 20, 11, 3);
    ctx.fill();
    ctx.restore();
  }
}

function drawLighthouse(G, ctx) {
  const { x, y } = G.city.lighthouse;
  ctx.fillStyle = 'rgba(255,236,170,0.20)';
  ctx.beginPath();
  ctx.arc(x, y, 54 + Math.sin(G.step * 0.05) * 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(30,40,30,0.2)';
  ctx.beginPath();
  ctx.ellipse(x + 5, y + 8, 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f6f0e6';
  ctx.beginPath();
  ctx.moveTo(x - 13, y + 12);
  ctx.lineTo(x - 8, y - 22);
  ctx.lineTo(x + 8, y - 22);
  ctx.lineTo(x + 13, y + 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e63946';
  ctx.fillRect(x - 10.5, y - 4, 21, 8);
  ctx.fillRect(x - 12, y + 6, 24, 6);
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath();
  ctx.arc(x, y - 26, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawSkids(G, ctx, inView) {
  ctx.fillStyle = 'rgba(30,30,34,0.4)';
  for (const skid of G.skids) {
    if (!inView(skid.x, skid.y, 10)) continue;
    ctx.globalAlpha = Math.max(0, 0.4 - skid.t * 0.008);
    ctx.beginPath();
    ctx.arc(skid.x, skid.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBeacon(G, ctx) {
  const { x, y } = G.objective;
  const pulse = 0.6 + Math.sin(G.step * 0.09) * 0.4;
  const gradient = ctx.createLinearGradient(0, y - 300, 0, y);
  gradient.addColorStop(0, 'rgba(255,217,77,0)');
  gradient.addColorStop(1, `rgba(255,217,77,${0.35 * pulse})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(x - 13, y - 300, 26, 300);
  ctx.strokeStyle = `rgba(255,217,77,${0.9 * pulse})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 20 + Math.sin(G.step * 0.09) * 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd94d';
  ctx.save();
  ctx.translate(x, y - 44 - Math.sin(G.step * 0.09) * 5);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-8, -8, 16, 16);
  ctx.restore();
}

export function drawPed(G, ctx, ped) {
  ctx.fillStyle = 'rgba(30,40,30,0.22)';
  ctx.beginPath();
  ctx.ellipse(ped.x + 2, ped.y + 4, 8, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  if (ped.state === 'down') {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.shirt;
    roundRect(ctx, -5, -13, 10, 20, 4);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(0, -16, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const stride = ped.state === 'flee' || ped.moving ? Math.sin(ped.stride) * 5 : 0;
  ctx.strokeStyle = '#3a3f4a';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(ped.x, ped.y + 2);
  ctx.lineTo(ped.x + Math.cos(ped.angle + 0.5) * (4 + stride), ped.y + Math.sin(ped.angle + 0.5) * (4 + stride) + 3);
  ctx.moveTo(ped.x, ped.y + 2);
  ctx.lineTo(ped.x + Math.cos(ped.angle - 0.5) * (4 - stride), ped.y + Math.sin(ped.angle - 0.5) * (4 - stride) + 3);
  ctx.stroke();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(ped.x, ped.y, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(ped.x + Math.cos(ped.angle) * 2.5, ped.y + Math.sin(ped.angle) * 2.5, 4.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawCar(G, ctx, car) {
  const { length: L, width: W } = car.spec;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.fillStyle = 'rgba(20,26,20,0.28)';
  ctx.beginPath();
  ctx.ellipse(4, 6, L * 0.52, W * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(car.angle);
  // Wheels.
  ctx.fillStyle = '#1c1e24';
  for (const [wx, wy] of [[-L * 0.32, -W / 2], [L * 0.32, -W / 2], [-L * 0.32, W / 2 - 3.4], [L * 0.32, W / 2 - 3.4]]) {
    ctx.fillRect(wx - 4.4, wy, 8.8, 3.4);
  }
  // Body.
  ctx.fillStyle = car.cop ? '#f2f4f6' : car.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,20,20,0.3)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  if (car.cop) {
    ctx.fillStyle = '#1d3557';
    ctx.fillRect(-L * 0.16, -W / 2, L * 0.3, W);
    // Light bar: red and blue take turns, phased per car.
    const phase = Math.sin(G.step * 0.35 + car.sirenPhase) > 0;
    ctx.fillStyle = phase ? '#ff3b30' : '#5e2b97';
    ctx.fillRect(-6, -W / 2 + 1.5, 12, 4.5);
    ctx.fillStyle = phase ? '#3a86ff' : '#7a1f1a';
    ctx.fillRect(-6, W / 2 - 6, 12, 4.5);
  }
  if (car.type === 'solcab') {
    ctx.fillStyle = '#ffd94d';
    roundRect(ctx, -L / 2, -W / 2, L, W, 6);
    ctx.fill();
    ctx.fillStyle = '#1c1e24';
    ctx.font = '700 8.5px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SOL CAB', 0, 3);
  }
  if (car.type === 'mule') {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-L * 0.06, -W / 2 + 2.5, L * 0.5, W - 5);
  }
  // Cabin and glass.
  ctx.fillStyle = '#bfe8f2';
  roundRect(ctx, -L * 0.2, -W / 2 + 3, L * 0.34, W - 6, 3.4);
  ctx.fill();
  ctx.fillStyle = shade(car.cop ? '#f2f4f6' : car.color, 1.12);
  roundRect(ctx, -L * 0.12, -W / 2 + 4.4, L * 0.2, W - 8.8, 3);
  ctx.fill();
  // Lights.
  ctx.fillStyle = '#fff6c9';
  ctx.fillRect(L / 2 - 2.6, -W / 2 + 2.4, 2.6, 4);
  ctx.fillRect(L / 2 - 2.6, W / 2 - 6.4, 2.6, 4);
  ctx.fillStyle = '#e63946';
  ctx.fillRect(-L / 2, -W / 2 + 2.4, 2.4, 4);
  ctx.fillRect(-L / 2, W / 2 - 6.4, 2.4, 4);
  if (car.missionCar) {
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    roundRect(ctx, -L / 2 - 4, -W / 2 - 4, L + 8, W + 8, 8);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (car.wrecked) {
    ctx.fillStyle = 'rgba(30,30,34,0.45)';
    roundRect(ctx, -L / 2, -W / 2, L, W, 6);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayer(G, ctx) {
  const player = G.player;
  if (player.inCar) return;
  const aim = G.aimAngle;
  // A faint aim line while Rio is on foot: the mouse is the gun hand.
  ctx.strokeStyle = 'rgba(255,255,255,0.20)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([4, 7]);
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.x + Math.cos(aim) * 46, player.y + Math.sin(aim) * 46);
  ctx.stroke();
  ctx.setLineDash([]);
  const ghost = { ...player, shirt: '#e2703a', moving: Math.hypot(player.vx, player.vy) > 12 };
  ghost.angle = aim;
  drawPed(G, ctx, ghost);
  // A small pistol block toward the aim.
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(aim);
  ctx.fillStyle = '#26262b';
  ctx.fillRect(6, -1.8, 9, 3.6);
  ctx.restore();
  // A soft ring so Rio is never lost in a crowd.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 12.5, 0, Math.PI * 2);
  ctx.stroke();
}

function drawEffects(G, ctx) {
  for (const tracer of G.tracers) {
    ctx.strokeStyle = `rgba(255,236,170,${Math.max(0, tracer.t / 0.07)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tracer.x1, tracer.y1);
    ctx.lineTo(tracer.x2, tracer.y2);
    ctx.stroke();
  }
  for (const p of G.particles) {
    ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const popup of G.popups) {
    ctx.globalAlpha = Math.max(0, 1 - popup.t / 1.4);
    ctx.fillStyle = '#2f9e44';
    ctx.font = '800 21px "Avenir Next", "Segoe UI", Verdana, sans-serif';
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3.4;
    const y = popup.y - popup.t * 34;
    ctx.strokeText(popup.text, popup.x, y);
    ctx.fillText(popup.text, popup.x, y);
  }
  ctx.globalAlpha = 1;
}
