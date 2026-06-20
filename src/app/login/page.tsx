"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, ShieldCheck } from "lucide-react";
import { emptyUsersResponse } from "@/data/emptyResponses";
import { resourceLabels, roleLabels, storeLocalUser } from "@/lib/permissions";
import type { UserItem, UsersApiResponse } from "@/types";

const fallbackUsers: UsersApiResponse = emptyUsersResponse;

function permissionLabel(permission: string) {
  const [resource, action] = permission.split(":");
  const actionLabels: Record<string, string> = {
    view: "查看",
    approve: "审批",
    manage: "管理",
  };
  return `${resourceLabels[resource as keyof typeof resourceLabels] ?? resource} / ${actionLabels[action] ?? action}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [data, setData] = useState<UsersApiResponse>(fallbackUsers);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError("");

    fetch("/api/users", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: UsersApiResponse) => {
        if (!active) return;
        setData(payload);
        setSelectedUserId("");
      })
      .catch(() => {
        if (!active) return;
        setData(fallbackUsers);
        setLoadError("用户列表加载失败，请检查初始化数据或联系管理员。");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const activeUsers = useMemo(
    () => data.users.filter((user) => user.status === "active"),
    [data.users],
  );
  const selectedUser = useMemo<UserItem | undefined>(
    () => activeUsers.find((user) => user.user_id === selectedUserId),
    [activeUsers, selectedUserId],
  );
  const internalAdminReady = activeUsers.some(
    (user) => user.display_name === "楼天城" && user.roles.includes("admin"),
  );
  const emptyMessage = !isLoading && activeUsers.length === 0
    ? "未找到可用用户，请联系管理员或检查初始化数据"
    : "";
  const canLogin = Boolean(selectedUser && password.trim() && !isLoading && !isSubmitting);

  async function handleLogin() {
    if (!canLogin || !selectedUser) return;
    setIsSubmitting(true);
    setLoginError("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedUser.user_id,
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
      router.push(payload.redirect_to ?? "/dashboard");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "账号或密码不正确。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-2xl rounded-lg border border-line bg-white p-6 shadow-panel">
        <div className="mb-6">
          <div className="text-sm font-semibold uppercase tracking-wide text-forest">
            Brazil AI Commerce OS
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-ink">本地用户登录</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            选择一个本地用户进入系统。当前版本不接第三方登录，不接微信、Google 或真实身份服务。
          </p>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="rounded-lg border border-line bg-slate-50 px-4 py-3 text-sm text-slate-600">
              正在加载可用用户...
            </div>
          ) : null}
          {internalAdminReady ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-forest">
              已准备内部管理员账号
            </div>
          ) : null}
          {loadError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {loadError}
            </div>
          ) : null}
          {emptyMessage ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {emptyMessage}
            </div>
          ) : null}
          {loginError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {loginError}
            </div>
          ) : null}

          <label className="block">
            <span className="text-sm font-medium text-slate-700">本地用户</span>
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              disabled={isLoading || activeUsers.length === 0}
              className="mt-1 h-11 w-full rounded-md border border-line bg-white px-3 outline-none focus:border-forest"
            >
              <option value="">请选择用户</option>
              {activeUsers.map((user) => (
                <option key={user.user_id} value={user.user_id}>
                  {user.display_name} / {user.email} / {user.roles.map((role) => roleLabels[role]).join("、")}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">登录密码</span>
            <input
              className="mt-1 h-11 w-full rounded-md border border-line px-3 outline-none focus:border-forest"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入密码"
              type="password"
              autoComplete="current-password"
            />
          </label>

          {selectedUser ? (
            <div className="rounded-lg border border-line bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 h-5 w-5 text-forest" aria-hidden="true" />
                <div>
                  <div className="text-sm font-semibold text-ink">{selectedUser.display_name}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    角色：{selectedUser.roles.map((role) => roleLabels[role]).join(" / ")}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedUser.permissions.slice(0, 10).map((permission) => (
                      <span
                        key={permission}
                        className="inline-flex h-7 items-center rounded-md border border-line bg-white px-2 text-xs text-slate-600"
                      >
                        {permissionLabel(permission)}
                      </span>
                    ))}
                    {selectedUser.permissions.length > 10 ? (
                      <span className="inline-flex h-7 items-center rounded-md border border-line bg-white px-2 text-xs text-slate-600">
                        +{selectedUser.permissions.length - 10}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleLogin()}
            disabled={!canLogin}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-forest px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            {isSubmitting ? "登录中" : "进入运营总览"}
          </button>
        </div>
      </section>
    </div>
  );
}
