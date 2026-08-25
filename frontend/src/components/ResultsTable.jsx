import React, { useState } from 'react';

function displayValue(value) {
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function ResultsTable({ data, isLoading }) {
  const [viewMode, setViewMode] = useState('structured');
  if (!data) {
    return <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: 'var(--text-muted)' }}>
      {isLoading ? '' : 'No document data parsed yet. Scan or upload to see results.'}
    </div>;
  }

  const rawOcr = data.rawOcr || {};
  const fields = data.structured?.fields && typeof data.structured.fields === 'object' ? data.structured.fields : {};
  const items = Array.isArray(data.structured?.lineItems) ? data.structured.lineItems : [];
  const warnings = Array.isArray(data.audit?.warnings) ? data.audit.warnings : [];
  const itemKeys = Array.from(new Set(items.flatMap(item => item && typeof item === 'object' ? Object.keys(item).filter(key => !['confidence', 'evidence'].includes(key)) : [])));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className={viewMode === 'structured' ? 'btn-primary' : 'btn-secondary'} onClick={() => setViewMode('structured')} type="button">Structured</button>
        <button className={viewMode === 'raw' ? 'btn-primary' : 'btn-secondary'} onClick={() => setViewMode('raw')} type="button">Raw OCR</button>
      </div>

      {viewMode === 'raw' && (
        <div className="card" style={{ backgroundColor: 'var(--bg-page)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '8px' }}>OCR confidence: {rawOcr.confidence ?? 'not run'}{rawOcr.usedEnhancedRetry ? ' · enhanced retry used' : ''}</div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '12px', backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '6px', maxHeight: '300px', overflow: 'auto' }}>{rawOcr.text || 'Cloud mode does not produce local OCR text.'}</pre>
        </div>
      )}

      {viewMode === 'structured' && (
        <>
          {warnings.length > 0 && <div className="card" style={{ border: '1px solid var(--danger)', color: 'var(--text-muted)' }}>
            {warnings.map((warning, index) => <div key={index}>⚠ {warning}</div>)}
          </div>}
          {Object.keys(fields).length > 0 ? <div className="card" style={{ backgroundColor: 'var(--bg-page)' }}>
            {Object.entries(fields).map(([key, field]) => {
              const value = field && typeof field === 'object' && 'value' in field ? field.value : field;
              const confidence = field?.confidence;
              return <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '10px' }}>
                <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{key}{confidence ? ` · ${confidence}` : ''}</span>
                <span style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-word', maxWidth: '60%' }}>{displayValue(value)}</span>
              </div>;
            })}
          </div> : <div className="card" style={{ color: 'var(--text-muted)' }}>No values were accepted automatically. Review Raw OCR or scan a clearer image.</div>}

          {items.length > 0 && itemKeys.length > 0 && <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}><thead><tr>{itemKeys.map(key => <th key={key} style={{ padding: '10px 8px' }}>{key}</th>)}</tr></thead><tbody>{items.map((item, index) => <tr key={index}>{itemKeys.map(key => <td key={key} style={{ padding: '10px 8px' }}>{displayValue(item[key])}</td>)}</tr>)}</tbody></table>
          </div>}
        </>
      )}
    </div>
  );
}
