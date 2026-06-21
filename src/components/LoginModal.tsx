"use client";

import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound, X } from "lucide-react";
import { readStoredUser, storeLocalUser } from "@/lib/permissions";
import type { UserItem } from "@/types";

type RememberedAccount = {
  account: string;
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

function writeRememberedAccount(account: string) {
  if (typeof window === "undefined") return;

  const nextAccount = account.trim();
  if (!nextAccount) return;

  const existing = readRememberedAccounts().filter((item) => item.account !== nextAccount);
  const next: RememberedAccount = {
    account: nextAccount,
    updated_at: new Date().toISOString(),
  };

  window.localStorage.setItem(rememberedAccountsKey, JSON.stringify([next, ...existing].slice(0, 5)));
}

export function LoginModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [rememberAccount, setRememberAccount] = useState(true);
  const [rememberedAccounts, setRememberedAccounts] = useState<RememberedAccount[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    if (!open) return;

    const remembered = readRememberedAccounts();
    const storedUser = readStoredUser();
    setRememberedAccounts(remembered);
    setLoginError("");

    if (remembered[0]) {
      setAccount(remembered[0].account);
    } else if (storedUser) {
      setAccount(storedUser.email || storedUser.display_name || "");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const selectedRememberedAccount = useMemo(
    () => rememberedAccounts.find((item) => item.account === account),
    [account, rememberedAccounts],
  );

  const canLogin = Boolean(account.trim() && password.trim() && !isSubmitting);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canLogin) return;

    setIsSubmitting(true);
    setLoginError("");

    try {
      const normalizedAccount = account.trim();
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          account: normalizedAccount,
          username: normalizedAccount,
          display_name: normalizedAccount,
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
      if (rememberAccount) writeRememberedAccount(normalizedAccount);
      router.push(payload.redirect_to ?? "/dashboard");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "账号或密码不正确。");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOverlayClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  function selectRememberedAccount(value: string) {
    setAccount(value);
    setPassword("");
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm"
      onMouseDown={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="内部运营系统登录"
    >
      <form
        onSubmit={(event) => void handleLogin(event)}
        className="w-full max-w-[420px] rounded-lg border border-line bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-forest">
              Brazil AI Commerce OS
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-ink">内部运营系统登录</h1>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-slate-500 hover:bg-slate-50"
            aria-label="关闭登录窗口"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {rememberedAccounts.length > 0 ? (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">最近登录账号</span>
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

          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={rememberAccount}
              onChange={(event) => setRememberAccount(event.target.checked)}
              className="h-4 w-4 accent-teal-700"
            />
            记住账号
          </label>

          {loginError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {loginError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canLogin}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-forest px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? "登录中" : "注册/登录"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}
