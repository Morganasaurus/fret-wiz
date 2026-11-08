/**
 * Metronome engine. Clicks are scheduled on the Web Audio clock a little ahead of time (a "lookahead"
 * scheduler), so timing stays steady even when the page is busy; the screen catches up on each animation
 * frame. It runs independently of the page, so it keeps going while you switch modes.
 */
import { useSyncExternalStore } from "react";
import { type ClickKind, audioClock, scheduleClick } from "./audio";
import { type RampPoint, type TrainerSettings, tempoAtBar } from "./trainer";

export interface MetronomeState {
  running: boolean;
  /** Bar and beat being heard now (0-based). */
  bar: number;
  beat: number;
  point: RampPoint | null;
  /** Seconds since the start. */
  elapsed: number;
  /** Fastest tempo reached this run. */
  peak: number;
}

const IDLE: MetronomeState = { running: false, bar: 0, beat: 0, point: null, elapsed: 0, peak: 0 };

let state: MetronomeState = IDLE;
const listeners = new Set<() => void>();
const emit = (next: MetronomeState) => {
  state = next;
  listeners.forEach((l) => l());
};

let settings: TrainerSettings | null = null;
let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let frame = 0;
let startTime = 0;
let nextTime = 0;
let pos = { bar: 0, beat: 0, sub: 0 };
let queue: { time: number; bar: number; beat: number; point: RampPoint }[] = [];
let pending: { time: number; cancel: () => void }[] = [];

function schedule() {
  if (!ctx || !settings) return;
  // Background tabs only get a timer about once a second, so look further ahead there.
  const horizon = ctx.currentTime + (document.hidden ? 1.6 : 0.12);
  while (nextTime < horizon) {
    const point = tempoAtBar(pos.bar, settings);
    const kind: ClickKind = pos.sub ? "sub" : pos.beat ? "beat" : "accent";
    pending.push({ time: nextTime, cancel: scheduleClick(nextTime, kind, settings.volume) });
    if (!pos.sub) queue.push({ time: nextTime, bar: pos.bar, beat: pos.beat, point });
    nextTime += 60 / point.bpm / settings.subdivision;
    if (++pos.sub >= settings.subdivision) {
      pos.sub = 0;
      if (++pos.beat >= settings.beatsPerBar) {
        pos.beat = 0;
        pos.bar++;
      }
    }
  }
  pending = pending.filter((p) => p.time > ctx!.currentTime - 0.2);
}

function draw() {
  if (!ctx) return;
  let heard: (typeof queue)[number] | null = null;
  while (queue.length && queue[0].time <= ctx.currentTime) heard = queue.shift()!;
  if (heard) {
    emit({
      running: true,
      bar: heard.bar,
      beat: heard.beat,
      point: heard.point,
      elapsed: heard.time - startTime,
      peak: Math.max(state.peak, heard.point.bpm),
    });
  }
  frame = requestAnimationFrame(draw);
}

/** Start from bar 1 at the start tempo. Call from a tap (iOS needs that to allow sound). */
export function startMetronome(t: TrainerSettings) {
  stopMetronome();
  settings = t;
  ctx = audioClock();
  startTime = nextTime = ctx.currentTime + 0.12;
  pos = { bar: 0, beat: 0, sub: 0 };
  emit({ running: true, bar: 0, beat: -1, point: tempoAtBar(0, t), elapsed: 0, peak: t.start });
  schedule();
  timer = setInterval(schedule, 25);
  frame = requestAnimationFrame(draw);
}

/** Change settings while running; the new tempo takes effect from the next click. */
export function updateMetronome(t: TrainerSettings) {
  if (timer) settings = t;
}

/** Stop straight away (clicks already queued are cancelled). The last run's result stays readable. */
export function stopMetronome() {
  if (!timer) return;
  clearInterval(timer);
  cancelAnimationFrame(frame);
  timer = null;
  const now = ctx?.currentTime ?? 0;
  pending.filter((p) => p.time > now).forEach((p) => p.cancel());
  pending = [];
  queue = [];
  emit({ ...state, running: false });
}

export const isMetronomeRunning = () => timer !== null;

/** Live metronome state for React. */
export function useMetronome(): MetronomeState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
