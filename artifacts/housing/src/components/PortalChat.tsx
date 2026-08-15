// @ts-nocheck
import { useState } from "react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Trash2, Eye } from "lucide-react";

export default function PortalChat() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [senders, setSenders] = useState({});

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
  });

  const conversations = convData ?? [];

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

  const viewMessages = async (convId) => {
    setSelectedConv(convId);
    const r = await fetch(
      `/api/portal-chat/admin/conversations/${convId}/messages?propertyId=${activePropertyId}`,
    );
    const d = await r.json();
    setMessages(d.messages ?? []);
    setSenders(d.senders ?? {});
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />{" "}
          {ar ? "المحادثات" : "Conversations"}
        </h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>{ar ? "الموضوع" : "Subject"}</TableHead>
                  <TableHead>{ar ? "النوع" : "Type"}</TableHead>
                  <TableHead>{ar ? "الرسائل" : "Messages"}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {ar ? "جاري التحميل..." : "Loading..."}
                    </TableCell>
                  </TableRow>
                ) : conversations.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {ar ? "لا توجد محادثات" : "No conversations"}
                    </TableCell>
                  </TableRow>
                ) : (
                  conversations.map((c) => (
                    <TableRow
                      key={c.id}
                      className={selectedConv === c.id ? "bg-muted/50" : ""}
                    >
                      <TableCell>{c.id}</TableCell>
                      <TableCell className="font-medium">
                        {c.subject || (ar ? "بدون موضوع" : "No subject")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {c.isGroup
                            ? ar
                              ? "مجموعة"
                              : "Group"
                            : ar
                              ? "خاص"
                              : "Direct"}
                        </Badge>
                      </TableCell>
                      <TableCell>{c.messageCount ?? "—"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => viewMessages(c.id)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {selectedConv && (
          <Card>
            <CardContent className="pt-4">
              <h4 className="font-bold mb-3">{ar ? "الرسائل" : "Messages"}</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {ar ? "لا توجد رسائل" : "No messages"}
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className="flex items-start justify-between p-2 rounded-lg bg-muted/30"
                    >
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground mb-1 font-semibold text-primary">
                          {senders[msg.senderId]
                            ? `${senders[msg.senderId].firstName} ${senders[msg.senderId].lastName}`
                            : `Employee #${msg.senderId}`}{" "}
                          <span className="font-normal text-muted-foreground">
                            · {new Date(msg.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div
                          className="text-sm"
                          style={{ wordBreak: "break-word" }}
                        >
                          {msg.content}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 ms-2"
                        onClick={() => deleteMessage.mutate(msg.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
