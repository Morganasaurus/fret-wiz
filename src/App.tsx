import { useEffect, useMemo, useRef, useState } from "react";
import { playSequence, pluck, stopAll, strum } from "./audio";
import { CatalogSelect, ChordRow, IntervalGuide, Legend, RootPicker, Segmented } from "./components/Controls";
import { HearingCard, InspectorPlaceholder, ShortcutsCard, Transport } from "./components/Desktop";
import { Fretboard } from "./components/Fretboard";
import { GearIcon, SidebarIcon, SpeakerIcon } from "./components/Icons";
import { ScalePicker, ShapeBar } from "./components/ScaleTools";
import { CheckList, Group, SettingsSheet, Sidebar } from "./components/Shell";
import { KeyWorkshop, KeysWithChord, type Playback, ShapePanel, shapesFor } from "./components/Workshop";
import { createProgression } from "./progressions";
import { type LabelStyle, type Mode, type Settings, useMediaQuery, useSettings } from "./state";
import { CHORDS } from "./theory/catalog";
import type { FretPosition } from "./theory/fretboard";
import { type ChordRef, type KeyQuality, keyScale, keysContaining, resolveRef } from "./theory/harmony";
import { midi, nameForChroma, pretty } from "./theory/notes";
import { allCopies, positionKey, scalePositions } from "./theory/positions";
import { byChroma, chordTones, diatonicChords, scaleTones } from "./theory/tones";
import { getTuning } from "./theory/tunings";
import { ordinal, voicingMidi } from "./theory/voicings";
import { buildView, isMinorContext } from "./view";

const SEVENTH_TYPES = ["maj7", "7", "m7", "m7b5", "dim7", "mMaj7"];
/** Wide screen used with a mouse: the desktop layout (and true-black dark mode by default, for OLED). */
const DESKTOP_QUERY = "(min-width: 1800px) and (hover: hover) and (pointer: fine)";

export default function App() {
  const { settings: s, update, reset } = useSettings();
  const tuning = getTuning(s.tuningId);
  const standard = tuning.id === "standard";
  const view = useMemo(() => buildView(s), [s]);

  // ---- screen / appearance ----
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const narrow = useMediaQuery("(max-width: 900px)");
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  // Automatic follows the device; on the big desktop layout it prefers dark (OLED-friendly).
  const dark = s.appearance === "dark" || (s.appearance === "system" && (systemDark || desktop));
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("theme-dark", dark);
    root.classList.toggle("theme-light", !dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#000000" : "#f2f2f7");
  }, [dark]);

  // ---- saved progressions ----
  const active = s.progressions.find((p) => p.id === s.activeProgressionId) ?? s.progressions[0];
  const withActive = (patch: Partial<typeof active>): Partial<Settings> => ({
    progressions: s.progressions.map((p) => (p.id === active.id ? { ...p, ...patch } : p)),
  });
  const setSteps = (steps: ChordRef[]) => update(withActive({ steps }));
  // In Keys mode the active progression always lives in the current key (so its chords, the play bar and the
  // sidebar preview agree), whichever way the key was changed.
  useEffect(() => {
    if (s.mode === "key" && (active.tonic !== s.root || active.quality !== s.keyMode)) {
      update(withActive({ tonic: s.root, quality: s.keyMode }));
    }
  }, [s.mode, s.root, s.keyMode, active.id, active.tonic, active.quality]);

  /** Change the key; in Keys mode the active progression moves with it. */
  const setKey = (root: string, keyMode: KeyQuality = s.keyMode) =>
    update({ root, keyMode, ...(s.mode === "key" ? withActive({ tonic: root, quality: keyMode }) : {}) });

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
      }, ${currentPosition.perString} notes on each string${s.scale.includes("blues") ? " plus the blue note" : ""}. Ringed notes are the root. Learn it up and down, then move to the next shape, which overlaps this one.`
    : "";

  // ---- sound ----
  const playPosition = () => {
    if (!s.sound || !currentPosition) return;
    const up = [...new Set(currentPosition.notes.map((n) => n.midi))].sort((a, b) => a - b);
    playSequence([...up, ...up.slice(0, -1).reverse()]);
  };
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
  const pickShape = (index: number) => {
    if (!shapeSet || !shapeSet.shapes[index]) return;
    setShapePick({ id: shapeId, index });
    if (s.sound) strum(voicingMidi(tuning.strings, shapeSet.shapes[index]));
  };

  // ---- progression playback ----
  const [playback, setPlayback] = useState<Playback | null>(null);
  useEffect(() => {
    if (!playback) return;
    const ref = playback.steps[playback.index];
    update({ selected: ref });
    const c = resolveRef(ref, s.root, s.keyMode, s.sevenths);
    if (c) strumChord(c.root, c.type);
    const timer = setTimeout(() => setPlayback((p) => (p ? { ...p, index: (p.index + 1) % p.steps.length } : p)), s.tempo * 1000);
    return () => clearTimeout(timer);
  }, [playback]);

  const stop = () => {
    setPlayback(null);
    stopAll(0.3);
  };
  const playActive = () => {
    if (active.steps.length) setPlayback({ steps: active.steps, index: 0, label: active.name });
  };

  const selectKeyChord = (ref: ChordRef) => {
    setPlayback(null);
    update({ selected: ref });
    const c = resolveRef(ref, s.root, s.keyMode, s.sevenths);
    if (c) strumChord(c.root, c.type);
  };
  const selectScaleChord = (degree: number | null) => {
    update({ selected: degree ? { src: "key", degree } : null });
    if (degree) {
      const c = diatonicChords(s.root, s.scale)[degree - 1];
      strumChord(c.root, s.sevenths ? c.seventh : c.triad);
    }
  };

  const changeMode = (mode: Mode) => {
    stop();
    update({ mode, selected: null });
  };

  const loadProgression = (id: string) => {
    const p = s.progressions.find((x) => x.id === id);
    if (!p) return;
    stop();
    update({ activeProgressionId: id, root: p.tonic, keyMode: p.quality, mode: "key", selected: null });
  };
  const newProgression = () => {
    const p = createProgression(s.progressions, s.root, s.keyMode);
    stop();
    update({ progressions: [...s.progressions, p], activeProgressionId: p.id, mode: "key" });
  };
  const renameProgression = () => {
    const name = window.prompt("Name this progression", active.name)?.trim();
    if (name) update(withActive({ name }));
  };
  const deleteProgression = () => {
    if (s.progressions.length < 2 || !window.confirm(`Delete "${active.name}"?`)) return;
    stop();
    const rest = s.progressions.filter((p) => p.id !== active.id);
    update({ progressions: rest, activeProgressionId: rest[0].id, root: rest[0].tonic, keyMode: rest[0].quality });
  };

  // ---- sidebar: remembered on wide screens, slides over (and starts hidden) on narrow ones ----
  const [overlayOpen, setOverlayOpen] = useState(false);
  const sidebarOpen = narrow ? overlayOpen : s.sidebarOpen;
  const toggleSidebar = () => (narrow ? setOverlayOpen((o) => !o) : update({ sidebarOpen: !s.sidebarOpen }));
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ---- hover details on the neck (mouse only) ----
  const context = useMemo(() => {
    if (s.mode === "key") return { tones: byChroma(scaleTones(s.root, keyScale(s.keyMode))), name: `${pretty(s.root)} ${s.keyMode}` };
    if (s.mode === "scale") return { tones: byChroma(scaleTones(s.root, s.scale)), name: view.title };
    return null;
  }, [s.mode, s.root, s.keyMode, s.scale, view.title]);
  const chordMap = useMemo(() => (view.chord ? byChroma(view.chord.tones) : null), [view.chord]);
  /** "b3" -> "♭3rd", "4" -> "4th", root -> "Root". */
  const degreeName = (label: string, isRoot: boolean) =>
    isRoot ? "Root" : pretty(label.replace(/(\d+)$/, (n) => ordinal(Number(n))));
  const describe = (p: FretPosition) => {
    const spelled = chordMap?.get(p.chroma)?.name ?? context?.tones.get(p.chroma)?.name ?? nameForChroma(p.chroma, s.preferFlats);
    const lines: string[] = [];
    if (view.chord && chordMap) {
      const t = chordMap.get(p.chroma);
      lines.push(t ? `${degreeName(t.label, t.isRoot)} of ${pretty(view.chord.symbol)}` : `Not in ${pretty(view.chord.symbol)}`);
    }
    if (context) {
      const t = context.tones.get(p.chroma);
      lines.push(t ? `${degreeName(t.label, t.isRoot)} of ${context.name}` : `Not in ${context.name}`);
    }
    const stringName = pretty(tuning.strings[p.string].replace(/-?\d+$/, ""));
    lines.push(p.fret === 0 ? `${stringName} string, open` : `${stringName} string, fret ${p.fret}`);
    return { title: pretty(spelled), lines };
  };

  // ---- keyboard shortcuts ----
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  onKey.current = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || settingsOpen) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
    const k = e.key;

    if (k === " ") {
      if (s.mode === "scale" && currentPosition && !shape) playPosition();
      else if (shape) strumShown();
      else return;
      e.preventDefault();
      return;
    }
    if (/^[0-9]$/.test(k)) {
      const n = Number(k);
      if (s.mode === "scale" && positions.length) {
        if (n === 0 || n <= positions.length) update({ scalePosition: n === 0 ? null : n });
      } else if (n > 0) pickShape(n - 1);
      e.preventDefault();
      return;
    }
    if (k === "ArrowLeft" || k === "ArrowRight") {
      const dir = k === "ArrowRight" ? 1 : -1;
      const current = s.selected?.src === "key" ? s.selected.degree : 0;
      const next = current ? ((current - 1 + dir + 7) % 7) + 1 : dir > 0 ? 1 : 7;
      if (s.mode === "key") selectKeyChord({ src: "key", degree: next });
      else if (s.mode === "scale" && diatonicChords(s.root, s.scale).length) selectScaleChord(next);
      else return;
      e.preventDefault();
      return;
    }
    const lower = k.toLowerCase();
    if (lower === "s") toggleSidebar();
    else if (lower === "p" && s.mode === "key") (playback?.label === active.name ? stop : playActive)();
    else if (lower === "a" && s.mode === "key" && s.selected) setSteps([...active.steps, s.selected]);
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ---- pieces shared by both layouts ----
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

  const rootPicker = (label: string, minor: boolean, onChange: (root: string) => void = (root) => update({ root })) => (
    <Group title={label}>
      <RootPicker root={s.root} minor={minor} onChange={onChange} />
    </Group>
  );

  const resolveActive = (r: ChordRef) => resolveRef(r, s.root, s.keyMode, s.sevenths);

  const neckCard = (
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
          width={desktop ? 1600 : undefined}
          describe={describe}
          onPick={(p) => {
            if (s.sound) pluck(p.midi);
            if (s.mode === "notes") update({ notesFilter: "one", root: nameForChroma(p.chroma, s.preferFlats) });
          }}
        />
      </div>
      <div className="legend-row">
        <Legend tones={view.legend} />
      </div>
      {!desktop && <IntervalGuide tones={view.legend} />}
    </section>
  );

  const inspector =
    view.chord && shapeSet ? (
      <ShapePanel
        chord={view.chord}
        set={shapeSet}
        index={shapeIndex}
        onIndex={pickShape}
        strings={tuning.strings}
        leftHanded={s.leftHanded}
        onStrum={strumShown}
      />
    ) : null;

  const desktopExtra = (
    <>
      <HearingCard
        tones={view.legend}
        title={view.chord ? `The notes of ${pretty(view.chord.symbol)}:` : s.mode === "notes" ? "" : `The notes of ${view.title}:`}
      />
      <ShortcutsCard mode={s.mode} />
    </>
  );

  const keyWorkshop = view.key && (
    <KeyWorkshop
      tonic={s.root}
      quality={s.keyMode}
      info={view.key}
      sevenths={s.sevenths}
      selected={s.selected}
      progression={active.steps}
      progressionName={active.name}
      onRename={renameProgression}
      onDelete={s.progressions.length > 1 ? deleteProgression : undefined}
      columns={desktop}
      extra={desktopExtra}
      tempo={s.tempo}
      playback={playback}
      strings={tuning.strings}
      standard={standard}
      leftHanded={s.leftHanded}
      onSelect={selectKeyChord}
      onSevenths={(sevenths) => update({ sevenths })}
      onProgression={setSteps}
      onTempo={(tempo) => update({ tempo })}
      onPlay={(steps, label) => {
        if (!steps.length) return;
        setPlayback({ steps, index: 0, label });
      }}
      onStop={stop}
    />
  );

  const chordSection = (
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
  );

  const scaleSection = (
    <section className="page-section">
      <ChordRow
        chords={diatonicChords(s.root, s.scale)}
        selected={s.selected?.src === "key" ? s.selected.degree : null}
        sevenths={s.sevenths}
        onSelect={selectScaleChord}
        onSevenths={(sevenths) => update({ sevenths })}
      />
    </section>
  );

  const modeSection = s.mode === "chord" ? chordSection : s.mode === "scale" ? scaleSection : null;

  const placeholder =
    s.mode === "key" && view.key ? (
      <InspectorPlaceholder
        title={`${pretty(s.root)} ${s.keyMode}`}
        lines={["Pick a chord below to see how to play it: the chord chart and every shape up the neck appear here."]}
      />
    ) : null;

  return (
    <div className={`shell ${sidebarOpen ? "sidebar-open" : ""} ${narrow ? "narrow" : ""} ${desktop ? "desktop" : ""}`}>
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
            {rootPicker("Key", s.keyMode === "minor", (root) => setKey(root))}
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
                  setKey(s.root, keyMode);
                  update({ selected: null });
                }}
              />
            </Group>
            <Group title="My progressions">
              <CheckList
                value={active.id}
                options={s.progressions.map((p) => ({
                  value: p.id,
                  label: p.name,
                  detail: p.steps.length
                    ? p.steps
                        .slice(0, 4)
                        .map((r) => {
                          const c = resolveRef(r, p.tonic, p.quality, false);
                          return c ? pretty(c.symbol) : "?";
                        })
                        .join(" ") + (p.steps.length > 4 ? " …" : "")
                    : "empty",
                }))}
                onChange={loadProgression}
              />
              <button type="button" className="text-button add-row" onClick={newProgression}>
                + New progression
              </button>
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
            title={desktop ? "Show / hide sidebar (S)" : undefined}
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
            <div>
              <h1 className="large-title">{view.title}</h1>
              <p className="subtitle">{view.subtitle}</p>
            </div>
            {desktop && s.mode === "key" && (
              <Transport
                name={active.name}
                steps={active.steps}
                resolve={resolveActive}
                playback={playback}
                tempo={s.tempo}
                onPlay={playActive}
                onStop={stop}
                onTempo={(tempo) => update({ tempo })}
              />
            )}
          </div>

          {desktop ? (
            <>
              <div className={`top-row ${inspector || placeholder ? "" : "solo"}`}>
                {neckCard}
                {inspector ?? placeholder}
              </div>
              {s.mode === "key" ? (
                keyWorkshop
              ) : (
                <div className="desktop-columns">
                  <div>{modeSection}</div>
                  {desktopExtra}
                </div>
              )}
            </>
          ) : (
            <>
              {neckCard}
              {inspector}
              {s.mode === "key" ? keyWorkshop : modeSection}
            </>
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
