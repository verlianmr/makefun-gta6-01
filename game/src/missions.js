// The story of Costa Brisa, in three jobs for dock fixer Mara Voss, plus the courier work
// that keeps Rio fed afterwards. One state machine: each stage names an objective point, a
// line of text for the HUD, and the arrival or conversation that ends it.

import { HEAT_FOR_STAR, PLACES } from './config.js';
import { setHeat } from './police.js';

const TALK_RADIUS = 40;
const ARRIVE_RADIUS = 48;

/** Street corners and forecourts the courier board sends Rio between. */
const JOB_POINTS = [
  { ...PLACES.clubDoor, label: 'the Marlin Club' },
  { ...PLACES.marinaLot, label: 'Marina Lot' },
  { ...PLACES.hospital, label: 'San Brisa Hospital' },
  { ...PLACES.policeStation, label: 'the CBPD station' },
  { x: 2400, y: 636, label: 'the Hotel Coralina' },
  { x: 1920, y: 1490, label: 'Banco del Sol' },
  { ...PLACES.shopDrop, label: "Tito's Chop Shop" },
  { ...PLACES.lighthouse, label: 'Lighthouse Point' },
  { x: 960, y: 1490, label: 'the Palms Mall steps' },
];

export function createStory(savedStage = 'meet') {
  return { stage: savedStage, job: null, jobCooldown: 0 };
}

function reward(G, amount, title, sub) {
  G.stats.cash += amount;
  G.stats.storyDone = Math.min(3, G.stats.storyDone + (title ? 1 : 0));
  G.popup?.(G.player.x, G.player.y - 30, `+$${amount}`);
  G.audio.cash();
  if (title) G.showBanner?.(title, sub);
  G.saveSoon?.();
}

/** The one objective the HUD shows: an active courier job outranks the story. */
export function currentObjective(G) {
  const job = G.story.job;
  if (job) {
    return {
      x: job.x,
      y: job.y,
      text: `${job.phase === 'pickup' ? 'Pick up' : 'Deliver'} — ${job.label} · $${job.pay} · ${Math.max(0, Math.ceil(job.timeLeft))}s`,
    };
  }
  const stage = G.story.stage;
  switch (stage) {
    case 'meet': return { ...PLACES.clubDoor, text: 'Meet Mara Voss at the Marlin Club' };
    case 'm1_go': return { ...PLACES.dockPickup, text: 'Pick up the package at Puerto Brisa docks' };
    case 'm1_deliver': return { ...PLACES.clubDoor, text: 'Deliver the package to the Marlin Club' };
    case 'm2_talk': return { ...PLACES.clubDoor, text: 'Mara has another job — see her at the club' };
    case 'm2_steal': return { x: G.missionCar?.x ?? PLACES.marinaLot.x, y: G.missionCar?.y ?? PLACES.marinaLot.y, text: 'Steal the crimson Vantek Sable at Marina Lot' };
    case 'm2_deliver': return { ...PLACES.shopDrop, text: "Take the Sable to Tito's Chop Shop" };
    case 'm3_talk': return { ...PLACES.clubDoor, text: 'Mara needs a ride — see her at the club' };
    case 'm3_drive': return { ...PLACES.lighthouse, text: 'Get Mara to Lighthouse Point' };
    default: return null;
  }
}

/** The E interaction on offer right now, if any: a talk, or the courier board at the docks. */
export function currentInteract(G) {
  const stage = G.story.stage;
  const player = G.player;
  const near = (point, radius) => Math.hypot(player.x - point.x, player.y - point.y) < radius;
  if ((stage === 'meet' || stage === 'm2_talk' || stage === 'm3_talk') && near(PLACES.clubDoor, TALK_RADIUS)) {
    return { kind: 'talk', text: 'E — Talk to Mara Voss' };
  }
  const boardReady = !G.story.job && G.story.jobCooldown <= 0
    && !['meet', 'm1_go', 'm1_deliver'].includes(stage) && near(PLACES.dockPickup, TALK_RADIUS + 6);
  if (boardReady) return { kind: 'job', text: 'E — Take a courier job' };
  return null;
}

export function doInteract(G) {
  const interact = currentInteract(G);
  if (!interact) return false;
  if (interact.kind === 'job') {
    startJob(G);
    return true;
  }
  const stage = G.story.stage;
  if (stage === 'meet') {
    G.story.stage = 'm1_go';
    G.showBanner?.('FIRST RUN', 'Mara: "A package is waiting at the docks. Bring it to the club — and borrow a car, you will need one."');
  } else if (stage === 'm2_talk') {
    G.story.stage = 'm2_steal';
    G.showBanner?.('BORROWED WHEELS', 'Mara: "A crimson Vantek Sable sits at Marina Lot. Tito will pay for it. The owner will not mind. Much."');
  } else if (stage === 'm3_talk') {
    G.story.stage = 'm3_drive';
    setHeat(G, HEAT_FOR_STAR[3]);
    G.showBanner?.('HEAT CHECK', 'Mara is in. Every badge in Brisa just heard her name — get her to Lighthouse Point.');
  }
  G.audio.pickup();
  G.saveSoon?.();
  return true;
}

function startJob(G) {
  const from = JOB_POINTS[G.rng.int(0, JOB_POINTS.length - 1)];
  let to = JOB_POINTS[G.rng.int(0, JOB_POINTS.length - 1)];
  if (to === from) to = JOB_POINTS[(JOB_POINTS.indexOf(from) + 3) % JOB_POINTS.length];
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  G.story.job = {
    phase: 'pickup',
    x: from.x,
    y: from.y,
    label: `a parcel at ${from.label}`,
    dropX: to.x,
    dropY: to.y,
    dropLabel: to.label,
    pay: Math.round(110 + dist * 0.12),
    timeLeft: dist / 230 + 34,
  };
  G.showBanner?.('COURIER JOB', `Pick up at ${from.label}, deliver to ${to.label}. The clock is running.`);
  G.audio.pickup();
}

/** Arrivals and the courier clock. Called every step while playing. */
export function updateMissions(G, dt) {
  const story = G.story;
  const player = G.player;
  story.jobCooldown = Math.max(0, story.jobCooldown - dt);
  const near = (point, radius) => Math.hypot(player.x - point.x, player.y - point.y) < radius;

  if (story.job) {
    const job = story.job;
    job.timeLeft -= dt;
    if (job.timeLeft <= 0) {
      story.job = null;
      story.jobCooldown = 4;
      G.notify?.('The courier job expired unpaid.');
      G.audio.fail();
    } else if (near(job, ARRIVE_RADIUS)) {
      if (job.phase === 'pickup') {
        job.phase = 'deliver';
        job.x = job.dropX;
        job.y = job.dropY;
        job.label = job.dropLabel;
        job.timeLeft += Math.hypot(job.x - player.x, job.y - player.y) / 230 + 22;
        G.audio.pickup();
        G.notify?.('Parcel aboard — get it there while the clock runs.');
      } else {
        G.stats.cash += job.pay;
        G.stats.jobsDone += 1;
        G.popup?.(player.x, player.y - 30, `+$${job.pay}`);
        G.audio.cash();
        G.notify?.(`Delivered. $${job.pay} and the board remembers your name.`);
        story.job = null;
        story.jobCooldown = 2;
        G.saveSoon?.();
      }
    }
  }

  switch (story.stage) {
    case 'm1_go':
      if (near(PLACES.dockPickup, ARRIVE_RADIUS)) {
        story.stage = 'm1_deliver';
        G.showBanner?.('PACKAGE ABOARD', 'Whatever is in this crate, Mara wants it at the club. Drive carefully — or do not.');
        G.audio.pickup();
      }
      break;
    case 'm1_deliver':
      if (near(PLACES.clubDoor, ARRIVE_RADIUS)) {
        story.stage = 'm2_talk';
        reward(G, 600, 'FIRST RUN — COMPLETE', 'Mara counts the crate, then counts you in. +$600');
      }
      break;
    case 'm2_steal':
      if (player.inCar && G.missionCar && player.inCar === G.missionCar) {
        story.stage = 'm2_deliver';
        G.showBanner?.('BORROWED WHEELS', 'The Sable purrs. Tito\'s Chop Shop, southwest — and the owner just called it in.');
      }
      break;
    case 'm2_deliver':
      if (player.inCar === G.missionCar && near(PLACES.shopDrop, 56)) {
        const car = G.missionCar;
        car.playerIn = false;
        car.parked = true;
        car.missionCar = false;
        player.inCar = null;
        player.x = car.x + 34;
        player.y = car.y + 10;
        story.stage = 'm3_talk';
        reward(G, 900, 'BORROWED WHEELS — COMPLETE', 'Tito does not ask where it came from. +$900');
      }
      break;
    case 'm3_drive':
      if (near(PLACES.lighthouse, 58)) {
        story.stage = 'done';
        setHeat(G, 0);
        G.wanted.bust = 0;
        reward(G, 1400, 'STORY COMPLETE — NEON SHORES', 'Mara vanishes into the lighthouse light. The city is yours now: courier board at the docks, cash on the table. +$1,400');
      }
      break;
    default:
      break;
  }
}

/** Respect titles as the board and the story remember more of Rio's name. */
export function respectTitle(G) {
  const score = G.stats.storyDone * 2 + G.stats.jobsDone;
  if (score >= 14) return 'Brisa Legend';
  if (score >= 9) return 'Fixer';
  if (score >= 5) return 'Wheelman';
  if (score >= 2) return 'Courier';
  if (score >= 1) return 'Runner';
  return 'Nobody';
}
