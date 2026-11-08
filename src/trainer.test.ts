import { describe, expect, it } from "vitest";
import { TRAINER_DEFAULTS, type TrainerSettings, formatDuration, normalizeTrainer, rampSteps, tempoAtBar, timeToTarget } from "./trainer";

const t = (patch: Partial<TrainerSettings>): TrainerSettings => ({ ...TRAINER_DEFAULTS, ...patch });
const bpms = (cfg: TrainerSettings, bars: number) => Array.from({ length: bars }, (_, b) => tempoAtBar(b, cfg).bpm);

describe("speed trainer ramp", () => {
  it("steps up every few bars and holds at the target", () => {
    const cfg = t({ start: 60, target: 100, step: 4, barsPerStep: 4 });
    expect(rampSteps(cfg)).toBe(10);
    expect(bpms(cfg, 9)).toEqual([60, 60, 60, 60, 64, 64, 64, 64, 68]);
    expect(tempoAtBar(40, cfg)).toMatchObject({ bpm: 100, step: 10, atTarget: true });
    expect(tempoAtBar(400, cfg).bpm).toBe(100);
  });

  it("lands exactly on the target when the step doesn't divide the distance", () => {
    expect(bpms(t({ start: 60, target: 70, step: 4, barsPerStep: 1 }), 5)).toEqual([60, 64, 68, 70, 70]);
  });

  it("goes back to the start after the target when asked", () => {
    const cfg = t({ start: 60, target: 68, step: 4, barsPerStep: 2, atTarget: "restart" });
    expect(bpms(cfg, 8)).toEqual([60, 60, 64, 64, 68, 68, 60, 60]);
  });

  it("can slow down", () => {
    expect(bpms(t({ start: 100, target: 90, step: 5, barsPerStep: 1 }), 4)).toEqual([100, 95, 90, 90]);
  });

  it("is a plain metronome when speeding up is off", () => {
    const cfg = t({ speedUp: false, start: 72, target: 120 });
    expect(rampSteps(cfg)).toBe(0);
    expect(bpms(cfg, 20).every((b) => b === 72)).toBe(true);
    expect(tempoAtBar(5, cfg).atTarget).toBe(true);
  });

  it("counts bars left at each tempo", () => {
    const cfg = t({ barsPerStep: 4 });
    expect(tempoAtBar(0, cfg)).toMatchObject({ barInStep: 0, barsLeft: 4 });
    expect(tempoAtBar(7, cfg)).toMatchObject({ barInStep: 3, barsLeft: 1 });
  });

  it("works out how long it takes to reach the target", () => {
    // One bar of 4/4 at 60 BPM, then the target.
    expect(timeToTarget(t({ start: 60, target: 64, step: 4, barsPerStep: 1, beatsPerBar: 4 }))).toBeCloseTo(4);
    // 60 then 120: two bars of 4/4 at 60 (8 s) and two at 90 (≈5.33 s).
    expect(timeToTarget(t({ start: 60, target: 120, step: 30, barsPerStep: 2 }))).toBeCloseTo(8 + 16 / 3);
    expect(formatDuration(75)).toBe("1:15");
    expect(formatDuration(5)).toBe("0:05");
  });

  it("cleans up stored settings", () => {
    const n = normalizeTrainer({ start: 5, target: 999, step: 0, barsPerStep: -2, subdivision: 7 as never, volume: 3 });
    expect(n).toMatchObject({ start: 30, target: 300, step: 1, barsPerStep: 1, subdivision: 1, volume: 1 });
    expect(normalizeTrainer(undefined)).toEqual(TRAINER_DEFAULTS);
  });
});
