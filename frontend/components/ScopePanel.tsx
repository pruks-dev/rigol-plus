"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  connect,
  disconnect,
  send,
  onMessage,
  getState,
  type RigolDevice,
} from "@/lib/websocket";
import { CH_COLORS } from "@/lib/scpi";
import WaveformCanvas from "./WaveformCanvas";
import BridgeStatus from "./BridgeStatus";
import ChannelControls from "./ChannelControls";
import TimebaseControl from "./TimebaseControl";
import TriggerPanel from "./TriggerPanel";
import MeasurementBar from "./MeasurementBar";
import FunctionGenPanel from "./FunctionGenPanel";

type ConnectionState = "disconnected" | "connecting" | "connected";
type Tab = "scope" | "funcgen";

interface WaveformFrame {
  channel: number;
  samples: number[];
  v_scale: number;
  v_offset: number;
  t_scale: number;
  x_inc: number;
  sample_count: number;
}

interface ChannelConfig {
  enabled: boolean;
  scale: number;
  offset: number;
  coupling: string;
}

interface TriggerConfig {
  source: string;
  level: number;
  slope: string;
  mode: string;
}

interface Measurement {
  label: string;
  value: string;
  channel: number;
}

export default function ScopePanel() {
  const [tab, setTab] = useState<Tab>("scope");
  const [connState, setConnState] = useState<ConnectionState>("disconnected");
  const [devices, setDevices] = useState<RigolDevice[]>([]);
  const [error, setError] = useState("");

  // Scope state
  const scopeAddr = useRef<string>("");
  const [activeChannels, setActiveChannels] = useState<number[]>([1]);
  const [channels, setChannels] = useState<Record<string, ChannelConfig>>({});
  const [tScale, setTScale] = useState(0.001);
  const [trigger, setTrigger] = useState<TriggerConfig>({
    source: "CHANnel1", level: 0, slope: "POSitive", mode: "AUTO",
  });
  const [waveformFrames, setWaveformFrames] = useState<Record<number, WaveformFrame>>({});
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  // Auto-scan on connect
  const handleWsMessage = useCallback(
    (msg: Record<string, unknown>) => {
      switch (msg.type) {
        case "connected":
          setConnState("connected");
          send({ type: "scan" });
          break;
        case "disconnected":
          setConnState("disconnected");
          break;
        case "scan_result": {
          const devs = (msg.devices as RigolDevice[]) || [];
          setDevices(devs);
          const scope = devs.find((d) => d.model?.toUpperCase().startsWith("DHO"));
          if (scope) {
            scopeAddr.current = scope.address;
            // Request scope state
            send({ type: "scope_state", address: scope.address });
            // Start waveform poll on CH1
            send({ type: "waveform_start", address: scope.address, channel: 1, interval: 500 });
          }
          break;
        }
        case "scope_state": {
          const chs = (msg.channels as Record<string, ChannelConfig>) || {};
          setChannels(chs);
          const tb = msg.timebase as Record<string, number> | undefined;
          if (tb?.scale) setTScale(tb.scale);
          const trig = msg.trigger as TriggerConfig | undefined;
          if (trig) setTrigger(trig);
          // Set active channels
          const active: number[] = [];
          for (const [key, val] of Object.entries(chs)) {
            if (val.enabled) {
              const chNum = parseInt(key.replace("CH", ""));
              if (!isNaN(chNum)) active.push(chNum);
            }
          }
          setActiveChannels(active.length ? active : [1]);
          break;
        }
        case "waveform_frame": {
          const wf = msg as unknown as WaveformFrame;
          setWaveformFrames((prev) => ({ ...prev, [wf.channel]: wf }));
          // Auto-measure Vpp on frame arrival
          const vpp = computeVpp(wf.samples);
          setMeasurements((prev) => {
            const filtered = prev.filter((m) => !(m.label === "Vpp" && m.channel === wf.channel));
            return [...filtered, {
              label: "Vpp",
              value: formatVoltage(vpp),
              channel: wf.channel,
            }];
          });
          break;
        }
        case "measure_result": {
          const val = String(msg.value || "—");
          setMeasurements((prev) => [
            ...prev,
            {
              label: String(msg.measurement),
              value: val,
              channel: Number(msg.channel),
            },
          ]);
          break;
        }
        case "error":
          setError(msg.message as string);
          break;
      }
    },
    []
  );

  useEffect(() => {
    const unsub = onMessage((msg) => handleWsMessage(msg as Record<string, unknown>));
    return unsub;
  }, [handleWsMessage]);

  const handleConnect = () => {
    setError("");
    setConnState("connecting");
    connect();
  };

  const handleDisconnect = () => {
    send({ type: "waveform_stop", address: scopeAddr.current, channel: 1 });
    disconnect();
    setConnState("disconnected");
  };

  const handleScan = () => send({ type: "scan" });

  // ── Scope controls ──
  const handleChannelToggle = (ch: number, enabled: boolean) => {
    const cmd = enabled ? "ON" : "OFF";
    send({ type: "write", address: scopeAddr.current, command: `:CHANnel${ch}:DISPlay ${cmd}` });
    setChannels((prev) => ({
      ...prev,
      [`CH${ch}`]: { ...(prev[`CH${ch}`] || {}), enabled },
    }));
    setActiveChannels((prev) => {
      if (enabled && !prev.includes(ch)) {
        send({ type: "waveform_start", address: scopeAddr.current, channel: ch, interval: 500 });
        return [...prev, ch].sort();
      }
      if (!enabled) {
        send({ type: "waveform_stop", address: scopeAddr.current, channel: ch });
        return prev.filter((c) => c !== ch);
      }
      return prev;
    });
  };

  const handleScaleChange = (ch: number, scale: number) => {
    send({ type: "scope_set", address: scopeAddr.current, channel: ch, param: "scale", value: scale });
    setChannels((prev) => ({
      ...prev,
      [`CH${ch}`]: { ...(prev[`CH${ch}`] || {}), scale },
    }));
  };

  const handleOffsetChange = (ch: number, offset: number) => {
    send({ type: "scope_set", address: scopeAddr.current, channel: ch, param: "offset", value: offset });
    setChannels((prev) => ({
      ...prev,
      [`CH${ch}`]: { ...(prev[`CH${ch}`] || {}), offset },
    }));
  };

  const handleTimebaseChange = (scale: number) => {
    send({ type: "timebase_set", address: scopeAddr.current, scale });
    setTScale(scale);
  };

  const handleTriggerSource = (src: string) => {
    send({ type: "trigger_set", address: scopeAddr.current, param: "source", value: src });
    setTrigger((prev) => ({ ...prev, source: src }));
  };

  const handleTriggerLevel = (level: number) => {
    send({ type: "trigger_set", address: scopeAddr.current, param: "level", value: level });
    setTrigger((prev) => ({ ...prev, level }));
  };

  const handleTriggerSlope = (slope: string) => {
    send({ type: "trigger_set", address: scopeAddr.current, param: "slope", value: slope });
    setTrigger((prev) => ({ ...prev, slope }));
  };

  const handleMeasure = (measType: string, ch: number) => {
    send({ type: "measure", address: scopeAddr.current, measurement: measType, channel: ch });
  };

  const hasScope = devices.some((d) => d.model?.toUpperCase().startsWith("DHO"));

  return (
    <div>
      <BridgeStatus
        state={connState}
        deviceCount={devices.length}
        devices={devices}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onScan={handleScan}
      />

      {error && (
        <div style={styles.error}>{error}</div>
      )}

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, borderColor: tab === "scope" ? "var(--accent)" : "transparent" }}
          onClick={() => setTab("scope")}
        >
          📡 Oscilloscope
        </button>
        <button
          style={{ ...styles.tab, borderColor: tab === "funcgen" ? "var(--accent)" : "transparent" }}
          onClick={() => setTab("funcgen")}
        >
          ⚡ Function Gen
        </button>
      </div>

      {/* Oscilloscope Tab */}
      {tab === "scope" && (
        <div style={styles.content}>
          {hasScope ? (
            <>
              <div style={styles.scopeGrid}>
                <div style={styles.controls}>
                  <ChannelControls
                    channels={channels}
                    onToggle={handleChannelToggle}
                    onScaleChange={handleScaleChange}
                    onOffsetChange={handleOffsetChange}
                  />
                  <TimebaseControl value={tScale} onChange={handleTimebaseChange} />
                  <TriggerPanel
                    trigger={trigger}
                    onSourceChange={handleTriggerSource}
                    onLevelChange={handleTriggerLevel}
                    onSlopeChange={handleTriggerSlope}
                  />
                </div>
                <div style={styles.canvasWrap}>
                  <WaveformCanvas
                    frames={waveformFrames}
                    tScale={tScale}
                    activeChannels={activeChannels}
                  />
                </div>
              </div>
              <MeasurementBar
                measurements={measurements}
                onMeasure={handleMeasure}
              />
            </>
          ) : (
            <div style={styles.empty}>
              {connState === "connected"
                ? "No oscilloscope detected — connect DHO814 via USB and click Scan"
                : "Connect to bridge first"}
            </div>
          )}
        </div>
      )}

      {/* Function Gen Tab */}
      {tab === "funcgen" && (
        <div style={styles.content}>
          <FunctionGenPanel
            devices={devices}
            connState={connState}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onScan={handleScan}
          />
        </div>
      )}
    </div>
  );
}

// ── Helpers ──
function computeVpp(samples: number[]): number {
  if (!samples.length) return 0;
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  return max - min;
}

function formatVoltage(v: number): string {
  if (Math.abs(v) < 0.01) return `${(v * 1000).toFixed(1)}mV`;
  return `${v.toFixed(3)}V`;
}

const styles: Record<string, React.CSSProperties> = {
  error: {
    padding: "8px 16px",
    fontSize: 12,
    color: "var(--red)",
    background: "rgba(240,113,120,0.1)",
    margin: "0 8px 8px",
    borderRadius: 4,
  },
  tabs: {
    display: "flex",
    gap: 0,
    borderBottom: "1px solid var(--border)",
    padding: "0 16px",
  },
  tab: {
    padding: "10px 20px",
    fontSize: 13,
    fontWeight: 600,
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "var(--text)",
    cursor: "pointer",
    transition: "border-color 0.2s",
  },
  content: {
    padding: 12,
  },
  scopeGrid: {
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    gap: 12,
    marginBottom: 12,
  },
  controls: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  canvasWrap: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    textAlign: "center",
    padding: 60,
    color: "var(--text-dim)",
    fontSize: 14,
  },
};
