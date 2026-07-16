"""Oscilloscope panel: waveform chart + channel/timebase/trigger controls."""

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGroupBox, QCheckBox,
    QComboBox, QLabel, QPushButton,
)
from PySide6.QtCore import Qt

from app.waveform_chart import WaveformChart, CHANNEL_COLORS

TIMEBASE_PRESETS = [
    "1ns", "2ns", "5ns", "10ns", "20ns", "50ns", "100ns",
    "200ns", "500ns", "1µs", "2µs", "5µs", "10µs", "20µs",
    "50µs", "100µs", "200µs", "500µs", "1ms", "2ms", "5ms",
    "10ms", "20ms", "50ms", "100ms", "200ms", "500ms", "1s",
]

SCALE_PRESETS = [
    "1mV", "2mV", "5mV", "10mV", "20mV", "50mV", "100mV",
    "200mV", "500mV", "1V", "2V", "5V", "10V",
]

COUPLING_OPTIONS = ["DC", "AC", "GND"]


class ScopePanel(QWidget):
    """Full oscilloscope panel with waveform display and controls."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._ch_active = {i: False for i in range(1, 5)}
        self._setup_ui()

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 4, 8, 8)
        layout.setSpacing(6)

        # ── Waveform Chart ──
        self.chart = WaveformChart()
        self.chart.setMinimumHeight(360)
        layout.addWidget(self.chart, stretch=2)

        # ── Channel Controls ──
        ch_layout = QVBoxLayout()
        ch_layout.setSpacing(4)
        for ch_num in range(1, 5):
            ch_layout.addWidget(self._make_channel_row(ch_num))
        layout.addLayout(ch_layout, stretch=0)

        # ── Timebase + Trigger row ──
        bottom = QHBoxLayout()
        bottom.setSpacing(12)

        # Timebase
        tb_group = QGroupBox("⏱ Timebase")
        tb_group.setStyleSheet(self._group_style())
        tb_layout = QHBoxLayout(tb_group)
        self.timebase_combo = QComboBox()
        self.timebase_combo.addItems(TIMEBASE_PRESETS)
        self.timebase_combo.setCurrentText("1ms")
        self.timebase_combo.setStyleSheet("font-size: 12px; min-width: 90px;")
        tb_layout.addWidget(self.timebase_combo)
        bottom.addWidget(tb_group)

        # Trigger
        tr_group = QGroupBox("◎ Trigger")
        tr_group.setStyleSheet(self._group_style())
        tr_layout = QHBoxLayout(tr_group)
        tr_layout.setSpacing(8)

        self.tr_source = QComboBox()
        self.tr_source.addItems(["CH1", "CH2", "CH3", "CH4", "EXT"])
        self.tr_source.setStyleSheet("font-size: 12px;")
        tr_layout.addWidget(QLabel("Src:"))
        tr_layout.addWidget(self.tr_source)

        self.tr_slope = QComboBox()
        self.tr_slope.addItems(["↑ POS", "↓ NEG"])
        self.tr_slope.setStyleSheet("font-size: 12px;")
        tr_layout.addWidget(QLabel("Slope:"))
        tr_layout.addWidget(self.tr_slope)

        bottom.addWidget(tr_group)
        bottom.addStretch()

        # Measurements
        self.meas_label = QLabel("Vpp: --   Freq: --   Period: --   Rise: --")
        self.meas_label.setStyleSheet("color: #547898; font-size: 12px; padding: 4px;")
        bottom.addWidget(self.meas_label)

        layout.addLayout(bottom)

    def _make_channel_row(self, ch: int) -> QWidget:
        """Create a single channel control row: [✓] [Scale ▼] [Offset ▼] [Coupling ▼]."""
        row = QWidget()
        row.setFixedHeight(36)
        hl = QHBoxLayout(row)
        hl.setContentsMargins(0, 0, 0, 0)
        hl.setSpacing(6)

        color = CHANNEL_COLORS.get(ch).name()
        prefix = f"CH{ch}"

        # Enable checkbox with color
        cb = QCheckBox(prefix)
        cb.setStyleSheet(
            f"QCheckBox {{ color: {color}; font-weight: bold; font-size: 12px; spacing: 4px; }}"
            f"QCheckBox::indicator {{ width: 14px; height: 14px; }}"
        )
        cb.toggled.connect(lambda on: self._ch_active.update({ch: on}))
        hl.addWidget(cb)

        # Scale
        scale_combo = QComboBox()
        scale_combo.addItems(SCALE_PRESETS)
        scale_combo.setCurrentText("1V")
        scale_combo.setStyleSheet("font-size: 12px; min-width: 80px;")
        hl.addWidget(QLabel("Scale"))
        hl.addWidget(scale_combo)

        # Offset
        offset_combo = QComboBox()
        offset_combo.addItems(["0V", "+0.1V", "+0.5V", "+1V", "+2V", "+5V",
                                "-0.1V", "-0.5V", "-1V", "-2V", "-5V"])
        offset_combo.setStyleSheet("font-size: 12px; min-width: 80px;")
        hl.addWidget(QLabel("Offset"))
        hl.addWidget(offset_combo)

        # Coupling
        coupl_combo = QComboBox()
        coupl_combo.addItems(COUPLING_OPTIONS)
        coupl_combo.setStyleSheet("font-size: 12px;")
        hl.addWidget(QLabel("Coupling"))
        hl.addWidget(coupl_combo)

        hl.addStretch()

        # Store references
        setattr(self, f"_ch{ch}_cb", cb)
        setattr(self, f"_ch{ch}_scale", scale_combo)
        setattr(self, f"_ch{ch}_offset", offset_combo)
        setattr(self, f"_ch{ch}_coupl", coupl_combo)

        return row

    def _group_style(self) -> str:
        return (
            "QGroupBox { color: #547898; font-size: 11px; font-weight: bold; "
            "border: 1px solid #1e3550; border-radius: 4px; margin-top: 8px; padding-top: 12px; }"
            "QGroupBox::title { subcontrol-origin: margin; left: 10px; }"
        )

    # ── Public API ──

    def update_waveform(self, channel: int, samples: list[float],
                         x_inc: float, v_scale: float):
        self.chart.set_data(channel, samples, x_inc, v_scale)

    def set_measurements(self, results: dict):
        vpp = results.get("VPP", "--")
        freq = results.get("FREQuency", "--")
        per = results.get("PERiod", "--")
        rise = results.get("RISetime", "--")
        self.meas_label.setText(
            f"Vpp: {vpp}   Freq: {freq}   Period: {per}   Rise: {rise}"
        )

    @property
    def chart_view(self):
        return self.chart

    def update_state(self, state: dict):
        """Update control values from device state."""
        for ch_name, ch_data in state.get("channels", {}).items():
            ch_num = int(ch_name[-1])
            cb = getattr(self, f"_ch{ch_num}_cb", None)
            scale = getattr(self, f"_ch{ch_num}_scale", None)
            if cb and scale:
                cb.setChecked(ch_data.get("enabled", False))
                # Find matching scale preset
                s = ch_data.get("scale", 1.0)
                scale.setCurrentText(f"{s:g}V" if s >= 0.1 else f"{s*1000:g}mV")

        # Timebase
        tb = state.get("timebase", {}).get("scale", 0.001)
        self.timebase_combo.setCurrentText(f"{tb:g}s" if tb >= 1 else f"{tb*1e6:g}us" if tb >= 1e-6 else f"{tb*1e9:g}ns")

        # Trigger
        tr = state.get("trigger", {})
        src = tr.get("source", "CH1")
        if src.startswith("CHAN"):
            src = src.replace("CHAN", "CH")
        idx = self.tr_source.findText(src)
        if idx >= 0:
            self.tr_source.setCurrentIndex(idx)
        slope = tr.get("slope", "POS")
        self.tr_slope.setCurrentText("↑ POS" if slope.upper() == "POS" else "↓ NEG")
