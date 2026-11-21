// Every sound in Costa Brisa is synthesized with WebAudio — no audio files. A tiny engine
// hum that follows your speed, two-tone sirens, a gunshot crack, and little chimes for
// pickups, jobs and trouble. M toggles the whole thing.

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenFlip = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      context = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return false;
    }
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);
    engineOsc = context.createOscillator();
    engineOsc.type = 'sawtooth';
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    const engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineOsc.connect(engineFilter).connect(engineGain).connect(master);
    engineOsc.start();
    sirenOsc = context.createOscillator();
    sirenOsc.type = 'triangle';
    sirenGain = context.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(master);
    sirenOsc.start();
    let high = false;
    sirenFlip = setInterval(() => {
      if (!context) return;
      high = !high;
      sirenOsc.frequency.setValueAtTime(high ? 960 : 690, context.currentTime);
    }, 380);
    return true;
  }

  function blip(freqA, freqB, seconds, type = 'sine', volume = 0.2) {
    if (!ensure()) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqB), context.currentTime + seconds);
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + seconds);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(context.currentTime + seconds);
  }

  function noise(seconds, volume, filterFreq) {
    if (!ensure()) return;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(master);
    source.start();
  }

  return {
    unlock: () => ensure(),
    setMuted(value) {
      muted = value;
      if (master && context) master.gain.setValueAtTime(muted ? 0 : 0.5, context.currentTime);
    },
    isMuted: () => muted,
    /** Engine note follows the car: speedRatio 0..1, silent on foot or in menus. */
    engine(speedRatio, active) {
      if (!context || !engineOsc) return;
      const target = active ? 0.05 + speedRatio * 0.05 : 0;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speedRatio * 165, context.currentTime, 0.08);
    },
    /** Sirens swell with the nearest police car: closeness 0..1, 0 turns them off. */
    siren(closeness) {
      if (!context || !sirenGain) return;
      sirenGain.gain.setTargetAtTime(closeness * 0.055, context.currentTime, 0.15);
    },
    shot: () => noise(0.14, 0.5, 2600),
    crash: (hard) => noise(0.22, hard ? 0.5 : 0.25, 700),
    pickup: () => { blip(660, 990, 0.12, 'sine', 0.22); setTimeout(() => blip(990, 1320, 0.14, 'sine', 0.18), 70); },
    cash: () => { blip(880, 880, 0.07, 'square', 0.12); setTimeout(() => blip(1174, 1174, 0.1, 'square', 0.12), 80); },
    fail: () => blip(220, 110, 0.35, 'sawtooth', 0.2),
    door: () => blip(180, 120, 0.09, 'sine', 0.25),
    stop: () => { if (sirenFlip) clearInterval(sirenFlip); },
  };
}
