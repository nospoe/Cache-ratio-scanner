import clsx from "clsx";

interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  color?: "blue" | "green" | "yellow" | "red";
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  color = "blue",
  size = "md",
  showLabel = false,
  className,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <div className={clsx("flex-1 bg-gray-100 rounded-full overflow-hidden", size === "sm" ? "h-1.5" : "h-2.5")}>
        <div
          className={clsx("h-full rounded-full transition-all duration-500", {
            "bg-blue-500": color === "blue",
            "bg-green-500": color === "green",
            "bg-yellow-500": color === "yellow",
            "bg-red-500": color === "red",
          })}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-500 w-10 text-right">{Math.round(pct)}%</span>
      )}
    </div>
  );
}
