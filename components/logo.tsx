import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid size-7 place-items-center rounded-[6px] bg-signal text-signal-ink">
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
          <path
            d="M3 13V3h5.2c2.3 0 3.8 1.3 3.8 3.4S10.5 9.8 8.2 9.8H5.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="square"
          />
          <path d="M9.4 9.8 13 13" fill="none" stroke="currentColor" strokeWidth="1.9" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight">
          Prompt<span className="text-signal">XP</span>
        </span>
        <span className="label-mono mt-1 text-[9px] opacity-60">prompt control plane</span>
      </span>
    </span>
  );
}
