import cron from "node-cron";
import { getGlobalSettings } from "@/lib/services/agent2-global-settings.service";
import { runBackup, getCronExpression } from "@/lib/services/backup.service";

export async function register() {
  // Only run on server side, not during build
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[backup] Registering backup scheduler...");

    // Check every hour if backup is due
    cron.schedule("0 * * * *", async () => {
      try {
        const settings = await getGlobalSettings();
        if (!settings.success) return;

        const { backupConfig, lastBackupAt } = settings.data;
        if (!backupConfig.enabled) return;

        const cronExpr = getCronExpression(backupConfig.schedule);
        const now = new Date();

        // Check if current time matches the cron schedule
        const parts = cronExpr.split(" ");
        const minute = parseInt(parts[0]);
        const hour = parseInt(parts[1]);

        if (now.getMinutes() === minute && now.getHours() === hour) {
          // Check if already backed up today
          if (lastBackupAt) {
            const lastDate = new Date(lastBackupAt);
            const hoursSinceLastBackup = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
            if (hoursSinceLastBackup < 23) return; // Skip if backed up within 23 hours
          }

          console.log(`[backup] Running scheduled ${backupConfig.schedule} backup...`);
          const result = await runBackup();
          if (result.success) {
            console.log(`[backup] Backup completed: ${result.data.filename}`);
          } else {
            console.error(`[backup] Backup failed: ${result.error.message}`);
          }
        }
      } catch (error) {
        console.error("[backup] Scheduler error:", error);
      }
    });
  }
}
