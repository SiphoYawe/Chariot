"use client";

import { Tick01Icon, Loading03Icon, LockIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";

export type ApprovalState = "needs_approval" | "approving" | "approved";

interface ApprovalStepProps {
  state: ApprovalState;
  tokenSymbol?: string;
  onApprove: () => void;
  disabled?: boolean;
}

export function ApprovalStep({
  state,
  tokenSymbol = "USDC",
  onApprove,
  disabled,
}: ApprovalStepProps) {
  if (state === "approved") {
    return (
      <div className="flex items-center gap-2 p-3 bg-[#03B5AA]/10 border border-[#03B5AA]/20">
        <HugeiconsIcon icon={Tick01Icon} size={16} className="text-[#03B5AA]" />
        <span className="text-sm font-medium text-[#037971]">
          {tokenSymbol} approved
        </span>
      </div>
    );
  }

  if (state === "approving") {
    return (
      <div className="flex items-center gap-2 p-3 bg-[#F8FAFA] border border-[rgba(3,121,113,0.15)]">
        <HugeiconsIcon
          icon={Loading03Icon}
          size={16}
          className="text-[#03B5AA] animate-spin"
        />
        <span className="text-sm text-[#6B8A8D]">
          Approving {tokenSymbol} -- confirm in wallet...
        </span>
      </div>
    );
  }

  return (
    <Button
      onClick={onApprove}
      disabled={disabled}
      className="w-full h-11 bg-[#037971] text-white hover:bg-[#023436] font-medium"
    >
      <HugeiconsIcon icon={LockIcon} size={16} />
      Approve {tokenSymbol}
    </Button>
  );
}
