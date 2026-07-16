"""QChart-based waveform display for oscilloscope data."""

from PySide6.QtCharts import QChart, QChartView, QLineSeries, QValueAxis
from PySide6.QtCore import Qt, QPointF
from PySide6.QtGui import QPainter, QColor, QPen

# Channel trace colors
CHANNEL_COLORS = {
    1: QColor("#FFB000"),  # yellow
    2: QColor("#00D4FF"),  # cyan
    3: QColor("#FF40FF"),  # magenta
    4: QColor("#00FF88"),  # green
}

GRID_COLOR = QColor("#1a2a3a")
GRID_LINE_COLOR = QColor("#1e3550")
AXIS_COLOR = QColor("#2a4a6a")
TEXT_COLOR = QColor("#547898")


class WaveformChart(QChartView):
    """Oscilloscope waveform display with grid background."""

    def __init__(self, parent=None):
        self.chart = QChart()
        self.chart.setBackgroundBrush(QColor("#0a1620"))
        self.chart.setPlotAreaBackgroundBrush(QColor("#0d1a28"))
        self.chart.legend().hide()
        self.chart.setMargins(4)

        super().__init__(self.chart, parent)
        self.setRenderHint(QPainter.Antialiasing)

        # Axes
        self.axis_x = QValueAxis()
        self.axis_x.setRange(-6, 6)
        self.axis_x.setGridLineColor(GRID_LINE_COLOR)
        self.axis_x.setLabelsColor(TEXT_COLOR)
        self.axis_x.setLinePenColor(AXIS_COLOR)
        self.axis_x.setTickCount(11)

        self.axis_y = QValueAxis()
        self.axis_y.setRange(-4, 4)
        self.axis_y.setGridLineColor(GRID_LINE_COLOR)
        self.axis_y.setLabelsColor(TEXT_COLOR)
        self.axis_y.setLinePenColor(AXIS_COLOR)
        self.axis_y.setTickCount(9)

        self.chart.addAxis(self.axis_x, Qt.AlignBottom)
        self.chart.addAxis(self.axis_y, Qt.AlignLeft)

        # Series per channel
        self._series: dict[int, QLineSeries] = {}

    def set_data(self, channel: int, samples: list[float], x_inc: float, v_scale: float):
        """Update waveform trace for a channel."""
        if channel not in self._series:
            series = QLineSeries()
            pen = QPen(CHANNEL_COLORS.get(channel, QColor("#888")))
            pen.setWidth(1.5)
            series.setPen(pen)
            self.chart.addSeries(series)
            series.attachAxis(self.axis_x)
            series.attachAxis(self.axis_y)
            self._series[channel] = series

        points = [QPointF(i * x_inc - (len(samples) * x_inc / 2), v)
                  for i, v in enumerate(samples)]
        self._series[channel].replace(points)

        # Auto-adjust Y axis to 8 divisions (4 above, 4 below center)
        half = v_scale * 4
        self.axis_y.setRange(-half, half)

    def clear_channel(self, channel: int):
        if channel in self._series:
            self._series[channel].clear()

    def clear_all(self):
        for s in self._series.values():
            s.clear()
        self._series.clear()
