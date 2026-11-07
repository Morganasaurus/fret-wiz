import { Interval, Note } from "tonal";

export const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

/** Pitch class 0-11 (C = 0) for a note name like "Bb" or "E2". */
export function chroma(note: string): number {
  const c = Note.chroma(note);
  if (c === undefined || Number.isNaN(c)) throw new Error(`Unknown note: ${note}`);
  return c;
}

export function midi(note: string): number {
  const m = Note.midi(note);
  if (m === null || m === undefined) throw new Error(`Note needs an octave: ${note}`);
  return m;
}

export function nameForChroma(c: number, preferFlats: boolean): string {
  const i = ((c % 12) + 12) % 12;
  return preferFlats ? FLAT_NAMES[i] : SHARP_NAMES[i];
}

/**
 * Turn ASCII accidentals into music symbols for display.
 * Safe for note names ("Bb"), interval labels ("b5") and chord symbols ("Cm7b5"),
 * none of which use a lowercase "b" for anything else.
 */
export function pretty(text: string): string {
  return text.replace(/##/g, "𝄪").replace(/#/g, "♯").replace(/bb/g, "𝄫").replace(/b/g, "♭");
}

/**
 * Short interval label used on the fretboard: R, b2, 2, b3, 3, 4, #4, b5, 5, #5, 6, bb7, b7, 7, 9, #11...
 * Accepts tonal interval names like "3m", "5d", "9M".
 */
export function intervalLabel(ivl: string): string {
  const i = Interval.get(ivl);
  if (i.empty) return ivl;
  if (i.num === 1 || i.num === 8) {
    if (i.q === "P") return "R";
  }
  const perfectClass = [1, 4, 5].includes(((i.num - 1) % 7) + 1);
  switch (i.q) {
    case "P":
    case "M":
      return String(i.num);
    case "m":
      return `b${i.num}`;
    case "A":
      return `#${i.num}`;
    case "AA":
      return `##${i.num}`;
    case "d":
      return perfectClass ? `b${i.num}` : `bb${i.num}`;
    default:
      return ivl;
  }
}

/** Scale degree 1-7 (compound intervals fold down, so 9 -> 2, 11 -> 4, 13 -> 6). */
export function simpleDegree(ivl: string): number {
  const i = Interval.get(ivl);
  if (i.empty) return 1;
  return ((i.num - 1) % 7) + 1;
}
