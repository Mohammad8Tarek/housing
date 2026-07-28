import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "../../lib/theme";
import {
  useConversationMessages,
  useSendMessage,
  useMarkAsRead,
} from "@workspace/api-client-react";

interface ChatRoomProps {
  conversationId: number;
  title: string;
  photoUrl?: string;
  myEmployeeId: number | undefined;
  onBack: () => void;
  getContactName: (id: number) => string;
  getContactPhoto: (id: number) => string | undefined;
}

function formatTime(dateStr: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

export function ChatRoom({
  conversationId,
  title,
  photoUrl,
  myEmployeeId,
  onBack,
  getContactName,
  getContactPhoto,
}: ChatRoomProps) {
  const { lang } = useTheme();
  const isRtl = lang === "ar";

  const { data, isLoading } = useConversationMessages(conversationId);
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mark as read when entering room or when new messages arrive
  useEffect(() => {
    if (conversationId) {
      markAsRead.mutate(conversationId);
    }
  }, [conversationId, (data as any)?.messages?.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [(data as any)?.messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    sendMessage.mutate(
      { conversationId, content: input.trim() },
      {
        onSuccess: () => setInput(""),
      },
    );
  };

  const messages = (data as any)?.messages || [];

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--background))] absolute inset-0 z-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[hsl(var(--card))] border-b border-[hsl(var(--border2))] shadow-sm sticky top-0 z-10">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-[hsl(var(--card-hover))] transition-colors active:scale-95"
        >
          <svg
            className="w-6 h-6 text-[hsl(var(--foreground))]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={isRtl ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"}
            />
          </svg>
        </button>

        <div className="relative shrink-0">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={title}
              className="w-10 h-10 rounded-full object-cover border border-[hsl(var(--border2))]"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold shadow-sm">
              {title.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-[16px] text-[hsl(var(--foreground))] truncate">
            {title}
          </h2>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4 pb-[80px]"
        style={{ backgroundImage: "var(--chat-bg)", backgroundSize: "cover" }}
      >
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          messages.map((msg: any) => {
            const isMe = msg.senderId === myEmployeeId;
            // WhatsApp style layout
            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? "justify-end" : "justify-start"} mb-4`}
              >
                <div
                  className={`relative max-w-[80%] px-4 py-2 rounded-2xl shadow-sm ${
                    isMe
                      ? "bg-blue-600 text-white rounded-tr-sm"
                      : "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] rounded-tl-sm border border-[hsl(var(--border2))]"
                  }`}
                >
                  {!isMe && (
                    <div className="text-[11px] font-semibold text-blue-500 mb-1">
                      {getContactName(msg.senderId)}
                    </div>
                  )}
                  <div
                    className="text-[15px] leading-relaxed break-words"
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    {msg.content}
                  </div>
                  <div
                    className={`flex items-center justify-end gap-1 mt-1 text-[11px] ${
                      isMe ? "text-blue-100" : "text-[hsl(var(--muted2))]"
                    }`}
                  >
                    <span>{formatTime(msg.createdAt)}</span>
                    {isMe && (
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        {msg.reads && msg.reads.length > 0 ? (
                          // Double tick (read)
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M18 6L7 17l-5-5m20-2l-7.5 7.5L13 16"
                            className="text-blue-200"
                          />
                        ) : (
                          // Single tick (sent)
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        )}
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

      {/* Input Area */}
      <div className="p-3 bg-[hsl(var(--card))] border-t border-[hsl(var(--border2))] sticky bottom-0 w-full z-20 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
        <form
          onSubmit={handleSend}
          className="flex items-end gap-2 max-w-4xl mx-auto"
        >
          <div className="flex-1 relative">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height =
                  Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder={isRtl ? "اكتب رسالة..." : "Type a message..."}
              className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border2))] text-[hsl(var(--foreground))] rounded-2xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-y-auto"
              style={{ minHeight: "44px", maxHeight: "120px" }}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || sendMessage.isPending}
            className="w-11 h-11 shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            {sendMessage.isPending ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            ) : (
              <svg
                className={`w-5 h-5 ${isRtl ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
