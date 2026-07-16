# ψ-RigolPlus
Remote control for RIGOL DHO814 & DG822 Pro via USB — Web frontend + Python bridge.

## Architecture

```
Browser (Next.js static) ──WebSocket──▶ Python Bridge ──PyVISA/USB──▶ RIGOL Instruments
```

## Prerequisites

- Python 3.9+
- Node.js 18+
- libusb (macOS: `brew install libusb`)
- Chrome or Edge (for WebUSB fallback, optional)

## Setup

### 1. Python Bridge

```bash
cd bridge
python3 -m venv venv
source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

### 2. Frontend

```bash
cd frontend
npm install
```

## Run (Development)

### Terminal 1 — Bridge

```bash
cd bridge
source venv/bin/activate
python bridge.py
# → Bridge running on ws://localhost:9120
```

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
# → Open http://localhost:3000
```

## Deploy to GitHub Pages

```bash
cd frontend
npm run build   # exports to out/
# Push 'out/' directory to gh-pages branch
```

## License

MIT
