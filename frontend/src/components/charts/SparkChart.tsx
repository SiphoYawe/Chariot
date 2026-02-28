"use client";

import { useId } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";

interface SparkChartProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

/**
 * Inline mini-trend chart for DataCards.
 * No axes, no tooltip -- pure visual trend indicator.
 */
export function SparkChart({
  data,
  color = "#03B5AA",
  width = 96,
  height = 32,
}: SparkChartProps) {
  const gradientId = useId();

  if (!data || data.length < 2) return null;

  const chartData = data.map((value, index) => ({ index, value }));

  return (
    <div style={{ width, height }} className="inline-block">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
