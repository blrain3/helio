import type { DailyEnergyPoint } from '../../lib/types';

interface EnergyTrendChartProps {
  data: DailyEnergyPoint[];
  label?: string;
}

const CHART_WIDTH = 680;
const CHART_HEIGHT = 220;
const PADDING_X = 42;
const PADDING_Y = 28;

export function EnergyTrendChart({
  data,
  label = '近 7 日发电量趋势',
}: EnergyTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex min-h-56 items-center justify-center rounded-md border border-dashed border-slate-200 bg-white px-6 text-sm text-slate-500">
        暂时没有可展示的发电记录
      </div>
    );
  }

  const maxValue = Math.max(...data.map((point) => point.totalKwh), 1);
  const chartInnerWidth = CHART_WIDTH - PADDING_X * 2;
  const chartInnerHeight = CHART_HEIGHT - PADDING_Y * 2;
  const step = data.length === 1 ? 0 : chartInnerWidth / (data.length - 1);
  const points = data.map((point, index) => {
    const x = PADDING_X + index * step;
    const y = PADDING_Y + chartInnerHeight - (point.totalKwh / maxValue) * chartInnerHeight;
    return { ...point, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  return (
    <figure className="rounded-md border border-slate-200 bg-white p-4">
      <figcaption className="mb-3 flex items-center justify-between text-sm font-medium text-slate-800">
        <span>{label}</span>
        <span className="text-xs font-normal text-slate-500">单位：kWh</span>
      </figcaption>
      <svg
        className="h-auto w-full"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={label}
      >
        <line
          x1={PADDING_X}
          x2={CHART_WIDTH - PADDING_X}
          y1={PADDING_Y + chartInnerHeight}
          y2={PADDING_Y + chartInnerHeight}
          stroke="#cbd5e1"
        />
        <text x={PADDING_X} y={18} fill="#64748b" fontSize="11">
          {formatKwh(maxValue)}
        </text>
        <path d={path} fill="none" stroke="#eab308" strokeWidth="3" strokeLinecap="round" />
        {points.map((point) => (
          <g key={point.day}>
            <circle cx={point.x} cy={point.y} r="4" fill="#facc15" stroke="#a16207" strokeWidth="1.5" />
            <text x={point.x} y={CHART_HEIGHT - 9} textAnchor="middle" fill="#64748b" fontSize="11">
              {formatDay(point.day)}
            </text>
          </g>
        ))}
      </svg>
      <ul className="sr-only">
        {data.map((point) => (
          <li key={point.day}>
            <span>{formatDay(point.day)}</span>{' '}
            <span>{formatKwh(point.totalKwh)}</span>，{point.recordCount} 条记录
          </li>
        ))}
      </ul>
    </figure>
  );
}

function formatDay(value: string): string {
  const date = new Date(value);
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}

function formatKwh(value: number): string {
  return `${value.toLocaleString('zh-CN', { maximumFractionDigits: 1 })} kWh`;
}
