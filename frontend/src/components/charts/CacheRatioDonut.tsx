import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface CacheRatioDonutProps {
  hitRatio: number | null;
  title?: string;
}

const COLORS = {
  HIT: "#22c55e",
  MISS: "#94a3b8",
  BYPASS: "#f59e0b",
  OTHER: "#e2e8f0",
};

export function CacheRatioDonut({ hitRatio, title = "Cache Hit Ratio" }: CacheRatioDonutProps) {
  if (hitRatio === null || hitRatio === undefined) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No cache data
      </div>
    );
  }

  const hit = Math.round(hitRatio * 100);
  const miss = 100 - hit;

  const data = [
    { name: "HIT", value: hit, color: COLORS.HIT },
    { name: "MISS", value: miss, color: COLORS.MISS },
  ].filter((d) => d.value > 0);

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">{title}</p>
      <div className="relative">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `${value}%`} />
            <Legend
              formatter={(value) => (
                <span className="text-xs text-gray-600">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{hit}%</p>
            <p className="text-[10px] text-gray-400">HIT</p>
          </div>
        </div>
      </div>
    </div>
  );
}
