"use client";

import { cn } from "@/lib/utils";

interface HealthFactorGaugeProps {
  healthFactor: number;
  hasDebt: boolean;
  className?: string;
}

const GAUGE_CX = 100;
const GAUGE_CY = 90;
const GAUGE_R = 70;
// Arc: 210° to -30° (240° sweep, opening at bottom)
const START_ANGLE_DEG = 210;
const END_ANGLE_DEG = -30;
const SWEEP_DEG = 240;

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function arcPoint(angleDeg: number) {
  const rad = degToRad(angleDeg);
  return {
    x: GAUGE_CX + GAUGE_R * Math.cos(rad),
    y: GAUGE_CY - GAUGE_R * Math.sin(rad),
  };
}

function describeArc(startDeg: number, endDeg: number, r: number): string {
  const s = { x: GAUGE_CX + r * Math.cos(degToRad(startDeg)), y: GAUGE_CY - r * Math.sin(degToRad(startDeg)) };
  const e = { x: GAUGE_CX + r * Math.cos(degToRad(endDeg)), y: GAUGE_CY - r * Math.sin(degToRad(endDeg)) };
  const largeArc = Math.abs(startDeg - endDeg) > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 0 ${e.x} ${e.y}`;
}

function hfToAngle(hf: number): number {
  const clamped = Math.min(Math.max(hf, 0), 2.5);
  const fraction = clamped / 2.5;
  return START_ANGLE_DEG - fraction * SWEEP_DEG;
}

function getRiskConfig(hf: number, hasDebt: boolean) {
  if (!hasDebt) return { color: "#6B8A8D", label: "No Debt", display: "∞" };
  if (hf > 1.5) return { color: "#16A34A", label: "Safe", display: hf.toFixed(2) };
  if (hf >= 1.0) return { color: "#D97706", label: "Caution", display: hf.toFixed(2) };
  return { color: "#DC2626", label: "At Risk", display: hf.toFixed(2) };
}

export function HealthFactorGauge({ healthFactor, hasDebt, className }: HealthFactorGaugeProps) {
  const config = getRiskConfig(healthFactor, hasDebt);
  const needleAngle = hasDebt && isFinite(healthFactor) ? hfToAngle(healthFactor) : hfToAngle(2.5);
  const needleTip = arcPoint(needleAngle);

  // Zone arcs: red 0-40%, amber 40-60%, green 60-100% of SWEEP
  const redEnd = START_ANGLE_DEG - SWEEP_DEG * 0.4;
  const amberEnd = START_ANGLE_DEG - SWEEP_DEG * 0.6;

  return (
    <div className={cn("border border-[rgba(3,121,113,0.15)] bg-white p-6", className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-[#6B8A8D] font-[family-name:var(--font-body)]">Health Factor</span>
        <span
          className="text-xs font-medium px-2 py-0.5"
          style={{ color: config.color, backgroundColor: `${config.color}18` }}
        >
          {config.label}
        </span>
      </div>

      <svg viewBox="0 0 200 130" className="w-full max-w-[240px] mx-auto">
        {/* Track */}
        <path d={describeArc(START_ANGLE_DEG, END_ANGLE_DEG, GAUGE_R)} fill="none" stroke="#F8FAFA" strokeWidth={14} strokeLinecap="round" />

        {/* Red zone */}
        <path d={describeArc(START_ANGLE_DEG, redEnd, GAUGE_R)} fill="none" stroke="#DC2626" strokeWidth={14} strokeOpacity={0.25} />
        {/* Amber zone */}
        <path d={describeArc(redEnd, amberEnd, GAUGE_R)} fill="none" stroke="#D97706" strokeWidth={14} strokeOpacity={0.25} />
        {/* Green zone */}
        <path d={describeArc(amberEnd, END_ANGLE_DEG, GAUGE_R)} fill="none" stroke="#16A34A" strokeWidth={14} strokeOpacity={0.25} />

        {/* Needle */}
        <line
          x1={GAUGE_CX}
          y1={GAUGE_CY}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke={config.color}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        {/* Needle pivot */}
        <circle cx={GAUGE_CX} cy={GAUGE_CY} r={5} fill={config.color} />

        {/* Value */}
        <text x={GAUGE_CX} y={GAUGE_CY + 26} textAnchor="middle" fontSize={22} fontWeight={700} fill={config.color} fontFamily="var(--font-heading)">
          {config.display}
        </text>

        {/* Scale labels */}
        <text x={22} y={108} fontSize={9} fill="#DC2626" textAnchor="middle">0</text>
        <text x={65} y={34} fontSize={9} fill="#D97706" textAnchor="middle">1.0</text>
        <text x={100} y={18} fontSize={9} fill="#D97706" textAnchor="middle">1.5</text>
        <text x={176} y={108} fontSize={9} fill="#16A34A" textAnchor="middle">2.5+</text>
      </svg>
    </div>
  );
}
