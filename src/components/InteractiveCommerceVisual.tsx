"use client";

import { useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

type InteractiveCommerceVisualProps = {
  className?: string;
  children?: ReactNode;
};

export function InteractiveCommerceVisual({ className = "", children }: InteractiveCommerceVisualProps) {
  const [spotlight, setSpotlight] = useState({ x: 58, y: 38 });

  function handleMouseMove(event: MouseEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setSpotlight({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  }

  const metrics = [
    { label: "今日销售", value: "R$ 128K" },
    { label: "库存健康", value: "86" },
    { label: "待处理", value: "12" },
  ];

  return (
    <section
      onMouseMove={handleMouseMove}
      className={`interactive-commerce-visual relative min-h-screen overflow-hidden bg-[#052f2c] text-white ${className}`}
      style={{
        "--spotlight-x": `${spotlight.x}%`,
        "--spotlight-y": `${spotlight.y}%`,
      } as CSSProperties}
    >
      <div className="login-grid-motion absolute inset-0 opacity-70" />
      <div className="commerce-orbit commerce-orbit-a" />
      <div className="commerce-orbit commerce-orbit-b" />
      <div className="commerce-cursor-glow" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(20,184,166,0.16),transparent_32%),linear-gradient(135deg,rgba(15,118,110,0.22),transparent_42%)]" />

      <div className="relative z-10 flex min-h-screen flex-col justify-between p-8 sm:p-10 lg:p-12">
        {children ? (
          children
        ) : (
          <>
            <div>
              <div className="inline-flex h-9 items-center rounded-md border border-white/20 bg-white/10 px-3 text-xs font-semibold tracking-[0.2em] text-teal-100">
                BRAZIL AI COMMERCE OS
              </div>
              <h1 className="mt-8 max-w-xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
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
          </>
        )}
      </div>
    </section>
  );
}
