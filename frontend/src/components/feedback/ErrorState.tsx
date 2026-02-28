import { IconAlertTriangleFilled } from "@tabler/icons-react";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Unable to load data. Your funds are safe. Click retry to try again.",
  onRetry
}: ErrorStateProps) {
  return (
    <div className="bg-[#F8FAFA] border border-[rgba(3,121,113,0.15)] p-6 flex flex-col items-center justify-center text-center">
      <IconAlertTriangleFilled size={32} className="text-[#F59E0B] mb-3" />
      <p className="text-sm text-[#6B8A8D] max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 px-4 py-2 text-sm font-medium bg-[#03B5AA] text-white hover:bg-[#037971] transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
