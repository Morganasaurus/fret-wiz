/** Scales and chords offered in the pickers. `id` is the tonal name. */

export interface CatalogItem {
  id: string;
  name: string;
  group: string;
}

export const SCALES: CatalogItem[] = [
  { id: "major", name: "Major (Ionian)", group: "Diatonic" },
  { id: "minor", name: "Natural minor (Aeolian)", group: "Diatonic" },
  { id: "major pentatonic", name: "Major pentatonic", group: "Pentatonic & blues" },
  { id: "minor pentatonic", name: "Minor pentatonic", group: "Pentatonic & blues" },
  { id: "minor blues", name: "Minor blues", group: "Pentatonic & blues" },
  { id: "major blues", name: "Major blues", group: "Pentatonic & blues" },
  { id: "dorian", name: "Dorian", group: "Modes" },
  { id: "phrygian", name: "Phrygian", group: "Modes" },
  { id: "lydian", name: "Lydian", group: "Modes" },
  { id: "mixolydian", name: "Mixolydian", group: "Modes" },
  { id: "locrian", name: "Locrian", group: "Modes" },
  { id: "harmonic minor", name: "Harmonic minor", group: "Minor variants" },
  { id: "melodic minor", name: "Melodic minor", group: "Minor variants" },
  { id: "phrygian dominant", name: "Phrygian dominant", group: "Minor variants" },
  { id: "whole tone", name: "Whole tone", group: "Symmetric" },
  { id: "diminished", name: "Diminished (whole-half)", group: "Symmetric" },
  { id: "chromatic", name: "Chromatic", group: "Symmetric" },
];

export const CHORDS: CatalogItem[] = [
  { id: "M", name: "Major", group: "Triads" },
  { id: "m", name: "Minor", group: "Triads" },
  { id: "dim", name: "Diminished", group: "Triads" },
  { id: "aug", name: "Augmented", group: "Triads" },
  { id: "sus2", name: "sus2", group: "Triads" },
  { id: "sus4", name: "sus4", group: "Triads" },
  { id: "5", name: "Power chord (5)", group: "Triads" },
  { id: "maj7", name: "Major 7", group: "Sevenths" },
  { id: "7", name: "Dominant 7", group: "Sevenths" },
  { id: "m7", name: "Minor 7", group: "Sevenths" },
  { id: "m7b5", name: "Half-diminished (m7♭5)", group: "Sevenths" },
  { id: "dim7", name: "Diminished 7", group: "Sevenths" },
  { id: "mMaj7", name: "Minor-major 7", group: "Sevenths" },
  { id: "7sus4", name: "7sus4", group: "Sevenths" },
  { id: "6", name: "Major 6", group: "Sixths & extended" },
  { id: "m6", name: "Minor 6", group: "Sixths & extended" },
  { id: "add9", name: "add9", group: "Sixths & extended" },
  { id: "9", name: "Dominant 9", group: "Sixths & extended" },
  { id: "maj9", name: "Major 9", group: "Sixths & extended" },
  { id: "m9", name: "Minor 9", group: "Sixths & extended" },
  { id: "7b9", name: "7♭9", group: "Sixths & extended" },
  { id: "13", name: "Dominant 13", group: "Sixths & extended" },
];

/** How a chord type is written after the root, e.g. "" for major, "m7b5" for half-diminished. */
export const CHORD_SUFFIX: Record<string, string> = {
  M: "",
  m: "m",
  dim: "°",
  aug: "+",
  maj7: "maj7",
  "7": "7",
  m7: "m7",
  m7b5: "m7b5",
  dim7: "°7",
  mMaj7: "m(maj7)",
  "maj7#5": "maj7#5",
  "7#5": "7#5",
};

export function chordSymbol(root: string, type: string): string {
  return root + (CHORD_SUFFIX[type] ?? type);
}

export function groupBy(items: CatalogItem[]): [string, CatalogItem[]][] {
  const map = new Map<string, CatalogItem[]>();
  for (const item of items) {
    if (!map.has(item.group)) map.set(item.group, []);
    map.get(item.group)!.push(item);
  }
  return [...map.entries()];
}
