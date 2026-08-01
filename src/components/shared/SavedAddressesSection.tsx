"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Bookmark, Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";
const LocationPickerMap = dynamic(
  () => import("@/components/map/LocationPickerMapOsm"),
  { ssr: false },
);
import type { SavedAddress } from "@/types/shared";
import type { TripPoint } from "@/lib/store/useTripStore";

interface Props {
  initialAddresses: SavedAddress[];
}

interface AddrForm {
  open: boolean;
  editId: string | null;
  label: string;
  otherLabel: string;
  point: TripPoint | null;
  saving: boolean;
  error: string;
}

const BLANK_FORM: AddrForm = {
  open: false,
  editId: null,
  label: "",
  otherLabel: "",
  point: null,
  saving: false,
  error: "",
};

const PRESET_LABELS = ["Home", "Work"];

export default function SavedAddressesSection({ initialAddresses }: Props) {
  const [addresses, setAddresses] = useState<SavedAddress[]>(initialAddresses);
  const [addrForm, setAddrForm] = useState<AddrForm>(BLANK_FORM);

  function openAddForm() {
    setAddrForm({ ...BLANK_FORM, open: true });
  }

  function openEditForm(a: SavedAddress) {
    const isPreset = PRESET_LABELS.includes(a.label);
    setAddrForm({
      open: true,
      editId: a._id,
      label: isPreset ? a.label : "Other",
      otherLabel: isPreset ? "" : a.label,
      point: { address: a.address, lat: a.lat, lng: a.lng },
      saving: false,
      error: "",
    });
  }

  function closeAddrForm() {
    setAddrForm((prev) => ({ ...prev, open: false, error: "" }));
  }

  async function saveAddress() {
    const resolvedLabel =
      addrForm.label === "Other" ? addrForm.otherLabel.trim() : addrForm.label;
    if (!resolvedLabel) {
      setAddrForm((prev) => ({ ...prev, error: "Label required." }));
      return;
    }
    if (!addrForm.point) {
      setAddrForm((prev) => ({ ...prev, error: "Select an address." }));
      return;
    }
    setAddrForm((prev) => ({ ...prev, saving: true, error: "" }));
    try {
      const body = {
        label: resolvedLabel,
        address: addrForm.point.address,
        lat: addrForm.point.lat,
        lng: addrForm.point.lng,
      };
      let res: Response;
      if (addrForm.editId) {
        res = await fetch(`/api/auth/addresses/${addrForm.editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/auth/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        setAddrForm((prev) => ({
          ...prev,
          saving: false,
          error: data.error ?? "Failed.",
        }));
        return;
      }
      if (addrForm.editId) {
        setAddresses((prev) =>
          prev.map((a) => (a._id === addrForm.editId ? data.savedAddress : a)),
        );
      } else {
        setAddresses((prev) => [...prev, data.savedAddress]);
      }
      setAddrForm(BLANK_FORM);
    } catch {
      setAddrForm((prev) => ({
        ...prev,
        saving: false,
        error: "Network error.",
      }));
    }
  }

  async function deleteAddress(id: string) {
    setAddresses((prev) => prev.filter((a) => a._id !== id));
    try {
      await fetch(`/api/auth/addresses/${id}`, { method: "DELETE" });
    } catch {
      /* non-fatal — optimistic delete */
    }
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #eef0f3",
        padding: "24px",
        marginTop: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "#0B1E3D",
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Bookmark size={16} style={{ color: "#00C2A8" }} aria-hidden="true" />
          Saved places
        </h2>
        <button
          type="button"
          onClick={openAddForm}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            background: "#0B1E3D",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "inherit",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#00C2A8";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#0B1E3D";
          }}
        >
          <Plus size={14} aria-hidden="true" />
          Add place
        </button>
      </div>

      {/* Add / Edit form */}
      {addrForm.open && (
        <div
          style={{
            background: "#f8f9fa",
            borderRadius: 12,
            border: "1.5px solid #e8edf0",
            padding: "16px",
            marginBottom: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0B1E3D" }}>
              {addrForm.editId ? "Edit place" : "Add new place"}
            </span>
            <button
              type="button"
              onClick={closeAddrForm}
              aria-label="Close"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#5A6A7A",
                padding: 4,
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div>
            <label
              htmlFor="addr-label"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#0B1E3D",
                display: "block",
                marginBottom: 6,
              }}
            >
              Label
            </label>
            <select
              id="addr-label"
              value={addrForm.label}
              onChange={(e) =>
                setAddrForm((prev) => ({
                  ...prev,
                  label: e.target.value,
                  otherLabel: e.target.value !== "Other" ? "" : prev.otherLabel,
                }))
              }
              style={{
                width: "100%",
                height: 44,
                padding: "0 14px",
                borderRadius: 10,
                border: "1.5px solid #d0d8e0",
                fontSize: 15,
                fontFamily: "inherit",
                color: "#0B1E3D",
                background: "#fff",
                outline: "none",
                boxSizing: "border-box",
                cursor: "pointer",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#00C2A8")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#d0d8e0")}
            >
              <option value="">Select…</option>
              <option value="Home">Home</option>
              <option value="Work">Work</option>
              <option value="Other">Other…</option>
            </select>
            {addrForm.label === "Other" && (
              <input
                type="text"
                value={addrForm.otherLabel}
                onChange={(e) =>
                  setAddrForm((prev) => ({
                    ...prev,
                    otherLabel: e.target.value,
                  }))
                }
                style={{
                  marginTop: 8,
                  width: "100%",
                  height: 44,
                  padding: "0 14px",
                  borderRadius: 10,
                  border: "1.5px solid #d0d8e0",
                  fontSize: 15,
                  fontFamily: "inherit",
                  color: "#0B1E3D",
                  background: "#fff",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#00C2A8")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#d0d8e0")}
              />
            )}
          </div>

          <div>
            <label
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#0B1E3D",
                display: "block",
                marginBottom: 6,
              }}
            >
              Location
            </label>
            <LocationPickerMap
              lat={addrForm.point ? String(addrForm.point.lat) : ""}
              lng={addrForm.point ? String(addrForm.point.lng) : ""}
              name={addrForm.point?.address ?? ""}
              onChange={(lat, lng, name) =>
                setAddrForm((prev) => ({
                  ...prev,
                  point:
                    lat && lng
                      ? {
                          address: name,
                          lat: parseFloat(lat),
                          lng: parseFloat(lng),
                        }
                      : null,
                }))
              }
            />
          </div>

          {addrForm.error && (
            <p
              role="alert"
              style={{
                fontSize: 13,
                color: "#e74c3c",
                margin: 0,
                padding: "8px 12px",
                background: "rgba(231,76,60,0.07)",
                borderRadius: 8,
              }}
            >
              {addrForm.error}
            </p>
          )}

          <button
            type="button"
            onClick={saveAddress}
            disabled={addrForm.saving}
            style={{
              height: 44,
              background: addrForm.saving ? "#9aa8b5" : "#0B1E3D",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              border: "none",
              borderRadius: 10,
              cursor: addrForm.saving ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => {
              if (!addrForm.saving)
                e.currentTarget.style.background = "#00C2A8";
            }}
            onMouseLeave={(e) => {
              if (!addrForm.saving)
                e.currentTarget.style.background = "#0B1E3D";
            }}
          >
            {addrForm.saving ? (
              <>
                <Loader2
                  size={14}
                  style={{ animation: "spin 0.7s linear infinite" }}
                />
                Saving…
              </>
            ) : addrForm.editId ? (
              "Update place"
            ) : (
              "Save place"
            )}
          </button>
        </div>
      )}

      {/* Address list */}
      {addresses.length === 0 && !addrForm.open && (
        <p style={{ fontSize: 14, color: "#9aa5b4", margin: 0 }}>
          No saved places yet. Add one to reuse it when booking.
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {addresses.map((a) => (
          <div
            key={a._id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              background: "#f8f9fa",
              borderRadius: 10,
              border: "1.5px solid #eef0f3",
            }}
          >
            <Bookmark
              size={16}
              style={{ color: "#00C2A8", flexShrink: 0 }}
              aria-hidden="true"
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#0B1E3D",
                }}
              >
                {a.label}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "#5A6A7A",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {a.address}
              </span>
            </div>
            <button
              type="button"
              onClick={() => openEditForm(a)}
              aria-label={`Edit ${a.label}`}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#5A6A7A",
                padding: 6,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#0B1E3D";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#5A6A7A";
              }}
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => deleteAddress(a._id)}
              aria-label={`Delete ${a.label}`}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#e74c3c",
                padding: 6,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(231,76,60,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
