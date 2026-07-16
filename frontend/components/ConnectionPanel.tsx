"use client";

import { useEffect, useState, useCallback } from "react";
import {
  connect,
  disconnect,
  send,
  onMessage,
  getState,
  type RigolDevice,
} from "@/lib/websocket";

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

export default function ConnectionPanel() {
  const [connState, setConnState] = useState<ConnectionState>("disconnected");
  const [devices, setDevices] = useState<RigolDevice[]>([]);
  const [error, setError] = useState<string>("");
  const [autoScan, setAutoScan] = useState(true);

  // Listen for WebSocket messages
  useEffect(() => {
    const unsub = onMessage((msg) => {
      switch (msg.type) {
        case "connected":
          setConnState("connected");
          if (autoScan) {
            send({ type: "scan" });
          }
          break;
        case "disconnected":
          setConnState("disconnected");
          setDevices([]);
          break;
        case "scan_result":
          if (msg.devices) {
            setDevices(msg.devices);
          }
          break;
        case "error":
          setError(msg.message || "unknown error");
          break;
        case "query_result":
        case "write_ack":
        case "disconnected":
          // handled by other panels
          break;
      }
    });
    return unsub;
  }, [autoScan]);

  const handleConnect = useCallback(() => {
    setError("");
    setConnState("connecting");
    connect();
  }, []);

  const handleDisconnect = useCallback(() => {
    disconnect();
    setConnState("disconnected");
    setDevices([]);
  }, []);

  const handleScan = useCallback(() => {
    send({ type: "scan" });
  }, []);

  const handleDisconnectDevice = useCallback((address: string) => {
    send({ type: "disconnect", address });
    setDevices((prev) => prev.filter((d) => d.address !== address));
  }, []);

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>ψ-RigolPlus</h1>
        <span style={styles.subtitle}>DHO814 · DG822 Pro</span>
      </div>

      {/* Bridge Connection */}
      <div style={styles.section}>
        <div style={styles.row}>
          <StatusDot state={connState} />
          <span style={styles.label}>Bridge</span>
          <span style={styles.stateText}>
            {connState === "connected"
              ? "Online"
              : connState === "connecting"
                ? "Connecting…"
                : "Offline"}
          </span>
          <div style={{ flex: 1 }} />
          {connState === "connected" ? (
            <button style={styles.btnDanger} onClick={handleDisconnect}>
              Disconnect
            </button>
          ) : (
            <button style={styles.btn} onClick={handleConnect}>
              Connect
            </button>
          )}
        </div>
        <span style={styles.hint}>ws://localhost:9120</span>
        {error && <div style={styles.error}>{error}</div>}
      </div>

      {/* Device List */}
      <div style={styles.section}>
        <div style={styles.row}>
          <span style={styles.label}>
            Instruments ({devices.filter((d) => d.connected).length})
          </span>
          <div style={{ flex: 1 }} />
          <button
            style={styles.btnSmall}
            onClick={handleScan}
            disabled={connState !== "connected"}
          >
            Scan
          </button>
        </div>

        {devices.length === 0 && (
          <div style={styles.empty}>
            {connState === "connected"
              ? "No RIGOL devices found — plug in USB and click Scan"
              : "Connect bridge first, then Scan"}
          </div>
        )}

        {devices.map((dev) => (
          <div key={dev.address} style={styles.deviceCard}>
            <div style={styles.deviceHeader}>
              <StatusDot state={dev.connected ? "connected" : "disconnected"} />
              <span style={styles.deviceModel}>{dev.model || "RIGOL"}</span>
              <div style={{ flex: 1 }} />
              <button
                style={styles.btnSmallDanger}
                onClick={() => handleDisconnectDevice(dev.address)}
              >
                ✕
              </button>
            </div>
            <div style={styles.deviceIdentity}>{dev.identity || dev.address}</div>
          </div>
        ))}
      </div>

      {/* Quick Command */}
      {devices.length > 0 && (
        <div style={styles.section}>
          <CommandPanel devices={devices} />
        </div>
      )}
    </div>
  );
}

/* ── Status Dot ── */
function StatusDot({ state }: { state: string }) {
  const color =
    state === "connected"
      ? "var(--green)"
      : state === "connecting"
        ? "var(--yellow)"
        : "var(--red)";
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        backgroundColor: color,
        boxShadow: `0 0 6px ${color}`,
        marginRight: 8,
      }}
    />
  );
}

/* ── Command Panel ── */
function CommandPanel({ devices }: { devices: RigolDevice[] }) {
  const [addr, setAddr] = useState(devices[0]?.address || "");
  const [cmd, setCmd] = useState("*IDN?");
  const [resp, setResp] = useState("");

  useEffect(() => {
    const unsub = onMessage((msg) => {
      if (msg.type === "query_result") {
        setResp(msg.response || "");
      }
    });
    return unsub;
  }, []);

  const handleSend = () => {
    send({ type: "query", address: addr, command: cmd });
    setResp("...");
  };

  return (
    <div>
      <span style={styles.label}>Quick SCPI</span>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <select
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          style={styles.select}
        >
          {devices.map((d) => (
            <option key={d.address} value={d.address}>
              {d.model || d.address}
            </option>
          ))}
        </select>
        <input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          style={styles.input}
          placeholder="SCPI command..."
        />
        <button style={styles.btn} onClick={handleSend}>
          Send
        </button>
      </div>
      {resp && (
        <pre style={styles.response}>
          → {resp}
        </pre>
      )}
    </div>
  );
}

/* ── Styles ── */
const styles: Record<string, React.CSSProperties> = {
  panel: {
    maxWidth: 680,
    margin: "40px auto",
    padding: "24px",
  },
  header: {
    marginBottom: 32,
    textAlign: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: "var(--accent)",
    textShadow: "0 0 20px var(--accent-glow)",
    letterSpacing: "0.05em",
  },
  subtitle: {
    fontSize: 13,
    color: "var(--text-dim)",
    marginTop: 4,
    display: "block",
  },
  section: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 16,
    marginBottom: 12,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    color: "var(--text-dim)",
    fontWeight: 600,
  },
  stateText: {
    fontSize: 13,
    color: "var(--text)",
  },
  hint: {
    fontSize: 11,
    color: "var(--text-dim)",
    marginTop: 4,
    display: "block",
    paddingLeft: 18,
  },
  error: {
    fontSize: 12,
    color: "var(--red)",
    marginTop: 8,
    padding: "4px 8px",
    background: "rgba(240,113,120,0.1)",
    borderRadius: 4,
  },
  empty: {
    fontSize: 13,
    color: "var(--text-dim)",
    textAlign: "center",
    padding: "20px 0",
  },
  deviceCard: {
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
    background: "var(--bg)",
  },
  deviceHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  deviceModel: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--accent)",
  },
  deviceIdentity: {
    fontSize: 11,
    color: "var(--text-dim)",
    marginTop: 4,
    paddingLeft: 18,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
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
  btnDanger: {
    padding: "6px 16px",
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid var(--red)",
    borderRadius: 4,
    background: "rgba(240,113,120,0.1)",
    color: "var(--red)",
    cursor: "pointer",
  },
  btnSmall: {
    padding: "3px 10px",
    fontSize: 11,
    border: "1px solid var(--border)",
    borderRadius: 4,
    background: "transparent",
    color: "var(--text-dim)",
    cursor: "pointer",
  },
  btnSmallDanger: {
    padding: "2px 8px",
    fontSize: 12,
    border: "none",
    borderRadius: 4,
    background: "transparent",
    color: "var(--text-dim)",
    cursor: "pointer",
  },
  input: {
    flex: 1,
    padding: "6px 10px",
    fontSize: 13,
    fontFamily: "var(--font-mono)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    color: "var(--text)",
    outline: "none",
  },
  select: {
    padding: "6px 10px",
    fontSize: 13,
    fontFamily: "var(--font-mono)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    color: "var(--text)",
    outline: "none",
  },
  response: {
    marginTop: 8,
    padding: "8px 12px",
    fontSize: 13,
    fontFamily: "var(--font-mono)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    color: "var(--green)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
  },
};
