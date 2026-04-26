import React, { useRef, useState, useEffect } from 'react';

export function CapturePanel({ onCapture, isLoading }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [useCamera, setUseCamera] = useState(false);

  useEffect(() => {
    if (useCamera) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [useCamera]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error('Error accessing camera:', err);
      
      // Provide specific error messages based on the issue
      let errorMessage = 'Could not access camera.';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access in your browser settings.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Camera is in use by another app.';
      } else if (window.location.protocol === 'http:') {
        // Check if accessing via HTTP (non-localhost)
        const isExternal = !window.location.hostname.includes('localhost') && 
                         !window.location.hostname.includes('127.0.0.1');
        if (isExternal) {
          errorMessage = 'Camera requires HTTPS on external devices. Please access via https:// URL or use the file upload instead.';
        }
      }
      
      setError(errorMessage);
      setUseCamera(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleSnap = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      onCapture(dataUrl);
      stopCamera();
      setUseCamera(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        onCapture(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="panel panel-left" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>Scan Receipt</h2>
        {!useCamera && (
          <button className="btn-primary" onClick={() => setUseCamera(true)} disabled={isLoading}>
            Open Camera
          </button>
        )}
        {useCamera && (
          <button className="btn-secondary" onClick={() => setUseCamera(false)}>
            Close Camera
          </button>
        )}
      </div>

      {error && (
        <div style={{ 
          color: 'var(--danger)', 
          fontSize: '14px', 
          padding: '12px',
          backgroundColor: 'rgba(248, 81, 73, 0.1)',
          borderRadius: '6px',
          border: '1px solid var(--danger)'
        }}>
          {error}
        </div>
      )}

      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', backgroundColor: 'var(--bg-page)', overflow: 'hidden', position: 'relative' }}>
        {useCamera ? (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div style={{ position: 'absolute', bottom: '20px', left: '0', right: '0', display: 'flex', justifyContent: 'center' }}>
              <button 
                onClick={handleSnap} 
                style={{ 
                  width: '64px', height: '64px', borderRadius: '50%', 
                  backgroundColor: 'rgba(255,255,255,0.8)', border: '4px solid var(--accent-blue)',
                  cursor: 'pointer' 
                }}
                disabled={isLoading}
                aria-label="Take photo"
              />
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>Or upload an image file</p>
            <label className="btn-secondary" style={{ display: 'inline-block', marginTop: '12px', cursor: 'pointer' }}>
              Choose File
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileUpload} 
                style={{ display: 'none' }}
                disabled={isLoading} 
              />
            </label>
          </div>
        )}

        {isLoading && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(13, 17, 23, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
            <div className="spinner"></div>
            <div style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>Processing Image...</div>
          </div>
        )}
      </div>
    </div>
  );
}