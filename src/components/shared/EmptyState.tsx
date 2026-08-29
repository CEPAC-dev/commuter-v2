interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  minHeight?: string;
}

export default function EmptyState({
  icon = '📭',
  title,
  description,
  action,
  minHeight = '40vh',
}: EmptyStateProps) {
  const isEmoji = typeof icon === 'string';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
        padding: 'var(--space-24) var(--space-16)',
        textAlign: 'center',
        gap: 'var(--space-16)',
      }}
    >
      <div style={{ lineHeight: 1, fontSize: isEmoji ? 48 : undefined }}>{icon}</div>
      <h3
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          color: '#0B1E3D',
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: '#5A6A7A',
            maxWidth: 320,
          }}
        >
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 'var(--space-8)' }}>{action}</div>}
    </div>
  );
}
