import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";

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
    <section className="rounded-lg border border-line bg-white p-3 shadow-panel">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-xl font-semibold text-ink">{title}</h1>
            <button
              type="button"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-slate-50 text-slate-500"
              title={description}
              aria-label={`${title}说明`}
            >
              <CircleHelp className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          {meta.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {meta.map((item) => (
                <span
                  key={`${item.label}-${item.value}`}
                  className="inline-flex min-h-7 items-center rounded-md border border-line bg-slate-50 px-2.5 text-xs font-medium text-slate-600"
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
