import type { ReactNode } from "react";

export type Mood = "happy" | "excited" | "curious" | "sleepy" | "encouraging" | "comforting";
type Props = { size?: number; mood?: Mood; className?: string };

/** Eye that can be open, a closed happy arc, a sleepy line, or a wink. */
function Eye({ cx, cy, kind, open }: { cx: number; cy: number; kind: "open" | "arc" | "line"; open: (cx: number, cy: number) => ReactNode }) {
  if (kind === "arc") return <path d={`M${cx - 5} ${cy + 1} q5 -6 10 0`} stroke="#1B2533" strokeWidth="2.6" fill="none" strokeLinecap="round" />;
  if (kind === "line") return <path d={`M${cx - 5} ${cy + 1} h10`} stroke="#1B2533" strokeWidth="2.4" strokeLinecap="round" />;
  return <g className="eye">{open(cx, cy)}</g>;
}

const eyeKinds = (mood: Mood): ["open" | "arc" | "line", "open" | "arc" | "line"] =>
  mood === "sleepy" ? ["line", "line"] : mood === "comforting" ? ["arc", "arc"] : mood === "encouraging" ? ["arc", "open"] : ["open", "open"];

function Zzz() {
  return (
    <text x="92" y="22" fill="#AAB4C3" fontSize="12" fontWeight="700" fontFamily="Inter, sans-serif">
      z<tspan fontSize="9" dy="-6">z</tspan>
    </text>
  );
}

/** Lei, the Border Collie: the cheerleader. */
export function Dog({ size = 92, mood = "happy", className = "" }: Props) {
  const [l, r] = eyeKinds(mood);
  const collieEye = (cx: number, cy: number) => (
    <>
      <ellipse cx={cx} cy={cy} rx="5" ry="5.6" fill="#FFFFFF" />
      <circle cx={cx + (cx < 60 ? 0.4 : -0.4)} cy={cy + 0.6} r="3.7" fill="#6B4527" />
      <circle cx={cx + (cx < 60 ? 0.4 : -0.4)} cy={cy + 0.6} r="2.1" fill="#14161B" />
      <circle cx={cx + 1.6} cy={cy - 0.8} r="1.1" fill="#fff" />
    </>
  );
  return (
    <svg className={`mascot ${mood === "sleepy" ? "" : "bounce"} ${className}`} width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Lei the Border Collie">
      <g className="tail">
        <path d="M88 94 q20 -2 22 -24" stroke="#363C48" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d="M108.5 75 q1.5 -4 1.5 -7" stroke="#F7F8FB" strokeWidth="8" fill="none" strokeLinecap="round" />
      </g>
      <ellipse cx="62" cy="97" rx="30" ry="18" fill="#363C48" stroke="#58627A" strokeWidth="1.4" />
      <ellipse cx="60" cy="96" rx="15" ry="15" fill="#F7F8FB" />
      <circle cx="50" cy="88" r="7" fill="#F7F8FB" />
      <circle cx="60" cy="90" r="8" fill="#F7F8FB" />
      <circle cx="70" cy="88" r="7" fill="#F7F8FB" />
      <ellipse cx="47" cy="112" rx="7.5" ry="4" fill="#F7F8FB" />
      <ellipse cx="73" cy="112" rx="7.5" ry="4" fill="#F7F8FB" />
      <rect x="41" y="77" width="38" height="7" rx="3.5" fill="#F4B8CE" />
      <circle cx="60" cy="87" r="4" fill="#F8D5E2" stroke="#D98CAB" strokeWidth="1.2" />
      <g transform={mood === "curious" ? "rotate(-9 60 60)" : undefined}>
        <path d="M33 44 L29 19 Q41 20 48 33 Z" fill="#363C48" stroke="#58627A" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M87 44 L91 19 Q79 20 72 33 Z" fill="#363C48" stroke="#58627A" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M29 19 Q35 17 39 22 L34 27 Z" fill="#2A2F39" />
        <path d="M91 19 Q85 17 81 22 L86 27 Z" fill="#2A2F39" />
        <path d="M35 39 L33 26 Q39 28 43 34 Z" fill="#E8B4C6" opacity=".75" />
        <path d="M85 39 L87 26 Q81 28 77 34 Z" fill="#E8B4C6" opacity=".75" />
        <ellipse cx="60" cy="57" rx="29" ry="26" fill="#363C48" stroke="#58627A" strokeWidth="1.4" />
        <path d="M56.5 31.5 Q60 30 63.5 31.5 L65 51 Q78 57 76 70 Q72 81 60 81 Q48 81 44 70 Q42 57 55 51 Z" fill="#F7F8FB" />
        <Eye cx={46} cy={53} kind={l} open={collieEye} />
        <Eye cx={74} cy={53} kind={r} open={collieEye} />
        <ellipse cx="60" cy="65" rx="5.4" ry="3.9" fill="#1B1E24" />
        <ellipse cx="58.6" cy="63.9" rx="1.6" ry="1" fill="#5A606C" />
        {mood === "excited" ? (
          <>
            <path d="M52 70 q8 11 16 0 z" fill="#2A2E36" />
            <path d="M56.5 72.5 q3.5 9 7 0 z" fill="#F29BB8" />
          </>
        ) : (
          <>
            <path d="M54 71 q6 6 12 0" stroke="#2A2E36" strokeWidth="2" fill="none" strokeLinecap="round" />
            {mood !== "sleepy" && <path d="M57.6 73.2 q2.4 7 4.8 0 z" fill="#F29BB8" />}
          </>
        )}
        <ellipse cx="48" cy="69" rx="4" ry="2.4" fill="#F4B8CE" opacity=".6" />
        <ellipse cx="72" cy="69" rx="4" ry="2.4" fill="#F4B8CE" opacity=".6" />
      </g>
      {mood === "sleepy" && <Zzz />}
    </svg>
  );
}

/** Tobi, the white Persian: the gentle reminder. */
export function Cat({ size = 92, mood = "happy", className = "" }: Props) {
  const [l, r] = eyeKinds(mood);
  const persianEye = (cx: number, cy: number) => (
    <>
      <circle cx={cx} cy={cy} r="7" fill="#8CC2EE" stroke="#C7D3E2" strokeWidth=".8" />
      <circle cx={cx} cy={cy + 0.6} r={mood === "excited" ? 4.8 : 4} fill="#1B2533" />
      <circle cx={cx + 2.2} cy={cy - 2.1} r="1.9" fill="#fff" />
      <circle cx={cx - 1.8} cy={cy + 2.6} r=".8" fill="#fff" opacity=".8" />
    </>
  );
  return (
    <svg className={`mascot ${className}`} width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Tobi the Persian cat">
      <g className="tail">
        <path d="M86 102 q26 -2 23 -28 q-2 -9 -9 -7" stroke="#DCE1EA" strokeWidth="16" fill="none" strokeLinecap="round" />
        <path d="M87 101 q22 -3 20 -26" stroke="#F4F6FA" strokeWidth="9" fill="none" strokeLinecap="round" />
      </g>
      <ellipse cx="60" cy="98" rx="31" ry="18" fill="#EEF1F6" />
      {[35, 47, 60, 73, 85].map((x, i) => (
        <circle key={x} cx={x} cy={[105, 110, 112, 110, 105][i]} r="8" fill="#EEF1F6" />
      ))}
      <g transform={mood === "curious" ? "rotate(8 60 60)" : undefined}>
        <path d="M29 47 Q27 30 44 31 Q39 40 29 47 Z" fill="#F4F6FA" stroke="#D6DCE6" strokeWidth="1" />
        <path d="M91 47 Q93 30 76 31 Q81 40 91 47 Z" fill="#F4F6FA" stroke="#D6DCE6" strokeWidth="1" />
        <path d="M32 43 Q31 34 40 34 Q37 39 32 43 Z" fill="#F4B8CE" />
        <path d="M88 43 Q89 34 80 34 Q83 39 88 43 Z" fill="#F4B8CE" />
        <circle cx="44" cy="33" r="7" fill="#F4F6FA" />
        <circle cx="60" cy="30" r="8" fill="#F4F6FA" />
        <circle cx="76" cy="33" r="7" fill="#F4F6FA" />
        {[
          [31, 62],
          [34, 73],
          [44, 81],
          [60, 85],
          [76, 81],
          [86, 73],
          [89, 62],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="10" fill="#E6EAF1" />
        ))}
        <circle cx="60" cy="58" r="29" fill="#FAFBFD" />
        <path d="M38 50 q8 -5 15 0 M67 50 q7 -5 15 0" stroke="#DCE1EA" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <Eye cx={46} cy={58} kind={l} open={persianEye} />
        <Eye cx={74} cy={58} kind={r} open={persianEye} />
        <path d="M57.8 64.6 h4.4 l-2.2 2.6 z" fill="#E899B6" />
        {mood === "excited" ? (
          <path d="M55.5 67.5 q4.5 7 9 0 z" fill="#C98AA3" />
        ) : (
          <path d="M60 67.2 q-2.4 3 -5.4 1.6 M60 67.2 q2.4 3 5.4 1.6" stroke="#B7A5B0" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        )}
        <path d="M28 63 h13 M29 68 h12 M79 63 h13 M79 68 h12" stroke="#CBD2DD" strokeWidth="1" strokeLinecap="round" />
        <ellipse cx="40" cy="68" rx="4.2" ry="2.5" fill="#F4B8CE" opacity=".55" />
        <ellipse cx="80" cy="68" rx="4.2" ry="2.5" fill="#F4B8CE" opacity=".55" />
        <path d="M80 36 l10 -6 v13 z M80 36 l-2 -10 l12 4 z" fill="#F4B8CE" />
        <circle cx="81" cy="36" r="2.6" fill="#D98CAB" />
      </g>
      {mood === "sleepy" && <Zzz />}
    </svg>
  );
}

export const Companion = ({ who, ...p }: Props & { who: "dog" | "cat" }) => (who === "dog" ? <Dog {...p} /> : <Cat {...p} />);
export const COMPANION_NAME = { dog: "Lei", cat: "Tobi" } as const;
export const COMPANION_LABEL = { dog: "LEI · BORDER COLLIE", cat: "TOBI · PERSIAN" } as const;
