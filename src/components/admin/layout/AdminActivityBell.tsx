"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Route,
  Smartphone,
  UserRound,
  X,
} from "lucide-react";

type AdminActivityItem = {
  id: string;
  eventType:
    | "paid_trip_created"
    | "completed_paid_trip"
    | "waiting_list_trip_created"
    | "admin_campaign_claim";
  title: string;
  body: string;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
};

type PushState = "checking" | "enabled" | "disabled" | "unsupported" | "denied";

function decodeVapidKey(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = window.atob(
    (value + padding).replace(/-/g, "+").replace(/_/g, "/"),
  );
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes.buffer;
}

function eventIcon(eventType: AdminActivityItem["eventType"]) {
  if (eventType === "waiting_list_trip_created") return ClipboardList;
  return eventType === "completed_paid_trip" ? Route : CircleDollarSign;
}

export default function AdminActivityBell() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminActivityItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selected, setSelected] = useState<AdminActivityItem | null>(null);
  const [pushState, setPushState] = useState<PushState>("checking");
  const [pushError, setPushError] = useState("");

  async function refresh() {
    try {
      const response = await fetch("/api/admin/activity-notifications", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const result = await response.json();
      setItems(result.data ?? []);
      setUnreadCount(result.meta?.unreadCount ?? 0);
    } catch (error) {
      console.error("Failed to load admin activity notifications:", error);
    }
  }

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 20000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function checkPush() {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) setPushState("unsupported");
        return;
      }
      if (window.Notification.permission === "denied") {
        if (!cancelled) setPushState("denied");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          await fetch("/api/push/subscriptions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: subscription.toJSON() }),
          });
        }
        if (!cancelled) setPushState(subscription ? "enabled" : "disabled");
      } catch {
        if (!cancelled) setPushState("unsupported");
      }
    }
    void checkPush();
    return () => {
      cancelled = true;
    };
  }, []);

  async function togglePush() {
    setPushError("");
    try {
      const registration =
        (await navigator.serviceWorker.getRegistration("/")) ??
        (await navigator.serviceWorker.register("/service-worker.js", {
          scope: "/",
        }));
      let subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok)
          throw new Error("Could not disable device notifications.");
        await subscription.unsubscribe();
        setPushState("disabled");
        return;
      }

      const keyResponse = await fetch("/api/push/vapid-public-key", {
        cache: "no-store",
      });
      const keyResult = await keyResponse.json();
      if (!keyResponse.ok || typeof keyResult.publicKey !== "string") {
        throw new Error(
          keyResult.error ?? "Push notifications are not configured.",
        );
      }
      const permission = await window.Notification.requestPermission();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "denied" : "disabled");
        return;
      }
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(keyResult.publicKey),
      });
      const saveResponse = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!saveResponse.ok)
        throw new Error("Could not save this device subscription.");
      setPushState("enabled");
    } catch (error) {
      setPushError(
        error instanceof Error
          ? error.message
          : "Could not configure push notifications.",
      );
    }
  }

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSelected(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setSelected(null);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  async function markRead(item: AdminActivityItem) {
    if (item.isRead) return;
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, isRead: true } : entry,
      ),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
    await fetch("/api/admin/activity-notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
  }

  function showDetails(item: AdminActivityItem) {
    setSelected(item);
    void markRead(item);
  }

  const Icon = selected ? eventIcon(selected.eventType) : Bell;

  return (
    <div ref={rootRef} className="admin-activity-bell-wrap">
      <button
        type="button"
        className="admin-activity-bell"
        aria-label={`Admin notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          setSelected(null);
          void refresh();
        }}
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="admin-activity-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          className="admin-activity-popover"
          aria-label="Admin notifications"
        >
          {selected ? (
            <>
              <div className="admin-activity-heading">
                <button
                  type="button"
                  className="admin-activity-back"
                  onClick={() => setSelected(null)}
                >
                  ‹ All alerts
                </button>
                <button
                  type="button"
                  className="admin-activity-close"
                  aria-label="Close details"
                  onClick={() => setSelected(null)}
                >
                  <X size={17} />
                </button>
              </div>
              <div className="admin-activity-detail">
                <span className="admin-activity-detail-icon">
                  <Icon size={20} />
                </span>
                <h3>{selected.title}</h3>
                <p>{selected.body}</p>
                <dl>
                  {typeof selected.data.userName === "string" && (
                    <>
                      <dt>User</dt>
                      <dd>{selected.data.userName}</dd>
                    </>
                  )}
                  {selected.data.userNumber != null && (
                    <>
                      <dt>User number</dt>
                      <dd>#{String(selected.data.userNumber)}</dd>
                    </>
                  )}
                  {selected.data.tripNumber != null && (
                    <>
                      <dt>Trip number</dt>
                      <dd>#{String(selected.data.tripNumber)}</dd>
                    </>
                  )}
                  {typeof selected.data.phone === "string" &&
                    selected.data.phone && (
                      <>
                        <dt>Phone</dt>
                        <dd>{selected.data.phone}</dd>
                      </>
                    )}
                  {typeof selected.data.email === "string" &&
                    selected.data.email && (
                      <>
                        <dt>Email</dt>
                        <dd>{selected.data.email}</dd>
                      </>
                    )}
                  {selected.data.priceEgp != null && (
                    <>
                      <dt>Trip amount</dt>
                      <dd>{String(selected.data.priceEgp)} EGP</dd>
                    </>
                  )}
                  {selected.data.rewardAmount != null && (
                    <>
                      <dt>Campaign reward</dt>
                      <dd>{String(selected.data.rewardAmount)} EGP</dd>
                    </>
                  )}
                  {typeof selected.data.date === "string" && (
                    <>
                      <dt>Trip date</dt>
                      <dd>{selected.data.date}</dd>
                    </>
                  )}
                </dl>
                {typeof selected.data.href === "string" && (
                  <Link
                    className="admin-activity-open-link"
                    href={selected.data.href}
                    onClick={() => setOpen(false)}
                  >
                    Open related record <ChevronRight size={16} />
                  </Link>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="admin-activity-heading">
                <div>
                  <strong>Admin alerts</strong>
                  <small>
                    {unreadCount ? `${unreadCount} unread` : "All caught up"}
                  </small>
                </div>
                <button
                  type="button"
                  className="admin-activity-close"
                  aria-label="Close notifications"
                  onClick={() => setOpen(false)}
                >
                  <X size={17} />
                </button>
              </div>
              <button
                type="button"
                className="admin-activity-push-toggle"
                onClick={() => void togglePush()}
                disabled={
                  pushState === "checking" ||
                  pushState === "unsupported" ||
                  pushState === "denied"
                }
              >
                <Smartphone size={15} />
                {pushState === "checking"
                  ? "Checking device alerts..."
                  : pushState === "enabled"
                    ? "Disable device alerts"
                    : pushState === "denied"
                      ? "Notifications blocked in browser settings"
                      : pushState === "unsupported"
                        ? "Device alerts are not supported here"
                        : "Enable device alerts"}
              </button>
              {pushError && (
                <p className="admin-activity-push-error">{pushError}</p>
              )}
              <div className="admin-activity-list">
                {items.length ? (
                  items.slice(0, 6).map((item) => {
                    const ItemIcon = eventIcon(item.eventType);
                    return (
                      <button
                        type="button"
                        className={`admin-activity-item${item.isRead ? "" : " unread"}`}
                        key={item.id}
                        onClick={() => showDetails(item)}
                      >
                        <span className="admin-activity-item-icon">
                          <ItemIcon size={16} />
                        </span>
                        <span className="admin-activity-item-copy">
                          <strong>{item.title}</strong>
                          <small>{item.body}</small>
                          <time>
                            {new Date(item.createdAt).toLocaleString()}
                          </time>
                        </span>
                        {!item.isRead && (
                          <span className="admin-activity-unread-dot" />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="admin-activity-empty">
                    <UserRound size={21} />
                    No admin alerts yet
                  </div>
                )}
              </div>
              <Link
                href="/admin/alerts"
                className="admin-activity-see-all"
                onClick={() => setOpen(false)}
              >
                View all alerts <ChevronRight size={16} />
              </Link>
            </>
          )}
        </section>
      )}

      <style>{`
        .admin-activity-bell-wrap { position: relative; }
        .admin-activity-bell { position: relative; width: 38px; height: 38px; display: inline-grid; place-items: center; color: var(--color-primary); background: var(--color-panel); border: 1px solid var(--color-border); border-radius: 9px; cursor: pointer; }
        .admin-activity-bell:hover { border-color: var(--color-secondary); color: var(--color-secondary); }
        .admin-activity-badge { position: absolute; top: -6px; right: -6px; min-width: 18px; height: 18px; padding: 0 4px; border: 2px solid var(--color-surface); border-radius: 999px; background: var(--color-danger); color: white; font-size: 9px; line-height: 14px; text-align: center; font-weight: 800; }
        .admin-activity-popover { position: absolute; z-index: 300; top: calc(100% + 10px); right: 0; width: min(410px, calc(100vw - 24px)); max-height: min(78vh, 620px); overflow: auto; color: var(--color-primary); background: var(--color-panel); border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 18px 50px rgba(11,30,61,.2); animation: admin-alert-enter .16s ease-out both; }
        .admin-activity-heading { min-height: 58px; padding: 12px 15px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--color-border); }
        .admin-activity-heading div { display: grid; gap: 2px; }
        .admin-activity-heading strong { font-size: 15px; }
        .admin-activity-heading small { color: var(--color-muted); font-size: 11px; }
        .admin-activity-close,.admin-activity-back { border: 0; background: transparent; color: var(--color-muted); cursor: pointer; }
        .admin-activity-back { color: var(--color-secondary); font-weight: 700; }
        .admin-activity-list { display: grid; }
        .admin-activity-push-toggle { width:100%; min-height:40px; padding:8px 14px; display:flex; align-items:center; gap:8px; border:0; border-bottom:1px solid var(--color-border); background:var(--color-background); color:var(--color-primary); font:inherit; font-size:12px; font-weight:700; text-align:left; cursor:pointer; }
        .admin-activity-push-toggle:hover:not(:disabled) { color:var(--color-secondary-deep); }
        .admin-activity-push-toggle:disabled { color:var(--color-muted); cursor:not-allowed; }
        .admin-activity-push-error { margin:0; padding:8px 14px; color:var(--color-danger); font-size:11px; }
        .admin-activity-item { position: relative; width: 100%; padding: 12px 32px 12px 14px; display: flex; gap: 10px; text-align: left; border: 0; border-bottom: 1px solid var(--color-border); background: transparent; color: inherit; cursor: pointer; }
        .admin-activity-item:hover,.admin-activity-item.unread { background: var(--color-secondary-tint); }
        .admin-activity-item-icon,.admin-activity-detail-icon { flex: 0 0 auto; width: 32px; height: 32px; display: grid; place-items: center; color: var(--color-secondary-deep); background: var(--color-secondary-tint); border-radius: 50%; }
        .admin-activity-item-copy { min-width: 0; display: grid; gap: 3px; }
        .admin-activity-item-copy strong { font-size: 12px; }
        .admin-activity-item-copy small { color: var(--color-muted); font-size: 11px; line-height: 1.4; }
        .admin-activity-item-copy time { color: var(--color-muted); font-size: 10px; }
        .admin-activity-unread-dot { position: absolute; top: 17px; right: 13px; width: 7px; height: 7px; border-radius: 50%; background: var(--color-secondary); }
        .admin-activity-empty { min-height: 110px; display: grid; place-content: center; justify-items: center; gap: 8px; color: var(--color-muted); font-size: 12px; }
        .admin-activity-see-all { min-height: 44px; display: flex; align-items: center; justify-content: center; gap: 6px; color: var(--color-primary); text-decoration: none; font-size: 12px; font-weight: 800; }
        .admin-activity-see-all:hover { color: var(--color-secondary-deep); background: var(--color-background); }
        .admin-activity-detail { padding: 20px; }
        .admin-activity-detail-icon { width: 42px; height: 42px; }
        .admin-activity-detail h3 { margin: 12px 0 5px; font-size: 17px; }
        .admin-activity-detail p { margin: 0; color: var(--color-muted); font-size: 13px; line-height: 1.5; }
        .admin-activity-detail dl { display: grid; grid-template-columns: 110px minmax(0,1fr); gap: 8px 12px; margin: 18px 0; font-size: 12px; }
        .admin-activity-detail dt { color: var(--color-muted); }
        .admin-activity-detail dd { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
        .admin-activity-open-link { min-height: 40px; padding: 0 12px; display: inline-flex; align-items: center; gap: 5px; color: var(--color-on-primary); background: var(--color-primary); border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 800; }
        @media (max-width: 640px) {
          .admin-activity-popover { position: fixed; top: 122px; left: 12px; right: 12px; width: auto; max-height: calc(100dvh - 136px); }
          .admin-activity-detail { padding: 16px; }
          .admin-activity-detail dl { grid-template-columns: 88px minmax(0, 1fr); gap: 7px 10px; }
        }
        @keyframes admin-alert-enter { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
