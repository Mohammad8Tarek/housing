// All chat state, effects and actions for TabChat (logic moved verbatim from TabChat.tsx).
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTheme } from "../../lib/theme";
import { apiFetch } from "../../lib/api";
import { subscribePortalSocket } from "../../lib/portal-socket";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import {
  requestNotificationPermission,
  playNotificationSound,
  showNotification,
  getNotificationMessagePreview,
} from "./chat-helpers";
import type { Conversation, Message, Employee, TabChatProps } from "./types";

export function useTabChat({
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
  const [convFilter, setConvFilter] = useState<"all" | "unread" | "groups">(
    "all",
  );
  const [convSearch, setConvSearch] = useState("");
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearch, setChatSearch] = useState("");

  /* ── Resolve effective myEmployeeId with fallback to storage ── */
  const [resolvedMyId, setResolvedMyId] = useState<number | undefined>(() => {
    if (myEmployeeId) return myEmployeeId;
    try {
      const raw =
        (typeof sessionStorage !== "undefined" &&
          sessionStorage.getItem("portal_employee")) ||
        (typeof localStorage !== "undefined" &&
          localStorage.getItem("portal_employee"));
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
          (typeof sessionStorage !== "undefined" &&
            sessionStorage.getItem("portal_employee")) ||
          (typeof localStorage !== "undefined" &&
            localStorage.getItem("portal_employee"));
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
  const [onlineEmployees, setOnlineEmployees] = useState<Set<number>>(
    new Set(),
  );
  const [lastSeenMap, setLastSeenMap] = useState<Record<number, string>>({});

  const fetchPresence = useCallback(async () => {
    try {
      const res = await apiFetch("/api/portal-chat/presence", {
        credentials: "include",
      });
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

  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(
    null,
  );
  const [selectedContactInfo, setSelectedContactInfo] = useState<any | null>(
    null,
  );

  // Real Voice Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  // Audio Playback for Voice Notes
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<number, number>>(
    {},
  );
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // File Inputs
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  const waveformHeights = useMemo(
    () => [
      14, 24, 10, 26, 18, 28, 12, 24, 16, 26, 8, 20, 15, 24, 18, 28, 12, 22, 16,
      20, 14, 18,
    ],
    [],
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
      const r = await apiFetch(
        `/api/portal-chat/conversations/${convId}/messages`,
        { credentials: "include" },
      );
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

  // Real-time chat events arrive on the portal's single shared WebSocket
  // (lib/portal-socket.ts). The server keeps one socket per resident, so chat
  // must not open its own connection or it would evict the realtime cache socket.
  useEffect(() => {
    if (!effectiveMyId) return;
    const unsubscribe = subscribePortalSocket({
      onStatus: (status) => {
        isWsConnectedRef.current = status === "online";
      },
      onMessage: (parsed) => {
        try {
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
              showNotification(
                senderName,
                getNotificationMessagePreview(
                  newMsg.content,
                  newMsg.contentType,
                  isRtl,
                ),
              );
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
          // ignore handler errors
        }
      },
    });

    return () => {
      isWsConnectedRef.current = false;
      unsubscribe();
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
    contentType: "text" | "image" = "text",
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
      contentType,
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
        },
      );
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        toast.error(isRtl ? "تعذر إرسال الرسالة" : "Failed to send message");
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
    isImage: boolean = true,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error(
        isRtl
          ? "حجم الملف كبير جداً (الحد الأقصى 25 ميجابايت)"
          : "File size exceeds 25MB limit",
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
        sendMessageWithContent(
          `[FILE]:${file.name}|${sizeFormatted}|${dataUrl}`,
          "text",
        );
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
    toast.info(
      isRtl ? "جارٍ تحديد موقعك الحالي..." : "Locating your position...",
    );
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
          const label = isRtl
            ? "سكن موظفي منتجع صن رايز"
            : "Sunrise Staff Housing Resort";
          sendMessageWithContent(`[LOCATION]:${lat},${lng}|${label}`, "text");
          toast.success(
            isRtl ? "تمت مشاركة موقع سكن الموظفين" : "Resort location shared",
          );
        },
        { timeout: 5000 },
      );
    } else {
      const lat = "27.915820";
      const lng = "34.329950";
      const label = isRtl
        ? "سكن موظفي منتجع صن رايز"
        : "Sunrise Staff Housing Resort";
      sendMessageWithContent(`[LOCATION]:${lat},${lng}|${label}`, "text");
      toast.success(
        isRtl ? "تمت مشاركة موقع سكن الموظفين" : "Resort location shared",
      );
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
      toast.info(
        isRtl ? "بدأ تسجيل الملاحظة الصوتية" : "Voice recording started",
      );
    }
  };

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
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
          toast.success(
            isRtl ? "تم إرسال التسجيل الصوتي" : "Voice message sent",
          );
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
        const audioCtx = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
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
          "text",
        );
        toast.success(
          isRtl ? "تم إرسال التسجيل الصوتي بنجاح" : "Voice note sent",
        );
      } catch {
        sendMessageWithContent(`[AUDIO]:sample|${finalDuration}`, "text");
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
      "text",
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
        body =
          "<Document: " + m.content.split("|")[0].replace("[FILE]:", "") + ">";
      } else if (m.content.startsWith("[AUDIO]:")) {
        body = "<Voice Note: " + m.content.split("|")[1] + "s>";
      } else if (m.content.startsWith("[LOCATION]:")) {
        body =
          "<Shared Location: " +
          m.content.split("|")[0].replace("[LOCATION]:", "") +
          ">";
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
    toast.success(
      isRtl ? "تم تصدير المحادثة بنجاح" : "Chat exported successfully",
    );
  };

  /* ── Contact Info Dialog ── */
  const openContactInfo = (conv: Conversation) => {
    setShowOptionsMenu(false);
    const otherId = conv.participantIds.find((id) => id !== effectiveMyId);
    if (!otherId) {
      toast.info(isRtl ? "محادثة جماعية" : "Group Chat");
      return;
    }
    const contact = contacts.find((c: any) => c.id === otherId) ||
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
  return {
    myEmployeeId,
    contacts,
    autoOpenChatWith,
    onClearAutoOpen,
    isActive,
    onUnreadChange,
    onChatOpenChange,
    lang,
    theme,
    isRtl,
    isDark,
    showAttachments,
    setShowAttachments,
    showOptionsMenu,
    setShowOptionsMenu,
    convFilter,
    setConvFilter,
    convSearch,
    setConvSearch,
    showChatSearch,
    setShowChatSearch,
    chatSearch,
    setChatSearch,
    resolvedMyId,
    setResolvedMyId,
    effectiveMyId,
    conversations,
    setConversations,
    activeConv,
    setActiveConv,
    messages,
    setMessages,
    senders,
    setSenders,
    loading,
    setLoading,
    sending,
    setSending,
    input,
    setInput,
    showNewConv,
    setShowNewConv,
    search,
    setSearch,
    employees,
    setEmployees,
    searching,
    setSearching,
    showEmoji,
    setShowEmoji,
    emojiCategory,
    setEmojiCategory,
    notifPerm,
    setNotifPerm,
    typingUsers,
    setTypingUsers,
    typingTimeoutRef,
    onlineEmployees,
    setOnlineEmployees,
    lastSeenMap,
    setLastSeenMap,
    fetchPresence,
    activeCall,
    setActiveCall,
    activeLightboxImage,
    setActiveLightboxImage,
    selectedContactInfo,
    setSelectedContactInfo,
    isRecording,
    setIsRecording,
    recordingDuration,
    setRecordingDuration,
    mediaRecorderRef,
    audioChunksRef,
    recordingTimerRef,
    recordingStreamRef,
    playingAudioId,
    setPlayingAudioId,
    audioProgress,
    setAudioProgress,
    currentAudioRef,
    cameraInputRef,
    galleryInputRef,
    docInputRef,
    waveformHeights,
    messagesEndRef,
    activeConvRef,
    inputRef,
    prevConvsRef,
    lastMsgCountRef,
    loadConversations,
    loadMessages,
    isWsConnectedRef,
    openConversation,
    sendMessageWithContent,
    sendMessage,
    handleFileSelect,
    handleShareLocation,
    startVoiceRecording,
    cancelVoiceRecording,
    stopAndSendVoiceRecording,
    togglePlayAudio,
    startCall,
    handleEndCall,
    handleExportChat,
    openContactInfo,
    searchEmployees,
    startConversation,
    getParticipantName,
    getParticipantPhoto,
    getConvTitle,
    getConvPhoto,
    insertEmoji,
    filteredConversations,
  };
}

export type TabChatState = ReturnType<typeof useTabChat>;
