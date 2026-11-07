import { useMemo } from "react";
import { DOUBLE_INLAYS, type FretPosition, SINGLE_INLAYS, buildFretboard, fretWirePositions } from "../theory/fretboard";
import { pretty } from "../theory/notes";
import type { Dot } from "../view";

interface Props {
  strings: string[];
  frets: number;
  dots: Map<number, Dot>;
  fretMin: number;
  fretMax: number;
  leftHanded: boolean;
  highStringTop: boolean;
  realSpacing: boolean;
  /** A chord shape to emphasise (fret per string, -1 = muted). Other dots fade. */
  voicing?: number[] | null;
  onPick?: (pos: FretPosition) => void;
}

const W = 1200;
const STRING_GAP = 46;
const PAD_Y = 30;
const LABEL_W = 34;
const OPEN_W = 58;
const PAD_RIGHT = 16;
const NUMBERS_H = 30;

export function Fretboard(props: Props) {
  const { strings, frets, dots, fretMin, fretMax, leftHanded, highStringTop, realSpacing, voicing, onPick } = props;
  const n = strings.length;
  const boardTop = PAD_Y;
  const boardH = STRING_GAP * (n - 1);
  const H = boardTop + boardH + PAD_Y + NUMBERS_H;
  const nutX = LABEL_W + OPEN_W;
  const boardW = W - nutX - PAD_RIGHT;

  const wires = useMemo(
    () => fretWirePositions(frets, realSpacing ? 0.55 : 0).map((p) => nutX + p * boardW),
    [frets, realSpacing, nutX, boardW],
  );
  const positions = useMemo(() => buildFretboard(strings, frets), [strings, frets]);

  /** Mirror horizontally for left-handed players without flipping text. */
  const X = (x: number) => (leftHanded ? W - x : x);
  const rowY = (s: number) => boardTop + (highStringTop ? n - 1 - s : s) * STRING_GAP;
  const fretCenter = (f: number) => (f === 0 ? LABEL_W + OPEN_W / 2 - 4 : (wires[f - 1] + wires[f]) / 2);
  const fretWidth = (f: number) => (f === 0 ? OPEN_W : wires[f] - wires[f - 1]);
  const inRange = (f: number) => f >= fretMin && f <= fretMax;
  const midY = boardTop + boardH / 2;

  return (
    <svg
      className="fretboard"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Guitar fretboard"
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      <defs>
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2a1e" />
          <stop offset="0.5" stopColor="#44301f" />
          <stop offset="1" stopColor="#36271b" />
        </linearGradient>
      </defs>

      {/* Neck */}
      <rect
        x={Math.min(X(nutX), X(W - PAD_RIGHT))}
        y={boardTop - 16}
        width={boardW}
        height={boardH + 32}
        rx={4}
        fill="url(#wood)"
      />

      {/* Out-of-range shading */}
      {wires.slice(1).map((_, i) => {
        const f = i + 1;
        if (inRange(f)) return null;
        const x1 = X(wires[f - 1]);
        const x2 = X(wires[f]);
        return (
          <rect
            key={`shade-${f}`}
            x={Math.min(x1, x2)}
            y={boardTop - 16}
            width={Math.abs(x2 - x1)}
            height={boardH + 32}
            fill="#0b0c0f"
            opacity={0.55}
          />
        );
      })}

      {/* Inlays */}
      {SINGLE_INLAYS.filter((f) => f <= frets).map((f) => (
        <circle key={`in-${f}`} cx={X(fretCenter(f))} cy={midY} r={7} fill="#d9cbb3" opacity={0.35} />
      ))}
      {DOUBLE_INLAYS.filter((f) => f <= frets).map((f) => (
        <g key={`in-${f}`} fill="#d9cbb3" opacity={0.35}>
          <circle cx={X(fretCenter(f))} cy={boardTop + boardH * 0.25} r={7} />
          <circle cx={X(fretCenter(f))} cy={boardTop + boardH * 0.75} r={7} />
        </g>
      ))}

      {/* Fret wires and nut */}
      {wires.map((x, f) => (
        <line
          key={`w-${f}`}
          x1={X(x)}
          x2={X(x)}
          y1={boardTop - 16}
          y2={boardTop + boardH + 16}
          stroke={f === 0 ? "#e8e2d4" : "#9aa0a8"}
          strokeWidth={f === 0 ? 7 : 2.5}
        />
      ))}

      {/* Strings */}
      {strings.map((open, s) => {
        const y = rowY(s);
        const thickness = 1 + ((n - 1 - s) / Math.max(1, n - 1)) * 2.4;
        return (
          <g key={`s-${s}`}>
            <line x1={X(LABEL_W + 8)} x2={X(W - PAD_RIGHT)} y1={y} y2={y} stroke="#cfd3da" strokeWidth={thickness} opacity={0.85} />
            <text x={X(LABEL_W / 2)} y={y} className="string-label" textAnchor="middle" dominantBaseline="central">
              {pretty(open.replace(/\d+$/, ""))}
            </text>
          </g>
        );
      })}

      {/* Fret numbers */}
      {wires.map((_, f) => {
        const marked = f === 0 || SINGLE_INLAYS.includes(f) || DOUBLE_INLAYS.includes(f);
        return (
          <text
            key={`num-${f}`}
            x={X(fretCenter(f))}
            y={boardTop + boardH + 16 + NUMBERS_H / 2 + 4}
            textAnchor="middle"
            dominantBaseline="central"
            className={marked ? "fret-num marked" : "fret-num"}
          >
            {f}
          </text>
        );
      })}

      {/* Strings not played in the current shape */}
      {voicing?.map((f, s) =>
        f < 0 ? (
          <text
            key={`mute-${s}`}
            x={X(fretCenter(0))}
            y={rowY(s)}
            textAnchor="middle"
            dominantBaseline="central"
            className="mute-mark"
          >
            ×
          </text>
        ) : null,
      )}

      {/* Notes */}
      {positions.map((p) => {
        const dot = dots.get(p.chroma);
        const cx = X(fretCenter(p.fret));
        const cy = rowY(p.string);
        const hit = (
          <rect
            x={cx - fretWidth(p.fret) / 2}
            y={cy - STRING_GAP / 2}
            width={fretWidth(p.fret)}
            height={STRING_GAP}
            fill="transparent"
          />
        );
        if (!dot || (voicing && voicing[p.string] < 0 && p.fret === 0)) {
          return (
            <g key={`${p.string}-${p.fret}`} className="pos" onClick={() => onPick?.(p)}>
              {hit}
            </g>
          );
        }
        const inShape = voicing ? voicing[p.string] === p.fret : false;
        const faded = voicing ? !inShape : false;
        const maxR = inShape ? 18 : dot.primary && !faded ? 17 : 12;
        const r = Math.max(8, Math.min(maxR, fretWidth(p.fret) * (inShape ? 0.44 : 0.4)));
        const dim = !inRange(p.fret);
        const fontSize = Math.min(r * 0.95, dot.label.length > 2 ? r * 0.78 : r);
        return (
          <g
            key={`${p.string}-${p.fret}`}
            className="pos"
            opacity={dim ? 0.18 : faded ? (dot.primary ? 0.32 : 0.22) : 1}
            onClick={() => onPick?.(p)}
          >
            {inShape && <circle cx={cx} cy={cy} r={r + 6} fill={dot.fill} opacity={0.25} />}
            {hit}
            {dot.root && <circle cx={cx} cy={cy} r={r + 3.5} fill="none" stroke={dot.fill} strokeWidth={2.5} />}
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={dot.fill}
              stroke={dot.root ? "#fff7e6" : "#0b0c0f"}
              strokeWidth={dot.root ? 2 : 1.5}
            />
            {dot.label && (
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                className="dot-label"
                fill={dot.ink}
                fontSize={fontSize}
                fontWeight={dot.root ? 800 : 650}
              >
                {dot.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
