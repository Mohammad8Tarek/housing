import { useState, useRef, useEffect } from "react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Trash2, Send, Search, Users, User, ShieldAlert } from "lucide-react";

export default function PortalChat() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [senders, setSenders] = useState({});
  const [replyText, setReplyText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef(null);

  const { data: convData, isLoading } = useQuery({
    queryKey: ["portal-chat-conversations", activePropertyId],
    queryFn: async () => {
      const r = await fetch(
        `/api/portal-chat/admin/conversations?propertyId=${activePropertyId}`,
      );
      const d = await r.json();
      return d.conversations ?? [];
    },
    enabled: !!activePropertyId,
    refetchInterval: 5000,
  });

  const conversations = convData ?? [];
  const filteredConversations = conversations.filter(c => 
    c.subject?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.id.toString().includes(searchQuery)
  );

  const deleteMessage = useMutation({
    mutationFn: async (msgId) => {
      await fetch(
        `/api/portal-chat/admin/messages/${msgId}?propertyId=${activePropertyId}`,
        { method: "DELETE" },
      );
    },
    onSuccess: () => {
      toast({ title: ar ? "تم حذف الرسالة" : "Message deleted" });
      if (selectedConv) viewMessages(selectedConv);
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (content) => {
      const r = await fetch(
        `/api/portal-chat/admin/conversations/${selectedConv}/messages?propertyId=${activePropertyId}`,
        { 
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content })
        },
      );
      return await r.json();
    },
    onSuccess: () => {
      setReplyText("");
      viewMessages(selectedConv);
    },
  });

  const viewMessages = async (convId) => {
    setSelectedConv(convId);
    const r = await fetch(
      `/api/portal-chat/admin/conversations/${convId}/messages?propertyId=${activePropertyId}`,
    );
    const d = await r.json();
    setMessages(d.messages ?? []);
    setSenders(d.senders ?? {});
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Refresh messages periodically if a conversation is selected
  useEffect(() => {
    if (!selectedConv) return;
    const interval = setInterval(() => {
      viewMessages(selectedConv);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedConv, activePropertyId]);

  return (
    <div className="h-[calc(100vh-140px)] flex gap-4 overflow-hidden">
      {/* Sidebar - Conversations List */}
      <Card className="w-1/3 flex flex-col h-full overflow-hidden border-e shadow-sm">
        <CardHeader className="py-4 px-4 border-b shrink-0">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            {ar ? "محادثات البوابة" : "Portal Chats"}
          </CardTitle>
          <div className="relative mt-3">
            <Search className={`absolute ${ar ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
            <Input
              placeholder={ar ? "بحث..." : "Search..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${ar ? "pr-9" : "pl-9"} h-9 text-sm`}
            />
          </div>
        </CardHeader>
        <ScrollArea className="flex-1 p-2">
          {isLoading ? (
            <div className="flex justify-center p-8 text-muted-foreground text-sm">
              {ar ? "جاري التحميل..." : "Loading..."}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex justify-center p-8 text-muted-foreground text-sm">
              {ar ? "لا توجد محادثات" : "No conversations found"}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredConversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => viewMessages(c.id)}
                  className={`p-3 rounded-xl cursor-pointer transition-colors flex items-start gap-3 ${
                    selectedConv === c.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${c.isGroup ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    {c.isGroup ? <Users className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-semibold text-sm truncate">
                        {c.subject || (ar ? "بدون موضوع" : "No subject")}
                      </h4>
                      <span className="text-[10px] text-muted-foreground">#{c.id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                        {c.isGroup ? (ar ? "مجموعة" : "Group") : (ar ? "خاص" : "Direct")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {c.messageCount || 0} {ar ? "رسائل" : "msgs"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col h-full overflow-hidden shadow-sm">
        {selectedConv ? (
          <>
            <CardHeader className="py-3 px-6 border-b shrink-0 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-md">
                    {conversations.find(c => c.id === selectedConv)?.subject || (ar ? "بدون موضوع" : "No subject")}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-amber-500" />
                    {ar ? "وضع الإشراف (أدمن)" : "Moderation Mode (Admin)"}
                  </p>
                </div>
              </div>
            </CardHeader>

            <ScrollArea className="flex-1 p-4 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="space-y-4 max-w-3xl mx-auto pb-4">
                {messages.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    {ar ? "لا توجد رسائل" : "No messages yet"}
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isAdmin = msg.senderId === 0;
                    const sender = senders[msg.senderId];
                    const senderName = isAdmin 
                      ? (ar ? "الإدارة" : "Management")
                      : (sender ? `${sender.firstName} ${sender.lastName}` : `Profile #${msg.senderId}`);

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isAdmin ? (ar ? "items-start" : "items-end") : (ar ? "items-end" : "items-start")}`}
                      >
                        <div className="flex items-baseline gap-2 mb-1 px-1">
                          <span className={`text-xs font-semibold ${isAdmin ? 'text-blue-600' : 'text-slate-600 dark:text-slate-300'}`}>
                            {senderName}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        
                        <div className={`relative group flex ${isAdmin ? (ar ? 'flex-row-reverse' : 'flex-row-reverse') : (ar ? 'flex-row' : 'flex-row')} items-start gap-2 max-w-[85%]`}>
                          {/* Delete button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-2"
                            onClick={() => deleteMessage.mutate(msg.id)}
                            title={ar ? "حذف كأدمن" : "Delete as admin"}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>

                          <div 
                            className={`p-3 rounded-2xl text-sm whitespace-pre-wrap break-words shadow-sm
                              ${isAdmin 
                                ? (ar ? 'bg-blue-600 text-white rounded-tl-sm' : 'bg-blue-600 text-white rounded-tr-sm') 
                                : (ar ? 'bg-white dark:bg-slate-800 border rounded-tr-sm' : 'bg-white dark:bg-slate-800 border rounded-tl-sm')
                              }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Admin Reply Input */}
            <div className="p-4 bg-background border-t shrink-0">
              <form 
                className="flex gap-2 max-w-3xl mx-auto"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (replyText.trim()) sendMessage.mutate(replyText);
                }}
              >
                <Input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={ar ? "أرسل رسالة كإدارة..." : "Send message as Management..."}
                  className="flex-1 bg-muted/50 border-transparent focus-visible:bg-background"
                  disabled={sendMessage.isPending}
                />
                <Button 
                  type="submit" 
                  disabled={!replyText.trim() || sendMessage.isPending}
                  className="shrink-0 rounded-full w-10 h-10 p-0 flex items-center justify-center bg-blue-600 hover:bg-blue-700"
                >
                  <Send className={`w-4 h-4 ${ar ? "rotate-180" : ""} text-white`} />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
            <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-10 h-10 opacity-20" />
            </div>
            <p className="text-lg font-medium text-slate-400">
              {ar ? "اختر محادثة للبدء" : "Select a conversation to start"}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
