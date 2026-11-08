import type { ChordRef, KeyQuality } from "./theory/harmony";

/** A named progression the user has written, remembered with the key it was written in. */
export interface SavedProgression {
  id: string;
  name: string;
  tonic: string;
  quality: KeyQuality;
  steps: ChordRef[];
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** "My progression", then "Progression 2", "Progression 3"... skipping names already taken. */
export function nextName(list: SavedProgression[]): string {
  if (!list.length) return "My progression";
  const taken = new Set(list.map((p) => p.name));
  for (let n = list.length + 1; ; n++) if (!taken.has(`Progression ${n}`)) return `Progression ${n}`;
}

export function createProgression(list: SavedProgression[], tonic: string, quality: KeyQuality): SavedProgression {
  return { id: newId(), name: nextName(list), tonic, quality, steps: [] };
}

/** Move one step to a new position (drag and drop). */
export function moveStep<T>(steps: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= steps.length) return steps;
  const out = [...steps];
  const [item] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(to, out.length)), 0, item);
  return out;
}

const isRef = (r: unknown): r is ChordRef =>
  !!r && typeof r === "object" && ((r as ChordRef).src === "key" || (r as ChordRef).src === "borrowed") && typeof (r as ChordRef).degree === "number";

/**
 * Bring saved settings up to date: older saves had one unnamed `progression`; newer ones keep a list.
 * Always returns at least one progression and a valid active id.
 */
export function migrateProgressions(raw: {
  progressions?: unknown;
  activeProgressionId?: unknown;
  progression?: unknown;
  root?: unknown;
  keyMode?: unknown;
}): { progressions: SavedProgression[]; activeProgressionId: string } {
  const tonic = typeof raw.root === "string" ? raw.root : "D";
  const quality: KeyQuality = raw.keyMode === "minor" ? "minor" : "major";
  let list: SavedProgression[] = [];

  if (Array.isArray(raw.progressions)) {
    list = raw.progressions
      .filter((p): p is SavedProgression => !!p && typeof p === "object" && typeof (p as SavedProgression).id === "string")
      .map((p) => ({
        id: p.id,
        name: typeof p.name === "string" && p.name.trim() ? p.name : "Untitled",
        tonic: typeof p.tonic === "string" ? p.tonic : tonic,
        quality: p.quality === "minor" ? "minor" : "major",
        steps: Array.isArray(p.steps) ? p.steps.filter(isRef) : [],
      }));
  }
  if (!list.length) {
    const steps = Array.isArray(raw.progression) ? raw.progression.filter(isRef) : [];
    list = [{ id: newId(), name: "My progression", tonic, quality, steps }];
  }
  const active = list.some((p) => p.id === raw.activeProgressionId) ? (raw.activeProgressionId as string) : list[0].id;
  return { progressions: list, activeProgressionId: active };
}
