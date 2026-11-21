// The HUD, drawn on the same canvas over the world: cash and health top-left, the wanted
// stars top-centre with the bust meter under them, the whole-city minimap top-right, the
// objective along the bottom, and the mission banners that slide through the middle.

import { WORLD } from './config.js';
import { forwardSpeed } from './cars.js';
import { respectTitle } from './missions.js';

const FONT = '"Avenir Next", "Segoe UI", Verdana, sans-serif';
const MAP_W = 228;
const MAP_H = 150;

function panel(ctx, x, y, w, h, r = 10) {
  ctx.fillStyle = 'rgba(10, 30, 42, 0.72)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 217, 77, 0.5)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function star(ctx, cx, cy, r, filled) {
  ctx.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const radius = index % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd94d' : 'rgba(255,255,255,0.18)';
  ctx.fill();
  ctx.strokeStyle = filled ? '#a86e00' : 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

export function drawHud(G, ctx) {
  const { width: viewW, height: viewH } = G.view;
  if (G.mode === 'title') return;
  drawCashPanel(G, ctx);
  drawWanted(G, ctx, viewW);
  drawMinimap(G, ctx, viewW);
  drawNotices(G, ctx, viewW);
  if (G.banner) drawBanner(G, ctx, viewW, viewH);
  drawObjective(G, ctx, viewW, viewH);
  if (G.prompt) drawPrompt(G, ctx, viewW, viewH);
  if (G.player.inCar) drawSpeedo(G, ctx, viewW, viewH);
  if (G.playTime < 26 && G.mode === 'play') {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('WASD move/drive · E enter car & talk · mouse aim, click to fire · Shift run/handbrake · P pause · M sound', 14, viewH - 12);
  }
  if (G.hurtT > 0 || G.player.hp < 30) {
    const pulse = G.player.hp < 30 ? 0.1 + 0.06 * Math.sin(G.step * 0.16) : 0;
    const alpha = Math.max(G.hurtT * 0.4, pulse);
    const gradient = ctx.createRadialGradient(viewW / 2, viewH / 2, viewH * 0.36, viewW / 2, viewH / 2, viewH * 0.78);
    gradient.addColorStop(0, 'rgba(200,30,30,0)');
    gradient.addColorStop(1, `rgba(200,30,30,${alpha})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, viewW, viewH);
  }
}

function drawCashPanel(G, ctx) {
  const inCar = G.player.inCar;
  panel(ctx, 12, 12, 196, inCar ? 96 : 76);
  ctx.fillStyle = '#ffd94d';
  ctx.font = `800 23px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`$${G.stats.cash.toLocaleString('en-US')}`, 24, 40);
  ctx.fillStyle = '#bfe3da';
  ctx.font = `600 11.5px ${FONT}`;
  ctx.fillText(`RESPECT — ${respectTitle(G).toUpperCase()}`, 24, 58);
  bar(ctx, 24, 66, 172, 7, G.player.hp / 100, '#5ad66f', 'RIO');
  if (inCar) bar(ctx, 24, 84, 172, 7, Math.max(0, inCar.hp / inCar.spec.hp), '#ffb35c', inCar.name.toUpperCase());
}

function bar(ctx, x, y, w, h, ratio, color, label) {
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(h, w * Math.max(0, Math.min(1, ratio))), h, h / 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `700 8.5px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 5, y + h - 0.5);
}

function drawWanted(G, ctx, viewW) {
  const wanted = G.wanted;
  if (wanted.stars === 0 && wanted.bust <= 0.02) return;
  const cx = viewW / 2;
  for (let index = 0; index < 5; index += 1) {
    star(ctx, cx + (index - 2) * 30, 30, 12.5, index < wanted.stars);
  }
  if (wanted.cooling) {
    ctx.fillStyle = '#7fe3d0';
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('LOSING THE HEAT…', cx, 58);
  }
  if (wanted.bust > 0.02) {
    const w = 190;
    ctx.fillStyle = 'rgba(10,30,42,0.72)';
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, 64, w, 15, 7);
    ctx.fill();
    ctx.fillStyle = wanted.bust > 0.72 && Math.sin(G.step * 0.3) > 0 ? '#ffffff' : '#ff3b30';
    ctx.beginPath();
    ctx.roundRect(cx - w / 2 + 2, 66, (w - 4) * wanted.bust, 11, 5.5);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 10.5px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED', cx, 75.5);
  }
}

function drawMinimap(G, ctx, viewW) {
  const x0 = viewW - MAP_W - 12;
  const y0 = 12;
  const sx = MAP_W / WORLD.width;
  const sy = MAP_H / WORLD.height;
  panel(ctx, x0 - 4, y0 - 4, MAP_W + 8, MAP_H + 8, 10);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x0, y0, MAP_W, MAP_H, 7);
  ctx.clip();
  ctx.fillStyle = '#118ab2';
  ctx.fillRect(x0, y0, MAP_W, MAP_H);
  ctx.fillStyle = '#e9dcb4';
  ctx.fillRect(x0, y0, 3456 * sx, MAP_H);
  ctx.fillStyle = '#494f57';
  for (const ax of [240, 720, 1200, 1680, 2160, 2640, 3120, 3360]) ctx.fillRect(x0 + ax * sx - 1.4, y0, 2.8, MAP_H);
  for (const syLine of [240, 660, 1080, 1500, 1920, 2340]) ctx.fillRect(x0, y0 + syLine * sy - 1.4, MAP_W, 2.8);
  ctx.fillStyle = 'rgba(70,58,40,0.55)';
  for (const b of G.city.buildings) ctx.fillRect(x0 + b.x * sx, y0 + b.y * sy, Math.max(1.6, b.w * sx), Math.max(1.6, b.h * sy));
  if (G.objective) {
    const pulse = 3.4 + Math.sin(G.step * 0.12) * 1.1;
    ctx.fillStyle = '#ffd94d';
    ctx.save();
    ctx.translate(x0 + G.objective.x * sx, y0 + G.objective.y * sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-pulse / 1.4, -pulse / 1.4, pulse * 1.42, pulse * 1.42);
    ctx.restore();
  }
  for (const car of G.cars) {
    if (!car.cop || car.parked) continue;
    ctx.fillStyle = Math.sin(G.step * 0.3 + car.sirenPhase) > 0 ? '#ff3b30' : '#3a86ff';
    ctx.beginPath();
    ctx.arc(x0 + car.x * sx, y0 + car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const player = G.player;
  const facing = player.inCar ? player.inCar.angle : player.angle;
  ctx.save();
  ctx.translate(x0 + player.x * sx, y0 + player.y * sy);
  ctx.rotate(facing);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6.4, 0);
  ctx.lineTo(-4.4, -4);
  ctx.lineTo(-4.4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#10303f';
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `700 9px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('COSTA BRISA', x0 + 6, y0 + MAP_H - 6);
  ctx.restore();
}

function drawNotices(G, ctx, viewW) {
  ctx.textAlign = 'right';
  let y = 186;
  for (const notice of G.notices.slice(-3)) {
    const alpha = Math.min(1, (3.6 - notice.t) / 0.6, notice.t / 0.3);
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.font = `600 13px ${FONT}`;
    const w = ctx.measureText(notice.text).width + 22;
    ctx.fillStyle = 'rgba(10,30,42,0.78)';
    ctx.beginPath();
    ctx.roundRect(viewW - w - 12, y - 15, w, 24, 7);
    ctx.fill();
    ctx.fillStyle = '#fdf6e3';
    ctx.fillText(notice.text, viewW - 23, y + 2);
    y += 30;
  }
  ctx.globalAlpha = 1;
}

function drawBanner(G, ctx, viewW, viewH) {
  const banner = G.banner;
  const fade = Math.min(1, banner.t / 0.35, (4.4 - banner.t) / 0.7);
  if (fade <= 0) return;
  ctx.globalAlpha = Math.max(0, fade);
  const cy = viewH * 0.22;
  ctx.textAlign = 'center';
  ctx.font = `800 39px ${FONT}`;
  const titleW = ctx.measureText(banner.title).width;
  ctx.font = `15px ${FONT}`;
  const lines = wrapText(ctx, banner.sub, 600);
  const subW = Math.max(...lines.map((line) => ctx.measureText(line).width), 0);
  const w = Math.max(titleW, subW) + 56;
  const h = 62 + lines.length * 21 + 14;
  ctx.fillStyle = 'rgba(10, 30, 42, 0.82)';
  ctx.beginPath();
  ctx.roundRect(viewW / 2 - w / 2, cy - 44, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = '#ffd94d';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffd94d';
  ctx.font = `800 39px ${FONT}`;
  ctx.fillText(banner.title, viewW / 2, cy + 8);
  ctx.fillStyle = '#fdf6e3';
  ctx.font = `15px ${FONT}`;
  lines.forEach((line, index) => ctx.fillText(line, viewW / 2, cy + 36 + index * 21));
  ctx.globalAlpha = 1;
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function drawObjective(G, ctx, viewW, viewH) {
  let text = null;
  if (G.objective) {
    const dist = Math.hypot(G.objective.x - G.player.x, G.objective.y - G.player.y);
    text = `${G.objective.text}  ·  ${Math.max(1, Math.round(dist / 10))} m`;
  } else if (G.story.stage === 'done') {
    text = 'Free roam — the courier board at Puerto Brisa docks pays cash for fast hands';
  }
  if (!text) return;
  ctx.font = `600 14.5px ${FONT}`;
  const w = ctx.measureText(text).width + 40;
  const y = viewH - 52;
  ctx.fillStyle = 'rgba(10,30,42,0.78)';
  ctx.beginPath();
  ctx.roundRect(viewW / 2 - w / 2, y, w, 30, 15);
  ctx.fill();
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath();
  ctx.arc(viewW / 2 - w / 2 + 17, y + 15, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fdf6e3';
  ctx.textAlign = 'center';
  ctx.fillText(text, viewW / 2 + 8, y + 19.5);
}

function drawPrompt(G, ctx, viewW, viewH) {
  ctx.font = `700 15px ${FONT}`;
  const w = ctx.measureText(G.prompt).width + 34;
  const y = viewH - 96;
  ctx.fillStyle = 'rgba(226, 112, 58, 0.92)';
  ctx.beginPath();
  ctx.roundRect(viewW / 2 - w / 2, y, w, 30, 15);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(G.prompt, viewW / 2, y + 20);
}

function drawSpeedo(G, ctx, viewW, viewH) {
  const car = G.player.inCar;
  const kmh = Math.round(Math.abs(forwardSpeed(car)) * 0.32);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText(car.name.toUpperCase(), viewW - 18, viewH - 58);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText(String(kmh), viewW - 52, viewH - 18);
  ctx.font = `600 12px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('km/h', viewW - 16, viewH - 18);
}
