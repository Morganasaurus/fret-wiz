import { Note } from "tonal";
import type { ReactNode } from "react";
import { type CatalogItem, groupBy } from "../theory/catalog";
import { pretty } from "../theory/notes";
import type { DiatonicChord, Tone } from "../theory/tones";
import { DEGREE_COLORS, INTERVAL_FEEL } from "../view";

// ---------------------------------------------------------------------------

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label?: string;
  /** Stretch to fill the row, segments sharing the width equally. */
  full?: boolean;
}

export function Segmented<T extends string>({ value, options, onChange, label, full }: SegmentedProps<T>) {
  return (
    <div className={`segmented ${full ? "full" : ""}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? "active" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className={`toggle ${checked ? "on" : ""}`} aria-pressed={checked} onClick={() => onChange(!checked)}>
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      {label}
    </button>
  );
}

export function CatalogSelect({ items, value, onChange }: { items: CatalogItem[]; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {groupBy(items).map(([group, list]) => (
        <optgroup key={group} label={group}>
          {list.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------

const ROOT_KEYS = [
  { chroma: 0, names: ["C"] },
  { chroma: 1, names: ["C#", "Db"] },
  { chroma: 2, names: ["D"] },
  { chroma: 3, names: ["D#", "Eb"] },
  { chroma: 4, names: ["E"] },
  { chroma: 5, names: ["F"] },
  { chroma: 6, names: ["F#", "Gb"] },
  { chroma: 7, names: ["G"] },
  { chroma: 8, names: ["G#", "Ab"] },
  { chroma: 9, names: ["A"] },
  { chroma: 10, names: ["A#", "Bb"] },
  { chroma: 11, names: ["B"] },
];

const MAJOR_DEFAULT: Record<number, string> = { 1: "Db", 3: "Eb", 6: "F#", 8: "Ab", 10: "Bb" };
const MINOR_DEFAULT: Record<number, string> = { 1: "C#", 3: "Eb", 6: "F#", 8: "G#", 10: "Bb" };

/**
 * Twelve root buttons. Black keys pick a sensible spelling for the context
 * (Db major but C# minor); tapping the selected one again flips the spelling.
 */
export function RootPicker({ root, minor, onChange }: { root: string; minor: boolean; onChange: (r: string) => void }) {
  const current = Note.chroma(root);
  return (
    <div className="root-picker">
      {ROOT_KEYS.map((k) => {
        const selected = k.chroma === current;
        const black = k.names.length > 1;
        const shown = selected ? root : black ? (minor ? MINOR_DEFAULT : MAJOR_DEFAULT)[k.chroma] : k.names[0];
        return (
          <button
            key={k.chroma}
            type="button"
            className={`root ${black ? "black" : ""} ${selected ? "active" : ""}`}
            title={black ? (selected ? "Tap again to switch spelling" : k.names.map(pretty).join(" / ")) : undefined}
            onClick={() => {
              if (selected && black) onChange(Note.enharmonic(root));
              else if (!selected) onChange(shown);
            }}
          >
            {black && !selected ? k.names.map(pretty).join("/") : pretty(shown)}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function Legend({ tones }: { tones: Tone[] }) {
  if (!tones.length) return null;
  return (
    <div className="legend">
      {tones.map((t) => (
        <span key={t.name + t.interval} className="chip" style={{ ["--c" as string]: DEGREE_COLORS[t.degree] }}>
          <span className="chip-dot" />
          <strong>{pretty(t.name)}</strong>
          <span className="chip-ivl">{pretty(t.label)}</span>
        </span>
      ))}
    </div>
  );
}

export function ChordRow({
  chords,
  selected,
  sevenths,
  onSelect,
  onSevenths,
}: {
  chords: DiatonicChord[];
  selected: number | null;
  sevenths: boolean;
  onSelect: (degree: number | null) => void;
  onSevenths: (v: boolean) => void;
}) {
  if (!chords.length) return null;
  return (
    <div className="chord-row-wrap">
      <div className="row-head">
        <span className="field-label">Chords built from this scale: tap one to show it</span>
        <Segmented
          label="Chord size"
          value={sevenths ? "7" : "3"}
          options={[
            { value: "3", label: "Triads" },
            { value: "7", label: "7ths" },
          ]}
          onChange={(v) => onSevenths(v === "7")}
        />
      </div>
      <div className="chord-row">
        {chords.map((c) => {
          const active = selected === c.degree;
          return (
            <button
              key={c.degree}
              type="button"
              className={`chord ${active ? "active" : ""}`}
              onClick={() => onSelect(active ? null : c.degree)}
            >
              <span className="roman">{pretty(sevenths ? c.romanSeventh : c.roman)}</span>
              <span className="symbol">{pretty(sevenths ? c.symbolSeventh : c.symbol)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Expandable plain-English guide to the intervals currently on screen. */
export function IntervalGuide({ tones }: { tones: Tone[] }) {
  const seen = new Set<string>();
  const rows = tones.filter((t) => {
    if (seen.has(t.label)) return false;
    seen.add(t.label);
    return true;
  });
  if (!rows.length) return null;
  return (
    <details className="guide">
      <summary>What do the colours and labels mean?</summary>
      <p className="help small">
        Labels like <b>R</b>, <b>♭3</b> and <b>5</b> are <i>intervals</i>: how far each note is from the root. The same interval always
        has the same colour and the same feel, whatever key you're in.
      </p>
      <ul>
        {rows.map((t) => (
          <li key={t.label}>
            <span className="chip-dot" style={{ ["--c" as string]: DEGREE_COLORS[t.degree] }} />
            <b>{pretty(t.label)}</b> <span className="muted">({pretty(t.name)})</span> {INTERVAL_FEEL[t.label] ?? ""}
          </li>
        ))}
      </ul>
    </details>
  );
}
