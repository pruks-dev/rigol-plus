"use client";

import { CH_COLORS, VSCALE_PRESETS } from "@/lib/scpi";

interface ChannelState {
  enabled: boolean;
  scale: number;
  offset: number;
  coupling: string;
}

interface Props {
  channels: Record<string, ChannelState>;
  onToggle: (ch: number, enabled: boolean) => void;
  onScaleChange: (ch: number, scale: number) => void;
  onOffsetChange: (ch: number, offset: number) => void;
}

function findScaleIdx(scale: number): number {
  const idx = VSCALE_PRESETS.findIndex((p) => p.value === scale);
  return idx >= 0 ? idx : 8; // default to 1V
}

function formatLabel(label: string): string {
  // Pad short labels for alignment
  if (label.endsWith("mV") && label.length < 5) return label.padStart(5, "\u00A0");
  if (label.endsWith("V") && label.length < 4) return label.padStart(4, "\u00A0");
  return label;
}

export default function ChannelControls({
  channels,
  onToggle,
  onScaleChange,
  onOffsetChange,
}: Props) {
  return (
    <div style={styles.panel}>
      <div style={styles.label}>Channels</div>
      {[1, 2, 3, 4].map((ch) => {
        const key = `CH${ch}`;
        const chan = channels[key] || {
          enabled: false,
          scale: 1,
          offset: 0,
          coupling: "DC",
        };
        const color = CH_COLORS[ch];
        const scaleIdx = findScaleIdx(chan.scale);
        const currentScale = VSCALE_PRESETS[scaleIdx];

        const scaleUp = () => {
          const next = Math.min(scaleIdx + 1, VSCALE_PRESETS.length - 1);
          onScaleChange(ch, VSCALE_PRESETS[next].value);
        };
        const scaleDown = () => {
          const prev = Math.max(scaleIdx - 1, 0);
          onScaleChange(ch, VSCALE_PRESETS[prev].value);
        };

        return (
          <div key={ch} style={styles.row}>
            {/* Enable toggle */}
            <label
              style={{
                ...styles.checkbox,
                color: chan.enabled ? color : "var(--text-dim)",
              }}
            >
              <input
                type="checkbox"
                checked={chan.enabled}
                onChange={(e) => onToggle(ch, e.target.checked)}
                style={{ accentColor: color }}
              />
              CH{ch}
            </label>

            {/* Scale knob */}
            <div style={styles.knobGroup}>
              <button
                style={styles.knobBtn}
                onClick={scaleDown}
                disabled={!chan.enabled}
                title="Scale down"
              >
                ◀
              </button>
              <span
                style={{
                  ...styles.scaleValue,
                  color: chan.enabled ? "var(--accent)" : "var(--text-dim)",
                }}
              >
                {currentScale ? formatLabel(currentScale.label) : "1V"}
              </span>
              <button
                style={styles.knobBtn}
                onClick={scaleUp}
                disabled={!chan.enabled}
                title="Scale up"
              >
                ▶
              </button>
            </div>

            {/* Offset knob */}
            <div style={styles.knobGroup}>
              <button
                style={styles.knobBtnSmall}
                onClick={() => {
                  const step = Math.max(chan.scale * 0.02, 0.0001);
                  onOffsetChange(ch, +(chan.offset - step).toFixed(5));
                }}
                disabled={!chan.enabled}
                title="Offset down"
              >
                ◀
              </button>
              <input
                type="number"
                value={chan.offset}
                onChange={(e) =>
                  onOffsetChange(ch, parseFloat(e.target.value) || 0)
                }
                step={chan.scale * 0.02}
                style={styles.offsetInput}
                disabled={!chan.enabled}
              />
              <button
                style={styles.knobBtnSmall}
                onClick={() => {
                  const step = Math.max(chan.scale * 0.02, 0.0001);
                  onOffsetChange(ch, +(chan.offset + step).toFixed(5));
                }}
                disabled={!chan.enabled}
                title="Offset up"
              >
                ▶
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: 10,
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
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  checkbox: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    fontSize: 11,
    fontWeight: 600,
    minWidth: 38,
    cursor: "pointer",
  },
  knobGroup: {
    display: "flex",
    alignItems: "center",
    gap: 2,
  },
  knobBtn: {
    width: 22,
    height: 22,
    fontSize: 9,
    border: "1px solid var(--border)",
    borderRadius: 4,
    background: "var(--bg)",
    color: "var(--text)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    lineHeight: 1,
  },
  scaleValue: {
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "var(--font-mono)",
    padding: "2px 6px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    minWidth: 48,
    textAlign: "center",
    display: "inline-block",
  },
  knobBtnSmall: {
    width: 20,
    height: 20,
    fontSize: 8,
    border: "1px solid var(--border)",
    borderRadius: 3,
    background: "var(--bg)",
    color: "var(--text-dim)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    lineHeight: 1,
  },
  offsetInput: {
    width: 52,
    padding: "2px 4px",
    fontSize: 11,
    fontFamily: "var(--font-mono)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    color: "var(--text)",
    textAlign: "center",
  },
};
