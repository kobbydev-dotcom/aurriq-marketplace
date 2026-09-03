import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api.js";
import type { Id } from "../../../../../convex/_generated/dataModel.d.ts";
import { formatDistanceToNow } from "date-fns";
import { Inbox, MessageSquare, Phone, Send } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";

type Conversation = {
  otherUserId: Id<"users">;
  otherUserName: string;
  otherUserAvatar?: string;
  lastMessage: string;
  lastMessageTime: number;
  lastMessageType: string;
  unreadCount: number;
  productName?: string;
};

export default function SellerMessagesTab({
  initialConversation,
}: {
  initialConversation?: Id<"users"> | null;
}) {
  const inbox = useQuery(api.messages.getInbox, {});
  const [selectedId, setSelectedId] = useState<Id<"users"> | null>(initialConversation ?? null);

  useEffect(() => {
    if (initialConversation) setSelectedId(initialConversation);
  }, [initialConversation]);

  if (inbox === undefined) {
    return <div className="space-y-3"><Skeleton className="h-16 w-full rounded-xl" /><Skeleton className="h-48 w-full rounded-xl" /></div>;
  }

  return (
    <div className="grid min-h-[520px] overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[280px_1fr]">
      <div className="border-b border-border md:border-b-0 md:border-r">
        <div className="border-b border-border/60 p-4">
          <p className="font-medium">Buyer conversations</p>
          <p className="text-xs text-muted-foreground">Questions about products and orders.</p>
        </div>
        {inbox.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <Inbox className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No buyer messages yet</p>
          </div>
        ) : (
          <div className="max-h-[430px] overflow-y-auto">
            {inbox.map((conversation: Conversation) => (
              <button
                key={conversation.otherUserId}
                type="button"
                onClick={() => setSelectedId(conversation.otherUserId)}
                className={cn("flex w-full items-start gap-3 border-b border-border/40 p-4 text-left transition-colors hover:bg-muted/40", selectedId === conversation.otherUserId && "bg-primary/10")}
              >
                <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {conversation.otherUserAvatar ? <img src={conversation.otherUserAvatar} alt="" className="h-full w-full object-cover" /> : conversation.otherUserName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{conversation.otherUserName}</p>
                    {conversation.unreadCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{conversation.unreadCount}</span>}
                  </div>
                  {conversation.productName && <p className="truncate text-[10px] text-primary/70">Re: {conversation.productName}</p>}
                  <p className="truncate text-xs text-muted-foreground">{conversation.lastMessage}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(conversation.lastMessageTime), { addSuffix: true })}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {selectedId ? <SellerMessageThread otherUserId={selectedId} /> : (
        <div className="flex items-center justify-center p-8 text-center text-muted-foreground">
          <div><MessageSquare className="mx-auto mb-2 size-8 opacity-40" /><p className="text-sm">Select a conversation to reply</p></div>
        </div>
      )}
    </div>
  );
}

function SellerMessageThread({ otherUserId }: { otherUserId: Id<"users"> }) {
  const messages = useQuery(api.messages.getConversation, { otherUserId });
  const otherUser = useQuery(api.users.current, { userId: otherUserId } as any) as { name?: string } | null | undefined;
  const markRead = useMutation(api.messages.markConversationAsRead);
  const sendMessage = useMutation(api.messages.sendMessage);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages) markRead({ otherUserId }).catch(() => undefined);
  }, [messages, markRead, otherUserId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    const content = text.trim();
    if (!content) return;
    setSending(true);
    try {
      await sendMessage({ receiverId: otherUserId, content, type: "message" });
      setText("");
    } catch { toast.error("Unable to send message"); }
    finally { setSending(false); }
  };

  if (messages === undefined) return <div className="flex items-center justify-center"><Skeleton className="h-10 w-40" /></div>;

  return (
    <div className="flex min-h-[520px] flex-col">
      <div className="flex items-center gap-3 border-b border-border/60 p-4">
        <MessageSquare className="size-4 text-primary" />
        <div><p className="text-sm font-medium">{otherUser?.name ?? "Buyer"}</p><p className="text-xs text-muted-foreground">Private Aurriq conversation</p></div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">Start a conversation with this buyer.</p>}
        {messages.map((message) => (
          <div key={message._id} className={cn("flex", message.senderId === otherUserId ? "justify-start" : "justify-end")}>
            <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2 text-sm", message.senderId === otherUserId ? "bg-muted" : "bg-primary text-primary-foreground")}>
              {message.type === "call_request" && <Phone className="mr-1.5 inline size-3" />}{message.content}
              <p className="mt-1 text-[10px] opacity-60">{formatDistanceToNow(new Date(message._creationTime), { addSuffix: true })}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-end gap-2 border-t border-border/60 p-3">
        <Textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Reply to buyer..." rows={1} className="min-h-10 resize-none" />
        <Button size="icon" onClick={() => void send()} disabled={sending || !text.trim()} aria-label="Send message"><Send className="size-4" /></Button>
      </div>
    </div>
  );
}
