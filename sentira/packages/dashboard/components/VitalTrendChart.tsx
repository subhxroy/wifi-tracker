"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

interface DataPoint {
  t: number;
  v: number;
}

interface VitalTrendChartProps {
  data: DataPoint[];
  unit: string;
  label: string;
  range?: [number, number];
  color?: string;
}

function formatTime(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function VitalTrendChart({ data, unit, label, range, color = "#8b7cf6" }: VitalTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl bg-surface text-sm text-text-muted">
        No data yet
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-heading text-sm font-medium text-text">{label}</h4>
        <span className="text-xs text-text-dim">Trend estimate · Not clinical</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
          <XAxis
            dataKey="t"
            tickFormatter={formatTime}
            stroke="#5a5a72"
            tick={{ fontSize: 10, fill: "#5a5a72" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke="#5a5a72"
            tick={{ fontSize: 10, fill: "#5a5a72" }}
            axisLine={false}
            tickLine={false}
            domain={range ? [range[0] - 2, range[1] + 2] : ["auto", "auto"]}
          />
          {range && (
            <ReferenceLine y={range[0]} stroke="#f0a04a" strokeDasharray="4 4" strokeOpacity={0.4} />
          )}
          {range && (
            <ReferenceLine y={range[1]} stroke="#f0a04a" strokeDasharray="4 4" strokeOpacity={0.4} />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: "#1c1c2e",
              border: "1px solid #2a2a3e",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelFormatter={formatTime}
            formatter={(value: number) => [`${value} ${unit}`, label]}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
