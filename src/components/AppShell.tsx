"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CalendarCheck,
  CircleHelp,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Command,
  HeartPulse,
  LineChart,
  ListTodo,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  ShoppingBag,
  UserCircle,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { HelpCenter } from "@/components/HelpCenter";
import { useLanguage } from "@/components/LanguageProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
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
    ],
  },
] as const;

const settingsGroups = [
  {
    label: "系统管理",
    items: [
      { href: "/users", key: "users", icon: Users },
      { href: "/tenants", key: "tenants", icon: Building2 },
      { href: "/system", key: "system", icon: Activity },
    ],
  },
  {
    label: "系统诊断",
    adminOnly: true,
    items: [
      { href: "/system-health", key: "systemHealth", icon: HeartPulse },
      { href: "/verification", key: "verification", icon: ClipboardCheck },
    ],
  },
  {
    label: "更多工具",
    adminOnly: true,
    items: [{ href: "/users#operation-logs", label: "操作日志", icon: ClipboardList }],
  },
] as const;

const publicPaths = new Set(["/", "/login"]);

function routePath(href: string) {
  return href.split("#")[0];
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { dictionary } = useLanguage();

  return (
    <nav className="space-y-5 px-3 py-4">
      {navGroups.filter((group) => group.items.length > 0).map((group) => (
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

function SettingsMenu({
  currentUser,
  onLogout,
}: {
  currentUser: UserItem | null;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const { dictionary } = useLanguage();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isAdmin = currentUser?.roles.includes("admin") ?? false;
  const visibleSettingsGroups = settingsGroups
    .map((group) => {
      if ("adminOnly" in group && group.adminOnly && !isAdmin) return null;

      const items = group.items.filter((item) => {
        if (!currentUser) return false;
        if (isAdmin) return true;
        return userCanAccessPath(currentUser, routePath(item.href));
      });

      return items.length > 0 ? { ...group, items } : null;
    })
    .filter((group): group is NonNullable<typeof group> => Boolean(group));

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
    <div ref={menuRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        className={`h-10 w-10 border px-0 ${open ? "border-teal-200 bg-teal-50 text-teal-800" : "border-line bg-white"}`}
        aria-label="打开设置菜单"
        title="设置"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Settings className="h-5 w-5" aria-hidden="true" />
      </Button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-lg border border-line bg-white py-2 shadow-lg"
        >
          {visibleSettingsGroups.map((group) => (
            <div key={group.label} className="border-b border-line py-2 last:border-b-0">
              <div className="px-4 pb-1 text-xs font-semibold text-indigo-700">{group.label}</div>
              <div className="space-y-1 px-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const itemPath = routePath(item.href);
                  const active = pathname === itemPath || pathname.startsWith(`${itemPath}/`);
                  const label = "label" in item ? item.label : dictionary.nav[item.key];

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className={`flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition ${
                        active ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-50 hover:text-ink"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="px-2 py-2">
            {currentUser ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>退出登录</span>
              </button>
            ) : (
              <Link
                href="/login"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>登录</span>
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { dictionary } = useLanguage();
  const [currentUser, setCurrentUser] = useState<UserItem | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const syncUser = () => {
      setCurrentUser(readStoredUser());
      setAuthReady(true);
    };
    syncUser();
    window.addEventListener("storage", syncUser);
    window.addEventListener("baico-auth-change", syncUser);

    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("baico-auth-change", syncUser);
    };
  }, []);

  useEffect(() => {
    if (!authReady || currentUser || publicPaths.has(pathname)) return;
    try {
      window.sessionStorage.setItem("baico_access_notice", "请先登录后进入系统");
    } catch {
      // The redirect still works if session storage is unavailable.
    }
    router.replace("/");
  }, [authReady, currentUser, pathname, router]);

  const currentPageTitle = useMemo(
    () => dictionary.routes[pathname as keyof typeof dictionary.routes] ?? dictionary.app.name,
    [dictionary, pathname],
  );

  if (publicPaths.has(pathname)) {
    return <>{children}</>;
  }

  const canAccessCurrentPage = userCanAccessPath(currentUser, pathname);
  const handleLogout = () => {
    if (currentUser) {
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
    }

    clearLocalUser();
    router.push("/");
  };

  if (!authReady || !currentUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-mist px-4 text-sm text-slate-500">
        正在进入系统...
      </main>
    );
  }

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
              <QuickActions />
              <div className="hidden sm:block">
                <LanguageSwitcher compact />
              </div>
              <Button
                type="button"
                variant="ghost"
                className="hidden h-10 w-10 border border-line bg-white px-0 text-slate-600 sm:inline-flex"
                aria-label="通知"
                title="通知"
              >
                <Bell className="h-5 w-5" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-10 border border-line bg-white px-0 text-slate-600"
                aria-label="帮助"
                title="帮助"
                aria-haspopup="dialog"
                aria-expanded={helpOpen}
                onClick={() => setHelpOpen(true)}
              >
                <CircleHelp className="h-5 w-5" aria-hidden="true" />
              </Button>
              <SettingsMenu currentUser={currentUser} onLogout={handleLogout} />
              {currentUser ? (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-md border border-line bg-slate-50 text-slate-600"
                  title={`${currentUser.display_name} / ${currentUser.roles.map((role) => roleLabels[role]).join(" / ")}`}
                >
                  <UserCircle className="h-6 w-6" aria-hidden="true" />
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
            </div>
          </div>
        </header>

        <main className="baico-compact mx-auto w-full max-w-app px-4 py-4 sm:px-6">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 space-y-4">
              {!currentUser ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber">
                  当前未选择本地用户。请从 /login 选择角色后进入系统。
                </div>
              ) : !canAccessCurrentPage ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  当前角色没有“{currentPageTitle}”权限。演示环境保留页面可见，但管理操作会被限制。
                </div>
              ) : null}
              {children}
            </div>
          </div>
        </main>
      </div>
      <HelpCenter pathname={pathname} currentUser={currentUser} open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
