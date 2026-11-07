import { CHORDS, SCALES, chordSymbol } from "./theory/catalog";
import { type KeyChord, type Role, keyScale, resolveRef } from "./theory/harmony";
import { SHARP_NAMES, nameForChroma, pretty } from "./theory/notes";
import { type KeySummary, type Tone, byChroma, chordTones, diatonicChords, keySummary, noteTone, scaleTones } from "./theory/tones";
import type { Settings } from "./state";

/** Colour per scale degree (1-7). Root, 3rd, 5th and 7th get the most distinct hues. */
export const DEGREE_COLORS: Record<number, string> = {
  1: "#f59e0b",
  2: "#c084fc",
  3: "#38bdf8",
  4: "#4ade80",
  5: "#f87171",
  6: "#94a3b8",
  7: "#f472b6",
};

/** What each interval tends to sound like, in plain English. */
export const INTERVAL_FEEL: Record<string, string> = {
  R: "The root. Home base: the note the chord or scale is named after.",
  b2: "Minor 2nd. Dark and tense, a Spanish or metal flavour.",
  "2": "Major 2nd. Open and airy.",
  b3: "Minor 3rd. Makes things sound sad or moody.",
  "3": "Major 3rd. Makes things sound happy and bright.",
  "4": "Perfect 4th. Suspended, wants to fall to the 3rd.",
  "#4": "Augmented 4th. Dreamy and floating (Lydian sound).",
  b5: "Flat 5th. The 'blue note': gritty and unstable.",
  "5": "Perfect 5th. Strong and neutral. Power chords are just root + 5th.",
  "#5": "Augmented 5th. Tense, rising, unresolved.",
  b6: "Minor 6th. Dark and dramatic.",
  "6": "Major 6th. Sweet and nostalgic.",
  bb7: "Diminished 7th. Spooky, very tense.",
  b7: "Minor 7th. Bluesy, and pulls towards the next chord.",
  "7": "Major 7th. Dreamy, jazzy, a little wistful.",
  b9: "Flat 9th. Very tense and exotic.",
  "9": "9th (a 2nd up an octave). Lush and open.",
  "11": "11th (a 4th up an octave). Spacious and suspended.",
  "13": "13th (a 6th up an octave). Rich and jazzy.",
};

const NATURAL_FILL = "#e5e7eb";
const ACCIDENTAL_FILL = "#4b5563";
const SECONDARY_FILL = "#3b4150";

export interface Dot {
  label: string;
  fill: string;
  ink: string;
  primary: boolean;
  root: boolean;
}

export interface ActiveChord {
  root: string;
  type: string;
  symbol: string;
  roman?: string;
  role?: Role;
  tones: Tone[];
}

export interface View {
  title: string;
  subtitle: string;
  /** One or two sentences on how to read the neck right now. */
  hint: string;
  legend: Tone[];
  dots: Map<number, Dot>;
  /** Chord whose shapes are shown (chord mode, or a chord picked from a key/scale). */
  chord: ActiveChord | null;
  key: KeySummary | null;
}

function labelFor(t: Tone, style: Settings["labels"]): string {
  if (style === "none") return "";
  return pretty(style === "name" ? t.name : t.label);
}

function dotsFrom(tones: Tone[], style: Settings["labels"]): Map<number, Dot> {
  const map = new Map<number, Dot>();
  for (const [c, t] of byChroma(tones)) {
    map.set(c, { label: labelFor(t, style), fill: DEGREE_COLORS[t.degree], ink: "#111318", primary: true, root: t.isRoot });
  }
  return map;
}

/** Chord tones bright, remaining scale tones muted. */
function chordOverScale(chord: Tone[], scale: Tone[], style: Settings["labels"]): Map<number, Dot> {
  const dots = dotsFrom(chord, style);
  for (const t of scale) {
    if (dots.has(t.chroma)) continue;
    dots.set(t.chroma, {
      label: style === "none" ? "" : pretty(t.name),
      fill: SECONDARY_FILL,
      ink: "#c7ccd6",
      primary: false,
      root: false,
    });
  }
  return dots;
}

const scaleName = (id: string) => SCALES.find((s) => s.id === id)?.name ?? id;
const chordName = (id: string) => CHORDS.find((c) => c.id === id)?.name ?? id;
const names = (tones: Tone[]) => tones.map((t) => pretty(t.name)).join("  ");

function activeFromKeyChord(c: KeyChord): ActiveChord {
  return { root: c.root, type: c.type, symbol: c.symbol, roman: c.roman, role: c.role, tones: chordTones(c.root, c.type) };
}

export function buildView(s: Settings): View {
  const none = { chord: null, key: null };

  if (s.mode === "notes") {
    if (s.notesFilter === "one") {
      const t = noteTone(s.root);
      return {
        ...none,
        title: `Every ${pretty(s.root)} on the neck`,
        subtitle: "Tap any fret to pick a different note",
        hint: "Look for the octave shapes: the same note two frets up and two strings over (three frets when you cross the B string).",
        legend: [t],
        dots: new Map([[t.chroma, { label: s.labels === "none" ? "" : pretty(s.root), fill: DEGREE_COLORS[1], ink: "#111318", primary: true, root: true }]]),
      };
    }
    const dots = new Map<number, Dot>();
    for (let c = 0; c < 12; c++) {
      const natural = !SHARP_NAMES[c].includes("#");
      if (s.notesFilter === "naturals" && !natural) continue;
      dots.set(c, {
        label: s.labels === "none" ? "" : pretty(nameForChroma(c, s.preferFlats)),
        fill: natural ? NATURAL_FILL : ACCIDENTAL_FILL,
        ink: natural ? "#111318" : "#f3f4f6",
        primary: true,
        root: false,
      });
    }
    return {
      ...none,
      title: s.notesFilter === "naturals" ? "Natural notes" : "All notes",
      subtitle: s.notesFilter === "naturals" ? "A B C D E F G" : "Every note on every fret",
      hint:
        s.notesFilter === "naturals"
          ? "Learn these first. Sharps and flats sit in the gaps, except E–F and B–C, which have no gap between them."
          : "Each circle is a note. At the 12th fret (double dots) every string is back to its open note, and the pattern repeats.",
      legend: [],
      dots,
    };
  }

  if (s.mode === "chord") {
    const tones = chordTones(s.root, s.chord);
    const symbol = chordSymbol(s.root, s.chord);
    return {
      title: `${pretty(symbol)}  ·  ${pretty(s.root)} ${chordName(s.chord).toLowerCase()}`,
      subtitle: names(tones),
      hint: "Bright dots are the shape to play, shown as a chord chart below. Faded dots are the same notes elsewhere. Pick a numbered shape below to play the same chord further up the neck.",
      legend: tones,
      dots: dotsFrom(tones, s.labels),
      chord: { root: s.root, type: s.chord, symbol, tones },
      key: null,
    };
  }

  if (s.mode === "key") {
    const key = keySummary(s.root, s.keyMode);
    const scale = scaleTones(s.root, keyScale(s.keyMode));
    const keyName = `${pretty(s.root)} ${s.keyMode}`;
    const picked = s.selected ? resolveRef(s.selected, s.root, s.keyMode, s.sevenths) : null;
    if (picked) {
      const chord = activeFromKeyChord(picked);
      return {
        title: `${pretty(picked.symbol)}  ·  ${pretty(picked.roman)} in ${keyName}`,
        subtitle: names(chord.tones),
        hint: `Bright dots: how to play ${pretty(picked.symbol)}. Faded dots: the rest of the ${keyName} scale, which you can use for melodies over this chord.`,
        legend: chord.tones,
        dots: chordOverScale(chord.tones, scale, s.labels),
        chord,
        key,
      };
    }
    return {
      title: `Key of ${keyName}`,
      subtitle: names(scale),
      hint: `These are the notes of ${keyName}. Every chord below is built only from these notes, so they all sound good together. Pick one to see how to play it.`,
      legend: scale,
      dots: dotsFrom(scale, s.labels),
      chord: null,
      key,
    };
  }

  // Scale mode
  const scale = scaleTones(s.root, s.scale);
  const title = `${pretty(s.root)} ${scaleName(s.scale).toLowerCase()}`;
  const diatonic = s.selected?.src === "key" ? diatonicChords(s.root, s.scale)[s.selected.degree - 1] : undefined;
  if (diatonic) {
    const type = s.sevenths ? diatonic.seventh : diatonic.triad;
    const symbol = chordSymbol(diatonic.root, type);
    const tones = chordTones(diatonic.root, type);
    return {
      title,
      subtitle: `${pretty(symbol)} (${pretty(s.sevenths ? diatonic.romanSeventh : diatonic.roman)}): ${names(tones)}`,
      hint: `Bright dots: the notes of ${pretty(symbol)}, which is built from this scale. Faded dots: the other scale notes.`,
      legend: tones,
      dots: chordOverScale(tones, scale, s.labels),
      chord: { root: diatonic.root, type, symbol, roman: s.sevenths ? diatonic.romanSeventh : diatonic.roman, tones },
      key: null,
    };
  }
  return {
    title,
    subtitle: names(scale),
    hint: `Every note you can play from ${title}. Ringed notes are the root (${pretty(s.root)}): phrases sound finished when they land there. Set a fret range under Neck to practise one area at a time.`,
    legend: scale,
    dots: dotsFrom(scale, s.labels),
    chord: null,
    key: null,
  };
}

/** Whether the current selection sounds minor (used to pick C# vs Db etc). */
export function isMinorContext(s: Settings): boolean {
  try {
    if (s.mode === "chord") return chordTones("C", s.chord).some((t) => t.label === "b3");
    if (s.mode === "key") return s.keyMode === "minor";
    if (s.mode === "scale") return scaleTones("C", s.scale).some((t) => t.label === "b3");
  } catch {
    /* fall through */
  }
  return false;
}
