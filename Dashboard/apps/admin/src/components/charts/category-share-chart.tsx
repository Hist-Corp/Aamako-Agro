// See revenue-trend-chart.tsx — same code-split contract for recharts.
'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export function CategoryShareChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <div className="h-64 px-4 pb-4">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [`${Number(value ?? 0)}%`, 'Share']} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
