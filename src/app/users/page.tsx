"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  KeyRound,
  ListChecks,
  Plus,
  Save,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { emptyOperationLogsResponse, emptyUsersResponse } from "@/data/emptyResponses";
import {
  readStoredUser,
  resourceLabels,
  roleLabels,
  userCanManageUsers,
  userHasPermission,
} from "@/lib/permissions";
import { logActionLabel, statusLabel } from "@/locales/zh-CN";
import type {
  OperationLogsApiResponse,
  PermissionItem,
  RoleItem,
  UserItem,
  UserRoleName,
  UsersApiResponse,
  UserStatus,
} from "@/types";

const fallbackUsers: UsersApiResponse = emptyUsersResponse;
const fallbackLogs: OperationLogsApiResponse = emptyOperationLogsResponse;

const roleOptions: UserRoleName[] = ["admin", "operator", "buyer", "finance", "viewer"];

function sourceLabel(source: "sqlite" | "mock") {
  return source === "sqlite" ? "真实数据" : "测试数据已禁用";
}

function permissionActionLabel(action: string) {
  const labels: Record<string, string> = {
    view: "查看",
    approve: "审批",
    manage: "管理",
  };
  return labels[action] ?? action;
}

function operationTargetLabel(targetType: string) {
  const labels: Record<string, string> = {
    users: "用户",
    action_queue: "执行审批池",
    approvals: "审批记录",
    system: "系统",
  };
  return labels[targetType] ?? targetType;
}

function statusTone(status: string) {
  if (["active", "success"].includes(status)) return "border-emerald-200 bg-emerald-50 text-forest";
  if (["disabled", "failed"].includes(status)) return "border-rose-200 bg-rose-50 text-coral";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function Badge({ value }: { value: string }) {
  return (
    <span className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium ${statusTone(value)}`}>
      {statusLabel(value)}
    </span>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
        {eyebrow}
      </div>
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-ink">{title}</h2>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-600">{label}</div>
          <div className="mt-2 text-3xl font-semibold text-ink">{value}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-forest">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">{detail}</p>
    </article>
  );
}

function permissionLabel(permission: PermissionItem) {
  return `${resourceLabels[permission.resource]} / ${permissionActionLabel(permission.action)}`;
}

function roleCan(role: RoleItem, permissionKey: string) {
  return role.permissions.some((permission) => permission.permission_key === permissionKey);
}

export default function UsersPage() {
  const [data, setData] = useState<UsersApiResponse>(fallbackUsers);
  const [logs, setLogs] = useState<OperationLogsApiResponse>(fallbackLogs);
  const [currentUser, setCurrentUser] = useState<UserItem | null>(null);
  const [newEmail, setNewEmail] = useState("new-user@local.br");
  const [newName, setNewName] = useState("本地新用户");
  const [newRole, setNewRole] = useState<UserRoleName>("viewer");
  const [editingUserId, setEditingUserId] = useState("");
  const [editingRole, setEditingRole] = useState<UserRoleName>("viewer");
  const [editingStatus, setEditingStatus] = useState<UserStatus>("active");
  const [isSaving, setIsSaving] = useState(false);

  const canManage = userCanManageUsers(currentUser);
  const canView = userHasPermission(currentUser, "users:view") || canManage;

  useEffect(() => {
    const syncUser = () => setCurrentUser(readStoredUser());
    syncUser();
    window.addEventListener("baico-auth-change", syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener("baico-auth-change", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([
      fetch("/api/users", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(),
      ),
      fetch("/api/operation-logs", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(),
      ),
    ])
      .then(([usersPayload, logsPayload]: [UsersApiResponse, OperationLogsApiResponse]) => {
        if (!active) return;
        setData(usersPayload);
        setLogs(logsPayload);
      })
      .catch(() => {
        if (!active) return;
        setData(fallbackUsers);
        setLogs(fallbackLogs);
      });

    return () => {
      active = false;
    };
  }, []);

  const activeUsers = data.users.filter((user) => user.status === "active").length;
  const selectedEditUser = useMemo(
    () => data.users.find((user) => user.user_id === editingUserId) ?? data.users[0],
    [data.users, editingUserId],
  );

  useEffect(() => {
    if (!selectedEditUser) return;
    setEditingUserId(selectedEditUser.user_id);
    setEditingRole(selectedEditUser.roles[0] ?? "viewer");
    setEditingStatus(selectedEditUser.status);
  }, [selectedEditUser]);

  async function refreshData() {
    const [usersPayload, logsPayload] = await Promise.all([
      fetch("/api/users", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/operation-logs", { cache: "no-store" }).then((response) => response.json()),
    ]);
    setData(usersPayload);
    setLogs(logsPayload);
  }

  async function createUser() {
    if (!canManage) return;
    setIsSaving(true);
    try {
      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          display_name: newName,
          roles: [newRole],
          status: "active",
          actor_user_id: currentUser?.user_id,
          actor_email: currentUser?.email,
        }),
      });
      await refreshData();
    } finally {
      setIsSaving(false);
    }
  }

  async function updateUser() {
    if (!canManage || !selectedEditUser) return;
    setIsSaving(true);
    try {
      await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedEditUser.user_id,
          display_name: selectedEditUser.display_name,
          roles: [editingRole],
          status: editingStatus,
          actor_user_id: currentUser?.user_id,
          actor_email: currentUser?.email,
        }),
      });
      await refreshData();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-10">
      <section className="rounded-lg border border-line bg-white p-5 shadow-panel sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-forest">
                用户管理 V1
              </span>
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                {sourceLabel(data.source)}
              </span>
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                本地用户体系
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                用户管理
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                管理本地用户、角色、权限和操作日志。当前版本不接第三方登录，
                权限用于本地系统入口、页面提示和管理按钮控制，不执行任何真实平台动作。
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <KpiCard
              label="用户数量"
              value={`${data.users.length}`}
              detail="本地系统内的用户账号。"
              icon={<Users className="h-5 w-5" aria-hidden="true" />}
            />
            <KpiCard
              label="当前权限"
              value={canManage ? "可管理" : canView ? "只读" : "无权限"}
              detail="由当前登录用户角色决定。"
              icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="启用用户" value={`${activeUsers}`} detail="当前启用状态用户。" icon={<UserCog className="h-5 w-5" aria-hidden="true" />} />
        <KpiCard label="角色数量" value={`${data.roles.length}`} detail="管理员、运营、采购、财务、只读。" icon={<KeyRound className="h-5 w-5" aria-hidden="true" />} />
        <KpiCard label="权限数量" value={`${data.permissions.length}`} detail="页面查看、用户管理、审批权限。" icon={<ListChecks className="h-5 w-5" aria-hidden="true" />} />
        <KpiCard label="operation_logs" value={`${logs.operation_logs.length}`} detail="登录、退出、审批、用户创建和修改。" icon={<Activity className="h-5 w-5" aria-hidden="true" />} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-line bg-white shadow-panel">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">用户列表</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">用户ID</th>
                  <th className="px-4 py-3">邮箱</th>
                  <th className="px-4 py-3">显示名称</th>
                  <th className="px-4 py-3">角色</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">最后登录</th>
                  <th className="px-4 py-3">权限数量</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <tr key={user.user_id} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-medium text-ink">{user.user_id}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">{user.display_name}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <span key={role} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
                            {roleLabels[role]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge value={user.status} />
                    </td>
                    <td className="px-4 py-3">{formatDateTime(user.last_login_at)}</td>
                    <td className="px-4 py-3 text-slate-500">{user.permissions.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
            <SectionHeader
              eyebrow="用户创建"
              title="新增本地用户"
              description="仅 admin 或拥有 users:manage 的角色可以创建用户。"
            />
            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-ink">邮箱</span>
                <input
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-forest"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">显示名称</span>
                <input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-forest"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">角色</span>
                <select
                  value={newRole}
                  onChange={(event) => setNewRole(event.target.value as UserRoleName)}
                  className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-forest"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!canManage || isSaving}
                onClick={createUser}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-forest px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                创建用户
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
            <SectionHeader
              eyebrow="角色管理"
              title="修改用户角色"
              description="本地修改只影响本系统权限，不会触发任何平台动作。"
            />
            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-ink">用户</span>
                <select
                  value={selectedEditUser?.user_id ?? ""}
                  onChange={(event) => setEditingUserId(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-forest"
                >
                  {data.users.map((user) => (
                    <option key={user.user_id} value={user.user_id}>
                      {user.display_name} / {user.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">角色</span>
                <select
                  value={editingRole}
                  onChange={(event) => setEditingRole(event.target.value as UserRoleName)}
                  className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-forest"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">状态</span>
                <select
                  value={editingStatus}
                  onChange={(event) => setEditingStatus(event.target.value as UserStatus)}
                  className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-forest"
                >
                  <option value="active">启用</option>
                  <option value="disabled">停用</option>
                </select>
              </label>
              <button
                type="button"
                disabled={!canManage || isSaving}
                onClick={updateUser}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-forest px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                保存修改
              </button>
            </div>
          </section>
        </section>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="权限管理"
          title="角色权限矩阵"
          description="admin 拥有全部权限；operator、buyer、finance 按业务职责授权；viewer 只读。"
        />
        <section className="rounded-lg border border-line bg-white shadow-panel">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">权限</th>
                  {data.roles.map((role) => (
                    <th key={role.role_id} className="px-4 py-3">
                      {roleLabels[role.role_name as UserRoleName] ?? role.role_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.permissions.map((permission) => (
                  <tr key={permission.permission_id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{permissionLabel(permission)}</div>
                      <div className="mt-1 text-xs text-slate-500">{permission.description}</div>
                    </td>
                    {data.roles.map((role) => (
                      <td key={`${permission.permission_id}_${role.role_id}`} className="px-4 py-3">
                        {roleCan(role, permission.permission_key) ? (
                          <span className="text-forest">允许</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="操作日志"
          title="登录、退出、审批、用户创建与修改"
          description="日志用于审计本地系统行为。当前日志不代表任何真实平台动作。"
        />
        <section className="rounded-lg border border-line bg-white shadow-panel">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">创建时间</th>
                  <th className="px-4 py-3">操作类型</th>
                  <th className="px-4 py-3">操作人</th>
                  <th className="px-4 py-3">对象</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">摘要</th>
                </tr>
              </thead>
              <tbody>
                {logs.operation_logs.map((log) => (
                  <tr key={log.log_id} className="border-t border-line align-top">
                    <td className="px-4 py-3">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-3 font-medium text-ink">{logActionLabel(log.action_type)}</td>
                    <td className="px-4 py-3">{log.actor_email}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {operationTargetLabel(log.target_type)} / {log.target_id}
                    </td>
                    <td className="px-4 py-3">
                      <Badge value={log.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{log.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  );
}
