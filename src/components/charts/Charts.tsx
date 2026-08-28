'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoneyCompact } from '@/lib/format';

const GOLD = '#C9A227';
const GOLD_LIGHT = '#E5C76B';
const GRID = 'rgba(255,255,255,0.07)';
const AXIS = '#777777';

const tooltipStyle = {
  background: '#181818',
  border: '1px solid rgba(201,162,39,0.35)',
  borderRadius: 12,
  color: '#FAF8F4',
  fontSize: 12,
};

export function RevenueAreaChart({ data }: { data: { label: string; value: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GOLD} stopOpacity={0.45} />
              <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis
            tick={{ fill: AXIS, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatMoneyCompact(Number(v))}
            width={48}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => [`${Number(v).toLocaleString('fr-FR')} FCFA`, 'Recettes']}
            labelStyle={{ color: '#C9C3CD' }}
          />
          <Area type="monotone" dataKey="value" stroke={GOLD} strokeWidth={2} fill="url(#goldFill)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CountBarChart({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: AXIS, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v) => [Number(v), label]} />
          <Bar dataKey="value" fill={GOLD} radius={[6, 6, 0, 0]} maxBarSize={38} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const PIE_COLORS = ['#C9A227', '#8A3FA6', '#E5C76B', '#6B2A87', '#A98A22', '#A661BE'];

export function SharePieChart({ data }: { data: { label: string; value: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={45} outerRadius={72} paddingAngle={3}>
            {data.map((entry, i) => (
              <Cell key={entry.label} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
            ))}
          </Pie>
          <Legend wrapperStyle={{ fontSize: 11, color: AXIS }} />
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export { GOLD_LIGHT };
