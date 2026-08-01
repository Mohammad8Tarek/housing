import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2,
  Send,
  Search,
  ArrowLeft,
  ArrowRight,
  Plus,
  Smile,
  X,
} from "lucide-react";
import { useTheme } from "../../lib/theme";
import { apiFetch } from "../../lib/api";

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

function showNotification(title: string, body: string, icon?: string) {
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
}: TabChatProps) {
  const { lang } = useTheme();
  const isRtl = lang === "ar";

  /* ── State ── */
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [senders, setSenders] = useState<Record<number, Employee>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [showNewConv, setShowNewConv] = useState(false);
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

  useEffect(() => {
    loadConversations(false);
  }, [loadConversations]);

  // Poll every 1.5s using recursive setTimeout and visibility check
  useEffect(() => {
    let timeoutId: any;
    let isMounted = true;

    const poll = async () => {
      if (!isMounted) return;
      if (document.visibilityState === "visible") {
        await loadConversations(true);
        // If there's an active chat, poll its messages too
        if (activeConvRef.current) {
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

                // Update typing users
                if (d.typingUsers) {
                  setTypingUsers((prev) => {
                    const newSet = new Set(d.typingUsers as number[]);
                    return { ...prev, [activeConvRef.current!.id]: newSet };
                  });
                } else {
                  setTypingUsers((prev) => ({
                    ...prev,
                    [activeConvRef.current!.id]: new Set(),
                  }));
                }

                // Mark as read if there are unread messages
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
          } catch {}
        }
      }
      timeoutId = setTimeout(poll, 1500);
    };

    timeoutId = setTimeout(poll, 1500);
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [loadConversations]);

  useEffect(() => {
    activeConvRef.current = activeConv;
  }, [activeConv]);
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
      senderId: myEmployeeId || 0,
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
    if (!q.trim()) {
      setEmployees([]);
      return;
    }
    setSearching(true);
    try {
      const res = await apiFetch(
        `/api/portal-auth/employees?search=${encodeURIComponent(q.trim())}`,
        { credentials: "include" },
      );
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
          participantIds: [myEmployeeId!, emp.id],
          lastMessage: null,
          unreadCount: 0,
        };
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
  const getParticipantName = (empId: number, conv?: Conversation): string => {
    if (empId === myEmployeeId) return isRtl ? "أنا" : "Me";

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
  };

  const getParticipantPhoto = (
    empId: number,
    conv?: Conversation,
  ): string | null => {
    if (conv?.participantsData) {
      const p = conv.participantsData.find((x) => x.id === empId);
      if (p?.photoUrl) return p.photoUrl;
    }
    const c = contacts.find((cc: any) => cc.id === empId);
    if (c?.photoUrl) return c.photoUrl;
    return senders[empId]?.photoUrl || null;
  };

  const getConvTitle = (conv: Conversation): string => {
    if (conv.isGroup) return conv.subject || (isRtl ? "مجموعة" : "Group");
    const otherId = conv.participantIds.find((id) => id !== myEmployeeId);
    return otherId ? getParticipantName(otherId, conv) : conv.subject || "Chat";
  };

  const getConvPhoto = (conv: Conversation): string | null => {
    if (conv.isGroup) return null;
    const otherId = conv.participantIds.find((id) => id !== myEmployeeId);
    return otherId ? getParticipantPhoto(otherId, conv) : null;
  };

  const insertEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  /* ════════════════════════════════════════════════════════════════
     CHAT ROOM VIEW
     ════════════════════════════════════════════════════════════════ */
  if (activeConv) {
    const title = getConvTitle(activeConv);
    const photo = getConvPhoto(activeConv);
    const BackIcon = isRtl ? ArrowRight : ArrowLeft;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "calc(100dvh - 130px)",
          background: "hsl(var(--background))",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "10px 14px",
            background: "hsl(var(--card))",
            borderBottom: "0.5px solid hsl(var(--border2))",
            flexShrink: 0,
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}
        >
          <button
            onClick={() => {
              setActiveConv(null);
              setMessages([]);
              setShowEmoji(false);
              loadConversations(false);
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "50%",
              display: "flex",
              color: "hsl(var(--foreground))",
            }}
          >
            <BackIcon style={{ width: "22px", height: "22px" }} />
          </button>
          {photo ? (
            <img
              src={photo}
              alt={title}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                objectFit: "cover",
                border: "1.5px solid hsl(var(--border2))",
              }}
            />
          ) : (
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg, hsl(var(--accent2)), hsl(var(--accent2)/0.65))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: 700,
                fontSize: "17px",
                flexShrink: 0,
              }}
            >
              {title.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: "15px",
                color: "hsl(var(--foreground))",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </div>
            {typingUsers[activeConv.id]?.size > 0 && (
              <div
                style={{
                  fontSize: "12px",
                  color: "hsl(var(--accent2))",
                  fontWeight: 600,
                  animation: "pulse 1.5s infinite",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {isRtl ? "يكتب الآن..." : "Typing..."}
              </div>
            )}
          </div>
        </div>

        {/* ── Messages ── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            WebkitOverflowScrolling: "touch",
            backgroundColor: "#efeae2",
            backgroundImage:
              "url('https://w0.peakpx.com/wallpaper/508/606/HD-wallpaper-whatsapp-background-thumbnail.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundBlendMode: "overlay",
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: "hsl(var(--muted2))",
                fontSize: "13px",
                paddingTop: "50px",
              }}
            >
              {isRtl ? "لا توجد رسائل بعد" : "No messages yet"}
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.senderId === myEmployeeId;
              const isRead = (msg.reads?.length || 0) > 0;
              const isTemp = msg.id < 0;
              // Group consecutive same-sender messages
              const prevMsg = messages[idx - 1];
              const isSameSender = prevMsg && prevMsg.senderId === msg.senderId;

              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    justifyContent: isMe ? "flex-end" : "flex-start",
                    marginBottom: isSameSender ? "2px" : "6px",
                    direction: "ltr",
                  }}
                >
                  {/* Avatar for other side */}
                  {!isMe && !isSameSender && (
                    <div
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "50%",
                        background:
                          "linear-gradient(135deg, hsl(var(--accent2)), hsl(var(--accent2)/0.6))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontWeight: 700,
                        fontSize: "12px",
                        flexShrink: 0,
                        marginRight: "6px",
                        alignSelf: "flex-end",
                      }}
                    >
                      {getParticipantName(msg.senderId).charAt(0).toUpperCase()}
                    </div>
                  )}
                  {!isMe && isSameSender && (
                    <div style={{ width: "36px", flexShrink: 0 }} />
                  )}

                  <div
                    style={{
                      position: "relative",
                      maxWidth: "78%",
                      padding: "9px 13px",
                      borderRadius: isMe
                        ? "16px 16px 4px 16px"
                        : "16px 16px 16px 4px",
                      background: isMe ? "#dcf8c6" : "#ffffff",
                      color: "#000000",
                      boxShadow: "0 1px 1px rgba(0,0,0,0.1)",
                      opacity: isTemp ? 0.7 : 1,
                      transition: "opacity 0.2s ease",
                    }}
                  >
                    {/* Sender name for groups */}
                    {!isMe && activeConv.isGroup && !isSameSender && (
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "hsl(var(--accent2))",
                          marginBottom: "3px",
                        }}
                      >
                        {getParticipantName(msg.senderId)}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: "14px",
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {msg.content}
                    </div>
                    {/* Time + ticks */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: "3px",
                        marginTop: "2px",
                      }}
                    >
                      <span style={{ fontSize: "10px", opacity: 0.7 }}>
                        {formatTime(msg.createdAt)}
                      </span>
                      {isMe && !isTemp && (
                        <TickIcon
                          read={isRead}
                          color={isRead ? "#34B7F1" : "rgba(0,0,0,0.4)"}
                        />
                      )}
                      {isMe && isTemp && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="rgba(0,0,0,0.4)"
                          strokeWidth="2"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 6v6l4 2" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Emoji Picker ── */}
        {showEmoji && (
          <div
            style={{
              background: "hsl(var(--card))",
              borderTop: "0.5px solid hsl(var(--border2))",
              padding: "8px",
              flexShrink: 0,
            }}
          >
            {/* Category tabs */}
            <div
              style={{
                display: "flex",
                gap: "4px",
                marginBottom: "6px",
                overflowX: "auto",
              }}
            >
              {EMOJI_CATEGORIES.map((cat, i) => (
                <button
                  key={i}
                  onClick={() => setEmojiCategory(i)}
                  style={{
                    fontSize: "18px",
                    padding: "4px 8px",
                    borderRadius: "8px",
                    border: "none",
                    cursor: "pointer",
                    background:
                      emojiCategory === i
                        ? "hsl(var(--accent2)/0.15)"
                        : "transparent",
                    flexShrink: 0,
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            {/* Emojis grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(8, 1fr)",
                gap: "2px",
                maxHeight: "140px",
                overflowY: "auto",
              }}
            >
              {EMOJI_CATEGORIES[emojiCategory].emojis.map((e) => (
                <button
                  key={e}
                  onClick={() => insertEmoji(e)}
                  style={{
                    fontSize: "22px",
                    padding: "4px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    borderRadius: "6px",
                    lineHeight: 1.3,
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Input Area ── */}
        <div
          style={{
            padding: "8px 10px",
            paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
            background: "hsl(var(--card))",
            borderTop: "0.5px solid hsl(var(--border2))",
            flexShrink: 0,
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            style={{ display: "flex", alignItems: "flex-end", gap: "6px" }}
          >
            {/* Emoji button */}
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              style={{
                width: "40px",
                height: "40px",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: showEmoji
                  ? "hsl(var(--accent2)/0.15)"
                  : "transparent",
                border: "none",
                cursor: "pointer",
                color: showEmoji ? "hsl(var(--accent2))" : "hsl(var(--muted2))",
              }}
            >
              {showEmoji ? (
                <X style={{ width: "20px", height: "20px" }} />
              ) : (
                <Smile style={{ width: "20px", height: "20px" }} />
              )}
            </button>

            {/* Text input */}
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height =
                  Math.min(e.target.scrollHeight, 100) + "px";

                // Trigger typing event (debounced 1s)
                if (!typingTimeoutRef.current[activeConv.id]) {
                  apiFetch(
                    `/api/portal-chat/conversations/${activeConv.id}/typing`,
                    { method: "POST", credentials: "include" },
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
              style={{
                flex: 1,
                background: "hsl(var(--surface))",
                border: "1px solid hsl(var(--border2))",
                borderRadius: "22px",
                padding: "10px 16px",
                fontSize: "14px",
                color: "hsl(var(--foreground))",
                outline: "none",
                resize: "none",
                minHeight: "42px",
                maxHeight: "100px",
                lineHeight: 1.4,
                direction: isRtl ? "rtl" : "ltr",
                fontFamily: "inherit",
              }}
            />

            {/* Send button */}
            <button
              type="submit"
              disabled={!input.trim() || sending}
              style={{
                width: "42px",
                height: "42px",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: input.trim()
                  ? "hsl(var(--accent2))"
                  : "hsl(var(--border2))",
                color: input.trim() ? "white" : "hsl(var(--muted2))",
                border: "none",
                cursor: input.trim() ? "pointer" : "default",
                transition: "background 0.2s ease, transform 0.1s ease",
              }}
            >
              {sending ? (
                <Loader2
                  style={{
                    width: "18px",
                    height: "18px",
                    animation: "spin 1s linear infinite",
                  }}
                />
              ) : (
                <Send
                  style={{
                    width: "18px",
                    height: "18px",
                    marginInlineStart: "2px",
                  }}
                />
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════
     NEW CHAT VIEW
     ════════════════════════════════════════════════════════════════ */
  if (showNewConv) {
    const BackIcon = isRtl ? ArrowRight : ArrowLeft;
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "calc(100dvh - 130px)",
          background: "hsl(var(--background))",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px 14px",
            background: "hsl(var(--card))",
            borderBottom: "0.5px solid hsl(var(--border2))",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => {
              setShowNewConv(false);
              setSearch("");
              setEmployees([]);
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "50%",
              display: "flex",
              color: "hsl(var(--foreground))",
            }}
          >
            <BackIcon style={{ width: "22px", height: "22px" }} />
          </button>
          <div
            style={{
              fontWeight: 700,
              fontSize: "16px",
              color: "hsl(var(--foreground))",
            }}
          >
            {isRtl ? "محادثة جديدة" : "New Chat"}
          </div>
        </div>

        <div style={{ padding: "12px 14px" }}>
          <div style={{ position: "relative" }}>
            <Search
              style={{
                position: "absolute",
                top: "50%",
                transform: "translateY(-50%)",
                ...(isRtl ? { right: "12px" } : { left: "12px" }),
                width: "18px",
                height: "18px",
                color: "hsl(var(--muted2))",
              }}
            />
            <input
              autoFocus
              value={search}
              onChange={(e) => searchEmployees(e.target.value)}
              placeholder={
                isRtl ? "ابحث عن زميل..." : "Search for a colleague..."
              }
              style={{
                width: "100%",
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border2))",
                borderRadius: "12px",
                padding: "12px 16px",
                paddingInlineStart: "40px",
                fontSize: "14px",
                color: "hsl(var(--foreground))",
                outline: "none",
                direction: isRtl ? "rtl" : "ltr",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 16px" }}>
          {searching ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "30px 0",
              }}
            >
              <Loader2
                style={{
                  width: "24px",
                  height: "24px",
                  color: "hsl(var(--accent2))",
                  animation: "spin 1s linear infinite",
                }}
              />
            </div>
          ) : employees.filter((e) => e.id !== myEmployeeId).length > 0 ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
              {employees
                .filter((e) => e.id !== myEmployeeId)
                .map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => startConversation(emp)}
                    disabled={sending}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px",
                      borderRadius: "12px",
                      background: "hsl(var(--card))",
                      border: "0.5px solid hsl(var(--border2))",
                      cursor: "pointer",
                      textAlign: isRtl ? "right" : "left",
                      direction: isRtl ? "rtl" : "ltr",
                    }}
                  >
                    {emp.photoUrl ? (
                      <img
                        src={emp.photoUrl}
                        alt=""
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          background:
                            "linear-gradient(135deg, hsl(var(--accent2)), hsl(var(--accent2)/0.65))",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontWeight: 700,
                          fontSize: "14px",
                          flexShrink: 0,
                        }}
                      >
                        {emp.firstName[0]}
                        {emp.lastName[0]}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "14px",
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        {emp.firstName} {emp.lastName}
                      </div>
                      {(emp.jobTitle || emp.department) && (
                        <div
                          style={{
                            fontSize: "12px",
                            color: "hsl(var(--muted2))",
                            marginTop: "2px",
                          }}
                        >
                          {emp.jobTitle || emp.department}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "30px 0",
                color: "hsl(var(--muted2))",
                fontSize: "13px",
              }}
            >
              {search.trim()
                ? isRtl
                  ? "لم يتم العثور على أحد"
                  : "No results found"
                : isRtl
                  ? "اكتب اسم الزميل للبحث"
                  : "Type a name to search"}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════
     CONVERSATION LIST VIEW
     ════════════════════════════════════════════════════════════════ */
  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100dvh - 130px)",
        background: "hsl(var(--background))",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 16px 10px",
          background: "hsl(var(--card))",
          borderBottom: "0.5px solid hsl(var(--border2))",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "hsl(var(--foreground))",
              fontFamily: "'Playfair Display', serif",
              margin: 0,
            }}
          >
            {isRtl ? "المحادثات" : "Chats"}
            {totalUnread > 0 && (
              <span
                style={{
                  marginInlineStart: "8px",
                  fontSize: "12px",
                  fontFamily: "inherit",
                  background: "hsl(var(--accent2))",
                  color: "white",
                  borderRadius: "10px",
                  padding: "2px 8px",
                  verticalAlign: "middle",
                }}
              >
                {totalUnread}
              </span>
            )}
          </h1>
          {/* Notification permission button */}
          {notifPerm === "default" && (
            <button
              onClick={() =>
                Notification.requestPermission().then((p) => setNotifPerm(p))
              }
              style={{
                fontSize: "11px",
                padding: "4px 10px",
                borderRadius: "10px",
                background: "hsl(var(--accent2)/0.1)",
                color: "hsl(var(--accent2))",
                border: "1px solid hsl(var(--accent2)/0.3)",
                cursor: "pointer",
              }}
            >
              {isRtl ? "🔔 تفعيل الإشعارات" : "🔔 Enable notifications"}
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "80px",
        }}
      >
        {loading ? (
          <div
            style={{
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px",
                }}
              >
                <div
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "50%",
                    background: "hsl(var(--border2))",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      height: "14px",
                      width: "55%",
                      background: "hsl(var(--border2))",
                      borderRadius: "6px",
                      marginBottom: "8px",
                    }}
                  />
                  <div
                    style={{
                      height: "12px",
                      width: "80%",
                      background: "hsl(var(--border2))",
                      borderRadius: "6px",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "60px 20px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "hsl(var(--accent2)/0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="hsl(var(--accent2))"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.6 }}
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p
              style={{
                fontWeight: 600,
                fontSize: "15px",
                color: "hsl(var(--foreground))",
                margin: "0 0 4px",
              }}
            >
              {isRtl ? "لا توجد محادثات" : "No conversations"}
            </p>
            <p
              style={{
                fontSize: "13px",
                color: "hsl(var(--muted2))",
                margin: 0,
              }}
            >
              {isRtl ? "اضغط + لبدء محادثة" : "Tap + to start chatting"}
            </p>
          </div>
        ) : (
          conversations.map((conv) => {
            const title = getConvTitle(conv);
            const photo = getConvPhoto(conv);
            return (
              <button
                key={conv.id}
                onClick={() => openConversation(conv)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "13px 16px",
                  background: "none",
                  border: "none",
                  borderBottom: "0.5px solid hsl(var(--border2)/0.5)",
                  cursor: "pointer",
                  textAlign: isRtl ? "right" : "left",
                  direction: isRtl ? "rtl" : "ltr",
                }}
              >
                {/* Avatar */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  {photo ? (
                    <img
                      src={photo}
                      alt={title}
                      style={{
                        width: "52px",
                        height: "52px",
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "1.5px solid hsl(var(--border2))",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "52px",
                        height: "52px",
                        borderRadius: "50%",
                        background:
                          "linear-gradient(135deg, hsl(var(--accent2)), hsl(var(--accent2)/0.65))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontWeight: 700,
                        fontSize: "18px",
                      }}
                    >
                      {title.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {conv.unreadCount > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "-2px",
                        ...(isRtl ? { left: "-2px" } : { right: "-2px" }),
                        minWidth: "20px",
                        height: "20px",
                        borderRadius: "10px",
                        background: "hsl(var(--accent2))",
                        color: "white",
                        fontSize: "10px",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 4px",
                        border: "2px solid hsl(var(--background))",
                      }}
                    >
                      {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      marginBottom: "3px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: conv.unreadCount > 0 ? 700 : 600,
                        fontSize: "15px",
                        color: "hsl(var(--foreground))",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                    >
                      {title}
                    </span>
                    {conv.lastMessage && (
                      <span
                        style={{
                          fontSize: "11px",
                          color:
                            conv.unreadCount > 0
                              ? "hsl(var(--accent2))"
                              : "hsl(var(--muted2))",
                          flexShrink: 0,
                          marginInlineStart: "8px",
                        }}
                      >
                        {formatDate(conv.lastMessage.createdAt, isRtl)}
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: "13px",
                      color:
                        typingUsers[conv.id]?.size > 0
                          ? "hsl(var(--accent2))"
                          : conv.unreadCount > 0
                            ? "hsl(var(--foreground))"
                            : "hsl(var(--muted2))",
                      fontWeight:
                        conv.unreadCount > 0 || typingUsers[conv.id]?.size > 0
                          ? 600
                          : 400,
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {typingUsers[conv.id]?.size > 0
                      ? isRtl
                        ? "يكتب الآن..."
                        : "Typing..."
                      : conv.lastMessage?.content ||
                        (isRtl ? "ابدأ المحادثة" : "Start the conversation")}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowNewConv(true)}
        style={{
          position: "absolute",
          bottom: "24px",
          ...(isRtl ? { left: "20px" } : { right: "20px" }),
          width: "56px",
          height: "56px",
          borderRadius: "16px",
          background: "hsl(var(--accent2))",
          color: "white",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        }}
      >
        <Plus style={{ width: "24px", height: "24px" }} />
      </button>
    </div>
  );
}
