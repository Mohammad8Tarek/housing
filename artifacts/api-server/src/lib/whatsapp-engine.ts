// Split into ./whatsapp/; this barrel keeps existing import paths working.
export {
  DEFAULT_WELCOME_AR,
  DEFAULT_WELCOME_EN,
  DEFAULT_RESERVATION_AR,
  DEFAULT_RESERVATION_EN,
  resolveSpintax,
  injectAntiBanFingerprint,
  normalizePhoneNumber,
  compileWhatsAppTemplate,
  isArabicProfile,
} from "./whatsapp/templates.js";
export {
  LIMITS,
  getQuotaStatus,
  checkSendQuota,
  isQuietHoursNow,
} from "./whatsapp/quota.js";
export {
  isOptedOut,
  recordOptOut,
  removeOptOut,
  getOptOutCount,
} from "./whatsapp/opt-out.js";
export {
  getWhatsAppSession,
  connectPropertyWhatsApp,
  disconnectPropertyWhatsApp,
  startKeepAliveHeartbeat,
  autoRestoreAllWhatsAppSessions,
} from "./whatsapp/session.js";
export {
  processOutboxQueue,
  getPendingQueueCount,
  sendMetaCloudMessage,
  executeSendHumanLike,
  sendWhatsAppMessageSafe,
} from "./whatsapp/send.js";
export {
  sendCheckInWhatsAppNotification,
  sendWelcomeWhatsAppForAssignment,
  sendReservationConfirmationWhatsApp,
  sendWhatsAppBroadcast,
} from "./whatsapp/notifications.js";
export type { BroadcastRecipient } from "./whatsapp/notifications.js";
