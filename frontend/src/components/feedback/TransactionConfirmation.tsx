"use client";

import { Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";

interface TransactionConfirmationProps {
  /** Transaction hash */
  txHash: string;
  /** Title text (e.g. "Deposit Confirmed") */
  title: string;
  /** Summary rows (label/value pairs) */
  details: { label: string; value: string }[];
  /** Primary action (e.g. "Deposit More") */
  primaryAction?: { label: string; onClick: () => void };
  /** Secondary action (e.g. "View Position") */
  secondaryAction?: { label: string; onClick: () => void };
}

export function TransactionConfirmation({
  txHash,
  title,
  details,
  primaryAction,
  secondaryAction,
}: TransactionConfirmationProps) {
  const explorerUrl = `https://testnet.arcscan.app/tx/${txHash}`;

  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-6 flex flex-col items-center text-center">
      {/* Teal checkmark */}
      <div className="w-14 h-14 bg-[#03B5AA]/10 flex items-center justify-center mb-4">
        <HugeiconsIcon icon={Tick01Icon} size={28} className="text-[#03B5AA]" />
      </div>

      <h3 className="text-lg font-semibold font-[family-name:var(--font-heading)] text-[#023436] mb-4">
        {title}
      </h3>

      {/* Detail rows */}
      <div className="w-full space-y-2 mb-4">
        {details.map((d, i) => (
          <div
            key={i}
            className="flex items-center justify-between text-sm px-2"
          >
            <span className="text-[#6B8A8D]">{d.label}</span>
            <span className="font-medium tabular-nums font-[family-name:var(--font-heading)] text-[#023436]">
              {d.value}
            </span>
          </div>
        ))}
      </div>

      {/* Explorer link */}
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-[#03B5AA] hover:text-[#037971] underline underline-offset-2 mb-4"
      >
        View on ArcScan
      </a>

      {/* Actions */}
      <div className="flex gap-3 w-full">
        {secondaryAction && (
          <Button
            variant="outline"
            className="flex-1 h-10 border-[rgba(3,121,113,0.15)] text-[#037971] hover:bg-[#F8FAFA]"
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.label}
          </Button>
        )}
        {primaryAction && (
          <Button
            className="flex-1 h-10 bg-[#03B5AA] text-white hover:bg-[#037971]"
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}
