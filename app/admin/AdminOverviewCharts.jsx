"use client"

import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts'

const GREEN = '#1D9E75'
const AMBER = '#F59E0B'
const BLUE  = '#3B82F6'
const PURPLE = '#8B5CF6'

// ── Custom tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.08] bg-white dark:bg-slate-900 px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-slate-700 dark:text-slate-200 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.value} {p.name}
        </p>
      ))}
    </div>
  )
}

// ── Extractions per day (line chart) ──────────────────────────────────────────

export function ExtractionsLineChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<ChartTooltip />} />
        <Line
          type="monotone"
          dataKey="count"
          name="extractions"
          stroke={GREEN}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── AI Provider breakdown (bar chart) ─────────────────────────────────────────

const PROVIDER_COLORS = {
  'gemini-pdf':    GREEN,
  'claude-haiku':  PURPLE,
  'gemini-flash':  AMBER,
  'gpt-4o':        BLUE,
  'qwen':          '#EC4899',
  'unknown':       '#94A3B8',
}

export function ProviderBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
        <XAxis
          dataKey="provider"
          tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="count" name="docs" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={PROVIDER_COLORS[entry.provider] ?? '#94A3B8'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
