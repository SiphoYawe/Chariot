"use client";

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string | number;
  formatValue?: (value: number) => string;
  formatLabel?: (label: string | number) => string;
}

function defaultFormatValue(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function defaultFormatLabel(label: string | number): string {
  if (typeof label === "number") {
    const date = new Date(label);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return String(label);
}

export function ChartTooltip({
  active,
  payload,
  label,
  formatValue = defaultFormatValue,
  formatLabel = defaultFormatLabel,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-3 shadow-sm">
      <p className="text-xs text-[#6B8A8D] mb-1.5 font-[family-name:var(--font-heading)]">
        {label !== undefined ? formatLabel(label) : ""}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-[#6B8A8D]">{entry.name}</span>
          <span className="text-sm font-semibold tabular-nums font-[family-name:var(--font-heading)] text-[#023436] ml-auto">
            {formatValue(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
