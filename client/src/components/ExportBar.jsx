import React, { useState } from 'react';
import { exportToCsv } from '../utils/csvExport';

export function ExportBar({ data, disabled }) {
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState(null);
  
  const handleCsvExport = () => {
    if (data) {
      exportToCsv('receipt-export', data);
    }
  };

  const handleSheetsExport = async () => {
    if (!data) return;
    
    setPushing(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const resData = await response.json();
      setResult(resData);
    } catch (err) {
      setResult({ error: true, message: err.message });
    } finally {
      setPushing(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px', flexWrap: 'wrap' }}>
      <button 
        className="btn-secondary" 
        onClick={handleCsvExport} 
        disabled={disabled || !data}
      >
        Export CSV
      </button>
      <button 
        className="btn-success" 
        onClick={handleSheetsExport} 
        disabled={disabled || !data || pushing}
        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        {pushing ? 'Pushing...' : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
            Push to Sheets
          </>
        )}
      </button>
      
      {result && (
        <div style={{ 
          width: '100%', 
          marginTop: '8px', 
          padding: '8px 12px', 
          borderRadius: '6px',
          backgroundColor: result.error ? 'rgba(248, 81, 73, 0.2)' : 'rgba(63, 185, 80, 0.2)',
          color: result.error ? 'var(--danger)' : 'var(--success)',
          fontSize: '14px'
        }}>
          {result.message}
        </div>
      )}
    </div>
  );
}