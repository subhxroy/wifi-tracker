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

export function VitalTrendChart({ data, unit, label, range, color = "#171717" }: VitalTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-3xl border border-hairline bg-paper text-sm text-mid-gray">
        No data yet
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-hairline bg-paper p-5">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-medium text-ink">{label}</h4>
        <span className="text-[11px] text-mid-gray">Trend estimate · Not clinical</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis
            dataKey="t"
            tickFormatter={formatTime}
            stroke="#d4d4d4"
            tick={{ fontSize: 10, fill: "#737373" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke="#d4d4d4"
            tick={{ fontSize: 10, fill: "#737373" }}
            axisLine={false}
            tickLine={false}
            domain={range ? [range[0] - 2, range[1] + 2] : ["auto", "auto"]}
          />
          {range && (
            <ReferenceLine y={range[0]} stroke="#a3a3a3" strokeDasharray="4 4" strokeOpacity={0.5} />
          )}
          {range && (
            <ReferenceLine y={range[1]} stroke="#a3a3a3" strokeDasharray="4 4" strokeOpacity={0.5} />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid #e5e5e5",
              borderRadius: "10px",
              fontSize: "12px",
              boxShadow: "0 0 0 1px rgba(23,23,23,0.05), 0 4px 12px rgba(0,0,0,0.1)",
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
            activeDot={{ r: 4, fill: color, stroke: "#ffffff", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
