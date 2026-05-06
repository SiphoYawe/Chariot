"use client";

import { useMemo } from "react";
import type { Transaction } from "@/types/transaction";

interface TransactionCalendarHeatmapProps {
  transactions: Transaction[];
  onDateSelect?: (date: string | null) => void;
  selectedDate?: string | null;
}

const WEEK_COUNT = 13;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getColor(volume: number, max: number): string {
  if (volume === 0) return "#F0F4F4";
  const intensity = Math.min(volume / Math.max(max, 1), 1);
  if (intensity < 0.25) return "#B2DFDB";
  if (intensity < 0.5) return "#4DB6AC";
  if (intensity < 0.75) return "#037971";
  return "#023436";
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function TransactionCalendarHeatmap({ transactions, onDateSelect, selectedDate }: TransactionCalendarHeatmapProps) {
  const { grid, maxVolume, monthLabels } = useMemo(() => {
    const volumeMap = new Map<string, number>();
    for (const tx of transactions) {
      const date = isoDate(new Date(tx.timestamp));
      volumeMap.set(date, (volumeMap.get(date) ?? 0) + tx.amount);
    }

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - WEEK_COUNT * 7 + 1);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const weeks: { date: string; volume: number; month?: string }[][] = [];
    const months: { label: string; colIndex: number }[] = [];
    let lastMonth = -1;

    for (let w = 0; w < WEEK_COUNT; w++) {
      const week: { date: string; volume: number; month?: string }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + w * 7 + d);
        const dateStr = isoDate(date);
        const m = date.getMonth();
        let month: string | undefined;
        if (m !== lastMonth) {
          month = date.toLocaleDateString("en-US", { month: "short" });
          months.push({ label: month, colIndex: w });
          lastMonth = m;
        }
        week.push({ date: dateStr, volume: volumeMap.get(dateStr) ?? 0, month });
      }
      weeks.push(week);
    }

    const maxVolume = Math.max(...Array.from(volumeMap.values()), 1);
    return { grid: weeks, maxVolume, monthLabels: months };
  }, [transactions]);

  const CELL = 14;
  const GAP = 2;
  const COL_W = CELL + GAP;
  const ROW_H = CELL + GAP;
  const todayStr = isoDate(new Date());

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
          Activity Calendar
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#6B8A8D]">Less</span>
          {["#F0F4F4", "#B2DFDB", "#4DB6AC", "#037971", "#023436"].map((c) => (
            <div key={c} style={{ width: 10, height: 10, backgroundColor: c, border: "1px solid rgba(3,121,113,0.15)" }} />
          ))}
          <span className="text-[10px] text-[#6B8A8D]">More</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg width={WEEK_COUNT * COL_W + 32} height={7 * ROW_H + 24}>
          {monthLabels.map((m) => (
            <text key={m.label + m.colIndex} x={32 + m.colIndex * COL_W} y={10} fontSize={9} fill="#6B8A8D">
              {m.label}
            </text>
          ))}

          {[1, 3, 5].map((d) => (
            <text key={d} x={0} y={16 + d * ROW_H + CELL / 2} fontSize={9} fill="#6B8A8D" dominantBaseline="middle">
              {DAY_LABELS[d].slice(0, 1)}
            </text>
          ))}

          {grid.map((week, wi) =>
            week.map((day, di) => {
              const x = 32 + wi * COL_W;
              const y = 16 + di * ROW_H;
              const isSelected = selectedDate === day.date;
              const isFuture = day.date > todayStr;
              return (
                <rect
                  key={day.date}
                  x={x}
                  y={y}
                  width={CELL}
                  height={CELL}
                  fill={isFuture ? "transparent" : getColor(day.volume, maxVolume)}
                  stroke={isSelected ? "#03B5AA" : "rgba(3,121,113,0.12)"}
                  strokeWidth={isSelected ? 1.5 : 0.5}
                  rx={2}
                  style={{ cursor: isFuture ? "default" : "pointer" }}
                  onClick={() => !isFuture && onDateSelect?.(isSelected ? null : day.date)}
                >
                  <title>{day.date}: ${day.volume.toFixed(2)} volume</title>
                </rect>
              );
            })
          )}
        </svg>
      </div>
    </div>
  );
}
