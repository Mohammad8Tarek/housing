// Split into ./whatsapp/; this barrel keeps existing import paths working.
export { DEFAULT_WELCOME_AR, DEFAULT_WELCOME_EN, DEFAULT_RESERVATION_AR, DEFAULT_RESERVATION_EN, resolveSpintax, injectAntiBanFingerprint, normalizePhoneNumber, compileWhatsAppTemplate, isArabicProfile } from "./whatsapp/templates.js";
export { SAFE_HOURLY_LIMIT, SAFE_DAILY_LIMIT, checkAndIncrementAntiBanQuota, isQuietHoursNow } from "./whatsapp/quota.js";
export { getWhatsAppSession, connectPropertyWhatsApp, disconnectPropertyWhatsApp, startKeepAliveHeartbeat, autoRestoreAllWhatsAppSessions } from "./whatsapp/session.js";
export { processOutboxQueue, getPendingQueueCount, sendMetaCloudMessage, executeSendHumanLike, sendWhatsAppMessageSafe } from "./whatsapp/send.js";
export { sendCheckInWhatsAppNotification, sendWelcomeWhatsAppForAssignment, sendReservationConfirmationWhatsApp, sendWhatsAppBroadcast } from "./whatsapp/notifications.js";
export type { BroadcastRecipient } from "./whatsapp/notifications.js";
