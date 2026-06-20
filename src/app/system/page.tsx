import { StatusPill } from "@/components/StatusPill";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { crawl_logs, data_quality_report } from "@/data/mock";
import { activeDataSource, futureDataSourceNotes } from "@/lib/dataSource";

function sourceLabel(source: string) {
  if (source === "mock") return "备用数据";
  if (source === "sqlite") return "本地数据库";
  return source;
}

function tableLabel(table: string) {
  const labels: Record<string, string> = {
    raw_products: "原始商品数据",
    products: "商品主数据",
    action_queue: "执行审批池",
  };
  return labels[table] ?? table;
}

function checkLabel(checkName: string) {
  const labels: Record<string, string> = {
    platform_product_id_present: "平台商品ID完整性",
    price_amount_valid: "价格字段有效性",
    human_approval_required: "人工审批必需",
  };
  return labels[checkName] ?? checkName;
}

export default function SystemPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
        <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-center">
          <div>
            <h2 className="text-lg font-semibold text-ink">语言与界面</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              支持简体中文、Português (Brasil) 和 English。切换后菜单、系统头部、页面说明和通用操作会立即生效，并保存到当前浏览器。
            </p>
          </div>
          <LanguageSwitcher />
        </div>
      </section>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">系统设置</h1>
          <p className="mt-1 text-sm text-slate-500">最近同步状态、crawl_logs 与 data_quality_report</p>
        </div>
        <span className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700">
          数据来源：{sourceLabel(activeDataSource)}
        </span>
      </div>

      <section className="rounded-lg border border-line bg-white shadow-panel">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">最近同步状态</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">同步批次</th>
                <th className="px-4 py-3">平台</th>
                <th className="px-4 py-3">市场</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">读取记录</th>
                <th className="px-4 py-3">新增记录</th>
                <th className="px-4 py-3">信息</th>
              </tr>
            </thead>
            <tbody>
              {crawl_logs.map((log) => (
                <tr key={log.crawl_run_id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium text-ink">{log.crawl_run_id}</td>
                  <td className="px-4 py-3 text-slate-700">{log.platform}</td>
                  <td className="px-4 py-3">{log.market_code}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={log.status} />
                  </td>
                  <td className="px-4 py-3">{log.records_seen}</td>
                  <td className="px-4 py-3">{log.records_inserted}</td>
                  <td className="px-4 py-3 text-slate-600">{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white shadow-panel">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">数据质量报告</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">报告ID</th>
                <th className="px-4 py-3">数据表</th>
                <th className="px-4 py-3">检查项</th>
                <th className="px-4 py-3">严重程度</th>
                <th className="px-4 py-3">质量状态</th>
                <th className="px-4 py-3">详情</th>
              </tr>
            </thead>
            <tbody>
              {data_quality_report.map((report) => (
                <tr key={report.report_id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium text-ink">{report.report_id}</td>
                  <td className="px-4 py-3">{tableLabel(report.source_table)}</td>
                  <td className="px-4 py-3 text-slate-700">{checkLabel(report.check_name)}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={report.severity} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={report.quality_status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{report.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
        <h2 className="text-sm font-semibold text-ink">未来数据接入预留</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {futureDataSourceNotes.map((note) => (
            <div key={note} className="rounded-md border border-line bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {note}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
