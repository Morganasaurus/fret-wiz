import { type ReactNode, useEffect } from "react";
import type { Mode, Settings } from "../state";
import { TUNINGS } from "../theory/tunings";
import { ChordsIcon, GearIcon, KeysIcon, NotesIcon, ScalesIcon } from "./Icons";

export const MODES: { value: Mode; label: string; icon: () => ReactNode }[] = [
  { value: "key", label: "Keys & Songwriting", icon: KeysIcon },
  { value: "chord", label: "Chords", icon: ChordsIcon },
  { value: "scale", label: "Scales", icon: ScalesIcon },
  { value: "notes", label: "Notes", icon: NotesIcon },
];

/** iPad-style sidebar: app title, modes, the current mode's pickers, Settings at the bottom. */
export function Sidebar({
  open,
  mode,
  onMode,
  onSettings,
  children,
}: {
  open: boolean;
  mode: Mode;
  onMode: (m: Mode) => void;
  onSettings: () => void;
  children: ReactNode;
}) {
  return (
    <aside className={`sidebar ${open ? "open" : ""}`} aria-hidden={!open} inert={!open}>
      <div className="sidebar-scroll">
        <h1 className="app-title">Fret Wiz</h1>
        <nav className="nav-list">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              className={`nav-row ${m.value === mode ? "active" : ""}`}
              aria-current={m.value === mode ? "page" : undefined}
              onClick={() => onMode(m.value)}
            >
              <m.icon />
              {m.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-context">{children}</div>
      </div>
      <button type="button" className="nav-row settings-row" onClick={onSettings}>
        <GearIcon />
        Settings
      </button>
    </aside>
  );
}

/** A titled group inside the sidebar or a sheet. */
export function Group({ title, children, footer }: { title?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="group">
      {title && <h2 className="group-title">{title}</h2>}
      <div className="group-body">{children}</div>
      {footer && <p className="group-footer">{footer}</p>}
    </section>
  );
}

/** iOS-style list of options with a checkmark on the chosen one. */
export function CheckList<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; detail?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="check-list" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? "checked" : ""}
          onClick={() => onChange(o.value)}
        >
          <span>{o.label}</span>
          {o.detail && <span className="detail">{o.detail}</span>}
        </button>
      ))}
    </div>
  );
}

/** iOS switch. */
export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="list-row switch-row" onClick={() => onChange(!checked)}>
      <span>{label}</span>
      <span className={`switch ${checked ? "on" : ""}`}>
        <span className="knob" />
      </span>
    </button>
  );
}

const FRET_COUNTS = [12, 15, 19, 21, 22, 24];

/** Form sheet with appearance, sound and neck options. */
export function SettingsSheet({
  s,
  update,
  onReset,
  onClose,
}: {
  s: Settings;
  update: (patch: Partial<Settings>) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fretOptions = Array.from({ length: s.frets + 1 }, (_, i) => i);
  const standard = s.tuningId === "standard";

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-header">
          <span />
          <h2>Settings</h2>
          <button type="button" className="text-button bold" onClick={onClose}>
            Done
          </button>
        </header>
        <div className="sheet-body">
          <Group title="Appearance">
            <div className="list-row">
              <div className="seg seg-full" role="radiogroup" aria-label="Appearance">
                {(["system", "light", "dark"] as const).map((a) => (
                  <button key={a} type="button" role="radio" aria-checked={s.appearance === a} className={s.appearance === a ? "on" : ""} onClick={() => update({ appearance: a })}>
                    {a === "system" ? "Automatic" : a === "light" ? "Light" : "Dark"}
                  </button>
                ))}
              </div>
            </div>
          </Group>

          <Group title="Sound">
            <Switch label="Play sounds" checked={s.sound} onChange={(sound) => update({ sound })} />
          </Group>

          <Group
            title="Neck"
            footer={!standard ? "Chord shapes are worked out for this tuning. CAGED names only apply to standard tuning." : undefined}
          >
            <label className="list-row">
              <span>Tuning</span>
              <select value={s.tuningId} onChange={(e) => update({ tuningId: e.target.value })}>
                {TUNINGS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="list-row">
              <span>Frets</span>
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
            </label>
            <label className="list-row">
              <span>Focus from fret</span>
              <select value={s.fretMin} onChange={(e) => update({ fretMin: Math.min(Number(e.target.value), s.fretMax) })}>
                {fretOptions.map((f) => (
                  <option key={f} value={f}>
                    {f === 0 ? "Open" : f}
                  </option>
                ))}
              </select>
            </label>
            <label className="list-row">
              <span>Focus to fret</span>
              <select value={s.fretMax} onChange={(e) => update({ fretMax: Math.max(Number(e.target.value), s.fretMin) })}>
                {fretOptions.map((f) => (
                  <option key={f} value={f}>
                    {f === 0 ? "Open" : f}
                  </option>
                ))}
              </select>
            </label>
            <Switch label="Left-handed" checked={s.leftHanded} onChange={(leftHanded) => update({ leftHanded })} />
            <Switch label="High string on top" checked={s.highStringTop} onChange={(highStringTop) => update({ highStringTop })} />
            <Switch label="Realistic fret spacing" checked={s.realSpacing} onChange={(realSpacing) => update({ realSpacing })} />
          </Group>

          <Group footer="Settings and your progression are saved on this device only.">
            <button type="button" className="list-row destructive" onClick={onReset}>
              Reset All Settings
            </button>
          </Group>
        </div>
      </div>
    </div>
  );
}

