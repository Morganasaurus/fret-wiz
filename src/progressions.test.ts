import { describe, expect, it } from "vitest";
import { createProgression, migrateProgressions, moveStep, nextName } from "./progressions";

const k = (degree: number) => ({ src: "key" as const, degree });

describe("saved progressions", () => {
  it("migrates the old single progression", () => {
    const { progressions, activeProgressionId } = migrateProgressions({ progression: [k(1), k(5)], root: "G", keyMode: "major" });
    expect(progressions).toHaveLength(1);
    expect(progressions[0]).toMatchObject({ name: "My progression", tonic: "G", quality: "major", steps: [k(1), k(5)] });
    expect(activeProgressionId).toBe(progressions[0].id);
  });

  it("always has at least one progression", () => {
    const { progressions } = migrateProgressions({});
    expect(progressions).toHaveLength(1);
    expect(progressions[0].steps).toEqual([]);
  });

  it("keeps a valid list, drops junk steps and fixes a stale active id", () => {
    const { progressions, activeProgressionId } = migrateProgressions({
      progressions: [
        { id: "a", name: "Verse", tonic: "D", quality: "major", steps: [k(1), { nonsense: true }, k(4)] },
        { id: "b", name: "", tonic: "A", quality: "minor", steps: "bad" },
        "garbage",
      ],
      activeProgressionId: "missing",
    });
    expect(progressions.map((p) => p.name)).toEqual(["Verse", "Untitled"]);
    expect(progressions[0].steps).toEqual([k(1), k(4)]);
    expect(progressions[1].steps).toEqual([]);
    expect(activeProgressionId).toBe("a");
  });

  it("names new progressions without clashing", () => {
    expect(nextName([])).toBe("My progression");
    const one = createProgression([], "D", "major");
    expect(nextName([one])).toBe("Progression 2");
    const two = { ...createProgression([one], "D", "major"), name: "Progression 3" };
    expect(nextName([one, two])).toBe("Progression 4");
  });

  it("moves steps for drag and drop", () => {
    expect(moveStep(["D", "A", "Bm", "G"], 3, 0)).toEqual(["G", "D", "A", "Bm"]);
    expect(moveStep(["D", "A", "Bm", "G"], 0, 2)).toEqual(["A", "Bm", "D", "G"]);
    expect(moveStep(["D", "A"], 0, 0)).toEqual(["D", "A"]);
    expect(moveStep(["D", "A"], 0, 9)).toEqual(["A", "D"]);
  });
});
