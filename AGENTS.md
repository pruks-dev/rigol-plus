# ψ-RigolPlus — AI Agent Context

> Last updated: 2026-07-15 | Slice 2 complete | DG822 pending physical connection

## Project Mission

Remote control RIGOL DHO814 (oscilloscope) and DG822 Pro (function generator) via USB from a web browser, using a Python bridge for USB ↔ WebSocket communication.

## Architecture

```
Browser (Next.js static)
  │ WebSocket (ws://localhost:9120)
  ▼
Python Bridge (asyncio + PyVISA-py)
  │ USB (USBTMC via libusb)
  ▼
RIGOL DHO814 / DG822 Pro
```

| Layer | Dir | Stack |
|-------|-----|-------|
| Frontend | `frontend/` | Next.js 15 (App Router), TypeScript, static export |
| Bridge | `bridge/` | Python 3.10, PyVISA + PyVISA-py, websockets, pyusb |
| Transport | — | WebSocket (JSON messages), USBTMC (USB Test & Measurement Class) |

## How to Run

```bash
# Terminal 1 — Bridge
cd bridge && source venv/bin/activate && python bridge.py

# Terminal 2 — Frontend
cd frontend && npm run dev
# → http://localhost:3000
```

**Prerequisites:** Python 3.9+, Node 18+, libusb (`brew install libusb` on macOS)

## Key Files

### Bridge (`bridge/`)
| File | Role |
|------|------|
| `bridge.py` | WebSocket server + message routing (port 9120) |
| `rigol.py` | RIGOL device handler: SCPI, binary parser, waveform fetch |
| `requirements.txt` | pyvisa, pyvisa-py, websockets, pyusb |

### Frontend (`frontend/`)
| File | Role |
|------|------|
| `app/page.tsx` | Entry → `<ScopePanel />` |
| `components/ScopePanel.tsx` | Main orchestrator: WebSocket wiring, state, tabs |
| `components/WaveformCanvas.tsx` | `<canvas>` 600×400 grid + multi-channel waveform traces |
| `components/ChannelControls.tsx` | CH1-4: toggle, scale knob (◀▶), offset knob |
| `components/TimebaseControl.tsx` | Timebase ▲▼ preset selector |
| `components/TriggerPanel.tsx` | Trigger: source, level, slope |
| `components/MeasurementBar.tsx` | Auto-measure: Vpp, Freq, Period, Rise |
| `components/BridgeStatus.tsx` | Connection bar: connect/disconnect/scan |
| `components/FunctionGenPanel.tsx` | DG822: waveform, freq, amp, offset, output toggle |
| `lib/websocket.ts` | WebSocket client with auto-reconnect |
| `lib/scpi.ts` | SCPI presets, command builders, constants |

## WebSocket Protocol

All messages are JSON. Client → Bridge → Device.

| Type | Direction | Key Fields |
|------|-----------|------------|
| `scan` | C→B | — (discovers RIGOL devices) |
| `scan_result` | B→C | `devices[]` |
| `scope_state` | C→B | `address` |
| `scope_state` | B→C | `channels`, `timebase`, `trigger` |
| `waveform_start` | C→B | `address`, `channel`, `interval_ms` |
| `waveform_stop` | C→B | `address`, `channel` |
| `waveform_frame` | B→C | `channel`, `samples[]`, `v_scale`, `t_scale` |
| `scope_set` | C→B | `address`, `channel`, `param`, `value` |
| `timebase_set` | C→B | `address`, `scale` |
| `trigger_set` | C→B | `address`, `param`, `value` |
| `measure` | C→B | `address`, `measurement`, `channel` |
| `fg_state` | C→B | `address` |
| `fg_set` | C→B | `address`, `channel`, `param`, `value` |
| `query` / `write` | C→B | `address`, `command` (raw SCPI) |

## DHO814 SCPI Quirks (firmware 00.01.05)

- **`:WAVeform` long form fails** — use short form `:WAV` only
- **`:WAV:POINts 1200` → -200 error** — default 1000 points only, skip POINts
- **`:CHAN:PROBe?` not supported** — removed from state query
- **`:TRIGger:SWEep?` unreliable** — hardcoded "AUTO"
- **Preamble must be read as binary** — `read_raw()` then decode ASCII
- **`*CLS` before every waveform fetch** — clears parser state
- **Source syntax:** `:WAV:SOURce CHAN1` (short) works, `CHANnel1` also OK

## Scope State (returned from `scope_get_state()`)

```json
{
  "channels": {
    "CH1": {"enabled": true, "scale": 0.05, "offset": 0.0, "coupling": "DC"},
    "CH2": {"enabled": false, ...},
    ...
  },
  "timebase": {"scale": 2e-06, "offset": 0.0},
  "trigger": {"source": "CHAN1", "level": 0.0, "slope": "POS", "mode": "AUTO"}
}
```

## Current Status

| Feature | Status |
|---------|--------|
| DHO814 connection + *IDN? | ✅ Working |
| Waveform fetch (1000 pts, real-time 500ms) | ✅ Working |
| Waveform Canvas rendering (grid + traces) | ✅ Working |
| Channel scale/offset control (knob style) | ✅ Working |
| Timebase control (knob style) | ✅ Working |
| Trigger source/level/slope control | ✅ Working |
| Auto measurements (Vpp, Freq, Period, Rise) | ✅ Working |
| Function Gen Panel UI | ✅ Ready |
| DG822 Pro connection | ⏳ Not plugged in yet |

## DG822 Pro — Next Steps

1. Plug DG822 Pro via USB-B cable (data cable, not charge-only)
2. Run `python bridge.py` — auto-detects via VID `0x1AB1`
3. Switch to "⚡ Function Gen" tab — panel is ready
4. SCPI commands: `:SOURce1:FUNCtion`, `:FREQuency`, `:VOLTage`, `:OUTPut1:STATe`
