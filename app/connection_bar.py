"""Top connection bar: scan, device selector, connect/disconnect."""

from PySide6.QtWidgets import (
    QWidget, QHBoxLayout, QPushButton, QComboBox, QLabel,
)
from PySide6.QtCore import Signal, Qt


CHANNEL_COLORS = {
    1: "#FFB000",  # yellow
    2: "#00D4FF",  # cyan
    3: "#FF40FF",  # magenta
    4: "#00FF88",  # green
}

TIMEBASE_PRESETS = [
    "1ns", "2ns", "5ns", "10ns", "20ns", "50ns", "100ns",
    "200ns", "500ns", "1μs", "2μs", "5μs", "10μs", "20μs",
    "50μs", "100μs", "200μs", "500μs", "1ms", "2ms", "5ms",
    "10ms", "20ms", "50ms", "100ms", "200ms", "500ms", "1s",
]

SCALE_PRESETS = [
    "1mV", "2mV", "5mV", "10mV", "20mV", "50mV", "100mV",
    "200mV", "500mV", "1V", "2V", "5V", "10V",
]

FUNC_WAVEFORMS = ["SIN", "SQU", "RAMP", "PULS", "NOIS", "DC", "ARB"]


class ConnectionBar(QWidget):
    """Top bar: scan button, device dropdown, connect/disconnect."""

    scan_requested = Signal()
    connect_requested = Signal(str)  # address
    disconnect_requested = Signal()
    refresh_requested = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFixedHeight(44)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(12, 6, 12, 6)
        layout.setSpacing(8)

        # Status indicator
        self.status_dot = QLabel("●")
        self.status_dot.setStyleSheet("color: #FF3333; font-size: 14px;")
        self.status_dot.setFixedWidth(20)

        # Title
        self.title = QLabel("ψ-RigolPlus")
        self.title.setStyleSheet("font-weight: bold; font-size: 14px; color: #00D4FF;")

        self.status_text = QLabel("Disconnected")
        self.status_text.setStyleSheet("color: #888; font-size: 11px;")

        layout.addWidget(self.status_dot)
        layout.addWidget(self.title)
        layout.addWidget(self.status_text)
        layout.addStretch()

        # Device selector
        self.device_combo = QComboBox()
        self.device_combo.setMinimumWidth(200)
        self.device_combo.setStyleSheet("font-size: 12px;")
        layout.addWidget(self.device_combo)

        # Buttons
        self.scan_btn = QPushButton("Scan")
        self.scan_btn.setFixedWidth(60)
        self.scan_btn.clicked.connect(self.scan_requested.emit)

        self.connect_btn = QPushButton("Connect")
        self.connect_btn.setFixedWidth(80)
        self.connect_btn.setStyleSheet(
            "QPushButton { border: 1px solid #00D4FF; color: #00D4FF; "
            "background: rgba(0,212,255,0.1); font-weight: bold; }"
            "QPushButton:hover { background: rgba(0,212,255,0.25); }"
        )
        self.connect_btn.clicked.connect(self._on_connect)

        layout.addWidget(self.scan_btn)
        layout.addWidget(self.connect_btn)

    def _on_connect(self):
        self.connect_requested.emit(self.device_combo.currentText())

    def set_connected(self, connected: bool, model: str = ""):
        if connected:
            self.status_dot.setStyleSheet("color: #00FF88; font-size: 14px;")
            self.status_text.setText(f"Connected — {model}")
            self.status_text.setStyleSheet("color: #00FF88; font-size: 11px;")
            self.connect_btn.setText("Disconnect")
            self.connect_btn.setStyleSheet(
                "QPushButton { border: 1px solid #FF3333; color: #FF3333; "
                "background: rgba(255,51,51,0.1); font-weight: bold; }"
                "QPushButton:hover { background: rgba(255,51,51,0.25); }"
            )
            self.connect_btn.clicked.disconnect()
            self.connect_btn.clicked.connect(self.disconnect_requested.emit)
        else:
            self.status_dot.setStyleSheet("color: #FF3333; font-size: 14px;")
            self.status_text.setText("Disconnected")
            self.status_text.setStyleSheet("color: #888; font-size: 11px;")
            self.connect_btn.setText("Connect")
            self.connect_btn.setStyleSheet(
                "QPushButton { border: 1px solid #00D4FF; color: #00D4FF; "
                "background: rgba(0,212,255,0.1); font-weight: bold; }"
                "QPushButton:hover { background: rgba(0,212,255,0.25); }"
            )
            self.connect_btn.clicked.disconnect()
            self.connect_btn.clicked.connect(self._on_connect)

    def set_devices(self, devices: list[dict]):
        self.device_combo.clear()
        for d in devices:
            label = f"{d['model']} — {d.get('address', '')[-20:]}"
            self.device_combo.addItem(label)

    def set_scanning(self, scanning: bool):
        self.scan_btn.setEnabled(not scanning)
        self.scan_btn.setText("Scanning…" if scanning else "Scan")
