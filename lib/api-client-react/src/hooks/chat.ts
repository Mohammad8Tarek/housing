import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "../custom-fetch";

// GET /api/portal-chat/conversations
export const useConversations = () => {
  return useQuery({
    queryKey: ["portal", "chat", "conversations"],
    queryFn: () => customFetch("/api/portal-chat/conversations")
  });
};

// GET /api/portal-chat/conversations/:id/messages
export const useConversationMessages = (conversationId: number) => {
  return useQuery({
    queryKey: ["portal", "chat", "messages", conversationId],
    queryFn: () => customFetch(`/api/portal-chat/conversations/${conversationId}/messages`),
    enabled: !!conversationId
  });
};

// POST /api/portal-chat/conversations
export const useCreateConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { participantIds: number[]; subject?: string }) => {
      return customFetch("/api/portal-chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "chat", "conversations"] });
    }
  });
};

// POST /api/portal-chat/conversations/:id/messages
export const useSendMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, content, contentType = "text" }: { conversationId: number; content: string; contentType?: string }) => {
      return customFetch(`/api/portal-chat/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, contentType })
      });
    },
    onSuccess: (data: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ["portal", "chat", "messages", variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ["portal", "chat", "conversations"] });
    }
  });
};

// PUT /api/portal-chat/conversations/:id/read
export const useMarkAsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: number) => {
      return customFetch(`/api/portal-chat/conversations/${conversationId}/read`, {
        method: "PUT"
      });
    },
    onSuccess: (data: any, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["portal", "chat", "conversations"] });
    }
  });
};
