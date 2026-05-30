import React, { useState, useEffect } from 'react';
import { Banner } from './components/Banner';
import { SecureModeToggle } from './components/SecureModeToggle';
import { CapturePanel } from './components/CapturePanel';
import { ResultsTable } from './components/ResultsTable';
import { ExportBar } from './components/ExportBar';
import { encodeBase64 } from './utils/encode';

function App() {
  const [secureMode, setSecureMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [error, setError] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  // Load saved mode on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('secureMode');
    if (savedMode !== null) {
      setSecureMode(savedMode === 'true');
    }
  }, []);

  // Handle mode change - clear previous results
  const handleModeChange = (newMode) => {
    setSecureMode(newMode);
    localStorage.setItem('secureMode', newMode);
    // Clear previous results when switching modes
    setReceiptData(null);
    setError(null);
    setPreviewImage(null);
  };

  // Process image
  const processImage = async (dataUrl) => {
    setIsLoading(true);
    setError(null);
    setReceiptData(null);
    setPreviewImage(dataUrl);
    
    try {
      const base64 = encodeBase64(dataUrl);
      
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mode: secureMode ? 'secure' : 'cloud'
        })
      });
      
      const data = await response.json();
      
      if (!response.ok || data.error) {
        throw new Error(data.details || data.error || 'Extraction failed');
      }
      
      setReceiptData(data);
    } catch (err) {
      console.error('Error processing receipt:', err);
      setError(err.message || 'Failed to process receipt. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setReceiptData(null);
    setError(null);
    setPreviewImage(null);
  };

  return (
    <div className="app-container">
      <header style={{ 
        padding: '16px 24px', 
        borderBottom: '1px solid var(--border)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        backgroundColor: 'var(--bg-panel)'
      }}>
        <Banner />
        <SecureModeToggle secureMode={secureMode} onChange={handleModeChange} />
      </header>
      
      <main className="app-main">
        <div className="panel-left" style={{ flex: 1 }}>
          <CapturePanel
            onCapture={processImage}
            isLoading={isLoading}
            previewImage={previewImage}
            onReset={handleReset}
          />
        </div>
        
        <div className="panel-right" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Parsed Data</h2>
            
            {error && (
              <div style={{ 
                color: 'var(--danger)', 
                padding: '16px',
                backgroundColor: 'rgba(248, 81, 73, 0.1)',
                borderRadius: '6px',
                border: '1px solid var(--danger)',
                marginBottom: '16px'
              }}>
                {error}
              </div>
            )}
            
            <div style={{ position: 'relative', flex: 1 }}>
              <ResultsTable data={receiptData} isLoading={isLoading} />
              {isLoading && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: '16px',
                    backgroundColor: 'rgba(13, 17, 23, 0.7)',
                    borderRadius: '8px',
                    opacity: isLoading ? 1 : 0,
                    transition: 'opacity 200ms ease'
                  }}
                >
                  <div className="spinner"></div>
                  <div style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>Processing Image...</div>
                </div>
              )}
            </div>
            <ExportBar data={receiptData} disabled={!receiptData || isLoading} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
