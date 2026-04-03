import clsx from "clsx";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({ children, className, padding = "md" }: CardProps) {
  return (
    <div
      className={clsx(
        "bg-white rounded-xl border border-gray-200 shadow-sm",
        {
          "p-0": padding === "none",
          "p-4": padding === "sm",
          "p-6": padding === "md",
          "p-8": padding === "lg",
        },
        className
      )}
    >
      {children}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number | null;
  unit?: string;
  trend?: "good" | "warn" | "bad" | "neutral";
  description?: string;
  className?: string;
}

export function MetricCard({ label, value, unit, trend = "neutral", description, className }: MetricCardProps) {
  const valueColor = {
    good: "text-green-600",
    warn: "text-yellow-600",
    bad: "text-red-600",
    neutral: "text-gray-900",
  }[trend];

  return (
    <Card className={className} padding="sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={clsx("text-2xl font-bold", valueColor)}>
          {value !== null && value !== undefined ? value : "—"}
        </span>
        {unit && <span className="text-sm text-gray-400">{unit}</span>}
      </div>
      {description && <p className="mt-1 text-xs text-gray-400">{description}</p>}
    </Card>
  );
}
