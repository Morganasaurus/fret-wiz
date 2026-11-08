import { useEffect, useState } from "react";
import { type SavedProgression, migrateProgressions } from "./progressions";
import type { ChordRef, KeyQuality } from "./theory/harmony";

export type Mode = "notes" | "scale" | "chord" | "key";
export type LabelStyle = "name" | "interval" | "none";
export type NotesFilter = "all" | "naturals" | "one";

export interface Settings {
  mode: Mode;
  root: string;
  scale: string;
  /** Practice shape (1-based) for the scale, or null for the whole neck. */
  scalePosition: number | null;
  chord: string;
  keyMode: KeyQuality;
  /** Chord picked from the key / scale chord list (overlaid on the neck), or null. */
  selected: ChordRef | null;
  sevenths: boolean;
  /** The user's saved progressions (chords stored by position in the key, so they transpose). */
  progressions: SavedProgression[];
  /** The progression being edited and played. */
  activeProgressionId: string;
  /** Seconds per chord when playing a progression. */
  tempo: number;
  notesFilter: NotesFilter;
  preferFlats: boolean;
  labels: LabelStyle;
  tuningId: string;
  frets: number;
  fretMin: number;
  fretMax: number;
  leftHanded: boolean;
  highStringTop: boolean;
  realSpacing: boolean;
  sound: boolean;
  /** "system" follows the iPad's light/dark setting. */
  appearance: "system" | "light" | "dark";
  /** Sidebar shown on wide screens (on narrow screens it slides over and starts hidden). */
  sidebarOpen: boolean;
}

export const DEFAULTS: Settings = {
  mode: "key",
  root: "D",
  scale: "minor pentatonic",
  scalePosition: null,
  chord: "M",
  keyMode: "major",
  selected: { src: "key", degree: 1 },
  sevenths: false,
  ...migrateProgressions({ root: "D", keyMode: "major" }),
  tempo: 2,
  notesFilter: "all",
  preferFlats: false,
  labels: "interval",
  tuningId: "standard",
  frets: 22,
  fretMin: 0,
  fretMax: 22,
  leftHanded: false,
  highStringTop: true,
  realSpacing: true,
  sound: true,
  appearance: "system",
  sidebarOpen: true,
};

const STORAGE_KEY = "fret-wiz.settings.v1";

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const s: Settings = { ...DEFAULTS, ...JSON.parse(raw) };
    // Older saves had a "harmonic minor" key mode; keys are now major or minor.
    if (s.keyMode !== "major" && s.keyMode !== "minor") s.keyMode = "minor";
    const parsed = JSON.parse(raw);
    Object.assign(s, migrateProgressions(parsed));
    delete (s as unknown as Record<string, unknown>).progression;
    return s;
  } catch {
    return DEFAULTS;
  }
}

/** Track a CSS media query (e.g. dark mode, narrow screen). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** Settings that survive reloads (stored in this browser only). */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* private mode or storage full: settings just won't persist */
    }
  }, [settings]);

  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));
  const reset = () => setSettings(DEFAULTS);
  return { settings, update, reset };
}
