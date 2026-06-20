import type { ReactNode } from "react";

type PageHeaderMeta = {
  label: string;
  value: string;
};

export function StandardPageHeader({
  title,
  description,
  meta = [],
  actions,
}: {
  title: string;
  description: string;
  meta?: PageHeaderMeta[];
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-ink">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          {meta.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {meta.map((item) => (
                <span
                  key={`${item.label}-${item.value}`}
                  className="inline-flex min-h-8 items-center rounded-md border border-line bg-slate-50 px-3 text-xs font-medium text-slate-600"
                >
                  <span className="text-slate-400">{item.label}：</span>
                  <span className="ml-1 text-slate-700">{item.value}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}
