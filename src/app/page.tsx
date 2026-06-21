import Link from "next/link";
import { ArrowRight, ShieldCheck, Store, Workflow } from "lucide-react";
import { InteractiveCommerceVisual } from "@/components/InteractiveCommerceVisual";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#052f2c]">
      <InteractiveCommerceVisual>
        <div className="flex min-h-screen flex-col justify-between">
          <header className="flex items-center justify-between gap-4">
            <div className="inline-flex h-9 items-center rounded-md border border-white/20 bg-white/10 px-3 text-xs font-semibold tracking-[0.2em] text-teal-100">
              BRAZIL AI COMMERCE OS
            </div>
            <Link
              href="/login"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-[#064e49] shadow-sm hover:bg-teal-50"
            >
              进入系统
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </header>

          <section className="max-w-4xl py-16">
            <div className="inline-flex h-8 items-center rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 text-xs font-semibold text-emerald-100">
              店铺授权 · 真实数据 · 人工审批
            </div>
            <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-tight tracking-tight text-white sm:text-6xl">
              面向巴西电商运营的内部指挥系统
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-teal-50/78">
              从店铺授权开始读取真实订单、商品和库存，再沉淀为任务、审批、库存、利润和运营复盘，让团队每天先处理最重要的事项。
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex h-11 items-center gap-2 rounded-md bg-[#14b8a6] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#0f766e]"
              >
                注册/登录
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-11 items-center rounded-md border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/15"
              >
                查看运营入口
              </Link>
            </div>
          </section>

          <section className="grid gap-3 pb-3 md:grid-cols-3">
            {[
              { icon: Store, title: "真实店铺数据", text: "按平台和店铺授权读取数据。" },
              { icon: Workflow, title: "每日任务中心", text: "把机会、风险和审批汇总成任务。" },
              { icon: ShieldCheck, title: "只读与审批保护", text: "建议不自动执行，关键动作先审批。" },
            ].map((item) => (
              <article key={item.title} className="rounded-lg border border-white/12 bg-white/10 p-4 backdrop-blur">
                <item.icon className="h-5 w-5 text-emerald-200" aria-hidden="true" />
                <h2 className="mt-3 text-base font-semibold text-white">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-teal-50/70">{item.text}</p>
              </article>
            ))}
          </section>
        </div>
      </InteractiveCommerceVisual>
    </main>
  );
}
