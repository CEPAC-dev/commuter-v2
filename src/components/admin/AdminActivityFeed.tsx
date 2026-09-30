"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleDollarSign, Search, Route, UserRound } from "lucide-react";
import {
  AdminCard,
  AdminEmptyState,
  AdminPageContainer,
  AdminPageHeader,
} from "@/components/admin/layout";

type Item = {
  id: string;
  eventType:
    | "paid_trip_created"
    | "completed_paid_trip"
    | "admin_campaign_claim";
  title: string;
  body: string;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
};

export default function AdminActivityFeed() {
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    setLoading(true);
    fetch(`/api/admin/activity-notifications?${params}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load alerts");
        return response.json();
      })
      .then((result) => {
        if (!cancelled) {
          setItems(result.data ?? []);
          setSelected((current) =>
            current
              ? ((result.data ?? []).find(
                  (item: Item) => item.id === current.id,
                ) ?? current)
              : null,
          );
        }
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  async function selectItem(item: Item) {
    setSelected(item);
    if (!item.isRead) {
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, isRead: true } : entry,
        ),
      );
      await fetch("/api/admin/activity-notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
    }
  }

  const DetailIcon =
    selected?.eventType === "completed_paid_trip" ? Route : CircleDollarSign;

  return (
    <AdminPageContainer maxWidth={1180}>
      <AdminPageHeader
        title="Admin alerts"
        description="Newly paid trips, completed trips, and admin campaign referral claims."
        icon={CircleDollarSign}
      />
      <div className="admin-activity-feed-layout">
        <AdminCard
          padding={0}
          title="Activity"
          description={`${items.length} matching alert${items.length === 1 ? "" : "s"}`}
        >
          <label className="admin-activity-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search user, user number, phone, trip number..."
            />
          </label>
          {loading ? (
            <div className="admin-activity-loading">Loading alerts...</div>
          ) : items.length ? (
            <div className="admin-activity-feed-list">
              {items.map((item) => {
                const ItemIcon =
                  item.eventType === "completed_paid_trip"
                    ? Route
                    : CircleDollarSign;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`admin-activity-feed-item${selected?.id === item.id ? " selected" : ""}`}
                    onClick={() => void selectItem(item)}
                  >
                    <span className="admin-activity-feed-icon">
                      <ItemIcon size={17} />
                    </span>
                    <span className="admin-activity-feed-copy">
                      <strong>{item.title}</strong>
                      <small>{item.body}</small>
                      <time>{new Date(item.createdAt).toLocaleString()}</time>
                    </span>
                    {!item.isRead && (
                      <span className="admin-activity-feed-new">New</span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <AdminEmptyState
              title="No matching alerts"
              description="New completed paid trips and campaign claims will appear here."
            />
          )}
        </AdminCard>

        <AdminCard
          title="Alert details"
          description={
            selected
              ? new Date(selected.createdAt).toLocaleString()
              : "Select an alert to inspect its details."
          }
        >
          {selected ? (
            <div className="admin-activity-detail-content">
              <span className="admin-activity-feed-icon large">
                <DetailIcon size={20} />
              </span>
              <h2>{selected.title}</h2>
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
                    <dt>Reward amount</dt>
                    <dd>{String(selected.data.rewardAmount)} EGP</dd>
                  </>
                )}
                {typeof selected.data.date === "string" && (
                  <>
                    <dt>Trip date</dt>
                    <dd>{selected.data.date}</dd>
                  </>
                )}
                {typeof selected.data.pickup === "string" &&
                  selected.data.pickup && (
                    <>
                      <dt>Pickup</dt>
                      <dd>{selected.data.pickup}</dd>
                    </>
                  )}
                {typeof selected.data.dropoff === "string" &&
                  selected.data.dropoff && (
                    <>
                      <dt>Drop-off</dt>
                      <dd>{selected.data.dropoff}</dd>
                    </>
                  )}
              </dl>
              {typeof selected.data.href === "string" && (
                <Link
                  className="admin-activity-feed-open"
                  href={selected.data.href}
                >
                  Open related record
                </Link>
              )}
            </div>
          ) : (
            <div className="admin-activity-detail-empty">
              <UserRound size={24} />
              Alert details appear here.
            </div>
          )}
        </AdminCard>
      </div>
      <style>{`
        .admin-activity-feed-layout { display:grid; grid-template-columns:minmax(0,1.1fr) minmax(300px,.9fr); gap:16px; align-items:start; }
        .admin-activity-search { display:flex; align-items:center; gap:8px; margin-bottom:12px; padding:0 11px; height:42px; color:var(--color-muted); background:var(--color-background); border:1px solid var(--color-border); border-radius:8px; }
        .admin-activity-search input { width:100%; min-width:0; border:0; outline:0; background:transparent; color:var(--color-primary); font:inherit; font-size:12px; }
        .admin-activity-feed-list { display:grid; max-height:70vh; overflow:auto; border:1px solid var(--color-border); border-radius:8px; }
        .admin-activity-feed-item { width:100%; display:flex; align-items:flex-start; gap:10px; padding:12px; text-align:left; color:var(--color-primary); background:var(--color-panel); border:0; border-bottom:1px solid var(--color-border); cursor:pointer; }
        .admin-activity-feed-item:hover,.admin-activity-feed-item.selected { background:var(--color-secondary-tint); }
        .admin-activity-feed-icon { width:34px; height:34px; flex:0 0 auto; display:grid; place-items:center; color:var(--color-secondary-deep); background:var(--color-secondary-tint); border-radius:50%; }
        .admin-activity-feed-icon.large { width:42px; height:42px; }
        .admin-activity-feed-copy { min-width:0; flex:1; display:grid; gap:3px; }
        .admin-activity-feed-copy strong { font-size:12px; }
        .admin-activity-feed-copy small,.admin-activity-feed-copy time { color:var(--color-muted); font-size:11px; line-height:1.4; }
        .admin-activity-feed-new { color:var(--color-secondary-deep); font-size:10px; font-weight:800; }
        .admin-activity-detail-content h2 { margin:12px 0 5px; color:var(--color-primary); font-size:18px; }
        .admin-activity-detail-content p { color:var(--color-muted); font-size:13px; line-height:1.55; }
        .admin-activity-detail-content dl { display:grid; grid-template-columns:105px minmax(0,1fr); gap:9px 12px; margin:20px 0; font-size:12px; }
        .admin-activity-detail-content dt { color:var(--color-muted); }
        .admin-activity-detail-content dd { margin:0; color:var(--color-primary); font-weight:700; overflow-wrap:anywhere; }
        .admin-activity-feed-open { display:inline-flex; align-items:center; padding:10px 13px; color:var(--color-on-primary); background:var(--color-primary); border-radius:8px; text-decoration:none; font-size:12px; font-weight:800; }
        .admin-activity-detail-empty,.admin-activity-loading { min-height:120px; display:grid; place-content:center; justify-items:center; gap:8px; color:var(--color-muted); font-size:13px; }
        @media(max-width:850px){.admin-activity-feed-layout{grid-template-columns:1fr}}
      `}</style>
    </AdminPageContainer>
  );
}
