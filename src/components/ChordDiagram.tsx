import { chroma, pretty } from "../theory/notes";
import type { Tone } from "../theory/tones";
import type { Voicing } from "../theory/voicings";
import { DEGREE_COLORS } from "../view";

interface Props {
  voicing: Voicing;
  /** Open-string notes, lowest first (used for interval labels). */
  strings: string[];
  tones: Map<number, Tone>;
  size?: "sm" | "lg";
  leftHanded?: boolean;
  /** Show finger numbers in the dots (otherwise intervals). */
  fingers?: boolean;
}

/** A classic vertical chord chart: strings run top to bottom, lowest string on the left. */
export function ChordDiagram({ voicing, strings, tones, size = "lg", leftHanded = false, fingers = true }: Props) {
  const n = strings.length;
  const lg = size === "lg";
  const sg = lg ? 26 : 15; // string gap
  const fh = lg ? 30 : 17; // fret height
  const padX = lg ? 40 : 20;
  const top = lg ? 30 : 16;
  const r = lg ? 10.5 : 6;
  const shown = Math.max(4, voicing.maxFret - Math.max(voicing.minFret, 1) + 1);
  const start = voicing.maxFret <= 4 ? 1 : voicing.minFret;
  const width = padX * 2 + sg * (n - 1);
  const height = top + fh * shown + (lg ? 26 : 4);
  const x = (s: number) => padX + (leftHanded ? n - 1 - s : s) * sg;
  const y = (fret: number) => top + (fret - start + 0.5) * fh;

  const toneAt = (s: number, f: number): Tone | undefined => tones.get((chroma(strings[s]) + f) % 12);

  return (
    <svg
      className={`diagram ${size}`}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label="Chord diagram"
    >
      {/* Nut (only when the chart starts at the first fret) */}
      {start === 1 && <rect x={padX - 2} y={top - 5} width={sg * (n - 1) + 4} height={5} rx={1.5} fill="#e8e2d4" />}

      {/* Fret lines */}
      {Array.from({ length: shown + 1 }, (_, i) => (
        <line key={`f${i}`} x1={padX} x2={padX + sg * (n - 1)} y1={top + i * fh} y2={top + i * fh} stroke="#596070" strokeWidth={1.2} />
      ))}
      {/* Strings */}
      {strings.map((_, s) => (
        <line key={`s${s}`} x1={x(s)} x2={x(s)} y1={top} y2={top + shown * fh} stroke="#8b919c" strokeWidth={lg ? 1.4 : 1} />
      ))}

      {/* Open / muted markers */}
      {voicing.frets.map((f, s) =>
        f === 0 ? (
          <circle key={`o${s}`} cx={x(s)} cy={top - (lg ? 14 : 9)} r={lg ? 6 : 3.6} fill="none" stroke="#cfd3da" strokeWidth={1.5} />
        ) : f < 0 ? (
          <text key={`m${s}`} x={x(s)} y={top - (lg ? 13 : 8.5)} className="diagram-mute" textAnchor="middle" dominantBaseline="central" fontSize={lg ? 15 : 10}>
            ×
          </text>
        ) : null,
      )}

      {/* Barre */}
      {voicing.barre && (
        <rect
          x={Math.min(x(voicing.barre.from), x(voicing.barre.to)) - r}
          y={y(voicing.barre.fret) - r}
          width={Math.abs(x(voicing.barre.to) - x(voicing.barre.from)) + r * 2}
          height={r * 2}
          rx={r}
          fill="#e8eaee"
          opacity={0.9}
        />
      )}

      {/* Fretted notes */}
      {voicing.frets.map((f, s) => {
        if (f <= 0) return null;
        const tone = toneAt(s, f);
        const fill = tone ? DEGREE_COLORS[tone.degree] : "#e8eaee";
        const label = fingers ? String(voicing.fingers[s] || "") : tone ? pretty(tone.label) : "";
        return (
          <g key={`d${s}`}>
            <circle cx={x(s)} cy={y(f)} r={r} fill={fill} stroke={tone?.isRoot ? "#fff7e6" : "#111318"} strokeWidth={tone?.isRoot ? 2 : 1} />
            {lg && label && (
              <text x={x(s)} y={y(f)} textAnchor="middle" dominantBaseline="central" className="diagram-finger">
                {label}
              </text>
            )}
          </g>
        );
      })}

      {/* Starting fret number, drawn last so a barre can't cover it */}
      {start > 1 && (
        <text
          x={leftHanded ? width - padX + r + 4 : padX - r - 4}
          y={y(start)}
          className="diagram-pos"
          fontSize={lg ? 13 : 9}
          textAnchor={leftHanded ? "start" : "end"}
          dominantBaseline="central"
        >
          {lg ? `${start}fr` : start}
        </text>
      )}

      {/* Interval under each sounding string */}
      {lg &&
        voicing.frets.map((f, s) => {
          if (f < 0) return null;
          const tone = toneAt(s, f);
          return (
            <text
              key={`i${s}`}
              x={x(s)}
              y={top + shown * fh + 15}
              textAnchor="middle"
              dominantBaseline="central"
              className="diagram-ivl"
              fill={tone ? DEGREE_COLORS[tone.degree] : "#9aa1ad"}
            >
              {tone ? pretty(tone.label) : ""}
            </text>
          );
        })}
    </svg>
  );
}
