import { Database, Globe2, Server, ShieldCheck } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { StandardPageHeader } from "@/components/PageHeader";
import { activeDataSource, futureDataSourceNotes } from "@/lib/dataSource";

function sourceLabel(source: string) {
  if (source === "postgresql" || source === "supabase") return "生产数据库";
  if (source === "sqlite") return "本地真实数据库";
  return "真实数据源未配置";
}

const settings = [
  {
    label: "数据口径",
    value: "真实数据",
    description: "运营页面不再展示测试样例；真实数据源不可用时显示空状态或连接提示。",
    icon: Database,
  },
  {
    label: "平台操作",
    value: "只读优先",
    description: "Shopee 等平台连接保持只读，不执行改价、上架、广告或补货动作。",
    icon: ShieldCheck,
  },
  {
    label: "运行环境",
    value: process.env.SYSTEM_MODE === "production" ? "生产模式" : "本地模式",
    description: "生产模式优先使用 PostgreSQL/Supabase；本地模式可读取本机真实数据库。",
    icon: Server,
  },
];

export default function SystemPage() {
  return (
    <div className="space-y-6">
      <StandardPageHeader
        title="系统设置"
        description="管理语言界面、真实数据源口径与生产运行约束。"
        meta={[
          { label: "数据来源", value: sourceLabel(activeDataSource) },
          { label: "测试数据", value: "已禁用" },
          { label: "运行模式", value: process.env.SYSTEM_MODE === "production" ? "生产模式" : "本地模式" },
        ]}
      />

      <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
        <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-forest">
              <Globe2 className="h-4 w-4" aria-hidden="true" />
              语言与界面
            </div>
            <h2 className="mt-2 text-lg font-semibold text-ink">界面语言设置</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              支持简体中文、Português (Brasil) 和 English。切换后菜单、页面标题、页面说明和通用操作会立即生效，并保存到当前浏览器。
            </p>
          </div>
          <LanguageSwitcher />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {settings.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-lg border border-line bg-white p-5 shadow-panel">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-500">{item.label}</div>
                  <div className="mt-2 text-xl font-semibold text-ink">{item.value}</div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-line bg-slate-50 text-forest">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
        <div className="flex items-start gap-3">
          <Database className="mt-1 h-5 w-5 text-forest" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold text-ink">真实数据源策略</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              当前系统默认禁用测试数据展示。页面和接口优先读取真实数据库或平台只读缓存；当连接不可用时，系统会保留页面可访问性，但不会用测试样例伪装成业务数据。
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
        <h2 className="text-lg font-semibold text-ink">后续数据接入预留</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {futureDataSourceNotes.map((note) => (
            <div key={note} className="rounded-md border border-line bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              {note}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
