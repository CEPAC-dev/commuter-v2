interface EmptyIconProps {
  className?: string;
  title: string;
}

/** Route/pin motif — reads as "no trips booked yet." Brand navy/teal. */
export function PassengerEmptyIcon({ className = "w-24 h-24", title }: EmptyIconProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <title>{title}</title>
      <circle cx="48" cy="48" r="48" fill="#EFF7F6" />
      <path
        d="M22 70C29 57 35 48 44 42C53 36 59 28 61 17"
        stroke="#00C2A8"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="1 9"
      />
      <circle cx="22" cy="70" r="5.5" fill="#0B1E3D" />
      <path
        d="M61 6c-7.7 0-14 6.3-14 14 0 10.5 14 24 14 24s14-13.5 14-24c0-7.7-6.3-14-14-14z"
        fill="#0B1E3D"
      />
      <circle cx="61" cy="20" r="5.5" fill="#00C2A8" />
    </svg>
  );
}

/** Steering wheel + "waiting for a signal" arcs — reads as "no trips assigned yet." Brand navy/amber. */
export function DriverEmptyIcon({ className = "w-24 h-24", title }: EmptyIconProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <title>{title}</title>
      <circle cx="48" cy="48" r="48" fill="#FFF6E9" />
      <circle cx="42" cy="54" r="20" stroke="#0B1E3D" strokeWidth="3" />
      <circle cx="42" cy="54" r="4.5" fill="#0B1E3D" />
      <path
        d="M42 34v10M42 64v10M22 54h10M52 54h10"
        stroke="#0B1E3D"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M58 30c4 1.2 7 4.2 8.2 8.2"
        stroke="#F5A623"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M62 21c7.4 1.6 13.4 7.6 15 15"
        stroke="#F5A623"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
