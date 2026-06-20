"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CalendarClock, Database } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { Badge } from "@/components/ui/Badge";

function formatTimestamp(locale: string, value: Date) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function PageHeader() {
  const pathname = usePathname();
  const { locale, dictionary } = useLanguage();
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    setLastUpdated(formatTimestamp(locale, new Date()));
  }, [locale, pathname]);

  const title = dictionary.routes[pathname as keyof typeof dictionary.routes] ?? pathname;
  const description =
    dictionary.pageDescriptions[pathname as keyof typeof dictionary.pageDescriptions] ??
    dictionary.app.subtitle;

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="max-w-4xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">
            <CalendarClock className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            {dictionary.common.lastUpdated}: {lastUpdated || "-"}
          </Badge>
          <Badge tone="neutral">
            <Database className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            {dictionary.common.dataSource}: {dictionary.common.sqliteSource}
          </Badge>
        </div>
      </div>
    </section>
  );
}
