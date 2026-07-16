"use client";

import { useEffect, useRef, useCallback } from "react";
import { CH_COLORS } from "@/lib/scpi";

interface WaveformFrame {
  channel: number;
  samples: number[];
  v_scale: number;
  v_offset: number;
  t_scale: number;
  x_inc: number;
  sample_count: number;
}

interface Props {
  frames: Record<number, WaveformFrame>; // channel -> latest frame
  tScale: number;
  activeChannels: number[];
}

const WIDTH = 600;
const HEIGHT = 400;
const GRID_X = 10;
const GRID_Y = 8;

export default function WaveformCanvas({ frames, tScale, activeChannels }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = `${WIDTH}px`;
    canvas.style.height = `${HEIGHT}px`;
    ctx.scale(dpr, dpr);

    // ── Background ──
    ctx.fillStyle = "#0a0e14";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // ── Grid ──
    const dx = WIDTH / GRID_X;
    const dy = HEIGHT / GRID_Y;

    ctx.strokeStyle = "#1a2436";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_X; i++) {
      ctx.beginPath();
      ctx.moveTo(i * dx, 0);
      ctx.lineTo(i * dx, HEIGHT);
      ctx.stroke();
    }
    for (let i = 0; i <= GRID_Y; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * dy);
      ctx.lineTo(WIDTH, i * dy);
      ctx.stroke();
    }

    // ── Center Axes (brighter) ──
    ctx.strokeStyle = "#2a3a4e";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2, 0);
    ctx.lineTo(WIDTH / 2, HEIGHT);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT / 2);
    ctx.lineTo(WIDTH, HEIGHT / 2);
    ctx.stroke();

    // ── Timebase Label ──
    ctx.fillStyle = "#5c6e8a";
    ctx.font = "10px monospace";
    ctx.fillText(formatTime(tScale) + "/div", WIDTH - 80, HEIGHT - 8);

    // ── Waveform Traces ──
    for (const ch of activeChannels) {
      const frame = frames[ch];
      if (!frame || !frame.samples.length) continue;

      const color = CH_COLORS[ch] || "#ffffff";
      const { samples, v_scale, v_offset, sample_count } = frame;

      // Map samples to canvas coordinates
      // X: spread samples across 10 horizontal divisions
      // Y: center = HEIGHT/2, scale by v_scale relative to grid
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      for (let i = 0; i < sample_count; i++) {
        const x = (i / (sample_count - 1)) * WIDTH;
        // v_scale is volts/div, each div = dy pixels
        // samples are in volts, center = 0V at HEIGHT/2
        const vPerDivision = v_scale; // volts per grid division
        const pxPerVolt = dy / vPerDivision;
        const y = HEIGHT / 2 - (samples[i] - v_offset) * pxPerVolt;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // ── Channel Label ──
      ctx.fillStyle = color;
      ctx.font = "11px monospace";
      ctx.fillText(`CH${ch}  ${formatVoltage(v_scale)}/div`, 8, 16 + (ch - 1) * 16);
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [frames, tScale, activeChannels]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        maxWidth: WIDTH,
        border: "1px solid var(--border)",
        borderRadius: 6,
      }}
    />
  );
}

function formatTime(t: number): string {
  if (t < 1e-6) return `${(t * 1e9).toFixed(0)}ns`;
  if (t < 1e-3) return `${(t * 1e6).toFixed(0)}µs`;
  if (t < 1) return `${(t * 1e3).toFixed(0)}ms`;
  return `${t.toFixed(1)}s`;
}

function formatVoltage(v: number): string {
  if (v < 1) return `${(v * 1000).toFixed(0)}mV`;
  return `${v}V`;
}
