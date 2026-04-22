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
    const [{ getGlobalSettings }, { runBackup }, { registerAutomationScheduler }] = await Promise.all([
      import("@/lib/services/agent2-global-settings.service"),
      import("@/lib/services/backup.service"),
      import("@/lib/services/automation-scheduler.service"),
    ]);

    console.log("[backup] Registering backup scheduler...");
    console.log("[automation] Registering automation scheduler...");
    registerAutomationScheduler();

    // Check every hour if backup is due
    cron.schedule("0 * * * *", async () => {
      try {
        const settings = await getGlobalSettings();
        if (!settings.success) return;

        const { backupConfig, lastBackupAt } = settings.data;
        if (!backupConfig.enabled) return;

        if (!isBackupDue(backupConfig.schedule, lastBackupAt)) return;

        console.log(`[backup] Running scheduled ${backupConfig.schedule} backup...`);
        const result = await runBackup();
        if (result.success) {
          console.log(`[backup] Backup completed: ${result.data.filename}`);
        } else {
          console.error(`[backup] Backup failed: ${result.error.message}`);
        }
      } catch (error) {
        console.error("[backup] Scheduler error:", error);
      }
    });
  }
}
