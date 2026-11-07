import { describe, expect, it } from "vitest";
import { chordTones } from "./tones";
import { getTuning } from "./tunings";
import { OPEN_CHORDS, chordShapes, findVoicings, positionLabel, voicingText } from "./voicings";

const standard = getTuning("standard").strings;
const shapes = (root: string, type: string) => findVoicings(standard, chordTones(root, type)).map(voicingText);

describe("chord shapes in standard tuning", () => {
  it.each([
    ["C", "M", "x32010"],
    ["G", "M", "320003"],
    ["D", "M", "xx0232"],
    ["A", "M", "x02220"],
    ["E", "M", "022100"],
    ["A", "m", "x02210"],
    ["E", "m", "022000"],
    ["D", "m", "xx0231"],
  ])("easiest %s%s is the familiar open chord", (root, type, expected) => {
    expect(shapes(root, type)[0]).toBe(expected);
  });

  it.each([
    ["E", "7", "020100"],
    ["A", "7", "x02020"],
    ["D", "7", "xx0212"],
    ["C", "7", "x32310"],
    ["B", "7", "x21202"],
    ["C", "maj7", "x32000"],
    ["A", "m7", "x02010"],
    ["F", "M", "133211"],
    ["B", "m", "x24432"],
    ["A", "5", "x022xx"],
  ])("%s%s includes %s near the top", (root, type, expected) => {
    expect(shapes(root, type).slice(0, 4)).toContain(expected);
  });

  it("finds shapes all the way up the neck", () => {
    const g = shapes("G", "M");
    expect(g).toContain("355433");
    expect(g).toContain("x(10)(12)(12)(12)(10)");
  });

  it("every shape has the root in the bass and four fingers or fewer", () => {
    for (const [root, type] of [["F#", "m7b5"], ["Bb", "9"], ["Eb", "dim7"], ["G", "13"]]) {
      const tones = chordTones(root, type);
      const rootChroma = tones[0].chroma;
      const vs = findVoicings(standard, tones);
      expect(vs.length, `${root}${type}`).toBeGreaterThan(0);
      for (const v of vs) {
        expect(Math.max(...v.fingers)).toBeLessThanOrEqual(4);
        const bass = v.frets.findIndex((f) => f >= 0);
        const note = (["E", "A", "D", "G", "B", "E"].map((n) => chordTones(n, "M")[0].chroma)[bass] + v.frets[bass]) % 12;
        expect(note).toBe(rootChroma);
      }
    }
  });

  it("describes positions", () => {
    const [c] = findVoicings(standard, chordTones("C", "M"));
    expect(positionLabel(c)).toBe("Open position");
    const barreG = findVoicings(standard, chordTones("G", "M")).find((v) => voicingText(v) === "355433")!;
    expect(positionLabel(barreG)).toBe("3rd fret barre");
    expect(barreG.fingers).toEqual([1, 3, 4, 2, 1, 1]);
  });

  it.each([
    ["G", "M", "320003", "G"],
    ["C", "M", "x32010", "C"],
    ["F", "M", "133211", "E"],
    ["Bb", "M", "x13331", "A"],
    ["B", "m", "x24432", "A"],
    ["F#", "m", "244222", "E"],
    ["C#", "m", "x46654", "A"],
    ["B", "7", "x21202", null],
    ["F", "maj7", "xx3210", null],
    ["G", "m", "355333", "E"],
    ["C", "m", "x35543", "A"],
    ["Ab", "M", "466544", "E"],
    ["G#", "m", "466444", "E"],
    ["Eb", "M", "xx1343", "D"],
    ["B", "m7", "x20202", null],
  ])("CAGED: easiest %s%s is %s (%s shape)", (root, type, expected, shape) => {
    const set = chordShapes(standard, true, root, type);
    const best = set.shapes[set.easiest];
    expect(voicingText(best)).toBe(expected);
    if (shape) expect(best.caged).toBe(shape);
  });

  it("never defaults to open strings mixed with high frets", () => {
    for (const [root, type] of [["C#", "dim"], ["C#", "m7b5"], ["F#", "dim7"], ["Bb", "aug"]]) {
      const set = chordShapes(standard, true, root, type);
      const best = set.shapes[set.easiest];
      const mixesOpen = best.frets.some((f) => f === 0) && best.maxFret > 4;
      expect(mixesOpen, `${root}${type} -> ${voicingText(best)}`).toBe(false);
    }
  });

  it("every curated open chord is valid and playable", () => {
    for (const [type, byRoot] of Object.entries(OPEN_CHORDS)) {
      for (const [root, text] of Object.entries(byRoot)) {
        const set = chordShapes(standard, true, root, type);
        expect(voicingText(set.shapes[set.easiest]), `${root}${type}`).toBe(text);
      }
    }
  });

  it("CAGED shapes climb the neck in order", () => {
    const set = chordShapes(standard, true, "C", "M");
    const caged = set.shapes.filter((s) => s.caged);
    expect(caged.map((s) => s.caged)).toEqual(["C", "A", "G", "E", "D"]);
    expect(caged.map(voicingText)).toEqual(["x32010", "x35553", "875558", "8(10)(10)988", "xx(10)(12)(13)(12)"]);
  });

  it("works in other tunings", () => {
    const dropD = getTuning("drop-d").strings;
    expect(findVoicings(dropD, chordTones("D", "5")).map(voicingText)[0]).toMatch(/^000/);
    const dadgad = getTuning("dadgad").strings;
    expect(findVoicings(dadgad, chordTones("D", "sus4")).length).toBeGreaterThan(0);
  });
});
