"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Signature visual: "0 dan natijagacha" drawn as a rising candlestick path.
 * Purely decorative — there are no prices, symbols or timestamps, so it can never be
 * mistaken for live market data.
 */

const W = 800;
const H = 420;
const PAD = { l: 44, r: 64, t: 46, b: 46 };
const N = 30;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Candle = { o: number; c: number; h: number; l: number };

function buildCandles(): Candle[] {
  const rand = mulberry32(20261120);
  const raw: Candle[] = [];
  let prev = 0;
  for (let i = 0; i < N; i++) {
    const pullback = i % 7 === 5 || i % 11 === 8;
    const drift = pullback ? -3.2 : 3.1;
    const o = prev;
    const c = o + drift + (rand() - 0.45) * 5;
    const h = Math.max(o, c) + rand() * 3.5 + 0.6;
    const l = Math.min(o, c) - rand() * 3.5 - 0.6;
    raw.push({ o, c, h, l });
    prev = c;
  }
  const min = Math.min(...raw.map((r) => r.l));
  const max = Math.max(...raw.map((r) => r.h));
  const scale = (v: number) => 6 + ((v - min) / (max - min)) * 88;
  return raw.map((r) => ({ o: scale(r.o), c: scale(r.c), h: scale(r.h), l: scale(r.l) }));
}

const yOf = (v: number) => H - PAD.b - (v / 100) * (H - PAD.t - PAD.b);
const step = (W - PAD.l - PAD.r) / N;
const xOf = (i: number) => PAD.l + step * i + step / 2;

function smoothPath(points: [number, number][]) {
  if (points.length < 2) return "";
  let d = `M ${points[0]![0].toFixed(1)} ${points[0]![1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

const CANDLES = buildCandles();
const MA_PATH = smoothPath(
  CANDLES.map((_, i): [number, number] => {
    const win = CANDLES.slice(Math.max(0, i - 3), i + 1);
    const avg = win.reduce((sum, c) => sum + (c.o + c.c) / 2, 0) / win.length;
    return [xOf(i), yOf(avg)];
  }),
);

const MILESTONES = [
  { at: 4, label: "Asoslar" },
  { at: 12, label: "Tahlil" },
  { at: 20, label: "Risk" },
  { at: 26, label: "Intizom" },
];

export function GrowthPath({ compact = false, className }: { compact?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const candles = CANDLES;
  const ma = MA_PATH;
  const areaPath = `${ma} L ${xOf(N - 1).toFixed(1)} ${H - PAD.b} L ${xOf(0).toFixed(1)} ${H - PAD.b} Z`;
  const last = candles[N - 1]!;
  const endY = yOf((last.o + last.c) / 2);
  const bodyW = Math.max(6, step * 0.52);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className ?? "h-full w-full"} aria-hidden preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="gp-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C9A45C" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#C9A45C" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gp-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8F6F33" />
          <stop offset="60%" stopColor="#C9A45C" />
          <stop offset="100%" stopColor="#E4CB93" />
        </linearGradient>
        <filter id="gp-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* horizontal guides */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + (H - PAD.t - PAD.b) * f} y2={PAD.t + (H - PAD.t - PAD.b) * f} stroke="#1F2A3D" strokeDasharray="2 6" />
      ))}
      <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="#2B3A54" />

      {/* "0" origin */}
      <g>
        <circle cx={PAD.l} cy={H - PAD.b} r="4" fill="#94A3B8" />
        <text x={PAD.l} y={H - PAD.b + 26} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize="15" fontWeight="600">
          0
        </text>
      </g>

      {/* candles */}
      {candles.map((c, i) => {
        const up = c.c >= c.o;
        const color = up ? "#22C55E" : "#E5484D";
        const top = yOf(Math.max(c.o, c.c));
        const bottom = yOf(Math.min(c.o, c.c));
        const x = xOf(i);
        return (
          <motion.g
            key={i}
            initial={reduce ? false : { opacity: 0, scaleY: 0.2 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ delay: 0.25 + i * 0.035, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: `${x}px ${bottom}px`, transformBox: "view-box" }}
          >
            <line x1={x} x2={x} y1={yOf(c.h)} y2={yOf(c.l)} stroke={color} strokeOpacity="0.55" strokeWidth="1.4" />
            <rect x={x - bodyW / 2} y={top} width={bodyW} height={Math.max(2, bottom - top)} rx="1.6" fill={color} fillOpacity={up ? 0.85 : 0.75} />
          </motion.g>
        );
      })}

      {/* gold average path */}
      <motion.path d={areaPath} fill="url(#gp-area)" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 1 }} />
      <motion.path
        d={ma}
        fill="none"
        stroke="#C9A45C"
        strokeWidth="6"
        strokeOpacity="0.35"
        filter="url(#gp-glow)"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.5, duration: 1.8, ease: [0.65, 0, 0.35, 1] }}
      />
      <motion.path
        d={ma}
        fill="none"
        stroke="url(#gp-line)"
        strokeWidth="2.6"
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.5, duration: 1.8, ease: [0.65, 0, 0.35, 1] }}
      />

      {/* milestones */}
      {!compact &&
        MILESTONES.map((m, idx) => {
          const c = candles[m.at]!;
          const x = xOf(m.at);
          const y = yOf(c.h) - 16;
          return (
            <motion.g
              key={m.label}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 + idx * 0.18, duration: 0.5 }}
            >
              <line x1={x} x2={x} y1={y} y2={y - 22} stroke="#C9A45C" strokeOpacity="0.5" strokeDasharray="2 3" />
              <rect x={x - 38} y={y - 46} width="76" height="24" rx="12" fill="#101723" stroke="#2B3A54" />
              <text x={x} y={y - 29.5} textAnchor="middle" fontSize="11.5" fontWeight="600" letterSpacing="0.5" className="fill-foreground font-mono">
                {m.label}
              </text>
            </motion.g>
          );
        })}

      {/* "Natija" endpoint */}
      <motion.g initial={reduce ? false : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 2.1, duration: 0.5 }} style={{ transformOrigin: `${xOf(N - 1)}px ${endY}px`, transformBox: "view-box" }}>
        <circle cx={xOf(N - 1)} cy={endY} r="16" fill="#C9A45C" fillOpacity="0.12" className="animate-pulse-soft" />
        <circle cx={xOf(N - 1)} cy={endY} r="6" fill="#E4CB93" stroke="#080B12" strokeWidth="2" />
        <text x={xOf(N - 1) + 2} y={endY - 26} textAnchor="middle" fontSize="15" fontWeight="700" className="fill-gold-soft font-mono" letterSpacing="1">
          NATIJA
        </text>
      </motion.g>
    </svg>
  );
}
