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

export function VitalTrendChart({ data, unit, label, range, color = "#d4956a" }: VitalTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-border-subtle bg-surface text-sm text-text-muted">
        No data yet
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-medium text-text">{label}</h4>
        <span className="text-[11px] text-text-muted">Trend estimate · Not clinical</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2a42" />
          <XAxis
            dataKey="t"
            tickFormatter={formatTime}
            stroke="#3a4a6a"
            tick={{ fontSize: 10, fill: "#5e6e8a" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke="#3a4a6a"
            tick={{ fontSize: 10, fill: "#5e6e8a" }}
            axisLine={false}
            tickLine={false}
            domain={range ? [range[0] - 2, range[1] + 2] : ["auto", "auto"]}
          />
          {range && (
            <ReferenceLine y={range[0]} stroke="#f0a04a" strokeDasharray="4 4" strokeOpacity={0.3} />
          )}
          {range && (
            <ReferenceLine y={range[1]} stroke="#f0a04a" strokeDasharray="4 4" strokeOpacity={0.3} />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e2842",
              border: "1px solid #2a3654",
              borderRadius: "10px",
              fontSize: "12px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
            labelFormatter={formatTime}
            formatter={(value: number) => [`${value} ${unit}`, label]}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: color, stroke: "#182035", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
