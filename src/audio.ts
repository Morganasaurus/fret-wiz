/**
 * Tiny plucked-string synth (Karplus-Strong), so chords can be heard without samples.
 * The AudioContext is created on the first tap, which iOS requires.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<number, AudioBuffer>();
let active: { src: AudioBufferSourceNode; gain: GainNode }[] = [];

function audio(): { ctx: AudioContext; master: GainNode } {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, master: master! };
}

function pluckBuffer(c: AudioContext, midi: number): AudioBuffer {
  const cached = buffers.get(midi);
  if (cached) return cached;
  const rate = c.sampleRate;
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const seconds = 3;
  const length = Math.floor(rate * seconds);
  const buffer = c.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);

  const period = Math.max(2, Math.round(rate / freq));
  const ring = new Float32Array(period);
  // Slightly smoothed noise burst gives a warmer, less "plinky" attack.
  let prev = 0;
  for (let i = 0; i < period; i++) {
    const noise = Math.random() * 2 - 1;
    prev = prev * 0.45 + noise * 0.55;
    ring[i] = prev;
  }
  // Lower strings ring longer.
  const decay = Math.min(0.9985, 0.994 + (60 - Math.min(midi, 84)) * 0.00012);
  let idx = 0;
  for (let i = 0; i < length; i++) {
    const next = (idx + 1) % period;
    const v = ring[idx];
    ring[idx] = decay * 0.5 * (v + ring[next]);
    data[i] = v;
    idx = next;
  }
  // Fade the tail to avoid a click.
  const fade = Math.floor(rate * 0.2);
  for (let i = 0; i < fade; i++) data[length - fade + i] *= 1 - i / fade;

  buffers.set(midi, buffer);
  return buffer;
}

/** Damp whatever is still ringing. */
export function stopAll(fade = 0.08) {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const { src, gain } of active) {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + fade);
    src.stop(now + fade + 0.02);
  }
  active = [];
}

/** Strum notes low to high. `spread` is seconds between strings. */
export function strum(midis: number[], spread = 0.035) {
  if (!midis.length) return;
  const { ctx: c, master: out } = audio();
  stopAll();
  const start = c.currentTime + 0.03;
  const level = 0.55 / Math.sqrt(midis.length);
  midis.forEach((m, i) => {
    const src = c.createBufferSource();
    src.buffer = pluckBuffer(c, m);
    const gain = c.createGain();
    gain.gain.value = level;
    src.connect(gain).connect(out);
    src.start(start + i * spread);
    active.push({ src, gain });
    src.onended = () => {
      active = active.filter((a) => a.src !== src);
    };
  });
}

/** Play a single note. */
export function pluck(midi: number) {
  strum([midi], 0);
}
