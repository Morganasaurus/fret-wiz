import { chroma, midi } from "./notes";
import { type Tone, chordTones } from "./tones";

/**
 * A playable chord shape.
 * `frets` has one entry per string, lowest string first: -1 = don't play, 0 = open.
 */
export interface Voicing {
  frets: number[];
  /** Finger per string (0 = none / open / muted). 1 = index ... 4 = pinky. */
  fingers: number[];
  barre: { fret: number; from: number; to: number } | null;
  /** Lowest fretted note (0 if the shape only uses open strings). */
  minFret: number;
  maxFret: number;
  /** Lower is easier. */
  difficulty: number;
}

interface Options {
  /** Highest fret to search. */
  maxFret?: number;
  /** Max distance between lowest and highest fretted note. */
  span?: number;
}

const OPEN_FRIENDLY_MAX = 4;

/**
 * Find playable shapes for a chord on any tuning.
 *
 * Rules: the lowest sounding note is the root; every chord tone is present
 * (the 5th, and the 9th of a 13 chord, may be left out); no more than four
 * fingers, using a first-finger barre when needed; at most one muted string
 * between sounding strings. Results are ranked easiest first, keeping the best
 * shape per position and bass string so you can browse up the neck.
 */
const cache = new Map<string, Voicing[]>();

export function findVoicings(strings: string[], tones: Tone[], opts: Options = {}): Voicing[] {
  const key = `${strings.join(" ")}|${tones.map((t) => `${t.chroma}${t.interval}${t.isRoot ? "*" : ""}`).join(",")}|${opts.maxFret}|${opts.span}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const result = searchVoicings(strings, tones, opts);
  if (cache.size > 500) cache.clear();
  cache.set(key, result);
  return result;
}

function searchVoicings(strings: string[], tones: Tone[], opts: Options): Voicing[] {
  const maxFret = opts.maxFret ?? 15;
  const span = opts.span ?? 3;
  const n = strings.length;
  if (!tones.length || n < 3) return [];

  const open = strings.map(chroma);
  const toneSet = new Set(tones.map((t) => t.chroma));
  const rootChroma = tones.find((t) => t.isRoot)!.chroma;
  const optional = new Set<number>();
  for (const t of tones) {
    if (tones.length >= 4 && t.interval === "5P") optional.add(t.chroma);
    if (tones.length >= 6 && t.interval === "9M") optional.add(t.chroma);
  }
  const required = [...toneSet].filter((c) => !optional.has(c));
  const minStrings = tones.length <= 2 ? 2 : Math.min(4, n);

  const seen = new Set<string>();
  const found: Voicing[] = [];

  for (let start = 1; start + span <= Math.max(maxFret, span + 1); start++) {
    // Options per string: muted, open (if a chord tone), or a chord tone inside the window.
    const choices: number[][] = open.map((oc) => {
      const opts = [-1];
      if (toneSet.has(oc)) opts.push(0);
      for (let f = start; f <= start + span && f <= maxFret; f++) {
        if (toneSet.has((oc + f) % 12)) opts.push(f);
      }
      return opts;
    });

    const current: number[] = new Array(n).fill(-1);
    const walk = (s: number) => {
      if (s === n) {
        const key = current.join(",");
        if (seen.has(key)) return;
        seen.add(key);
        const v = evaluate(current, open, rootChroma, required, optional, minStrings, span);
        if (v) found.push(v);
        return;
      }
      for (const f of choices[s]) {
        current[s] = f;
        walk(s + 1);
      }
    };
    walk(0);
  }

  // Keep the easiest shape per (position, bass string): one entry per place on the neck.
  // Shapes using open strings form their own group so they don't hide closed (movable) shapes.
  found.sort((a, b) => a.difficulty - b.difficulty);
  const best = new Map<string, Voicing>();
  for (const v of found) {
    const bass = v.frets.findIndex((f) => f >= 0);
    const usesOpen = v.frets.some((f) => f === 0);
    const bucket = `${usesOpen ? "open" : v.minFret}:${bass}`;
    if (!best.has(bucket)) best.set(bucket, v);
  }
  return [...best.values()].sort((a, b) => a.difficulty - b.difficulty);
}

function evaluate(
  frets: number[],
  open: number[],
  root: number,
  required: number[],
  optional: Set<number>,
  minStrings: number,
  span: number,
): Voicing | null {
  const sounding = frets.map((f, i) => (f >= 0 ? i : -1)).filter((i) => i >= 0);
  if (sounding.length < minStrings) return null;

  // Bass note must be the root.
  const lowest = sounding[0];
  if ((open[lowest] + frets[lowest]) % 12 !== root) return null;

  const present = new Set(sounding.map((i) => (open[i] + frets[i]) % 12));
  if (!required.every((c) => present.has(c))) return null;

  // Muted strings in the middle of the shape are awkward: allow one at most.
  const top = sounding[sounding.length - 1];
  let innerMutes = 0;
  for (let i = lowest; i <= top; i++) if (frets[i] < 0) innerMutes++;
  if (innerMutes > 1) return null;

  const fretted = sounding.filter((i) => frets[i] > 0);
  const fretNums = fretted.map((i) => frets[i]);
  const minFret = fretNums.length ? Math.min(...fretNums) : 0;
  const maxFret = fretNums.length ? Math.max(...fretNums) : 0;
  if (maxFret - minFret > span) return null;

  // Fingering: plain if four or fewer fretted notes, otherwise a first-finger barre.
  const fingers = new Array(frets.length).fill(0);
  let barre: Voicing["barre"] = null;
  let toFinger = fretted;

  if (fretted.length > 4) {
    const atMin = fretted.filter((i) => frets[i] === minFret);
    const from = atMin[0];
    // Every string from the barre's start to the top must be held down (no open strings under the barre).
    for (let i = from; i <= top; i++) {
      if (frets[i] === 0) return null;
    }
    // Strings below the barre's start are higher-fret notes held by the other fingers.
    const rest = fretted.filter((i) => i < from || frets[i] > minFret);
    if (rest.length > 3) return null;
    barre = { fret: minFret, from, to: top };
    for (let i = from; i <= top; i++) if (frets[i] === minFret) fingers[i] = 1;
    toFinger = rest;
  }

  // One finger per fret where possible (fret above the lowest = finger number),
  // falling back to the next free finger. Fails if it needs a fifth finger.
  const order = [...toFinger].sort((a, b) => frets[a] - frets[b] || a - b);
  const assign = (perFret: boolean) => {
    let last = barre ? 1 : 0;
    for (const i of order) {
      const ideal = perFret ? 1 + frets[i] - minFret : 0;
      last = Math.max(last + 1, ideal);
      fingers[i] = last;
    }
    return last;
  };
  let next = assign(true) + 1;
  if (next - 1 > 4) next = assign(false) + 1;
  if (next - 1 > 4) return null;
  next = order.length + (barre ? 1 : 0) + 1;

  // Difficulty score.
  const openCount = sounding.filter((i) => frets[i] === 0).length;
  const mutedEdges = frets.length - sounding.length - innerMutes;
  const missingOptional = [...optional].filter((c) => !present.has(c)).length;
  const fingersUsed = next - 1;
  // A fretted bass note with an open string right above it is an unusual grip.
  const awkwardBass = frets[lowest] > 0 && frets[lowest + 1] === 0;
  let d = 0;
  d += (maxFret - minFret) * 1.0;
  d += fingersUsed * 0.6;
  d += barre ? 1 : 0;
  d += innerMutes * 5;
  d += mutedEdges * 0.4;
  d += missingOptional * 0.8;
  d -= sounding.length * 0.7;
  d += minFret * 0.4;
  d += awkwardBass ? 3 : 0;
  if (openCount && maxFret > OPEN_FRIENDLY_MAX) d += 3.5;
  if (openCount && maxFret <= 3) d -= 1;

  return { frets: [...frets], fingers, barre, minFret, maxFret, difficulty: d };
}

// ---------------------------------------------------------------------------
// CAGED: the open C, A, G, E and D shapes, moved up the neck
// ---------------------------------------------------------------------------

export type CagedShape = "C" | "A" | "G" | "E" | "D";
const CAGED: CagedShape[] = ["C", "A", "G", "E", "D"];

/**
 * The open chords guitarists actually learn (standard tuning), by chord type and root.
 * They seed the CAGED shapes and are the preferred default when the chord has one.
 */
export const OPEN_CHORDS: Record<string, Record<string, string>> = {
  M: { C: "x32010", A: "x02220", G: "320003", E: "022100", D: "xx0232" },
  m: { A: "x02210", E: "022000", D: "xx0231" },
  "7": { C: "x32310", A: "x02020", G: "320001", E: "020100", D: "xx0212", B: "x21202" },
  maj7: { C: "x32000", A: "x02120", G: "320002", E: "021100", D: "xx0222", F: "xx3210" },
  m7: { A: "x02010", E: "020000", D: "xx0211", B: "x20202" },
  sus2: { A: "x02200", D: "xx0230" },
  sus4: { A: "x02230", E: "022200", D: "xx0233" },
  "7sus4": { A: "x02030", E: "020200", D: "xx0213" },
  "5": { A: "x022xx", E: "022xxx", D: "xx023x" },
  "6": { C: "x32210", A: "x02222", G: "320000", E: "022120", D: "xx0202" },
  m6: { A: "x02212", E: "022020", D: "xx0201" },
  add9: { C: "x32030", E: "024100" },
  "9": { E: "020102" },
  mMaj7: { A: "x02110", E: "021000" },
};

export function parseShape(text: string): number[] {
  return [...text].map((ch) => (ch === "x" ? -1 : Number(ch)));
}

function openChordFor(type: string, rootChroma: number): number[] | null {
  const byRoot = OPEN_CHORDS[type];
  if (!byRoot) return null;
  for (const [name, text] of Object.entries(byRoot)) if (chroma(name) === rootChroma) return parseShape(text);
  return null;
}

export interface ChordShape extends Voicing {
  /** Which open-chord shape this is built from (standard tuning only). */
  caged: CagedShape | null;
}

export interface ShapeSet {
  shapes: ChordShape[];
  /** Index of the easiest shape, used as the default. */
  easiest: number;
}

/** Score an exact set of frets for a chord (null if it isn't playable under the usual rules). */
function scoreFrets(strings: string[], tones: Tone[], frets: number[]): Voicing | null {
  const toneSet = new Set(tones.map((t) => t.chroma));
  const optional = new Set<number>();
  for (const t of tones) {
    if (tones.length >= 4 && t.interval === "5P") optional.add(t.chroma);
    if (tones.length >= 6 && t.interval === "9M") optional.add(t.chroma);
  }
  const required = [...toneSet].filter((c) => !optional.has(c));
  const minStrings = tones.length <= 2 ? 2 : Math.min(4, strings.length);
  const root = tones.find((t) => t.isRoot)!.chroma;
  return evaluate(frets, strings.map(chroma), root, required, optional, minStrings, 4);
}

/**
 * Shapes to show for a chord. In standard tuning the CAGED shapes come first
 * (in order up the neck), followed by other playable shapes. Other tunings use
 * the general search only.
 */
export function chordShapes(strings: string[], standardTuning: boolean, root: string, type: string, maxFret = 15): ShapeSet {
  const tones = chordTones(root, type);
  const rootChroma = chroma(root);
  const key = (f: number[]) => f.join(",");
  const caged: ChordShape[] = [];

  if (standardTuning) {
    for (const shapeRoot of CAGED) {
      const open = openChordFor(type, chroma(shapeRoot));
      if (!open) continue;
      const shift = (rootChroma - chroma(shapeRoot) + 12) % 12;
      const frets = open.map((f) => (f < 0 ? -1 : f + shift));
      if (Math.max(...frets) > maxFret + 2) continue;
      const v = scoreFrets(strings, tones, frets);
      if (v) caged.push({ ...v, caged: shapeRoot });
    }
    caged.sort((a, b) => a.minFret - b.minFret);
  }

  // A standard open chord for this exact root that isn't a CAGED shape (e.g. B7 = x21202).
  const known = standardTuning ? openChordFor(type, rootChroma) : null;
  const seen = new Set(caged.map((v) => key(v.frets)));
  let extras: Voicing[] = findVoicings(strings, tones, { maxFret })
    .filter((v) => !seen.has(key(v.frets)))
    .slice(0, caged.length ? 6 : 10);
  if (known && !seen.has(key(known)) && !extras.some((v) => key(v.frets) === key(known))) {
    const v = scoreFrets(strings, tones, known);
    if (v) extras = [v, ...extras];
  }
  const extra: ChordShape[] = extras.sort((a, b) => a.minFret - b.minFret).map((v) => ({ ...v, caged: null }));

  const shapes = [...caged, ...extra];
  const all = shapes.map((_, i) => i);

  // 1. The standard open chord, if this chord has one.
  let easiest = known ? shapes.findIndex((v) => key(v.frets) === key(known)) : -1;

  // 2. Otherwise the easiest CAGED shape; G- and C-shape barres are hard, so they rarely win.
  if (easiest < 0 && caged.length) {
    const cost = (v: ChordShape) =>
      v.difficulty + ((v.caged === "G" || v.caged === "C") && !v.frets.some((f) => f === 0) ? 1.5 : 0);
    easiest = all.slice(0, caged.length).reduce((b, i) => (cost(shapes[i]) < cost(shapes[b]) ? i : b), 0);
  }

  // 3. Otherwise whatever the search rates easiest.
  if (easiest < 0) easiest = all.reduce((b, i) => (shapes[i].difficulty < shapes[b].difficulty ? i : b), 0);

  return { shapes, easiest };
}

/** Pitches (MIDI numbers) a voicing sounds, low to high. */
export function voicingMidi(strings: string[], v: Voicing): number[] {
  return v.frets.flatMap((f, i) => (f >= 0 ? [midi(strings[i]) + f] : []));
}

/** Compact text form, e.g. "x32010". Frets above 9 are wrapped in brackets. */
export function voicingText(v: Voicing): string {
  return v.frets.map((f) => (f < 0 ? "x" : f > 9 ? `(${f})` : String(f))).join("");
}

/** Human description of where a shape sits, e.g. "Open position" or "5th fret". */
export function positionLabel(v: Voicing): string {
  const usesOpen = v.frets.some((f) => f === 0);
  if (usesOpen && v.maxFret <= 4) return "Open position";
  const n = v.minFret;
  return `${ordinal(n)} fret${v.barre ? " barre" : ""}${usesOpen ? " + open strings" : ""}`;
}

export function ordinal(n: number): string {
  const suffix = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `${n}${suffix}`;
}
