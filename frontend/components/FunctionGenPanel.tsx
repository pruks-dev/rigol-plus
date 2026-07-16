"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  connect,
  disconnect,
  send,
  onMessage,
  type RigolDevice,
} from "@/lib/websocket";
import {
  FG_WAVEFORMS,
  FG_WAVEFORM_LABELS,
  VSCALE_PRESETS,
  TIMEBASE_PRESETS,
} from "@/lib/scpi";

interface FGChannel {
  function: string;
  frequency: number;
  amplitude: number;
  offset: number;
  output: boolean;
}

interface Props {
  devices: RigolDevice[];
  connState: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onScan: () => void;
}

// Frequency presets (log scale: 1Hz → 25MHz)
const FREQ_PRESETS = [
  { label: "1Hz", value: 1 },
  { label: "10Hz", value: 10 },
  { label: "100Hz", value: 100 },
  { label: "1kHz", value: 1000 },
  { label: "10kHz", value: 10000 },
  { label: "100kHz", value: 100000 },
  { label: "1MHz", value: 1_000_000 },
  { label: "5MHz", value: 5_000_000 },
  { label: "10MHz", value: 10_000_000 },
  { label: "25MHz", value: 25_000_000 },
];

export default function FunctionGenPanel({
  devices,
  connState,
  onConnect,
  onDisconnect,
  onScan,
}: Props) {
  const fgAddr = useRef("");
  const [channels, setChannels] = useState<Record<string, FGChannel>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onMessage((msg) => {
      switch (msg.type) {
        case "scan_result": {
          const devs = (msg.devices as RigolDevice[]) || [];
          const fg = devs.find((d) => d.model?.toUpperCase().startsWith("DG"));
          if (fg) {
            fgAddr.current = fg.address;
            send({ type: "fg_state", address: fg.address });
          }
          break;
        }
        case "fg_state": {
          const chs = (msg.channels as Record<string, FGChannel>) || {};
          setChannels(chs);
          break;
        }
        case "fg_set_ack":
          // refresh state after set
          if (fgAddr.current) {
            send({ type: "fg_state", address: fgAddr.current });
          }
          break;
        case "error":
          setError(msg.message as string);
          break;
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    // Auto-request state when connect + devices ready
    if (connState === "connected") {
      const fg = devices.find((d) => d.model?.toUpperCase().startsWith("DG"));
      if (fg && fgAddr.current !== fg.address) {
        fgAddr.current = fg.address;
        send({ type: "fg_state", address: fg.address });
      }
    }
  }, [connState, devices]);

  const doSet = useCallback(
    (ch: number, param: string, value: string | number | boolean) => {
      if (!fgAddr.current) return;
      send({
        type: "fg_set",
        address: fgAddr.current,
        channel: ch,
        param,
        value,
      });
    },
    []
  );

  const hasFG = devices.some((d) => d.model?.toUpperCase().startsWith("DG"));

  if (!hasFG) {
    return (
      <div style={styles.empty}>
        <p>No Function Generator detected</p>
        <p style={styles.hint}>
          Connect DG822 Pro via USB and click Scan
        </p>
        <button style={styles.btn} onClick={onScan}>
          Scan
        </button>
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      {error && <div style={styles.errorRow}>{error}</div>}

      {[1, 2].map((ch) => {
        const chan = channels[`CH${ch}`] || {
          function: "SIN",
          frequency: 1000,
          amplitude: 1,
          offset: 0,
          output: false,
        };

        return (
          <div key={ch} style={styles.channelCard}>
            <div style={styles.chHeader}>
              <span style={styles.chLabel}>CH{ch}</span>
              <button
                style={{
                  ...styles.outputBtn,
                  background: chan.output
                    ? "var(--green)"
                    : "rgba(240,113,120,0.2)",
                  color: chan.output ? "var(--bg)" : "var(--red)",
                  borderColor: chan.output ? "var(--green)" : "var(--red)",
                }}
                onClick={() => doSet(ch, "output", !chan.output)}
              >
                {chan.output ? "ON" : "OFF"}
              </button>
            </div>

            {/* Waveform */}
            <div style={styles.section}>
              <div style={styles.sectionLabel}>Waveform</div>
              <div style={styles.waveRow}>
                {FG_WAVEFORMS.map((w) => (
                  <button
                    key={w}
                    style={{
                      ...styles.waveBtn,
                      background:
                        chan.function === w
                          ? "var(--accent-glow)"
                          : "var(--bg)",
                      borderColor:
                        chan.function === w
                          ? "var(--accent)"
                          : "var(--border)",
                      color:
                        chan.function === w
                          ? "var(--accent)"
                          : "var(--text-dim)",
                    }}
                    onClick={() => doSet(ch, "function", w)}
                  >
                    {FG_WAVEFORM_LABELS[w] || w}
                  </button>
                ))}
              </div>
            </div>

            {/* Controls row */}
            <div style={styles.controlsRow}>
              {/* Frequency */}
              <div style={styles.knob}>
                <div style={styles.knobLabel}>Frequency</div>
                <div style={styles.knobRow}>
                  <button
                    style={styles.kb}
                    onClick={() => {
                      const idx = FREQ_PRESETS.findIndex(
                        (p) => p.value >= chan.frequency
                      );
                      const prev = FREQ_PRESETS[Math.max((idx >= 0 ? idx : 0) - 1, 0)];
                      doSet(ch, "frequency", prev.value);
                    }}
                  >
                    ▼
                  </button>
                  <span style={styles.knobVal}>
                    {formatFreq(chan.frequency)}
                  </span>
                  <button
                    style={styles.kb}
                    onClick={() => {
                      const idx = FREQ_PRESETS.findIndex(
                        (p) => p.value > chan.frequency
                      );
                      const next =
                        FREQ_PRESETS[
                          Math.min(idx >= 0 ? idx : FREQ_PRESETS.length - 1, FREQ_PRESETS.length - 1)
                        ];
                      doSet(ch, "frequency", next.value);
                    }}
                  >
                    ▲
                  </button>
                </div>
              </div>

              {/* Amplitude */}
              <div style={styles.knob}>
                <div style={styles.knobLabel}>Amplitude</div>
                <div style={styles.knobRow}>
                  <button
                    style={styles.kb}
                    onClick={() => {
                      const step = Math.max(chan.amplitude * 0.1, 0.001);
                      doSet(ch, "amplitude", +(chan.amplitude - step).toFixed(3));
                    }}
                  >
                    ▼
                  </button>
                  <input
                    type="number"
                    value={chan.amplitude}
                    onChange={(e) =>
                      doSet(ch, "amplitude", parseFloat(e.target.value) || 0)
                    }
                    step={chan.amplitude * 0.1}
                    style={styles.knobInput}
                  />
                  <span style={styles.knobUnit}>Vpp</span>
                  <button
                    style={styles.kb}
                    onClick={() => {
                      const step = Math.max(chan.amplitude * 0.1, 0.001);
                      doSet(ch, "amplitude", +(chan.amplitude + step).toFixed(3));
                    }}
                  >
                    ▲
                  </button>
                </div>
              </div>

              {/* Offset */}
              <div style={styles.knob}>
                <div style={styles.knobLabel}>Offset</div>
                <div style={styles.knobRow}>
                  <button
                    style={styles.kb}
                    onClick={() => {
                      const step = Math.max(chan.amplitude * 0.05, 0.0001);
                      doSet(ch, "offset", +(chan.offset - step).toFixed(4));
                    }}
                  >
                    ▼
                  </button>
                  <input
                    type="number"
                    value={chan.offset}
                    onChange={(e) =>
                      doSet(ch, "offset", parseFloat(e.target.value) || 0)
                    }
                    step={chan.amplitude * 0.05}
                    style={styles.knobInput}
                  />
                  <span style={styles.knobUnit}>V</span>
                  <button
                    style={styles.kb}
                    onClick={() => {
                      const step = Math.max(chan.amplitude * 0.05, 0.0001);
                      doSet(ch, "offset", +(chan.offset + step).toFixed(4));
                    }}
                  >
                    ▲
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatFreq(hz: number): string {
  if (hz >= 1_000_000) return `${(hz / 1_000_000).toFixed(hz % 1_000_000 ? 1 : 0)}MHz`;
  if (hz >= 1_000) return `${(hz / 1_000).toFixed(hz % 1_000 ? 1 : 0)}kHz`;
  return `${hz}Hz`;
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  empty: {
    textAlign: "center",
    padding: 60,
    color: "var(--text-dim)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  },
  hint: {
    fontSize: 12,
    color: "var(--text-dim)",
  },
  btn: {
    padding: "6px 16px",
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid var(--accent)",
    borderRadius: 4,
    background: "var(--accent-glow)",
    color: "var(--accent)",
    cursor: "pointer",
  },
  errorRow: {
    padding: 8,
    fontSize: 12,
    color: "var(--red)",
    background: "rgba(240,113,120,0.1)",
    borderRadius: 4,
  },
  channelCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: 14,
  },
  chHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  chLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--accent)",
  },
  outputBtn: {
    padding: "4px 20px",
    fontSize: 13,
    fontWeight: 700,
    border: "1px solid",
    borderRadius: 4,
    cursor: "pointer",
    letterSpacing: "0.05em",
  },
  section: {
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "var(--text-dim)",
    fontWeight: 600,
    marginBottom: 6,
  },
  waveRow: {
    display: "flex",
    gap: 4,
    flexWrap: "wrap",
  },
  waveBtn: {
    padding: "3px 8px",
    fontSize: 10,
    fontWeight: 600,
    border: "1px solid",
    borderRadius: 4,
    cursor: "pointer",
  },
  controlsRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  knob: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  knobLabel: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--text-dim)",
  },
  knobRow: {
    display: "flex",
    alignItems: "center",
    gap: 2,
  },
  kb: {
    width: 24,
    height: 24,
    fontSize: 10,
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
  knobVal: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--accent)",
    fontFamily: "var(--font-mono)",
    padding: "2px 8px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    minWidth: 64,
    textAlign: "center",
  },
  knobInput: {
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
  knobUnit: {
    fontSize: 10,
    color: "var(--text-dim)",
    width: 24,
    textAlign: "center",
  },
};
