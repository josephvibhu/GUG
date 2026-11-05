"use client";

import { useEffect, useState } from "react";
import { Bell, ShieldAlert, ArrowDownToLine, ArrowUpFromLine, ExternalLink, X, CheckCheck } from "lucide-react";
import { type FeedUser } from "@/hooks/useMarketFeed";

interface NotificationItem {
  id: string;
  type: "REGULATORY_DECREE" | "WALLET_ACTIVITY" | "DIVIDEND";
  title: string;
  date: string;
  summary: string;
  data?: any;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDcDecree: () => void;
  user: FeedUser | null;
}

export default function NotificationsModal({
  isOpen,
  onClose,
  onOpenDcDecree,
  user,
}: NotificationsModalProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("gug_read_notifications");
      if (stored) setReadIds(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
        }
      })
      .catch((err) => console.error("Error fetching notifications:", err))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadIds(allIds);
    try {
      localStorage.setItem("gug_read_notifications", JSON.stringify(allIds));
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        className="w-full sm:max-w-lg bg-pane border border-rule rounded-[8px] shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-rule flex items-center justify-between bg-floor/90">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-bullion/10 text-bullion border border-bullion/20">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-white font-sans">Notifications & Bulletins</h2>
              <p className="text-[11px] text-ash">Exchange updates, regulatory decrees, and account activity</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[11px] text-ash hover:text-paper flex items-center gap-1 transition px-2 py-1 rounded hover:bg-rule/40 cursor-pointer"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mark read</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-ash hover:text-white hover:bg-rule/50 transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="p-4 overflow-y-auto space-y-3 divide-y divide-rule/40 text-[13px]">
          {loading ? (
            <div className="py-12 text-center text-ash text-xs">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center text-ash text-xs">No notifications right now. You are all caught up!</div>
          ) : (
            notifications.map((n, idx) => {
              const isRead = readIds.includes(n.id);
              const isDecree = n.type === "REGULATORY_DECREE";

              return (
                <div key={n.id} className={`pt-3 first:pt-0 space-y-2 ${isRead ? "opacity-75" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 shrink-0">
                        {isDecree ? (
                          <div className="p-1.5 rounded bg-bear/20 text-bear border border-bear/30">
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </div>
                        ) : n.title.includes("Deposit") ? (
                          <div className="p-1.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <ArrowDownToLine className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="p-1.5 rounded bg-bullion/20 text-bullion border border-bullion/30">
                            <ArrowUpFromLine className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-[13px]">{n.title}</span>
                          {!isRead && (
                            <span className="h-2 w-2 rounded-full bg-bullion shrink-0" />
                          )}
                        </div>
                        <span className="text-[10px] text-ash font-mono">
                          {n.date ? new Date(n.date).toUTCString().slice(0, 22) : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-zinc-300 text-[12px] leading-relaxed pl-8">
                    {n.summary}
                  </p>

                  {/* Context for DC decree */}
                  {isDecree && n.data && (
                    <div className="pl-8 pt-1">
                      {n.data.shareholderPayout && (
                        <div className="mb-2 p-2 rounded bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-300 flex items-center justify-between">
                          <span>
                            Restitution Credited: <strong>{n.data.shareholderPayout.shares} shares</strong> dissolved into{" "}
                            <strong className="text-bullion">+{n.data.shareholderPayout.amount.toFixed(2)} gold</strong>
                          </span>
                        </div>
                      )}

                      {n.data.isFounder && (
                        <div className="mb-2 p-2 rounded bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-300">
                          Founder Notice: You have the right to file an official regulatory appeal.
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenDcDecree();
                        }}
                        className="px-3 py-1.5 rounded bg-floor hover:bg-rule/80 border border-rule text-paper text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3 text-bullion" />
                        View Full Decree & Appeal Details
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-rule bg-floor flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded bg-rule hover:bg-zinc-700 text-paper font-semibold font-sans text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
