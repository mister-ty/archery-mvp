'use client';

import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import type { WeeklyClubAgg } from '@/lib/analytics/team-aggregate';

type Props = {
  data: WeeklyClubAgg[];
};

function formatWeekLabel(weekStart: Date): string {
  const month = new Intl.DateTimeFormat('es-CO', {
    month: 'short',
    timeZone: 'UTC'
  }).format(weekStart);
  return `${weekStart.getUTCDate()} ${month}`;
}

export function ClubTrendChart({ data }: Props) {
  const chartData = useMemo(
    () =>
      data.map((w) => ({
        label: formatWeekLabel(w.weekStart),
        arrows: w.totalArrows,
        sessions: w.totalSessions,
        athletes: w.activeAthletes,
        avg: w.avgClubScore
      })),
    [data]
  );

  const totalArrows = useMemo(
    () => chartData.reduce((s, d) => s + d.arrows, 0),
    [chartData]
  );

  if (chartData.length === 0 || totalArrows === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title={`Sin actividad del club en las últimas ${chartData.length || 12} semanas`}
        description="La tendencia agregada aparecerá cuando el equipo registre sesiones."
        compact
      />
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <p className="text-xs text-muted-foreground">
        Flechas + promedio club · últimas {chartData.length} semanas ·{' '}
        <span className="font-medium tabular-nums">{totalArrows}</span> flechas total
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart
          data={chartData}
          margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
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
            yAxisId="arrows"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="avg"
            orientation="right"
            domain={[0, 10]}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={28}
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
              if (name === 'athletes') return [String(value), 'Atletas activos'];
              if (name === 'avg') {
                if (value === null || value === undefined) return ['—', 'Promedio'];
                return [`${value} pts`, 'Promedio'];
              }
              return [String(value), String(name)];
            }}
          />
          <Bar
            yAxisId="arrows"
            dataKey="arrows"
            fill="hsl(221 83% 53%)"
            radius={[4, 4, 0, 0]}
            animationDuration={700}
            animationEasing="ease-out"
          />
          <Line
            yAxisId="avg"
            type="monotone"
            dataKey="avg"
            stroke="hsl(142 71% 45%)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'hsl(142 71% 45%)' }}
            activeDot={{ r: 5 }}
            connectNulls={false}
            animationDuration={900}
            animationBegin={150}
            animationEasing="ease-out"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
