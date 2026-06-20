"use client";

import { Download, Ellipsis, Filter, RefreshCcw, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/Button";
import { readStoredUser } from "@/lib/permissions";
import type { UserItem } from "@/types";

export function QuickActions() {
  const { dictionary } = useLanguage();
  const [open, setOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserItem | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const canUseMoreActions =
    currentUser?.roles.includes("admin") ||
    currentUser?.roles.includes("finance") ||
    currentUser?.roles.includes("buyer");

  useEffect(() => {
    const syncUser = () => setCurrentUser(readStoredUser());
    syncUser();
    window.addEventListener("storage", syncUser);
    window.addEventListener("baico-auth-change", syncUser);

    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("baico-auth-change", syncUser);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-line bg-white p-2 shadow-panel lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" className="h-8" onClick={() => window.location.reload()}>
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          {dictionary.common.refresh}
        </Button>
        {canUseMoreActions ? (
          <div ref={menuRef} className="relative">
            <Button
              type="button"
              variant="secondary"
              className="h-8"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              <Ellipsis className="h-4 w-4" aria-hidden="true" />
              更多操作
            </Button>
            {open ? (
              <div
                role="menu"
                className="absolute left-0 top-10 z-40 w-40 rounded-lg border border-line bg-white p-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    window.print();
                  }}
                  className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {dictionary.common.export}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Filter className="h-4 w-4" aria-hidden="true" />
                  {dictionary.common.filter}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <label className="relative min-w-0 flex-1 lg:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          placeholder={dictionary.common.search}
          className="h-8 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm text-ink outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
        />
      </label>
    </section>
  );
}
