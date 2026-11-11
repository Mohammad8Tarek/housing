// Conversation list screen: header, search, filter pills, conversations, new-chat FAB.
import {
  Search,
  X,
  MoreVertical,
  Camera,
  MessageSquarePlus,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, renderLastMessagePreview } from "./chat-helpers";
import type { TabChatState } from "./useTabChat";

export function renderConversationListScreen(chat: TabChatState) {
  const {
    myEmployeeId,
    isRtl,
    isDark,
    convFilter,
    setConvFilter,
    convSearch,
    setConvSearch,
    effectiveMyId,
    conversations,
    loading,
    setShowNewConv,
    typingUsers,
    onlineEmployees,
    openConversation,
    getConvTitle,
    getConvPhoto,
    filteredConversations,
  } = chat;

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
                  : "Chat settings: Privacy & notifications active",
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
                      <div
                        className={`text-[13.5px] truncate m-0 flex items-center min-w-0 ${
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
                          : renderLastMessagePreview(
                              conv.lastMessage,
                              isRtl,
                              isDark,
                              hasUnread,
                            )}
                      </div>
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
