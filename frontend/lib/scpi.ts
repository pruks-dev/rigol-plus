/**
 * ψ-RigolPlus SCPI Helpers — command builders, timebase presets, waveform types.
 */

// ── Timebase Presets ──
export const TIMEBASE_PRESETS = [
  { label: "2ns", value: 2e-9 },
  { label: "5ns", value: 5e-9 },
  { label: "10ns", value: 10e-8 },
  { label: "20ns", value: 2e-8 },
  { label: "50ns", value: 5e-8 },
  { label: "100ns", value: 1e-7 },
  { label: "200ns", value: 2e-7 },
  { label: "500ns", value: 5e-7 },
  { label: "1µs", value: 1e-6 },
  { label: "2µs", value: 2e-6 },
  { label: "5µs", value: 5e-6 },
  { label: "10µs", value: 1e-5 },
  { label: "20µs", value: 2e-5 },
  { label: "50µs", value: 5e-5 },
  { label: "100µs", value: 1e-4 },
  { label: "200µs", value: 2e-4 },
  { label: "500µs", value: 5e-4 },
  { label: "1ms", value: 1e-3 },
  { label: "2ms", value: 2e-3 },
  { label: "5ms", value: 5e-3 },
  { label: "10ms", value: 1e-2 },
  { label: "20ms", value: 2e-2 },
  { label: "50ms", value: 5e-2 },
  { label: "100ms", value: 1e-1 },
  { label: "200ms", value: 2e-1 },
  { label: "500ms", value: 5e-1 },
  { label: "1s", value: 1.0 },
  { label: "2s", value: 2.0 },
  { label: "5s", value: 5.0 },
  { label: "10s", value: 10.0 },
];

// ── Voltage Scale Presets ──
export const VSCALE_PRESETS = [
  { label: "1mV", value: 0.001 },
  { label: "2mV", value: 0.002 },
  { label: "5mV", value: 0.005 },
  { label: "10mV", value: 0.01 },
  { label: "20mV", value: 0.02 },
  { label: "50mV", value: 0.05 },
  { label: "100mV", value: 0.1 },
  { label: "200mV", value: 0.2 },
  { label: "500mV", value: 0.5 },
  { label: "1V", value: 1.0 },
  { label: "2V", value: 2.0 },
  { label: "5V", value: 5.0 },
  { label: "10V", value: 10.0 },
];

// ── Trigger Sources ──
export const TRIGGER_SOURCES = [
  "CHANnel1",
  "CHANnel2",
  "CHANnel3",
  "CHANnel4",
  "EXT",
  "AC",
];

// ── Trigger Slopes ──
export const TRIGGER_SLOPES = ["POSitive", "NEGative"];

// ── Function Generator Waveforms ──
export const FG_WAVEFORMS = ["SIN", "SQU", "RAMP", "PULS", "NOIS", "DC", "ARB"];
export const FG_WAVEFORM_LABELS: Record<string, string> = {
  SIN: "Sine",
  SQU: "Square",
  RAMP: "Ramp",
  PULS: "Pulse",
  NOIS: "Noise",
  DC: "DC",
  ARB: "Arbitrary",
};

// ── Channel Colors (matching RIGOL) ──
export const CH_COLORS: Record<number, string> = {
  1: "#f7d54e", // yellow
  2: "#4ec9f0", // cyan
  3: "#e06c9f", // magenta
  4: "#57a64a", // green
};

// ── SCPI Helpers ──
export function chDisplay(ch: number, on: boolean): string {
  return `:CHANnel${ch}:DISPlay ${on ? "ON" : "OFF"}`;
}

export function chScale(ch: number, v: number): string {
  return `:CHANnel${ch}:SCALe ${v}`;
}

export function chOffset(ch: number, v: number): string {
  return `:CHANnel${ch}:OFFSet ${v}`;
}

export function timebaseScale(v: number): string {
  return `:TIMebase:MAIN:SCALe ${v}`;
}

export function triggerSource(src: string): string {
  return `:TRIGger:EDGE:SOURce ${src}`;
}

export function triggerLevel(v: number): string {
  return `:TRIGger:EDGE:LEVel ${v}`;
}

export function measurement(type: string, ch: number): string {
  return `:MEASure:${type}? CHANnel${ch}`;
}
