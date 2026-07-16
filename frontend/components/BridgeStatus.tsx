"use client";

interface Props {
  state: "connected" | "connecting" | "disconnected" | "error";
  deviceCount: number;
  devices: Array<{ model: string; address: string }>;
  onConnect: () => void;
  onDisconnect: () => void;
  onScan: () => void;
}

export default function BridgeStatus({
  state,
  deviceCount,
  devices,
  onConnect,
  onDisconnect,
  onScan,
}: Props) {
  const colorMap = {
    connected: "var(--green)",
    connecting: "var(--yellow)",
    disconnected: "var(--red)",
    error: "var(--red)",
  };
  const labelMap = {
    connected: "Online",
    connecting: "Connecting…",
    disconnected: "Offline",
    error: "Error",
  };
  const color = colorMap[state];
  const label = labelMap[state];

  return (
    <div style={styles.bar}>
      <div style={styles.left}>
        <span style={{ ...styles.dot, backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
        <span style={styles.title}>ψ-RigolPlus</span>
        <span style={styles.status}>{label}</span>
        {deviceCount > 0 && (
          <span style={styles.deviceCount}>
            {deviceCount} instrument{deviceCount > 1 ? "s" : ""}
            {devices.map((d) => (
              <span key={d.address} style={styles.deviceTag}>
                {d.model}
              </span>
            ))}
          </span>
        )}
      </div>
      <div style={styles.right}>
        <button style={styles.btnSmall} onClick={onScan}>
          Scan
        </button>
        {state === "connected" ? (
          <button style={styles.btnDanger} onClick={onDisconnect}>
            Disconnect
          </button>
        ) : (
          <button style={styles.btn} onClick={onConnect}>
            Connect
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px",
    background: "var(--surface)",
    borderBottom: "1px solid var(--border)",
    flexWrap: "wrap",
    gap: 8,
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    display: "inline-block",
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--accent)",
    letterSpacing: "0.05em",
  },
  status: {
    fontSize: 11,
    color: "var(--text-dim)",
  },
  deviceCount: {
    fontSize: 11,
    color: "var(--text-dim)",
    display: "flex",
    gap: 4,
    alignItems: "center",
  },
  deviceTag: {
    background: "rgba(57,186,230,0.1)",
    color: "var(--accent)",
    padding: "1px 6px",
    borderRadius: 3,
    fontSize: 10,
  },
  btn: {
    padding: "4px 12px",
    fontSize: 11,
    fontWeight: 600,
    border: "1px solid var(--accent)",
    borderRadius: 4,
    background: "var(--accent-glow)",
    color: "var(--accent)",
    cursor: "pointer",
  },
  btnDanger: {
    padding: "4px 12px",
    fontSize: 11,
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
};
