"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Boxes,
  Building2,
  CalendarCheck,
  CheckSquare,
  ClipboardCheck,
  Command,
  HeartPulse,
  LayoutDashboard,
  LineChart,
  ListTodo,
  LogIn,
  LogOut,
  Menu,
  RefreshCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  ShoppingBag,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PageHeader } from "@/components/PageHeader";
import { QuickActions } from "@/components/QuickActions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { clearLocalUser, readStoredUser, roleLabels, userCanAccessPath } from "@/lib/permissions";
import type { UserItem } from "@/types";

const navGroups = [
  {
    label: "运营",
    items: [
      { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
      { href: "/command-center", key: "commandCenter", icon: Command },
      { href: "/daily-ops", key: "dailyOps", icon: CalendarCheck },
      { href: "/tasks", key: "tasks", icon: ListTodo },
      { href: "/opportunities", key: "opportunities", icon: Search },
      { href: "/profit", key: "profit", icon: Wallet },
      { href: "/inventory", key: "inventory", icon: Boxes },
    ],
  },
  {
    label: "分析",
    items: [
      { href: "/analysis", key: "analysis", icon: BarChart3 },
      { href: "/decision-feedback", key: "decisionFeedback", icon: RefreshCcw },
      { href: "/business-impact", key: "businessImpact", icon: LineChart },
      { href: "/self-optimization", key: "selfOptimization", icon: SlidersHorizontal },
    ],
  },
  {
    label: "控制",
    items: [
      { href: "/approvals", key: "approvals", icon: CheckSquare },
      { href: "/actions", key: "actions", icon: ShieldCheck },
      { href: "/shopee", key: "shopee", icon: ShoppingBag },
      { href: "/verification", key: "verification", icon: ClipboardCheck },
    ],
  },
  {
    label: "系统",
    items: [
      { href: "/users", key: "users", icon: Users },
      { href: "/tenants", key: "tenants", icon: Building2 },
      { href: "/system-health", key: "systemHealth", icon: HeartPulse },
      { href: "/system", key: "system", icon: Activity },
    ],
  },
] as const;

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { dictionary } = useLanguage();

  return (
    <nav className="space-y-5 px-3 py-4">
      {navGroups.map((group) => (
        <div key={group.label} className="space-y-1">
          <div className="px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {group.label}
          </div>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const label = dictionary.nav[item.key];

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`flex h-9 items-center gap-3 rounded-md border px-3 text-sm font-medium transition ${
                  active
                    ? "border-teal-200 bg-teal-50 text-teal-800"
                    : "border-transparent text-slate-600 hover:border-line hover:bg-slate-50 hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { dictionary } = useLanguage();
  const [currentUser, setCurrentUser] = useState<UserItem | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const currentPageTitle = useMemo(
    () => dictionary.routes[pathname as keyof typeof dictionary.routes] ?? dictionary.app.name,
    [dictionary, pathname],
  );

  if (pathname === "/login") {
    return <main className="min-h-screen bg-mist">{children}</main>;
  }

  const canAccessCurrentPage = userCanAccessPath(currentUser, pathname);

  return (
    <div className="min-h-screen bg-mist text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-60 overflow-y-auto border-r border-line bg-white lg:block">
        <div className="border-b border-line px-4 py-5">
          <div className="text-sm font-semibold uppercase tracking-wide text-teal-700">
            {dictionary.app.name}
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-500">{dictionary.app.subtitle}</div>
          <div className="mt-3">
            <Badge tone="info">{dictionary.app.version} / BR</Badge>
          </div>
        </div>
        <SidebarNav />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 overflow-y-auto border-r border-line bg-white transition-transform lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-4">
          <div>
            <div className="text-sm font-semibold text-teal-700">{dictionary.app.name}</div>
            <div className="text-xs text-slate-500">{dictionary.app.version}</div>
          </div>
          <Button type="button" variant="ghost" className="h-9 w-9 px-0" onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <SidebarNav onNavigate={() => setMobileOpen(false)} />
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex min-h-16 max-w-app flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                className="h-10 w-10 px-0 lg:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
              </Button>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink">{currentPageTitle}</div>
                <div className="truncate text-xs text-slate-500">{dictionary.app.subtitle}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="hidden sm:block">
                <LanguageSwitcher compact />
              </div>
              {currentUser ? (
                <div className="rounded-md border border-line bg-white px-3 py-2 text-xs text-slate-600 shadow-panel">
                  <span className="font-semibold text-ink">{currentUser.display_name}</span>
                  <span className="ml-2">{currentUser.roles.map((role) => roleLabels[role]).join(" / ")}</span>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-ink shadow-panel hover:bg-slate-50"
                >
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  登录
                </Link>
              )}
              {currentUser ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void fetch("/api/operation-logs", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action_type: "logout",
                        actor_user_id: currentUser.user_id,
                        actor_email: currentUser.email,
                        target_type: "session",
                        target_id: "local_session",
                        summary: `${currentUser.display_name} 退出本地系统。`,
                      }),
                    }).catch(() => undefined);
                    clearLocalUser();
                    router.push("/login");
                  }}
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  退出
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-app px-4 py-6 sm:px-6">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 space-y-6">
              {!currentUser ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber">
                  当前未选择本地用户。请从 /login 选择角色后进入系统。
                </div>
              ) : !canAccessCurrentPage ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  当前角色没有“{currentPageTitle}”权限。演示环境保留页面可见，但管理操作会被限制。
                </div>
              ) : null}
              <PageHeader />
              <QuickActions />
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
