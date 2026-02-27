"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ClosedPositionConfirmationProps {
  /** Collateral amount returned (ETH) */
  collateralReturnedEth: number;
  /** Callback to start new position */
  onNewPosition?: () => void;
  /** Optional className */
  className?: string;
}

export function ClosedPositionConfirmation({
  collateralReturnedEth,
  onNewPosition,
  className,
}: ClosedPositionConfirmationProps) {
  return (
    <div
      className={cn(
        "border border-[rgba(3,121,113,0.15)] bg-white p-8 flex flex-col items-center text-center",
        className
      )}
    >
      {/* Teal checkmark */}
      <div className="w-14 h-14 bg-[#03B5AA] flex items-center justify-center mb-4">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path
            d="M6 14L11 19L22 8"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="square"
          />
        </svg>
      </div>

      <h3 className="text-lg font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-2">
        Position Closed
      </h3>

      <p className="text-sm text-[#6B8A8D] mb-1">
        Collateral returned
      </p>
      <p className="text-xl font-bold text-[#023436] font-[family-name:var(--font-heading)] tabular-nums mb-6">
        {collateralReturnedEth.toFixed(4)} BridgedETH
      </p>

      {onNewPosition && (
        <Button
          onClick={onNewPosition}
          className="bg-[#03B5AA] text-white hover:bg-[#037971] font-medium"
        >
          Start New Position
        </Button>
      )}
    </div>
  );
}
