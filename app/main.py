"""ψ-RigolPlus Desktop App — PySide6 + RIGOL USBTMC."""

import sys
from pathlib import Path

# Ensure project root is on sys.path so `bridge.rigol` can be imported
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from PySide6.QtWidgets import (
    QApplication, QMainWindow, QTabWidget, QWidget, QVBoxLayout,
    QStatusBar, QMessageBox,
)
from PySide6.QtCore import Qt, QTimer

from bridge.rigol import RigolManager, RigolDevice
from app.connection_bar import ConnectionBar
from app.scope_panel import ScopePanel
from app.fg_panel import FunctionGenPanel
from app.worker import WaveformWorker, MeasureWorker

# ── Dark Theme Stylesheet ──
DARK_STYLE = """
QMainWindow, QWidget {
    background-color: #0a1620;
    color: #c0d0e0;
    font-family: -apple-system, "Segoe UI", Arial, sans-serif;
}
QTabWidget::pane {
    border: 1px solid #1e3550;
    background: #0d1a28;
    margin-top: -1px;
}
QTabBar::tab {
    background: #091218;
    color: #547898;
    padding: 10px 24px;
    border: 1px solid transparent;
    border-bottom: 2px solid transparent;
    font-size: 13px;
    font-weight: 600;
}
QTabBar::tab:selected {
    color: #00D4FF;
    border-bottom: 2px solid #00D4FF;
}
QTabBar::tab:hover {
    color: #80e4ff;
}
QComboBox {
    background: #0d1a28;
    border: 1px solid #2a4a6a;
    border-radius: 3px;
    padding: 4px 8px;
    color: #c0d0e0;
}
QComboBox:hover { border-color: #3a6a9a; }
QComboBox:disabled { color: #3a4a5a; }
QComboBox QAbstractItemView {
    background: #0d1a28;
    border: 1px solid #2a4a6a;
    selection-background-color: #1e3550;
    color: #c0d0e0;
}
QCheckBox { spacing: 6px; }
QCheckBox:disabled { color: #3a4a5a; }
QPushButton {
    background: #0d1a28;
    border: 1px solid #2a4a6a;
    border-radius: 3px;
    padding: 5px 14px;
    color: #c0d0e0;
    font-size: 12px;
}
QPushButton:hover {
    background: #152535;
    border-color: #3a6a9a;
}
QPushButton:pressed {
    background: #0a1620;
}
QPushButton:disabled {
    color: #3a4a5a;
    border-color: #1a2a3a;
}
QSlider::groove:horizontal {
    height: 4px;
    background: #1e3550;
    border-radius: 2px;
}
QSlider::handle:horizontal {
    width: 14px;
    height: 14px;
    background: #00D4FF;
    border-radius: 7px;
    margin: -5px 0;
}
QLabel { color: #c0d0e0; }
QGroupBox {
    color: #547898;
    border: 1px solid #1e3550;
    border-radius: 4px;
    margin-top: 8px;
    padding-top: 14px;
    font-size: 11px;
    font-weight: bold;
}
QGroupBox::title {
    subcontrol-origin: margin;
    left: 12px;
    padding: 0 4px;
}
QStatusBar {
    background: #091218;
    color: #547898;
    border-top: 1px solid #1e3550;
    font-size: 11px;
}
QMenu {
    background: #0d1a28;
    border: 1px solid #2a4a6a;
    color: #c0d0e0;
}
QMenu::item:selected {
    background: #1e3550;
}
"""


class MainWindow(QMainWindow):
    """Main application window."""

    def __init__(self):
        super().__init__()
        self.setWindowTitle("ψ-RigolPlus")
        self.setMinimumSize(960, 680)
        self.resize(1024, 720)

        self._manager = RigolManager()
        self._device: RigolDevice | None = None
        self._waveform_workers: dict[int, WaveformWorker] = {}
        self._measure_worker: MeasureWorker | None = None

        self._setup_ui()
        self._wire_signals()

    def _setup_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout(central)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Connection bar
        self.conn_bar = ConnectionBar()
        layout.addWidget(self.conn_bar)

        # Tabs
        self.tabs = QTabWidget()
        self.scope_panel = ScopePanel()
        self.fg_panel = FunctionGenPanel()
        self.tabs.addTab(self.scope_panel, "📡 Oscilloscope")
        self.tabs.addTab(self.fg_panel, "⚡ Function Gen")
        layout.addWidget(self.tabs, stretch=1)

        # Status bar
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("Ready — click Scan to find devices")

    def _wire_signals(self):
        self.conn_bar.scan_requested.connect(self._on_scan)
        self.conn_bar.connect_requested.connect(self._on_connect)
        self.conn_bar.disconnect_requested.connect(self._on_disconnect)

        # Scope panel measure poll triggers
        self.scope_panel.timebase_combo.currentTextChanged.connect(
            self._on_timebase_changed)
        self.scope_panel.tr_source.currentIndexChanged.connect(
            self._on_trigger_changed)
        self.scope_panel.tr_slope.currentIndexChanged.connect(
            self._on_trigger_changed)

        # Channel controls
        for ch in range(1, 5):
            scale = getattr(self.scope_panel, f"_ch{ch}_scale", None)
            offset = getattr(self.scope_panel, f"_ch{ch}_offset", None)
            coupl = getattr(self.scope_panel, f"_ch{ch}_coupl", None)
            cb = getattr(self.scope_panel, f"_ch{ch}_cb", None)
            if scale:
                scale.currentTextChanged.connect(lambda text, c=ch: self._on_channel_param(c, "scale", text))
            if offset:
                offset.currentTextChanged.connect(lambda text, c=ch: self._on_channel_param(c, "offset", text))
            if coupl:
                coupl.currentTextChanged.connect(lambda text, c=ch: self._on_channel_param(c, "coupling", text))
            if cb:
                cb.toggled.connect(lambda on, c=ch: self._on_channel_display(c, on))

        # FG panel
        self.fg_panel.wave_combo.currentTextChanged.connect(self._on_fg_param)
        self.fg_panel.freq_combo.currentTextChanged.connect(self._on_fg_param)
        self.fg_panel.amp_combo.currentTextChanged.connect(self._on_fg_param)
        self.fg_panel.offset_combo.currentTextChanged.connect(self._on_fg_param)
        self.fg_panel.output_btn.toggled.connect(self._on_fg_output)

    # ── Device Management ──

    def _on_scan(self):
        self.conn_bar.set_scanning(True)
        self.status_bar.showMessage("Scanning for RIGOL devices…")
        QTimer.singleShot(100, self._do_scan)

    def _do_scan(self):
        try:
            addresses = self._manager.connect()
            devices = self._manager.list_devices()
            self.conn_bar.set_devices(devices)

            if devices:
                self.status_bar.showMessage(
                    f"Found {len(devices)} device(s): " +
                    ", ".join(d["model"] for d in devices)
                )
            else:
                self.status_bar.showMessage("No RIGOL devices found — plug USB and try again")
        except Exception as e:
            self.status_bar.showMessage(f"Scan error: {e}")
        finally:
            self.conn_bar.set_scanning(False)

    def _on_connect(self, addr: str):
        if not addr:
            return
        # Extract address from label "DHO814 — USB::0x1AB1..."
        for d in self._manager.list_devices():
            if d["address"] in addr or d["model"] in addr:
                addr = d["address"]
                break

        device = self._manager.get_device(addr)
        if not device:
            self.status_bar.showMessage("Device not found — try scanning again")
            return

        self._device = device
        self.conn_bar.set_connected(True, device.model)

        if device.is_scope():
            self._start_scope(device)
            self.status_bar.showMessage(f"Connected to {device.model} — {device.identity}")
        elif device.is_func_gen():
            self._start_fg(device)
            self.status_bar.showMessage(f"Connected to {device.model}")
        else:
            self.status_bar.showMessage(f"Unknown device: {device.model}")

    def _on_disconnect(self):
        self._stop_all_workers()
        if self._device:
            self._device.close()
            self._device = None
        self._manager.disconnect_all()
        self.conn_bar.set_connected(False)
        self.scope_panel.chart.clear_all()
        self.status_bar.showMessage("Disconnected")

    def _start_scope(self, device: RigolDevice):
        # Get initial state — lightweight: just check if CH1 is alive
        try:
            state = device.scope_get_state()
            self.scope_panel.update_state(state)
            ch1_on = state.get("channels", {}).get("CH1", {}).get("enabled", False)
        except Exception:
            ch1_on = False  # if state read fails, assume off

        # Only touch device if CH1 is NOT already enabled
        if not ch1_on:
            device.write(":CHANnel1:DISPlay ON")
            self.scope_panel._ch1_cb.setChecked(True)

        # Always start waveform on CH1
        self._start_waveform(1, 500)
        self.status_bar.showMessage(f"Connected — waveform polling CH1...")

        # Start measurement worker on CH1
        self._measure_worker = MeasureWorker(device, 1, 1000)
        self._measure_worker.measurements_ready.connect(
            self.scope_panel.set_measurements)
        self._measure_worker.error.connect(
            lambda e: self.status_bar.showMessage(f"Measure error: {e}"))
        self._measure_worker.start()

    def _start_fg(self, device: RigolDevice):
        try:
            state = device.fg_get_state()
            self.fg_panel.update_state(state)
        except Exception:
            pass

    def _start_waveform(self, channel: int, interval_ms: int = 200):
        if channel in self._waveform_workers:
            return
        worker = WaveformWorker(self._device, channel, interval_ms)
        worker.frame_ready.connect(
            lambda data, ch=channel: self.scope_panel.update_waveform(
                ch, data["samples"], data["x_inc"], data["v_scale"]
            )
        )
        worker.error.connect(
            lambda e, ch=channel: print(f"[CH{ch}] {e}")
        )
        self._waveform_workers[channel] = worker
        worker.start()

    def _stop_waveform(self, channel: int):
        worker = self._waveform_workers.pop(channel, None)
        if worker:
            worker.stop()
            self.scope_panel.chart_view.clear_channel(channel)

    def _stop_all_workers(self):
        for ch in list(self._waveform_workers.keys()):
            self._stop_waveform(ch)
        if self._measure_worker:
            self._measure_worker.stop()
            self._measure_worker = None

    # ── Scope Controls ──

    def _on_channel_param(self, ch: int, param: str, text: str):
        if not self._device:
            return
        try:
            if param == "scale":
                text = text.replace("mV", "e-3").replace("V", "")
                val = float(text)
            elif param == "offset":
                val = float(text.replace("V", ""))
            else:
                val = text
            self._device.scope_set_channel(ch, param, val)
        except ValueError:
            pass

    def _on_channel_display(self, ch: int, enabled: bool):
        if not self._device:
            return
        self._device.scope_set_channel(ch, "display", enabled)
        if enabled:
            self._start_waveform(ch)
        else:
            self._stop_waveform(ch)

    def _on_timebase_changed(self, text: str):
        if not self._device or not self._device.is_scope():
            return
        scale = self._parse_timebase(text)
        if scale:
            self._device.scope_set_timebase(scale)

    def _on_trigger_changed(self):
        if not self._device or not self._device.is_scope():
            return
        source = self.scope_panel.tr_source.currentText()
        slope_text = self.scope_panel.tr_slope.currentText()
        slope = "POS" if "↑" in slope_text else "NEG"
        self._device.scope_set_trigger("source", source)
        self._device.scope_set_trigger("slope", slope)

    # ── FG Controls ──

    def _on_fg_param(self):
        if not self._device or not self._device.is_func_gen():
            return
        try:
            func = self.fg_panel.wave_combo.currentText()
            freq_text = self.fg_panel.freq_combo.currentText()
            amp_text = self.fg_panel.amp_combo.currentText()
            offset_text = self.fg_panel.offset_combo.currentText()

            self._device.fg_set(1, "function", func)
            self._device.fg_set(1, "frequency", self._parse_frequency(freq_text))
            self._device.fg_set(1, "amplitude", float(amp_text.replace("V", "").replace("m", "e-3")))
            self._device.fg_set(1, "offset", float(offset_text.replace("V", "")))
        except ValueError:
            pass

    def _on_fg_output(self, on: bool):
        if not self._device or not self._device.is_func_gen():
            return
        self._device.fg_set(1, "output", on)
        self.fg_panel.output_btn.setText("▶ Output ON" if on else "▶ Output OFF")

    # ── Helpers ──

    @staticmethod
    def _parse_timebase(text: str) -> float | None:
        text = text.replace(" ", "")
        try:
            if text.endswith("ns"):
                return float(text[:-2]) * 1e-9
            if text.endswith("µs") or text.endswith("us"):
                return float(text[:-2]) * 1e-6
            if text.endswith("ms"):
                return float(text[:-2]) * 1e-3
            if text.endswith("s"):
                return float(text[:-1])
        except ValueError:
            pass
        return None

    @staticmethod
    def _parse_frequency(text: str) -> float:
        text = text.replace(" ", "")
        try:
            if text.endswith("MHz"):
                return float(text[:-3]) * 1e6
            if text.endswith("kHz"):
                return float(text[:-3]) * 1e3
            if text.endswith("Hz"):
                return float(text[:-2])
        except ValueError:
            pass
        return 1000.0

    def closeEvent(self, event):
        self._stop_all_workers()
        if self._device:
            self._device.close()
        self._manager.disconnect_all()
        event.accept()


def main():
    app = QApplication(sys.argv)
    app.setStyleSheet(DARK_STYLE)

    window = MainWindow()
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
