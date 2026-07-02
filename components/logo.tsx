import { cn } from "@/lib/utils";

/**
 * QR-dot mark: a 3×3 module grid with the center dot in brand blue —
 * the one pixel that routes everyone to the right place.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-5", className)}
    >
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => {
          const center = row === 1 && col === 1;
          return (
            <rect
              key={`${row}-${col}`}
              x={col * 8 + 1}
              y={row * 8 + 1}
              width="6"
              height="6"
              rx={center ? 3 : 1.5}
              className={center ? "fill-brand" : "fill-current"}
            />
          );
        }),
      )}
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight">OneLink</span>
    </span>
  );
}
