"use client";

import { TIMEBASE_PRESETS } from "@/lib/scpi";

interface Props {
  value: number;
  onChange: (scale: number) => void;
}

export default function TimebaseControl({ value, onChange }: Props) {
  const idx = TIMEBASE_PRESETS.findIndex((p) => p.value === value);
  const current = TIMEBASE_PRESETS[idx] || TIMEBASE_PRESETS[15];

  const stepUp = () => {
    const next = Math.min(idx + 1, TIMEBASE_PRESETS.length - 1);
    onChange(TIMEBASE_PRESETS[next].value);
  };

  const stepDown = () => {
    const prev = Math.max(idx - 1, 0);
    onChange(TIMEBASE_PRESETS[prev].value);
  };

  return (
    <div style={styles.panel}>
      <div style={styles.label}>Timebase</div>
      <div style={styles.knob}>
        <button style={styles.btn} onClick={stepUp} title="Slower">
          ▲
        </button>
        <div style={styles.value}>{current.label}/div</div>
        <button style={styles.btn} onClick={stepDown} title="Faster">
          ▼
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "var(--text-dim)",
    fontWeight: 600,
  },
  knob: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  },
  btn: {
    width: 48,
    height: 24,
    fontSize: 12,
    border: "1px solid var(--border)",
    borderRadius: 4,
    background: "var(--bg)",
    color: "var(--text)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--accent)",
    fontFamily: "var(--font-mono)",
    padding: "4px 12px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    minWidth: 80,
    textAlign: "center",
  },
};
