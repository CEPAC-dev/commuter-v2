'use client';

import { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';

interface AgeGateInputProps {
  value: string; // ISO "YYYY-MM-DD" or ""
  onChange: (dateString: string) => void; // "YYYY-MM-DD" or "" if invalid
  error?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CURRENT_YEAR = new Date().getFullYear();
const MAX_YEAR = CURRENT_YEAR - 18;

function daysInMonth(month: number, year: number): number {
  if (!month || !year) return 31;
  return new Date(year, month, 0).getDate();
}

export default function AgeGateInput({ value, onChange, error }: AgeGateInputProps) {
  // Parse initial value (format: YYYY-MM-DD)
  const parts = value ? value.split('-') : ['', '', ''];
  const [day, setDay]     = useState(parts[2] ?? '');
  const [month, setMonth] = useState(parts[1] ?? '');
  const [year, setYear]   = useState(parts[0] ?? '');
  const [ageError, setAgeError] = useState('');
  const [valid, setValid] = useState(false);

  useEffect(() => {
    // Validate and compute age from day/month/year inputs
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!day || !month || !year) {
      setAgeError('');
      setValid(false);
      onChange('');
      return;
    }

    const maxDays = daysInMonth(Number(month), Number(year));
    if (Number(day) > maxDays) {
      setAgeError('Invalid date.');
      setValid(false);
      onChange('');
      return;
    }

    const dob = new Date(Number(year), Number(month) - 1, Number(day));
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;

    if (age < 18) {
      setAgeError('You must be at least 18 years old to register.');
      setValid(false);
      onChange('');
    } else {
      setAgeError('');
      setValid(true);
      const yyyy = String(year).padStart(4, '0');
      const mm   = String(month).padStart(2, '0');
      const dd   = String(day).padStart(2, '0');
      onChange(`${yyyy}-${mm}-${dd}`);
    }
  }, [day, month, year, onChange]);

  const displayedError = error || ageError;

  const selectClass = [
    'h-[52px] border rounded-lg text-sm text-primary bg-white px-2',
    'focus:outline-none transition-all',
    displayedError
      ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/15'
      : 'border-[#D1D5DB] focus:border-secondary focus:ring-2 focus:ring-secondary/15',
  ].join(' ');

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1.4fr', gap: 8, alignItems: 'center' }}>
        {/* Day */}
        <select value={day} onChange={(e) => setDay(e.target.value)} className={selectClass} aria-label="Day">
          <option value="">DD</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>{String(d).padStart(2, '0')}</option>
          ))}
        </select>

        {/* Month */}
        <select value={month} onChange={(e) => setMonth(e.target.value)} className={selectClass} aria-label="Month">
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>

        {/* Year */}
        <select value={year} onChange={(e) => setYear(e.target.value)} className={selectClass} aria-label="Year">
          <option value="">YYYY</option>
          {Array.from({ length: MAX_YEAR - 1950 + 1 }, (_, i) => MAX_YEAR - i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {valid && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
          <CheckCircle size={14} className="text-success" aria-label="Age verified" />
          <span style={{ fontSize: 12, color: '#27AE60', fontWeight: 500 }}>Age verified</span>
        </div>
      )}

      {displayedError && (
        <p className="mt-1 text-xs text-danger">{displayedError}</p>
      )}
    </div>
  );
}
