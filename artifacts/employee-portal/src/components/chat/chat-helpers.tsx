/* Pure helpers for the resident chat: time formatting, notifications, previews. */
import { Camera, Mic, FileText, MapPin, Phone } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

/* ─── Helpers ────────────────────────────────────────────────────── */
export function formatTime(dateStr: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

export function formatDate(dateStr: string, isRtl: boolean) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return isRtl ? "الآن" : "now";
  if (m < 60) return `${m}${isRtl ? " د" : "m"}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}${isRtl ? " س" : "h"}`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}${isRtl ? " ي" : "d"}`;
  return new Date(dateStr).toLocaleDateString(isRtl ? "ar-EG" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatLastSeen(
  dateStr: string | undefined,
  isRtl: boolean,
): string {
  if (!dateStr) return isRtl ? "غير متصل" : "offline";
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return isRtl ? "غير متصل" : "offline";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);

    if (diffMins < 1) {
      return isRtl ? "آخر ظهور الآن" : "last seen just now";
    }
    if (diffMins < 60) {
      return isRtl
        ? `آخر ظهور منذ ${diffMins} د`
        : `last seen ${diffMins}m ago`;
    }

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const timeStr = date.toLocaleTimeString(isRtl ? "ar-EG" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    if (isToday) {
      return isRtl
        ? `آخر ظهور اليوم في ${timeStr}`
        : `last seen today at ${timeStr}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return isRtl
        ? `آخر ظهور أمس في ${timeStr}`
        : `last seen yesterday at ${timeStr}`;
    }

    const dateFormatted = date.toLocaleDateString(isRtl ? "ar-EG" : "en-US", {
      month: "numeric",
      day: "numeric",
    });
    return isRtl
      ? `آخر ظهور ${dateFormatted} في ${timeStr}`
      : `last seen ${dateFormatted} at ${timeStr}`;
  } catch {
    return isRtl ? "غير متصل" : "offline";
  }
}

/* ─── Notification helper ────────────────────────────────────────── */
export function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// Reusable audio context for notification sound
let _notifAudioCtx: AudioContext | null = null;
export function playNotificationSound() {
  try {
    if (!_notifAudioCtx) {
      _notifAudioCtx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
    }
    const ctx = _notifAudioCtx;
    // Play a pleasant two-tone chime
    const now = ctx.currentTime;

    // First tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.frequency.value = 830; // High note
    osc1.type = "sine";
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Second tone (slightly delayed)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.frequency.value = 1100; // Higher note
    osc2.type = "sine";
    gain2.gain.setValueAtTime(0.2, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.4);
  } catch {
    /* AudioContext not available */
  }
}

let _channelCreated = false;
export async function ensureNotificationChannel() {
  if (_channelCreated || !Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: "chat_messages",
      name: "Chat Messages",
      description: "Notifications for new chat messages",
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: "default",
    });
    _channelCreated = true;
  } catch {}
}

export async function showNotification(
  title: string,
  body: string,
  icon?: string,
) {
  // Always play sound and vibrate (works on mobile)
  playNotificationSound();
  if ("vibrate" in navigator) {
    navigator.vibrate([100, 50, 100]);
  }

  // Native Android: use Capacitor LocalNotifications with channel
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureNotificationChannel();
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== "granted") return;
      }
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 100000),
            title,
            body,
            channelId: "chat_messages",
            iconColor: "#18B0BB",
          },
        ],
      });
    } catch {
      /* LocalNotifications error */
    }
    return;
  }

  // Web: browser Notification API
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, {
        body,
        icon: icon || "/icons/icon-192x192.png",
        tag: "chat-message",
      });
    } catch {
      /* ignore */
    }
  }
}

/* ─── Message Preview Helpers ───────────────────────────────────── */
export function getNotificationMessagePreview(
  content: string,
  contentType?: string,
  isRtl: boolean = true,
): string {
  if (!content) return isRtl ? "رسالة جديدة" : "New message";
  if (
    contentType === "image" ||
    content.startsWith("data:image/") ||
    (content.startsWith("http") &&
      /\.(jpeg|jpg|gif|png|webp)/i.test(content)) ||
    (/^\/9j\/|^iVBORw0KGgo|^R0lGOD|^UklGR/.test(content) &&
      content.length > 50) ||
    content === "📷 صورة" ||
    content === "📷 Photo"
  ) {
    return isRtl ? "📷 صورة" : "📷 Photo";
  }
  if (contentType === "audio" || content.startsWith("[AUDIO]:")) {
    return isRtl ? "🎤 رسالة صوتية" : "🎤 Voice message";
  }
  if (contentType === "file" || content.startsWith("[FILE]:")) {
    const raw = content.replace("[FILE]:", "");
    const fileName = raw.split("|")[0] || "";
    return `📄 ${fileName || (isRtl ? "مستند" : "Document")}`;
  }
  if (contentType === "location" || content.startsWith("[LOCATION]:")) {
    return isRtl ? "📍 موقع جغرافي" : "📍 Location";
  }
  if (contentType === "call" || content.startsWith("[CALL]:")) {
    return isRtl ? "📞 مكالمة" : "📞 Call";
  }
  return content.slice(0, 80);
}

export function renderLastMessagePreview(
  lastMsg:
    | { content: string; contentType?: string; senderId?: number }
    | null
    | undefined,
  isRtl: boolean,
  isDark: boolean,
  hasUnread: boolean,
) {
  if (!lastMsg || !lastMsg.content) {
    return (
      <span className={hasUnread ? "font-semibold" : ""}>
        {isRtl ? "ابدأ المحادثة الآن" : "Start chatting"}
      </span>
    );
  }

  const content = lastMsg.content;
  const contentType = lastMsg.contentType;

  // 1. Photo / Image message
  if (
    contentType === "image" ||
    content.startsWith("data:image/") ||
    (content.startsWith("http") &&
      /\.(jpeg|jpg|gif|png|webp)/i.test(content)) ||
    (/^\/9j\/|^iVBORw0KGgo|^R0lGOD|^UklGR/.test(content) &&
      content.length > 50) ||
    content === "📷 صورة" ||
    content === "📷 Photo"
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 truncate">
        <Camera
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{
            color: hasUnread ? "#25d366" : isDark ? "#8696a0" : "#667781",
          }}
        />
        <span>{isRtl ? "صورة" : "Photo"}</span>
      </span>
    );
  }

  // 2. Audio / Voice Note
  if (contentType === "audio" || content.startsWith("[AUDIO]:")) {
    return (
      <span className="inline-flex items-center gap-1.5 truncate">
        <Mic
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{ color: hasUnread ? "#25d366" : "#00a884" }}
        />
        <span>{isRtl ? "رسالة صوتية" : "Voice message"}</span>
      </span>
    );
  }

  // 3. Document attachment
  if (contentType === "file" || content.startsWith("[FILE]:")) {
    const raw = content.replace("[FILE]:", "");
    const fileName = raw.split("|")[0] || "";
    return (
      <span className="inline-flex items-center gap-1.5 truncate">
        <FileText
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{ color: hasUnread ? "#25d366" : "#3b82f6" }}
        />
        <span className="truncate">
          {fileName || (isRtl ? "مستند" : "Document")}
        </span>
      </span>
    );
  }

  // 4. Location
  if (contentType === "location" || content.startsWith("[LOCATION]:")) {
    return (
      <span className="inline-flex items-center gap-1.5 truncate">
        <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />
        <span>{isRtl ? "موقع جغرافي" : "Location"}</span>
      </span>
    );
  }

  // 5. Call
  if (contentType === "call" || content.startsWith("[CALL]:")) {
    return (
      <span className="inline-flex items-center gap-1.5 truncate">
        <Phone className="w-3.5 h-3.5 flex-shrink-0 text-teal-500" />
        <span>{isRtl ? "مكالمة" : "Call"}</span>
      </span>
    );
  }

  // 6. Regular text
  return <span className="truncate">{content}</span>;
}

/* ─── Double / Single tick SVG ──────────────────────────────────── */
export function TickIcon({ read, color }: { read: boolean; color: string }) {
  return (
    <svg
      width="18"
      height="11"
      viewBox="0 0 18 11"
      fill="none"
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      {read ? (
        // Double tick (blue when read)
        <>
          <path
            d="M1 5.5L4.5 9L10 2"
            stroke={color}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6 5.5L9.5 9L15 2"
            stroke={color}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        // Single tick (sent)
        <path
          d="M1 5.5L4.5 9L10 2"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
      )}
    </svg>
  );
}
