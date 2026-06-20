import {
  getSchedulerStatus,
  initScheduler,
  startProductionScheduler,
} from "@/lib/runtime/systemBootstrap";
import { shouldStartScheduler } from "@/lib/runtime/config";

export async function ensureAutonomousScheduler(reason = "autonomousScheduler") {
  if (!shouldStartScheduler()) return getSchedulerStatus();
  const status = getSchedulerStatus();
  if (status.cron_active) return status;
  return initScheduler(reason);
}

export async function recoverAutonomousScheduler(reason = "server_restart_recovery") {
  if (!shouldStartScheduler()) return getSchedulerStatus();
  const status = getSchedulerStatus();
  if (!status.cron_active || status.last_error) {
    return startProductionScheduler(reason);
  }
  return status;
}

export function getAutonomousSchedulerStatus() {
  return getSchedulerStatus();
}
