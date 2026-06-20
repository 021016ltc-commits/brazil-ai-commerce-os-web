"use client";

import { Download, Ellipsis, EyeOff, Filter, RefreshCcw, Settings2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { readStoredUser } from "@/lib/permissions";
import type { UserItem } from "@/types";

type OperatorRole = "admin" | "manager" | "operator" | "viewer" | "finance" | "buyer";

function userRole(user: UserItem | null): OperatorRole {
  if (!user) return "viewer";
  if (user.roles.includes("admin")) return "admin";
  if (user.roles.includes("finance")) return "manager";
  if (user.roles.includes("buyer")) return "manager";
  if (user.roles.includes("operator")) return "operator";
  return "viewer";
}

export function dataStatusLabel(source: string | undefined | null) {
  if (source === "sqlite" || source === "postgresql" || source === "supabase" || source === "shopee_api") {
    return "数据正常";
  }
  if (source === "mock") return "测试数据";
  if (source === "fallback") return "备用数据";
  return "数据待确认";
}

export function CompactMetricCard({
  title,
  value,
  change,
  updatedAt,
  icon,
  tone = "neutral",
}: {
  title: string;
  value: string | number;
  change: string;
  updatedAt: string;
  icon: ReactNode;
  tone?: "good" | "warn" | "risk" | "neutral";
}) {
  const toneClass = {
    good: "border-emerald-200 bg-emerald-50 text-forest",
    warn: "border-amber-200 bg-amber-50 text-amber",
    risk: "border-rose-200 bg-rose-50 text-coral",
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
  }[tone];

  return (
    <article className="min-h-[104px] rounded-lg border border-line bg-white p-3 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-600">{title}</div>
          <div className="mt-1 truncate text-2xl font-semibold text-ink">{value}</div>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${toneClass}`}>
          {icon}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span className={tone === "risk" ? "font-medium text-coral" : tone === "good" ? "font-medium text-forest" : ""}>
          {change}
        </span>
        <span>更新：{updatedAt}</span>
      </div>
    </article>
  );
}

export function MoreActionsMenu({
  onRefresh,
  showAdminItems = false,
  children,
}: {
  onRefresh?: () => void;
  showAdminItems?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserItem | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const role = userRole(currentUser);
  const canExportOrFilter = role === "admin" || role === "manager";
  const canSeeAdminItems = role === "admin" && showAdminItems;

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
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
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

  if (role === "operator" || role === "viewer") return null;

  return (
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
        <div role="menu" className="absolute right-0 top-10 z-40 w-44 rounded-lg border border-line bg-white p-1 shadow-lg">
          {onRefresh ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onRefresh();
              }}
              className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              刷新
            </button>
          ) : null}
          {canExportOrFilter ? (
            <>
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
                导出
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <Filter className="h-4 w-4" aria-hidden="true" />
                筛选
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                列设置
              </button>
            </>
          ) : null}
          {canSeeAdminItems ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <EyeOff className="h-4 w-4" aria-hidden="true" />
              高级设置
            </button>
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function ColumnSettingsNote({ hiddenFields }: { hiddenFields: string[] }) {
  return (
    <details className="compact-details rounded-lg border border-line bg-white shadow-panel">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-ink">
        列设置
        <span className="text-xs font-medium text-slate-500">已隐藏 {hiddenFields.length} 个低频字段</span>
      </summary>
      <div className="border-t border-line p-3 text-sm leading-6 text-slate-600">
        默认隐藏：{hiddenFields.join("、")}。这些字段保留在数据中，后续可接入列设置面板打开。
      </div>
    </details>
  );
}
