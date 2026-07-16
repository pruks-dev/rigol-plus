"use client";

interface Measurement {
  label: string;
  value: string;
  channel: number;
}

interface Props {
  measurements: Measurement[];
  onMeasure: (type: string, ch: number) => void;
}

const MEASUREMENTS = [
  { type: "VPP", label: "Vpp" },
  { type: "VMAX", label: "Vmax" },
  { type: "VMIN", label: "Vmin" },
  { type: "FREQuency", label: "Freq" },
  { type: "PERiod", label: "Period" },
  { type: "RISetime", label: "Rise" },
];

export default function MeasurementBar({ measurements, onMeasure }: Props) {
  return (
    <div style={styles.panel}>
      <div style={styles.label}>Measurements</div>
      <div style={styles.row}>
        {MEASUREMENTS.map((m) => (
          <div key={m.type} style={styles.item}>
            <span style={styles.measLabel}>{m.label}</span>
            {[1, 2, 3, 4].map((ch) => (
              <button
                key={ch}
                style={styles.chip}
                onClick={() => onMeasure(m.type, ch)}
              >
                CH{ch}
              </button>
            ))}
          </div>
        ))}
      </div>
      {measurements.length > 0 && (
        <div style={styles.results}>
          {measurements.map((m, i) => (
            <div key={i} style={styles.resultItem}>
              <span>
                CH{m.channel} {m.label}:
              </span>
              <span style={styles.resultValue}>{m.value}</span>
            </div>
          ))}
        </div>
      )}
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
  row: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  measLabel: {
    fontSize: 11,
    color: "var(--text)",
    fontFamily: "var(--font-mono)",
    minWidth: 40,
  },
  chip: {
    padding: "1px 6px",
    fontSize: 10,
    border: "1px solid var(--border)",
    borderRadius: 3,
    background: "var(--bg)",
    color: "var(--text-dim)",
    cursor: "pointer",
  },
  results: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 8,
    padding: "6px 8px",
    background: "var(--bg)",
    borderRadius: 4,
  },
  resultItem: {
    fontSize: 11,
    fontFamily: "var(--font-mono)",
    color: "var(--text)",
    display: "flex",
    gap: 4,
  },
  resultValue: {
    color: "var(--green)",
    fontWeight: 600,
  },
};
