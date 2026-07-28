import axios from "axios";
import { NotificationsConfig } from "./config.js";
import { SyncResult } from "./sync.js";
import { log } from "./logger.js";

export async function sendWebhookNotification(
  cfg: NotificationsConfig,
  result: SyncResult,
  mode: string,
): Promise<void> {
  if (!cfg.enabled || !cfg.webhook_url) return;
  if (result.success && !cfg.on_success) return;
  if (!result.success && !cfg.on_error) return;

  const emoji = result.success ? "✅" : "❌";
  const status = result.success ? "SUCCESS" : "FAILED";
  const duration = (result.durationMs / 1000).toFixed(1);

  const text =
    `${emoji} **Sunrise HR Sync - ${status}**\n` +
    `Mode: \`${mode}\`\n` +
    `Total: ${result.total} | Created: ${result.created} | Updated: ${result.updated} | Skipped: ${result.skipped}\n` +
    `Duration: ${duration}s\n` +
    (result.errors.length > 0
      ? `\nErrors:\n${result.errors
          .slice(0, 5)
          .map((e) => `• ${e}`)
          .join("\n")}`
      : "");

  try {
    await axios.post(cfg.webhook_url, { text }, { timeout: 10000 });
    log.debug("[Notify] Webhook notification sent.");
  } catch (err: any) {
    log.warn(`[Notify] Failed to send webhook notification: ${err.message}`);
  }
}
