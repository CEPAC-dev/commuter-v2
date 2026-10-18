"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { Copy, MapPin, Share2 } from "lucide-react";
import { useClientLocale } from "@/lib/locale.client";
import type { Locale } from "@/lib/i18n/config";
import {
  classifyLocationError,
  getLocationSendDelayMs,
  getNetworkRetryDelayMs,
  buildLiveShareText,
  buildSmsShareUrl,
  buildWhatsAppShareUrl,
} from "@/lib/liveShare/clientSender";
import { LIVE_SHARE_CONSENT_VERSION } from "@/lib/liveShare/consent";
import { MAX_LOCATION_ACCURACY_METERS } from "@/lib/liveShare/logic";

interface LiveShareControlProps {
  tripId: string;
  eligible: boolean;
  initialLocale: Locale;
}

interface ShareDetails {
  url: string;
  expiresAt: string;
  viewCount: number;
  lastViewedAt: string | null;
  lastLocationAt: string | null;
}

type ShareStage = "loading" | "idle" | "active" | "ended" | "stopped";
type SenderStage = "waiting" | "sending" | "paused" | "error" | "ended";
type DialogStage = "consent" | "stop" | null;
type WakeLockSentinelLike = {
  release(): Promise<void>;
  addEventListener(type: "release", listener: () => void): void;
};
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request(type: "screen"): Promise<WakeLockSentinelLike>;
  };
};

function subscribeToVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

function getVisibilitySnapshot() {
  return document.visibilityState === "visible";
}

function getServerVisibilitySnapshot() {
  return true;
}

function responseJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().then((value: unknown) =>
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {},
  );
}

export default function LiveShareControl({
  tripId,
  eligible,
  initialLocale,
}: LiveShareControlProps) {
  const { locale, dir, t } = useClientLocale(initialLocale);
  const pageVisible = useSyncExternalStore(
    subscribeToVisibility,
    getVisibilitySnapshot,
    getServerVisibilitySnapshot,
  );
  const [stage, setStage] = useState<ShareStage>("loading");
  const [senderStage, setSenderStage] = useState<SenderStage>("waiting");
  const [share, setShare] = useState<ShareDetails | null>(null);
  const [dialog, setDialog] = useState<DialogStage>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [secondsSinceSent, setSecondsSinceSent] = useState(0);
  const [screenPaused, setScreenPaused] = useState(false);
  const [wakeLockNote, setWakeLockNote] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stopping, setStopping] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const dialogActionRef = useRef<HTMLButtonElement | null>(null);
  const dialogOpenerRef = useRef<HTMLElement | null>(null);
  const latestLocationAtRef = useRef<number | null>(null);
  const shareUrlRef = useRef<string | null>(null);

  const sharePath = `/api/trips/${encodeURIComponent(tripId)}/share`;

  const applyShareResponse = useCallback(
    (data: Record<string, unknown>) => {
      const nextStage = data.state;
      const nextShare =
        typeof data.url === "string" && typeof data.expiresAt === "string"
          ? {
              url: data.url,
              expiresAt: data.expiresAt,
              viewCount:
                typeof data.viewCount === "number" ? data.viewCount : 0,
              lastViewedAt:
                typeof data.lastViewedAt === "string"
                  ? data.lastViewedAt
                  : null,
              lastLocationAt:
                typeof data.lastLocationAt === "string"
                  ? data.lastLocationAt
                  : null,
            }
          : null;
      if (nextShare) setShare(nextShare);
      else if (nextStage === "none" || nextStage === "revoked" || nextStage === "expired") {
        setShare(null);
      }
      if (nextStage === "ended") {
        setStage("ended");
        setSenderStage("ended");
      } else if ((data.active === true || nextStage === "active") && nextShare) {
        setStage("active");
      } else {
        setStage("idle");
        setSenderStage("waiting");
      }
      const locationTime = nextShare?.lastLocationAt
        ? new Date(nextShare.lastLocationAt).getTime()
        : Number.NaN;
      if (nextShare?.url !== shareUrlRef.current) {
        shareUrlRef.current = nextShare?.url ?? null;
        latestLocationAtRef.current = Number.isFinite(locationTime)
          ? locationTime
          : null;
      } else if (
        Number.isFinite(locationTime) &&
        (latestLocationAtRef.current === null ||
          locationTime > latestLocationAtRef.current)
      ) {
        latestLocationAtRef.current = locationTime;
      }
      setLastSentAt(Number.isFinite(locationTime) ? locationTime : null);
    },
    [],
  );

  const refreshShare = useCallback(async () => {
    const response = await fetch(sharePath, { cache: "no-store" });
    const data = await responseJson(response);
    if (!response.ok) {
      throw new Error(
        typeof data.error === "string" ? data.error : t("live_share.load_error"),
      );
    }
    applyShareResponse(data);
  }, [applyShareResponse, sharePath, t]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await refreshShare();
      } catch {
        if (!cancelled) setControlError(t("live_share.load_error"));
      } finally {
        if (!cancelled) {
          setStage((current) => (current === "loading" ? "idle" : current));
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshShare, t]);

  useEffect(() => {
    if (stage !== "active" || !share?.url) return;
    let cancelled = false;
    const poll = async () => {
      try {
        await refreshShare();
        if (!cancelled) setControlError(null);
      } catch {
        if (!cancelled) setControlError(t("live_share.load_error"));
      }
    };
    const interval = window.setInterval(() => void poll(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [refreshShare, share?.url, stage, t]);

  useEffect(() => {
    if (dialog) {
      dialogActionRef.current?.focus();
      return;
    }
    if (dialogOpenerRef.current?.isConnected) {
      dialogOpenerRef.current.focus();
    } else {
      sectionRef.current?.focus();
    }
    dialogOpenerRef.current = null;
  }, [dialog]);

  useEffect(() => {
    if (!dialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        setDialog(null);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled)',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, dialog]);

  const createShare = useCallback(async () => {
    setBusy(true);
    setControlError(null);
    try {
      const response = await fetch(sharePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consent: true,
          consentVersion: LIVE_SHARE_CONSENT_VERSION,
        }),
      });
      const data = await responseJson(response);
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : t("live_share.create_error"),
        );
      }
      applyShareResponse(data);
    } catch (error) {
      setControlError(
        error instanceof Error && error.message
          ? error.message
          : t("live_share.create_error"),
      );
    } finally {
      setBusy(false);
      setDialog(null);
    }
  }, [applyShareResponse, sharePath, t]);

  function beginCreate() {
    setControlError(null);
    setConsentChecked(false);
    dialogOpenerRef.current = document.activeElement as HTMLElement | null;
    setDialog("consent");
  }

  async function confirmConsent() {
    await createShare();
  }

  const stopSender = useCallback(async () => {
    setStopping(true);
    setControlError(null);
    try {
      const response = await fetch(sharePath, { method: "DELETE" });
      const data = await responseJson(response);
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : t("live_share.stop_error"),
        );
      }
      setStage("stopped");
      setSenderStage("ended");
      setShare(null);
      setLocationError(null);
      setScreenPaused(false);
      setLastSentAt(null);
      latestLocationAtRef.current = null;
      shareUrlRef.current = null;
      setDialog(null);
    } catch {
      setControlError(t("live_share.stop_error"));
    } finally {
      setStopping(false);
    }
  }, [sharePath, t]);

  useEffect(() => {
    if (stage !== "active" || !share?.url) return;
    let disposed = false;
    let watchId: number | null = null;
    let sendTimer: number | null = null;
    let retryTimer: number | null = null;
    let inFlight = false;
    let retryAttempt = 0;
    let nextAfterMs = 0;
    let lastAttemptAt = latestLocationAtRef.current;
    let missedWhileHidden = false;
    let latestFix: GeolocationPosition | null = null;
    let wakeSentinel: WakeLockSentinelLike | null = null;
    let activeRequest: AbortController | null = null;

    const releaseWakeLock = () => {
      if (!wakeSentinel) return;
      const current = wakeSentinel;
      wakeSentinel = null;
      void current.release().catch(() => {
        if (!disposed) setWakeLockNote(true);
      });
    };

    const acquireWakeLock = async () => {
      if (wakeSentinel) return;
      const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock;
      if (!wakeLock) {
        setWakeLockNote(true);
        return;
      }
      try {
        const sentinel = await wakeLock.request("screen");
        if (disposed || document.visibilityState !== "visible") {
          await sentinel.release();
          return;
        }
        wakeSentinel = sentinel;
        setWakeLockNote(false);
      } catch {
        if (!disposed) setWakeLockNote(true);
      }
    };

    const clearWatch = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    };

    const scheduleSend = () => {
      if (disposed || !latestFix || document.visibilityState !== "visible") return;
      if (sendTimer !== null) window.clearTimeout(sendTimer);
      const wait = getLocationSendDelayMs(
        Date.now(),
        lastAttemptAt,
        nextAfterMs,
      );
      sendTimer = window.setTimeout(() => {
        sendTimer = null;
        nextAfterMs = 0;
        void sendLatest();
      }, wait);
    };

    const retryNetwork = () => {
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      const wait = Math.max(
        getNetworkRetryDelayMs(retryAttempt),
        getLocationSendDelayMs(Date.now(), lastAttemptAt, nextAfterMs),
      );
      retryAttempt += 1;
      setSenderStage("error");
      setLocationError(t("live_share.network_retry"));
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        void sendLatest();
      }, wait);
    };

    const stopForEndedTrip = () => {
      disposed = true;
      clearWatch();
      activeRequest?.abort();
      activeRequest = null;
      if (sendTimer !== null) window.clearTimeout(sendTimer);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      releaseWakeLock();
      setStage("ended");
      setSenderStage("ended");
      setLocationError(null);
    };

    async function sendLatest() {
      if (
        disposed ||
        inFlight ||
        retryTimer !== null ||
        !latestFix ||
        document.visibilityState !== "visible"
      ) {
        return;
      }
      const position = latestFix;
      if (position.coords.accuracy > MAX_LOCATION_ACCURACY_METERS) {
        setSenderStage("error");
        setLocationError(t("live_share.weak_accuracy"));
        return;
      }
      const delay = getLocationSendDelayMs(
        Date.now(),
        lastAttemptAt,
        nextAfterMs,
      );
      if (delay > 0) {
        scheduleSend();
        return;
      }

      inFlight = true;
      lastAttemptAt = Date.now();
      latestLocationAtRef.current = lastAttemptAt;
      setSenderStage("sending");
      setLocationError(null);
      const controller = new AbortController();
      activeRequest = controller;
      try {
        const response = await fetch(`${sharePath}/location`, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            recordedAt: new Date(position.timestamp).toISOString(),
          }),
        });
        const data = await responseJson(response);
        if (disposed) return;
        if (response.status === 409 || data.state === "ended") {
          stopForEndedTrip();
          return;
        }
        if (typeof data.nextAfterMs === "number" && data.nextAfterMs > 0) {
          nextAfterMs = data.nextAfterMs;
        }
        if (response.ok && data.ok === true) {
          retryAttempt = 0;
          setLastSentAt(Date.now());
          setScreenPaused(false);
          setSenderStage("sending");
          setLocationError(null);
          scheduleSend();
          return;
        }
        if (response.status === 429) {
          setSenderStage("paused");
          scheduleSend();
          return;
        }
        const kind = classifyLocationError({
          status: response.status,
          state: typeof data.state === "string" ? data.state : undefined,
          errorCode:
            typeof data.errorCode === "string" ? data.errorCode : undefined,
        });
        if (kind === "ended") {
          stopForEndedTrip();
          return;
        }
        if (kind === "network") {
          retryNetwork();
          return;
        }
        setSenderStage("error");
        setLocationError(
          kind === "weak_accuracy"
            ? t("live_share.weak_accuracy")
            : t("live_share.error_generic"),
        );
      } catch (error) {
        if (disposed) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        const kind = classifyLocationError({
          network: error instanceof TypeError || error instanceof Error,
        });
        if (kind === "network") retryNetwork();
        else {
          setSenderStage("error");
          setLocationError(t("live_share.error_generic"));
        }
      } finally {
        if (activeRequest === controller) activeRequest = null;
        inFlight = false;
        if (!disposed && latestFix && !sendTimer && !retryTimer) scheduleSend();
      }
    }

    const handlePosition = (position: GeolocationPosition) => {
      latestFix = position;
      if (document.visibilityState !== "visible") {
        missedWhileHidden = true;
        return;
      }
      void sendLatest();
    };

    const handlePositionError = (error: GeolocationPositionError) => {
      if (disposed) return;
      const kind = classifyLocationError({ geolocationCode: error.code });
      setSenderStage("error");
      setLocationError(
        kind === "permission"
          ? `${t("live_share.error_permission")} ${t("live_share.permission_help")}`
          : kind === "unavailable"
            ? t("live_share.error_unavailable")
            : kind === "timeout"
              ? t("live_share.error_timeout")
              : t("live_share.error_generic"),
      );
    };

    const startWatch = () => {
      if (disposed || watchId !== null || !navigator.geolocation) {
        if (!navigator.geolocation) {
          setSenderStage("error");
          setLocationError(t("live_share.error_unavailable"));
        }
        return;
      }
      watchId = navigator.geolocation.watchPosition(
        handlePosition,
        handlePositionError,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
      );
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        missedWhileHidden = true;
        setScreenPaused(true);
        setSenderStage("paused");
        clearWatch();
        if (sendTimer !== null) window.clearTimeout(sendTimer);
        sendTimer = null;
        if (retryTimer !== null) window.clearTimeout(retryTimer);
        retryTimer = null;
        activeRequest?.abort();
        activeRequest = null;
        releaseWakeLock();
        return;
      }
      if (missedWhileHidden) {
        setScreenPaused(true);
        setSenderStage("paused");
      }
      void acquireWakeLock();
      startWatch();
      if (latestFix) void sendLatest();
      missedWhileHidden = false;
    };

    if (document.visibilityState === "visible") {
      void acquireWakeLock();
      startWatch();
    } else {
      missedWhileHidden = true;
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      disposed = true;
      clearWatch();
      activeRequest?.abort();
      if (sendTimer !== null) window.clearTimeout(sendTimer);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      releaseWakeLock();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [share?.url, sharePath, stage, t]);

  useEffect(() => {
    if (lastSentAt === null) return;
    const update = () =>
      setSecondsSinceSent(Math.max(0, Math.floor((Date.now() - lastSentAt) / 1_000)));
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [lastSentAt]);

  async function copyLink() {
    if (!share) return;
    setCopied(false);
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setControlError(null);
    } catch {
      setControlError(t("live_share.copy_error"));
    }
  }

  async function shareWithDevice() {
    if (!share || !navigator.share) return;
    try {
      await navigator.share({ text: buildLiveShareText(locale, share.url) });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setControlError(t("live_share.native_share_error"));
    }
  }

  const formattedLastViewed = share?.lastViewedAt
    ? new Date(share.lastViewedAt).toLocaleString(
        locale === "ar" ? "ar-EG" : "en-EG",
      )
    : null;
  const statusText =
    !pageVisible && stage === "active"
      ? t("live_share.status_paused")
      : senderStage === "ended"
        ? stage === "stopped"
          ? t("live_share.status_stopped")
          : t("live_share.status_ended")
        : senderStage === "paused"
          ? t("live_share.status_paused")
          : senderStage === "error"
            ? t("live_share.status_error")
            : senderStage === "waiting"
              ? t("live_share.status_waiting")
              : t("live_share.status_sending");

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      dir={dir}
      aria-labelledby={`live-share-heading-${tripId}`}
      style={{
        display: "grid",
        gap: 12,
        padding: 14,
        border: "1px solid #B9DDD6",
        borderRadius: 8,
        background: "#F5FBF9",
        color: "#0B1E3D",
      }}
    >
      <h3
        id={`live-share-heading-${tripId}`}
        style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 15 }}
      >
        <MapPin size={18} aria-hidden="true" color="#007A6A" />
        {t("live_share.title")}
      </h3>

      {stage === "loading" && <p style={{ margin: 0 }}>{t("live_share.loading")}</p>}
      {(stage === "idle" || stage === "stopped") && eligible && (
        <>
          {stage === "stopped" && (
            <div aria-live="polite" role="status" style={{ fontSize: 13, fontWeight: 700 }}>
              {t("live_share.status_stopped")}
            </div>
          )}
          <button
            type="button"
            onClick={beginCreate}
            disabled={busy}
            aria-label={t("live_share.share_button")}
            style={primaryButtonStyle}
          >
            <Share2 size={16} aria-hidden="true" />
            {busy ? t("live_share.creating") : t("live_share.share_button")}
          </button>
        </>
      )}
      {stage === "active" && share && (
        <>
          <div
            aria-live="polite"
            role="status"
            style={{ display: "grid", gap: 4, fontSize: 13 }}
          >
            <strong>{statusText}</strong>
            {senderStage === "sending" && lastSentAt !== null && (
              <span>{t("live_share.last_sent", { seconds: secondsSinceSent })}</span>
            )}
            {(screenPaused || !pageVisible) && (
              <span>{t("live_share.paused_screen_off")}</span>
            )}
          </div>
          {locationError && (
            <p role="alert" style={{ margin: 0, color: "#8F2D28", fontSize: 13 }}>
              {locationError}
            </p>
          )}
          {wakeLockNote && (
            <p style={{ margin: 0, fontSize: 12 }}>{t("live_share.wake_lock_note")}</p>
          )}
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>
            {t("live_share.keep_open")}
          </p>
          <label
            htmlFor={`live-share-link-${tripId}`}
            style={{ fontSize: 12, fontWeight: 700 }}
          >
            {t("live_share.link_label")}
          </label>
          <input
            id={`live-share-link-${tripId}`}
            readOnly
            value={share.url}
            dir="ltr"
            onFocus={(event) => event.currentTarget.select()}
            style={linkInputStyle}
          />
          <div style={actionRowStyle}>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                type="button"
                onClick={() => void shareWithDevice()}
                aria-label={t("live_share.share_native")}
                style={secondaryButtonStyle}
              >
                <Share2 size={15} aria-hidden="true" />
                {t("live_share.share_native")}
              </button>
            )}
            <button
              type="button"
              onClick={() => void copyLink()}
              aria-label={t("live_share.copy_link")}
              style={secondaryButtonStyle}
            >
              <Copy size={15} aria-hidden="true" />
              {copied ? t("live_share.copied") : t("live_share.copy_link")}
            </button>
            <a
              href={buildWhatsAppShareUrl(locale, share.url)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("live_share.whatsapp")}
              style={secondaryButtonStyle}
            >
              {t("live_share.whatsapp")}
            </a>
            <a
              href={buildSmsShareUrl(locale, share.url)}
              aria-label={t("live_share.sms")}
              style={secondaryButtonStyle}
            >
              {t("live_share.sms")}
            </a>
          </div>
          <div aria-live="polite" style={{ display: "grid", gap: 4, fontSize: 12 }}>
            <span>{t("live_share.viewer_count", { count: share.viewCount })}</span>
            <span>
              {formattedLastViewed
                ? t("live_share.last_viewed", { time: formattedLastViewed })
                : t("live_share.never_viewed")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              dialogOpenerRef.current = document.activeElement as HTMLElement | null;
              setDialog("stop");
            }}
            aria-label={t("live_share.stop")}
            style={dangerButtonStyle}
          >
            {t("live_share.stop")}
          </button>
        </>
      )}
      {stage === "ended" && (
        <div aria-live="polite" role="status" style={{ fontSize: 13, fontWeight: 700 }}>
          {statusText}
        </div>
      )}
      {controlError && (
        <p role="alert" style={{ margin: 0, color: "#8F2D28", fontSize: 13 }}>
          {controlError}
        </p>
      )}

      {dialog && (
        <div
          style={modalBackdropStyle}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy && !stopping) {
              setDialog(null);
            }
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`live-share-dialog-title-${tripId}`}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !busy && !stopping) setDialog(null);
            }}
            style={modalStyle}
          >
            <h2
              id={`live-share-dialog-title-${tripId}`}
              style={{ margin: "0 0 12px", fontSize: 18 }}
            >
              {dialog === "consent"
                ? t("live_share.consent_title")
                : t("live_share.stop_title")}
            </h2>
            {dialog === "consent" ? (
              <div style={{ display: "grid", gap: 10, fontSize: 14, lineHeight: 1.55 }}>
                <p style={{ margin: 0 }}>{t("live_share.consent_intro")}</p>
                <ul style={{ margin: 0, paddingInlineStart: 22 }}>
                  <li>{t("live_share.consent_bullet_location")}</li>
                  <li>{t("live_share.consent_bullet_points")}</li>
                  <li>{t("live_share.consent_bullet_driver")}</li>
                </ul>
                <p style={{ margin: 0 }}>{t("live_share.consent_body")}</p>
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(event) => setConsentChecked(event.target.checked)}
                    style={{ marginTop: 4, accentColor: "#00A88F" }}
                  />
                  <span>{t("live_share.consent_checkbox")}</span>
                </label>
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#007A6A", fontWeight: 700 }}
                >
                  {t("privacy.notice")}
                </Link>
              </div>
            ) : (
              <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.55 }}>
                {t("live_share.stop_body")}
              </p>
            )}
            <div style={{ ...actionRowStyle, marginTop: 18 }}>
              <button
                ref={dialogActionRef}
                type="button"
                disabled={busy || stopping || (dialog === "consent" && !consentChecked)}
                onClick={() => {
                  if (dialog === "consent") void confirmConsent();
                  else void stopSender();
                }}
                aria-label={
                  dialog === "consent"
                    ? t("live_share.confirm")
                    : t("live_share.stop_confirm")
                }
                style={dialog === "stop" ? dangerButtonStyle : primaryButtonStyle}
              >
                {dialog === "consent"
                  ? busy
                    ? t("live_share.creating")
                    : t("live_share.confirm")
                  : stopping
                    ? t("live_share.stopping")
                    : t("live_share.stop_confirm")}
              </button>
              <button
                type="button"
                disabled={busy || stopping}
                onClick={() => setDialog(null)}
                aria-label={t("live_share.cancel")}
                style={secondaryButtonStyle}
              >
                {t("live_share.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const actionRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
} as const;

const primaryButtonStyle = {
  display: "inline-flex",
  minHeight: 44,
  justifyContent: "center",
  alignItems: "center",
  gap: 8,
  padding: "10px 14px",
  border: "1px solid #007A6A",
  borderRadius: 7,
  background: "#007A6A",
  color: "#fff",
  font: "inherit",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
} as const;

const secondaryButtonStyle = {
  display: "inline-flex",
  minHeight: 42,
  justifyContent: "center",
  alignItems: "center",
  gap: 6,
  padding: "9px 11px",
  border: "1px solid #B9CBC6",
  borderRadius: 7,
  background: "#fff",
  color: "#0B1E3D",
  font: "inherit",
  fontSize: 12,
  fontWeight: 700,
  textDecoration: "none",
  cursor: "pointer",
} as const;

const dangerButtonStyle = {
  ...primaryButtonStyle,
  borderColor: "#A33A32",
  background: "#A33A32",
} as const;

const linkInputStyle = {
  width: "100%",
  minWidth: 0,
  minHeight: 42,
  boxSizing: "border-box" as const,
  padding: "9px 10px",
  border: "1px solid #B9CBC6",
  borderRadius: 7,
  background: "#fff",
  color: "#0B1E3D",
  font: "inherit",
  fontSize: 12,
} as const;

const modalBackdropStyle = {
  position: "fixed" as const,
  inset: 0,
  zIndex: 100,
  display: "grid",
  placeItems: "center",
  padding: 16,
  background: "rgba(11, 30, 61, 0.62)",
};

const modalStyle = {
  width: "min(100%, 480px)",
  maxHeight: "min(85dvh, 720px)",
  overflowY: "auto" as const,
  padding: 22,
  border: "1px solid #DCE6E4",
  borderRadius: 12,
  background: "#fff",
  color: "#0B1E3D",
  boxShadow: "0 18px 60px rgba(11,30,61,.24)",
};
