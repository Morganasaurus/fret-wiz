import { describe, expect, it } from "vitest";
import { PRESETS, borrowedChords, keyChords, keysContaining, resolveRef } from "./harmony";

describe("key chords", () => {
  it("lists the chords in D major with roles", () => {
    const chords = keyChords("D", "major", false);
    expect(chords.map((c) => c.symbol)).toEqual(["D", "Em", "F#m", "G", "A", "Bm", "C#°"]);
    expect(chords.map((c) => c.role)).toEqual(["home", "away", "home", "away", "tension", "home", "tension"]);
  });

  it("switches to sevenths", () => {
    expect(keyChords("D", "major", true).map((c) => c.symbol)).toEqual([
      "Dmaj7", "Em7", "F#m7", "Gmaj7", "A7", "Bm7", "C#m7b5",
    ]);
  });

  it("borrows from the parallel key", () => {
    expect(borrowedChords("D", "major", false).map((c) => `${c.roman} ${c.symbol}`)).toEqual([
      "iv Gm", "bIII F", "bVI Bb", "bVII C",
    ]);
    expect(borrowedChords("A", "minor", false).map((c) => `${c.roman} ${c.symbol}`)).toEqual(["V E", "IV D"]);
  });

  it("resolves progressions in any key", () => {
    const pop = PRESETS.major.find((p) => p.name === "Pop anthem")!;
    expect(pop.steps.map((r) => resolveRef(r, "D", "major", false)!.symbol)).toEqual(["D", "A", "Bm", "G"]);
    expect(pop.steps.map((r) => resolveRef(r, "G", "major", false)!.symbol)).toEqual(["G", "D", "Em", "C"]);
    const andalusian = PRESETS.minor.find((p) => p.name === "Andalusian")!;
    expect(andalusian.steps.map((r) => resolveRef(r, "A", "minor", false)!.symbol)).toEqual(["Am", "G", "F", "E"]);
  });

  it("every preset resolves in every key", () => {
    for (const quality of ["major", "minor"] as const) {
      for (const tonic of ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]) {
        for (const p of PRESETS[quality]) {
          for (const step of p.steps) expect(resolveRef(step, tonic, quality, true), `${tonic} ${quality} ${p.name}`).not.toBeNull();
        }
      }
    }
  });
});

describe("keys containing a chord", () => {
  it("finds every key with G major in it", () => {
    const keys = keysContaining("G", "M").map((k) => `${k.tonic} ${k.quality} ${k.roman}`);
    expect(new Set(keys)).toEqual(
      new Set(["C major V", "D major IV", "G major I", "A minor bVII", "B minor bVI", "E minor bIII"]),
    );
  });

  it("matches sevenths", () => {
    expect(keysContaining("A", "7").map((k) => `${k.tonic} ${k.quality} ${k.roman}`)).toEqual([
      "D major V7",
      "B minor bVII7",
    ]);
  });
});
