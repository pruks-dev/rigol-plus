"use client";

import { TRIGGER_SOURCES, TRIGGER_SLOPES } from "@/lib/scpi";

interface TriggerState {
  source: string;
  level: number;
  slope: string;
  mode: string;
}

interface Props {
  trigger: TriggerState;
  onSourceChange: (src: string) => void;
  onLevelChange: (level: number) => void;
  onSlopeChange: (slope: string) => void;
}

export default function TriggerPanel({ trigger, onSourceChange, onLevelChange, onSlopeChange }: Props) {
  return (
    <div style={styles.panel}>
      <div style={styles.label}>Trigger</div>
      <div style={styles.grid}>
        <div>
          <div style={styles.fieldLabel}>Source</div>
          <select
            value={trigger.source}
            onChange={(e) => onSourceChange(e.target.value)}
            style={styles.select}
          >
            {TRIGGER_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={styles.fieldLabel}>Level</div>
          <input
            type="number"
            value={trigger.level}
            onChange={(e) => onLevelChange(parseFloat(e.target.value) || 0)}
            step={0.05}
            style={styles.input}
          />
          <span style={styles.unit}>V</span>
        </div>
        <div>
          <div style={styles.fieldLabel}>Slope</div>
          <select
            value={trigger.slope}
            onChange={(e) => onSlopeChange(e.target.value)}
            style={styles.select}
          >
            {TRIGGER_SLOPES.map((s) => (
              <option key={s} value={s}>
                {s === "POSitive" ? "↗ Rising" : "↘ Falling"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={styles.fieldLabel}>Mode</div>
          <div style={styles.modeBadge}>{trigger.mode}</div>
        </div>
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
  },
  label: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "var(--text-dim)",
    fontWeight: 600,
    marginBottom: 8,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  fieldLabel: {
    fontSize: 10,
    color: "var(--text-dim)",
    marginBottom: 2,
  },
  select: {
    padding: "3px 6px",
    fontSize: 11,
    fontFamily: "var(--font-mono)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    color: "var(--text)",
    width: "100%",
  },
  input: {
    width: 72,
    padding: "3px 6px",
    fontSize: 11,
    fontFamily: "var(--font-mono)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    color: "var(--text)",
    textAlign: "right",
  },
  unit: {
    fontSize: 10,
    color: "var(--text-dim)",
    marginLeft: 4,
  },
  modeBadge: {
    fontSize: 11,
    color: "var(--accent)",
    fontFamily: "var(--font-mono)",
    padding: "3px 6px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    display: "inline-block",
  },
};
