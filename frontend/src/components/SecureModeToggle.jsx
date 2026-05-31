import React, { useState, useEffect } from 'react';

export function SecureModeToggle({ secureMode, onChange }) {
  const toggleStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'var(--bg-card)',
    padding: '8px 12px',
    borderRadius: '24px',
    border: `1px solid ${secureMode ? 'var(--success)' : 'var(--border)'}`,
    cursor: 'pointer',
    userSelect: 'none'
  };

  const indicatorStyle = {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: secureMode ? 'var(--success)' : 'var(--text-muted)',
    transition: 'background-color 0.2s ease'
  };

  return (
    <div style={toggleStyle} onClick={() => onChange(!secureMode)}>
      <div style={indicatorStyle}></div>
      <span style={{ fontSize: '14px', fontWeight: 500, color: secureMode ? 'var(--success)' : 'var(--text-primary)' }}>
        {secureMode ? 'Secure Edge Mode' : 'Cloud Mode'}
      </span>
    </div>
  );
}
