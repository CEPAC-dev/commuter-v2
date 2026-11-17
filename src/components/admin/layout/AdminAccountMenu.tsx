"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef } from "react";
import { ChevronDown, UserRound } from "lucide-react";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";

interface AdminAccountMenuProps {
  admin: {
    name: string;
    email: string;
    profilePic: string | null;
  };
  profileHref: string;
}

export default function AdminAccountMenu({
  admin,
  profileHref,
}: AdminAccountMenuProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const initials = admin.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <details ref={menuRef} className="admin-account-menu">
      <summary className="admin-account-trigger" aria-label="Admin account menu">
        {admin.profilePic ? (
          <Image
            className="admin-account-avatar"
            src={admin.profilePic}
            alt=""
            width={34}
            height={34}
            unoptimized
          />
        ) : (
          <span className="admin-account-avatar admin-account-avatar-fallback">
            {initials || <UserRound size={18} aria-hidden="true" />}
          </span>
        )}
        <span className="admin-account-name">{admin.name}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </summary>
      <div className="admin-account-dropdown">
        <div className="admin-account-details">
          <strong>{admin.name}</strong>
          {admin.email ? <span>{admin.email}</span> : null}
        </div>
        <Link
          href={profileHref}
          className="admin-account-profile-link"
          onClick={() => {
            if (menuRef.current) menuRef.current.open = false;
          }}
        >
          <UserRound size={16} aria-hidden="true" />
          Profile
        </Link>
        <AdminLogoutButton />
      </div>
    </details>
  );
}
