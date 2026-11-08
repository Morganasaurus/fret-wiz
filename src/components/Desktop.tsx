import type { Mode } from "../state";
import type { ChordRef, KeyChord } from "../theory/harmony";
import { pretty } from "../theory/notes";
import type { Tone } from "../theory/tones";
import { DEGREE_COLORS, INTERVAL_FEEL } from "../view";
import type { Playback } from "./Workshop";

const Kbd = ({ k }: { k: string }) => <kbd className="kbd">{k}</kbd>;

/** Always-visible play bar for the active progression (desktop header). */
export function Transport({
  name,
  steps,
  resolve,
  playback,
  tempo,
  onPlay,
  onStop,
  onTempo,
}: {
  name: string;
  steps: ChordRef[];
  resolve: (r: ChordRef) => KeyChord | null;
  playback: Playback | null;
  tempo: number;
  onPlay: () => void;
  onStop: () => void;
  onTempo: (t: number) => void;
}) {
  const playing = playback?.label === name;
  return (
    <div className="transport">
      <button
        type="button"
        className="round-play"
        aria-label={playing ? "Stop" : `Play ${name}`}
        disabled={!steps.length}
        onClick={playing ? onStop : onPlay}
      >
        {playing ? "■" : "▶"}
      </button>
      <div className="transport-steps">
        {steps.length ? (
          steps.map((ref, i) => {
            const c = resolve(ref);
            return (
              <span key={i} className={`t-step ${playing && playback!.index === i ? "now" : ""}`}>
                <span className="card-roman">{c ? pretty(c.roman) : "?"}</span>
                <b>{c ? pretty(c.symbol) : "?"}</b>
              </span>
            );
          })
        ) : (
          <span className="muted">{name} is empty: add chords below</span>
        )}
      </div>
      <div className="segmented" role="radiogroup" aria-label="Speed">
        {[
          [3, "Slow"],
          [2, "Medium"],
          [1.3, "Fast"],
        ].map(([v, label]) => (
          <button key={v} type="button" role="radio" aria-checked={tempo === v} className={tempo === v ? "active" : ""} onClick={() => onTempo(v as number)}>
            {label}
          </button>
        ))}
      </div>
      <Kbd k="P" />
    </div>
  );
}

/** Plain-English meaning of each note in the current chord or scale. */
export function HearingCard({ tones, title }: { tones: Tone[]; title: string }) {
  const seen = new Set<string>();
  const rows = tones.filter((t) => !seen.has(t.label) && seen.add(t.label));
  return (
    <section className="page-section">
      <h3>What you're hearing</h3>
      <div className="info-card">
        {rows.length ? (
          <>
            <p className="help small">{title}</p>
            <ul className="hearing">
              {rows.map((t) => (
                <li key={t.label}>
                  <span className="ivl-pill" style={{ background: DEGREE_COLORS[t.degree] }}>
                    {pretty(t.label)}
                  </span>
                  <span>
                    <b>{pretty(t.name)}</b> · {INTERVAL_FEEL[t.label] ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="help">Pick a single note, a chord or a scale to see what each note does.</p>
        )}
      </div>
    </section>
  );
}

/** Shortcut list for the current mode. */
export function ShortcutsCard({ mode }: { mode: Mode }) {
  const rows: [string, string[]][] = [];
  if (mode === "key" || mode === "chord" || mode === "scale") rows.push(["Strum the chord", ["Space"]]);
  if (mode === "scale") rows.push(["Pick a scale shape", ["1", "–", "9"]], ["Whole neck", ["0"]], ["Play the shape", ["Space"]]);
  else if (mode !== "notes") rows.push(["Pick a chord shape", ["1", "–", "9"]]);
  if (mode === "key" || mode === "scale") rows.push(["Previous / next chord", ["←", "→"]]);
  if (mode === "key") rows.push(["Play / stop progression", ["P"]], ["Add chord to progression", ["A"]]);
  rows.push(["Start / stop metronome", ["M"]], ["Show / hide sidebar", ["S"]]);
  return (
    <section className="page-section">
      <h3>Keyboard</h3>
      <div className="info-card shortcuts">
        {rows.map(([label, keys]) => (
          <div key={label} className="shortcut">
            <span>{label}</span>
            <span className="keys">
              {keys.map((k, i) => (k === "–" ? <span key={i}>–</span> : <Kbd key={i} k={k} />))}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Shown in the desktop inspector column when no chord is selected yet. */
export function InspectorPlaceholder({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="shape-panel placeholder">
      <h3>{title}</h3>
      {lines.map((l) => (
        <p key={l} className="help">
          {l}
        </p>
      ))}
      <p className="help small">
        Tip: <Kbd k="←" /> <Kbd k="→" /> step through the chords, <Kbd k="Space" /> strums.
      </p>
    </div>
  );
}
