"use client";

import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";

interface AmountInputProps {
  /** Current input value (string to preserve decimal formatting) */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Token symbol (e.g. "USDC", "chUSDC") */
  tokenSymbol: string;
  /** User's wallet balance (formatted string) */
  balance?: string;
  /** Whether data is still loading */
  balanceLoading?: boolean;
  /** Max decimal places allowed */
  decimals?: number;
  /** Validation error message */
  error?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** USD equivalent text (e.g. "$1,000.00") */
  usdValue?: string;
}

export function AmountInput({
  value,
  onChange,
  tokenSymbol,
  balance,
  balanceLoading,
  decimals = 2,
  error,
  disabled,
  usdValue,
}: AmountInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;

      // Allow empty string
      if (raw === "") {
        onChange("");
        return;
      }

      // Validate numeric input with decimals
      const regex = new RegExp(`^\\d*\\.?\\d{0,${decimals}}$`);
      if (regex.test(raw)) {
        onChange(raw);
      }
    },
    [onChange, decimals]
  );

  const handleMax = useCallback(() => {
    if (balance) {
      onChange(balance);
    }
  }, [balance, onChange]);

  const hasError = !!error;

  return (
    <div className="space-y-2">
      <div
        className={`border bg-white p-4 transition-colors ${
          hasError
            ? "border-[#F59E0B]"
            : "border-[rgba(3,121,113,0.15)] focus-within:border-[#03B5AA]"
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Token icon + symbol */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 bg-[#023436] flex items-center justify-center">
              <span className="text-white text-[10px] font-bold font-[family-name:var(--font-heading)]">
                {tokenSymbol.slice(0, 1)}
              </span>
            </div>
            <span className="text-sm font-medium text-[#023436]">
              {tokenSymbol}
            </span>
          </div>

          {/* Amount input */}
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={value}
            onChange={handleChange}
            disabled={disabled}
            className="flex-1 text-right text-xl font-semibold font-[family-name:var(--font-heading)] tabular-nums text-[#023436] bg-transparent outline-none placeholder:text-[#9CA3AF] disabled:opacity-50"
          />

          {/* Max button */}
          <Button
            variant="ghost"
            size="xs"
            onClick={handleMax}
            disabled={disabled || !balance}
            className="text-[#03B5AA] hover:text-[#037971] hover:bg-transparent shrink-0"
          >
            Max
          </Button>
        </div>

        {/* Balance + USD conversion row */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[rgba(3,121,113,0.10)]">
          <div className="text-xs text-[#6B8A8D]">
            {balanceLoading ? (
              <span className="inline-block w-20 h-3 bg-[#F8FAFA] animate-pulse" />
            ) : balance !== undefined ? (
              <>
                Balance:{" "}
                <span className="tabular-nums font-medium">
                  {balance} {tokenSymbol}
                </span>
              </>
            ) : null}
          </div>
          {usdValue && (
            <span className="text-xs text-[#9CA3AF] tabular-nums">
              {usdValue}
            </span>
          )}
        </div>
      </div>

      {/* Error message */}
      {hasError && (
        <p className="text-xs text-[#F59E0B] pl-1">{error}</p>
      )}
    </div>
  );
}
