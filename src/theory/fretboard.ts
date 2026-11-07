import { chroma, midi } from "./notes";

export interface FretPosition {
  /** 0 = lowest-pitched string. */
  string: number;
  fret: number;
  chroma: number;
  midi: number;
}

/** Every playable position on the neck, from the open string up to `frets`. */
export function buildFretboard(strings: string[], frets: number): FretPosition[] {
  const out: FretPosition[] = [];
  strings.forEach((open, s) => {
    const base = midi(open);
    const baseChroma = chroma(open);
    for (let f = 0; f <= frets; f++) {
      out.push({ string: s, fret: f, chroma: (baseChroma + f) % 12, midi: base + f });
    }
  });
  return out;
}

export const SINGLE_INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
export const DOUBLE_INLAYS = [12, 24];

/**
 * X position (0..1) of each fret wire, index 0 being the nut.
 * `realism` blends equal spacing (0) with true 12-TET spacing (1); true spacing
 * makes high frets cramped on small screens, so the UI defaults to a blend.
 */
export function fretWirePositions(frets: number, realism: number): number[] {
  const real = (n: number) => 1 - Math.pow(2, -n / 12);
  const realMax = real(frets);
  const out: number[] = [];
  for (let n = 0; n <= frets; n++) {
    const equal = n / frets;
    const physical = real(n) / realMax;
    out.push(equal * (1 - realism) + physical * realism);
  }
  return out;
}
