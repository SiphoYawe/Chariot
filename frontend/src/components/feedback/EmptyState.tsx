"use client";

import { Button } from "@/components/ui/button";
import type { Icon } from "@tabler/icons-react";

interface EmptyStateProps {
  /** Tabler icon to display */
  icon: Icon;
  /** Headline text (e.g. "Start Earning") */
  headline: string;
  /** Description text */
  description: string;
  /** CTA button config */
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon: IconComp,
  headline,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="border border-[rgba(3,121,113,0.15)] bg-white p-8 flex flex-col items-center text-center">
      <div className="w-14 h-14 bg-[#F8FAFA] flex items-center justify-center mb-4">
        <IconComp size={28} className="text-[#03B5AA]" />
      </div>

      <h3 className="text-lg font-semibold font-[family-name:var(--font-heading)] text-[#023436] mb-2">
        {headline}
      </h3>

      <p className="text-sm text-[#6B8A8D] max-w-sm mb-6">{description}</p>

      {action && (
        <Button
          onClick={action.onClick}
          className="bg-[#03B5AA] text-white hover:bg-[#037971] font-medium"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
