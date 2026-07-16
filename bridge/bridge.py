#!/usr/bin/env python3
"""
ψ-RigolPlus Bridge — WebSocket ↔ PyVISA ↔ RIGOL Instruments

Usage: python bridge.py [--port 9120]
"""
import asyncio
import json
import logging
import argparse
import signal
from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosed
from rigol import RigolManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("bridge")

rm = RigolManager()

# ── Waveform Poll Tasks ────────────────────────────────────────
# addr -> asyncio.Task
_waveform_tasks: dict[str, dict[str, asyncio.Task]] = {}


async def waveform_poll(addr: str, channel: int, interval_ms: int, websocket):
    """Background task: poll scope waveform and push to WebSocket."""
    while True:
        try:
            dev = rm.get_device(addr)
            if dev is None or not dev.is_scope():
                break
            wf = dev.scope_fetch_waveform(channel)
            if wf:
                try:
                    await websocket.send(json.dumps({
                        "type": "waveform_frame",
                        "address": addr,
                        **wf,
                    }))
                except ConnectionClosed:
                    break
        except Exception as e:
            logger.error(f"Waveform poll error: {e}")
        await asyncio.sleep(interval_ms / 1000.0)


async def handler(websocket):
    """Handle a single WebSocket client connection."""
    client_addr = websocket.remote_address
    logger.info(f"Client connected: {client_addr}")

    # Track this client's waveform subscriptions
    client_tasks: dict[str, asyncio.Task] = {}

    async def stop_all_polls():
        for key, task in list(client_tasks.items()):
            if not task.done():
                task.cancel()
            del client_tasks[key]

    try:
        async for message in websocket:
            try:
                data = json.loads(message)
            except json.JSONDecodeError:
                await websocket.send(json.dumps({"error": "invalid JSON"}))
                continue

            msg_type = data.get("type")
            addr = data.get("address", "")

            # ── Scan ──
            if msg_type == "scan":
                found = rm.connect()
                await websocket.send(json.dumps({
                    "type": "scan_result",
                    "devices": rm.list_devices(),
                }))

            # ── Query ──
            elif msg_type == "query":
                cmd = data.get("command", "")
                if not addr or not cmd:
                    await websocket.send(json.dumps({
                        "type": "error", "message": "address and command required",
                    }))
                    continue
                dev = rm.get_device(addr)
                result = dev.query(cmd) if dev else "ERROR: device not found"
                await websocket.send(json.dumps({
                    "type": "query_result", "address": addr,
                    "command": cmd, "response": result,
                }))

            # ── Write ──
            elif msg_type == "write":
                cmd = data.get("command", "")
                dev = rm.get_device(addr)
                if dev:
                    dev.write(cmd)
                await websocket.send(json.dumps({
                    "type": "write_ack", "address": addr, "command": cmd,
                }))

            # ── Waveform Poll ──
            elif msg_type == "waveform_start":
                channel = data.get("channel", 1)
                interval = data.get("interval", 500)
                key = f"{addr}_ch{channel}"
                if key in client_tasks and not client_tasks[key].done():
                    client_tasks[key].cancel()
                task = asyncio.create_task(
                    waveform_poll(addr, channel, interval, websocket)
                )
                client_tasks[key] = task
                await websocket.send(json.dumps({
                    "type": "waveform_started", "address": addr, "channel": channel,
                }))

            elif msg_type == "waveform_stop":
                channel = data.get("channel", 1)
                key = f"{addr}_ch{channel}"
                if key in client_tasks:
                    client_tasks[key].cancel()
                    del client_tasks[key]
                await websocket.send(json.dumps({
                    "type": "waveform_stopped", "address": addr, "channel": channel,
                }))

            # ── Scope State ──
            elif msg_type == "scope_state":
                dev = rm.get_device(addr)
                state = dev.scope_get_state() if dev else {}
                await websocket.send(json.dumps({
                    "type": "scope_state", "address": addr, **state,
                }))

            # ── Scope Set ──
            elif msg_type == "scope_set":
                dev = rm.get_device(addr)
                param = data.get("param", "")
                value = data.get("value")
                if dev and dev.is_scope():
                    resp = dev.scope_set_channel(
                        data.get("channel", 1), param, value
                    )
                    await websocket.send(json.dumps({
                        "type": "scope_set_ack", "address": addr,
                        "param": param, "value": value, "response": resp,
                    }))
                else:
                    await websocket.send(json.dumps({
                        "type": "error", "message": "device not found or not a scope",
                    }))

            # ── Scope Timebase ──
            elif msg_type == "timebase_set":
                dev = rm.get_device(addr)
                scale = data.get("scale")
                if dev and dev.is_scope():
                    resp = dev.scope_set_timebase(scale)
                    await websocket.send(json.dumps({
                        "type": "timebase_set_ack", "address": addr,
                        "scale": scale, "response": resp,
                    }))

            # ── Scope Trigger ──
            elif msg_type == "trigger_set":
                dev = rm.get_device(addr)
                param = data.get("param", "")
                value = data.get("value")
                if dev and dev.is_scope():
                    resp = dev.scope_set_trigger(param, value)
                    await websocket.send(json.dumps({
                        "type": "trigger_set_ack", "address": addr,
                        "param": param, "value": value, "response": resp,
                    }))

            # ── Scope Measure ──
            elif msg_type == "measure":
                dev = rm.get_device(addr)
                meas = data.get("measurement", "VPP")
                ch = data.get("channel", 1)
                if dev and dev.is_scope():
                    value = dev.scope_measure(meas, ch)
                    await websocket.send(json.dumps({
                        "type": "measure_result", "address": addr,
                        "measurement": meas, "channel": ch, "value": value,
                    }))

            # ── Func Gen State ──
            elif msg_type == "fg_state":
                dev = rm.get_device(addr)
                state = dev.fg_get_state() if dev else {}
                await websocket.send(json.dumps({
                    "type": "fg_state", "address": addr, **state,
                }))

            # ── Func Gen Set ──
            elif msg_type == "fg_set":
                dev = rm.get_device(addr)
                param = data.get("param", "")
                value = data.get("value")
                ch = data.get("channel", 1)
                if dev and dev.is_func_gen():
                    resp = dev.fg_set(ch, param, value)
                    await websocket.send(json.dumps({
                        "type": "fg_set_ack", "address": addr,
                        "channel": ch, "param": param, "value": value, "response": resp,
                    }))
                else:
                    await websocket.send(json.dumps({
                        "type": "error", "message": "device not found or not a func gen",
                    }))

            # ── Disconnect Device ──
            elif msg_type == "disconnect":
                dev = rm.get_device(addr)
                if dev:
                    dev.close()
                    del rm.devices[addr]
                    await websocket.send(json.dumps({
                        "type": "disconnected", "address": addr,
                    }))

            else:
                await websocket.send(json.dumps({
                    "type": "error",
                    "message": f"unknown message type: {msg_type}",
                }))

    except ConnectionClosed:
        logger.info(f"Client disconnected: {client_addr}")
    except Exception as e:
        logger.error(f"Handler error: {e}")
        try:
            await websocket.send(json.dumps({"error": str(e)}))
        except Exception:
            pass
    finally:
        await stop_all_polls()


async def main(port: int):
    """Start the WebSocket bridge server."""
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, lambda: asyncio.create_task(shutdown()))
        except NotImplementedError:
            pass

    logger.info(f"ψ-RigolPlus Bridge starting on ws://0.0.0.0:{port}")
    async with serve(handler, "0.0.0.0", port):
        logger.info("Bridge ready — waiting for clients...")
        await asyncio.get_running_loop().create_future()


async def shutdown():
    logger.info("Shutting down...")
    rm.disconnect_all()
    tasks = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ψ-RigolPlus Bridge")
    parser.add_argument("--port", type=int, default=9120, help="WebSocket port")
    args = parser.parse_args()

    try:
        asyncio.run(main(args.port))
    except KeyboardInterrupt:
        logger.info("Bridge stopped.")
    finally:
        rm.disconnect_all()
