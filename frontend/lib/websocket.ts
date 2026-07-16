/**
 * WebSocket client for ψ-RigolPlus Bridge
 * Connects to ws://localhost:9120 by default.
 */

const DEFAULT_URL = "ws://localhost:9120";

export interface RigolDevice {
  address: string;
  identity: string;
  model: string;
  connected: boolean;
}

export interface WsMessage {
  [key: string]: unknown;
  type: string;
  devices?: RigolDevice[];
  address?: string;
  command?: string;
  response?: string;
  error?: string;
  message?: string;
}

type MessageHandler = (msg: WsMessage) => void;

let ws: WebSocket | null = null;
let handlers: MessageHandler[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let url = DEFAULT_URL;

export function setBridgeUrl(newUrl: string) {
  url = newUrl;
}

export function connect(): void {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log("[ws] connected to bridge");
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    notify({ type: "connected" });
  };

  ws.onmessage = (event) => {
    try {
      const msg: WsMessage = JSON.parse(event.data);
      notify(msg);
    } catch {
      console.error("[ws] bad message:", event.data);
    }
  };

  ws.onclose = () => {
    console.log("[ws] disconnected — reconnecting in 2s");
    ws = null;
    notify({ type: "disconnected" });
    reconnectTimer = setTimeout(connect, 2000);
  };

  ws.onerror = (err) => {
    console.error("[ws] error:", err);
  };
}

export function disconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.onclose = null; // prevent auto-reconnect
    ws.close();
    ws = null;
  }
}

export function send(msg: Record<string, unknown>): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  } else {
    console.warn("[ws] not connected, cannot send");
  }
}

export function onMessage(handler: MessageHandler): () => void {
  handlers.push(handler);
  return () => {
    handlers = handlers.filter((h) => h !== handler);
  };
}

function notify(msg: WsMessage): void {
  handlers.forEach((h) => h(msg));
}

export function getState(): "connected" | "connecting" | "disconnected" {
  if (!ws) return "disconnected";
  switch (ws.readyState) {
    case WebSocket.OPEN:
      return "connected";
    case WebSocket.CONNECTING:
      return "connecting";
    default:
      return "disconnected";
  }
}
