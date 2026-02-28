"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IconInfoCircleFilled } from "@tabler/icons-react";

export interface PreviewRow {
  label: string;
  value: string;
  tooltip?: string;
  accent?: boolean;
  bold?: boolean;
  separator?: boolean;
}

interface TransactionPreviewProps {
  title?: string;
  rows: PreviewRow[];
  loading?: boolean;
}

export function TransactionPreview({
  title = "Transaction Preview",
  rows,
  loading,
}: TransactionPreviewProps) {
  if (rows.length === 0 && !loading) return null;

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-[#F8FAFA] p-4 space-y-3">
      <p className="text-xs font-medium text-[#6B8A8D] uppercase tracking-wider">
        {title}
      </p>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i}>
              {row.separator && (
                <div className="border-t border-[rgba(3,121,113,0.15)] my-2" />
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-[#6B8A8D]">
                  {row.label}
                  {row.tooltip && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">
                            <IconInfoCircleFilled
                              size={14}
                              className="text-[#9CA3AF]"
                            />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[240px]">
                          <p>{row.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </span>
                <span
                  className={`tabular-nums font-[family-name:var(--font-heading)] ${
                    row.accent
                      ? "text-[#03B5AA] font-semibold"
                      : row.bold
                        ? "text-[#023436] font-semibold"
                        : "text-[#023436] font-medium"
                  }`}
                >
                  {row.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
