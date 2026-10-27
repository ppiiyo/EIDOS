import React from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertTriangle } from 'lucide-react';

export interface KPICardProps {
  id?: string;
  title: string;
  subtitle: string;
  value: number;
  unit?: '%' | '$' | '';
  prefix?: string;
  trend: number;
  sparkline: number[];
  /**
   * When true (e.g. Zero-Result Rate), lower values are better and > threshold triggers critical red alert
   */
  isInverseMetric?: boolean;
  criticalThreshold?: number;
  accentColor?: 'green' | 'red' | 'blue';
}

const DAY_LABELS = ['Д-6', 'Д-5', 'Д-4', 'Д-3', 'Д-2', 'Вчера', 'Сегодня'];

export const KPICard: React.FC<KPICardProps> = ({
  id,
  title,
  subtitle,
  value,
  unit = '%',
  prefix = '',
  trend,
  sparkline,
  isInverseMetric = false,
  criticalThreshold,
  accentColor = 'blue',
}) => {
  const isCritical =
    typeof criticalThreshold === 'number' && value > criticalThreshold;

  // Determine whether trend direction is favorable
  const isPositiveOutcome = isInverseMetric ? trend <= 0 : trend >= 0;

  const strokeHex = isCritical
    ? '#ef4444'
    : accentColor === 'green' || isPositiveOutcome
    ? '#22c55e'
    : accentColor === 'red'
    ? '#ef4444'
    : '#3b82f6';

  const chartData = (sparkline || []).map((val, idx) => ({
    day: DAY_LABELS[idx] || `День ${idx + 1}`,
    value: val,
  }));

  const formattedValue =
    unit === '$' || prefix === '$'
      ? value.toFixed(2)
      : value.toFixed(1);

  const trendArrow = trend >= 0 ? '▲' : '▼';
  const trendSign = trend > 0 ? '+' : '';

  return (
    <div
      id={id}
      className={`relative flex flex-col justify-between rounded-lg bg-[#1e293b] p-4 border transition-colors ${
        isCritical
          ? 'border-[#ef4444] ring-1 ring-[#ef4444]/40'
          : 'border-slate-700/80 hover:border-slate-600'
      }`}
    >
      {/* Top Row: Label + Trend / Critical Indicator */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-300">
              {title}
            </span>
            {isCritical && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40"
                title="Превышен порог 10% пустых выдач — требуется добавление синонимов"
              >
                <AlertTriangle size={11} />
                CRITICAL &gt; {criticalThreshold}%
              </span>
            )}
          </div>
          <p className="text-[12px] text-slate-400 mt-0.5 leading-tight">{subtitle}</p>
        </div>

        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-mono tabular-nums font-semibold shrink-0 ${
            isCritical
              ? 'bg-[#ef4444]/20 text-[#ef4444]'
              : isPositiveOutcome
              ? 'bg-[#22c55e]/15 text-[#22c55e]'
              : 'bg-[#ef4444]/15 text-[#ef4444]'
          }`}
        >
          <span>{trendArrow}</span>
          <span>
            {trendSign}
            {trend.toFixed(1)}
            {unit === '$' || prefix === '$' ? '$' : '%'}
          </span>
        </span>
      </div>

      {/* Middle Row: 48px Tabular Figure + Sparkline */}
      <div className="flex items-end justify-between gap-3 mt-1">
        <div
          className={`text-[48px] leading-none font-bold font-mono tabular-nums tracking-tight ${
            isCritical ? 'text-[#ef4444]' : 'text-[#f1f5f9]'
          }`}
        >
          {prefix}
          {formattedValue}
          {unit !== '$' && <span className="text-[24px] font-semibold text-slate-400 ml-0.5">{unit}</span>}
        </div>

        {/* 7-Day Sparkline */}
        <div className="w-28 h-12 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <defs>
                <linearGradient id={`grad-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={strokeHex} stopOpacity={0.38} />
                  <stop offset="95%" stopColor={strokeHex} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  color: '#f1f5f9',
                }}
                itemStyle={{ color: strokeHex, padding: 0 }}
                labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                formatter={(val: any) => [
                  `${prefix}${Number(val).toFixed(unit === '$' || prefix === '$' ? 2 : 1)}${
                    unit === '$' ? '' : unit
                  }`,
                  title,
                ]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={strokeHex}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#grad-${title.replace(/\s+/g, '-')})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row: 7-day range micro-caption */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-700/50 text-[12px] text-slate-400 font-mono tabular-nums">
        <span>7d min: {Math.min(...(sparkline.length ? sparkline : [value])).toFixed(1)}</span>
        <span>vs пред. 7 дней</span>
        <span>7d max: {Math.max(...(sparkline.length ? sparkline : [value])).toFixed(1)}</span>
      </div>
    </div>
  );
};
