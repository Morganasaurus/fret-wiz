import { useEffect, useState } from "react";
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
  /** The user's own chord progression, stored by position in the key so it transposes. */
  progression: ChordRef[];
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
  progression: [],
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
};

const STORAGE_KEY = "fret-wiz.settings.v1";

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const s: Settings = { ...DEFAULTS, ...JSON.parse(raw) };
    // Older saves had a "harmonic minor" key mode; keys are now major or minor.
    if (s.keyMode !== "major" && s.keyMode !== "minor") s.keyMode = "minor";
    if (!Array.isArray(s.progression)) s.progression = [];
    return s;
  } catch {
    return DEFAULTS;
  }
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
