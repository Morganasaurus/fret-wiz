import { SCALES } from "../theory/catalog";
import { type ScalePosition, allCopies } from "../theory/positions";
import { CatalogSelect } from "./Controls";

const QUICK: { id: string; label: string }[] = [
  { id: "minor pentatonic", label: "Minor pentatonic" },
  { id: "major pentatonic", label: "Major pentatonic" },
  { id: "minor blues", label: "Blues" },
  { id: "major", label: "Major" },
  { id: "minor", label: "Minor" },
];

/** Big buttons for the everyday scales, with the full list in a dropdown. */
export function ScalePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const isQuick = QUICK.some((q) => q.id === value);
  return (
    <div className="scale-picker">
      <div className="quick-scales" role="radiogroup" aria-label="Common scales">
        {QUICK.map((q) => (
          <button
            key={q.id}
            type="button"
            role="radio"
            aria-checked={q.id === value}
            className={q.id === value ? "active" : ""}
            onClick={() => onChange(q.id)}
          >
            {q.label}
          </button>
        ))}
      </div>
      <div className={`more-scales ${isQuick ? "" : "active"}`}>
        <span className="field-label">All scales &amp; modes</span>
        <CatalogSelect items={SCALES} value={value} onChange={onChange} />
      </div>
    </div>
  );
}

/** Pick one practice shape (box) of the scale, or the whole neck. */
export function ShapeBar({
  positions,
  value,
  onChange,
  onPlay,
}: {
  positions: ScalePosition[];
  value: number | null;
  onChange: (n: number | null) => void;
  onPlay: () => void;
}) {
  if (!positions.length) {
    return (
      <div className="shape-bar">
        <span className="field-label">Shape</span>
        <span className="help small">This scale repeats evenly up the neck, so practise it everywhere rather than in boxes.</span>
      </div>
    );
  }
  const current = value ? positions[value - 1] : null;
  return (
    <div className="shape-bar">
      <span className="field-label">Shape</span>
      <div className="shape-buttons" role="radiogroup" aria-label="Scale shape">
        <button type="button" role="radio" aria-checked={value === null} className={value === null ? "active" : ""} onClick={() => onChange(null)}>
          Whole neck
        </button>
        {positions.map((p) => (
          <button
            key={p.number}
            type="button"
            role="radio"
            aria-checked={value === p.number}
            className={`num ${value === p.number ? "active" : ""}`}
            onClick={() => onChange(p.number)}
          >
            {p.number}
          </button>
        ))}
      </div>
      {current && (
        <div className="shape-now">
          <span>
            Frets {allCopies(current)
              .map((c) => `${c.minFret}–${c.maxFret}`)
              .sort((a, b) => parseInt(a) - parseInt(b))
              .join(" & ")}
          </span>
          <button type="button" className="primary" onClick={onPlay}>
            ▶ Play up &amp; down
          </button>
        </div>
      )}
    </div>
  );
}
