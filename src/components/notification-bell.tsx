"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PlatformNotification = {
  id: string;
  title: string;
  message: string;
  href: string | null;
  created_at: string;
  read_at: string | null;
};

function BellIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </svg>
  );
}

function formatWhen(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export default function NotificationBell({ initialNotifications }: { initialNotifications: PlatformNotification[] }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = useMemo(() => notifications.filter((item) => !item.read_at).length, [notifications]);

  async function markRead(id: string) {
    const current = notifications.find((item) => item.id === id);
    if (!current || current.read_at) return;
    const now = new Date().toISOString();
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, read_at: now } : item));
    const supabase = createClient();
    await supabase.from("notifications").update({ read_at: now }).eq("id", id);
  }

  async function markAllRead() {
    if (!unreadCount) return;
    const now = new Date().toISOString();
    setNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at || now })));
    const supabase = createClient();
    await supabase.from("notifications").update({ read_at: now }).is("read_at", null);
  }

  return (
    <div className="platform-notifications">
      <button
        type="button"
        className="ec-notification premium-notification"
        aria-label={unreadCount ? `Notificações: ${unreadCount} não lidas` : "Notificações"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <BellIcon />
        {unreadCount > 0 && <span className="premium-dot" />}
        {unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-popover" role="dialog" aria-label="Central de notificações">
          <div className="notification-popover-head">
            <div>
              <strong>Notificações</strong>
              <span>{unreadCount ? `${unreadCount} não lida${unreadCount === 1 ? "" : "s"}` : "Tudo em dia"}</span>
            </div>
            {unreadCount > 0 && <button type="button" onClick={markAllRead}>Marcar todas como lidas</button>}
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">Nenhuma notificação por enquanto.</div>
            ) : notifications.map((item) => {
              const content = (
                <>
                  <span className={`notification-status ${item.read_at ? "is-read" : ""}`} />
                  <span className="notification-copy">
                    <strong>{item.title}</strong>
                    <span>{item.message}</span>
                    <small>{formatWhen(item.created_at)}</small>
                  </span>
                </>
              );

              return item.href ? (
                <Link key={item.id} href={item.href} className={`notification-item ${item.read_at ? "is-read" : ""}`} onClick={() => markRead(item.id)}>
                  {content}
                </Link>
              ) : (
                <button key={item.id} type="button" className={`notification-item ${item.read_at ? "is-read" : ""}`} onClick={() => markRead(item.id)}>
                  {content}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
