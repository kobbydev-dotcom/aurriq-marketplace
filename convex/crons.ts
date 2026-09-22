import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily("marketplace subscription maintenance", { hourUTC: 7, minuteUTC: 0 }, (internal as any).payments.runMarketplaceSubscriptionMaintenance);
crons.daily("seller retention sms reminders", { hourUTC: 8, minuteUTC: 0 }, (internal as any).retention.runRetentionReminders);

export default crons;
