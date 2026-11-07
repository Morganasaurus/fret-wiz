import { useEffect, useMemo, useState } from "react";
import { playSequence, pluck, stopAll, strum } from "./audio";
import { CatalogSelect, ChordRow, Field, IntervalGuide, Legend, RootPicker, Segmented, Toggle } from "./components/Controls";
import { Fretboard } from "./components/Fretboard";
import { ScalePicker, ShapeBar } from "./components/ScaleTools";
import { KeyWorkshop, KeysWithChord, type Playback, ShapePanel, shapesFor } from "./components/Workshop";
import { type LabelStyle, type Mode, useSettings } from "./state";
import { CHORDS } from "./theory/catalog";
import { type ChordRef, type KeyQuality, keysContaining, resolveRef } from "./theory/harmony";
import { midi, nameForChroma } from "./theory/notes";
import { allCopies, positionKey, scalePositions } from "./theory/positions";
import { chordTones, diatonicChords } from "./theory/tones";
import { TUNINGS, getTuning } from "./theory/tunings";
import { voicingMidi } from "./theory/voicings";
import { buildView, isMinorContext } from "./view";

const MODES: { value: Mode; label: string }[] = [
  { value: "key", label: "Keys & songwriting" },
  { value: "chord", label: "Chords" },
  { value: "scale", label: "Scales" },
  { value: "notes", label: "Notes" },
];

const FRET_COUNTS = [12, 15, 19, 21, 22, 24];
const SEVENTH_TYPES = ["maj7", "7", "m7", "m7b5", "dim7", "mMaj7"];

export default function App() {
  const { settings: s, update, reset } = useSettings();
  const tuning = getTuning(s.tuningId);
  const standard = tuning.id === "standard";
  const view = useMemo(() => buildView(s), [s]);
  const fretOptions = Array.from({ length: s.frets + 1 }, (_, i) => i);

  // ---- chord shapes for the active chord ----
  const shapeSet = useMemo(
    () => (view.chord ? shapesFor(tuning.strings, standard, view.chord.root, view.chord.type) : null),
    [view.chord?.root, view.chord?.type, tuning.strings, standard],
  );
  const shapeId = view.chord ? `${tuning.id}|${view.chord.root}|${view.chord.type}` : "";
  const [shapePick, setShapePick] = useState<{ id: string; index: number } | null>(null);
  const shapeIndex = shapeSet ? (shapePick?.id === shapeId ? shapePick.index : shapeSet.easiest) : 0;
  const shape = shapeSet?.shapes[shapeIndex] ?? null;

  // ---- scale shapes (boxes) ----
  const positions = useMemo(
    () => (s.mode === "scale" ? scalePositions(tuning.strings, s.root, s.scale, s.frets) : []),
    [s.mode, tuning.strings, s.root, s.scale, s.frets],
  );
  const currentPosition = s.scalePosition ? (positions[s.scalePosition - 1] ?? null) : null;
  const positionKeys = useMemo(
    () =>
      currentPosition
        ? new Map(allCopies(currentPosition).flatMap((c, i) => c.notes.map((n) => [positionKey(n.string, n.fret), i] as const)))
        : null,
    [currentPosition],
  );
  const positionHint = currentPosition
    ? `Shape ${currentPosition.number} of ${positions.length}: one hand position covering frets ${currentPosition.minFret}–${currentPosition.maxFret}${
        currentPosition.copies.length
          ? ` (it repeats 12 frets away at ${currentPosition.copies.map((c) => `${c.minFret}–${c.maxFret}`).join(" and ")}, so both are lit)`
          : ""
      }, ${
        currentPosition.perString
      } notes on each string${s.scale.includes("blues") ? " plus the blue note" : ""}. Ringed notes are the root. Learn it up and down, then move to the next shape, which overlaps this one.`
    : "";
  const playPosition = () => {
    if (!s.sound || !currentPosition) return;
    const up = [...new Set(currentPosition.notes.map((n) => n.midi))].sort((a, b) => a - b);
    playSequence([...up, ...up.slice(0, -1).reverse()]);
  };

  // ---- sound ----
  const strumChord = (root: string, type: string) => {
    if (!s.sound) return;
    const set = shapesFor(tuning.strings, standard, root, type);
    const v = set.shapes[set.easiest];
    if (v) strum(voicingMidi(tuning.strings, v));
    else strum(chordTones(root, type).map((t) => midi(`${t.name}3`)));
  };
  const strumShown = () => {
    if (s.sound && shape) strum(voicingMidi(tuning.strings, shape));
  };

  // ---- progression playback ----
  const [playback, setPlayback] = useState<Playback | null>(null);
  useEffect(() => {
    if (!playback) return;
    const ref = playback.steps[playback.index];
    update({ selected: ref });
    const c = resolveRef(ref, s.root, s.keyMode, s.sevenths);
    if (c) strumChord(c.root, c.type);
    const timer = setTimeout(
      () => setPlayback((p) => (p ? { ...p, index: (p.index + 1) % p.steps.length } : p)),
      s.tempo * 1000,
    );
    return () => clearTimeout(timer);
  }, [playback]);

  const stop = () => {
    setPlayback(null);
    stopAll(0.3);
  };

  const selectKeyChord = (ref: ChordRef) => {
    setPlayback(null);
    update({ selected: ref });
    const c = resolveRef(ref, s.root, s.keyMode, s.sevenths);
    if (c) strumChord(c.root, c.type);
  };

  const changeMode = (mode: Mode) => {
    stop();
    update({ mode, selected: null });
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/icon.svg" alt="" width={28} height={28} />
          <span>Fret Wiz</span>
        </div>
        <div className="topbar-right">
          <Segmented label="Mode" value={s.mode} options={MODES} onChange={changeMode} />
          <button
            type="button"
            className={`sound ${s.sound ? "on" : ""}`}
            aria-pressed={s.sound}
            title={s.sound ? "Sound on" : "Sound off"}
            onClick={() => {
              if (s.sound) stopAll();
              update({ sound: !s.sound });
            }}
          >
            {s.sound ? "🔊" : "🔇"}
          </button>
        </div>
      </header>

      <section className="board-card">
        <div className="board-head">
          <div>
            <h1>{view.title}</h1>
            <p className="subtitle">{view.subtitle}</p>
          </div>
          <div className="board-tools">
            {s.mode === "key" && s.selected && (
              <button type="button" className="ghost" onClick={() => { stop(); update({ selected: null }); }}>
                Show whole key
              </button>
            )}
            <Segmented<LabelStyle>
              label="Labels"
              value={s.mode === "notes" && s.labels === "interval" ? "name" : s.labels}
              options={
                s.mode === "notes"
                  ? [
                      { value: "name", label: "Notes" },
                      { value: "none", label: "Blank" },
                    ]
                  : [
                      { value: "name", label: "Notes" },
                      { value: "interval", label: "Intervals" },
                      { value: "none", label: "Blank" },
                    ]
              }
              onChange={(labels) => update({ labels })}
            />
          </div>
        </div>
        {s.mode === "scale" && (
          <ShapeBar
            positions={positions}
            value={currentPosition ? currentPosition.number : null}
            onChange={(scalePosition) => {
              stopAll();
              update({ scalePosition });
            }}
            onPlay={playPosition}
          />
        )}
        <p className="hint">{currentPosition ? positionHint : view.hint}</p>
        <div className="board-scroll">
          <Fretboard
            strings={tuning.strings}
            frets={s.frets}
            dots={view.dots}
            fretMin={s.fretMin}
            fretMax={s.fretMax}
            leftHanded={s.leftHanded}
            highStringTop={s.highStringTop}
            realSpacing={s.realSpacing}
            voicing={positionKeys ? null : (shape?.frets ?? null)}
            shape={positionKeys}
            onPick={(p) => {
              if (s.sound) pluck(p.midi);
              if (s.mode === "notes") update({ notesFilter: "one", root: nameForChroma(p.chroma, s.preferFlats) });
            }}
          />
        </div>
        {view.chord && shapeSet && (
          <ShapePanel
            chord={view.chord}
            set={shapeSet}
            index={shapeIndex}
            onIndex={(index) => {
              setShapePick({ id: shapeId, index });
              const v = shapeSet.shapes[index];
              if (s.sound && v) strum(voicingMidi(tuning.strings, v));
            }}
            strings={tuning.strings}
            leftHanded={s.leftHanded}
            onStrum={strumShown}
          />
        )}
        <div className="legend-row">
          <Legend tones={view.legend} />
        </div>
        <IntervalGuide tones={view.legend} />
      </section>

      <div className={`panels ${s.mode === "key" ? "wide" : ""}`}>
        <section className="panel">
          {s.mode === "notes" && (
            <>
              <Field label="Show">
                <Segmented
                  value={s.notesFilter}
                  options={[
                    { value: "all", label: "All notes" },
                    { value: "naturals", label: "Naturals only" },
                    { value: "one", label: "One note" },
                  ]}
                  onChange={(notesFilter) => update({ notesFilter })}
                />
              </Field>
              {s.notesFilter === "one" ? (
                <Field label="Note">
                  <RootPicker root={s.root} minor={false} onChange={(root) => update({ root })} />
                </Field>
              ) : (
                <Field label="Accidentals">
                  <Segmented
                    value={s.preferFlats ? "flat" : "sharp"}
                    options={[
                      { value: "sharp", label: "Sharps ♯" },
                      { value: "flat", label: "Flats ♭" },
                    ]}
                    onChange={(v) => update({ preferFlats: v === "flat" })}
                  />
                </Field>
              )}
            </>
          )}

          {s.mode === "key" && (
            <>
              <div className="key-pickers">
                <Field label="Key">
                  <RootPicker root={s.root} minor={s.keyMode === "minor"} onChange={(root) => update({ root })} />
                </Field>
                <Field label="Major or minor">
                  <Segmented<KeyQuality>
                    value={s.keyMode}
                    options={[
                      { value: "major", label: "Major (brighter)" },
                      { value: "minor", label: "Minor (darker)" },
                    ]}
                    onChange={(keyMode) => {
                      stop();
                      update({ keyMode, selected: null });
                    }}
                  />
                </Field>
              </div>
              {view.key && (
                <KeyWorkshop
                  tonic={s.root}
                  quality={s.keyMode}
                  info={view.key}
                  sevenths={s.sevenths}
                  selected={s.selected}
                  progression={s.progression}
                  tempo={s.tempo}
                  playback={playback}
                  strings={tuning.strings}
                  standard={standard}
                  leftHanded={s.leftHanded}
                  onSelect={selectKeyChord}
                  onSevenths={(sevenths) => update({ sevenths })}
                  onProgression={(progression) => update({ progression })}
                  onTempo={(tempo) => update({ tempo })}
                  onPlay={(steps, label) => {
                    if (!steps.length) return;
                    setPlayback({ steps, index: 0, label });
                  }}
                  onStop={stop}
                />
              )}
            </>
          )}

          {s.mode === "chord" && (
            <>
              <Field label="Root">
                <RootPicker root={s.root} minor={isMinorContext(s)} onChange={(root) => update({ root })} />
              </Field>
              <Field label="Chord type">
                <CatalogSelect items={CHORDS} value={s.chord} onChange={(chord) => update({ chord })} />
              </Field>
              <Field label="Keys this chord belongs to: tap one to write with it">
                <KeysWithChord
                  matches={keysContaining(s.root, s.chord)}
                  onPick={(m) => {
                    stop();
                    update({
                      mode: "key",
                      root: m.tonic,
                      keyMode: m.quality,
                      selected: { src: "key", degree: m.degree },
                      sevenths: SEVENTH_TYPES.includes(s.chord),
                    });
                  }}
                />
              </Field>
            </>
          )}

          {s.mode === "scale" && (
            <>
              <Field label="Root">
                <RootPicker root={s.root} minor={isMinorContext(s)} onChange={(root) => update({ root })} />
              </Field>
              <Field label="Scale">
                <ScalePicker
                  value={s.scale}
                  onChange={(scale) => {
                    stopAll();
                    const count = scalePositions(tuning.strings, s.root, scale, s.frets).length;
                    const scalePosition = s.scalePosition && s.scalePosition <= count ? s.scalePosition : null;
                    update({ scale, selected: null, scalePosition });
                  }}
                />
              </Field>
              <ChordRow
                chords={diatonicChords(s.root, s.scale)}
                selected={s.selected?.src === "key" ? s.selected.degree : null}
                sevenths={s.sevenths}
                onSelect={(degree) => {
                  update({ selected: degree ? { src: "key", degree } : null });
                  if (degree) {
                    const c = diatonicChords(s.root, s.scale)[degree - 1];
                    strumChord(c.root, s.sevenths ? c.seventh : c.triad);
                  }
                }}
                onSevenths={(sevenths) => update({ sevenths })}
              />
            </>
          )}
        </section>

        <section className="panel settings">
          <h2>Neck</h2>
          <Field label="Tuning">
            <select value={s.tuningId} onChange={(e) => update({ tuningId: e.target.value })}>
              {TUNINGS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          {!standard && <p className="help small">Chord shapes are worked out for this tuning. CAGED names only apply to standard tuning.</p>}
          <div className="field-row">
            <Field label="Frets">
              <select
                value={s.frets}
                onChange={(e) => {
                  const frets = Number(e.target.value);
                  update({ frets, fretMin: Math.min(s.fretMin, frets), fretMax: frets });
                }}
              >
                {FRET_COUNTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Focus from">
              <select value={s.fretMin} onChange={(e) => update({ fretMin: Math.min(Number(e.target.value), s.fretMax) })}>
                {fretOptions.map((f) => (
                  <option key={f} value={f}>
                    {f === 0 ? "Open" : f}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="to">
              <select value={s.fretMax} onChange={(e) => update({ fretMax: Math.max(Number(e.target.value), s.fretMin) })}>
                {fretOptions.map((f) => (
                  <option key={f} value={f}>
                    {f === 0 ? "Open" : f}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="toggles">
            <Toggle label="Left-handed" checked={s.leftHanded} onChange={(leftHanded) => update({ leftHanded })} />
            <Toggle label="High string on top" checked={s.highStringTop} onChange={(highStringTop) => update({ highStringTop })} />
            <Toggle label="Realistic fret spacing" checked={s.realSpacing} onChange={(realSpacing) => update({ realSpacing })} />
          </div>
          <button type="button" className="link" onClick={() => { stop(); reset(); }}>
            Reset all settings
          </button>
        </section>
      </div>
    </div>
  );
}
