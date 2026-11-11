// Open conversation screen: header, messages, composer, call/lightbox/contact overlays.
import {
  Eye,
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
  Clock,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import { WhatsAppDoodleBg } from "./WhatsAppDoodleBg";
import { WhatsAppCallModal } from "./WhatsAppCallModal";
import { toast } from "sonner";
import { EMOJI_CATEGORIES } from "./emoji-data";
import { formatTime, formatLastSeen, TickIcon } from "./chat-helpers";
import type { TabChatState } from "./useTabChat";
import type { Conversation } from "./types";

// activeConv is passed already narrowed (non-null), as it was inside `if (activeConv)`.
export function renderConversationScreen(
  chat: TabChatState,
  activeConv: Conversation,
) {
  const {
    myEmployeeId,
    contacts,
    isRtl,
    isDark,
    showAttachments,
    setShowAttachments,
    showOptionsMenu,
    setShowOptionsMenu,
    showChatSearch,
    setShowChatSearch,
    chatSearch,
    setChatSearch,
    effectiveMyId,
    setActiveConv,
    messages,
    setMessages,
    senders,
    sending,
    input,
    setInput,
    showEmoji,
    setShowEmoji,
    emojiCategory,
    setEmojiCategory,
    typingUsers,
    typingTimeoutRef,
    onlineEmployees,
    lastSeenMap,
    activeCall,
    activeLightboxImage,
    setActiveLightboxImage,
    selectedContactInfo,
    setSelectedContactInfo,
    isRecording,
    recordingDuration,
    playingAudioId,
    audioProgress,
    cameraInputRef,
    galleryInputRef,
    docInputRef,
    waveformHeights,
    messagesEndRef,
    inputRef,
    loadConversations,
    sendMessage,
    handleFileSelect,
    handleShareLocation,
    cancelVoiceRecording,
    stopAndSendVoiceRecording,
    togglePlayAudio,
    startCall,
    handleEndCall,
    handleExportChat,
    openContactInfo,
    getParticipantName,
    getConvTitle,
    getConvPhoto,
    insertEmoji,
  } = chat;

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
        (id) => id !== effectiveMyId && onlineEmployees.has(id),
      ).length
    : 0;

  const filteredMessages = chatSearch.trim()
    ? messages.filter((m) =>
        m.content.toLowerCase().includes(chatSearch.trim().toLowerCase()),
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
                  activeConv.participantsData?.find(
                    (p) => p.id === otherParticipantId,
                  ) ||
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
                      otherParticipantId
                        ? lastSeenMap[otherParticipantId]
                        : undefined,
                      isRtl,
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
                      isRtl
                        ? "تم تفريغ المحادثة محلياً"
                        : "Chat cleared locally",
                    );
                  }}
                >
                  {isRtl ? "مسح محتوى المحادثة" : "Clear chat"}
                </button>
                <button
                  className="w-full text-start px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-[#182229] transition-colors text-red-500 flex items-center gap-2"
                  onClick={() => {
                    setActiveConv(null);
                    toast.info(isRtl ? "تم إغلاق المحادثة" : "Chat closed");
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
                    {isAdmin
                      ? "⚙️"
                      : getParticipantName(msg.senderId, activeConv)
                          .charAt(0)
                          .toUpperCase()}
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
                    const isImg =
                      msg.contentType === "image" ||
                      msg.content.startsWith("data:image/") ||
                      (msg.content.startsWith("http") &&
                        /\.(jpeg|jpg|gif|png|webp)/i.test(msg.content)) ||
                      (/^\/9j\/|^iVBORw0KGgo|^R0lGOD|^UklGR/.test(
                        msg.content,
                      ) &&
                        msg.content.length > 50);

                    if (isImg) {
                      const resolvedImgSrc =
                        msg.content.startsWith("data:") ||
                        msg.content.startsWith("http")
                          ? msg.content
                          : `data:image/jpeg;base64,${msg.content}`;

                      return (
                        <div
                          className="relative overflow-hidden rounded-xl cursor-pointer group mb-1"
                          onClick={() => setActiveLightboxImage(resolvedImgSrc)}
                        >
                          <img
                            src={resolvedImgSrc}
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
                      const ext =
                        fileName.split(".").pop()?.toUpperCase() || "FILE";

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
                                const barPercent =
                                  (wi / waveformHeights.length) * 100;
                                const played =
                                  isPlaying && barPercent <= progress;
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
                      const label =
                        parts[1] || (isRtl ? "موقع جغرافي" : "Shared Location");

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
                            <span>
                              {isRtl
                                ? "فتح في خرائط Google"
                                : "Open in Google Maps"}
                            </span>
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
                      const parts = msg.content.split(
                        new RegExp(`(${q})`, "gi"),
                      );
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
                            ),
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
                        color={
                          isRead ? "#53bdeb" : isDark ? "#8696a0" : "#667781"
                        }
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
                  {Math.floor(recordingDuration / 60)}:
                  {(recordingDuration % 60).toString().padStart(2, "0")}
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
                      : "🎙️ Voice recording simulated",
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
              <Download className="w-5 h-5" />
            </a>
            <button
              type="button"
              onClick={() => setActiveLightboxImage(null)}
              className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
              title={isRtl ? "إغلاق" : "Close"}
            >
              <X className="w-5 h-5" />
            </button>
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
                    {(selectedContactInfo.firstName || "U")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}
              </div>
              {onlineEmployees.has(selectedContactInfo.id) && (
                <span className="absolute bottom-0 end-0 w-5 h-5 bg-[#25d366] border-2 border-white dark:border-[#202c33] rounded-full shadow-md" />
              )}
            </div>

            <h3 className="text-xl font-bold mb-1">
              {selectedContactInfo.firstName}{" "}
              {selectedContactInfo.lastName || ""}
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
                <span className="text-gray-500 dark:text-gray-400">
                  {isRtl ? "القسم / الإدارة" : "Department"}
                </span>
                <span className="font-semibold">
                  {selectedContactInfo.department ||
                    (isRtl ? "قطاع الإقامة والتشغيل" : "Housing & Operations")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  {isRtl ? "رقم الموظف" : "Staff ID"}
                </span>
                <span className="font-mono font-bold">
                  #{selectedContactInfo.id}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  {isRtl ? "السكن الحالي" : "Housing"}
                </span>
                <span className="font-semibold">
                  {isRtl ? "سكن موظفي صن رايز" : "Sunrise Staff Housing"}
                </span>
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
