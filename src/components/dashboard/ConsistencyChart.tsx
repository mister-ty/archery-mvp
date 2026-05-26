'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer
} from 'recharts';

type DataPoint = {
  sessionId: string;
  date: Date;
  stddev: number | null;
  arrowsCount: number;
};

type Props = {
  data: DataPoint[];
};

export function ConsistencyChart({ data }: Props) {
  const chartData = useMemo(
    () =>
      data
        .filter((d) => d.stddev !== null)
        .map((d) => ({
          date: new Date(d.date).toLocaleDateString('es-CO', {
            month: 'short',
            day: 'numeric'
          }),
          stddev: d.stddev,
          arrowsCount: d.arrowsCount
        })),
    [data]
  );

  // Reference line: mean stddev across all sessions shown.
  const meanStddev = useMemo(() => {
    if (chartData.length === 0) return null;
    const sum = chartData.reduce((s, d) => s + (d.stddev ?? 0), 0);
    return sum / chartData.length;
  }, [chartData]);

  if (chartData.length < 2) {
    return (
      <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
        Necesitas al menos 2 sesiones con flechas válidas para ver la evolución
        de la consistencia.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <p className="text-xs text-muted-foreground">
        σ por sesión · <span className="font-medium">menor = más consistente</span>
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            domain={[0, 'dataMax + 0.5']}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) =>
              typeof v === 'number' ? v.toFixed(1) : String(v)
            }
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
            formatter={(v: unknown, name) => {
              if (name === 'stddev' && typeof v === 'number') {
                return [`±${v.toFixed(2)}`, 'σ'];
              }
              return [String(v), String(name)];
            }}
          />
          {meanStddev !== null && (
            <ReferenceLine
              y={meanStddev}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              label={{
                value: `prom ±${meanStddev.toFixed(2)}`,
                fontSize: 10,
                position: 'right',
                fill: 'hsl(var(--muted-foreground))'
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="stddev"
            stroke="hsl(262 83% 58%)"
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 1.5 }}
            activeDot={{ r: 5, strokeWidth: 2 }}
            animationDuration={900}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
