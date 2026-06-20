import { statusLabel } from "@/lib/format";

export function StatusPill({
  status,
  tone,
}: {
  status: string;
  tone?: "good" | "warn" | "risk" | "neutral";
}) {
  const resolvedTone =
    tone ??
    (["success", "pass", "approved_local"].includes(status)
      ? "good"
      : ["warning", "partial_success", "pending_review", "deferred_local"].includes(status)
        ? "warn"
        : ["failed", "high", "rejected_local"].includes(status)
          ? "risk"
          : "neutral");

  const toneClass = {
    good: "border-emerald-200 bg-emerald-50 text-forest",
    warn: "border-amber-200 bg-amber-50 text-amber",
    risk: "border-rose-200 bg-rose-50 text-coral",
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
  }[resolvedTone];

  return (
    <span className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium ${toneClass}`}>
      {statusLabel(status)}
    </span>
  );
}
