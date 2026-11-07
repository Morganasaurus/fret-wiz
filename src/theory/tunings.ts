export interface Tuning {
  id: string;
  name: string;
  /** Open-string notes with octave, lowest string first. */
  strings: string[];
}

export const TUNINGS: Tuning[] = [
  { id: "standard", name: "Standard (E A D G B E)", strings: ["E2", "A2", "D3", "G3", "B3", "E4"] },
  { id: "half-down", name: "Half step down (E♭)", strings: ["Eb2", "Ab2", "Db3", "Gb3", "Bb3", "Eb4"] },
  { id: "drop-d", name: "Drop D (D A D G B E)", strings: ["D2", "A2", "D3", "G3", "B3", "E4"] },
  { id: "d-standard", name: "D standard (D G C F A D)", strings: ["D2", "G2", "C3", "F3", "A3", "D4"] },
  { id: "drop-c", name: "Drop C (C G C F A D)", strings: ["C2", "G2", "C3", "F3", "A3", "D4"] },
  { id: "dadgad", name: "DADGAD", strings: ["D2", "A2", "D3", "G3", "A3", "D4"] },
  { id: "open-g", name: "Open G (D G D G B D)", strings: ["D2", "G2", "D3", "G3", "B3", "D4"] },
  { id: "open-d", name: "Open D (D A D F♯ A D)", strings: ["D2", "A2", "D3", "F#3", "A3", "D4"] },
  { id: "open-e", name: "Open E (E B E G♯ B E)", strings: ["E2", "B2", "E3", "G#3", "B3", "E4"] },
  { id: "seven", name: "7-string (B E A D G B E)", strings: ["B1", "E2", "A2", "D3", "G3", "B3", "E4"] },
  { id: "bass4", name: "Bass 4-string (E A D G)", strings: ["E1", "A1", "D2", "G2"] },
  { id: "bass5", name: "Bass 5-string (B E A D G)", strings: ["B0", "E1", "A1", "D2", "G2"] },
];

export function getTuning(id: string): Tuning {
  return TUNINGS.find((t) => t.id === id) ?? TUNINGS[0];
}
