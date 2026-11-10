import { useTabChat } from "./useTabChat";
import type { TabChatProps } from "./types";
import { renderConversationScreen } from "./ConversationScreen";
import { renderNewConversationScreen } from "./NewConversationScreen";
import { renderConversationListScreen } from "./ConversationListScreen";

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */
// State and actions live in useTabChat; each screen renders from that state.
export function TabChat(props: TabChatProps) {
  const chat = useTabChat(props);
  if (chat.activeConv) return renderConversationScreen(chat, chat.activeConv);
  if (chat.showNewConv) return renderNewConversationScreen(chat);
  return renderConversationListScreen(chat);
}
