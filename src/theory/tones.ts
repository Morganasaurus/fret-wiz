import { Chord, Key, Scale } from "tonal";
import { chordSymbol } from "./catalog";
import { chroma, intervalLabel, simpleDegree } from "./notes";

/** One pitch class that should light up on the neck, with how to label it. */
export interface Tone {
  chroma: number;
  /** Spelled note name, e.g. "Bb" (not "A#") in F major. */
  name: string;
  /** tonal interval from the root, e.g. "3m". */
  interval: string;
  /** Short display label, e.g. "b3". */
  label: string;
  /** 1-7; compound intervals fold down (9 -> 2). Drives the colour. */
  degree: number;
  isRoot: boolean;
}

function toTones(notes: string[], intervals: string[]): Tone[] {
  return notes.map((name, i) => {
    const interval = intervals[i];
    return {
      chroma: chroma(name),
      name,
      interval,
      label: intervalLabel(interval),
      degree: simpleDegree(interval),
      isRoot: i === 0,
    };
  });
}

export function scaleTones(root: string, scale: string): Tone[] {
  const s = Scale.get(`${root} ${scale}`);
  if (s.empty) throw new Error(`Unknown scale: ${root} ${scale}`);
  return toTones(s.notes, s.intervals);
}

export function chordTones(root: string, type: string): Tone[] {
  const c = Chord.getChord(type, root);
  if (c.empty) throw new Error(`Unknown chord: ${root} ${type}`);
  return toTones(c.notes, c.intervals);
}

export function noteTone(name: string): Tone {
  return { chroma: chroma(name), name, interval: "1P", label: "R", degree: 1, isRoot: true };
}

/** Index tones by pitch class. If two spellings share a chroma, the first wins. */
export function byChroma(tones: Tone[]): Map<number, Tone> {
  const map = new Map<number, Tone>();
  for (const t of tones) if (!map.has(t.chroma)) map.set(t.chroma, t);
  return map;
}

// ---------------------------------------------------------------------------
// Diatonic harmony
// ---------------------------------------------------------------------------

export interface DiatonicChord {
  degree: number;
  root: string;
  triad: string;
  seventh: string;
  roman: string;
  romanSeventh: string;
  symbol: string;
  symbolSeventh: string;
}

const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];

const TRIADS: Record<string, string> = { "4,7": "M", "3,7": "m", "3,6": "dim", "4,8": "aug" };
const SEVENTHS: Record<string, string> = {
  "M,11": "maj7",
  "M,10": "7",
  "m,10": "m7",
  "m,11": "mMaj7",
  "dim,10": "m7b5",
  "dim,9": "dim7",
  "aug,11": "maj7#5",
  "aug,10": "7#5",
};
const ROMAN_SEVENTH_SUFFIX: Record<string, string> = {
  maj7: "maj7",
  "7": "7",
  m7: "7",
  mMaj7: "(maj7)",
  m7b5: "ø7",
  dim7: "°7",
  "maj7#5": "+maj7",
  "7#5": "+7",
};

const up = (a: number, b: number) => (b - a + 12) % 12;

/**
 * Chords built by stacking thirds on each degree of a 7-note scale.
 * Returns [] for scales that are not heptatonic (pentatonics, blues, etc).
 */
export function diatonicChords(root: string, scale: string): DiatonicChord[] {
  const s = Scale.get(`${root} ${scale}`);
  if (s.empty || s.notes.length !== 7) return [];
  const notes = s.notes;
  const c = notes.map(chroma);
  const tonic = c[0];

  return notes.map((name, i) => {
    const third = up(c[i], c[(i + 2) % 7]);
    const fifth = up(c[i], c[(i + 4) % 7]);
    const seventhIvl = up(c[i], c[(i + 6) % 7]);
    const triad = TRIADS[`${third},${fifth}`] ?? "M";
    const seventh = SEVENTHS[`${triad},${seventhIvl}`] ?? "7";

    let shift = up(tonic, c[i]) - MAJOR_STEPS[i];
    if (shift > 6) shift -= 12;
    if (shift < -6) shift += 12;
    const accidental = shift < 0 ? "b".repeat(-shift) : "#".repeat(shift);

    const minorish = triad === "m" || triad === "dim";
    const base = minorish ? NUMERALS[i].toLowerCase() : NUMERALS[i];
    const triadMark = triad === "dim" ? "°" : triad === "aug" ? "+" : "";
    return {
      degree: i + 1,
      root: name,
      triad,
      seventh,
      roman: accidental + base + triadMark,
      romanSeventh: accidental + base + ROMAN_SEVENTH_SUFFIX[seventh],
      symbol: chordSymbol(name, triad),
      symbolSeventh: chordSymbol(name, seventh),
    };
  });
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

export type KeyMode = "major" | "minor" | "harmonic minor";

export interface KeySummary {
  tonic: string;
  mode: KeyMode;
  /** e.g. "bb" for two flats, "###" for three sharps, "" for none. */
  signature: string;
  relative: string;
  scale: string;
}

export function keySummary(tonic: string, mode: KeyMode): KeySummary {
  if (mode === "major") {
    const k = Key.majorKey(tonic);
    return { tonic, mode, signature: k.keySignature, relative: `${k.minorRelative} minor`, scale: "major" };
  }
  const k = Key.minorKey(tonic);
  return {
    tonic,
    mode,
    signature: k.keySignature,
    relative: `${k.relativeMajor} major`,
    scale: mode === "minor" ? "minor" : "harmonic minor",
  };
}

export function describeSignature(sig: string): string {
  if (!sig) return "No sharps or flats";
  const n = sig.length;
  const kind = sig[0] === "#" ? "sharp" : "flat";
  return `${n} ${kind}${n === 1 ? "" : "s"}`;
}
