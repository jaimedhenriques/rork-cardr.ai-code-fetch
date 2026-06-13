import { useState, useEffect } from "react";
import { Bell, X, Video, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { formatDistanceToNowStrict } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { motion, AnimatePresence } from "framer-motion";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  calendar_event_id: string | null;
  metadata: any;
  created_at: string;
}

const NotificationBell = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const loadNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications((data as Notification[]) || []);
  };

  useEffect(() => {
    loadNotifications();
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true } as any).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    for (const id of unreadIds) {
      await supabase.from("notifications").update({ read: true } as any).eq("id", id);
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deleteNotification = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="relative p-2 rounded-xl hover:bg-secondary transition-colors">
          <Bell size={18} className="text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-sm p-0">
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border/60">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-left text-base">Notifications</SheetTitle>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] font-semibold text-primary hover:underline">
                Mark all read
              </button>
            )}
          </div>
        </SheetHeader>

        <div className="overflow-y-auto max-h-[calc(100vh-80px)]">
          {notifications.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-xs">
              <Bell size={28} className="mx-auto mb-2 opacity-20" />
              No notifications yet
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              <AnimatePresence>
                {notifications.map((notif) => (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={`px-4 py-3 flex gap-3 transition-colors ${
                      !notif.read ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!notif.read ? "bg-primary" : "bg-transparent"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground leading-snug">{notif.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{notif.body}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-muted-foreground/60">
                          {formatDistanceToNowStrict(new Date(notif.created_at), { addSuffix: true })}
                        </span>
                        {notif.metadata?.meeting_url && (
                          <a
                            href={notif.metadata.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-0.5 text-[9px] font-semibold text-primary hover:underline"
                          >
                            <Video size={9} /> Join
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {!notif.read && (
                        <button onClick={() => markAsRead(notif.id)} className="p-1 rounded-md hover:bg-secondary text-muted-foreground">
                          <Check size={12} />
                        </button>
                      )}
                      <button onClick={() => deleteNotification(notif.id)} className="p-1 rounded-md hover:bg-secondary text-muted-foreground">
                        <X size={12} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default NotificationBell;
