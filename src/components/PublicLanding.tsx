"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Store, Workflow } from "lucide-react";
import { InteractiveCommerceVisual } from "@/components/InteractiveCommerceVisual";
import { LoginModal } from "@/components/LoginModal";
import { readStoredUser } from "@/lib/permissions";

export function PublicLanding() {
  const router = useRouter();
  const [loginOpen, setLoginOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserName, setCurrentUserName] = useState("");
  const [accessNotice, setAccessNotice] = useState("");

  useEffect(() => {
    const user = readStoredUser();
    const loggedIn = Boolean(user);

    setIsLoggedIn(loggedIn);
    setCurrentUserName(user?.display_name ?? user?.email ?? "");

    try {
      const notice = window.sessionStorage.getItem("baico_access_notice");
      if (notice) {
        setAccessNotice(notice);
        window.sessionStorage.removeItem("baico_access_notice");
      }
    } catch {
      // Session storage is optional; the landing page still works without it.
    }
  }, []);

  function handleOpenOperations() {
    if (isLoggedIn) {
      router.push("/dashboard");
      return;
    }
    setLoginOpen(true);
  }

  const entryLabel = isLoggedIn ? "进入系统" : "注册/登录";

  return (
    <main className="min-h-screen bg-[#052f2c]">
      <InteractiveCommerceVisual>
        <div className="flex min-h-screen flex-col justify-between">
          <header className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-100">
                Brazil AI Commerce OS
              </div>
              <div className="mt-1 text-xs text-teal-50/70">跨平台电商 AI 运营系统</div>
            </div>
            <button
              type="button"
              onClick={handleOpenOperations}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-[#064e49] shadow-sm hover:bg-teal-50"
            >
              {entryLabel}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
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
            {accessNotice ? (
              <div className="mt-4 inline-flex rounded-md border border-amber-200/40 bg-amber-100/12 px-3 py-2 text-sm font-medium text-amber-50">
                {accessNotice}
              </div>
            ) : null}
            {isLoggedIn && currentUserName ? (
              <p className="mt-4 text-sm font-medium text-emerald-100">当前已登录：{currentUserName}</p>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleOpenOperations}
                className="inline-flex h-11 items-center gap-2 rounded-md bg-[#14b8a6] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#0f766e]"
              >
                {entryLabel}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handleOpenOperations}
                className="inline-flex h-11 items-center rounded-md border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/15"
              >
                查看运营入口
              </button>
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

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </main>
  );
}
