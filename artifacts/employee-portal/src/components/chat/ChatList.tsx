import React from "react";
import { useTheme } from "../../lib/theme";
import { Camera, Mic, FileText, MapPin, Phone } from "lucide-react";

export interface ConversationItem {
  id: number;
  subject: string | null;
  isGroup: boolean;
  unreadCount: number;
  participantIds: number[];
  lastMessage: {
    content: string;
    createdAt: string;
    senderId: number;
    contentType?: string;
  } | null;
}

interface ChatListProps {
  conversations: ConversationItem[];
  isLoading: boolean;
  onSelect: (convId: number) => void;
  myEmployeeId: number | undefined;
  getContactName: (id: number) => string;
  getContactPhoto: (id: number) => string | undefined;
}

function timeAgo(dateStr: string, isRtl: boolean) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isRtl ? "الآن" : "Just now";
  if (mins < 60) return isRtl ? `منذ ${mins} د` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isRtl ? `منذ ${hrs} س` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return isRtl ? `منذ ${days} ي` : `${days}d ago`;
}

function renderChatListLastMessage(
  lastMsg: { content: string; contentType?: string } | null | undefined,
  isRtl: boolean
) {
  if (!lastMsg || !lastMsg.content) {
    return isRtl ? "بدأت المحادثة" : "Conversation started";
  }

  const content = lastMsg.content;
  const contentType = lastMsg.contentType;

  if (
    contentType === "image" ||
    content.startsWith("data:image/") ||
    (content.startsWith("http") && /\.(jpeg|jpg|gif|png|webp)/i.test(content)) ||
    (/^\/9j\/|^iVBORw0KGgo|^R0lGOD|^UklGR/.test(content) && content.length > 50) ||
    content === "📷 صورة" ||
    content === "📷 Photo"
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 truncate">
        <Camera className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
        <span>{isRtl ? "صورة" : "Photo"}</span>
      </span>
    );
  }

  if (contentType === "audio" || content.startsWith("[AUDIO]:")) {
    return (
      <span className="inline-flex items-center gap-1.5 truncate">
        <Mic className="w-3.5 h-3.5 flex-shrink-0 text-[#00a884]" />
        <span>{isRtl ? "رسالة صوتية" : "Voice message"}</span>
      </span>
    );
  }

  if (contentType === "file" || content.startsWith("[FILE]:")) {
    const raw = content.replace("[FILE]:", "");
    const fileName = raw.split("|")[0] || "";
    return (
      <span className="inline-flex items-center gap-1.5 truncate">
        <FileText className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" />
        <span className="truncate">{fileName || (isRtl ? "مستند" : "Document")}</span>
      </span>
    );
  }

  if (contentType === "location" || content.startsWith("[LOCATION]:")) {
    return (
      <span className="inline-flex items-center gap-1.5 truncate">
        <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />
        <span>{isRtl ? "موقع جغرافي" : "Location"}</span>
      </span>
    );
  }

  if (contentType === "call" || content.startsWith("[CALL]:")) {
    return (
      <span className="inline-flex items-center gap-1.5 truncate">
        <Phone className="w-3.5 h-3.5 flex-shrink-0 text-teal-500" />
        <span>{isRtl ? "مكالمة" : "Call"}</span>
      </span>
    );
  }

  return <span className="truncate">{content}</span>;
}

export function ChatList({
  conversations,
  isLoading,
  onSelect,
  myEmployeeId,
  getContactName,
  getContactPhoto,
}: ChatListProps) {
  const { lang } = useTheme();
  const isRtl = lang === "ar";

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 animate-pulse">
            <div className="w-14 h-14 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-[hsl(var(--muted2))]">
        <div className="w-16 h-16 bg-[hsl(var(--card-hover))] rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <p>{isRtl ? "لا توجد محادثات حتى الآن" : "No conversations yet"}</p>
        <p className="text-sm mt-2 opacity-70">
          {isRtl
            ? "اضغط على أيقونة جهات الاتصال لبدء محادثة"
            : "Tap a contact to start messaging"}
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col divide-y divide-[hsl(var(--border2))] overflow-y-auto"
      style={{ paddingBottom: "80px" }}
    >
      {conversations.map((conv) => {
        // Determine display name and photo
        // For 1-on-1, it's the other participant. For group, it's the subject or "Group"
        let title = conv.subject || "Chat";
        let photoUrl: string | undefined;

        if (!conv.isGroup) {
          const otherId = conv.participantIds.find((id) => id !== myEmployeeId);
          if (otherId) {
            title = getContactName(otherId);
            photoUrl = getContactPhoto(otherId);
          } else {
            title = isRtl ? "رسائل محفوظة" : "Saved Messages";
          }
        }

        return (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className="flex items-center gap-4 p-4 hover:bg-[hsl(var(--card-hover))] active:bg-[hsl(var(--border2))] transition-colors cursor-pointer"
          >
            {/* Avatar */}
            <div className="relative shrink-0">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={title}
                  className="w-14 h-14 rounded-full object-cover shadow-sm border border-[hsl(var(--border2))]"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-lg shadow-sm">
                  {title.charAt(0).toUpperCase()}
                </div>
              )}
              {conv.unreadCount > 0 && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-[hsl(var(--background))] flex items-center justify-center text-[10px] text-white font-bold">
                  {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="font-semibold text-[16px] text-[hsl(var(--foreground))] truncate">
                  {title}
                </h3>
                {conv.lastMessage && (
                  <span className="text-[12px] text-[hsl(var(--muted2))] whitespace-nowrap ml-2">
                    {timeAgo(conv.lastMessage.createdAt, isRtl)}
                  </span>
                )}
              </div>
              <div
                className={`text-[14px] truncate flex items-center min-w-0 ${
                  conv.unreadCount > 0
                    ? "font-semibold text-[hsl(var(--foreground))]"
                    : "text-[hsl(var(--muted2))]"
                }`}
              >
                {renderChatListLastMessage(conv.lastMessage, isRtl)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
