import { chordSymbol } from "./catalog";
import { chroma } from "./notes";
import { type DiatonicChord, diatonicChords } from "./tones";

export type KeyQuality = "major" | "minor";

/**
 * A chord referred to by its place in a key, so progressions transpose when the key changes.
 * "key" = diatonic chord of the key; "borrowed" = chord from the parallel key (D minor when in D major).
 */
export interface ChordRef {
  src: "key" | "borrowed";
  degree: number;
}

export type Role = "home" | "away" | "tension" | "colour";

export const ROLE_INFO: Record<Role, { label: string; help: string }> = {
  home: { label: "Home", help: "Feels settled. Songs usually start and end on these." },
  away: { label: "Away", help: "Moves away from home and builds a little tension." },
  tension: { label: "Tension", help: "Pulls strongly back to home. Great right before the I chord." },
  colour: { label: "Colour", help: "Borrowed from the parallel key. Adds an unexpected, emotional twist." },
};

const MAJOR_ROLES: Role[] = ["home", "away", "home", "away", "tension", "home", "tension"];
const MINOR_ROLES: Role[] = ["home", "away", "home", "away", "tension", "away", "tension"];

/** Degrees borrowed from the parallel key that sound good (and are common in songs). */
const BORROWED: Record<KeyQuality, number[]> = {
  major: [4, 3, 6, 7], // iv, bIII, bVI, bVII from the parallel minor
  minor: [5, 4], // V, IV from the parallel major
};

export const keyScale = (q: KeyQuality) => (q === "major" ? "major" : "minor");
const parallelScale = (q: KeyQuality) => (q === "major" ? "minor" : "major");

export interface KeyChord {
  ref: ChordRef;
  root: string;
  /** tonal chord type (triad or seventh). */
  type: string;
  symbol: string;
  roman: string;
  role: Role;
}

function toKeyChord(c: DiatonicChord, ref: ChordRef, role: Role, sevenths: boolean): KeyChord {
  const type = sevenths ? c.seventh : c.triad;
  return {
    ref,
    root: c.root,
    type,
    symbol: chordSymbol(c.root, type),
    roman: sevenths ? c.romanSeventh : c.roman,
    role,
  };
}

export function keyChords(tonic: string, quality: KeyQuality, sevenths: boolean): KeyChord[] {
  const roles = quality === "major" ? MAJOR_ROLES : MINOR_ROLES;
  return diatonicChords(tonic, keyScale(quality)).map((c, i) =>
    toKeyChord(c, { src: "key", degree: i + 1 }, roles[i], sevenths),
  );
}

export function borrowedChords(tonic: string, quality: KeyQuality, sevenths: boolean): KeyChord[] {
  const parallel = diatonicChords(tonic, parallelScale(quality));
  return BORROWED[quality].map((d) => toKeyChord(parallel[d - 1], { src: "borrowed", degree: d }, "colour", sevenths));
}

export function resolveRef(ref: ChordRef, tonic: string, quality: KeyQuality, sevenths: boolean): KeyChord | null {
  if (ref.src === "key") return keyChords(tonic, quality, sevenths)[ref.degree - 1] ?? null;
  const parallel = diatonicChords(tonic, parallelScale(quality))[ref.degree - 1];
  return parallel ? toKeyChord(parallel, ref, "colour", sevenths) : null;
}

export const sameRef = (a: ChordRef | null | undefined, b: ChordRef | null | undefined) =>
  !!a && !!b && a.src === b.src && a.degree === b.degree;

// ---------------------------------------------------------------------------
// Progressions
// ---------------------------------------------------------------------------

export interface Preset {
  name: string;
  about: string;
  steps: ChordRef[];
}

const k = (degree: number): ChordRef => ({ src: "key", degree });
const b = (degree: number): ChordRef => ({ src: "borrowed", degree });

export const PRESETS: Record<KeyQuality, Preset[]> = {
  major: [
    { name: "Three-chord song", about: "Folk, country and early rock'n'roll", steps: [k(1), k(4), k(5), k(1)] },
    { name: "Pop anthem", about: "Probably the most-used progression in pop", steps: [k(1), k(5), k(6), k(4)] },
    { name: "Emotional pop", about: "Same chords as the pop anthem, starting on the sad one", steps: [k(6), k(4), k(1), k(5)] },
    { name: "50s ballad", about: "Doo-wop and classic slow dances", steps: [k(1), k(6), k(4), k(5)] },
    { name: "Jazz turnaround", about: "ii–V–I: try it with 7ths on", steps: [k(2), k(5), k(1), k(1)] },
    { name: "Rock swagger", about: "Borrows ♭VII from the minor key", steps: [k(1), b(7), k(4), k(1)] },
    { name: "Bittersweet", about: "Major IV turns minor for a sad twist", steps: [k(1), k(4), b(4), k(1)] },
    { name: "Epic lift", about: "♭VI and ♭VII climbing back home", steps: [k(1), b(6), b(7), k(1)] },
    {
      name: "12-bar blues",
      about: "The blues: one chord per bar. Turn on 7ths for the real sound",
      steps: [k(1), k(1), k(1), k(1), k(4), k(4), k(1), k(1), k(5), k(4), k(1), k(5)],
    },
  ],
  minor: [
    { name: "Minor rock", about: "Moody and driving", steps: [k(1), k(7), k(6), k(7)] },
    { name: "Cinematic", about: "Big, epic film-score feel", steps: [k(1), k(6), k(3), k(7)] },
    { name: "Minor three-chord", about: "Simple and dark", steps: [k(1), k(4), k(5), k(1)] },
    { name: "Classical minor", about: "Major V (borrowed) gives a strong pull home", steps: [k(1), k(4), b(5), k(1)] },
    { name: "Andalusian", about: "Flamenco and surf rock: walking down to V", steps: [k(1), k(7), k(6), b(5)] },
    { name: "Minor jazz", about: "ii°–V–i, best with 7ths", steps: [k(2), b(5), k(1), k(1)] },
  ],
};

// ---------------------------------------------------------------------------
// Which keys contain a chord
// ---------------------------------------------------------------------------

const MAJOR_TONICS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MINOR_TONICS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

export interface KeyMatch {
  tonic: string;
  quality: KeyQuality;
  roman: string;
  degree: number;
}

/** Major and minor keys where the chord is diatonic (as a triad or a seventh). */
export function keysContaining(root: string, type: string): KeyMatch[] {
  const target = chroma(root);
  const out: KeyMatch[] = [];
  for (const [quality, tonics] of [
    ["major", MAJOR_TONICS],
    ["minor", MINOR_TONICS],
  ] as const) {
    for (const tonic of tonics) {
      diatonicChords(tonic, keyScale(quality)).forEach((c, i) => {
        if (chroma(c.root) !== target) return;
        if (c.triad === type) out.push({ tonic, quality, roman: c.roman, degree: i + 1 });
        else if (c.seventh === type) out.push({ tonic, quality, roman: c.romanSeventh, degree: i + 1 });
      });
    }
  }
  return out;
}
