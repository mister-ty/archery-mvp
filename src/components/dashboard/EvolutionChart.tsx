'use client';

import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

type DataPoint = {
  sessionId: string;
  date: Date;
  distance: number;
  avg: number;
};

type Props = {
  data: DataPoint[];
};

// Recharts needs concrete color strings (it doesn't reapply CSS vars on
// re-render). We map to the same hues as `--chart-1..5` from globals.css
// so light/dark themes share palette, plus a 6th for distance variety.
const LINE_COLORS = [
  'hsl(221 83% 53%)', // chart-1 blue
  'hsl(0 84% 60%)',   // chart-2 red
  'hsl(142 71% 45%)', // chart-3 green
  'hsl(38 92% 50%)',  // chart-4 amber
  'hsl(262 83% 58%)', // chart-5 violet
  'hsl(330 80% 60%)'  // pink fallback
];

export function EvolutionChart({ data }: Props) {
  const distances = useMemo(
    () => [...new Set(data.map((d) => d.distance))].sort((a, b) => a - b),
    [data]
  );

  const [activeDistances, setActiveDistances] = useState<Set<number>>(new Set(distances));

  const chartData = useMemo(() => {
    // Group by session date
    const bySession: Record<string, { date: string; [k: string]: string | number }> = {};
    for (const pt of data) {
      const key = pt.sessionId;
      if (!bySession[key]) {
        bySession[key] = {
          date: new Date(pt.date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })
        };
      }
      bySession[key][`${pt.distance}m`] = pt.avg;
    }
    return Object.values(bySession);
  }, [data]);

  const toggleDistance = (d: number) => {
    setActiveDistances((prev) => {
      const next = new Set(prev);
      if (next.has(d)) {
        if (next.size > 1) next.delete(d);
      } else {
        next.add(d);
      }
      return next;
    });
  };

  if (!data.length) {
    return (
      <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
        Sin sesiones registradas aún.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {distances.map((d, i) => (
          <button
            key={d}
            onClick={() => toggleDistance(d)}
            className={`rounded-full px-3 py-0.5 text-xs font-medium border transition ${
              activeDistances.has(d)
                ? 'text-white border-transparent'
                : 'bg-transparent text-muted-foreground border-border'
            }`}
            style={activeDistances.has(d) ? { backgroundColor: LINE_COLORS[i % LINE_COLORS.length] } : {}}
          >
            {d}m
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
              boxShadow:
                '0 2px 4px 0 hsl(222 47% 11% / 0.06), 0 4px 12px -2px hsl(222 47% 11% / 0.08)',
              color: 'hsl(var(--foreground))'
            }}
            cursor={{ stroke: 'hsl(var(--border))', strokeDasharray: '3 3' }}
            formatter={(v) => (typeof v === 'number' ? v.toFixed(1) : v)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {distances.map((d, i) =>
            activeDistances.has(d) ? (
              <Line
                key={d}
                type="monotone"
                dataKey={`${d}m`}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 1.5 }}
                activeDot={{ r: 5, strokeWidth: 2 }}
                connectNulls
                animationDuration={800}
                animationBegin={i * 120}
                animationEasing="ease-out"
              />
            ) : null
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
