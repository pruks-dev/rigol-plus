"""
RIGOL Device Handler — USBTMC via PyVISA-py (pure Python, no NI-VISA needed).
Supports DHO814 (oscilloscope) and DG822 Pro (function generator).
"""
import struct
import pyvisa
import logging

logger = logging.getLogger(__name__)

RIGOL_VID = 0x1AB1


def _safe_float(val: str, default: float = 0.0) -> float:
    """Convert string to float without raising on bad input."""
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def parse_ieee_block(raw: bytes) -> bytes:
    """Parse IEEE 488.2 definite-length binary block.
    
    Format: #<N><digits><data>
      #9  = header, 9 more bytes describe data length
      0012000 = 12000 bytes of data follow
    """
    if not raw or raw[0:1] != b"#":
        return b""
    try:
        n = int(raw[1:2])  # digit count
        length = int(raw[2 : 2 + n])  # byte count
        return raw[2 + n : 2 + n + length]
    except (ValueError, IndexError):
        return b""


class RigolDevice:
    """Represents a single connected RIGOL instrument."""

    def __init__(self, address: str, rm: pyvisa.ResourceManager):
        self.address = address
        self.rm = rm
        self.device: pyvisa.Resource | None = None
        self.identity: str = ""
        self.model: str = ""
        self._cache: dict = {}  # state cache

    def open(self) -> bool:
        """Open the VISA resource and query identity."""
        try:
            self.device = self.rm.open_resource(self.address)
            self.device.timeout = 10000
            self.device.read_termination = "\n"
            self.device.write_termination = "\n"
            self.identity = self.query("*IDN?")
            parts = self.identity.split(",")
            self.model = parts[1] if len(parts) > 1 else "Unknown"
            logger.info(f"Opened {self.model}: {self.identity}")
            return True
        except Exception as e:
            logger.error(f"Failed to open {self.address}: {e}")
            return False

    def is_scope(self) -> bool:
        return self.model.upper().startswith("DHO")

    def is_func_gen(self) -> bool:
        return self.model.upper().startswith("DG")

    def query(self, cmd: str) -> str:
        """Send SCPI command and read ASCII response. Retries once on timeout/binary noise."""
        if self.device is None:
            return "ERROR: device not open"
        for attempt in range(2):
            try:
                self.device.write(cmd)
                raw = self.device.read_raw()
                # Try ASCII decode; DHO814 sometimes returns trailing binary junk
                return raw.decode("ascii", errors="ignore").strip()
            except Exception as e:
                if attempt == 0:
                    # Clear device and retry
                    try:
                        self.device.write("*CLS")
                    except Exception:
                        pass
                    continue
                logger.error(f"SCPI query failed: {cmd} -> {e}")
                return f"ERROR: {e}"
        return "ERROR: timeout"

    def write(self, cmd: str) -> None:
        if self.device is None:
            return
        try:
            self.device.write(cmd)
        except Exception as e:
            logger.error(f"SCPI write failed: {cmd} -> {e}")

    def query_binary(self, cmd: str) -> bytes:
        """Send command and read raw binary response (for waveform data)."""
        if self.device is None:
            return b""
        try:
            self.device.write(cmd)
            return self.device.read_raw()
        except Exception as e:
            logger.error(f"Binary query failed: {cmd} -> {e}")
            return b""

    def close(self):
        if self.device is not None:
            try:
                self.device.close()
            except Exception:
                pass
            self.device = None

    def to_dict(self) -> dict:
        return {
            "address": self.address,
            "identity": self.identity,
            "model": self.model,
            "connected": self.device is not None,
        }

    # ── Scope-specific ──────────────────────────────────────────

    def scope_fetch_waveform(self, channel: int = 1) -> dict | None:
        """Fetch waveform data from a single channel. Returns dict with samples + metadata."""
        if not self.is_scope() or self.device is None:
            return None
        try:
            # Reset device parser to clean state
            self.device.write("*CLS")
            self.device.timeout = 15000  # Waveform fetch needs longer timeout

            # Use short-form SCPI — DHO800 series is picky about syntax
            self.device.write(f":WAV:SOURce CHAN{channel}")
            self.device.write(":WAV:FORMat BYTE")
            # skip POINts — default 1000 is standard, other values cause -200 error

            # Read preamble as binary
            self.device.write(":WAV:PREamble?")
            preamble_raw = self.device.read_raw()
            preamble = preamble_raw.decode("ascii", errors="ignore").strip().split(",")

            # Fetch raw waveform data
            raw = self.query_binary(":WAV:DATA?")
            data = parse_ieee_block(raw)

            if not data:
                self.device.timeout = 10000
                return None

            samples = list(data)  # int 0-255

            # Preamble: format, type, points, count, xinc, xorg, xref, yinc, yorg, yref
            y_inc = float(preamble[7]) if len(preamble) > 7 else 0.01
            y_org = float(preamble[8]) if len(preamble) > 8 else 0
            y_ref = float(preamble[9]) if len(preamble) > 9 else 127
            x_inc = float(preamble[4]) if len(preamble) > 4 else 1e-6
            x_org = float(preamble[5]) if len(preamble) > 5 else 0

            # Convert to voltage values
            voltages = [(s - y_ref) * y_inc + y_org for s in samples]

            # Read scale/offset for context
            v_scale = _safe_float(self.query(f":CHANnel{channel}:SCALe?"), 1.0)
            v_offset = _safe_float(self.query(f":CHANnel{channel}:OFFSet?"), 0.0)
            t_scale = _safe_float(self.query(":TIMebase:MAIN:SCALe?"), 0.001)

            # Clear any residual SCPI errors on device
            self.device.write("*CLS")
            self.device.timeout = 10000

            return {
                "channel": channel,
                "samples": voltages,
                "raw_samples": samples,
                "sample_count": len(voltages),
                "v_scale": v_scale,
                "v_offset": v_offset,
                "t_scale": t_scale,
                "x_inc": x_inc,
                "y_inc": y_inc,
                "y_org": y_org,
                "y_ref": y_ref,
            }
        except Exception as e:
            logger.error(f"Waveform fetch CH{channel} failed: {e}")
            try:
                self.device.write("*CLS")  # clear errors even on failure
                self.device.timeout = 10000
            except Exception:
                pass
            return None

    def scope_get_state(self) -> dict:
        """Get current scope state (all channels, timebase, trigger). Suppresses SCPI errors."""
        state: dict = {"model": self.model, "channels": {}, "timebase": {}, "trigger": {}}
        if not self.is_scope():
            return state

        try:
            state["timebase"] = {
                "scale": _safe_float(self.query(":TIMebase:MAIN:SCALe?")),
                "offset": _safe_float(self.query(":TIMebase:MAIN:OFFSet?")),
            }

            state["trigger"] = {
                "source": self.query(":TRIGger:EDGE:SOURce?") or "CHAN1",
                "level": _safe_float(self.query(":TRIGger:EDGE:LEVel?")),
                "slope": self.query(":TRIGger:EDGE:SLOPe?") or "POS",
                "mode": "AUTO",  # skip SWEep? — not always supported
            }

            for ch in range(1, 5):
                try:
                    enabled = self.query(f":CHANnel{ch}:DISPlay?") or "0"
                    state["channels"][f"CH{ch}"] = {
                        "enabled": enabled.strip() == "1",
                        "scale": _safe_float(self.query(f":CHANnel{ch}:SCALe?")),
                        "offset": _safe_float(self.query(f":CHANnel{ch}:OFFSet?")),
                        "coupling": self.query(f":CHANnel{ch}:COUPling?") or "DC",
                    }
                except Exception:
                    state["channels"][f"CH{ch}"] = {"enabled": False}

            # Clear any pending SCPI errors on device
            self.write("*CLS")
        except Exception as e:
            logger.error(f"Failed to get scope state: {e}")

        return state

    def scope_set_channel(self, ch: int, param: str, value) -> str:
        """Set a channel parameter and return the new value."""
        cmd_map = {
            "scale": (f":CHANnel{ch}:SCALe {value}", f":CHANnel{ch}:SCALe?"),
            "offset": (f":CHANnel{ch}:OFFSet {value}", f":CHANnel{ch}:OFFSet?"),
            "display": (f":CHANnel{ch}:DISPlay {'ON' if value else 'OFF'}", f":CHANnel{ch}:DISPlay?"),
            "coupling": (f":CHANnel{ch}:COUPling {value}", f":CHANnel{ch}:COUPling?"),
        }
        entry = cmd_map.get(param)
        if entry:
            set_cmd, query_cmd = entry
            self.write(set_cmd)
            return self.query(query_cmd)
        return "ERROR: unknown param"

    def scope_set_timebase(self, scale: float) -> str:
        self.write(f":TIMebase:MAIN:SCALe {scale}")
        return self.query(":TIMebase:MAIN:SCALe?")

    def scope_set_trigger(self, param: str, value) -> str:
        cmd_map = {
            "source": f":TRIGger:EDGE:SOURce {value}",
            "level": f":TRIGger:EDGE:LEVel {value}",
            "slope": f":TRIGger:EDGE:SLOPe {value}",
        }
        cmd = cmd_map.get(param)
        if cmd:
            self.write(cmd)
        return "OK"

    def scope_measure(self, meas_type: str, channel: int = 1) -> str:
        """Quick measurement: VPP, FREQ, PER, RIS, FALL"""
        try:
            self.device.write("*CLS")
        except Exception:
            pass
        val = self.query(f":MEASure:{meas_type}? CHANnel{channel}")
        # Strip ERROR prefix if present
        if val and val.upper().startswith("ERROR"):
            return "--"
        return val

    # ── Function Generator-specific ─────────────────────────────

    def fg_set(self, ch: int, param: str, value) -> str:
        """Set function generator parameter for channel (1 or 2)."""
        cmd_map = {
            "function": f":SOURce{ch}:FUNCtion {value}",
            "frequency": f":SOURce{ch}:FREQuency {value}",
            "amplitude": f":SOURce{ch}:VOLTage {value}",
            "offset": f":SOURce{ch}:VOLTage:OFFSet {value}",
            "output": f":OUTPut{ch}:STATe {'ON' if value else 'OFF'}",
        }
        cmd = cmd_map.get(param)
        if cmd:
            self.write(cmd)
        return "OK"

    def fg_get_state(self) -> dict:
        """Get current function generator state."""
        state: dict = {"model": self.model, "channels": {}}
        if not self.is_func_gen():
            return state
        for ch in range(1, 3):
            try:
                state["channels"][f"CH{ch}"] = {
                    "function": self.query(f":SOURce{ch}:FUNCtion?") or "",
                    "frequency": float(self.query(f":SOURce{ch}:FREQuency?") or "0"),
                    "amplitude": float(self.query(f":SOURce{ch}:VOLTage?") or "0"),
                    "offset": float(self.query(f":SOURce{ch}:VOLTage:OFFSet?") or "0"),
                    "output": self.query(f":OUTPut{ch}:STATe?") == "1",
                }
            except Exception:
                state["channels"][f"CH{ch}"] = {"output": False}
        return state


class RigolManager:
    """Discovers and manages RIGOL instruments via PyVISA."""

    def __init__(self):
        self.rm: pyvisa.ResourceManager | None = None
        self.devices: dict[str, RigolDevice] = {}

    def connect(self) -> list[str]:
        if self.rm is not None:
            return list(self.devices.keys())

        try:
            self.rm = pyvisa.ResourceManager("@py")
        except Exception as e:
            logger.error(f"PyVISA init failed: {e}")
            return []

        resources = self.rm.list_resources("?*")
        logger.info(f"Found {len(resources)} VISA resources: {resources}")

        rigol_found = []
        for res in resources:
            addr = str(res)
            if addr.upper().startswith("USB"):
                try:
                    parts = addr.split("::")
                    vid_dec = int(parts[1])
                    if vid_dec == RIGOL_VID:
                        dev = RigolDevice(addr, self.rm)
                        if dev.open():
                            self.devices[addr] = dev
                            rigol_found.append(addr)
                except (IndexError, ValueError):
                    logger.debug(f"Skipping unparseable address: {addr}")

        logger.info(f"RIGOL devices connected: {len(rigol_found)}")
        return rigol_found

    def get_device(self, address: str) -> RigolDevice | None:
        return self.devices.get(address)

    def list_devices(self) -> list[dict]:
        return [d.to_dict() for d in self.devices.values()]

    def disconnect_all(self):
        for dev in self.devices.values():
            dev.close()
        self.devices.clear()
        if self.rm is not None:
            try:
                self.rm.close()
            except Exception:
                pass
            self.rm = None
