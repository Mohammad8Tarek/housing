import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
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

  /* ── Send message ── */
  const sendMessage = async () => {
    if (!activeConv || !input.trim() || sending) return;
    const content = input.trim();
    setInput("");
    setShowEmoji(false);
    if (inputRef.current) inputRef.current.style.height = "44px";
    setSending(true);

    // Optimistic message
    const tempId = -Date.now();
    const tempMsg: Message = {
      id: tempId,
      conversationId: activeConv.id,
      senderId: effectiveMyId || 0,
      content,
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
          body: JSON.stringify({ content }),
        },
      );
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return;
      }
      const d = await res.json();
      if (d.success && d.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? d.message : m)),
        );
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
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

    const filteredMessages = chatSearch.trim()
      ? messages.filter((m) =>
          m.content.toLowerCase().includes(chatSearch.trim().toLowerCase())
        )
      : messages;

    return (
      <div
        className="flex flex-col h-[calc(100dvh-125px)] relative overflow-hidden select-none"
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
              {/* Green online dot */}
              <span className="absolute bottom-0 end-0 w-3 h-3 bg-[#25d366] border-2 border-white rounded-full"></span>
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
                ) : (
                  <span>{isRtl ? "متصل الآن" : "online"}</span>
                )}
              </div>
            </div>
          </div>

          {/* WhatsApp Header Action Icons */}
          <div className="flex items-center gap-3.5 text-white/90 pe-1">
            <button
              type="button"
              onClick={() =>
                toast.info(
                  isRtl
                    ? "مكالمة الفيديو ستتوفر في التحديث القادم"
                    : "Video call available in next update"
                )
              }
              className="hover:text-white active:scale-90 transition-transform p-1"
              title={isRtl ? "مكالمة فيديو" : "Video Call"}
            >
              <Video className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() =>
                toast.info(
                  isRtl
                    ? "المكالمة الصوتية ستتوفر في التحديث القادم"
                    : "Voice call available in next update"
                )
              }
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
                    onClick={() =>
                      toast.info(
                        isRtl
                          ? `جهة الاتصال: ${title}`
                          : `Contact info: ${title}`
                      )
                    }
                  >
                    {isRtl ? "معلومات جهة الاتصال" : "Contact info"}
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

                    {/* Content */}
                    <div
                      className="text-[14.2px] leading-relaxed break-words whitespace-pre-wrap select-text"
                      style={{
                        direction: /[\u0600-\u06FF]/.test(msg.content) ? "rtl" : "ltr",
                        textAlign: /[\u0600-\u06FF]/.test(msg.content) ? "right" : "left",
                      }}
                    >
                      {msg.content}
                    </div>

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
            className="relative z-30 p-4 mx-3 mb-2 rounded-2xl shadow-2xl border animate-in slide-in-from-bottom-3 duration-200"
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
                  toast.info(isRtl ? "تم فتح الكاميرا (محاكاة)" : "Camera opened (mock)");
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
                  toast.info(isRtl ? "تم فتح معرض الصور (محاكاة)" : "Gallery opened (mock)");
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
                  toast.info(isRtl ? "تم اختيار مستند (محاكاة)" : "Document chosen (mock)");
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
                onClick={() => {
                  setShowAttachments(false);
                  toast.info(isRtl ? "مشاركة الموقع الحالي (محاكاة)" : "Share location (mock)");
                }}
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
                  onClick={() => {
                    toast.info(isRtl ? "فتح الكاميرا لالتقاط صورة" : "Open camera to snap a photo");
                  }}
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
        </div>
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
        className="flex flex-col h-[calc(100dvh-125px)] relative overflow-hidden select-none"
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
                    <span className="absolute bottom-0 end-0 w-3 h-3 bg-[#25d366] border-2 border-white dark:border-[#111b21] rounded-full" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-semibold text-[15px] truncate"
                      style={{ color: isDark ? "#e9edef" : "#111b21" }}
                    >
                      {emp.firstName} {emp.lastName}
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
      className="flex flex-col h-[calc(100dvh-125px)] relative overflow-hidden select-none"
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
                  {/* Subtle online green dot */}
                  <span className="absolute bottom-0 end-0 w-3.5 h-3.5 bg-[#25d366] border-2 border-white dark:border-[#111b21] rounded-full shadow-xs" />
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
