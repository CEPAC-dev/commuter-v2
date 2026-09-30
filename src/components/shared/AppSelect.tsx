"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export type AppSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export default function AppSelect({
  id,
  value,
  options,
  placeholder,
  onValueChange,
  className,
}: {
  id?: string;
  value: string;
  options: AppSelectOption[];
  placeholder: string;
  onValueChange: (value: string) => void;
  className?: string;
}) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    placement: "above" | "below";
  } | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value);
  const updatePosition = () => {
    if (!button.current) return;
    const rect = button.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const placement =
      spaceBelow < 220 && spaceAbove > spaceBelow ? "above" : "below";
    const availableSpace = placement === "above" ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(80, Math.min(320, availableSpace - 12));
    const width = Math.min(rect.width, window.innerWidth - 16);
    const left = Math.max(
      8,
      Math.min(rect.left, window.innerWidth - width - 8),
    );
    setPosition({
      top:
        placement === "above"
          ? rect.top + window.scrollY - 8
          : rect.bottom + window.scrollY + 8,
      left: left + window.scrollX,
      width,
      maxHeight,
      placement,
    });
  };
  useEffect(() => {
    if (!open) return;
    updatePosition();
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !menu.current?.contains(target))
        setOpen(false);
    };
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("mousedown", close);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", close);
    };
  }, [open]);
  function choose(option: AppSelectOption) {
    if (option.disabled) return;
    onValueChange(option.value);
    setOpen(false);
    button.current?.focus();
  }
  return (
    <div ref={root} className={`app-select ${className ?? ""}`}>
      <button
        ref={button}
        id={controlId}
        type="button"
        className="app-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          updatePosition();
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (["ArrowDown", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            updatePosition();
            setOpen(true);
          }
        }}
      >
        <span className={selected ? "" : "is-placeholder"}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menu}
              className="app-select-menu"
              role="listbox"
              aria-labelledby={controlId}
              style={{
                position: "absolute",
                top: position.top,
                left: position.left,
                width: position.width,
                maxHeight: position.maxHeight,
                transform:
                  position.placement === "above"
                    ? "translateY(-100%)"
                    : undefined,
              }}
            >
              {options.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  disabled={option.disabled}
                  className={`app-select-option${option.value === value ? " is-selected" : ""}`}
                  onClick={() => choose(option)}
                >
                  <span>{option.label}</span>
                  {option.value === value ? (
                    <Check size={17} aria-hidden="true" />
                  ) : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
