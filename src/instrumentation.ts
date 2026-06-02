import cron from "node-cron";
import type { BackupConfig } from "@/types/agent2";

function isBackupDue(schedule: BackupConfig["schedule"], lastBackupAt: string | null): boolean {
  const now = new Date();

  // Check hour:minute match (all schedules run at 03:00)
  if (now.getHours() !== 3 || now.getMinutes() !== 0) return false;

  if (!lastBackupAt) return true;

  const last = new Date(lastBackupAt);

  switch (schedule) {
    case "daily":
      // Already backed up today
      return last.toDateString() !== now.toDateString();
    case "weekly":
      // Check if last backup was before this week's Sunday
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return last < startOfWeek;
    case "monthly":
      // Check if last backup was before this month's 1st
      return last.getMonth() !== now.getMonth() || last.getFullYear() !== now.getFullYear();
  }
}

export async function register() {
  // Only run on server side, not during build
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [{ registerAutomationScheduler }] = await Promise.all([
      import("@/lib/services/automation-scheduler.service"),
    ]);

    console.log("[automation] Registering automation scheduler...");
    registerAutomationScheduler();
  }
}
