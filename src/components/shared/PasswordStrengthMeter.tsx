'use client';

import { useClientLocale } from '@/lib/i18n/client';

interface Props {
  password: string;
}

function computeScore(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score as 0 | 1 | 2 | 3 | 4;
}

const SEGMENT_COLORS: Record<number, string> = {
  1: '#E74C3C',
  2: '#F39C12',
  3: '#00C2A8',
  4: '#27AE60',
};

export default function PasswordStrengthMeter({ password }: Props) {
  const { t } = useClientLocale();
  const score = computeScore(password);
  if (!password) return null;

  const color = SEGMENT_COLORS[score] ?? '#D1D5DB';

  const labelMap: Record<number, string> = {
    1: t('password_strength.weak'),
    2: t('password_strength.fair'),
    3: t('password_strength.strong'),
    4: t('password_strength.very_strong'),
  };

  const hintMap: Record<number, string> = {
    1: t('password_strength.hint_1'),
    2: t('password_strength.hint_2'),
    3: t('password_strength.hint_3'),
  };

  const label = labelMap[score] ?? '';

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4 }} role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={4} aria-label="Password strength">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: 4, flex: 1, borderRadius: 99,
              background: i <= score ? color : '#E5E7EB',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>
      {label && (
        <p style={{ marginTop: 6, fontSize: 12, color }}>
          {label}
          {score < 4 && score > 0 && hintMap[score] && (
            <span style={{ color: '#9CA3AF', marginLeft: 4, marginRight: 4 }}>
              {hintMap[score]}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
