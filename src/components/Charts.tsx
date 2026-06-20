import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export type ChartPoint = {
  label: string;
  value: number;
  secondary?: number;
};

export type DonutSlice = {
  label: string;
  value: number;
  color: string;
};

const chartBlue = "#2563EB";
const chartGrid = "#E5E7EB";
const donutPalette = ["#2563EB", "#60A5FA", "#94A3B8", "#CBD5E1"];

function clampMax(values: number[]) {
  return Math.max(1, ...values.map((value) => Math.abs(value)));
}

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(value: number) {
  return `${Math.round(value)}%`;
}

function chartTitle(title: string, description: string) {
  return (
    <CardHeader>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
    </CardHeader>
  );
}

export function LineChartCard({
  title,
  description,
  data,
  valueLabel = currency,
}: {
  title: string;
  description: string;
  data: ChartPoint[];
  valueLabel?: (value: number) => string;
}) {
  const width = 560;
  const height = 220;
  const padding = 32;
  const max = clampMax(data.map((item) => item.value));
  const points = data.map((item, index) => {
    const x = padding + (index / Math.max(1, data.length - 1)) * (width - padding * 2);
    const y = height - padding - (item.value / max) * (height - padding * 2);
    return { ...item, x, y };
  });
  const d = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <Card className="overflow-hidden">
      {chartTitle(title, description)}
      <CardContent>
        <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label={title}>
          <title>{title}</title>
          {[0, 1, 2, 3].map((tick) => {
            const y = padding + tick * ((height - padding * 2) / 3);
            return <line key={tick} x1={padding} x2={width - padding} y1={y} y2={y} stroke={chartGrid} />;
          })}
          <path d={d} fill="none" stroke={chartBlue} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point) => (
            <g key={point.label}>
              <title>{`${point.label}: ${valueLabel(point.value)}`}</title>
              <circle cx={point.x} cy={point.y} r="4" fill={chartBlue} stroke="#FFFFFF" strokeWidth="2" />
              <text x={point.x} y={Math.max(14, point.y - 10)} textAnchor="middle" className="fill-slate-600 text-[10px]">
                {valueLabel(point.value)}
              </text>
              <text x={point.x} y={height - 6} textAnchor="middle" className="fill-slate-500 text-[11px]">
                {point.label}
              </text>
            </g>
          ))}
        </svg>
      </CardContent>
    </Card>
  );
}

export function BarChartCard({
  title,
  description,
  data,
  valueLabel = currency,
}: {
  title: string;
  description: string;
  data: ChartPoint[];
  valueLabel?: (value: number) => string;
}) {
  const max = clampMax(data.map((item) => item.value));

  return (
    <Card>
      {chartTitle(title, description)}
      <CardContent>
        <div className="space-y-4">
          {data.map((item) => (
            <div key={item.label} className="grid gap-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium text-ink">{item.label}</span>
                <span className="shrink-0 text-slate-500">{valueLabel(item.value)}</span>
              </div>
              <div className="h-3 rounded-md bg-slate-100">
                <div
                  className="h-3 rounded-md bg-blue-600"
                  style={{ width: `${Math.max(6, (Math.abs(item.value) / max) * 100)}%` }}
                  title={`${item.label}: ${valueLabel(item.value)}`}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function DonutChartCard({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: DonutSlice[];
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  let offset = 25;

  return (
    <Card>
      {chartTitle(title, description)}
      <CardContent>
        <div className="grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center">
          <svg viewBox="0 0 120 120" className="mx-auto h-44 w-44" role="img" aria-label={title}>
            <title>{title}</title>
            <circle cx="60" cy="60" r="42" fill="none" stroke={chartGrid} strokeWidth="18" />
            {data.map((item, index) => {
              const dash = (item.value / total) * 264;
              const slice = (
                <circle
                  key={item.label}
                  cx="60"
                  cy="60"
                  r="42"
                  fill="none"
                  stroke={donutPalette[index % donutPalette.length]}
                  strokeDasharray={`${dash} ${264 - dash}`}
                  strokeDashoffset={offset}
                  strokeLinecap="butt"
                  strokeWidth="18"
                  transform="rotate(-90 60 60)"
                >
                  <title>{`${item.label}: ${percent((item.value / total) * 100)}`}</title>
                </circle>
              );
              offset -= dash;
              return slice;
            })}
            <text x="60" y="56" textAnchor="middle" className="fill-ink text-[16px] font-semibold">
              {percent(100)}
            </text>
            <text x="60" y="73" textAnchor="middle" className="fill-slate-500 text-[10px]">
              total
            </text>
          </svg>
          <div className="space-y-3">
            {data.map((item, index) => (
              <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span className="h-3 w-3 rounded-sm" style={{ background: donutPalette[index % donutPalette.length] }} />
                  <span className="truncate text-slate-700">{item.label}</span>
                </span>
                <span className="font-semibold text-ink">{percent((item.value / total) * 100)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FunnelChartCard({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: ChartPoint[];
}) {
  const max = clampMax(data.map((item) => item.value));

  return (
    <Card>
      {chartTitle(title, description)}
      <CardContent>
        <div className="space-y-3">
          {data.map((item) => {
            const width = Math.max(30, (item.value / max) * 100);
            return (
              <div key={item.label} className="grid gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{item.label}</span>
                  <span className="text-slate-500">{item.value.toLocaleString("zh-CN")}</span>
                </div>
                <div className="flex h-9 items-center rounded-md bg-slate-100">
                  <div
                    className="flex h-9 items-center rounded-md bg-blue-600 px-3 text-xs font-medium text-white"
                    style={{ width: `${width}%` }}
                    title={`${item.label}: ${item.value.toLocaleString("zh-CN")}`}
                  >
                    {percent(width)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
