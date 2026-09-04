import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { Bell, Check, Package, MessageSquare, Phone, AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";

const ICONS: Record<string, any> = {
  order_placed: Package,
  order_status: Package,
  message: MessageSquare,
  call_request: Phone,
  low_stock: AlertTriangle,
  payment: CreditCard,
};

export function NotificationBell() {
  const notifications = useQuery((api.notifications as any).getMyNotifications, {}) as any[] | undefined;
  const unread = useQuery((api.notifications as any).getUnreadCount, {}) as number | undefined;
  const markRead = useMutation((api.notifications as any).markNotificationRead);
  const markAllRead = useMutation((api.notifications as any).markAllRead);
  const navigate = useNavigate();

  const count = unread ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex items-center justify-center size-9 rounded-full hover:bg-muted transition-colors cursor-pointer"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <p className="text-sm font-semibold">Notifications</p>
          {count > 0 && (
            <button
              onClick={() => markAllRead({})}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Check className="size-3" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[60dvh] overflow-y-auto">
          {!notifications || notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No notifications yet</p>
          ) : (
            notifications.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              return (
                <button
                  key={n._id}
                  onClick={async () => {
                    await markRead({ notificationId: n._id });
                    if (n.link) navigate(n.link);
                  }}
                  className={`w-full text-left px-4 py-3 flex gap-3 border-b border-border/40 hover:bg-muted/50 transition-colors ${!n.isRead ? "bg-primary/5" : ""}`}
                >
                  <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="size-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.isRead ? "font-semibold" : ""}`}>{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground truncate">{n.body}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(n._creationTime, { addSuffix: true })}
                    </p>
                  </div>
                  {!n.isRead && <span className="size-2 rounded-full bg-primary shrink-0 mt-2" />}
                </button>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
