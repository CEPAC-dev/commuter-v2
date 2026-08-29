"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface TripChatButtonProps {
  tripInstanceId: number;
  role: "user" | "driver";
  courseId?: number;
}

function MessageIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function TripChatButton({
  tripInstanceId,
  role,
  courseId,
}: TripChatButtonProps) {
  const t = useTranslations("trip_chat");
  const router = useRouter();

  const btnLabel =
    role === "user" ? t("chat_with_driver") : t("chat_with_passenger");

  // Build path based on role
  const path =
    role === "user"
      ? `/user/my-requests/${courseId || tripInstanceId}/chat`
      : `/driver/my-cycles/${courseId || tripInstanceId}/chat`;

  function handleClick() {
    router.push(path);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "12px 18px",
        background: "linear-gradient(135deg, #00C2A8 0%, #00A896 100%)",
        color: "#fff",
        border: "none",
        borderRadius: 14,
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
        justifyContent: "center",
        boxShadow: "0 2px 8px rgba(0,194,168,0.25)",
      }}
    >
      <MessageIcon />
      {btnLabel}
    </button>
  );
}
