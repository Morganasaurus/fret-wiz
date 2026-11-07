import { chroma, midi } from "./notes";
import { scaleTones } from "./tones";

export interface ScaleNote {
  string: number;
  fret: number;
  midi: number;
}

export interface ScalePosition {
  /** 1-based position number. */
  number: number;
  notes: ScaleNote[];
  minFret: number;
  maxFret: number;
  /** Notes per string in the underlying pattern (2 for pentatonic boxes, 3 for 7-note scales). */
  perString: number;
  /** The same shape an octave (or two) away, where it fits completely on the neck. */
  copies: ScaleCopy[];
}

export interface ScaleCopy {
  notes: ScaleNote[];
  minFret: number;
  maxFret: number;
}

/**
 * Notes that are "passing" notes added to a pentatonic: the blues scales are
 * played as pentatonic boxes with the extra note wherever it falls inside the box.
 */
const PASSING: Record<string, string> = {
  "minor blues": "5d",
  "major blues": "3m",
};

/**
 * The practice shapes for a scale, one per scale note, starting from the root on the lowest string.
 *
 * - 5-note scales (pentatonics) give the five classic two-notes-per-string boxes.
 * - Blues scales are the pentatonic boxes plus the blue note where it fits.
 * - 7-note scales (major, minor, modes, harmonic/melodic minor) use three notes per string, giving seven shapes.
 * - Other scales (whole tone, diminished, chromatic) return [] and are practised across the neck.
 *
 * Works in any tuning: each shape walks up the scale string by string.
 */
export function scalePositions(strings: string[], root: string, scale: string, frets: number): ScalePosition[] {
  const tones = scaleTones(root, scale);
  const passing = PASSING[scale];
  const parent = passing ? tones.filter((t) => t.interval !== passing) : tones;
  const perString = parent.length === 5 ? 2 : parent.length === 7 ? 3 : 0;
  if (!perString || strings.length < 2) return [];

  const rootChroma = chroma(root);
  const inParent = new Set(parent.map((t) => t.chroma));
  const passingChroma = passing ? tones.find((t) => t.interval === passing)?.chroma : undefined;
  const open = strings.map(midi);
  const offsets = parent.map((t) => (t.chroma - rootChroma + 12) % 12).sort((a, b) => a - b);
  const rootFret = (rootChroma - chroma(strings[0]) + 12) % 12;

  const nextScalePitch = (from: number) => {
    let p = from;
    while (!inParent.has(((p % 12) + 12) % 12)) p++;
    return p;
  };

  return offsets.map((offset, k) => {
    // Shapes climb the neck in order; ones that would run off the end drop an octave below.
    let pitch = open[0] + rootFret + offset;
    let notes: ScaleNote[] = [];
    open.forEach((openMidi, s) => {
      for (let i = 0; i < perString; i++) {
        pitch = nextScalePitch(pitch);
        notes.push({ string: s, fret: pitch - openMidi, midi: pitch });
        pitch++;
      }
    });

    // Keep the shape on the neck: shift up an octave if it dips below the nut,
    // down an octave if it runs off the end and there's room.
    const lo = () => Math.min(...notes.map((n) => n.fret));
    const hi = () => Math.max(...notes.map((n) => n.fret));
    const shift = (d: number) => (notes = notes.map((n) => ({ ...n, fret: n.fret + d, midi: n.midi + d })));
    if (lo() < 0) shift(12);
    if (hi() > frets && lo() - 12 >= 0) shift(-12);

    // Blues: add the passing note on any string where it sits inside the box.
    if (passingChroma !== undefined) {
      const min = lo();
      const max = hi();
      open.forEach((openMidi, s) => {
        for (let f = min; f <= max; f++) {
          if ((openMidi + f) % 12 === passingChroma) notes.push({ string: s, fret: f, midi: openMidi + f });
        }
      });
    }

    notes = notes.filter((n) => n.fret >= 0 && n.fret <= frets);
    const minFret = lo();
    const maxFret = hi();

    // The same shape repeats every 12 frets: keep every complete copy that fits on the neck.
    const copies: ScaleCopy[] = [];
    for (const d of [-24, -12, 12, 24]) {
      if (minFret + d >= 0 && maxFret + d <= frets) {
        copies.push({
          notes: notes.map((n) => ({ ...n, fret: n.fret + d, midi: n.midi + d })),
          minFret: minFret + d,
          maxFret: maxFret + d,
        });
      }
    }
    copies.sort((a, b) => a.minFret - b.minFret);

    return { number: k + 1, notes, minFret, maxFret, perString, copies };
  });
}

/** Every place the shape appears: the main one first, then its octave copies. */
export function allCopies(p: ScalePosition): ScaleCopy[] {
  return [{ notes: p.notes, minFret: p.minFret, maxFret: p.maxFret }, ...p.copies];
}

export const positionKey = (string: number, fret: number) => `${string}:${fret}`;
