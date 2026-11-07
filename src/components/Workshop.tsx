import { useMemo } from "react";
import {
  type ChordRef,
  type KeyChord,
  type KeyMatch,
  type KeyQuality,
  PRESETS,
  ROLE_INFO,
  type Role,
  borrowedChords,
  keyChords,
  resolveRef,
  sameRef,
} from "../theory/harmony";
import { pretty } from "../theory/notes";
import { byChroma, chordTones, describeSignature, type KeySummary } from "../theory/tones";
import { type ChordShape, type ShapeSet, chordShapes, ordinal, positionLabel } from "../theory/voicings";
import type { ActiveChord } from "../view";
import { ChordDiagram } from "./ChordDiagram";

export function shapesFor(strings: string[], standard: boolean, root: string, type: string): ShapeSet {
  return chordShapes(strings, standard, root, type);
}

// ---------------------------------------------------------------------------
// Shape panel: the chord chart for whatever chord is active
// ---------------------------------------------------------------------------

function shapeStory(chord: ActiveChord, shape: ChordShape): string {
  if (!shape.caged) {
    return shape.frets.some((f) => f === 0)
      ? "An open-position shape that uses ringing open strings."
      : "Another movable shape. Slide it up or down to play the same chord type on a different root.";
  }
  const openChordName = pretty(shape.caged + chord.symbol.slice(chord.root.length));
  const isOpenItself = shape.frets.some((f) => f === 0) && chord.root[0] === shape.caged && shape.maxFret <= 4;
  if (isOpenItself) return `The standard open ${openChordName} chord.`;
  const where = `${ordinal(shape.minFret)} fret`;
  return shape.barre
    ? `"${shape.caged} shape": the open ${openChordName} fingering moved up to the ${where}. Your first finger lies flat across the strings (a barre) and acts as the nut.`
    : `"${shape.caged} shape": the open ${openChordName} fingering moved up to the ${where}.`;
}

/** Very short "where on the neck" caption for the shape buttons, e.g. "open", "E·3fr". */
function shortPlace(v: ChordShape): string {
  const where = v.frets.some((f) => f === 0) && v.maxFret <= 4 ? "open" : `${v.minFret}fr`;
  return v.caged ? `${v.caged}·${where}` : where;
}

export function ShapePanel({
  chord,
  set,
  index,
  onIndex,
  strings,
  leftHanded,
  onStrum,
}: {
  chord: ActiveChord;
  set: ShapeSet;
  index: number;
  onIndex: (i: number) => void;
  strings: string[];
  leftHanded: boolean;
  onStrum: () => void;
}) {
  const tones = useMemo(() => byChroma(chord.tones), [chord.tones]);
  if (!set.shapes.length) {
    return (
      <div className="shape-panel empty">
        No comfortable shape for {pretty(chord.symbol)} in this tuning. The neck still shows every note in the chord.
      </div>
    );
  }
  const shape = set.shapes[index];
  return (
    <div className="shape-panel">
      <div className="shape-picker" role="radiogroup" aria-label="Chord shape">
        <span className="field-label">Shapes up the neck</span>
        <div className="shape-picker-buttons">
          {set.shapes.map((v, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={i === index}
              className={`${i === index ? "active" : ""} ${i === set.easiest ? "is-easiest" : ""}`}
              title={`${positionLabel(v)}${v.caged ? ` · ${v.caged} shape` : ""}${i === set.easiest ? " · easiest" : ""}`}
              onClick={() => onIndex(i)}
            >
              <span className="num">{i + 1}</span>
              <span className="where">{shortPlace(v)}</span>
            </button>
          ))}
        </div>
      </div>
      <ChordDiagram voicing={shape} strings={strings} tones={tones} leftHanded={leftHanded} />
      <div className="shape-info">
        <div className="shape-title">
          <strong>{pretty(chord.symbol)}</strong>
          {chord.roman && <span className="roman-tag">{pretty(chord.roman)}</span>}
          {chord.role && <RoleBadge role={chord.role} />}
        </div>
        <div className="shape-meta">
          {positionLabel(shape)} · shape {index + 1} of {set.shapes.length}
          {index === set.easiest && <span className="easiest">easiest</span>}
        </div>
        <p className="shape-story">{shapeStory(chord, shape)}</p>
        <p className="shape-key">
          Numbers are fingers: <b>1</b> index · <b>2</b> middle · <b>3</b> ring · <b>4</b> pinky. <b>○</b> play open, <b>×</b> don't play.
          The row underneath shows each string's interval.
        </p>
        <button type="button" className="strum" onClick={onStrum}>
          ▶ Strum it
        </button>
      </div>
    </div>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`role role-${role}`} title={ROLE_INFO[role].help}>
      {ROLE_INFO[role].label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Chord cards
// ---------------------------------------------------------------------------

function ChordCard({
  chord,
  selected,
  playing,
  strings,
  standard,
  leftHanded,
  onSelect,
  onAdd,
}: {
  chord: KeyChord;
  selected: boolean;
  playing: boolean;
  strings: string[];
  standard: boolean;
  leftHanded: boolean;
  onSelect: () => void;
  onAdd: () => void;
}) {
  const set = useMemo(() => shapesFor(strings, standard, chord.root, chord.type), [strings, standard, chord.root, chord.type]);
  const tones = useMemo(() => byChroma(chordTones(chord.root, chord.type)), [chord.root, chord.type]);
  const shape = set.shapes[set.easiest];
  return (
    <div className={`card role-edge-${chord.role} ${selected ? "selected" : ""} ${playing ? "playing" : ""}`}>
      <button type="button" className="card-main" onClick={onSelect}>
        <span className="card-roman">{pretty(chord.roman)}</span>
        <span className="card-symbol">{pretty(chord.symbol)}</span>
        {shape ? (
          <ChordDiagram voicing={shape} strings={strings} tones={tones} size="sm" leftHanded={leftHanded} />
        ) : (
          <span className="card-noshape">no easy shape</span>
        )}
        <RoleBadge role={chord.role} />
      </button>
      <button type="button" className="card-add" onClick={onAdd} aria-label={`Add ${chord.symbol} to my progression`}>
        + Add
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Key workshop
// ---------------------------------------------------------------------------

export interface Playback {
  steps: ChordRef[];
  index: number;
  label: string;
}

interface WorkshopProps {
  tonic: string;
  quality: KeyQuality;
  info: KeySummary;
  sevenths: boolean;
  selected: ChordRef | null;
  progression: ChordRef[];
  tempo: number;
  playback: Playback | null;
  strings: string[];
  standard: boolean;
  leftHanded: boolean;
  onSelect: (ref: ChordRef) => void;
  onSevenths: (v: boolean) => void;
  onProgression: (p: ChordRef[]) => void;
  onTempo: (t: number) => void;
  onPlay: (steps: ChordRef[], label: string) => void;
  onStop: () => void;
}

export function KeyWorkshop(p: WorkshopProps) {
  const diatonic = keyChords(p.tonic, p.quality, p.sevenths);
  const borrowed = borrowedChords(p.tonic, p.quality, p.sevenths);
  const keyName = `${pretty(p.tonic)} ${p.quality}`;
  const playingRef = p.playback ? p.playback.steps[p.playback.index] : null;
  const resolve = (r: ChordRef) => resolveRef(r, p.tonic, p.quality, p.sevenths);

  const card = (c: KeyChord) => (
    <ChordCard
      key={`${c.ref.src}${c.ref.degree}`}
      chord={c}
      selected={sameRef(p.selected, c.ref)}
      playing={sameRef(playingRef, c.ref)}
      strings={p.strings}
      standard={p.standard}
      leftHanded={p.leftHanded}
      onSelect={() => p.onSelect(c.ref)}
      onAdd={() => p.onProgression([...p.progression, c.ref])}
    />
  );

  const mineLabel = "My progression";
  const playingMine = p.playback?.label === mineLabel;

  return (
    <div className="workshop">
      <section>
        <div className="section-head">
          <h3>Chords in the key of {keyName}</h3>
          <Segmented7 sevenths={p.sevenths} onChange={p.onSevenths} />
        </div>
        <p className="help">
          These seven chords use only notes from {keyName}, so any of them sound good together.
          {p.quality === "major"
            ? ` Most songs in ${pretty(p.tonic)} lean on ${diatonic[0].symbol}, ${diatonic[3].symbol} and ${diatonic[4].symbol} (I, IV, V), plus ${diatonic[5].symbol} (vi) for a sadder moment.`
            : ` Minor songs in ${pretty(p.tonic)} lean on ${diatonic[0].symbol}, ${diatonic[5].symbol} and ${diatonic[6].symbol} (i, ♭VI, ♭VII).`}{" "}
          Tap a chord to see and hear it.
        </p>
        <div className="cards">{diatonic.map(card)}</div>
        <div className="role-legend">
          {(["home", "away", "tension"] as Role[]).map((r) => (
            <span key={r}>
              <RoleBadge role={r} /> {ROLE_INFO[r].help}
            </span>
          ))}
        </div>
        <p className="help small">
          {describeSignature(p.info.signature)} · Relative key: {pretty(p.info.relative)} (same chords, different home)
        </p>
      </section>

      <section>
        <div className="section-head">
          <h3>Borrowed chords</h3>
        </div>
        <p className="help">
          Chords from {pretty(p.tonic)} {p.quality === "major" ? "minor" : "major"} that work well in {keyName}. Use them
          sparingly for a surprise: they're the "spice" in many famous songs.
        </p>
        <div className="cards borrowed">{borrowed.map(card)}</div>
      </section>

      <section>
        <div className="section-head">
          <h3>{mineLabel}</h3>
          <div className="tempo">
            <span className="field-label">Speed</span>
            <select value={p.tempo} onChange={(e) => p.onTempo(Number(e.target.value))}>
              <option value={3}>Slow</option>
              <option value={2}>Medium</option>
              <option value={1.3}>Fast</option>
            </select>
          </div>
        </div>
        {p.progression.length === 0 ? (
          <p className="help">Tap <b>+ Add</b> on any chord above to start writing, or add a famous progression below.</p>
        ) : (
          <>
            <div className="progression">
              {p.progression.map((ref, i) => {
                const c = resolve(ref);
                if (!c) return null;
                const isNow = playingMine && p.playback!.index === i;
                return (
                  <span key={i} className={`step role-edge-${c.role} ${isNow ? "playing" : ""}`}>
                    <button type="button" className="step-main" onClick={() => p.onSelect(ref)}>
                      <span className="card-roman">{pretty(c.roman)}</span>
                      <span className="step-symbol">{pretty(c.symbol)}</span>
                    </button>
                    <button
                      type="button"
                      className="step-remove"
                      aria-label="Remove"
                      onClick={() => p.onProgression(p.progression.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
            <div className="actions">
              {playingMine ? (
                <button type="button" className="primary" onClick={p.onStop}>
                  ■ Stop
                </button>
              ) : (
                <button type="button" className="primary" onClick={() => p.onPlay(p.progression, mineLabel)}>
                  ▶ Play (loops)
                </button>
              )}
              <button type="button" onClick={() => p.onProgression(p.progression.slice(0, -1))}>
                Undo last
              </button>
              <button type="button" onClick={() => p.onProgression([])}>
                Clear
              </button>
            </div>
            <p className="help small">Saved on this device. Change the key above and your progression moves with it.</p>
          </>
        )}
      </section>

      <section>
        <div className="section-head">
          <h3>Famous progressions in {keyName}</h3>
        </div>
        <div className="presets">
          {PRESETS[p.quality].map((preset) => {
            const isPlaying = p.playback?.label === preset.name;
            const chords = preset.steps.map(resolve);
            return (
              <div key={preset.name} className={`preset ${isPlaying ? "playing" : ""}`}>
                <div className="preset-text">
                  <strong>{preset.name}</strong>
                  <span className="preset-about">{preset.about}</span>
                  <span className="preset-chords">
                    {chords.map((c, i) => (
                      <span key={i} className={isPlaying && p.playback!.index === i ? "now" : ""}>
                        {c ? pretty(c.symbol) : "?"}
                      </span>
                    ))}
                  </span>
                  <span className="preset-roman">{chords.map((c) => (c ? pretty(c.roman) : "?")).join(" – ")}</span>
                </div>
                <div className="preset-actions">
                  {isPlaying ? (
                    <button type="button" className="primary" onClick={p.onStop}>
                      ■
                    </button>
                  ) : (
                    <button type="button" className="primary" aria-label={`Play ${preset.name}`} onClick={() => p.onPlay(preset.steps, preset.name)}>
                      ▶
                    </button>
                  )}
                  <button type="button" onClick={() => p.onProgression([...p.progression, ...preset.steps])}>
                    + Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Segmented7({ sevenths, onChange }: { sevenths: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Chord size">
      <button type="button" role="radio" aria-checked={!sevenths} className={!sevenths ? "active" : ""} onClick={() => onChange(false)}>
        Triads
      </button>
      <button type="button" role="radio" aria-checked={sevenths} className={sevenths ? "active" : ""} onClick={() => onChange(true)}>
        7ths
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chord mode: which keys contain this chord
// ---------------------------------------------------------------------------

export function KeysWithChord({ matches, onPick }: { matches: KeyMatch[]; onPick: (m: KeyMatch) => void }) {
  if (!matches.length) {
    return <p className="help">This chord doesn't belong to any major or natural minor key, so it's usually used as a passing or borrowed chord.</p>;
  }
  return (
    <div className="keys-with">
      {matches.map((m) => (
        <button key={`${m.tonic}${m.quality}`} type="button" className="key-chip" onClick={() => onPick(m)}>
          <span>
            {pretty(m.tonic)} {m.quality}
          </span>
          <span className="card-roman">{pretty(m.roman)}</span>
        </button>
      ))}
    </div>
  );
}
