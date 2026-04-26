import React from 'react';

export function Banner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
        <span style={{ color: 'var(--accent-blue)' }}>NuecAI</span> Receipt Scanner
      </h1>
    </div>
  );
}
