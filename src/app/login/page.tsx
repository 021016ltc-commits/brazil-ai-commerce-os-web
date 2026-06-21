"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, LogIn, ShieldCheck, UserRound, X } from "lucide-react";
import { readStoredUser, storeLocalUser } from "@/lib/permissions";
import type { UserItem } from "@/types";

type RememberedAccount = {
  account: string;
  password?: string;
  updated_at: string;
};

const rememberedAccountsKey = "baico_remembered_accounts";

function readRememberedAccounts(): RememberedAccount[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(rememberedAccountsKey);
    const parsed = raw ? (JSON.parse(raw) as RememberedAccount[]) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item.account) : [];
  } catch {
    return [];
  }
}

function writeRememberedAccount(account: string, password: string, rememberPassword: boolean) {
  if (typeof window === "undefined") return;

  const nextAccount = account.trim();
  if (!nextAccount) return;

  const existing = readRememberedAccounts().filter((item) => item.account !== nextAccount);
  const next: RememberedAccount = {
    account: nextAccount,
    password: rememberPassword ? password : undefined,
    updated_at: new Date().toISOString(),
  };

  window.localStorage.setItem(rememberedAccountsKey, JSON.stringify([next, ...existing].slice(0, 5)));
}

function LoginVisual() {
  const metrics = [
    { label: "今日销售", value: "R$ 128K" },
    { label: "库存健康", value: "86" },
    { label: "待处理", value: "12" },
  ];

  return (
    <section className="relative hidden min-h-screen overflow-hidden bg-[#052f2c] text-white lg:block">
      <div className="login-grid-motion absolute inset-0 opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(20,184,166,0.18),transparent_32%),linear-gradient(135deg,rgba(15,118,110,0.26),transparent_42%)]" />

      <div className="relative z-10 flex min-h-screen flex-col justify-between p-12">
        <div>
          <div className="inline-flex h-9 items-center rounded-md border border-white/20 bg-white/10 px-3 text-xs font-semibold tracking-[0.2em] text-teal-100">
            BRAZIL AI COMMERCE OS
          </div>
          <h1 className="mt-8 max-w-xl text-5xl font-semibold leading-tight tracking-tight">
            真实店铺数据驱动的内部运营系统
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-teal-50/80">
            统一查看店铺授权、订单、商品、库存和每日运营事项，让人工运营更快判断今天该先处理什么。
          </p>
        </div>

        <div className="relative h-[360px]">
          <div className="login-route login-route-a" />
          <div className="login-route login-route-b" />
          <div className="login-route login-route-c" />

          <div className="login-panel login-panel-primary">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-teal-50">店铺数据</span>
              <span className="rounded-md bg-emerald-400/15 px-2 py-1 text-xs text-emerald-100">只读保护</span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {metrics.map((item) => (
                <div key={item.label} className="rounded-md border border-white/10 bg-white/10 p-3">
                  <div className="text-xs text-teal-50/70">{item.label}</div>
                  <div className="mt-2 text-lg font-semibold">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="login-panel login-panel-secondary">
            <div className="text-sm font-semibold text-teal-50">今日必须处理</div>
            <div className="mt-4 space-y-3">
              {["库存风险 SKU-021", "利润异常 SKU-005", "待审批动作 8 项"].map((item, index) => (
                <div key={item} className="flex items-center justify-between rounded-md border border-white/10 bg-white/10 px-3 py-2">
                  <span className="text-sm text-teal-50/85">{item}</span>
                  <span className="text-xs text-teal-100">P{index + 1}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="login-panel login-panel-mini">
            <ShieldCheck className="h-5 w-5 text-emerald-200" aria-hidden="true" />
            <div>
              <div className="text-sm font-semibold">审批后执行</div>
              <div className="text-xs text-teal-50/70">不自动改价、不自动上架</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [isLoginOpen, setIsLoginOpen] = useState(true);
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [rememberAccount, setRememberAccount] = useState(true);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [rememberedAccounts, setRememberedAccounts] = useState<RememberedAccount[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    const remembered = readRememberedAccounts();
    const storedUser = readStoredUser();
    setRememberedAccounts(remembered);

    if (remembered[0]) {
      setAccount(remembered[0].account);
      setPassword(remembered[0].password ?? "");
      setRememberPassword(Boolean(remembered[0].password));
    } else if (storedUser) {
      setAccount(storedUser.email || storedUser.display_name || "");
    }
  }, []);

  const selectedRememberedAccount = useMemo(
    () => rememberedAccounts.find((item) => item.account === account),
    [account, rememberedAccounts],
  );

  const canLogin = Boolean(account.trim() && password.trim() && !isSubmitting);

  async function handleLogin() {
    if (!canLogin) return;
    setIsSubmitting(true);
    setLoginError("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: account.trim(),
          password,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { user?: UserItem; redirect_to?: string; error?: string }
        | null;

      if (!response.ok || !payload?.user) {
        throw new Error(payload?.error ?? "账号或密码不正确。");
      }

      storeLocalUser(payload.user);
      if (rememberAccount) {
        writeRememberedAccount(account, password, rememberPassword);
      }
      router.push(payload.redirect_to ?? "/dashboard");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "账号或密码不正确。");
    } finally {
      setIsSubmitting(false);
    }
  }

  function selectRememberedAccount(value: string) {
    const next = rememberedAccounts.find((item) => item.account === value);
    setAccount(value);
    setPassword(next?.password ?? "");
    setRememberPassword(Boolean(next?.password));
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50">
      <LoginVisual />

      <div className="absolute inset-0 lg:left-[58%]">
        <div className="flex min-h-screen flex-col justify-between px-5 py-5 sm:px-8">
          <header className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setIsLoginOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-semibold text-ink shadow-sm hover:bg-slate-50"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              注册/登录
            </button>
          </header>

          <section className="mx-auto w-full max-w-md rounded-lg border border-line bg-white/90 p-5 shadow-sm backdrop-blur lg:hidden">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-forest">Brazil AI Commerce OS</div>
            <h1 className="mt-3 text-3xl font-semibold text-ink">智采内部运营系统</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">点击右上角“注册/登录”进入系统。</p>
          </section>

          <footer className="hidden text-right text-xs text-slate-400 lg:block">
            真实店铺数据 · 人工审批 · 只读保护
          </footer>
        </div>
      </div>

      {isLoginOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/20 px-4 py-5 backdrop-blur-sm sm:px-6">
          <div className="ml-auto flex h-full max-w-[440px] items-start pt-16 sm:pt-20">
            <section className="w-full rounded-lg border border-line bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-forest">
                    Brazil AI Commerce OS
                  </div>
                  <h1 className="mt-2 text-2xl font-semibold text-ink">智采内部运营系统</h1>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLoginOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-slate-500 hover:bg-slate-50"
                  aria-label="关闭登录窗口"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {rememberedAccounts.length > 0 ? (
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">已记住账号</span>
                    <select
                      value={selectedRememberedAccount?.account ?? ""}
                      onChange={(event) => selectRememberedAccount(event.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-forest"
                    >
                      <option value="">选择本机账号</option>
                      {rememberedAccounts.map((item) => (
                        <option key={item.account} value={item.account}>
                          {item.account}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">账号</span>
                  <div className="mt-1 flex h-11 items-center gap-2 rounded-md border border-line bg-white px-3 focus-within:border-forest">
                    <UserRound className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    <input
                      className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
                      value={account}
                      onChange={(event) => setAccount(event.target.value)}
                      placeholder="请输入账号"
                      autoComplete="username"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">密码</span>
                  <div className="mt-1 flex h-11 items-center gap-2 rounded-md border border-line bg-white px-3 focus-within:border-forest">
                    <LockKeyhole className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    <input
                      className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="请输入密码"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void handleLogin();
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="inline-flex h-8 w-8 items-center justify-center text-slate-500 hover:text-ink"
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                </label>

                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={rememberAccount}
                      onChange={(event) => setRememberAccount(event.target.checked)}
                      className="h-4 w-4 accent-teal-700"
                    />
                    记住账号
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={rememberPassword}
                      disabled={!rememberAccount}
                      onChange={(event) => setRememberPassword(event.target.checked)}
                      className="h-4 w-4 accent-teal-700 disabled:opacity-40"
                    />
                    记住密码
                  </label>
                </div>

                {loginError ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {loginError}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => void handleLogin()}
                  disabled={!canLogin}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-forest px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isSubmitting ? "登录中" : "注册/登录"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </main>
  );
}
