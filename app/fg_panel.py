"""Function Generator panel for DG822 Pro."""

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGroupBox, QCheckBox,
    QComboBox, QLabel, QPushButton, QSlider,
)
from PySide6.QtCore import Qt

FUNC_WAVEFORMS = ["SIN", "SQU", "RAMP", "PULS", "NOIS", "DC"]
FREQ_RANGES = [
    ("1 Hz", 1), ("10 Hz", 10), ("100 Hz", 100),
    ("1 kHz", 1000), ("10 kHz", 10000), ("100 kHz", 100000),
    ("1 MHz", 1e6), ("5 MHz", 5e6), ("10 MHz", 10e6),
    ("25 MHz", 25e6),
]
AMP_RANGES = [
    "10mV", "50mV", "100mV", "500mV",
    "1V", "2V", "5V", "10V",
]


class FunctionGenPanel(QWidget):
    """DG822 Pro function generator control panel."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._setup_ui()

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 16, 20, 16)
        layout.setSpacing(16)

        # Status placeholder
        status = QLabel(
            "DG822 not connected — plug USB cable and scan for devices"
        )
        status.setStyleSheet("color: #547898; font-size: 13px; padding: 12px;")
        status.setAlignment(Qt.AlignCenter)
        layout.addWidget(status)

        # Waveform type
        wave_group = QGroupBox("Waveform")
        wave_group.setStyleSheet(self._group_style())
        wave_layout = QHBoxLayout(wave_group)
        self.wave_combo = QComboBox()
        self.wave_combo.addItems(FUNC_WAVEFORMS)
        self.wave_combo.setStyleSheet("font-size: 14px; min-width: 120px;")
        wave_layout.addWidget(QLabel("Type:"))
        wave_layout.addWidget(self.wave_combo)
        wave_layout.addStretch()
        layout.addWidget(wave_group)

        # Frequency
        freq_group = QGroupBox("Frequency")
        freq_group.setStyleSheet(self._group_style())
        freq_layout = QHBoxLayout(freq_group)
        self.freq_combo = QComboBox()
        self.freq_combo.addItems([f[0] for f in FREQ_RANGES])
        self.freq_combo.setCurrentText("1 kHz")
        self.freq_combo.setStyleSheet("font-size: 14px; min-width: 110px;")
        freq_layout.addWidget(QLabel("Freq:"))
        freq_layout.addWidget(self.freq_combo)
        freq_layout.addStretch()
        layout.addWidget(freq_group)

        # Amplitude
        amp_group = QGroupBox("Amplitude")
        amp_group.setStyleSheet(self._group_style())
        amp_layout = QHBoxLayout(amp_group)
        self.amp_combo = QComboBox()
        self.amp_combo.addItems(AMP_RANGES)
        self.amp_combo.setCurrentText("1V")
        self.amp_combo.setStyleSheet("font-size: 14px; min-width: 100px;")
        amp_layout.addWidget(QLabel("Amplitude:"))
        amp_layout.addWidget(self.amp_combo)

        # Offset
        amp_layout.addWidget(QLabel("  Offset:"))
        self.offset_combo = QComboBox()
        self.offset_combo.addItems(["0V", "+0.5V", "+1V", "+2V", "+5V",
                                     "-0.5V", "-1V", "-2V", "-5V"])
        self.offset_combo.setStyleSheet("font-size: 14px; min-width: 90px;")
        amp_layout.addWidget(self.offset_combo)
        amp_layout.addStretch()
        layout.addWidget(amp_group)

        # Output toggle
        out_layout = QHBoxLayout()
        self.output_btn = QPushButton("▶ Output ON")
        self.output_btn.setCheckable(True)
        self.output_btn.setStyleSheet(
            "QPushButton { font-size: 14px; padding: 10px 30px; "
            "border: 2px solid #00FF88; color: #00FF88; border-radius: 6px; "
            "background: rgba(0,255,136,0.08); font-weight: bold; }"
            "QPushButton:checked { background: rgba(0,255,136,0.25); }"
            "QPushButton:hover { background: rgba(0,255,136,0.15); }"
        )
        out_layout.addStretch()
        out_layout.addWidget(self.output_btn)
        out_layout.addStretch()
        layout.addLayout(out_layout)

        layout.addStretch()

    def _group_style(self) -> str:
        return (
            "QGroupBox { color: #547898; font-size: 12px; font-weight: bold; "
            "border: 1px solid #1e3550; border-radius: 4px; margin-top: 8px; padding-top: 14px; }"
            "QGroupBox::title { subcontrol-origin: margin; left: 12px; }"
        )

    def update_state(self, state: dict):
        """Update controls from DG822 device state."""
        ch1 = state.get("channels", {}).get("CH1", {})
        if not ch1:
            return

        func = ch1.get("function", "SIN").upper()
        idx = self.wave_combo.findText(func)
        if idx >= 0:
            self.wave_combo.setCurrentIndex(idx)

        freq = ch1.get("frequency", 1000)
        # Find closest preset
        closest = min(FREQ_RANGES, key=lambda x: abs(x[1] - freq))
        self.freq_combo.setCurrentText(closest[0])

        amp = ch1.get("amplitude", 1.0)
        self.amp_combo.setCurrentText(f"{amp:g}V")

        self.output_btn.setChecked(ch1.get("output", False))
        self.output_btn.setText("▶ Output ON" if ch1.get("output") else "▶ Output OFF")
