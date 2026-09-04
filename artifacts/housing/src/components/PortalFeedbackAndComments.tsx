// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { formatDate } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedConfirmModal } from "@/components/shared/AnimatedConfirmModal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Heart, Trash2, Star } from "lucide-react";

export default function PortalFeedbackAndComments() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const { toast } = useToast();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const [selectedContent, setSelectedContent] = useState({
    type: "activity",
    id: 1,
  });
  const [commentText, setCommentText] = useState("");
  const [rating, setRating] = useState(5);

  const { data: feedback, isLoading } = useQuery({
    queryKey: ["portal-feedback", activePropertyId, selectedContent],
    queryFn: async () => {
      const res = await fetch(
        `/api/portal-feedback/${selectedContent.type}/${selectedContent.id}?propertyId=${activePropertyId}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch feedback");
      return res.json();
    },
    enabled: !!activePropertyId,
  });

  const { data: stats } = useQuery({
    queryKey: ["portal-feedback-stats", activePropertyId],
    queryFn: async () => {
      const res = await fetch(
        `/api/portal-feedback/stats?propertyId=${activePropertyId}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!activePropertyId,
  });

  const addCommentMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/portal-feedback/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, propertyId: activePropertyId }),
      });
      if (!res.ok) throw new Error("Failed to add comment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["portal-feedback", activePropertyId, selectedContent],
      });
      toast({ title: ar ? "تم إضافة التعليق" : "Comment added" });
      setCommentText("");
      setRating(5);
    },
  });

  const addFeedbackMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/portal-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, propertyId: activePropertyId }),
      });
      if (!res.ok) throw new Error("Failed to submit feedback");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["portal-feedback-stats", activePropertyId],
      });
      toast({ title: ar ? "شكراً على الملاحظة" : "Thanks for your feedback" });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      const res = await fetch(
        `/api/portal-feedback/comments/${commentId}?propertyId=${activePropertyId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (!res.ok) throw new Error("Failed to delete comment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["portal-feedback", activePropertyId, selectedContent],
      });
      toast({ title: ar ? "تم حذف التعليق" : "Comment deleted" });
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full rounded-lg" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-primary" />
          {ar ? "الملاحظات والتعليقات" : "Feedback & Comments"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {ar
            ? "اجمع ملاحظات الموظفين وتعليقاتهم"
            : "Collect profile feedback and comments"}
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold">{stats.totalComments}</div>
              <div className="text-xs text-muted-foreground">
                {ar ? "إجمالي التعليقات" : "Total Comments"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold">{stats.totalFeedback}</div>
              <div className="text-xs text-muted-foreground">
                {ar ? "الملاحظات" : "Feedback"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold">⭐ {stats.avgRating}</div>
              <div className="text-xs text-muted-foreground">
                {ar ? "متوسط التقييم" : "Avg Rating"}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {ar ? "أضف تعليقاً" : "Add Comment"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { type: "activity", label: ar ? "فعالية" : "Activity" },
              { type: "evaluation", label: ar ? "استبيان" : "Evaluation" },
              { type: "document", label: ar ? "مستند" : "Document" },
            ].map((item) => (
              <Button
                key={item.type}
                variant={
                  selectedContent.type === item.type ? "default" : "outline"
                }
                onClick={() =>
                  setSelectedContent({
                    ...selectedContent,
                    type: item.type as any,
                  })
                }
                className="w-full"
              >
                {item.label}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              {ar ? "التقييم" : "Rating"}
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setNewFeedback({ ...feedback, rating: star })}
                  className="p-1"
                >
                  <Star
                    className={`w-6 h-6 ${star <= (newFeedback.rating || 0) ? "fill-primary text-primary" : "text-muted-foreground"}`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              {ar ? "تعليقك" : "Your Comment"}
            </label>
            <Textarea
              placeholder={
                ar ? "أضف تعليقك هنا..." : "Add your comment here..."
              }
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          <Button
            className="w-full"
            onClick={() => {
              if (commentText.trim()) {
                addCommentMutation.mutate({
                  contentType: selectedContent.type,
                  contentId: selectedContent.id,
                  text: commentText,
                  rating,
                });
              }
            }}
            disabled={!commentText.trim()}
          >
            {ar ? "إضافة تعليق" : "Add Comment"}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Comments */}
      {feedback?.comments && feedback.comments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {ar ? "آخر التعليقات" : "Recent Comments"}
            </CardTitle>
            <CardDescription>
              {ar
                ? `${feedback.comments.length} تعليق`
                : `${feedback.comments.length} comments`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {feedback.comments.slice(0, 10).map((comment: any) => (
                <div
                  key={comment.id}
                  className="p-3 rounded-lg border border-border bg-muted/20 group hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                        {comment.username?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">
                          {comment.username}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(comment.createdAt)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={() => {
                        setDeleteDialog({ open: true, id: comment.id });
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <p className="text-sm text-foreground mb-2">{comment.text}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    {comment.rating && (
                      <span className="flex items-center gap-1">
                        {"⭐".repeat(Math.floor(comment.rating))}
                      </span>
                    )}
                    <button className="flex items-center gap-1 hover:text-primary transition-colors">
                      <Heart className="w-3 h-3" /> {comment.likes || 0}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <AnimatedConfirmModal
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
        title={ar ? `حذف التعليق؟` : `Delete Comment?`}
        description={
          ar
            ? "هل أنت متأكد من الحذف؟"
            : "Are you sure you want to delete this comment?"
        }
        variant="destructive"
        onConfirm={() => deleteCommentMutation.mutate(deleteDialog.id)}
      />
    </div>
  );
}
