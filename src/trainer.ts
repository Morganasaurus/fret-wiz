/**
 * Speed trainer: a metronome that starts at a tempo you can play cleanly and steps up towards a target,
 * a few BPM every few bars. Pure functions (no audio), so the ramp can be tested.
 */

export type Subdivision = 1 | 2 | 3 | 4;

export interface TrainerSettings {
  /** false = a plain metronome at `start`. */
  speedUp: boolean;
  /** BPM to begin at. */
  start: number;
  /** BPM to finish at (may be below `start` to slow down). */
  target: number;
  /** BPM added at each step. */
  step: number;
  /** Bars played at each tempo before the next step. */
  barsPerStep: number;
  /** Beats in a bar (counted in quarter notes: 4 = 4/4). */
  beatsPerBar: number;
  /** Clicks per beat: 1 beats, 2 eighths, 3 triplets, 4 sixteenths. */
  subdivision: Subdivision;
  /** At the target: keep playing it, or go back to the start tempo and climb again. */
  atTarget: "hold" | "restart";
  /** Click loudness, 0–1. */
  volume: number;
}

export const BPM_MIN = 30;
export const BPM_MAX = 300;

export const TRAINER_DEFAULTS: TrainerSettings = {
  speedUp: true,
  start: 60,
  target: 100,
  step: 4,
  barsPerStep: 4,
  beatsPerBar: 4,
  subdivision: 1,
  atTarget: "hold",
  volume: 0.8,
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const int = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback);

export const clampBpm = (bpm: number) => clamp(Math.round(bpm), BPM_MIN, BPM_MAX);

/** Fill in and clamp settings (e.g. read back from storage). */
export function normalizeTrainer(raw: Partial<TrainerSettings> | undefined): TrainerSettings {
  const r = { ...TRAINER_DEFAULTS, ...(raw ?? {}) };
  return {
    speedUp: r.speedUp !== false,
    start: clampBpm(int(r.start, TRAINER_DEFAULTS.start)),
    target: clampBpm(int(r.target, TRAINER_DEFAULTS.target)),
    step: clamp(int(r.step, TRAINER_DEFAULTS.step), 1, 50),
    barsPerStep: clamp(int(r.barsPerStep, TRAINER_DEFAULTS.barsPerStep), 1, 64),
    beatsPerBar: clamp(int(r.beatsPerBar, TRAINER_DEFAULTS.beatsPerBar), 1, 12),
    subdivision: ([1, 2, 3, 4] as const).includes(r.subdivision) ? r.subdivision : 1,
    atTarget: r.atTarget === "restart" ? "restart" : "hold",
    volume: clamp(typeof r.volume === "number" && Number.isFinite(r.volume) ? r.volume : TRAINER_DEFAULTS.volume, 0, 1),
  };
}

/** Number of tempo changes from start to target (0 for a steady metronome). */
export function rampSteps(t: TrainerSettings): number {
  if (!t.speedUp) return 0;
  return Math.ceil(Math.abs(t.target - t.start) / t.step);
}

export interface RampPoint {
  bpm: number;
  /** 0 = the start tempo, `steps` = the target. */
  step: number;
  steps: number;
  /** Bar within the current tempo, 0-based. */
  barInStep: number;
  /** Bars left at this tempo, counting the current one. */
  barsLeft: number;
  atTarget: boolean;
}

/** The tempo for bar `bar` (0-based). The last step lands exactly on the target. */
export function tempoAtBar(bar: number, t: TrainerSettings): RampPoint {
  const steps = rampSteps(t);
  const barInStep = bar % t.barsPerStep;
  const raw = Math.floor(bar / t.barsPerStep);
  const step = t.atTarget === "restart" ? raw % (steps + 1) : Math.min(raw, steps);
  const distance = Math.abs(t.target - t.start);
  const sign = t.target >= t.start ? 1 : -1;
  const bpm = steps ? t.start + sign * Math.min(step * t.step, distance) : t.start;
  return { bpm, step, steps, barInStep, barsLeft: t.barsPerStep - barInStep, atTarget: step >= steps };
}

/** Seconds of playing before the target tempo is reached. */
export function timeToTarget(t: TrainerSettings): number {
  let seconds = 0;
  for (let i = 0; i < rampSteps(t); i++) {
    seconds += (t.barsPerStep * t.beatsPerBar * 60) / tempoAtBar(i * t.barsPerStep, t).bpm;
  }
  return seconds;
}

/** 75 -> "1:15". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
