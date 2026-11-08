import { useEffect, useRef, useState } from "react";
import { startMetronome, stopMetronome, useMetronome } from "../metronome";
import {
  BPM_MAX,
  BPM_MIN,
  type Subdivision,
  type TrainerSettings,
  formatDuration,
  normalizeTrainer,
  rampSteps,
  timeToTarget,
} from "../trainer";
import { Segmented } from "./Controls";
import { CloseIcon } from "./Icons";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** − value + with press-and-hold to keep changing, and typing allowed. */
function Stepper({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const latest = useRef(value);
  latest.current = value;
  const timers = useRef<number[]>([]);
  const release = () => {
    timers.current.forEach((id) => {
      clearTimeout(id);
      clearInterval(id);
    });
    timers.current = [];
  };
  useEffect(() => release, []);
  const bump = (d: number) => {
    const next = Math.min(max, Math.max(min, latest.current + d));
    latest.current = next;
    onChange(next);
  };
  const hold = (d: number) => {
    release();
    bump(d);
    timers.current.push(window.setTimeout(() => timers.current.push(window.setInterval(() => bump(d), 70)), 420));
  };
  const commit = () => {
    if (draft !== null && draft !== "") onChange(Math.min(max, Math.max(min, Number(draft))));
    setDraft(null);
  };
  const button = (d: number, text: string, name: string) => (
    <button
      type="button"
      className="stepper-btn"
      aria-label={`${label} ${name}`}
      disabled={d < 0 ? value <= min : value >= max}
      onPointerDown={(e) => {
        e.preventDefault();
        hold(d);
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onClick={(e) => {
        if (e.detail === 0) bump(d); // keyboard
      }}
    >
      {text}
    </button>
  );
  return (
    <div className="metro-field">
      <span className="metro-label">{label}</span>
      <div className="stepper">
        {button(-1, "−", "down")}
        <input
          type="text"
          inputMode="numeric"
          aria-label={label}
          value={draft ?? String(value)}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 3))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        {unit && <span className="stepper-unit">{unit}</span>}
        {button(1, "+", "up")}
      </div>
    </div>
  );
}

/** Metronome with a speed trainer: start slow, step up a few BPM every few bars until the target. */
export function MetronomeCard({
  t,
  onChange,
  onClose,
  desktop,
}: {
  t: TrainerSettings;
  onChange: (t: TrainerSettings) => void;
  onClose: () => void;
  desktop: boolean;
}) {
  const m = useMetronome();
  const [setup, setSetup] = useState(!m.running);
  // Fold the setup away once it's running (however it was started), to keep the neck in view.
  useEffect(() => {
    if (m.running) setSetup(false);
  }, [m.running]);
  const set =(patch: Partial<TrainerSettings>) => onChange(normalizeTrainer({ ...t, ...patch }));
  const toggle = () => {
    if (m.running) stopMetronome();
    else startMetronome(t);
  };

  const point = m.running ? m.point : null;
  const bpm = point?.bpm ?? t.start;
  const steps = rampSteps(t);
  const sign = t.target >= t.start ? "+" : "−";
  const progress = !t.speedUp || !steps ? (m.running ? 1 : 0) : point ? Math.min(1, (point.step + (point.atTarget ? 0 : point.barInStep / t.barsPerStep)) / steps) : 0;

  let status: string;
  if (point && t.speedUp && steps) {
    status = point.atTarget
      ? t.atTarget === "restart"
        ? `Target reached. Back to ${t.start} in ${plural(point.barsLeft, "bar")}`
        : `At your target, ${t.target} BPM. Keep it clean!`
      : `Step ${point.step + 1} of ${steps + 1} · ${sign}${t.step} BPM in ${plural(point.barsLeft, "bar")}`;
  } else if (m.running) {
    status = `Bar ${m.bar + 1} · ${formatDuration(m.elapsed)}`;
  } else if (m.peak) {
    status = `Last run: ${t.speedUp ? `reached ${m.peak} BPM` : `${m.peak} BPM`} in ${formatDuration(m.elapsed)}`;
  } else if (t.speedUp && steps) {
    status = `${t.start} → ${t.target} BPM in ${plural(steps, "step")}, about ${formatDuration(timeToTarget(t))} to the target`;
  } else {
    status = `${t.start} BPM, ${t.beatsPerBar}/4`;
  }

  return (
    <section className={`card metro-card ${m.running ? "running" : ""}`} aria-label="Metronome">
      <div className="metro-main">
        <button type="button" className="round-play metro-play" aria-label={m.running ? "Stop metronome" : "Start metronome"} onClick={toggle}>
          {m.running ? "■" : "▶"}
        </button>
        <div className="metro-tempo" aria-live="off">
          <span className="metro-bpm">{bpm}</span>
          <span className="metro-unit">BPM</span>
        </div>
        <div className="metro-beats" aria-hidden>
          {Array.from({ length: t.beatsPerBar }, (_, i) => (
            <span key={i} className={`metro-beat ${i === 0 ? "accent" : ""} ${m.running && m.beat === i ? "on" : ""}`} />
          ))}
        </div>
        <div className="metro-status">
          <span>{status}</span>
          {t.speedUp && steps > 0 && (
            <div className="metro-progress" aria-hidden>
              <div style={{ width: `${progress * 100}%` }} />
              <span className="metro-ends">
                <span>{t.start}</span>
                <span>{t.target}</span>
              </span>
            </div>
          )}
        </div>
        <button type="button" className="text-button bold" aria-expanded={setup} onClick={() => setSetup((v) => !v)}>
          {setup ? "Done" : "Set up"}
        </button>
        <button type="button" className="icon-button" aria-label="Hide metronome" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      {setup && (
        <div className="metro-setup">
          <div className="metro-field">
            <span className="metro-label">Mode</span>
            <Segmented
              label="Mode"
              value={t.speedUp ? "up" : "steady"}
              options={[
                { value: "up", label: "Speed trainer" },
                { value: "steady", label: "Steady" },
              ]}
              onChange={(v) => set({ speedUp: v === "up" })}
            />
          </div>
          <Stepper label={t.speedUp ? "Start" : "Tempo"} value={t.start} min={BPM_MIN} max={BPM_MAX} unit="BPM" onChange={(start) => set({ start })} />
          {t.speedUp && (
            <>
              <Stepper label="Target" value={t.target} min={BPM_MIN} max={BPM_MAX} unit="BPM" onChange={(target) => set({ target })} />
              <Stepper label="Speed up by" value={t.step} min={1} max={50} unit="BPM" onChange={(step) => set({ step })} />
              <Stepper label="Every" value={t.barsPerStep} min={1} max={64} unit={t.barsPerStep === 1 ? "bar" : "bars"} onChange={(barsPerStep) => set({ barsPerStep })} />
              <div className="metro-field">
                <span className="metro-label">At the target</span>
                <Segmented
                  label="At the target"
                  value={t.atTarget}
                  options={[
                    { value: "hold", label: "Keep going" },
                    { value: "restart", label: "Start again" },
                  ]}
                  onChange={(atTarget) => set({ atTarget })}
                />
              </div>
            </>
          )}
          <div className="metro-field">
            <span className="metro-label">Time</span>
            <Segmented
              label="Time signature"
              value={String(t.beatsPerBar)}
              options={[2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}/4` }))}
              onChange={(v) => set({ beatsPerBar: Number(v) })}
            />
          </div>
          <div className="metro-field">
            <span className="metro-label">Clicks</span>
            <Segmented
              label="Clicks per beat"
              value={String(t.subdivision)}
              options={[
                { value: "1", label: "Beats" },
                { value: "2", label: "8ths" },
                { value: "3", label: "Triplets" },
                { value: "4", label: "16ths" },
              ]}
              onChange={(v) => set({ subdivision: Number(v) as Subdivision })}
            />
          </div>
          <label className="metro-field">
            <span className="metro-label">Volume</span>
            <input
              type="range"
              className="metro-volume"
              min={0}
              max={1}
              step={0.05}
              value={t.volume}
              onChange={(e) => set({ volume: Number(e.target.value) })}
            />
          </label>
          <p className="help small metro-tip">
            {t.speedUp
              ? "Start where you can play it cleanly. Each step adds a little speed; if it falls apart, stop and set the start a few BPM lower. "
              : ""}
            The first beat of each bar clicks higher. For 6/8, use 2/4 with triplets.
            {desktop ? " Press M to start or stop." : ""}
          </p>
        </div>
      )}
    </section>
  );
}
