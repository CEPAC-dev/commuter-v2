import type {
  CSSProperties,
  FormHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  type LucideIcon,
} from "lucide-react";

const pageWidth = 1120;

export function AdminPageContainer({
  children,
  maxWidth = pageWidth,
  style,
}: {
  children: ReactNode;
  maxWidth?: number;
  style?: CSSProperties;
}) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--color-surface)",
        padding: "32px 20px 80px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth,
          margin: "0 auto",
          display: "grid",
          gap: 20,
          ...style,
        }}
      >
        {children}
      </div>
    </main>
  );
}

export function AdminPageHeader({
  title,
  description,
  eyebrow = "Admin panel",
  breadcrumb,
  actions,
  icon: Icon,
}: {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {Icon ? (
          <span
            aria-hidden="true"
            style={{
              width: 42,
              height: 42,
              borderRadius: "var(--radius-md)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              background: "var(--color-secondary-tint)",
              color: "var(--color-secondary)",
            }}
          >
            <Icon size={20} />
          </span>
        ) : null}
        <div>
          {breadcrumb ?? (
            <p
              style={{
                margin: 0,
                color: "var(--color-secondary)",
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
              }}
            >
              {eyebrow}
            </p>
          )}
          <h1
            style={{
              margin: "6px 0 0",
              color: "var(--color-primary)",
              fontSize: "clamp(26px, 4vw, 34px)",
              lineHeight: 1.15,
            }}
          >
            {title}
          </h1>
          {description ? (
            <p
              style={{
                margin: "7px 0 0",
                color: "var(--color-muted, var(--color-text-muted))",
                fontSize: 14,
                lineHeight: 1.6,
                maxWidth: 680,
              }}
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function AdminCard({
  children,
  title,
  description,
  actions,
  padding = 20,
  style,
  ...props
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  padding?: CSSProperties["padding"];
}) {
  return (
    <section
      {...props}
      style={{
        background: "var(--color-panel)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        boxShadow: "0 10px 28px var(--color-shadow)",
        overflow: "hidden",
        ...style,
      }}
    >
      {title || description || actions ? (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            padding,
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div>
            {title ? <h2 style={{ margin: 0, color: "var(--color-primary)", fontSize: 17 }}>{title}</h2> : null}
            {description ? <p style={{ margin: "5px 0 0", color: "var(--color-muted, var(--color-text-muted))", fontSize: 13 }}>{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div style={{ padding }}>{children}</div>
    </section>
  );
}

type StateProps = { title: string; description?: string; action?: ReactNode };

function AdminState({ title, description, action, icon: Icon }: StateProps & { icon: LucideIcon }) {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--color-muted, var(--color-text-muted))" }}>
      <Icon size={24} aria-hidden="true" style={{ margin: "0 auto 10px" }} />
      <p style={{ margin: 0, color: "var(--color-primary)", fontWeight: 700 }}>{title}</p>
      {description ? <p style={{ margin: "5px auto 0", maxWidth: 480, fontSize: 13 }}>{description}</p> : null}
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  );
}

export function AdminEmptyState(props: StateProps) {
  return <AdminState {...props} icon={Inbox} />;
}

export function AdminLoadingState({ title = "Loading...", description }: Partial<StateProps>) {
  return <AdminState title={title} description={description} icon={Loader2} />;
}

export function AdminErrorState(props: StateProps) {
  return <AdminState {...props} icon={AlertCircle} />;
}

type StatusTone = "success" | "danger" | "warning" | "info" | "muted";

const statusTones: Record<string, StatusTone> = {
  active: "success",
  approved: "success",
  completed: "success",
  paid: "success",
  submitted: "success",
  verified: "success",
  cancelled: "muted",
  disabled: "muted",
  inactive: "muted",
  paused: "muted",
  failed: "danger",
  rejected: "danger",
  error: "danger",
  pending: "warning",
  pending_payment: "warning",
  processing: "info",
  in_progress: "info",
  matched: "info",
};

const toneColors: Record<StatusTone, string> = {
  success: "var(--color-success)",
  danger: "var(--color-danger)",
  warning: "var(--color-warning)",
  info: "var(--color-info, var(--color-primary-mid))",
  muted: "var(--color-muted, var(--color-text-muted))",
};

export function AdminStatusBadge({
  status,
  label,
  tone,
}: {
  status: string;
  label?: string;
  tone?: StatusTone;
}) {
  const normalized = status.toLowerCase().replace(/\s+/g, "_");
  const color = toneColors[tone ?? statusTones[normalized] ?? "muted"];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 24,
        padding: "3px 9px",
        borderRadius: 999,
        background: `color-mix(in srgb, ${color} 12%, var(--color-panel))`,
        color,
        fontSize: 11,
        fontWeight: 800,
        textTransform: "capitalize",
      }}
    >
      {label ?? normalized.replace(/_/g, " ")}
    </span>
  );
}

export function AdminTable({ children, ariaLabel }: { children: ReactNode; ariaLabel?: string }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        aria-label={ariaLabel}
        style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}
      >
        {children}
      </table>
    </div>
  );
}

export function AdminPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const buttonStyle: CSSProperties = {
    width: 36,
    height: 36,
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-sm)",
    background: "var(--color-panel)",
    color: "var(--color-primary)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
  return (
    <nav aria-label="Pagination" style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
      <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)} style={buttonStyle}>
        <ChevronLeft size={16} />
      </button>
      <span style={{ color: "var(--color-muted, var(--color-text-muted))", fontSize: 13 }}>
        Page {page} of {totalPages}
      </span>
      <button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} style={buttonStyle}>
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

export function AdminFormLayout({ children, style, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form {...props} style={{ display: "grid", gap: 0, ...style }}>
      {children}
    </form>
  );
}

export function AdminFormField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ color: "var(--color-primary)", fontSize: 13, fontWeight: 700 }}>{label}</span>
      {children}
      {error ? (
        <span style={{ color: "var(--color-danger)", fontSize: 12 }}>{error}</span>
      ) : hint ? (
        <span style={{ color: "var(--color-muted, var(--color-text-muted))", fontSize: 12 }}>{hint}</span>
      ) : null}
    </label>
  );
}