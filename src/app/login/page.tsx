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

  useEffect(() => {
    let active = true;

    fetch("/api/users", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: UsersApiResponse) => {
        if (!active) return;
        setData(payload);
        setSelectedUserId(payload.users[0]?.user_id ?? "");
      })
      .catch(() => {
        if (active) setData(fallbackUsers);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedUser = useMemo<UserItem | undefined>(
    () => data.users.find((user) => user.user_id === selectedUserId) ?? data.users[0],
    [data.users, selectedUserId],
  );

  function handleLogin() {
    if (!selectedUser) return;

    const loggedInUser: UserItem = {
      ...selectedUser,
      last_login_at: new Date().toISOString(),
    };

    storeLocalUser(loggedInUser);

    void fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: loggedInUser.user_id,
        last_login_at: loggedInUser.last_login_at,
        actor_user_id: loggedInUser.user_id,
        actor_email: loggedInUser.email,
      }),
    }).catch(() => undefined);

    void fetch("/api/operation-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action_type: "login",
        actor_user_id: loggedInUser.user_id,
        actor_email: loggedInUser.email,
        target_type: "session",
        target_id: "local_session",
        summary: `${loggedInUser.display_name} 登录本地系统。`,
      }),
    }).catch(() => undefined);

    router.push("/dashboard");
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
          <label className="block">
            <span className="text-sm font-medium text-slate-700">本地用户</span>
            <select
              value={selectedUser?.user_id ?? selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              className="mt-1 h-11 w-full rounded-md border border-line bg-white px-3 outline-none focus:border-forest"
            >
              {data.users.map((user) => (
                <option key={user.user_id} value={user.user_id}>
                  {user.display_name} / {user.email} / {user.roles.map((role) => roleLabels[role]).join("、")}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">本地演示密码</span>
            <input
              className="mt-1 h-11 w-full rounded-md border border-line px-3 outline-none focus:border-forest"
              defaultValue="local-demo"
              type="password"
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
            onClick={handleLogin}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-forest px-4 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            进入运营总览
          </button>
        </div>
      </section>
    </div>
  );
}
