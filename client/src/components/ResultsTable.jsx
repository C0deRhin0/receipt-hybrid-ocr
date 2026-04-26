import React from 'react';

export function ResultsTable({ data }) {
  if (!data) {
    return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', color: 'var(--text-muted)' }}>
        No receipt data parsed yet. Scan or upload to see results.
      </div>
    );
  }

  // Handle errors
  if (data.error) {
    return (
      <div className="card" style={{ backgroundColor: 'var(--bg-page)' }}>
        <div style={{ color: 'var(--danger)', marginBottom: '12px' }}>
          {data.error}
        </div>
        {data.rawExtraction && (
          <pre style={{ 
            whiteSpace: 'pre-wrap', 
            wordBreak: 'break-word',
            fontSize: '12px',
            backgroundColor: 'var(--bg-input)',
            padding: '12px',
            borderRadius: '6px',
            maxHeight: '300px',
            overflow: 'auto'
          }}>
            {data.rawExtraction}
          </pre>
        )}
      </div>
    );
  }

  // Separate items array from other scalar fields
  let items = [];
  let otherFields = {};

  if (Array.isArray(data)) {
    // Legacy array format
    items = data;
  } else if (typeof data === 'object') {
    // Dynamic JSON format
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        // Assume the first array is our items list
        if (items.length === 0 || key.toLowerCase() === 'items') {
          items = value;
        } else {
          otherFields[key] = JSON.stringify(value);
        }
      } else if (typeof value === 'object' && value !== null) {
        otherFields[key] = JSON.stringify(value);
      } else {
        otherFields[key] = value;
      }
    }
  }

  const hasData = Object.keys(otherFields).length > 0 || items.length > 0;

  if (!hasData) {
    return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', color: 'var(--text-muted)' }}>
        Could not extract receipt data. Please try with a clearer image.
      </div>
    );
  }

  // Find columns for items table
  let itemKeys = [];
  if (items.length > 0) {
    const allKeys = new Set();
    items.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        Object.keys(item).forEach(k => allKeys.add(k));
      }
    });
    itemKeys = Array.from(allKeys);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Dynamic Fields */}
      {Object.keys(otherFields).length > 0 && (
        <div className="card" style={{ backgroundColor: 'var(--bg-page)' }}>
          {Object.entries(otherFields).map(([key, value], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: i < Object.entries(otherFields).length - 1 ? '8px' : '0' }}>
              <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{key}</span>
              <span style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-word', maxWidth: '60%' }}>{String(value)}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Line Items Table */}
      {items.length > 0 && itemKeys.length > 0 && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                {itemKeys.map(key => (
                  <th key={key} style={{ padding: '12px 8px', textTransform: 'capitalize' }}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  {itemKeys.map(key => (
                    <td key={key} style={{ padding: '12px 8px' }}>
                      {item[key] !== undefined && item[key] !== null ? String(item[key]) : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}