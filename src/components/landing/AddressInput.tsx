"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MapPin, Loader2, X, Bookmark } from "lucide-react";
import {
  searchAddress,
  getPlaceDetails,
  formatDisplayName,
} from "@/lib/nominatim";
import type { TripPoint } from "@/lib/store/useTripStore";
import type { SavedAddress } from "@/types/shared";
import { useMapSearchProvider } from "@/lib/MapSearchContext";

interface Props {
  placeholder: string;
  label?: React.ReactNode;
  value: TripPoint | null;
  onChange: (p: TripPoint | null) => void;
  validateLocation?: (point: TripPoint) => boolean;
  icon?: React.ReactNode;
  iconColor?: string;
  id?: string;
  savedAddresses?: SavedAddress[];
}

interface Suggestion {
  place_id: string;
  display_name: string;
}

export default function AddressInput({
  placeholder,
  label,
  value,
  onChange,
  validateLocation,
  icon,
  iconColor = "#00C2A8",
  id,
  savedAddresses = [],
}: Props) {
  const provider = useMapSearchProvider();
  const [query, setQuery] = useState(
    value ? formatDisplayName(value.address) : "",
  );
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    placement: "above" | "below";
  } | null>(null);
  const listId = `${id ?? "addr"}-list`;

  useEffect(() => {
    // Sync query with value prop changes
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(value ? formatDisplayName(value.address) : "");
  }, [value]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (
        wrapRef.current &&
        !wrapRef.current.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setOpen(false);
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!q || q.length < 3) {
        setResults([]);
        setOpen(false);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        const r = await searchAddress(q, provider);
        setResults(r);
        setOpen(r.length > 0);
        setLoading(false);
      }, 650);
    },
    [provider],
  );

  // Saved addresses filtered by query
  const filteredSaved = savedAddresses.filter((s) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      s.label.toLowerCase().includes(q) || s.address.toLowerCase().includes(q)
    );
  });
  const showSavedSection = focused && filteredSaved.length > 0;
  const showDropdown = showSavedSection || (open && results.length > 0);

  const positionDropdown = useCallback(() => {
    const anchor = wrapRef.current?.getBoundingClientRect();
    if (!anchor) return;
    if (anchor.bottom < 0 || anchor.top > window.innerHeight) {
      setDropdownPosition(null);
      return;
    }

    const spaceBelow = window.innerHeight - anchor.bottom - 6;
    const spaceAbove = anchor.top - 6;
    const placement =
      spaceBelow < 220 && spaceAbove > spaceBelow ? "above" : "below";
    const availableSpace = placement === "above" ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(80, Math.min(260, availableSpace - 8));
    const width = Math.min(anchor.width, window.innerWidth - 16);
    const left = Math.max(
      8,
      Math.min(anchor.left, window.innerWidth - width - 8),
    );

    setDropdownPosition({
      top: placement === "above" ? anchor.top - 6 : anchor.bottom + 6,
      left,
      width,
      maxHeight,
      placement,
    });
  }, []);

  useEffect(() => {
    if (!showDropdown) return;
    positionDropdown();
    window.addEventListener("resize", positionDropdown);
    window.addEventListener("scroll", positionDropdown, true);
    return () => {
      window.removeEventListener("resize", positionDropdown);
      window.removeEventListener("scroll", positionDropdown, true);
    };
  }, [showDropdown, positionDropdown]);

  async function select(item: Suggestion) {
    setOpen(false);
    setFocused(false);
    setResults([]);
    setQuery(formatDisplayName(item.display_name));
    setLoading(true);
    try {
      const { lat, lng } = await getPlaceDetails(item.place_id, provider);
      const point = { address: item.display_name, lat, lng };
      if (validateLocation && !validateLocation(point)) {
        setLoading(false);
        return;
      }
      onChange(point);
    } catch {
      onChange(null);
    } finally {
      setLoading(false);
    }
  }

  function selectSaved(s: SavedAddress) {
    setOpen(false);
    setFocused(false);
    setResults([]);
    setQuery(s.label);
    const point = { address: s.address, lat: s.lat, lng: s.lng };
    if (validateLocation && !validateLocation(point)) return;
    onChange(point);
  }

  function clear() {
    setQuery("");
    setResults([]);
    setOpen(false);
    onChange(null);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setFocused(false);
    }
  }

  const isFilled = !!(query || value);

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <label
        htmlFor={id}
        style={{
          ...(label
            ? {
                position: "absolute",
                top: -8,
                left: 12,
                zIndex: 1,
                padding: "0 5px",
                background: "#f8f9fa",
                color: "#00C2A8",
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1.2,
              }
            : {
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0,0,0,0)",
              }),
        }}
      >
        {label ?? placeholder}
      </label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 12px",
          height: 52,
          background: "#f8f9fa",
          borderRadius: 5,
          border: "1.5px solid rgb(200, 232, 228)",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
        onFocusCapture={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#00C2A8";
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 0 0 3px rgba(0,194,168,0.12)";
        }}
        onBlurCapture={(e) => {
          if (!wrapRef.current?.contains(e.relatedTarget as Node)) {
            (e.currentTarget as HTMLDivElement).style.borderColor =
              "rgb(200, 232, 228)";
            (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
          }
        }}
      >
        <span
          style={{
            color: iconColor,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
          }}
          aria-hidden="true"
        >
          {loading ? (
            <Loader2 size={18} className="spin" />
          ) : (
            (icon ?? <MapPin size={18} />)
          )}
        </span>
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            search(e.target.value);
            if (!e.target.value) onChange(null);
          }}
          onFocus={() => {
            setFocused(true);
            if (results.length) setOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => {
              setFocused(false);
              setOpen(false);
            }, 150);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 15,
            fontFamily: "inherit",
            color: "#0B1E3D",
            minWidth: 0,
          }}
        />
        {isFilled && (
          <button
            type="button"
            onClick={clear}
            aria-label={`Clear ${placeholder}`}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#5A6A7A",
              padding: 4,
              flexShrink: 0,
              minWidth: 28,
              minHeight: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 5,
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {showDropdown &&
        dropdownPosition &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            ref={dropdownRef}
            id={listId}
            role="listbox"
            aria-label={`${placeholder} suggestions`}
            style={{
              position: "fixed",
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              transform:
                dropdownPosition.placement === "above"
                  ? "translateY(-100%)"
                  : undefined,
              background: "#ffffff",
              border: "1.5px solid rgb(200, 232, 228)",
              borderRadius: 5,
              boxShadow: "0 8px 32px rgba(11,30,61,0.13)",
              listStyle: "none",
              margin: 0,
              padding: "4px 0",
              maxHeight: dropdownPosition.maxHeight,
              overflowY: "auto",
              zIndex: 9999999,
            }}
          >
            {/* Saved addresses section */}
            {showSavedSection && (
              <>
                <li
                  style={{
                    padding: "6px 14px 4px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#9aa5b4",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    listStyle: "none",
                  }}
                >
                  <Bookmark size={11} aria-hidden="true" />
                  Saved places
                </li>
                {filteredSaved.map((s) => (
                  <li
                    key={s._id}
                    role="option"
                    aria-selected={false}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectSaved(s);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 14px",
                      cursor: "pointer",
                      fontSize: 14,
                      color: "#0B1E3D",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLLIElement).style.background =
                        "rgb(200, 232, 228)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLLIElement).style.background =
                        "transparent";
                    }}
                  >
                    <Bookmark
                      size={14}
                      style={{ color: "#00C2A8", flexShrink: 0 }}
                      aria-hidden="true"
                    />
                    <span>
                      <span style={{ fontWeight: 700 }}>{s.label}</span>
                      <span
                        style={{
                          color: "#5A6A7A",
                          fontSize: 12,
                          display: "block",
                          marginTop: 1,
                        }}
                      >
                        {formatDisplayName(s.address)}
                      </span>
                    </span>
                  </li>
                ))}
                {open && results.length > 0 && (
                  <li
                    style={{
                      height: 1,
                      background: "#eef0f3",
                      margin: "4px 0",
                      listStyle: "none",
                      padding: 0,
                    }}
                  />
                )}
              </>
            )}

            {/* Search results section */}
            {open &&
              results.map((r) => (
                <li
                  key={r.place_id}
                  role="option"
                  aria-selected={false}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(r);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 14px",
                    cursor: "pointer",
                    fontSize: 14,
                    color: "#0B1E3D",
                    lineHeight: 1.4,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLLIElement).style.background =
                      "#eff7f6";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLLIElement).style.background =
                      "transparent";
                  }}
                >
                  <MapPin
                    size={14}
                    style={{ color: "#00C2A8", marginTop: 2, flexShrink: 0 }}
                    aria-hidden="true"
                  />
                  <span>{formatDisplayName(r.display_name)}</span>
                </li>
              ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}
