import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Send, Search, Paperclip, Smile } from "lucide-react";
import { useTheme } from "../lib/theme";
import { apiFetch } from "../lib/api";
import MaterialIcon from "./MaterialIcon";

export function buildPortalEmployeeSearchUrl(search: string): string {
  return `/api/portal-auth/employees?search=${encodeURIComponent(search.trim())}`;
}

interface Employee {
  id: number;
  employeeId: string;
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
  lastMessage: { content: string; createdAt: string } | null;
  unreadCount: number;
  participantIds: number[];
  participantsData?: Employee[];
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

export default function TabChat() {
  const { lang } = useTheme();
  const isRtl = lang === "ar";
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [senders, setSenders] = useState<Record<number, Employee>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [myId, setMyId] = useState<number | null>(null);
  const [msgSearch, setMsgSearch] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const EMOJIS = [
    "😀",
    "😂",
    "🤣",
    "😊",
    "😍",
    "🥰",
    "😘",
    "😜",
    "😎",
    "🤩",
    "😢",
    "😭",
    "😡",
    "👍",
    "👎",
    "🙏",
    "👏",
    "🤝",
    "🔥",
    "✨",
    "💯",
    "🎉",
    "❤️",
    "💔",
  ];
  const [input, setInput] = useState("");
  const [showNewConv, setShowNewConv] = useState(false);
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [firstMsg, setFirstMsg] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const activeConvRef = useRef<Conversation | null>(null);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/portal-chat/conversations", {
        credentials: "include",
      });
      if (!res.ok) return;
      const d = await res.json();
      if (d.success) setConversations(d.conversations || []);
    } catch {
      // ignore failures
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
    
    // Fetch my ID
    apiFetch("/api/portal-auth/me", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.employee) {
          setMyId(data.employee.id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    activeConvRef.current = activeConv;
  }, [activeConv]);

  useEffect(() => {
    if (!showNewConv) {
      setSearch("");
      setEmployees([]);
      setSelectedEmp(null);
      setFirstMsg("");
    }
  }, [showNewConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const wsUrl = `wss://sunrise-api-production-2410.up.railway.app/ws`;

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          setStatusMessage(
            isRtl ? "متصل الآن بآخر التحديثات" : "Connected to live updates",
          );
          attemptsRef.current = 0;
          if (reconnectRef.current) {
            window.clearTimeout(reconnectRef.current);
            reconnectRef.current = null;
          }
        };

        ws.onmessage = ({ data }) => {
          try {
            const msg = JSON.parse(data as string);
            if (msg.type === "data_updated" && msg.module === "chat") {
              
              if (msg.action === "read_receipt") {
                const conversationId = Number(msg.data?.conversationId);
                const readerId = Number(msg.data?.readerId);
                if (conversationId && readerId) {
                  // Update reads in messages
                  if (activeConvRef.current?.id === conversationId) {
                    setMessages((prev) =>
                      prev.map((m) => {
                        if (m.senderId !== readerId) {
                          const currentReads = m.reads || [];
                          if (!currentReads.some((r) => r.employeeId === readerId)) {
                            return {
                              ...m,
                              reads: [
                                ...currentReads,
                                { employeeId: readerId, readAt: new Date().toISOString() },
                              ],
                            };
                          }
                        }
                        return m;
                      })
                    );
                  }
                  // Optionally update the conversation list last message reads
                  setConversations((prev) =>
                    prev.map((conv) => {
                      if (conv.id === conversationId && conv.lastMessage?.senderId !== readerId) {
                        const lm = conv.lastMessage as any;
                        const lmReads = lm.reads || [];
                        if (!lmReads.some((r: any) => r.employeeId === readerId)) {
                          return {
                            ...conv,
                            lastMessage: {
                              ...lm,
                              reads: [
                                ...lmReads,
                                { employeeId: readerId, readAt: new Date().toISOString() },
                              ],
                            },
                          };
                        }
                      }
                      return conv;
                    })
                  );
                }
              }
              
              if (msg.action === "new_message") {
                const conversationId = Number(msg.data?.conversationId);
                const message = msg.data?.message as Message | undefined;
                if (!conversationId || !message) return;

                setConversations((prev) =>
                  prev.map((conv) => {
                    if (conv.id !== conversationId) return conv;
                    return {
                      ...conv,
                      lastMessage: message,
                      unreadCount:
                        activeConvRef.current?.id === conversationId
                          ? 0
                          : (conv.unreadCount || 0) + 1,
                    };
                  }),
                );

                if (activeConvRef.current?.id === conversationId) {
                  setMessages((prev) =>
                    prev.some((m) => m.id === message.id)
                      ? prev
                      : [...prev, message],
                  );
                  setConversations((prev) =>
                    prev.map((conv) =>
                      conv.id === conversationId
                        ? { ...conv, unreadCount: 0 }
                        : conv,
                    ),
                  );
                  // Since we are looking at this conversation, immediately mark as read
                  apiFetch(`/api/portal-chat/conversations/${conversationId}/read`, { method: "PUT" }).catch(() => {});
                }
              }
            }
          } catch {
            // ignore malformed WS messages
          }
        };

        ws.onclose = (ev) => {
          setIsConnected(false);
          setStatusMessage(
            isRtl
              ? "تم فقد الاتصال. جاري إعادة المحاولة..."
              : "Connection lost. Reconnecting...",
          );
          wsRef.current = null;
          if (ev.code === 1008) return;
          attemptsRef.current += 1;
          const delay = Math.min(3000 * 2 ** (attemptsRef.current - 1), 30000);
          reconnectRef.current = window.setTimeout(connect, delay);
        };

        ws.onerror = () => {
          setIsConnected(false);
          setStatusMessage(
            isRtl
              ? "تعذر الاتصال بالخادم. حاول لاحقًا."
              : "Unable to reach the server. Please try again later.",
          );
        };
      } catch {
        attemptsRef.current += 1;
        const delay = Math.min(3000 * 2 ** (attemptsRef.current - 1), 30000);
        reconnectRef.current = window.setTimeout(connect, delay);
      }
    };

    connect();

    return () => {
      if (reconnectRef.current) {
        window.clearTimeout(reconnectRef.current);
      }
      wsRef.current?.close(1000, "Component unmounted");
    };
  }, []);

  const openConversation = async (conv: Conversation) => {
    setActiveConv(conv);
    setMessages([]);
    try {
      const r = await apiFetch(
        `/api/portal-chat/conversations/${conv.id}/messages`,
        { credentials: "include" },
      );
      if (!r.ok) {
        setStatusMessage(
          isRtl
            ? "تعذر تحميل الرسائل حالياً."
            : "Messages could not be loaded right now.",
        );
        return;
      }
      const d = await r.json();
      if (d.success) {
        setMessages(Array.isArray(d.messages) ? d.messages : []);
        setSenders(d.senders || {});
      }
      void apiFetch(`/api/portal-chat/conversations/${conv.id}/read`, {
        method: "PUT",
        credentials: "include",
      }).catch(() => {});
    } catch {
      setStatusMessage(
        isRtl
          ? "تعذر تحميل الرسائل حالياً."
          : "Messages could not be loaded right now.",
      );
    }
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c)),
    );
  };

  const sendMessage = async () => {
    if (!activeConv || !input.trim()) return;
    const content = input.trim();
    setSending(true);
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
        setStatusMessage(
          isRtl
            ? "لم يتم إرسال الرسالة. حاول مرة أخرى."
            : "Message was not sent. Please try again.",
        );
        return;
      }
      const d = await res.json();
      if (d.success) {
        setMessages((prev) => [...prev, d.message]);
        setInput("");
        setStatusMessage(null);
      }
    } catch {
      setStatusMessage(
        isRtl
          ? "لم يتم إرسال الرسالة. حاول مرة أخرى."
          : "Message was not sent. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  const searchEmployees = async (q: string) => {
    setSearch(q);
    const term = q.trim();
    if (!term) {
      setEmployees([]);
      return;
    }

    setSearching(true);
    try {
      const res = await apiFetch(buildPortalEmployeeSearchUrl(term), {
        credentials: "include",
      });
      if (!res.ok) {
        setEmployees([]);
        return;
      }
      const d = await res.json();
      if (d.success) {
        setEmployees(d.employees || []);
      } else {
        setEmployees([]);
      }
    } catch {
      setEmployees([]);
    } finally {
      setSearching(false);
    }
  };

  const startConversation = async () => {
    if (!selectedEmp || !firstMsg.trim()) return;
    const content = firstMsg.trim();
    setSending(true);
    try {
      const res = await apiFetch("/api/portal-chat/conversations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantIds: [selectedEmp.id],
          subject: content.slice(0, 50),
        }),
      });
      if (!res.ok) return;
      const d = await res.json();
      if (d.success) {
        setConversations((prev) => [d.conversation, ...prev]);
        setShowNewConv(false);

        const messageRes = await apiFetch(
          `/api/portal-chat/conversations/${d.conversation.id}/messages`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          },
        );

        if (messageRes.ok) {
          const messageData = await messageRes.json().catch(() => null);
          if (messageData?.success) {
            await openConversation(d.conversation);
            return;
          }
        }

        await openConversation(d.conversation);
      }
    } catch {
      // keep the flow usable when the create-message call fails
    } finally {
      setSending(false);
    }
  };

  const viewTitle = activeConv?.subject || (isRtl ? "محادثة" : "Conversation");
  const otherParticipants = (conv: Conversation) =>
    conv.isGroup
      ? `${conv.participantIds?.length || 0} members`
      : isRtl
        ? "محادثة خاصة"
        : "Direct chat";

  if (activeConv) {
    return (
      <div className="flex flex-col h-[calc(100dvh-200px)] bg-[#EFEAE2] dark:bg-[#0B141A]">
        {/* Header */}
        <div className="px-4 py-3 flex items-center gap-3 bg-white dark:bg-[#202C33] border-b border-gray-200 dark:border-gray-800 shadow-sm z-10">
          <button
            onClick={() => {
              setActiveConv(null);
              setMessages([]);
            }}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
          >
            <MaterialIcon icon="arrow_back" size={24} />
          </button>
          
          <div className="flex-1 min-w-0">
            <span className="text-[16px] font-semibold text-gray-900 dark:text-gray-100 truncate block">
              {viewTitle}
            </span>
            <span className="text-[12px] text-gray-500 truncate block">
              {otherParticipants(activeConv)}
            </span>
          </div>
        </div>

        {statusMessage && (
          <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 text-center z-10 shadow-sm">
            {statusMessage}
          </div>
        )}

        {/* Messages Area */}
        <div 
          className="flex-1 overflow-y-auto p-4 space-y-2 relative"
          style={{ 
            backgroundImage: "url('https://web.whatsapp.com/img/bg-chat-tile-dark_a4be512e7195b6b733d9110b408f075d.png')",
            backgroundSize: "400px",
            backgroundRepeat: "repeat",
            opacity: 0.8
          }}
        >
          {messages.length === 0 ? (
            <div className="flex justify-center my-4">
              <div className="bg-[#FFEECD] dark:bg-[#182229] text-gray-700 dark:text-gray-300 text-[12px] px-4 py-2 rounded-lg shadow-sm">
                {isRtl ? "رسائلك ومكالماتك مشفرة تماماً." : "Messages and calls are end-to-end encrypted."}
              </div>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.senderId === myId;
              const sender = senders[msg.senderId];
              const isRead = msg.reads && msg.reads.length > 0;
              
              // Determine if we should show the tail
              const prevMsg = index > 0 ? messages[index - 1] : null;
              const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;
              const isFirstInGroup = !prevMsg || prevMsg.senderId !== msg.senderId;
              const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId;

              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"} ${isFirstInGroup ? "mt-3" : "mt-0.5"}`}
                >
                  <div
                    className={`relative max-w-[85%] px-3 py-1.5 shadow-sm ${
                      isMe
                        ? "bg-[#D9FDD3] dark:bg-[#005C4B] text-gray-900 dark:text-gray-100"
                        : "bg-white dark:bg-[#202C33] text-gray-900 dark:text-gray-100"
                    } ${
                      isMe
                        ? isFirstInGroup ? "rounded-l-xl rounded-br-xl rounded-tr-sm" : "rounded-xl"
                        : isFirstInGroup ? "rounded-r-xl rounded-bl-xl rounded-tl-sm" : "rounded-xl"
                    }`}
                  >
                    {/* Tail SVG for first message in group */}
                    {isFirstInGroup && (
                      <span className={`absolute top-0 w-2 h-3 ${isMe ? "-right-2 text-[#D9FDD3] dark:text-[#005C4B]" : "-left-2 text-white dark:text-[#202C33]"}`}>
                        <svg viewBox="0 0 8 13" width="8" height="13" fill="currentColor">
                          {isMe ? (
                            <path opacity="0.13" d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" />
                          ) : (
                            <path opacity="0.13" d="M1.533 3.568 8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z" />
                          )}
                          {isMe ? (
                            <path d="M5.188 0H0v11.193l6.467-8.625C7.526 1.156 6.958 0 5.188 0z" />
                          ) : (
                            <path d="M1.533 2.568 8 11.193V0H2.812C1.042 0 .474 1.156 1.533 2.568z" />
                          )}
                        </svg>
                      </span>
                    )}

                    {!isMe && sender && isFirstInGroup && (
                      <div className="text-[12px] font-semibold text-[#029688] dark:text-[#53BDEB] mb-0.5">
                        {sender.firstName} {sender.lastName}
                      </div>
                    )}
                    
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="text-[14px] leading-relaxed whitespace-pre-wrap break-words pb-1">
                        {msg.content}
                      </div>
                      <div
                        className={`flex items-center gap-1 text-[11px] ml-auto shrink-0 mb-0.5 ${
                          isMe ? "text-gray-500 dark:text-gray-400" : "text-gray-500"
                        }`}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {isMe && (
                          <span className={`${isRead ? "text-[#53BDEB]" : "text-gray-400"}`}>
                            {isRead ? (
                              <svg viewBox="0 0 16 11" width="16" height="11" fill="currentColor">
                                <path d="M11.8 1.4L10.4 0L5.3 5.1L6.7 6.5L11.8 1.4ZM15.4 0L6.7 8.7L2.6 4.6L1.2 6L6.7 11.5L16.8 1.4L15.4 0ZM0 8.5L1.4 9.9L4.9 6.4L3.5 5L0 8.5Z" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 11 11" width="11" height="11" fill="currentColor">
                                <path d="M9.8 0L3.7 6.1L1.2 3.6L0 4.8L3.7 8.5L11 1.2L9.8 0Z" />
                              </svg>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-3 border-t border-border2 bg-surface relative">
          {showEmojis && (
            <div className="absolute bottom-full left-4 mb-2 bg-card border border-border2 shadow-lg rounded-2xl p-2 w-64 max-h-48 overflow-y-auto grid grid-cols-6 gap-2">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="text-xl hover:bg-surface rounded p-1 transition-colors"
                  onClick={() => {
                    setInput((prev) => prev + emoji);
                    setShowEmojis(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1 bg-card border border-border2 rounded-3xl flex items-center px-2 py-1 shadow-sm">
              <button
                type="button"
                onClick={() => setShowEmojis(!showEmojis)}
                className={`p-2 transition-colors ${showEmojis ? "text-accent2" : "text-muted2 hover:text-foreground"}`}
                title="Emojis"
              >
                <Smile className="w-5 h-5" />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
                placeholder={isRtl ? "اكتب رسالة..." : "Type a message..."}
                className="w-full bg-transparent py-2 px-2 text-[13px] outline-none placeholder:text-muted2"
              />
              <label
                className="p-2 text-muted2 hover:text-foreground transition-colors cursor-pointer"
                title="Attach Image"
              >
                <Paperclip className="w-5 h-5" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                      const url = ev.target?.result as string;
                      setSending(true);
                      try {
                        await apiFetch(
                          `/api/portal-chat/conversations/${activeConv.id}/messages`,
                          {
                            method: "POST",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              content: url,
                              contentType: "image",
                            }),
                          },
                        );
                      } finally {
                        setSending(false);
                      }
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
            </div>
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full bg-accent2 text-accent2-foreground shadow-sm disabled:opacity-50 hover:scale-105 transition-transform"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5 ms-0.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-200px)]">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-border2">
        <h2
          className="text-xl font-bold text-foreground flex items-center gap-2"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          <MaterialIcon icon="chat" size={24} className="text-accent2" />
          {isRtl ? "المحادثات" : "Chat"}
        </h2>
        <button
          onClick={() => setShowNewConv(!showNewConv)}
          className={`p-2 rounded-xl transition-all ${
            showNewConv
              ? "bg-accent2 text-accent2-foreground shadow-md"
              : "bg-surface hover:bg-card border border-border2 text-foreground"
          }`}
          title={isRtl ? "محادثة جديدة" : "New Conversation"}
        >
          <MaterialIcon
            icon={showNewConv ? "close" : "add_comment"}
            size={20}
          />
        </button>
      </div>

      {showNewConv && (
        <div className="p-4 border-b border-border2 bg-card space-y-3">
          <h3 className="text-[12px] font-bold text-foreground">
            {isRtl ? "محادثة جديدة" : "New Conversation"}
          </h3>
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted2" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => searchEmployees(e.target.value)}
              placeholder={
                isRtl
                  ? "ابحث عن زميل..."
                  : "Search colleague by name or department..."
              }
              className="w-full bg-surface border border-border2 rounded-xl py-2.5 ps-9 pe-3 text-[12px] outline-none focus:border-accent2/50"
            />
          </div>
          {search && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {searching ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 text-accent2 animate-spin" />
                </div>
              ) : employees.length === 0 ? (
                <p className="text-[11px] text-muted2 text-center py-2">
                  {isRtl ? "لا توجد نتائج" : "No results"}
                </p>
              ) : (
                employees.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => {
                      setSelectedEmp(emp);
                      setSearch("");
                      setEmployees([]);
                    }}
                    className={`w-full text-left flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                      selectedEmp?.id === emp.id
                        ? "bg-accent2/10 border border-accent2/30"
                        : "hover:bg-surface"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent2/10 flex items-center justify-center text-[11px] font-bold text-accent2 flex-shrink-0">
                      {emp.firstName[0]}
                      {emp.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-foreground">
                        {emp.firstName} {emp.lastName}
                      </div>
                      <div className="text-[10px] text-muted2">
                        {emp.jobTitle || emp.department || ""}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
          {selectedEmp && (
            <div className="flex items-center gap-2 p-2 bg-accent2/5 rounded-xl">
              <span className="text-[11px] font-bold text-accent2 flex-1">
                {selectedEmp.firstName} {selectedEmp.lastName}
              </span>
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={firstMsg}
              onChange={(e) => setFirstMsg(e.target.value)}
              placeholder={
                isRtl ? "اكتب أول رسالة..." : "Write your first message..."
              }
              className="flex-1 bg-surface border border-border2 rounded-xl py-2 px-3 text-[12px] outline-none focus:border-accent2/50"
            />
            <button
              onClick={startConversation}
              disabled={sending || !selectedEmp || !firstMsg.trim()}
              className="p-2 rounded-xl bg-accent2 text-accent2-foreground disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MaterialIcon icon="send" size={16} />
              )}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-accent2 animate-spin" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MaterialIcon
                icon="chat"
                size={28}
                className="text-muted2 opacity-40"
              />
            </div>
            <p className="text-[14px] font-bold text-foreground">
              {isRtl ? "لا توجد محادثات" : "No conversations"}
            </p>
            <p className="text-[12px] text-muted2 mt-1">
              {isRtl
                ? "ابدأ محادثة مع زملائك"
                : "Tap the edit icon to start a conversation with a colleague"}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto bg-white dark:bg-[#111B21] divide-y divide-gray-100 dark:divide-gray-800">
          {conversations.map((conv) => {
            const isGroup = conv.isGroup;
            let title = conv.subject || (isRtl ? "محادثة" : "Conversation");
            let avatarUrl = "";
            let initials = "";
            
            if (!isGroup && conv.participantsData && conv.participantsData.length > 0) {
              const otherUser = conv.participantsData.find(p => p.id !== myId) || conv.participantsData[0];
              if (otherUser) {
                title = `${otherUser.firstName} ${otherUser.lastName}`;
                avatarUrl = otherUser.photoUrl || "";
                initials = `${otherUser.firstName[0]}${otherUser.lastName[0]}`;
              }
            } else if (isGroup) {
              initials = "G";
            }

            const lastMsg = conv.lastMessage as any;
            const isLastMsgMine = lastMsg && lastMsg.senderId === myId;
            const isRead = lastMsg && lastMsg.reads && lastMsg.reads.length > 0;

            return (
              <button
                key={conv.id}
                onClick={() => openConversation(conv)}
                className="w-full text-left bg-transparent p-3 hover:bg-gray-50 dark:hover:bg-[#202C33] transition-colors flex items-center gap-3"
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center relative">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400 font-semibold text-lg uppercase">
                      {initials || <MaterialIcon icon={isGroup ? "group" : "person"} size={24} />}
                    </span>
                  )}
                  {conv.unreadCount > 0 && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#25D366] rounded-full border-2 border-white dark:border-[#111B21] flex items-center justify-center text-[10px] text-white font-bold">
                      {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                    </div>
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0 py-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[16px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {title}
                    </span>
                    {lastMsg && (
                      <span className={`text-[12px] whitespace-nowrap ml-2 ${conv.unreadCount > 0 ? "text-[#25D366] font-medium" : "text-gray-500 dark:text-gray-400"}`}>
                        {new Date(lastMsg.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 text-[13px] text-gray-500 dark:text-gray-400">
                    {isLastMsgMine && lastMsg && (
                      <span className={`${isRead ? "text-[#53BDEB]" : "text-gray-400"}`}>
                        {isRead ? (
                          <svg viewBox="0 0 16 11" width="16" height="11" fill="currentColor">
                            <path d="M11.8 1.4L10.4 0L5.3 5.1L6.7 6.5L11.8 1.4ZM15.4 0L6.7 8.7L2.6 4.6L1.2 6L6.7 11.5L16.8 1.4L15.4 0ZM0 8.5L1.4 9.9L4.9 6.4L3.5 5L0 8.5Z" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 11 11" width="11" height="11" fill="currentColor">
                            <path d="M9.8 0L3.7 6.1L1.2 3.6L0 4.8L3.7 8.5L11 1.2L9.8 0Z" />
                          </svg>
                        )}
                      </span>
                    )}
                    <span className="truncate">
                      {lastMsg ? lastMsg.content : otherParticipants(conv)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
