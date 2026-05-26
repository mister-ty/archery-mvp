'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import type { WeeklyAgg } from '@/lib/analytics/training-load';

type Props = {
  data: WeeklyAgg[];
};

function formatWeekLabel(weekStart: Date): string {
  // Use UTC because the upstream `weekStart` is normalised to UTC 00:00.
  const month = new Intl.DateTimeFormat('es-CO', {
    month: 'short',
    timeZone: 'UTC'
  }).format(weekStart);
  return `${weekStart.getUTCDate()} ${month}`;
}

export function WeeklyVolumeChart({ data }: Props) {
  const chartData = useMemo(
    () =>
      data.map((w) => ({
        label: formatWeekLabel(w.weekStart),
        arrows: w.arrows,
        sessions: w.sessions
      })),
    [data]
  );

  const totalArrows = useMemo(
    () => chartData.reduce((s, d) => s + d.arrows, 0),
    [chartData]
  );

  if (chartData.length === 0 || totalArrows === 0) {
    return (
      <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
        Sin actividad registrada en las últimas 12 semanas.
      </div>
    );
  }

  const maxArrows = Math.max(...chartData.map((d) => d.arrows));

  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <p className="text-xs text-muted-foreground">
        Flechas por semana · últimas {chartData.length} semanas ·{' '}
        <span className="font-medium tabular-nums">{totalArrows}</span> total
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
            contentStyle={{
              fontSize: 12,
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
              boxShadow:
                '0 2px 4px 0 hsl(222 47% 11% / 0.06), 0 4px 12px -2px hsl(222 47% 11% / 0.08)',
              color: 'hsl(var(--foreground))'
            }}
            formatter={(value: unknown, name) => {
              if (name === 'arrows') return [String(value), 'Flechas'];
              if (name === 'sessions') return [String(value), 'Sesiones'];
              return [String(value), String(name)];
            }}
          />
          <Bar
            dataKey="arrows"
            radius={[4, 4, 0, 0]}
            animationDuration={700}
            animationEasing="ease-out"
          >
            {chartData.map((d, i) => (
              <Cell
                key={i}
                fill={
                  d.arrows === maxArrows && d.arrows > 0
                    ? 'hsl(142 71% 45%)' // chart-3 green (highlight)
                    : 'hsl(221 83% 53%)' // chart-1 blue (default)
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
