import type { ReactNode } from "react";

export function MetricCard({
  title,
  value,
  detail,
  icon,
  tone = "neutral",
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: ReactNode;
  tone?: "neutral" | "good" | "warn" | "risk";
}) {
  const toneClass = {
    neutral: "bg-slate-50 text-slate-700",
    good: "bg-emerald-50 text-forest",
    warn: "bg-amber-50 text-amber",
    risk: "bg-rose-50 text-coral",
  }[tone];

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-600">{title}</div>
          <div className="mt-2 truncate text-2xl font-semibold text-ink">{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${toneClass}`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">{detail}</p>
    </section>
  );
}
