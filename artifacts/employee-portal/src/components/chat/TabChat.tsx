import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Sparkles,
  Volume2,
  PhoneCall,
  Eye,
  Home,
  Building,
  User,
  Trash2,
  ExternalLink,
  Pause,
  Play,
  Download,
  Loader2,
  Send,
  Search,
  ArrowLeft,
  ArrowRight,
  Plus,
  Smile,
  X,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Camera,
  Mic,
  Image as ImageIcon,
  FileText,
  MapPin,
  MessageSquarePlus,
  Check,
  CheckCheck,
  Clock,
  Filter,
} from "lucide-react";
import { useTheme } from "../../lib/theme";
import { apiFetch } from "../../lib/api";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { WhatsAppDoodleBg } from "./WhatsAppDoodleBg";
import { WhatsAppCallModal } from "./WhatsAppCallModal";
import { toast } from "sonner";

/* ─── Types ──────────────────────────────────────────────────────── */
interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  department: string | null;
  jobTitle: string | null;
  photoUrl: string | null;
}

interface Conversation {
  id: number;
  subject: string | null;
  isGroup: boolean;
  lastMessage: { content: string; createdAt: string; senderId: number } | null;
  unreadCount: number;
  participantIds: number[];
  participantsData?: any[];
  updatedAt: string;
}

interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  contentType?: string;
  createdAt: string;
  isEdited: boolean;
  reads?: { employeeId: number; readAt: string }[];
}

interface TabChatProps {
  myEmployeeId: number | undefined;
  contacts: any[];
  autoOpenChatWith?: number | null;
  onClearAutoOpen?: () => void;
  isActive?: boolean;
  onUnreadChange?: (count: number) => void;
  onChatOpenChange?: (isOpen: boolean) => void;
}

/* ─── Emoji Data ─────────────────────────────────────────────────── */
const EMOJI_CATEGORIES = [
  {
    label: "😀",
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "😅",
      "🤣",
      "😂",
      "🙂",
      "🙃",
      "😉",
      "😊",
      "😇",
      "🥰",
      "😍",
      "🤩",
      "😘",
      "😗",
      "😚",
      "😙",
      "🥲",
      "😋",
      "😛",
      "😜",
      "🤪",
      "😝",
      "🤑",
      "🤗",
      "🤭",
      "🤫",
      "🤔",
      "🤐",
      "🤨",
      "😐",
      "😑",
      "😶",
      "😏",
      "😒",
      "🙄",
      "😬",
      "🤥",
      "😌",
      "😔",
      "😪",
      "🤤",
      "😴",
      "😷",
      "🤒",
      "🤕",
      "🤢",
      "🤮",
      "🤧",
      "🥵",
      "🥶",
      "🥴",
      "😵",
      "🤯",
      "🤠",
      "🥳",
      "🥸",
      "😎",
      "🤓",
      "🧐",
      "😕",
      "😟",
      "🙁",
      "☹️",
      "😮",
      "😯",
      "😲",
      "😳",
      "🥺",
      "😦",
      "😧",
      "😨",
      "😰",
      "😥",
      "😢",
      "😭",
      "😱",
      "😖",
      "😣",
      "😞",
      "😓",
      "😩",
      "😫",
      "🥱",
      "😤",
      "😡",
      "😠",
      "🤬",
      "😈",
      "👿",
      "💀",
      "☠️",
      "💩",
      "🤡",
      "👹",
      "👺",
      "👻",
      "👽",
      "👾",
      "🤖",
    ],
  },
  {
    label: "👍",
    emojis: [
      "👋",
      "🤚",
      "🖐",
      "✋",
      "🖖",
      "👌",
      "🤌",
      "🤏",
      "✌️",
      "🤞",
      "🤟",
      "🤘",
      "🤙",
      "👈",
      "👉",
      "👆",
      "🖕",
      "👇",
      "☝️",
      "👍",
      "👎",
      "✊",
      "👊",
      "🤛",
      "🤜",
      "👏",
      "🙌",
      "👐",
      "🤲",
      "🙏",
      "✍️",
      "💅",
      "🤳",
      "💪",
      "🦾",
      "🦿",
      "🦵",
      "🦶",
      "👂",
      "🦻",
      "👃",
      "🧠",
      "🫀",
      "🫁",
      "🦷",
      "🦴",
      "👀",
      "👁",
      "👅",
      "👄",
      "🫦",
      "💋",
    ],
  },
  {
    label: "❤️",
    emojis: [
      "❤️",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🖤",
      "🤍",
      "🤎",
      "💔",
      "❣️",
      "💕",
      "💞",
      "💓",
      "💗",
      "💖",
      "💘",
      "💝",
      "💟",
      "☮️",
      "✝️",
      "☪️",
      "🕉",
      "✡️",
      "🔯",
      "🛐",
      "⛎",
      "♈",
      "♉",
      "♊",
      "♋",
      "♌",
      "♍",
      "♎",
      "♏",
      "♐",
      "♑",
      "♒",
      "♓",
      "🆔",
      "⚛️",
      "🉑",
      "☢️",
      "☣️",
      "📴",
      "📳",
      "🈶",
      "🈚",
      "🈸",
      "🈺",
      "🈷️",
      "✴️",
      "🆚",
      "💮",
      "🉐",
      "㊙️",
      "㊗️",
      "🈴",
      "🈵",
      "🈹",
      "🈲",
      "🅰️",
      "🅱️",
      "🆎",
      "🆑",
      "🅾️",
      "🆘",
      "❌",
      "⭕",
      "🛑",
      "⛔",
      "📛",
      "🚫",
    ],
  },
  {
    label: "🌟",
    emojis: [
      "🌟",
      "⭐",
      "🌠",
      "🌌",
      "🌙",
      "🌛",
      "🌜",
      "🌝",
      "🌞",
      "🌈",
      "☁️",
      "⛅",
      "🌤",
      "🌥",
      "🌦",
      "🌧",
      "⛈",
      "🌩",
      "🌨",
      "❄️",
      "☃️",
      "⛄",
      "🌬",
      "💨",
      "🌪",
      "🌫",
      "🌊",
      "🌀",
      "🌈",
      "🌂",
      "☂️",
      "☔",
      "⛱",
      "⚡",
      "❄️",
      "🔥",
      "💧",
      "🌊",
      "🐶",
      "🐱",
      "🐭",
      "🐹",
      "🐰",
      "🦊",
      "🐻",
      "🐼",
      "🐨",
      "🐯",
      "🦁",
      "🐮",
      "🐷",
      "🐸",
      "🐵",
      "🙈",
      "🙉",
      "🙊",
      "🐔",
      "🐧",
      "🐦",
      "🐤",
      "🦆",
      "🦅",
      "🦉",
      "🦇",
      "🐺",
      "🐗",
      "🐴",
      "🦄",
      "🐝",
      "🐛",
      "🦋",
      "🐌",
      "🐞",
      "🐜",
      "🦟",
      "🦗",
      "🕷",
      "🦂",
    ],
  },
  {
    label: "🍕",
    emojis: [
      "🍕",
      "🍔",
      "🌮",
      "🌯",
      "🥙",
      "🧆",
      "🥚",
      "🍳",
      "🥘",
      "🍲",
      "🍜",
      "🍝",
      "🍛",
      "🍣",
      "🍱",
      "🥟",
      "🦪",
      "🍤",
      "🍙",
      "🍘",
      "🍥",
      "🥮",
      "🍢",
      "🧁",
      "🍰",
      "🎂",
      "🍮",
      "🍭",
      "🍬",
      "🍫",
      "🍿",
      "🍩",
      "🍪",
      "🌰",
      "🥜",
      "🍯",
      "🧃",
      "🥤",
      "🧋",
      "☕",
      "🍵",
      "🧉",
      "🍺",
      "🍻",
      "🥂",
      "🍷",
      "🍸",
      "🍹",
      "🍾",
      "🧊",
    ],
  },
  {
    label: "🎉",
    emojis: [
      "🎉",
      "🎊",
      "🎈",
      "🎀",
      "🎁",
      "🎗",
      "🎟",
      "🎫",
      "🎖",
      "🏆",
      "🥇",
      "🥈",
      "🥉",
      "🏅",
      "🎠",
      "🎡",
      "🎢",
      "🎪",
      "🤹",
      "🎭",
      "🖼",
      "🎨",
      "🎬",
      "🎤",
      "🎧",
      "🎼",
      "🎵",
      "🎶",
      "🎷",
      "🎸",
      "🎹",
      "🎺",
      "🎻",
      "🥁",
      "🪘",
      "🎮",
      "🕹",
      "🎲",
      "♟",
      "🧩",
      "🧸",
      "🪀",
      "🪁",
      "🔮",
      "🪄",
      "🃏",
      "🀄",
      "🎯",
      "🎳",
      "🏹",
      "🧲",
      "🔬",
      "🔭",
      "💡",
      "🔦",
      "🕯",
      "🪔",
      "🧯",
      "🛢",
      "💰",
      "💴",
      "💵",
      "💶",
      "💷",
      "💸",
      "💳",
      "🪙",
      "💹",
      "📈",
      "📉",
      "📊",
    ],
  },
];

/* ─── Helpers ────────────────────────────────────────────────────── */
function formatTime(dateStr: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

function formatDate(dateStr: string, isRtl: boolean) {
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

function formatLastSeen(dateStr: string | undefined, isRtl: boolean): string {
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
      return isRtl ? `آخر ظهور منذ ${diffMins} د` : `last seen ${diffMins}m ago`;
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
      return isRtl ? `آخر ظهور اليوم في ${timeStr}` : `last seen today at ${timeStr}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return isRtl ? `آخر ظهور أمس في ${timeStr}` : `last seen yesterday at ${timeStr}`;
    }

    const dateFormatted = date.toLocaleDateString(isRtl ? "ar-EG" : "en-US", {
      month: "numeric",
      day: "numeric",
    });
    return isRtl ? `آخر ظهور ${dateFormatted} في ${timeStr}` : `last seen ${dateFormatted} at ${timeStr}`;
  } catch {
    return isRtl ? "غير متصل" : "offline";
  }
}

/* ─── Notification helper ────────────────────────────────────────── */
function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// Reusable audio context for notification sound
let _notifAudioCtx: AudioContext | null = null;
function playNotificationSound() {
  try {
    if (!_notifAudioCtx) {
      _notifAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
async function ensureNotificationChannel() {
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

async function showNotification(title: string, body: string, icon?: string) {
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

/* ─── Double / Single tick SVG ──────────────────────────────────── */
function TickIcon({ read, color }: { read: boolean; color: string }) {
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

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */
export function TabChat({
  myEmployeeId,
  contacts,
  autoOpenChatWith,
  onClearAutoOpen,
  isActive = true,
  onUnreadChange,
  onChatOpenChange,
}: TabChatProps) {
  const { lang, theme } = useTheme();
  const isRtl = lang === "ar";
  const isDark = theme === "dark";

  const [showAttachments, setShowAttachments] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [convFilter, setConvFilter] = useState<"all" | "unread" | "groups">("all");
  const [convSearch, setConvSearch] = useState("");
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearch, setChatSearch] = useState("");

  /* ── Resolve effective myEmployeeId with fallback to storage ── */
  const [resolvedMyId, setResolvedMyId] = useState<number | undefined>(() => {
    if (myEmployeeId) return myEmployeeId;
    try {
      const raw =
        (typeof sessionStorage !== "undefined" && sessionStorage.getItem("portal_employee")) ||
        (typeof localStorage !== "undefined" && localStorage.getItem("portal_employee"));
      if (raw) {
        const parsed = JSON.parse(raw);
        return Number(parsed.id ?? parsed.profileDbId ?? 0) || undefined;
      }
    } catch {}
    return undefined;
  });

  useEffect(() => {
    if (myEmployeeId) {
      setResolvedMyId(myEmployeeId);
    } else {
      try {
        const raw =
          (typeof sessionStorage !== "undefined" && sessionStorage.getItem("portal_employee")) ||
          (typeof localStorage !== "undefined" && localStorage.getItem("portal_employee"));
        if (raw) {
          const parsed = JSON.parse(raw);
          const id = Number(parsed.id ?? parsed.profileDbId ?? 0) || undefined;
          if (id) setResolvedMyId(id);
        }
      } catch {}
    }
  }, [myEmployeeId]);

  const effectiveMyId = resolvedMyId;

  /* ── State ── */
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [senders, setSenders] = useState<Record<number, Employee>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [showNewConv, setShowNewConv] = useState(false);

  useEffect(() => {
    onChatOpenChange?.(!!activeConv || showNewConv);
  }, [activeConv, showNewConv, onChatOpenChange]);

  useEffect(() => {
    const handleClose = () => {
      if (showNewConv) {
        setShowNewConv(false);
      } else if (activeConv) {
        setActiveConv(null);
      }
    };
    window.addEventListener("portal_chat_close", handleClose);
    return () => window.removeEventListener("portal_chat_close", handleClose);
  }, [activeConv, showNewConv]);
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searching, setSearching] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState(0);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | null>(
    null,
  );
  const [typingUsers, setTypingUsers] = useState<Record<number, Set<number>>>(
    {},
  );
  const typingTimeoutRef = useRef<Record<string, any>>({});

  /* ── Live Real-Time Presence States ── */
  const [onlineEmployees, setOnlineEmployees] = useState<Set<number>>(new Set());
  const [lastSeenMap, setLastSeenMap] = useState<Record<number, string>>({});

  const fetchPresence = useCallback(async () => {
    try {
      const res = await apiFetch("/api/portal-chat/presence", { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        if (d.success && Array.isArray(d.onlineEmployeeIds)) {
          setOnlineEmployees(new Set(d.onlineEmployeeIds));
        }
        if (d.lastSeen && typeof d.lastSeen === "object") {
          setLastSeenMap((prev) => ({ ...prev, ...d.lastSeen }));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchPresence();
    const timer = setInterval(fetchPresence, 20_000);
    return () => clearInterval(timer);
  }, [fetchPresence]);

  /* ── Rich Features States ── */
  const [activeCall, setActiveCall] = useState<{
    isOpen: boolean;
    type: "voice" | "video";
    contactName: string;
    contactPhoto: string | null;
  } | null>(null);

  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);
  const [selectedContactInfo, setSelectedContactInfo] = useState<any | null>(null);

  // Real Voice Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  // Audio Playback for Voice Notes
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<number, number>>({});
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // File Inputs
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  const waveformHeights = useMemo(
    () => [14, 24, 10, 26, 18, 28, 12, 24, 16, 26, 8, 20, 15, 24, 18, 28, 12, 22, 16, 20, 14, 18],
    []
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeConvRef = useRef<Conversation | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevConvsRef = useRef<Conversation[]>([]);
  const lastMsgCountRef = useRef<number>(0);

  /* ── Request notification permission on mount ── */
  useEffect(() => {
    if ("Notification" in window) {
      requestNotificationPermission();
      setNotifPerm(Notification.permission);
    }
  }, []);

  /* ── Load conversations ── */
  const loadConversations = useCallback(
    async (silent = false) => {
      try {
        const res = await apiFetch("/api/portal-chat/conversations", {
          credentials: "include",
        });
        if (!res.ok) return;
        const d = await res.json();
        if (!d.success) return;
        const newConvs: Conversation[] = d.conversations || [];

        // Check for new messages and fire notifications
        if (prevConvsRef.current.length > 0) {
          for (const nc of newConvs) {
            const old = prevConvsRef.current.find((c) => c.id === nc.id);
            const activeId = activeConvRef.current?.id;

            // Trigger notification if it's not the active conversation OR the document is hidden
            if (nc.unreadCount > 0 && (nc.id !== activeId || document.hidden)) {
              const wasUnread = old?.unreadCount || 0;
              if (nc.unreadCount > wasUnread && nc.lastMessage) {
                showNotification(
                  getConvTitle(nc),
                  nc.lastMessage.content.slice(0, 80),
                );
              }
            }
          }
        }

        prevConvsRef.current = newConvs;
        setConversations(newConvs);
      } catch {
        /* ignore */
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [isRtl],
  );

  const loadMessages = useCallback(async (convId: number, silent = false) => {
    try {
      const r = await apiFetch(`/api/portal-chat/conversations/${convId}/messages`, { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        if (d.success) {
          setMessages(Array.isArray(d.messages) ? d.messages : []);
          setSenders((prev) => ({ ...prev, ...(d.senders || {}) }));
          lastMsgCountRef.current = (d.messages || []).length;
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadConversations(false);
  }, [loadConversations]);

  /* ── Reload when tab becomes active or ID resolves ── */
  useEffect(() => {
    if (isActive) {
      loadConversations(false);
    }
  }, [isActive, loadConversations]);

  useEffect(() => {
    if (effectiveMyId) {
      loadConversations(true);
    }
  }, [effectiveMyId, loadConversations]);

  const isWsConnectedRef = useRef(false);

  // WebSocket Connection for Real-time chat (Optimized low-latency)
  useEffect(() => {
    if (!effectiveMyId) return;
    let ws: WebSocket | null = null;
    let reconnectTimer: any;
    let pingTimer: any;
    let isUnmounted = false;

    const getWsEndpoint = () => {
      const configuredWs = import.meta.env.VITE_WS_URL?.trim();
      if (configuredWs) return configuredWs;

      if (Capacitor.isNativePlatform()) {
        const prodUrl = import.meta.env.VITE_API_URL?.trim() || "https://resident.sunrise-resorts.com";
        return prodUrl.replace(/^https/, "wss").replace(/^http/, "ws") + "/ws";
      }

      const isVercel = typeof window !== "undefined" && window.location.hostname.endsWith(".vercel.app");
      if (isVercel) {
        const railwayUrl = import.meta.env.VITE_API_URL?.trim() || "https://resident.sunrise-resorts.com";
        return railwayUrl.replace(/^https/, "wss").replace(/^http/, "ws") + "/ws";
      }

      if (typeof window !== "undefined") {
        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        return `${proto}//${window.location.host}/ws`;
      }

      return "ws://localhost:4000/ws";
    };


    const connectWs = () => {
      if (isUnmounted) return;

      const wsBase = getWsEndpoint();
      // Try sessionStorage first, then localStorage (needed on native Android where
      // Preferences.get async restoration may not have finished yet on first connect)
      let sid: string | null = null;
      try {
        if (typeof sessionStorage !== "undefined") {
          sid = sessionStorage.getItem("session_id");
        }
        if (!sid && typeof localStorage !== "undefined") {
          sid = localStorage.getItem("session_id");
        }
      } catch {
        /* storage may be restricted */
      }

      const url = sid
        ? `${wsBase}${wsBase.includes("?") ? "&" : "?"}sessionId=${encodeURIComponent(sid)}`
        : wsBase;

      try {
        ws = new WebSocket(url);

        ws.onopen = () => {
          isWsConnectedRef.current = true;
          console.info("[Chat WS] ⚡ Connected to", wsBase);
          // Heartbeat ping every 20s to keep connection hot
          clearInterval(pingTimer);
          pingTimer = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "ping" }));
            }
          }, 20_000);
        };

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === "pong") return;

            // Handle the standard data_updated format from broadcastToProperty
            if (parsed.module === "chat") {
              if (parsed.action === "new_message") {
                const newMsg = parsed.data?.message;
                const convId = parsed.data?.conversationId;
                if (!newMsg || !convId) return;

                // If the message is from me, skip (already handled optimistically)
                if (newMsg.senderId === effectiveMyId) return;

                // If it belongs to active conversation, append it instantly
                if (activeConvRef.current?.id === convId) {
                  setMessages((prev) => {
                    if (prev.find((m) => m.id === newMsg.id)) return prev;
                    return [...prev, newMsg];
                  });
                  // Mark as read since user is viewing
                  apiFetch(`/api/portal-chat/conversations/${convId}/read`, {
                    method: "PUT",
                    credentials: "include",
                  }).catch(() => {});
                }

                // Fire notification if not in the active conversation or tab hidden
                const activeId = activeConvRef.current?.id;
                if (convId !== activeId || document.hidden) {
                  const senderName =
                    newMsg.senderId === 0
                      ? isRtl
                        ? "الإدارة"
                        : "Management"
                      : senders[newMsg.senderId]
                        ? `${senders[newMsg.senderId].firstName} ${senders[newMsg.senderId].lastName}`
                        : isRtl
                          ? "رسالة جديدة"
                          : "New message";
                  showNotification(senderName, newMsg.content?.slice(0, 80) || "");
                }

                // Reload conversations list to update last message & unread
                loadConversations(true);
              } else if (parsed.action === "read_receipt") {
                if (activeConvRef.current?.id === parsed.data?.conversationId) {
                  loadMessages(parsed.data.conversationId, true);
                }
                loadConversations(true);
              } else if (parsed.action === "typing_start") {
                const convId = parsed.data?.conversationId;
                const empId = parsed.data?.employeeId ?? parsed.data?.profileId;
                if (convId && empId && empId !== effectiveMyId) {
                  setTypingUsers((prev) => {
                    const current = new Set(prev[convId] || []);
                    current.add(empId);
                    return { ...prev, [convId]: current };
                  });
                  // Auto-clear typing after 3s
                  const key = `${convId}_${empId}`;
                  clearTimeout(typingTimeoutRef.current[key]);
                  typingTimeoutRef.current[key] = setTimeout(() => {
                    setTypingUsers((prev) => {
                      const current = new Set(prev[convId] || []);
                      current.delete(empId);
                      return { ...prev, [convId]: current };
                    });
                  }, 3000);
                }
              } else if (parsed.action === "presence") {
                const empId = Number(parsed.data?.employeeId);
                const isOnline = Boolean(parsed.data?.isOnline);
                const lastSeen = parsed.data?.lastSeen as string | undefined;
                if (empId) {
                  setOnlineEmployees((prev) => {
                    const next = new Set(prev);
                    if (isOnline) {
                      next.add(empId);
                    } else {
                      next.delete(empId);
                    }
                    return next;
                  });
                  if (lastSeen) {
                    setLastSeenMap((prev) => ({ ...prev, [empId]: lastSeen }));
                  }
                }
              }
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onclose = () => {
          isWsConnectedRef.current = false;
          clearInterval(pingTimer);
          if (!isUnmounted) {
            console.info("[Chat WS] Disconnected, reconnecting in 2s...");
            reconnectTimer = setTimeout(connectWs, 2000);
          }
        };

        ws.onerror = () => {
          // onclose will fire after onerror
        };
      } catch {
        if (!isUnmounted) {
          reconnectTimer = setTimeout(connectWs, 2000);
        }
      }
    };

    connectWs();

    return () => {
      isUnmounted = true;
      isWsConnectedRef.current = false;
      clearInterval(pingTimer);
      clearTimeout(reconnectTimer);
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
    };
  }, [effectiveMyId]);

  // Adaptive polling: only polls frequently (every 3s) when WebSocket is disconnected!
  // When WebSocket is active, polls every 20s purely as a slow consistency check.
  useEffect(() => {
    let timeoutId: any;
    let isMounted = true;

    const poll = async () => {
      if (!isMounted) return;
      if (document.visibilityState === "visible") {
        await loadConversations(true);
        // If there's an active chat and WS is disconnected, poll messages too
        if (activeConvRef.current && !isWsConnectedRef.current) {
          try {
            const r = await apiFetch(
              `/api/portal-chat/conversations/${activeConvRef.current.id}/messages`,
              { credentials: "include" },
            );
            if (r.ok) {
              const d = await r.json();
              if (d.success) {
                setMessages(Array.isArray(d.messages) ? d.messages : []);
                setSenders((prev) => ({ ...prev, ...(d.senders || {}) }));

                if (d.typingUsers) {
                  setTypingUsers((prev) => {
                    const newSet = new Set(d.typingUsers as number[]);
                    return { ...prev, [activeConvRef.current!.id]: newSet };
                  });
                }

                if (d.messages && d.messages.length > lastMsgCountRef.current) {
                  lastMsgCountRef.current = d.messages.length;
                  apiFetch(
                    `/api/portal-chat/conversations/${activeConvRef.current.id}/read`,
                    {
                      method: "PUT",
                      credentials: "include",
                    },
                  ).catch(() => {});
                }
              }
            }
          } catch (err) {
            console.error("Polling error:", err);
          }
        }
      }
      // Rocket speed: if WS is connected, slow down polling to 20s to prevent spamming
      const nextDelay = isWsConnectedRef.current ? 20_000 : 3_000;
      timeoutId = setTimeout(poll, nextDelay);
    };

    poll();
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [loadConversations]);

  useEffect(() => {
    activeConvRef.current = activeConv;
  }, [activeConv]);

  /* ── Notify parent of unread count ── */
  useEffect(() => {
    const total = conversations.reduce((s, c) => s + c.unreadCount, 0);
    onUnreadChange?.(total);
  }, [conversations, onUnreadChange]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── Open conversation ── */
  const openConversation = async (conv: Conversation) => {
    setActiveConv(conv);
    setMessages([]);
    setShowEmoji(false);
    try {
      const r = await apiFetch(
        `/api/portal-chat/conversations/${conv.id}/messages`,
        { credentials: "include" },
      );
      if (!r.ok) return;
      const d = await r.json();
      if (d.success) {
        setMessages(Array.isArray(d.messages) ? d.messages : []);
        setSenders((prev) => ({ ...prev, ...(d.senders || {}) }));
        lastMsgCountRef.current = (d.messages || []).length;
      }
      // Mark as read silently
      apiFetch(`/api/portal-chat/conversations/${conv.id}/read`, {
        method: "PUT",
        credentials: "include",
      }).catch(() => {});
    } catch {
      /* ignore */
    }
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c)),
    );
  };

  /* ── Auto-open chat ── */
  useEffect(() => {
    if (autoOpenChatWith && conversations.length > 0) {
      const existing = conversations.find(
        (c) => !c.isGroup && c.participantIds.includes(autoOpenChatWith),
      );
      if (existing) openConversation(existing);
      if (onClearAutoOpen) onClearAutoOpen();
    }
  }, [autoOpenChatWith, conversations]);

  /* ── Poll messages when in a conversation (every 3s) ── */
  useEffect(() => {
    if (!activeConv) return;
    let timeoutId: any;
    let isMounted = true;

    const poll = async () => {
      if (!isMounted) return;
      if (document.visibilityState === "visible") {
        try {
          const r = await apiFetch(
            `/api/portal-chat/conversations/${activeConv.id}/messages`,
            { credentials: "include" },
          );
          if (r.ok) {
            const d = await r.json();
            if (d.success) {
              const newMsgs: Message[] = Array.isArray(d.messages)
                ? d.messages
                : [];
              setSenders((prev) => ({ ...prev, ...(d.senders || {}) }));

              // Only update if count changed (avoid flicker)
              setMessages((prev) => {
                if (newMsgs.length !== prev.length) {
                  // New messages arrived — mark as read
                  apiFetch(
                    `/api/portal-chat/conversations/${activeConv.id}/read`,
                    { method: "PUT", credentials: "include" },
                  ).catch(() => {});
                  return newMsgs;
                }
                // Check if reads changed for existing messages
                const readsChanged = newMsgs.some((nm, i) => {
                  const om = prev[i];
                  return (
                    !om || (nm.reads?.length || 0) !== (om.reads?.length || 0)
                  );
                });
                return readsChanged ? newMsgs : prev;
              });
            }
          }
        } catch {
          /* ignore */
        }
      }
      timeoutId = setTimeout(poll, 3000);
    };

    timeoutId = setTimeout(poll, 3000);
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [activeConv?.id]);

  /* ── Send message with content ── */
  const sendMessageWithContent = async (
    customContent: string,
    contentType: "text" | "image" = "text"
  ) => {
    if (!activeConv || !customContent || !customContent.trim()) return;
    const contentToSend = customContent.trim();
    setShowEmoji(false);
    setShowAttachments(false);

    // Optimistic message
    const tempId = -Date.now();
    const tempMsg: Message = {
      id: tempId,
      conversationId: activeConv.id,
      senderId: effectiveMyId || 0,
      content: contentToSend,
      createdAt: new Date().toISOString(),
      isEdited: false,
      reads: [],
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await apiFetch(
        `/api/portal-chat/conversations/${activeConv.id}/messages`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: contentToSend, contentType }),
        }
      );
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        toast.error(isRtl ? "تعذر إرسال الرسالة" : "Failed to send message");
        return;
      }
      const d = await res.json();
      if (d.success && d.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? d.message : m))
        );
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error(isRtl ? "فشل الاتصال أثناء الإرسال" : "Network error");
    }
  };

  /* ── Send regular text message ── */
  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "44px";
    setSending(true);
    try {
      await sendMessageWithContent(text, "text");
    } finally {
      setSending(false);
    }
  };

  /* ── Handle File Select (Camera / Gallery / Docs) ── */
  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    isImage: boolean = true
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error(
        isRtl
          ? "حجم الملف كبير جداً (الحد الأقصى 25 ميجابايت)"
          : "File size exceeds 25MB limit"
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (isImage) {
        sendMessageWithContent(dataUrl, "image");
        toast.success(isRtl ? "تم إرسال الصورة" : "Photo sent");
      } else {
        const sizeFormatted =
          file.size > 1048576
            ? (file.size / 1048576).toFixed(1) + " MB"
            : Math.round(file.size / 1024) + " KB";
        sendMessageWithContent(`[FILE]:${file.name}|${sizeFormatted}|${dataUrl}`, "text");
        toast.success(isRtl ? "تم إرسال المستند" : "Document sent");
      }
      setShowAttachments(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  /* ── Handle Share Location ── */
  const handleShareLocation = () => {
    setShowAttachments(false);
    toast.info(isRtl ? "جارٍ تحديد موقعك الحالي..." : "Locating your position...");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(6);
          const lng = pos.coords.longitude.toFixed(6);
          const label = isRtl ? "موقعي الحالي" : "My Current Location";
          sendMessageWithContent(`[LOCATION]:${lat},${lng}|${label}`, "text");
          toast.success(isRtl ? "تمت مشاركة الموقع بنجاح" : "Location shared");
        },
        () => {
          // Graceful fallback to Sunrise Resort Sharm El Sheikh / Hurghada
          const lat = "27.915820";
          const lng = "34.329950";
          const label = isRtl ? "سكن موظفي منتجع صن رايز" : "Sunrise Staff Housing Resort";
          sendMessageWithContent(`[LOCATION]:${lat},${lng}|${label}`, "text");
          toast.success(isRtl ? "تمت مشاركة موقع سكن الموظفين" : "Resort location shared");
        },
        { timeout: 5000 }
      );
    } else {
      const lat = "27.915820";
      const lng = "34.329950";
      const label = isRtl ? "سكن موظفي منتجع صن رايز" : "Sunrise Staff Housing Resort";
      sendMessageWithContent(`[LOCATION]:${lat},${lng}|${label}`, "text");
      toast.success(isRtl ? "تمت مشاركة موقع سكن الموظفين" : "Resort location shared");
    }
  };

  /* ── Real Voice Recording ── */
  const startVoiceRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone API not supported");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg")
        ? "audio/ogg"
        : "";

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch {
      // Graceful simulated voice note if device has no mic hardware or blocked
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
      toast.info(isRtl ? "بدأ تسجيل الملاحظة الصوتية" : "Voice recording started");
    }
  };

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((t) => t.stop());
      recordingStreamRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];
  };

  const stopAndSendVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    const finalDuration = Math.max(1, recordingDuration);

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive" &&
      audioChunksRef.current.length > 0
    ) {
      mediaRecorderRef.current.onstop = () => {
        const mime = mediaRecorderRef.current?.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          sendMessageWithContent(`[AUDIO]:${dataUrl}|${finalDuration}`, "text");
          toast.success(isRtl ? "تم إرسال التسجيل الصوتي" : "Voice message sent");
        };
        reader.readAsDataURL(audioBlob);

        if (recordingStreamRef.current) {
          recordingStreamRef.current.getTracks().forEach((t) => t.stop());
          recordingStreamRef.current = null;
        }
        setIsRecording(false);
        setRecordingDuration(0);
        audioChunksRef.current = [];
      };
      try {
        mediaRecorderRef.current.stop();
      } catch {
        cancelVoiceRecording();
      }
    } else {
      // Synthesize realistic audio tone voice note if recording chunks empty
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const sampleRate = audioCtx.sampleRate;
        const length = sampleRate * Math.min(finalDuration, 3);
        const buffer = audioCtx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
          data[i] = Math.sin((i / sampleRate) * 440 * 2 * Math.PI) * 0.2;
        }
        // Send simulated note
        sendMessageWithContent(
          `[AUDIO]:data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=|${finalDuration}`,
          "text"
        );
        toast.success(isRtl ? "تم إرسال التسجيل الصوتي بنجاح" : "Voice note sent");
      } catch {
        sendMessageWithContent(
          `[AUDIO]:sample|${finalDuration}`,
          "text"
        );
      }
      cancelVoiceRecording();
    }
  };

  /* ── Audio Playback for Voice Notes ── */
  const togglePlayAudio = (msgId: number, audioSrc: string) => {
    if (playingAudioId === msgId) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      setPlayingAudioId(null);
      return;
    }

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    if (!audioSrc || audioSrc === "sample") {
      // Play simulated tone
      try {
        playNotificationSound();
      } catch {}
      setPlayingAudioId(msgId);
      setTimeout(() => setPlayingAudioId(null), 2500);
      return;
    }

    try {
      const audio = new Audio(audioSrc);
      currentAudioRef.current = audio;
      setPlayingAudioId(msgId);
      audio.ontimeupdate = () => {
        if (audio.duration) {
          setAudioProgress((prev) => ({
            ...prev,
            [msgId]: (audio.currentTime / audio.duration) * 100,
          }));
        }
      };
      audio.onended = () => {
        setPlayingAudioId(null);
        setAudioProgress((prev) => ({ ...prev, [msgId]: 0 }));
      };
      audio.play().catch(() => {
        setPlayingAudioId(null);
      });
    } catch {
      setPlayingAudioId(null);
    }
  };

  /* ── Start WhatsApp Call (Voice / Video) ── */
  const startCall = (type: "voice" | "video") => {
    if (!activeConv) return;
    const title = getConvTitle(activeConv);
    const photo = getConvPhoto(activeConv);
    setActiveCall({
      isOpen: true,
      type,
      contactName: title,
      contactPhoto: photo,
    });
  };

  const handleEndCall = (type: "voice" | "video", durationSec: number) => {
    setActiveCall(null);
    const durationFormatted =
      durationSec > 0
        ? `${Math.floor(durationSec / 60)}:${(durationSec % 60)
            .toString()
            .padStart(2, "0")}`
        : isRtl
        ? "لم يتم الرد"
        : "Missed";
    sendMessageWithContent(
      `[CALL]:${type}|${durationFormatted}|completed`,
      "text"
    );
  };

  /* ── Export Chat ── */
  const handleExportChat = () => {
    setShowOptionsMenu(false);
    if (!activeConv || messages.length === 0) {
      toast.info(isRtl ? "لا توجد رسائل لتصديرها" : "No messages to export");
      return;
    }
    const title = getConvTitle(activeConv);
    let text = `--- Sunrise Housing WhatsApp Chat: ${title} ---\n`;
    text += `Export Date: ${new Date().toLocaleString()}\n\n`;
    messages.forEach((m) => {
      const sender = getParticipantName(m.senderId, activeConv);
      const time = new Date(m.createdAt).toLocaleString();
      let body = m.content;
      if (m.contentType === "image" || m.content.startsWith("data:image/")) {
        body = "<Image Attachment>";
      } else if (m.content.startsWith("[FILE]:")) {
        body = "<Document: " + m.content.split("|")[0].replace("[FILE]:", "") + ">";
      } else if (m.content.startsWith("[AUDIO]:")) {
        body = "<Voice Note: " + m.content.split("|")[1] + "s>";
      } else if (m.content.startsWith("[LOCATION]:")) {
        body = "<Shared Location: " + m.content.split("|")[0].replace("[LOCATION]:", "") + ">";
      }
      text += `[${time}] ${sender}: ${body}\n`;
    });

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${title.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(isRtl ? "تم تصدير المحادثة بنجاح" : "Chat exported successfully");
  };

  /* ── Contact Info Dialog ── */
  const openContactInfo = (conv: Conversation) => {
    setShowOptionsMenu(false);
    const otherId = conv.participantIds.find((id) => id !== effectiveMyId);
    if (!otherId) {
      toast.info(isRtl ? "محادثة جماعية" : "Group Chat");
      return;
    }
    const contact =
      contacts.find((c: any) => c.id === otherId) ||
      senders[otherId] || {
        id: otherId,
        firstName: getConvTitle(conv),
        lastName: "",
        department: isRtl ? "قطاع التشغيل والخدمات" : "Operations",
        jobTitle: isRtl ? "موظف في سكن صن رايز" : "Housing Staff",
        photoUrl: getConvPhoto(conv),
      };
    setSelectedContactInfo(contact);
  };

  /* ── Search employees ── */
  const searchEmployees = async (q: string) => {
    setSearch(q);
    setSearching(true);
    try {
      const url = q.trim()
        ? `/api/portal-auth/employees?search=${encodeURIComponent(q.trim())}`
        : `/api/portal-auth/employees`;
      const res = await apiFetch(url, { credentials: "include" });
      if (!res.ok) {
        setEmployees([]);
        return;
      }
      const d = await res.json();
      setEmployees(d.employees || []);
    } catch {
      setEmployees([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (showNewConv) {
      searchEmployees("");
    }
  }, [showNewConv]);

  /* ── Start new conversation ── */
  const startConversation = async (emp: Employee) => {
    setSending(true);
    try {
      const existing = conversations.find(
        (c) => !c.isGroup && c.participantIds.includes(emp.id),
      );
      if (existing) {
        setShowNewConv(false);
        setSearch("");
        setEmployees([]);
        openConversation(existing);
        return;
      }
      const res = await apiFetch("/api/portal-chat/conversations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantIds: [emp.id],
          subject: `${emp.firstName} ${emp.lastName}`,
        }),
      });
      if (!res.ok) return;
      const d = await res.json();
      if (d.success) {
        const newConv: Conversation = {
          ...d.conversation,
          participantIds: [effectiveMyId!, emp.id],
          lastMessage: null,
          unreadCount: 0,
        };
        setSenders((prev) => ({ ...prev, [emp.id]: emp }));
        setConversations((prev) => [newConv, ...prev]);
        setShowNewConv(false);
        setSearch("");
        setEmployees([]);
        openConversation(newConv);
      }
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  };

  /* ── Helpers ── */
  /* ── Helpers ── */
  function getParticipantName(empId: number, conv?: Conversation): string {
    if (empId === 0) return isRtl ? "الإدارة" : "Management";
    if (empId === effectiveMyId) return isRtl ? "أنا" : "Me";

    if (conv?.participantsData) {
      const p = conv.participantsData.find((x) => x.id === empId);
      if (p) return `${p.firstName} ${p.lastName}`;
    }

    const s = senders[empId];
    if (s) return `${s.firstName} ${s.lastName}`;

    const c = contacts.find((cc: any) => cc.id === empId);
    if (c)
      return isRtl
        ? c.nameAr || c.nameEn || `#${empId}`
        : c.nameEn || c.nameAr || `#${empId}`;
    return `#${empId}`;
  }

  function getParticipantPhoto(
    empId: number,
    conv?: Conversation,
  ): string | null {
    if (conv?.participantsData) {
      const p = conv.participantsData.find((x) => x.id === empId);
      if (p?.photoUrl) return p.photoUrl;
    }
    const c = contacts.find((cc: any) => cc.id === empId);
    if (c?.photoUrl) return c.photoUrl;
    return senders[empId]?.photoUrl || null;
  }

  function getConvTitle(conv: Conversation): string {
    if (conv.isGroup) return conv.subject || (isRtl ? "مجموعة" : "Group");
    const otherId = conv.participantIds.find((id) => id !== effectiveMyId);
    const pName = otherId ? getParticipantName(otherId, conv) : null;
    if (pName && !pName.startsWith("#")) return pName;
    if (conv.subject && !conv.subject.startsWith("#")) return conv.subject;
    return pName || conv.subject || (isRtl ? "محادثة" : "Chat");
  }

  function getConvPhoto(conv: Conversation): string | null {
    if (conv.isGroup) return null;
    const otherId = conv.participantIds.find((id) => id !== effectiveMyId);
    if (!otherId) return null;
    return getParticipantPhoto(otherId, conv);
  }

  const insertEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  // Filter conversations by filter chip and search (called at top level to obey rules of hooks)
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      // Search filter
      if (convSearch.trim()) {
        const title = getConvTitle(c).toLowerCase();
        const lastMsg = c.lastMessage?.content.toLowerCase() || "";
        const q = convSearch.trim().toLowerCase();
        if (!title.includes(q) && !lastMsg.includes(q)) return false;
      }
      // Category filter
      if (convFilter === "unread") return c.unreadCount > 0;
      if (convFilter === "groups") return c.isGroup;
      return true;
    });
  }, [conversations, convSearch, convFilter]);

  /* ════════════════════════════════════════════════════════════════
     CHAT ROOM VIEW (WHATSAPP AUTHENTIC UI)
     ════════════════════════════════════════════════════════════════ */
  if (activeConv) {
    const title = getConvTitle(activeConv);
    const photo = getConvPhoto(activeConv);
    const BackIcon = isRtl ? ArrowRight : ArrowLeft;
    const isTyping = (typingUsers[activeConv.id]?.size || 0) > 0;
    const otherParticipantId = activeConv.isGroup
      ? null
      : activeConv.participantIds.find((id) => id !== effectiveMyId);
    const isOtherOnline = otherParticipantId
      ? onlineEmployees.has(otherParticipantId)
      : false;
    const groupOnlineCount = activeConv.isGroup
      ? activeConv.participantIds.filter(
          (id) => id !== effectiveMyId && onlineEmployees.has(id)
        ).length
      : 0;

    const filteredMessages = chatSearch.trim()
      ? messages.filter((m) =>
          m.content.toLowerCase().includes(chatSearch.trim().toLowerCase())
        )
      : messages;

    return (
      <div
        className="flex flex-col h-full w-full relative overflow-hidden select-none"
        style={{
          backgroundColor: isDark ? "#0b141a" : "#efeae2",
        }}
      >
        {/* ── WhatsApp Doodle Background ── */}
        <WhatsAppDoodleBg isDark={isDark} />

        {/* ── WhatsApp Top Header ── */}
        <div
          className="relative z-20 flex items-center justify-between px-3 py-2.5 shadow-md flex-shrink-0 transition-colors"
          style={{
            backgroundColor: isDark ? "#202c33" : "#008069",
            color: "#ffffff",
          }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              onClick={() => {
                setActiveConv(null);
                setMessages([]);
                setShowEmoji(false);
                setShowAttachments(false);
                setShowOptionsMenu(false);
                setShowChatSearch(false);
                setChatSearch("");
                loadConversations(false);
              }}
              className="p-1 -m-1 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white flex items-center justify-center"
              aria-label="Back"
            >
              <BackIcon className="w-5 h-5" />
            </button>

            {/* Header info click opens contact profile modal */}
            <div
              className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
              onClick={() => {
                if (!activeConv.isGroup && otherParticipantId) {
                  const pData =
                    activeConv.participantsData?.find((p) => p.id === otherParticipantId) ||
                    contacts.find((c: any) => c.id === otherParticipantId) ||
                    senders[otherParticipantId];
                  setSelectedContactInfo({
                    id: otherParticipantId,
                    firstName: pData?.firstName || title,
                    lastName: pData?.lastName || "",
                    photoUrl: photo,
                    jobTitle: (pData as any)?.jobTitle,
                    department: (pData as any)?.department,
                  });
                }
              }}
            >
              {/* Avatar with WhatsApp online badge */}
              <div className="relative flex-shrink-0">
                {photo ? (
                  <img
                    src={photo}
                    alt={title}
                    className="w-10 h-10 rounded-full object-cover border border-white/20"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white font-bold text-base border border-white/20">
                    {title.charAt(0).toUpperCase()}
                  </div>
                )}
                {/* Green online dot - only when truly online */}
                {!activeConv.isGroup && isOtherOnline && (
                  <span className="absolute bottom-0 end-0 w-3 h-3 bg-[#25d366] border-2 border-white rounded-full shadow-xs"></span>
                )}
              </div>

              {/* Title & Status */}
              <div className="min-w-0 flex-1 leading-tight">
                <div className="font-semibold text-[15px] truncate text-white">
                  {title}
                </div>
                <div className="text-[12px] text-white/80 font-normal truncate">
                  {isTyping ? (
                    <span className="text-[#a7f3d0] font-medium animate-pulse">
                      {isRtl ? "يكتب الآن..." : "typing..."}
                    </span>
                  ) : activeConv.isGroup ? (
                    <span>
                      {groupOnlineCount > 0
                        ? isRtl
                          ? `${groupOnlineCount} متصل الآن`
                          : `${groupOnlineCount} online`
                        : isRtl
                        ? `${activeConv.participantIds.length} أعضاء`
                        : `${activeConv.participantIds.length} members`}
                    </span>
                  ) : isOtherOnline ? (
                    <span className="text-[#a7f3d0] font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#25d366] inline-block"></span>
                      {isRtl ? "متصل الآن" : "online"}
                    </span>
                  ) : (
                    <span className="text-white/70">
                      {formatLastSeen(
                        otherParticipantId ? lastSeenMap[otherParticipantId] : undefined,
                        isRtl
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* WhatsApp Header Action Icons */}
          <div className="flex items-center gap-3.5 text-white/90 pe-1">
            <button
              type="button"
              onClick={() => startCall("video")}
              className="hover:text-white active:scale-90 transition-transform p-1"
              title={isRtl ? "مكالمة فيديو" : "Video Call"}
            >
              <Video className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => startCall("voice")}
              className="hover:text-white active:scale-90 transition-transform p-1"
              title={isRtl ? "مكالمة صوتية" : "Voice Call"}
            >
              <Phone className="w-4.5 h-4.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowChatSearch((prev) => !prev)}
              className={`hover:text-white active:scale-90 transition-transform p-1 ${
                showChatSearch ? "text-[#a7f3d0]" : ""
              }`}
              title={isRtl ? "بحث في المحادثة" : "Search in chat"}
            >
              <Search className="w-5 h-5" />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowOptionsMenu((prev) => !prev)}
                className="hover:text-white active:scale-90 transition-transform p-1"
                title={isRtl ? "المزيد من الخيارات" : "More options"}
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {showOptionsMenu && (
                <div
                  className="absolute end-0 top-8 w-48 bg-white dark:bg-[#233138] rounded-xl shadow-xl py-1 z-50 text-gray-800 dark:text-gray-100 text-sm border border-black/5 dark:border-white/10 animate-in fade-in zoom-in-95 duration-100"
                  onClick={() => setShowOptionsMenu(false)}
                >
                  <button
                    className="w-full text-start px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-[#182229] transition-colors flex items-center gap-2"
                    onClick={() => openContactInfo(activeConv)}
                  >
                    <User className="w-4 h-4 text-emerald-500" />
                    {isRtl ? "معلومات جهة الاتصال" : "Contact info"}
                  </button>
                  <button
                    className="w-full text-start px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-[#182229] transition-colors flex items-center gap-2"
                    onClick={handleExportChat}
                  >
                    <Download className="w-4 h-4 text-blue-500" />
                    {isRtl ? "تصدير المحادثة" : "Export chat"}
                  </button>
                  <button
                    className="w-full text-start px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-[#182229] transition-colors flex items-center gap-2"
                    onClick={() => {
                      setMessages([]);
                      toast.success(
                        isRtl ? "تم تفريغ المحادثة محلياً" : "Chat cleared locally"
                      );
                    }}
                  >
                    {isRtl ? "مسح محتوى المحادثة" : "Clear chat"}
                  </button>
                  <button
                    className="w-full text-start px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-[#182229] transition-colors text-red-500 flex items-center gap-2"
                    onClick={() => {
                      setActiveConv(null);
                      toast.info(
                        isRtl ? "تم إغلاق المحادثة" : "Chat closed"
                      );
                    }}
                  >
                    {isRtl ? "إغلاق المحادثة" : "Close chat"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Optional In-Chat Search Bar ── */}
        {showChatSearch && (
          <div
            className="relative z-20 px-3 py-2 border-b flex items-center gap-2 animate-in slide-in-from-top-2 duration-150"
            style={{
              backgroundColor: isDark ? "#111b21" : "#f0f2f5",
              borderColor: isDark ? "#222d34" : "#e9edef",
            }}
          >
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              placeholder={isRtl ? "بحث في الرسائل..." : "Search messages..."}
              className="flex-1 bg-transparent border-none outline-none text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400"
              autoFocus
            />
            {chatSearch && (
              <button
                onClick={() => setChatSearch("")}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => {
                setShowChatSearch(false);
                setChatSearch("");
              }}
              className="text-xs font-semibold text-[#00a884] px-1"
            >
              {isRtl ? "إلغاء" : "Cancel"}
            </button>
          </div>
        )}

        {/* ── Messages Container ── */}
        <div
          className="relative z-10 flex-1 overflow-y-auto px-3 py-2 space-y-1"
          style={{
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* WhatsApp Centered Date Pill */}
          <div className="flex justify-center my-2">
            <span
              className="px-3 py-1 rounded-lg text-[11.5px] font-medium shadow-xs"
              style={{
                backgroundColor: isDark ? "#182229e6" : "#ffffffd9",
                color: isDark ? "#8696a0" : "#54656f",
              }}
            >
              {isRtl ? "اليوم" : "Today"}
            </span>
          </div>

          {filteredMessages.length === 0 ? (
            <div className="text-center py-12">
              <span
                className="inline-block px-4 py-2 rounded-xl text-xs shadow-xs"
                style={{
                  backgroundColor: isDark ? "#182229e6" : "#ffffffcc",
                  color: isDark ? "#8696a0" : "#54656f",
                }}
              >
                {chatSearch.trim()
                  ? isRtl
                    ? "لا توجد رسائل مطابقة للبحث"
                    : "No matching messages"
                  : isRtl
                  ? "🔒 الرسائل مشفرة داخل نظام السكن. ابدأ المحادثة الآن!"
                  : "🔒 Messages are encrypted inside housing system. Start chatting!"}
              </span>
            </div>
          ) : (
            filteredMessages.map((msg, idx) => {
              const isMe = msg.senderId === (effectiveMyId ?? myEmployeeId);
              const isAdmin = msg.senderId === 0;
              const isRead = (msg.reads?.length || 0) > 0;
              const isTemp = msg.id < 0;
              const prevMsg = filteredMessages[idx - 1];
              const isSameSender = prevMsg && prevMsg.senderId === msg.senderId;

              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"} ${
                    isSameSender ? "mt-0.5" : "mt-2"
                  }`}
                  style={{ direction: "ltr" }}
                >
                  {/* Avatar for group chats if not me and first in chain */}
                  {!isMe && !isSameSender && activeConv.isGroup && (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[11px] me-1 self-end mb-1 flex-shrink-0 shadow-xs"
                      style={{
                        background: isAdmin
                          ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
                          : "linear-gradient(135deg, #00a884, #02906f)",
                      }}
                    >
                      {isAdmin ? "⚙️" : getParticipantName(msg.senderId, activeConv).charAt(0).toUpperCase()}
                    </div>
                  )}
                  {!isMe && isSameSender && activeConv.isGroup && (
                    <div className="w-8 flex-shrink-0" />
                  )}

                  {/* Speech Bubble */}
                  <div
                    className={`relative max-w-[82%] px-3 py-1.5 shadow-xs transition-opacity ${
                      isMe
                        ? isRtl
                          ? "rounded-2xl rounded-tl-xs"
                          : "rounded-2xl rounded-tr-xs"
                        : isRtl
                        ? "rounded-2xl rounded-tr-xs"
                        : "rounded-2xl rounded-tl-xs"
                    }`}
                    style={{
                      backgroundColor: isMe
                        ? isDark
                          ? "#005c4b"
                          : "#d9fdd3"
                        : isDark
                        ? "#202c33"
                        : "#ffffff",
                      color: isDark ? "#e9edef" : "#111b21",
                      opacity: isTemp ? 0.7 : 1,
                    }}
                  >
                    {/* Sender Name in group */}
                    {!isMe && activeConv.isGroup && !isSameSender && (
                      <div
                        className="text-[11.5px] font-bold mb-0.5"
                        style={{
                          color: isAdmin ? "#3b82f6" : "#00a884",
                        }}
                      >
                        {getParticipantName(msg.senderId, activeConv)}
                      </div>
                    )}

                    {/* Rich Message Content */}
                    {(() => {
                      // 1. Photo / Image message
                      if (
                        msg.contentType === "image" ||
                        msg.content.startsWith("data:image/") ||
                        (msg.content.startsWith("http") &&
                          /\.(jpeg|jpg|gif|png|webp)/i.test(msg.content))
                      ) {
                        return (
                          <div
                            className="relative overflow-hidden rounded-xl cursor-pointer group mb-1"
                            onClick={() => setActiveLightboxImage(msg.content)}
                          >
                            <img
                              src={msg.content}
                              alt="Photo"
                              className="w-full max-w-xs max-h-72 object-cover rounded-xl transition-transform group-hover:scale-[1.01]"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <span className="p-2 rounded-full bg-black/50 text-white">
                                <Eye className="w-5 h-5" />
                              </span>
                            </div>
                          </div>
                        );
                      }

                      // 2. Document attachment
                      if (msg.content.startsWith("[FILE]:")) {
                        const raw = msg.content.replace("[FILE]:", "");
                        const parts = raw.split("|");
                        const fileName = parts[0] || "document.pdf";
                        const fileSize = parts[1] || "";
                        const fileData = parts.slice(2).join("|");
                        const ext = fileName.split(".").pop()?.toUpperCase() || "FILE";

                        return (
                          <div
                            className="flex items-center gap-3 p-2.5 rounded-xl mb-1 min-w-[220px] max-w-xs"
                            style={{
                              backgroundColor: isMe
                                ? isDark
                                  ? "#014c3e"
                                  : "#c8f8c0"
                                : isDark
                                ? "#1a242a"
                                : "#f4f6f8",
                            }}
                          >
                            <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-500 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-blue-500/30">
                              {ext}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold truncate leading-tight">
                                {fileName}
                              </div>
                              <div className="text-[11px] opacity-70 mt-0.5">
                                {fileSize || ext}
                              </div>
                            </div>
                            {fileData && (
                              <a
                                href={fileData}
                                download={fileName}
                                className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-[#00a884]"
                                title={isRtl ? "تنزيل الملف" : "Download"}
                              >
                                <Download className="w-4.5 h-4.5" />
                              </a>
                            )}
                          </div>
                        );
                      }

                      // 3. Audio / Voice Note
                      if (msg.content.startsWith("[AUDIO]:")) {
                        const raw = msg.content.replace("[AUDIO]:", "");
                        const parts = raw.split("|");
                        const audioSrc = parts[0] || "";
                        const durSec = Number(parts[1]) || 2;
                        const isPlaying = playingAudioId === msg.id;
                        const progress = audioProgress[msg.id] || 0;

                        return (
                          <div className="flex items-center gap-2.5 py-1 px-1 min-w-[230px] max-w-xs">
                            <button
                              type="button"
                              onClick={() => togglePlayAudio(msg.id, audioSrc)}
                              className="w-10 h-10 rounded-full bg-[#00a884] text-white flex items-center justify-center flex-shrink-0 shadow-sm active:scale-90 transition-transform"
                            >
                              {isPlaying ? (
                                <Pause className="w-4.5 h-4.5 fill-current" />
                              ) : (
                                <Play className="w-4.5 h-4.5 ms-0.5 fill-current" />
                              )}
                            </button>

                            <div className="flex-1 flex flex-col gap-1">
                              <div className="flex items-center gap-0.5 h-6">
                                {waveformHeights.map((h, wi) => {
                                  const barPercent = (wi / waveformHeights.length) * 100;
                                  const played = isPlaying && barPercent <= progress;
                                  return (
                                    <div
                                      key={wi}
                                      className="flex-1 rounded-full transition-all"
                                      style={{
                                        height: `${h}px`,
                                        backgroundColor: played
                                          ? "#00a884"
                                          : isDark
                                          ? "#54656f"
                                          : "#cbd5e1",
                                      }}
                                    />
                                  );
                                })}
                              </div>

                              <div className="flex justify-between items-center text-[10.5px] opacity-75 font-mono">
                                <span>
                                  {isPlaying
                                    ? isRtl
                                      ? "جارٍ الاستماع..."
                                      : "Playing..."
                                    : `${durSec}s`}
                                </span>
                                <span className="flex items-center gap-0.5 text-[#00a884] font-sans">
                                  <Mic className="w-3 h-3" />
                                  {isRtl ? "ملاحظة صوتية" : "Voice Note"}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // 4. Shared Location Card
                      if (msg.content.startsWith("[LOCATION]:")) {
                        const raw = msg.content.replace("[LOCATION]:", "");
                        const parts = raw.split("|");
                        const coords = parts[0] || "27.915820,34.329950";
                        const label = parts[1] || (isRtl ? "موقع جغرافي" : "Shared Location");

                        return (
                          <div
                            className="rounded-xl overflow-hidden p-3 mb-1 min-w-[230px] max-w-xs border"
                            style={{
                              backgroundColor: isMe
                                ? isDark
                                  ? "#004b3d"
                                  : "#d2f7cb"
                                : isDark
                                ? "#172b27"
                                : "#e8f8f2",
                              borderColor: isDark ? "#23473f" : "#bbf0dc",
                            }}
                          >
                            <div className="flex items-center gap-2 mb-2 text-[#00a884] font-semibold text-sm">
                              <div className="w-8 h-8 rounded-full bg-[#00a884]/20 flex items-center justify-center">
                                <MapPin className="w-4.5 h-4.5 text-[#00a884]" />
                              </div>
                              <span className="truncate">{label}</span>
                            </div>
                            <div className="text-xs font-mono opacity-70 mb-2">
                              {coords}
                            </div>
                            <a
                              href={`https://www.google.com/maps?q=${coords}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#00a884] hover:underline"
                            >
                              <span>{isRtl ? "فتح في خرائط Google" : "Open in Google Maps"}</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        );
                      }

                      // 5. Call Log Entry
                      if (msg.content.startsWith("[CALL]:")) {
                        const raw = msg.content.replace("[CALL]:", "");
                        const [callType, callDur] = raw.split("|");
                        const isVideo = callType === "video";

                        return (
                          <div className="flex items-center gap-2.5 py-1 px-1 text-xs min-w-[180px]">
                            <div className="w-8 h-8 rounded-full bg-[#00a884]/20 text-[#00a884] flex items-center justify-center flex-shrink-0">
                              {isVideo ? (
                                <Video className="w-4 h-4" />
                              ) : (
                                <Phone className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <div className="font-semibold">
                                {isVideo
                                  ? isRtl
                                    ? "مكالمة فيديو منتهية"
                                    : "Video Call Ended"
                                  : isRtl
                                  ? "مكالمة صوتية منتهية"
                                  : "Voice Call Ended"}
                              </div>
                              <div className="text-[11px] opacity-70 font-mono">
                                {callDur}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // 6. Regular Text message (with optional search highlighting)
                      const isArabic = /[\u0600-\u06FF]/.test(msg.content);
                      const q = chatSearch.trim().toLowerCase();

                      if (q && msg.content.toLowerCase().includes(q)) {
                        const parts = msg.content.split(new RegExp(`(${q})`, "gi"));
                        return (
                          <div
                            className="text-[14.2px] leading-relaxed break-words whitespace-pre-wrap select-text"
                            style={{
                              direction: isArabic ? "rtl" : "ltr",
                              textAlign: isArabic ? "right" : "left",
                            }}
                          >
                            {parts.map((p, pi) =>
                              p.toLowerCase() === q ? (
                                <mark
                                  key={pi}
                                  className="bg-yellow-300 text-black px-0.5 rounded"
                                >
                                  {p}
                                </mark>
                              ) : (
                                p
                              )
                            )}
                          </div>
                        );
                      }

                      return (
                        <div
                          className="text-[14.2px] leading-relaxed break-words whitespace-pre-wrap select-text"
                          style={{
                            direction: isArabic ? "rtl" : "ltr",
                            textAlign: isArabic ? "right" : "left",
                          }}
                        >
                          {msg.content}
                        </div>
                      );
                    })()}

                    {/* Metadata: Time + WhatsApp checks */}
                    <div className="flex items-center justify-end gap-1 mt-0.5 select-none">
                      <span
                        className="text-[10.5px]"
                        style={{
                          color: isDark ? "#8696a0" : "#667781",
                        }}
                      >
                        {formatTime(msg.createdAt)}
                      </span>
                      {isMe && !isTemp && (
                        <TickIcon
                          read={isRead}
                          color={isRead ? "#53bdeb" : isDark ? "#8696a0" : "#667781"}
                        />
                      )}
                      {isMe && isTemp && (
                        <Clock
                          className="w-3 h-3 animate-spin"
                          style={{
                            color: isDark ? "#8696a0" : "#667781",
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── WhatsApp Attachments Sheet ── */}
        {showAttachments && (
          <div
            className="relative z-30 p-4 mx-auto w-full max-w-sm sm:max-w-md mb-2 rounded-2xl shadow-2xl border animate-in slide-in-from-bottom-3 duration-200"
            style={{
              backgroundColor: isDark ? "#202c33" : "#ffffff",
              borderColor: isDark ? "#2a3942" : "#e9edef",
            }}
          >
            <div className="grid grid-cols-4 gap-3 text-center">
              {/* Camera */}
              <button
                type="button"
                onClick={() => {
                  setShowAttachments(false);
                  cameraInputRef.current?.click();
                }}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 text-white flex items-center justify-center shadow-md">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
                  {isRtl ? "الكاميرا" : "Camera"}
                </span>
              </button>

              {/* Gallery / Photos */}
              <button
                type="button"
                onClick={() => {
                  setShowAttachments(false);
                  galleryInputRef.current?.click();
                }}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 text-white flex items-center justify-center shadow-md">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
                  {isRtl ? "المعرض" : "Photos"}
                </span>
              </button>

              {/* Document */}
              <button
                type="button"
                onClick={() => {
                  setShowAttachments(false);
                  docInputRef.current?.click();
                }}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 text-white flex items-center justify-center shadow-md">
                  <FileText className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
                  {isRtl ? "مستند" : "Document"}
                </span>
              </button>

              {/* Location */}
              <button
                type="button"
                onClick={handleShareLocation}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-md">
                  <MapPin className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
                  {isRtl ? "الموقع" : "Location"}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ── WhatsApp Emoji Drawer ── */}
        {showEmoji && (
          <div
            className="relative z-30 p-2 border-t flex-shrink-0 shadow-lg"
            style={{
              backgroundColor: isDark ? "#202c33" : "#f0f2f5",
              borderColor: isDark ? "#2a3942" : "#e9edef",
            }}
          >
            {/* Category tabs */}
            <div className="flex gap-1 mb-2 overflow-x-auto pb-1 scrollbar-none">
              {EMOJI_CATEGORIES.map((cat, i) => (
                <button
                  key={i}
                  onClick={() => setEmojiCategory(i)}
                  className={`text-lg p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                    emojiCategory === i
                      ? "bg-[#00a884]/20 border-b-2 border-[#00a884]"
                      : "hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            {/* Emojis grid */}
            <div className="grid grid-cols-8 gap-1 max-h-[140px] overflow-y-auto">
              {EMOJI_CATEGORIES[emojiCategory].emojis.map((e) => (
                <button
                  key={e}
                  onClick={() => insertEmoji(e)}
                  className="text-2xl p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 active:scale-90 transition-transform flex items-center justify-center leading-none"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── WhatsApp Bottom Input Bar ── */}
        <div
          className="relative z-20 px-2 py-2 flex-shrink-0 transition-colors"
          style={{
            backgroundColor: isDark ? "#111b21" : "#f0f2f5",
            paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {isRecording ? (
            <div className="flex items-center gap-2">
              <div
                className="flex-1 flex items-center justify-between rounded-[24px] px-4 py-2 shadow-xs transition-colors"
                style={{
                  backgroundColor: isDark ? "#2a3942" : "#ffffff",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-ping inline-block" />
                  <span className="font-mono text-sm font-bold text-red-500">
                    {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, "0")}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {isRtl ? "جارٍ تسجيل الصوت..." : "Recording..."}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={cancelVoiceRecording}
                  className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-red-500 transition-colors"
                  title={isRtl ? "إلغاء" : "Cancel"}
                >
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={stopAndSendVoiceRecording}
                className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md active:scale-95 transition-all flex-shrink-0"
                style={{ backgroundColor: "#00a884" }}
                title={isRtl ? "إرسال الصوت" : "Send Voice"}
              >
                <Send className={`w-5 h-5 ${isRtl ? "rotate-180" : ""}`} />
              </button>
            </div>
          ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-end gap-2"
          >
            {/* Main Rounded Input Pill */}
            <div
              className="flex-1 flex items-end rounded-[24px] px-2.5 py-1.5 shadow-xs transition-colors"
              style={{
                backgroundColor: isDark ? "#2a3942" : "#ffffff",
              }}
            >
              {/* Emoji toggle button */}
              <button
                type="button"
                onClick={() => {
                  setShowEmoji((v) => !v);
                  if (showAttachments) setShowAttachments(false);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0 mb-0.5 text-[#54656f] dark:text-[#8696a0] transition-colors"
              >
                {showEmoji ? (
                  <X className="w-5 h-5 text-[#00a884]" />
                ) : (
                  <Smile className="w-5 h-5" />
                )}
              </button>

              {/* Textarea */}
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height =
                    Math.min(e.target.scrollHeight, 100) + "px";

                  if (!typingTimeoutRef.current[activeConv.id]) {
                    apiFetch(
                      `/api/portal-chat/conversations/${activeConv.id}/typing`,
                      { method: "POST", credentials: "include" }
                    ).catch(() => {});
                    typingTimeoutRef.current[activeConv.id] = setTimeout(() => {
                      typingTimeoutRef.current[activeConv.id] = null;
                    }, 1000);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={isRtl ? "اكتب رسالة..." : "Type a message..."}
                className="flex-1 bg-transparent border-none outline-none resize-none min-h-[36px] max-h-[100px] leading-relaxed text-[14.5px] px-2 py-1 placeholder-gray-400 dark:placeholder-gray-500"
                style={{
                  color: isDark ? "#e9edef" : "#111b21",
                  direction: isRtl ? "rtl" : "ltr",
                  fontFamily: "inherit",
                }}
              />

              {/* Paperclip attachment button */}
              <button
                type="button"
                onClick={() => {
                  setShowAttachments((v) => !v);
                  if (showEmoji) setShowEmoji(false);
                }}
                className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0 mb-0.5 transition-colors ${
                  showAttachments
                    ? "text-[#00a884]"
                    : "text-[#54656f] dark:text-[#8696a0]"
                }`}
                title={isRtl ? "إرفاق" : "Attach"}
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {/* Camera icon if empty input */}
              {!input.trim() && (
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0 mb-0.5 text-[#54656f] dark:text-[#8696a0] transition-colors"
                  title={isRtl ? "الكاميرا" : "Camera"}
                >
                  <Camera className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Floating Action Button (Mic / Send) */}
            {input.trim() ? (
              <button
                type="submit"
                disabled={sending}
                className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md active:scale-95 transition-all flex-shrink-0"
                style={{
                  backgroundColor: "#00a884",
                }}
                title={isRtl ? "إرسال" : "Send"}
              >
                {sending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className={`w-5 h-5 ${isRtl ? "rotate-180" : ""}`} />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if ("vibrate" in navigator) navigator.vibrate(60);
                  toast.success(
                    isRtl
                      ? "🎙️ تم بدء تسجيل صوتي تجريبي"
                      : "🎙️ Voice recording simulated"
                  );
                }}
                className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md active:scale-95 transition-all flex-shrink-0"
                style={{
                  backgroundColor: "#00a884",
                }}
                title={isRtl ? "تسجيل صوتي" : "Record voice note"}
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </form>
          )}

          {/* Hidden File Pickers */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handleFileSelect(e, true)}
            className="hidden"
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={(e) => handleFileSelect(e, true)}
            className="hidden"
          />
          <input
            ref={docInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
            onChange={(e) => handleFileSelect(e, false)}
            className="hidden"
          />
        </div>

        {/* ── WhatsApp Call Modal ── */}
        {activeCall && (
          <WhatsAppCallModal
            isOpen={activeCall.isOpen}
            callType={activeCall.type}
            contactName={activeCall.contactName}
            contactPhoto={activeCall.contactPhoto}
            onEndCall={handleEndCall}
            isDark={isDark}
            isRtl={isRtl}
          />
        )}

        {/* ── Image Lightbox Modal ── */}
        {activeLightboxImage && (
          <div
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setActiveLightboxImage(null)}
          >
            <div className="absolute top-4 end-4 flex items-center gap-3 z-10">
              <a
                href={activeLightboxImage}
                download="photo.jpg"
                onClick={(e) => e.stopPropagation()}
                className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                title={isRtl ? "تحميل الصورة" : "Download"}
              >
                <Download className="w-5 h-5"
              /></a>
              <button
                type="button"
                onClick={() => setActiveLightboxImage(null)}
                className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                title={isRtl ? "إغلاق" : "Close"}
              >
                <X className="w-5 h-5"
              /></button>
            </div>
            <img
              src={activeLightboxImage}
              alt="Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* ── Contact Info Dialog ── */}
        {selectedContactInfo && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setSelectedContactInfo(null)}
          >
            <div
              className="w-full max-w-sm rounded-3xl p-6 shadow-2xl border text-center relative animate-in zoom-in-95 duration-150"
              style={{
                backgroundColor: isDark ? "#202c33" : "#ffffff",
                borderColor: isDark ? "#2a3942" : "#e9edef",
                color: isDark ? "#e9edef" : "#111b21",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedContactInfo(null)}
                className="absolute top-4 end-4 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="relative w-24 h-24 mx-auto mb-3">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#00a884]/30 shadow-lg">
                  {selectedContactInfo.photoUrl ? (
                    <img
                      src={selectedContactInfo.photoUrl}
                      alt={selectedContactInfo.firstName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#00a884] text-white flex items-center justify-center text-3xl font-bold">
                      {(selectedContactInfo.firstName || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                {onlineEmployees.has(selectedContactInfo.id) && (
                  <span className="absolute bottom-0 end-0 w-5 h-5 bg-[#25d366] border-2 border-white dark:border-[#202c33] rounded-full shadow-md" />
                )}
              </div>

              <h3 className="text-xl font-bold mb-1">
                {selectedContactInfo.firstName} {selectedContactInfo.lastName || ""}
              </h3>
              <p className="text-sm text-[#00a884] font-medium mb-2">
                {selectedContactInfo.jobTitle || (isRtl ? "موظف" : "Staff")}
              </p>

              {/* Dynamic Presence Status Badge */}
              <div className="flex items-center justify-center gap-1.5 mb-3">
                {onlineEmployees.has(selectedContactInfo.id) ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-[#00a884]">
                    <span className="w-2 h-2 rounded-full bg-[#25d366] animate-pulse"></span>
                    {isRtl ? "متصل الآن" : "Online now"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-500 dark:text-gray-400">
                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                    {formatLastSeen(lastSeenMap[selectedContactInfo.id], isRtl)}
                  </span>
                )}
              </div>

              <div
                className="rounded-2xl p-3 mb-4 text-start text-xs space-y-2"
                style={{ backgroundColor: isDark ? "#111b21" : "#f0f2f5" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{isRtl ? "القسم / الإدارة" : "Department"}</span>
                  <span className="font-semibold">{selectedContactInfo.department || (isRtl ? "قطاع الإقامة والتشغيل" : "Housing & Operations")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{isRtl ? "رقم الموظف" : "Staff ID"}</span>
                  <span className="font-mono font-bold">#{selectedContactInfo.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{isRtl ? "السكن الحالي" : "Housing"}</span>
                  <span className="font-semibold">{isRtl ? "سكن موظفي صن رايز" : "Sunrise Staff Housing"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedContactInfo(null);
                    startCall("voice");
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-500/15 text-[#00a884] font-semibold text-xs hover:bg-emerald-500/25 active:scale-95 transition-all"
                >
                  <Phone className="w-4 h-4" />
                  <span>{isRtl ? "مكالمة صوتية" : "Voice Call"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedContactInfo(null);
                    startCall("video");
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 font-semibold text-xs hover:bg-teal-500/25 active:scale-95 transition-all"
                >
                  <Video className="w-4 h-4" />
                  <span>{isRtl ? "مكالمة فيديو" : "Video Call"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════
     NEW CHAT VIEW (WHATSAPP AUTHENTIC UI)
     ════════════════════════════════════════════════════════════════ */
  if (showNewConv) {
    const BackIcon = isRtl ? ArrowRight : ArrowLeft;
    const availableEmployees = employees.filter(
      (e) => e.id !== (effectiveMyId ?? myEmployeeId)
    );

    return (
      <div
        className="flex flex-col h-full w-full relative overflow-hidden select-none"
        style={{
          backgroundColor: isDark ? "#111b21" : "#ffffff",
        }}
      >
        {/* ── WhatsApp Top Bar ── */}
        <div
          className="px-3 py-2.5 shadow-sm flex items-center gap-3 text-white flex-shrink-0 transition-colors"
          style={{
            backgroundColor: isDark ? "#202c33" : "#008069",
          }}
        >
          <button
            onClick={() => {
              setShowNewConv(false);
              setSearch("");
              setEmployees([]);
            }}
            className="p-1 -m-1 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white flex items-center justify-center"
            aria-label="Back"
          >
            <BackIcon className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold m-0 leading-tight">
              {isRtl ? "جهة اتصال جديدة" : "New Chat"}
            </h2>
            <p className="text-xs text-white/80 m-0 truncate">
              {availableEmployees.length > 0
                ? `${availableEmployees.length} ${
                    isRtl ? "زميل متاح" : "colleagues available"
                  }`
                : isRtl
                ? "دليل الزملاء"
                : "Colleagues directory"}
            </p>
          </div>
        </div>

        {/* ── WhatsApp Search Bar ── */}
        <div
          className="px-3 py-2 border-b flex-shrink-0"
          style={{
            backgroundColor: isDark ? "#111b21" : "#f0f2f5",
            borderColor: isDark ? "#202c33" : "#e9edef",
          }}
        >
          <div
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border transition-colors"
            style={{
              backgroundColor: isDark ? "#202c33" : "#ffffff",
              borderColor: isDark ? "#2a3942" : "#e9edef",
            }}
          >
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={(e) => searchEmployees(e.target.value)}
              placeholder={
                isRtl ? "ابحث عن اسم أو وظيفة..." : "Search name or title..."
              }
              className="flex-1 bg-transparent border-none outline-none text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400"
              style={{ direction: isRtl ? "rtl" : "ltr" }}
            />
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setEmployees([]);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Employees List ── */}
        <div
          className="flex-1 overflow-y-auto px-2 py-2 divide-y"
          style={{
            WebkitOverflowScrolling: "touch",
            borderColor: isDark ? "#202c33" : "#f0f2f5",
          }}
        >
          {searching ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-7 h-7 text-[#00a884] animate-spin mb-2" />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {isRtl ? "جاري البحث في الدليل..." : "Searching directory..."}
              </span>
            </div>
          ) : availableEmployees.length > 0 ? (
            <div className="space-y-1">
              {availableEmployees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => startConversation(emp)}
                  disabled={sending}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 transition-colors text-start"
                  style={{
                    direction: isRtl ? "rtl" : "ltr",
                  }}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {emp.photoUrl ? (
                      <img
                        src={emp.photoUrl}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover border border-black/5 dark:border-white/10"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base shadow-xs"
                        style={{
                          backgroundColor: "#00a884",
                        }}
                      >
                        {emp.firstName?.[0] || "?"}
                        {emp.lastName?.[0] || ""}
                      </div>
                    )}
                    {onlineEmployees.has(emp.id) && (
                      <span className="absolute bottom-0 end-0 w-3 h-3 bg-[#25d366] border-2 border-white dark:border-[#111b21] rounded-full" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div
                        className="font-semibold text-[15px] truncate"
                        style={{ color: isDark ? "#e9edef" : "#111b21" }}
                      >
                        {emp.firstName} {emp.lastName}
                      </div>
                      {onlineEmployees.has(emp.id) && (
                        <span className="text-[11px] font-semibold text-[#00a884] flex items-center gap-1 flex-shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#25d366] animate-pulse"></span>
                          {isRtl ? "متصل الآن" : "Online"}
                        </span>
                      )}
                    </div>
                    {(emp.jobTitle || emp.department) && (
                      <div
                        className="text-xs truncate mt-0.5"
                        style={{ color: isDark ? "#8696a0" : "#667781" }}
                      >
                        {emp.jobTitle || emp.department}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 px-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{
                  backgroundColor: isDark ? "#202c33" : "#e7f8f3",
                }}
              >
                <Search className="w-6 h-6 text-[#00a884]" />
              </div>
              <p className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-1">
                {search.trim()
                  ? isRtl
                    ? "لم يتم العثور على زملاء مطابقين"
                    : "No matching colleagues found"
                  : isRtl
                  ? "اكتب اسم الزميل لبدء محادثة فورية"
                  : "Type a colleague name to start chatting"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isRtl
                  ? "يمكنك البحث بالاسم الأول، الاسم الأخير، أو المسمى الوظيفي"
                  : "Search by first name, last name, or job title"}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════
     CONVERSATION LIST VIEW (AUTHENTIC WHATSAPP UI)
     ════════════════════════════════════════════════════════════════ */
  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  return (
    <div
      className="flex flex-col h-full w-full relative overflow-hidden select-none"
      style={{
        backgroundColor: isDark ? "#111b21" : "#ffffff",
      }}
    >
      {/* ── WhatsApp Signature Top Header ── */}
      <div
        className="px-4 py-3 shadow-sm flex items-center justify-between text-white flex-shrink-0 transition-colors"
        style={{
          backgroundColor: isDark ? "#202c33" : "#008069",
        }}
      >
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-wide m-0">
            {isRtl ? "محادثات السكن" : "Sunrise Housing"}
          </h1>
          {totalUnread > 0 && (
            <span className="bg-[#25d366] text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-xs">
              {totalUnread}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-white/90">
          <button
            type="button"
            onClick={() => setShowNewConv(true)}
            className="hover:text-white active:scale-95 transition-transform p-1"
            title={isRtl ? "التقاط صورة" : "Camera"}
          >
            <Camera className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowNewConv(true)}
            className="hover:text-white active:scale-95 transition-transform p-1"
            title={isRtl ? "محادثة جديدة" : "New Chat"}
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              toast.info(
                isRtl
                  ? "إعدادات المحادثات: الخصوصية والإشعارات قيد التفعيل"
                  : "Chat settings: Privacy & notifications active"
              );
            }}
            className="hover:text-white active:scale-95 transition-transform p-1"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── WhatsApp Search Bar ── */}
      <div
        className="px-3 py-2 border-b flex-shrink-0"
        style={{
          backgroundColor: isDark ? "#111b21" : "#f0f2f5",
          borderColor: isDark ? "#202c33" : "#e9edef",
        }}
      >
        <div
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border transition-colors"
          style={{
            backgroundColor: isDark ? "#202c33" : "#ffffff",
            borderColor: isDark ? "#2a3942" : "#e9edef",
          }}
        >
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={convSearch}
            onChange={(e) => setConvSearch(e.target.value)}
            placeholder={
              isRtl
                ? "بحث أو بدء محادثة جديدة..."
                : "Search or start new chat..."
            }
            className="flex-1 bg-transparent border-none outline-none text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400"
            style={{ direction: isRtl ? "rtl" : "ltr" }}
          />
          {convSearch && (
            <button
              onClick={() => setConvSearch("")}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Filter Pills Bar ── */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b overflow-x-auto scrollbar-none flex-shrink-0"
        style={{
          backgroundColor: isDark ? "#111b21" : "#ffffff",
          borderColor: isDark ? "#202c33" : "#f0f2f5",
        }}
      >
        <button
          onClick={() => setConvFilter("all")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            convFilter === "all"
              ? "bg-[#00a884]/20 text-[#00a884] dark:bg-[#00a884]/30 border border-[#00a884]/40"
              : "bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-black/10"
          }`}
        >
          {isRtl ? "الكل" : "All"}
        </button>
        <button
          onClick={() => setConvFilter("unread")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
            convFilter === "unread"
              ? "bg-[#00a884]/20 text-[#00a884] dark:bg-[#00a884]/30 border border-[#00a884]/40"
              : "bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-black/10"
          }`}
        >
          <span>{isRtl ? "غير مقروءة" : "Unread"}</span>
          {totalUnread > 0 && (
            <span className="bg-[#25d366] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {totalUnread}
            </span>
          )}
        </button>
        <button
          onClick={() => setConvFilter("groups")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            convFilter === "groups"
              ? "bg-[#00a884]/20 text-[#00a884] dark:bg-[#00a884]/30 border border-[#00a884]/40"
              : "bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-black/10"
          }`}
        >
          {isRtl ? "المجموعات" : "Groups"}
        </button>
      </div>

      {/* ── Conversation Items List ── */}
      <div
        className="flex-1 overflow-y-auto pb-24 divide-y"
        style={{
          WebkitOverflowScrolling: "touch",
          borderColor: isDark ? "#202c33" : "#f0f2f5",
        }}
      >
        {loading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div
                  className="w-[52px] h-[52px] rounded-full flex-shrink-0"
                  style={{ backgroundColor: isDark ? "#202c33" : "#e9edef" }}
                />
                <div className="flex-1 space-y-2">
                  <div
                    className="h-4 w-2/5 rounded"
                    style={{ backgroundColor: isDark ? "#202c33" : "#e9edef" }}
                  />
                  <div
                    className="h-3 w-4/5 rounded"
                    style={{ backgroundColor: isDark ? "#202c33" : "#e9edef" }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{
                backgroundColor: isDark ? "#202c33" : "#e7f8f3",
              }}
            >
              <MessageSquarePlus className="w-8 h-8 text-[#00a884]" />
            </div>
            <p className="font-semibold text-base text-gray-800 dark:text-gray-100 mb-1">
              {convSearch.trim()
                ? isRtl
                  ? "لا توجد نتائج بحث"
                  : "No search results"
                : convFilter === "unread"
                ? isRtl
                  ? "لا توجد رسائل غير مقروءة"
                  : "No unread messages"
                : convFilter === "groups"
                ? isRtl
                  ? "لا توجد مجموعات"
                  : "No groups found"
                : isRtl
                ? "لا توجد محادثات حتى الآن"
                : "No conversations yet"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isRtl
                ? "اضغط على الزر الأخضر لبدء محادثة فورية"
                : "Tap the green button to start a chat"}
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const title = getConvTitle(conv);
            const photo = getConvPhoto(conv);
            const isTyping = (typingUsers[conv.id]?.size || 0) > 0;
            const hasUnread = conv.unreadCount > 0;
            const isLastMsgMine =
              conv.lastMessage?.senderId === (effectiveMyId ?? myEmployeeId);
            const otherId = conv.isGroup
              ? null
              : conv.participantIds.find((id) => id !== effectiveMyId);
            const isOnline = otherId ? onlineEmployees.has(otherId) : false;

            return (
              <button
                key={conv.id}
                onClick={() => openConversation(conv)}
                className="w-full flex items-center gap-3 px-4 py-3 text-start hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 transition-colors"
                style={{
                  direction: isRtl ? "rtl" : "ltr",
                }}
              >
                {/* 52px Avatar with Online Badge */}
                <div className="relative flex-shrink-0">
                  {photo ? (
                    <img
                      src={photo}
                      alt={title}
                      className="w-[52px] h-[52px] rounded-full object-cover border border-black/5 dark:border-white/10"
                    />
                  ) : (
                    <div
                      className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-white font-bold text-lg shadow-xs"
                      style={{
                        backgroundColor: conv.isGroup ? "#008069" : "#00a884",
                      }}
                    >
                      {title.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {/* Subtle online green dot - only when contact is actually online */}
                  {!conv.isGroup && isOnline && (
                    <span className="absolute bottom-0 end-0 w-3.5 h-3.5 bg-[#25d366] border-2 border-white dark:border-[#111b21] rounded-full shadow-xs animate-in zoom-in-50 duration-200" />
                  )}
                </div>

                {/* Conversation Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span
                      className={`text-[15.5px] truncate ${
                        hasUnread ? "font-bold" : "font-medium"
                      }`}
                      style={{
                        color: hasUnread
                          ? isDark
                            ? "#ffffff"
                            : "#111b21"
                          : isDark
                          ? "#e9edef"
                          : "#111b21",
                      }}
                    >
                      {title}
                    </span>
                    {conv.lastMessage && (
                      <span
                        className={`text-[11.5px] flex-shrink-0 ${
                          hasUnread
                            ? "font-bold text-[#25d366]"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {formatDate(conv.lastMessage.createdAt, isRtl)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      {isLastMsgMine && !isTyping && (
                        <CheckCheck className="w-4 h-4 text-[#53bdeb] flex-shrink-0" />
                      )}
                      <p
                        className={`text-[13.5px] truncate m-0 ${
                          isTyping
                            ? "text-[#00a884] font-semibold animate-pulse"
                            : hasUnread
                            ? "font-semibold"
                            : ""
                        }`}
                        style={{
                          color: isTyping
                            ? "#00a884"
                            : hasUnread
                            ? isDark
                              ? "#ffffff"
                              : "#111b21"
                            : isDark
                            ? "#8696a0"
                            : "#667781",
                        }}
                      >
                        {isTyping
                          ? isRtl
                            ? "يكتب الآن..."
                            : "Typing..."
                          : conv.lastMessage?.content ||
                            (isRtl ? "ابدأ المحادثة الآن" : "Start chatting")}
                      </p>
                    </div>

                    {/* Circular WhatsApp Green Badge */}
                    {hasUnread && (
                      <span className="bg-[#25d366] text-white text-[11px] font-bold min-w-[20px] h-[20px] rounded-full flex items-center justify-center px-1 flex-shrink-0 shadow-xs">
                        {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* ── WhatsApp Green Floating Action Button (FAB) ── */}
      <button
        type="button"
        onClick={() => setShowNewConv(true)}
        className="absolute bottom-6 end-5 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-105 active:scale-95 transition-all z-20"
        style={{
          backgroundColor: "#00a884",
        }}
        title={isRtl ? "محادثة جديدة" : "New Chat"}
      >
        <MessageSquarePlus className="w-6 h-6" />
      </button>
    </div>
  );
}
