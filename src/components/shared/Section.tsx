'use client';

import React from 'react';

interface SectionProps {
  title:       string;
  children:    React.ReactNode;
  rightLabel?: string;
}

export default function Section({ title, children, rightLabel }: SectionProps) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3 section-title-container">
        <div className="flex items-center gap-2 section-title-text">
          <div className="w-1 h-5 bg-[#00C2A8] rounded-full section-title-bar" />
          <h3 className="text-sm font-semibold text-[#0B1E3D]">{title}</h3>
        </div>
        {rightLabel && (
          <span className="text-xs text-[#5A6A7A] section-title-label">{rightLabel}</span>
        )}
      </div>
      {children}
    </div>
  );
}
