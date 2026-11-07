import { describe, expect, it } from "vitest";
import { buildFretboard, fretWirePositions } from "./fretboard";
import { intervalLabel, nameForChroma, pretty, simpleDegree } from "./notes";
import { byChroma, chordTones, describeSignature, diatonicChords, keySummary, scaleTones } from "./tones";
import { TUNINGS, getTuning } from "./tunings";

describe("notes", () => {
  it("labels intervals the way guitarists write them", () => {
    expect(["1P", "2m", "2M", "3m", "3M", "4P", "4A", "5d", "5P", "5A", "6m", "6M", "7d", "7m", "7M"].map(intervalLabel)).toEqual([
      "R", "b2", "2", "b3", "3", "4", "#4", "b5", "5", "#5", "b6", "6", "bb7", "b7", "7",
    ]);
    expect(["9m", "9M", "11P", "13M"].map(intervalLabel)).toEqual(["b9", "9", "11", "13"]);
  });

  it("folds compound intervals into degrees 1-7", () => {
    expect(["1P", "3m", "7M", "9M", "11P", "13M"].map(simpleDegree)).toEqual([1, 3, 7, 2, 4, 6]);
  });

  it("prettifies accidentals", () => {
    expect(pretty("Bb")).toBe("B♭");
    expect(pretty("F#")).toBe("F♯");
    expect(pretty("Cm7b5")).toBe("Cm7♭5");
    expect(pretty("Bbb")).toBe("B𝄫");
    expect(pretty("F##")).toBe("F𝄪");
  });

  it("names pitch classes with sharps or flats", () => {
    expect(nameForChroma(10, true)).toBe("Bb");
    expect(nameForChroma(10, false)).toBe("A#");
    expect(nameForChroma(-1, false)).toBe("B");
  });
});

describe("fretboard", () => {
  const standard = getTuning("standard").strings;

  it("maps standard tuning correctly", () => {
    const board = buildFretboard(standard, 12);
    const at = (s: number, f: number) => board.find((p) => p.string === s && p.fret === f)!;
    expect(at(0, 0).chroma).toBe(4); // low E
    expect(at(0, 5).chroma).toBe(9); // A at 5th fret
    expect(at(0, 12).midi).toBe(at(0, 0).midi + 12);
    expect(at(3, 4).chroma).toBe(11); // B on the G string
    expect(at(5, 3).chroma).toBe(7); // G on the high E
    expect(board).toHaveLength(6 * 13);
  });

  it("every tuning parses", () => {
    for (const t of TUNINGS) expect(() => buildFretboard(t.strings, 24)).not.toThrow();
  });

  it("fret wires run from the nut (0) to the last fret (1)", () => {
    for (const realism of [0, 0.5, 1]) {
      const pos = fretWirePositions(22, realism);
      expect(pos[0]).toBe(0);
      expect(pos[22]).toBeCloseTo(1);
      for (let i = 1; i < pos.length; i++) expect(pos[i]).toBeGreaterThan(pos[i - 1]);
    }
  });

  it("real spacing narrows towards the body", () => {
    const pos = fretWirePositions(12, 1);
    expect(pos[1] - pos[0]).toBeGreaterThan(pos[12] - pos[11]);
  });
});

describe("scales and chords", () => {
  it("spells scales correctly", () => {
    expect(scaleTones("F", "major").map((t) => t.name)).toEqual(["F", "G", "A", "Bb", "C", "D", "E"]);
    expect(scaleTones("A", "minor pentatonic").map((t) => t.label)).toEqual(["R", "b3", "4", "5", "b7"]);
    expect(scaleTones("E", "minor blues").map((t) => t.label)).toEqual(["R", "b3", "4", "b5", "5", "b7"]);
  });

  it("marks only the root as root", () => {
    const tones = scaleTones("G", "mixolydian");
    expect(tones.filter((t) => t.isRoot).map((t) => t.name)).toEqual(["G"]);
  });

  it("builds chord tones", () => {
    expect(chordTones("Bb", "maj7").map((t) => t.name)).toEqual(["Bb", "D", "F", "A"]);
    expect(chordTones("B", "m7b5").map((t) => t.label)).toEqual(["R", "b3", "b5", "b7"]);
    expect(chordTones("C", "9").map((t) => t.degree)).toEqual([1, 3, 5, 7, 2]);
  });

  it("indexes tones by pitch class", () => {
    const map = byChroma(chordTones("C", "M"));
    expect([...map.keys()].sort((a, b) => a - b)).toEqual([0, 4, 7]);
    expect(map.get(4)!.label).toBe("3");
  });

  it("rejects nonsense", () => {
    expect(() => scaleTones("C", "nope")).toThrow();
    expect(() => chordTones("C", "nope")).toThrow();
  });
});

describe("diatonic chords", () => {
  it("harmonises the major scale", () => {
    const chords = diatonicChords("C", "major");
    expect(chords.map((c) => c.roman)).toEqual(["I", "ii", "iii", "IV", "V", "vi", "vii°"]);
    expect(chords.map((c) => c.symbol)).toEqual(["C", "Dm", "Em", "F", "G", "Am", "B°"]);
    expect(chords.map((c) => c.romanSeventh)).toEqual(["Imaj7", "ii7", "iii7", "IVmaj7", "V7", "vi7", "viiø7"]);
  });

  it("uses flats for natural minor numerals", () => {
    const chords = diatonicChords("A", "minor");
    expect(chords.map((c) => c.roman)).toEqual(["i", "ii°", "bIII", "iv", "v", "bVI", "bVII"]);
    expect(chords[2].symbol).toBe("C");
  });

  it("handles harmonic minor", () => {
    const chords = diatonicChords("A", "harmonic minor");
    expect(chords[4].symbol).toBe("E");
    expect(chords[4].symbolSeventh).toBe("E7");
    expect(chords[2].roman).toBe("bIII+");
    expect(chords[6].symbolSeventh).toBe("G#°7");
  });

  it("spells roots from the key", () => {
    expect(diatonicChords("F", "major")[3].symbol).toBe("Bb");
    expect(diatonicChords("E", "major")[6].symbolSeventh).toBe("D#m7b5");
  });

  it("returns nothing for non-heptatonic scales", () => {
    expect(diatonicChords("A", "minor pentatonic")).toEqual([]);
  });
});

describe("keys", () => {
  it("summarises major and minor keys", () => {
    expect(keySummary("Eb", "major")).toMatchObject({ signature: "bbb", relative: "C minor" });
    expect(keySummary("E", "minor")).toMatchObject({ signature: "#", relative: "G major", scale: "minor" });
    expect(keySummary("A", "harmonic minor").scale).toBe("harmonic minor");
  });

  it("describes signatures", () => {
    expect(describeSignature("")).toBe("No sharps or flats");
    expect(describeSignature("#")).toBe("1 sharp");
    expect(describeSignature("bbbb")).toBe("4 flats");
  });
});
