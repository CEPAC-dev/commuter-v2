'use client';
import { useState, InputHTMLAttributes } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  rightLabel?: React.ReactNode;
  accentColor?: string;
}
export default function PasswordInput({ label, error, rightLabel, accentColor = '#00C2A8', onFocus, onBlur, ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  const bc = error ? '#E74C3C' : focused ? accentColor : '#D1D5DB';
  const sh = focused ? ('0 0 0 3px ' + (error ? '#E74C3C' : accentColor) + '33') : 'none';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ fontSize: 14, fontWeight: 500, color: '#0B1E3D' }}>{label}</label>
        {rightLabel}
      </div>
      <div style={{ position: 'relative' }}>
        <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} aria-hidden='true' />
        <input type={show ? 'text' : 'password'} onFocus={(e) => { setFocused(true); onFocus?.(e); }} onBlur={(e) => { setFocused(false); onBlur?.(e); }} style={{ width: '100%', height: 52, paddingLeft: 42, paddingRight: 44, border: '1.5px solid ' + bc, borderRadius: 10, fontSize: 14, color: '#0B1E3D', background: '#ffffff', outline: 'none', boxShadow: sh, transition: 'border-color 0.15s, box-shadow 0.15s', boxSizing: 'border-box', fontFamily: 'inherit', direction: 'ltr', textAlign: 'left' }} {...props} />
        <button type='button' onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', alignItems: 'center', padding: 2 }}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <p style={{ marginTop: 5, fontSize: 12, color: '#E74C3C' }}>{error}</p>}
    </div>
  );
}