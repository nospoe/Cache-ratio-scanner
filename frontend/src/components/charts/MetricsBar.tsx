import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface MetricPoint {
  label: string;
  value: number;
}

interface MetricsBarProps {
  data: MetricPoint[];
  unit?: string;
  title?: string;
  thresholds?: { good: number; warn: number }; // values below good = green, below warn = yellow, else red
}

export function MetricsBar({ data, unit = "ms", title, thresholds }: MetricsBarProps) {
  const getColor = (value: number) => {
    if (!thresholds) return "#3b82f6";
    if (value <= thresholds.good) return "#22c55e";
    if (value <= thresholds.warn) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div>
      {title && <p className="text-sm font-medium text-gray-700 mb-3">{title}</p>}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}${unit}`}
          />
          <Tooltip
            formatter={(value: number) => [`${value}${unit}`, ""]}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={getColor(entry.value)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
