"use client";

import { Download, Filter, RefreshCcw, Search } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/Button";

export function QuickActions() {
  const { dictionary } = useLanguage();

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-white p-3 shadow-panel lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => window.print()}>
          <Download className="h-4 w-4" aria-hidden="true" />
          {dictionary.common.export}
        </Button>
        <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          {dictionary.common.refresh}
        </Button>
        <Button type="button" variant="secondary">
          <Filter className="h-4 w-4" aria-hidden="true" />
          {dictionary.common.filter}
        </Button>
      </div>
      <label className="relative min-w-0 flex-1 lg:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          placeholder={dictionary.common.search}
          className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm text-ink outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
        />
      </label>
    </section>
  );
}
