"""QThread workers for background device polling."""

import time
from PySide6.QtCore import QThread, Signal

from bridge.rigol import RigolDevice


class WaveformWorker(QThread):
    """Polls waveform from a single channel at fixed interval."""

    frame_ready = Signal(dict)   # waveform data dict
    error = Signal(str)

    def __init__(self, device: RigolDevice, channel: int, interval_ms: int = 500):
        super().__init__()
        self.device = device
        self.channel = channel
        self.interval_ms = interval_ms
        self._running = False

    def run(self):
        self._running = True
        # Give device a moment to settle after connect
        time.sleep(0.3)
        while self._running:
            try:
                data = self.device.scope_fetch_waveform(self.channel)
                if data:
                    self.frame_ready.emit(data)
            except Exception as e:
                self.error.emit(str(e))
            time.sleep(self.interval_ms / 1000.0)

    def stop(self):
        self._running = False
        self.wait(2000)


class MeasureWorker(QThread):
    """Polls auto-measurements periodically."""

    measurements_ready = Signal(dict)  # { "VPP": "3.3", "FREQ": "1e3", ... }
    error = Signal(str)

    def __init__(self, device: RigolDevice, channel: int, interval_ms: int = 1000):
        super().__init__()
        self.device = device
        self.channel = channel
        self.interval_ms = interval_ms
        self._running = False
        self._meas_types = ["VPP", "FREQuency", "PERiod", "RISetime"]

    def run(self):
        self._running = True
        while self._running:
            results = {}
            try:
                for mtype in self._meas_types:
                    val = self.device.scope_measure(mtype, self.channel)
                    results[mtype] = val
                self.measurements_ready.emit(results)
            except Exception as e:
                self.error.emit(str(e))
            time.sleep(self.interval_ms / 1000.0)

    def stop(self):
        self._running = False
        self.wait(2000)
