import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { Send, Phone, MessageSquare, ArrowLeft, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";

type Conversation = {
  otherUserId: Id<"users">;
  otherUserName: string;
  otherUserAvatar: string | undefined;
  lastMessage: string;
  lastMessageTime: number;
  lastMessageType: "message" | "call_request";
  unreadCount: number;
  productId: Id<"products"> | undefined;
  productName: string | undefined;
};

function ConversationList({
  selectedId,
  onSelect,
}: {
  selectedId: Id<"users"> | null;
  onSelect: (id: Id<"users">) => void;
}) {
  const inbox = useQuery(api.messages.getInbox, {});

  if (inbox === undefined) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (inbox.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Inbox className="size-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Messages from buyers and sellers will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto">
      {inbox.map((conv: Conversation) => (
        <button
          key={conv.otherUserId}
          onClick={() => onSelect(conv.otherUserId)}
          className={cn(
            "w-full text-left px-4 py-3 border-b border-border/30 hover:bg-muted/40 transition-colors",
            selectedId === conv.otherUserId && "bg-primary/10 border-l-2 border-l-primary"
          )}
        >
          <div className="flex items-start gap-3">
            {conv.otherUserAvatar ? (
              <img
                src={conv.otherUserAvatar}
                alt={conv.otherUserName}
                className="size-9 rounded-full object-cover shrink-0 border border-border"
              />
            ) : (
              <div className="size-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">
                  {conv.otherUserName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold truncate">{conv.otherUserName}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(conv.lastMessageTime), { addSuffix: true })}
                </span>
              </div>
              {conv.productName && (
                <p className="text-[10px] text-primary/70 truncate">Re: {conv.productName}</p>
              )}
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-xs text-muted-foreground truncate">
                  {conv.lastMessageType === "call_request" ? "📞 Call request" : conv.lastMessage}
                </p>
                {conv.unreadCount > 0 && (
                  <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-4 h-4 flex items-center justify-center px-1 shrink-0">
                    {conv.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function ConversationView({ otherUserId }: { otherUserId: Id<"users"> }) {
  const messages = useQuery(api.messages.getConversation, { otherUserId });
  const markRead = useMutation(api.messages.markConversationAsRead);
  const sendMessage = useMutation(api.messages.sendMessage);
  const me = useQuery(api.users.getCurrentUser, {});
  const otherUser = useQuery(api.users.getUserById, { userId: otherUserId });

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages && messages.length > 0) {
      markRead({ otherUserId }).catch(() => {});
    }
  }, [messages, otherUserId, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await sendMessage({ receiverId: otherUserId, content: trimmed, type: "message" });
      setText("");
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleCallRequest = async () => {
    setSending(true);
    try {
      await sendMessage({
        receiverId: otherUserId,
        content: "I'd like to request a call regarding your product.",
        type: "call_request",
      });
      toast.success("Call request sent!");
    } catch {
      toast.error("Failed to send call request");
    } finally {
      setSending(false);
    }
  };

  if (messages === undefined || otherUser === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-card/60">
        {otherUser?.avatar ? (
          <img src={otherUser.avatar} alt={otherUser.name} className="size-8 rounded-full object-cover border border-border" />
        ) : (
          <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">{(otherUser?.name ?? "?").charAt(0).toUpperCase()}</span>
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold">{otherUser?.name ?? "Unknown"}</p>
          <p className="text-xs text-muted-foreground capitalize">{otherUser?.role ?? "user"}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCallRequest}
          disabled={sending}
          className="gap-1.5 text-xs cursor-pointer"
        >
          <Phone className="size-3.5" />
          Request Call
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <MessageSquare className="size-8 mb-2 opacity-30" />
            <p className="text-sm">Start the conversation</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.senderId === me?._id;
          const isCallRequest = msg.type === "call_request";
          return (
            <div key={msg._id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                  isCallRequest
                    ? "bg-amber-500/20 border border-amber-500/30 text-amber-200"
                    : isMe
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                {isCallRequest && <Phone className="size-3 inline mr-1.5 mb-0.5" />}
                {msg.content}
                <p className={cn("text-[10px] mt-1 opacity-60", isMe ? "text-right" : "text-left")}>
                  {formatDistanceToNow(new Date(msg._creationTime), { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border/40 bg-card/40 flex gap-2 items-end">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="resize-none text-sm min-h-[44px] max-h-32"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="shrink-0 cursor-pointer"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function MessagesInner() {
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
        Messages
      </h1>

      <div className="border border-border/40 rounded-2xl overflow-hidden bg-card/40 flex h-[600px]">
        {/* Sidebar: conversation list */}
        <div
          className={cn(
            "w-full md:w-72 border-r border-border/40 flex flex-col shrink-0",
            selectedUserId ? "hidden md:flex" : "flex"
          )}
        >
          <div className="px-4 py-3 border-b border-border/30">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Inbox</p>
          </div>
          <Authenticated>
            <ConversationList selectedId={selectedUserId} onSelect={setSelectedUserId} />
          </Authenticated>
        </div>

        {/* Main: conversation view */}
        <div className={cn("flex-1 flex flex-col", !selectedUserId && "hidden md:flex")}>
          {selectedUserId ? (
            <>
              {/* Back button (mobile) */}
              <button
                onClick={() => setSelectedUserId(null)}
                className="md:hidden flex items-center gap-1.5 text-xs text-muted-foreground px-4 py-2 border-b border-border/30 hover:text-primary transition-colors cursor-pointer"
              >
                <ArrowLeft className="size-3.5" /> Back to inbox
              </button>
              <Authenticated>
                <ConversationView otherUserId={selectedUserId} />
              </Authenticated>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MessageSquare />
                  </EmptyMedia>
                  <EmptyTitle>Select a conversation</EmptyTitle>
                  <EmptyDescription>Choose a conversation from the inbox to start messaging</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <>
      <AuthLoading>
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </AuthLoading>
      <Authenticated>
        <MessagesInner />
      </Authenticated>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <MessageSquare className="size-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">Sign in to view your messages</p>
          <SignInButton />
        </div>
      </Unauthenticated>
    </>
  );
}
