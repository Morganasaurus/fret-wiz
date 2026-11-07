import { describe, expect, it } from "vitest";
import { scalePositions } from "./positions";
import { TUNINGS, getTuning } from "./tunings";

const standard = getTuning("standard").strings;

/** Frets per string, low E first, e.g. "5 8 | 5 7 | ...". */
function layout(root: string, scale: string, n: number): string {
  const pos = scalePositions(standard, root, scale, 22)[n - 1];
  return standard
    .map((_, s) =>
      pos.notes
        .filter((x) => x.string === s)
        .map((x) => x.fret)
        .sort((a, b) => a - b)
        .join(" "),
    )
    .join(" | ");
}

describe("scale positions", () => {
  it("gives the five classic A minor pentatonic boxes", () => {
    expect(scalePositions(standard, "A", "minor pentatonic", 22)).toHaveLength(5);
    expect(layout("A", "minor pentatonic", 1)).toBe("5 8 | 5 7 | 5 7 | 5 7 | 5 8 | 5 8");
    expect(layout("A", "minor pentatonic", 2)).toBe("8 10 | 7 10 | 7 10 | 7 9 | 8 10 | 8 10");
    expect(layout("A", "minor pentatonic", 3)).toBe("10 12 | 10 12 | 10 12 | 9 12 | 10 13 | 10 12");
    expect(layout("A", "minor pentatonic", 4)).toBe("12 15 | 12 15 | 12 14 | 12 14 | 13 15 | 12 15");
    expect(layout("A", "minor pentatonic", 5)).toBe("15 17 | 15 17 | 14 17 | 14 17 | 15 17 | 15 17");
  });

  it("drops shapes an octave when they'd run off a short neck", () => {
    const pos = scalePositions(standard, "A", "minor pentatonic", 15);
    expect(pos[4].minFret).toBe(2);
    expect(pos[3].minFret).toBe(12);
  });

  it("starts E minor pentatonic in open position", () => {
    expect(layout("E", "minor pentatonic", 1)).toBe("0 3 | 0 2 | 0 2 | 0 2 | 0 3 | 0 3");
  });

  it("adds the blue note inside the box", () => {
    expect(layout("A", "minor blues", 1)).toBe("5 8 | 5 6 7 | 5 7 | 5 7 8 | 5 8 | 5 8");
  });

  it("uses three notes per string for 7-note scales", () => {
    const pos = scalePositions(standard, "C", "major", 22);
    expect(pos).toHaveLength(7);
    expect(pos[0].perString).toBe(3);
    expect(layout("C", "major", 1)).toBe("8 10 12 | 8 10 12 | 9 10 12 | 9 10 12 | 10 12 13 | 10 12 13");
  });

  it("covers every scale note in each shape", () => {
    for (const scale of ["minor pentatonic", "major pentatonic", "major", "minor", "dorian", "harmonic minor"]) {
      for (const pos of scalePositions(standard, "G", scale, 22)) {
        expect(new Set(pos.notes.map((n) => n.midi % 12)).size, `${scale} ${pos.number}`).toBe(scale.includes("pentatonic") ? 5 : 7);
      }
    }
  });

  it("stays on the neck", () => {
    for (const root of ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]) {
      for (const pos of scalePositions(standard, root, "minor pentatonic", 15)) {
        expect(pos.minFret, `${root} ${pos.number}`).toBeGreaterThanOrEqual(0);
        expect(pos.notes.every((n) => n.fret <= 15)).toBe(true);
      }
    }
  });

  it("finds the same shape an octave away", () => {
    const span = (p: { minFret: number; maxFret: number }) => `${p.minFret}-${p.maxFret}`;
    const e = scalePositions(standard, "E", "minor pentatonic", 22);
    expect(span(e[0])).toBe("0-3");
    expect(e[0].copies.map(span)).toEqual(["12-15"]);

    const a = scalePositions(standard, "A", "minor pentatonic", 22);
    expect(a[0].copies.map(span)).toEqual(["17-20"]);
    expect(a[3].copies.map(span)).toEqual(["0-3"]);
    expect(a[4].copies.map(span)).toEqual(["2-5"]);

    // Copies must fit completely on the neck.
    expect(scalePositions(standard, "A", "minor pentatonic", 15)[0].copies).toEqual([]);
    // Copy notes keep the same layout, 12 frets on.
    const copy = e[0].copies[0].notes.map((n) => `${n.string}:${n.fret - 12}`).sort();
    expect(copy).toEqual(e[0].notes.map((n) => `${n.string}:${n.fret}`).sort());
  });

  it("has no shapes for symmetric scales", () => {
    expect(scalePositions(standard, "C", "whole tone", 22)).toEqual([]);
    expect(scalePositions(standard, "C", "chromatic", 22)).toEqual([]);
  });

  it("works in every tuning", () => {
    for (const t of TUNINGS) {
      expect(scalePositions(t.strings, "A", "minor pentatonic", 22).length, t.id).toBe(5);
    }
  });
});
