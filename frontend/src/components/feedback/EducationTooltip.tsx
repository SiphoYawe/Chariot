"use client";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  EDUCATION_CONTENT,
  type EducationTerm,
} from "@/lib/educationContent";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";

interface EducationTooltipProps {
  /** Term key to look up from educationContent */
  term: EducationTerm;
  /** Optional className for the trigger icon */
  className?: string;
}

export function EducationTooltip({ term, className }: EducationTooltipProps) {
  const content = EDUCATION_CONTENT[term];
  if (!content) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center cursor-help focus:outline-none",
            className
          )}
          aria-label={`Learn about ${content.title}`}
        >
          <HugeiconsIcon
            icon={InformationCircleIcon}
            size={16}
            className="text-[#9CA3AF] hover:text-[#6B8A8D] transition-colors"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="max-w-[280px] bg-white border border-[rgba(3,121,113,0.15)] shadow-lg p-4"
        sideOffset={8}
      >
        <p className="text-sm font-semibold text-[#023436] font-[family-name:var(--font-heading)] mb-1.5">
          {content.title}
        </p>
        <p className="text-xs text-[#6B8A8D] leading-relaxed">
          {content.description}
        </p>
      </PopoverContent>
    </Popover>
  );
}
