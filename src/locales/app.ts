import { enUS } from "@/locales/en-US";
import { ptBR } from "@/locales/pt-BR";
import { zhCN } from "@/locales/zh-CN";

export const zhApp = {
  app: {
    name: "Brazil AI Commerce OS",
    subtitle: "跨平台电商 AI 运营系统",
    version: "Lite V3",
  },
  nav: zhCN.nav,
  routes: zhCN.routes,
  pageDescriptions: {
    "/dashboard": "老板每天打开后 3 秒看懂利润、现金流、库存风险和今日优先事项。",
    "/command-center": "把运营总览、今日任务、每日运营、系统健康和验收状态整合成单入口控制台。",
    "/tenants": "管理本地工作空间、演示订阅层和团队使用情况。",
    "/daily-ops": "汇总今日目标、风险、机会和执行队列，所有动作仍需人工判断。",
    "/tasks": "把机会、利润、库存、审批和分析数据收敛成今天要处理的任务。",
    "/opportunities": "帮助运营快速判断今天优先看哪些品、哪些关键词和哪些风险。",
    "/analysis": "查看本地规则生成的机会、风险、市场和建议，不接真实 AI 模型。",
    "/profit": "查看利润状态、成本结构、利润风险和商品利润排行。",
    "/inventory": "查看库存状态、风险预警、周转效率与补货建议。",
    "/approvals": "人工批准、驳回或延后建议，所有关键动作先审批后处理。",
    "/actions": "管理本地模拟执行队列，不连接外部平台写操作。",
    "/shopee": "查看 Shopee 店铺只读订单、商品与库存缓存。",
    "/decision-feedback": "记录真实业务结果，用来复盘历史决策是否有效。",
    "/business-impact": "衡量动作和决策对利润、库存与 GMV 的真实贡献。",
    "/self-optimization": "基于历史结果生成规则优化建议，不自动修改生产规则。",
    "/verification": "检查模块、接口、入口和验收状态是否正常。",
    "/users": "管理本地用户、角色、权限和操作日志。",
    "/system": "配置语言与界面，查看数据源和本地系统状态。",
    "/system-health": "检查 API、数据一致性、数据源状态和系统健康评分。",
  },
  common: {
    export: "导出",
    refresh: "刷新",
    filter: "筛选",
    search: "搜索",
    dataSource: "数据来源",
    lastUpdated: "最后更新",
    sqliteSource: "Shopee + SQLite",
    mockSource: "备用数据",
    languageAndInterface: "语言与界面",
    chooseLanguage: "选择界面语言",
    savedLocally: "选择会保存到当前浏览器。",
  },
} as const;

export const dictionaries = {
  "zh-CN": zhApp,
  "pt-BR": ptBR,
  "en-US": enUS,
} as const;

export type LocaleCode = keyof typeof dictionaries;
export type AppDictionary = {
  app: {
    name: string;
    subtitle: string;
    version: string;
  };
  nav: Record<keyof typeof zhApp.nav, string>;
  routes: Record<keyof typeof zhApp.routes, string>;
  pageDescriptions: Record<keyof typeof zhApp.pageDescriptions, string>;
  common: Record<keyof typeof zhApp.common, string>;
};

export const localeOptions: Array<{ code: LocaleCode; label: string }> = [
  { code: "zh-CN", label: "简体中文" },
  { code: "pt-BR", label: "Português (Brasil)" },
  { code: "en-US", label: "English" },
];

export function isLocaleCode(value: string | null): value is LocaleCode {
  return value === "zh-CN" || value === "pt-BR" || value === "en-US";
}
