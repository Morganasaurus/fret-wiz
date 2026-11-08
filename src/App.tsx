import { useEffect, useMemo, useState } from "react";
import { playSequence, pluck, stopAll, strum } from "./audio";
import { CatalogSelect, ChordRow, IntervalGuide, Legend, RootPicker, Segmented } from "./components/Controls";
import { Fretboard } from "./components/Fretboard";
import { GearIcon, SidebarIcon, SpeakerIcon } from "./components/Icons";
import { ScalePicker, ShapeBar } from "./components/ScaleTools";
import { CheckList, Group, SettingsSheet, Sidebar } from "./components/Shell";
import { KeyWorkshop, KeysWithChord, type Playback, ShapePanel, shapesFor } from "./components/Workshop";
import { type LabelStyle, type Mode, useMediaQuery, useSettings } from "./state";
import { CHORDS } from "./theory/catalog";
import { type ChordRef, type KeyQuality, keysContaining, resolveRef } from "./theory/harmony";
import { midi, nameForChroma, pretty } from "./theory/notes";
import { allCopies, positionKey, scalePositions } from "./theory/positions";
import { chordTones, diatonicChords } from "./theory/tones";
import { getTuning } from "./theory/tunings";
import { voicingMidi } from "./theory/voicings";
import { buildView, isMinorContext } from "./view";

const SEVENTH_TYPES = ["maj7", "7", "m7", "m7b5", "dim7", "mMaj7"];

export default function App() {
  const { settings: s, update, reset } = useSettings();
  const tuning = getTuning(s.tuningId);
  const standard = tuning.id === "standard";
  const view = useMemo(() => buildView(s), [s]);

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

  // ---- appearance (follows the iPad's light/dark setting unless overridden) ----
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const dark = s.appearance === "dark" || (s.appearance === "system" && systemDark);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("theme-dark", dark);
    root.classList.toggle("theme-light", !dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#000000" : "#f2f2f7");
  }, [dark]);

  // ---- sidebar: remembered on wide screens, slides over (and starts hidden) on narrow ones ----
  const narrow = useMediaQuery("(max-width: 900px)");
  const [overlayOpen, setOverlayOpen] = useState(false);
  const sidebarOpen = narrow ? overlayOpen : s.sidebarOpen;
  const toggleSidebar = () => (narrow ? setOverlayOpen((o) => !o) : update({ sidebarOpen: !s.sidebarOpen }));
  const [settingsOpen, setSettingsOpen] = useState(false);

  const labelOptions: { value: LabelStyle; label: string }[] =
    s.mode === "notes"
      ? [
          { value: "name", label: "Notes" },
          { value: "none", label: "Off" },
        ]
      : [
          { value: "name", label: "Notes" },
          { value: "interval", label: "Intervals" },
          { value: "none", label: "Off" },
        ];

  const rootPicker = (label: string, minor: boolean) => (
    <Group title={label}>
      <RootPicker root={s.root} minor={minor} onChange={(root) => update({ root })} />
    </Group>
  );

  return (
    <div className={`shell ${sidebarOpen ? "sidebar-open" : ""} ${narrow ? "narrow" : ""}`}>
      <Sidebar
        open={sidebarOpen}
        mode={s.mode}
        onMode={changeMode}
        onSettings={() => {
          setSettingsOpen(true);
          if (narrow) setOverlayOpen(false);
        }}
      >
        {s.mode === "key" && (
          <>
            {rootPicker("Key", s.keyMode === "minor")}
            <Group>
              <Segmented<KeyQuality>
                label="Major or minor"
                full
                value={s.keyMode}
                options={[
                  { value: "major", label: "Major" },
                  { value: "minor", label: "Minor" },
                ]}
                onChange={(keyMode) => {
                  stop();
                  update({ keyMode, selected: null });
                }}
              />
            </Group>
          </>
        )}
        {s.mode === "chord" && (
          <>
            {rootPicker("Root", isMinorContext(s))}
            <Group title="Chord type">
              <CatalogSelect items={CHORDS} value={s.chord} onChange={(chord) => update({ chord })} />
            </Group>
          </>
        )}
        {s.mode === "scale" && (
          <>
            {rootPicker("Root", isMinorContext(s))}
            <Group title="Scale">
              <ScalePicker
                value={s.scale}
                onChange={(scale) => {
                  stopAll();
                  const count = scalePositions(tuning.strings, s.root, scale, s.frets).length;
                  const scalePosition = s.scalePosition && s.scalePosition <= count ? s.scalePosition : null;
                  update({ scale, selected: null, scalePosition });
                }}
              />
            </Group>
          </>
        )}
        {s.mode === "notes" && (
          <>
            <Group title="Show">
              <CheckList
                value={s.notesFilter}
                options={[
                  { value: "all", label: "All notes" },
                  { value: "naturals", label: "Natural notes", detail: "A–G" },
                  { value: "one", label: "One note", detail: "everywhere" },
                ]}
                onChange={(notesFilter) => update({ notesFilter })}
              />
            </Group>
            {s.notesFilter === "one" ? (
              rootPicker("Note", false)
            ) : (
              <Group title="Accidentals">
                <Segmented
                  label="Accidentals"
                  full
                  value={s.preferFlats ? "flat" : "sharp"}
                  options={[
                    { value: "sharp", label: "Sharps ♯" },
                    { value: "flat", label: "Flats ♭" },
                  ]}
                  onChange={(v) => update({ preferFlats: v === "flat" })}
                />
              </Group>
            )}
          </>
        )}
      </Sidebar>
      {narrow && sidebarOpen && <div className="scrim" onClick={() => setOverlayOpen(false)} />}

      <div className="main">
        <header className="toolbar">
          <button
            type="button"
            className="icon-button"
            aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            aria-pressed={sidebarOpen}
            onClick={toggleSidebar}
          >
            <SidebarIcon />
          </button>
          <div className="toolbar-spacer" />
          {s.mode === "key" && s.selected && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                stop();
                update({ selected: null });
              }}
            >
              Show whole key
            </button>
          )}
          <Segmented<LabelStyle>
            label="Labels"
            value={s.mode === "notes" && s.labels === "interval" ? "name" : s.labels}
            options={labelOptions}
            onChange={(labels) => update({ labels })}
          />
          <button
            type="button"
            className={`icon-button ${s.sound ? "" : "off"}`}
            aria-label={s.sound ? "Sound on" : "Sound off"}
            aria-pressed={s.sound}
            onClick={() => {
              if (s.sound) stopAll();
              update({ sound: !s.sound });
            }}
          >
            <SpeakerIcon on={s.sound} />
          </button>
          <button type="button" className="icon-button" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
            <GearIcon />
          </button>
        </header>

        <div className="page">
          <div className="title-block">
            <h1 className="large-title">{view.title}</h1>
            <p className="subtitle">{view.subtitle}</p>
          </div>

          <section className="card neck-card">
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
            <div className="legend-row">
              <Legend tones={view.legend} />
            </div>
            <IntervalGuide tones={view.legend} />
          </section>

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

          {s.mode === "key" && view.key && (
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

          {s.mode === "chord" && (
            <section className="page-section">
              <div className="section-head">
                <h3>Keys with {view.chord ? pretty(view.chord.symbol) : "this chord"}</h3>
              </div>
              <p className="help">Tap a key to start writing with this chord in it.</p>
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
            </section>
          )}

          {s.mode === "scale" && (
            <section className="page-section">
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
            </section>
          )}
        </div>
      </div>

      {settingsOpen && (
        <SettingsSheet
          s={s}
          update={update}
          onReset={() => {
            stop();
            reset();
            setSettingsOpen(false);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
