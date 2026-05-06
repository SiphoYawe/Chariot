"use client";

import { useProtocolActivity } from "@/hooks/useProtocolActivity";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getColor(count: number, max: number): string {
  if (count === 0) return "#F8FAFA";
  const intensity = Math.min(count / Math.max(max, 1), 1);
  if (intensity < 0.25) return "#B2DFDB";
  if (intensity < 0.5)  return "#4DB6AC";
  if (intensity < 0.75) return "#037971";
  if (intensity < 1.0)  return "#014D40";
  return "#023436";
}

export function ActivityPulseHeatmap() {
  const { buckets, isLoading, isError, refetch } = useProtocolActivity();

  if (isLoading) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Unable to load protocol activity." onRetry={refetch} />;
  }

  // Group into 7 days x 24 hours
  const days: { date: string; hours: number[] }[] = [];
  for (let i = 0; i < 7; i++) {
    const dayBuckets = buckets.slice(i * 24, i * 24 + 24);
    if (dayBuckets.length === 0) continue;
    days.push({ date: dayBuckets[0].date, hours: dayBuckets.map((b) => b.count) });
  }

  if (!isLoading && !isError && days.length === 0) {
    return (
      <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-4">
          Protocol Activity -- Last 7 Days
        </h3>
        <div className="h-[80px] flex items-center justify-center text-sm text-[#6B8A8D]">
          No activity data for the last 7 days
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const totalEvents = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)]">
          Protocol Activity -- Last 7 Days
        </h3>
        <span className="text-xs text-[#6B8A8D] tabular-nums font-[family-name:var(--font-heading)]">
          {totalEvents} events
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-0.5">
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 mr-2">
            {days.map((d) => {
              const dayName = DAYS[new Date(d.date + "T12:00:00Z").getUTCDay()];
              return (
                <span key={d.date} className="text-[10px] text-[#6B8A8D] w-6 h-[12px] leading-[12px]">
                  {dayName}
                </span>
              );
            })}
          </div>

          {/* Hour columns */}
          {Array.from({ length: 24 }).map((_, hour) => (
            <div key={hour} className="flex flex-col gap-0.5">
              {days.map((d) => {
                const count = d.hours[hour] ?? 0;
                const label = `${d.date} ${hour}:00 -- ${count} event${count !== 1 ? "s" : ""}`;
                return (
                  <div
                    key={d.date}
                    role="img"
                    aria-label={label}
                    title={label}
                    style={{
                      width: 12,
                      height: 12,
                      backgroundColor: getColor(count, maxCount),
                      border: "1px solid rgba(3,121,113,0.08)",
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Hour axis labels */}
        <div className="flex gap-0.5 mt-1 ml-8">
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} style={{ width: 12 }}>
              {h % 6 === 0 && (
                <span className="text-[9px] text-[#6B8A8D]">{h}h</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[10px] text-[#6B8A8D]">Less</span>
        {["#F8FAFA", "#B2DFDB", "#4DB6AC", "#037971", "#014D40", "#023436"].map((c) => (
          <div
            key={c}
            style={{ width: 10, height: 10, backgroundColor: c, border: "1px solid rgba(3,121,113,0.15)" }}
          />
        ))}
        <span className="text-[10px] text-[#6B8A8D]">More</span>
      </div>
    </div>
  );
}
