"use client";

import { CircleHelp, X } from "lucide-react";
import { useEffect } from "react";
import { getPageHelp, systemHelpSections } from "@/data/helpContent";
import type { UserItem } from "@/types";

export function HelpCenter({
  pathname,
  currentUser,
  open,
  onClose,
}: {
  pathname: string;
  currentUser: UserItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const pageHelp = getPageHelp(pathname);
  const isAdmin = currentUser?.roles.includes("admin") ?? false;

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const groups = [
    {
      title: "当前页面帮助",
      sections: [
        { title: "这个页面是做什么的", items: [pageHelp.purpose] },
        { title: "先看什么", items: pageHelp.firstLook },
        { title: "怎么判断", items: pageHelp.judgment },
        { title: "常见字段说明", items: pageHelp.fields },
        { title: "常见问题", items: pageHelp.faq },
        ...(isAdmin && pageHelp.advanced ? [{ title: "高级说明", items: pageHelp.advanced }] : []),
      ],
    },
    {
      title: "系统帮助",
      sections: systemHelpSections.filter((section) => !section.adminOnly || isAdmin),
    },
  ];

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="关闭帮助中心"
        className="absolute inset-0 hidden bg-slate-950/30 sm:block"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="帮助中心"
        className="absolute inset-0 flex flex-col border-l border-line bg-white shadow-xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[390px]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-forest">
              <CircleHelp className="h-4 w-4" aria-hidden="true" />
              帮助中心
            </div>
            <h2 className="mt-1 text-lg font-semibold text-ink">{pageHelp.title}</h2>
          </div>
          <button
            type="button"
            aria-label="关闭帮助中心"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-slate-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {groups.map((group) => (
            <section key={group.title} className="rounded-lg border border-line bg-white shadow-panel">
              <div className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">{group.title}</div>
              <div className="divide-y divide-line">
                {group.sections.map((section, index) => (
                  <details key={`${section.title}-${index}`} className="group" open={index < 2}>
                    <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-slate-700">
                      {section.title}
                      <span className="text-xs text-slate-400 group-open:hidden">展开</span>
                      <span className="hidden text-xs text-slate-400 group-open:inline">收起</span>
                    </summary>
                    <ul className="space-y-2 px-4 pb-4 text-sm leading-6 text-slate-600">
                      {section.items.map((item) => (
                        <li key={item} className="rounded-md bg-slate-50 px-3 py-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}
