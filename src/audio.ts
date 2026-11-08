/**
 * Guitar sound.
 *
 * Plays real steel-string acoustic guitar recordings (University of Iowa samples, see README), one recording
 * every three semitones, pitched to the notes in between. If the recordings can't be loaded it falls back to
 * a small plucked-string synth (Karplus-Strong). A light reverb gives the dry recordings
 * some room.
 *
 * iOS only allows audio after a tap, so the AudioContext is created on the first sound. The recordings are
 * fetched and decoded as soon as the page loads (see `preloadSamples`); a sound asked for before they are
 * ready waits for them, so the synth is only heard if the files can't be loaded at all.
 */

const SAMPLE_NOTES: [file: string, midi: number][] = [
  ["E2", 40],
  ["G2", 43],
  ["As2", 46],
  ["Cs3", 49],
  ["E3", 52],
  ["G3", 55],
  ["As3", 58],
  ["Cs4", 61],
  ["E4", 64],
  ["G4", 67],
  ["As4", 70],
  ["Cs5", 73],
  ["D5", 74],
];
const SAMPLE_DIR = `${import.meta.env.BASE_URL}samples/guitar-steel/`;

interface Sample {
  midi: number;
  buffer: AudioBuffer;
  /** Seconds of near-silence at the start, skipped on playback so strums stay tight. */
  offset: number;
}

let ctx: AudioContext | null = null;
let input: GainNode | null = null;
let master: DynamicsCompressorNode | null = null;
let loading: Promise<Sample[]> | null = null;
let samples: Sample[] | null = null;
const synthBuffers = new Map<number, AudioBuffer>();
let active: { src: AudioBufferSourceNode; gain: GainNode }[] = [];

/**
 * Download and decode the recordings. Decoding uses an OfflineAudioContext, which needs no tap, so the
 * guitar is ready before the first sound instead of starting on the synth. Safe to call more than once;
 * after a failure the next call tries again.
 */
export function preloadSamples(): Promise<Sample[]> {
  if (loading) return loading;
  const decoder = new OfflineAudioContext(1, 1, 44100);
  loading = Promise.all(
    SAMPLE_NOTES.map(async ([file, midi]) => {
      const res = await fetch(`${SAMPLE_DIR}${file}.mp3`);
      if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
      const buffer = await decoder.decodeAudioData(await res.arrayBuffer());
      return { midi, buffer, offset: leadingSilence(buffer) };
    }),
  ).then(
    (decoded) => (samples = decoded.sort((a, b) => a.midi - b.midi)),
    (err) => {
      loading = null;
      console.warn("Guitar samples failed to load, using the synth:", err);
      throw err;
    },
  );
  loading.catch(() => {});
  return loading;
}

function leadingSilence(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  const limit = Math.min(data.length, Math.floor(buffer.sampleRate * 0.5));
  for (let i = 0; i < limit; i++) {
    if (Math.abs(data[i]) > 0.02) return Math.max(0, i / buffer.sampleRate - 0.004);
  }
  return 0;
}

/** Small synthetic room: decaying stereo noise. */
function roomImpulse(c: AudioContext): AudioBuffer {
  const seconds = 1.4;
  const length = Math.floor(c.sampleRate * seconds);
  const ir = c.createBuffer(2, length, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3.2);
  }
  return ir;
}

function audio(): { ctx: AudioContext; input: GainNode } {
  if (!ctx) {
    ctx = new AudioContext();
    const comp = ctx.createDynamicsCompressor();
    comp.connect(ctx.destination);
    master = comp;
    input = ctx.createGain();
    input.gain.value = 0.8;
    const dry = ctx.createGain();
    dry.gain.value = 1;
    const reverb = ctx.createConvolver();
    reverb.buffer = roomImpulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.16;
    input.connect(dry).connect(comp);
    input.connect(reverb).connect(wet).connect(comp);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, input: input! };
}

/** True once the real guitar recordings are ready (otherwise the synth is used). */
export function usingSamples(): boolean {
  return !!samples;
}

/** How long a sound waits for the recordings before giving up and using the synth. */
const WAIT_FOR_SAMPLES_MS = 2500;
let latestRequest = 0;

/**
 * Run `play` with the guitar. If the recordings are still loading, wait for them (briefly) rather than
 * playing the synth; only the latest request is played, so taps made while loading don't pile up.
 */
function withGuitar(play: (c: AudioContext, out: AudioNode) => void) {
  const { ctx: c, input: out } = audio(); // created inside the tap, as iOS requires
  if (samples) return play(c, out);
  const request = ++latestRequest;
  const timeout = new Promise((resolve) => setTimeout(resolve, WAIT_FOR_SAMPLES_MS));
  Promise.race([preloadSamples(), timeout])
    .catch(() => {})
    .then(() => {
      if (request === latestRequest) play(c, out);
    });
}

// ---------------------------------------------------------------------------
// Fallback synth
// ---------------------------------------------------------------------------

function synthBuffer(c: AudioContext, midi: number): AudioBuffer {
  const cached = synthBuffers.get(midi);
  if (cached) return cached;
  const rate = c.sampleRate;
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const length = Math.floor(rate * 3);
  const buffer = c.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  const period = Math.max(2, Math.round(rate / freq));
  const ring = new Float32Array(period);
  let prev = 0;
  for (let i = 0; i < period; i++) {
    prev = prev * 0.45 + (Math.random() * 2 - 1) * 0.55;
    ring[i] = prev;
  }
  const decay = Math.min(0.9985, 0.994 + (60 - Math.min(midi, 84)) * 0.00012);
  let idx = 0;
  for (let i = 0; i < length; i++) {
    const next = (idx + 1) % period;
    const v = ring[idx];
    ring[idx] = decay * 0.5 * (v + ring[next]);
    data[i] = v;
    idx = next;
  }
  const fade = Math.floor(rate * 0.2);
  for (let i = 0; i < fade; i++) data[length - fade + i] *= 1 - i / fade;
  synthBuffers.set(midi, buffer);
  return buffer;
}

// ---------------------------------------------------------------------------
// Playing notes
// ---------------------------------------------------------------------------

/** Start one note at time `t`. `ring` (seconds) fades it out early; otherwise it rings out. */
function voice(c: AudioContext, out: AudioNode, midi: number, t: number, level: number, ring?: number) {
  const src = c.createBufferSource();
  const gain = c.createGain();
  let offset = 0;

  if (samples) {
    // Nearest recording; pitch it by at most a semitone or two.
    let best = samples[0];
    for (const s of samples) if (Math.abs(s.midi - midi) < Math.abs(best.midi - midi)) best = s;
    src.buffer = best.buffer;
    src.playbackRate.value = Math.pow(2, (midi - best.midi) / 12);
    offset = best.offset;
    level *= 1.6; // recordings are quieter than the synth
  } else {
    src.buffer = synthBuffer(c, midi);
  }

  gain.gain.setValueAtTime(level, t);
  if (ring !== undefined) {
    gain.gain.setValueAtTime(level, t + ring);
    gain.gain.linearRampToValueAtTime(0, t + ring + 0.15);
    src.stop(t + ring + 0.2);
  }
  src.connect(gain).connect(out);
  src.start(t, offset);
  active.push({ src, gain });
  src.onended = () => {
    active = active.filter((a) => a.src !== src);
  };
}

/** Damp whatever is still ringing. */
export function stopAll(fade = 0.08) {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const { src, gain } of active) {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + fade);
    try {
      src.stop(now + fade + 0.02);
    } catch {
      /* already stopped */
    }
  }
  active = [];
}

const jitter = (amount: number) => (Math.random() * 2 - 1) * amount;

/**
 * Strum notes low to high, like a downstroke. Small random differences in timing and loudness
 * between strings keep it from sounding mechanical.
 */
export function strum(midis: number[], spread = 0.03) {
  if (!midis.length) return;
  withGuitar((c, out) => {
    stopAll(0.05);
    const start = c.currentTime + 0.03;
    const level = 0.55 / Math.sqrt(midis.length);
    let t = start;
    midis.forEach((m, i) => {
      if (i > 0) t += Math.max(0.008, spread + jitter(0.008));
      // Strings later in a downstroke are hit a touch softer.
      const loudness = level * (1 - i * 0.03) * (1 + jitter(0.12));
      voice(c, out, m, t, loudness);
    });
  });
}

/** Play notes one after another (e.g. a scale shape), each fading after `ring` seconds. */
export function playSequence(midis: number[], gap = 0.26, ring = 0.9) {
  if (!midis.length) return;
  withGuitar((c, out) => {
    stopAll();
    const start = c.currentTime + 0.05;
    midis.forEach((m, i) => voice(c, out, m, start + i * gap, 0.4 * (1 + jitter(0.08)), ring));
  });
}

/** Play a single note. */
export function pluck(midi: number) {
  strum([midi], 0);
}

// ---------------------------------------------------------------------------
// Metronome click
// ---------------------------------------------------------------------------

export type ClickKind = "accent" | "beat" | "sub";

/** The audio clock (creating the AudioContext if needed: call it from a tap the first time). */
export function audioClock(): AudioContext {
  return audio().ctx;
}

const CLICK: Record<ClickKind, { freq: number; level: number }> = {
  accent: { freq: 1760, level: 1 },
  beat: { freq: 1175, level: 0.7 },
  sub: { freq: 880, level: 0.32 },
};

/**
 * A short woodblock-like tick at audio time `t`, dry (no reverb), unaffected by `stopAll`.
 * Returns a function that cancels it if it hasn't sounded yet.
 */
export function scheduleClick(t: number, kind: ClickKind, volume: number): () => void {
  const { ctx: c } = audio();
  const { freq, level } = CLICK[kind];
  const osc = c.createOscillator();
  const body = c.createOscillator();
  const gain = c.createGain();
  osc.frequency.value = freq;
  body.type = "triangle";
  body.frequency.value = freq / 2;
  const peak = Math.max(0.0001, level * volume * 0.9);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
  osc.connect(gain);
  body.connect(gain);
  gain.connect(master!);
  osc.start(t);
  body.start(t);
  osc.stop(t + 0.07);
  body.stop(t + 0.07);
  return () => {
    try {
      osc.stop();
      body.stop();
    } catch {
      /* already finished */
    }
  };
}
