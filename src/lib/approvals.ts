import type {
  ActionQueueItem,
  AnalysisPriority,
  ApprovalHistoryItem,
  ApprovalQueueItem,
  ApprovalStats,
  Product,
  ReviewStatus,
} from "@/types";

export function approvalPriorityRank(priority: AnalysisPriority) {
  return { P1: 3, P2: 2, P3: 1 }[priority];
}

export function buildApprovalPriority(
  action: Pick<ActionQueueItem, "risk_level" | "confidence_score" | "action_type">,
): AnalysisPriority {
  if (action.risk_level === "high" || action.confidence_score >= 0.8) return "P1";
  if (action.risk_level === "medium" || action.action_type === "listing_review") return "P2";
  return "P3";
}

export function buildApprovalQueue(
  products: Product[],
  actions: ActionQueueItem[],
  history: ApprovalHistoryItem[] = [],
): ApprovalQueueItem[] {
  const latestHistoryByApproval = new Map<string, ApprovalHistoryItem>();

  [...history]
    .sort((left, right) => new Date(right.reviewed_at).getTime() - new Date(left.reviewed_at).getTime())
    .forEach((item) => {
      if (!latestHistoryByApproval.has(item.approval_id)) {
        latestHistoryByApproval.set(item.approval_id, item);
      }
    });

  return actions
    .map((action) => {
      const product = products.find((item) => item.product_uid === action.product_uid);
      const latestHistory = latestHistoryByApproval.get(action.action_id);

      return {
        approval_id: action.action_id,
        recommendation_type: action.action_type,
        product_uid: action.product_uid,
        platform: action.platform ?? product?.platform ?? "Shopee",
        priority: buildApprovalPriority(action),
        recommendation_summary: action.suggestion_text,
        created_at: action.created_at,
        status: action.status,
        risk_level: action.risk_level,
        confidence_score: action.confidence_score,
        reviewer: latestHistory?.reviewer ?? action.reviewer,
        reviewed_at: latestHistory?.reviewed_at ?? action.reviewed_at,
        notes: latestHistory?.notes,
      };
    })
    .sort((left, right) => {
      const pendingDelta = Number(right.status === "pending_review") - Number(left.status === "pending_review");
      if (pendingDelta !== 0) return pendingDelta;

      const priorityDelta = approvalPriorityRank(right.priority) - approvalPriorityRank(left.priority);
      if (priorityDelta !== 0) return priorityDelta;

      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
}

export function buildApprovalStats(queue: ApprovalQueueItem[]): ApprovalStats {
  return queue.reduce<ApprovalStats>(
    (stats, item) => {
      if (item.status === "pending_review") stats.pending_count += 1;
      if (item.status === "approved_local") stats.approved_count += 1;
      if (item.status === "rejected_local") stats.rejected_count += 1;
      if (item.status === "deferred_local") stats.deferred_count += 1;
      return stats;
    },
    {
      pending_count: 0,
      approved_count: 0,
      rejected_count: 0,
      deferred_count: 0,
    },
  );
}

export function buildApprovalHistoryItem(params: {
  approvalId: string;
  action: ReviewStatus;
  reviewer?: string;
  reviewedAt: string;
  notes?: string;
}): ApprovalHistoryItem {
  const timeKey = params.reviewedAt.replace(/[^0-9]/g, "").slice(0, 14);
  return {
    history_id: `hist_${params.approvalId}_${timeKey}`,
    approval_id: params.approvalId,
    action: params.action,
    reviewer: params.reviewer ?? "local_operator",
    reviewed_at: params.reviewedAt,
    notes: params.notes?.trim() || "无备注",
  };
}
