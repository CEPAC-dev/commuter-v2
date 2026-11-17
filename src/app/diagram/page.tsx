import type { CSSProperties, ReactNode } from "react";

const useHostTheme = () => ({
  text: { primary: "#1f2937", secondary: "#6b7280" },
  bg: { editor: "#f9fafb" },
  stroke: { primary: "#d1d5db", secondary: "#9ca3af" },
  fill: { tertiary: "#ffffff" },
  accent: { primary: "#2563eb" },
});

function Stack({
  children,
  gap,
  style,
}: {
  children: ReactNode;
  gap: number;
  style?: CSSProperties;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap, ...style }}>
      {children}
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <section
      style={{
        border: "1px solid #d1d5db",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {children}
    </section>
  );
}

function CardHeader({ children }: { children: ReactNode }) {
  return (
    <h2
      style={{
        margin: 0,
        padding: "12px 16px",
        borderBottom: "1px solid #d1d5db",
        fontSize: 16,
      }}
    >
      {children}
    </h2>
  );
}

function CardBody({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return <div style={style}>{children}</div>;
}

function H1({ children }: { children: ReactNode }) {
  return <h1 style={{ margin: "0 0 8px", fontSize: 28 }}>{children}</h1>;
}

function H2({ children }: { children: ReactNode }) {
  return <h2 style={{ margin: "0 0 8px", fontSize: 22 }}>{children}</h2>;
}

function Text({
  children,
  tone,
  size,
}: {
  children: ReactNode;
  tone?: "secondary" | "tertiary";
  size?: "small";
}) {
  const color =
    tone === "secondary"
      ? "#6b7280"
      : tone === "tertiary"
        ? "#9ca3af"
        : undefined;
  return (
    <p
      style={{
        margin: "0 0 8px",
        color,
        fontSize: size === "small" ? 12 : undefined,
      }}
    >
      {children}
    </p>
  );
}

const useCases = [
  { key: "view", x: 430, y: 155, lines: ["View trip status", "and route"] },
  { key: "payment", x: 765, y: 155, lines: ["Pay or retry", "checkout"] },
  {
    key: "offer",
    x: 430,
    y: 285,
    lines: ["Accept: convert to private", "Decline: cancel trip"],
  },
  {
    key: "cancel",
    x: 765,
    y: 285,
    lines: ["Cancel trip / inspect", "refund decision"],
  },
  {
    key: "live",
    x: 430,
    y: 415,
    lines: ["View pickup PIN", "and live driver map"],
  },
  { key: "chat", x: 765, y: 415, lines: ["Chat / share live", "location"] },
  { key: "rate", x: 430, y: 545, lines: ["Rate completed", "trip"] },
  {
    key: "support",
    x: 765,
    y: 545,
    lines: ["Report, even after rating", "Request no-show review"],
  },
];

function Actor({
  x,
  y,
  label,
  theme,
}: {
  x: number;
  y: number;
  label: string;
  theme: ReturnType<typeof useHostTheme>;
}) {
  return (
    <g
      stroke={theme.text.secondary}
      fill="none"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <circle cx={x} cy={y - 28} r="12" />
      <path
        d={`M ${x} ${y - 16} L ${x} ${y + 22} M ${x - 20} ${y - 2} L ${x + 20} ${y - 2} M ${x} ${y + 22} L ${x - 16} ${y + 42} M ${x} ${y + 22} L ${x + 16} ${y + 42}`}
      />
      <text
        x={x}
        y={y + 62}
        textAnchor="middle"
        stroke="none"
        fill={theme.text.primary}
        fontSize="14"
        fontWeight="600"
      >
        {label}
      </text>
    </g>
  );
}

export default function PassengerTripUseCases() {
  const theme = useHostTheme();
  return (
    <Stack
      gap={14}
      style={{ maxWidth: 1120, padding: 20, color: theme.text.primary }}
    >
      <div>
        <H1>Passenger trip detail — use cases</H1>
        <Text tone="secondary">
          GET /api/trips/{"{id}"} returns the server-computed displayStatus and
          availableActions for the current trip, request, and payment state.
        </Text>
      </div>
      <Card>
        <CardHeader>Use-case diagram</CardHeader>
        <CardBody style={{ padding: 10 }}>
          <svg
            viewBox="0 0 1120 660"
            role="img"
            aria-label="Passenger use cases for the trip detail page"
            style={{ display: "block", width: "100%", height: "auto" }}
          >
            <rect
              x="250"
              y="48"
              width="700"
              height="570"
              rx="12"
              fill={theme.bg.editor}
              stroke={theme.stroke.primary}
              strokeWidth="1.5"
            />
            <text
              x="270"
              y="76"
              fill={theme.text.secondary}
              fontSize="13"
              fontWeight="600"
            >
              Commuter · /my-trips/[id]
            </text>

            {useCases.map((item) => (
              <path
                key={`passenger-${item.key}`}
                d={`M 155 330 C 210 330, 225 ${item.y}, ${item.x - 124} ${item.y}`}
                fill="none"
                stroke={theme.stroke.secondary}
                strokeWidth="1.2"
              />
            ))}
            <path
              d="M 1000 155 L 890 155"
              fill="none"
              stroke={theme.accent.primary}
              strokeWidth="1.8"
            />
            <path
              d="M 1000 365 C 960 365, 955 415, 890 415"
              fill="none"
              stroke={theme.stroke.secondary}
              strokeWidth="1.5"
            />
            <path
              d="M 1000 365 C 850 365, 700 415, 555 415"
              fill="none"
              stroke={theme.stroke.secondary}
              strokeWidth="1.5"
            />
            <path
              d="M 1000 545 L 890 545"
              fill="none"
              stroke={theme.stroke.secondary}
              strokeWidth="1.5"
            />

            {useCases.map((item) => (
              <g key={item.key}>
                <ellipse
                  cx={item.x}
                  cy={item.y}
                  rx="124"
                  ry="39"
                  fill={theme.fill.tertiary}
                  stroke={theme.stroke.primary}
                  strokeWidth="1.4"
                />
                <text
                  x={item.x}
                  y={item.y - 3}
                  textAnchor="middle"
                  fill={theme.text.primary}
                  fontSize="13"
                  fontWeight="600"
                >
                  <tspan x={item.x} dy="0">
                    {item.lines[0]}
                  </tspan>
                  <tspan x={item.x} dy="17">
                    {item.lines[1]}
                  </tspan>
                </text>
              </g>
            ))}

            <Actor x={108} y={330} label="Passenger" theme={theme} />
            <Actor x={1040} y={125} label="Kashier" theme={theme} />
            <Actor x={1040} y={335} label="Driver / contact" theme={theme} />
            <Actor x={1040} y={515} label="Support team" theme={theme} />
          </svg>
          <Text size="small" tone="tertiary">
            Solid associations show who participates; passenger authentication
            and ownership are checked by Commuter APIs.
          </Text>
        </CardBody>
      </Card>
      <div>
        <H2>Mobile read-and-act loop</H2>
        <Text>
          <code>GET /api/trips</code> → <code>GET /api/trips/{"{id}"}</code> →
          use displayStatus and availableActions → perform an eligible action →
          reload trip detail.
        </Text>
        <Text tone="secondary">
          Trip status and payment status are separate. Offer decline cancels the
          trip; rating and reporting are independent. Trust the server response
          after payment, cancellation, or offer decisions.
        </Text>
      </div>
    </Stack>
  );
}
