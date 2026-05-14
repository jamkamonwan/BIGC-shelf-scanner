import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { beepSuccess } from '../beep'

export default function BarcodeScanner({ onDetected, itemList }) {
  const videoRef    = useRef(null)
  const controlsRef = useRef(null)
  const animRef     = useRef(null)
  const stoppedRef  = useRef(false)
  const [error, setError]           = useState(null)
  const [ready, setReady]           = useState(false)
  const [engine, setEngine]         = useState(null) // 'native' | 'zxing'
  const [manualBarcode, setManualBarcode] = useState('')
  const [showManual, setShowManual] = useState(false)

  function isInList(code) {
    if (!Array.isArray(itemList)) return false
    return itemList.some(
      (item) => (item.barcode || '') === code || (item.articleCode || '') === code
    )
  }

  function fireDetected(code) {
    if (stoppedRef.current) return
    stoppedRef.current = true
    try { if (isInList(code)) beepSuccess() } catch (_) {}
    onDetected(code)
  }

  useEffect(() => {
    stoppedRef.current = false
    const video = videoRef.current

    if ('BarcodeDetector' in window) {
      startNative(video)
    } else {
      startZXing(video)
    }

    async function startNative(video) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        })
        video.srcObject = stream
        await video.play()
        setReady(true)
        setEngine('native')

        const allFormats = await BarcodeDetector.getSupportedFormats()
        const want = ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','qr_code','itf','data_matrix']
        const detector = new BarcodeDetector({ formats: want.filter(f => allFormats.includes(f)) })

        const canvas = document.createElement('canvas')
        const ctx    = canvas.getContext('2d', { willReadFrequently: true })

        const tick = async () => {
          if (stoppedRef.current) return
          if (video.readyState === 4) {
            canvas.width  = video.videoWidth
            canvas.height = video.videoHeight
            ctx.drawImage(video, 0, 0)
            try {
              const hits = await detector.detect(canvas)
              if (hits.length > 0) {
                stream.getTracks().forEach(t => t.stop())
                fireDetected(hits[0].rawValue)
                return
              }
            } catch (_) {}
          }
          animRef.current = requestAnimationFrame(tick)
        }
        animRef.current = requestAnimationFrame(tick)

      } catch (err) {
        // Native failed — fall back to ZXing
        startZXing(video)
      }
    }

    function startZXing(video) {
      setEngine('zxing')
      const reader = new BrowserMultiFormatReader()
      reader
        .decodeFromConstraints(
          { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } },
          video,
          (result, err, controls) => {
            if (stoppedRef.current) return
            controlsRef.current = controls
            if (result) {
              controls.stop()
              fireDetected(result.getText())
            }
          }
        )
        .then(() => setReady(true))
        .catch((err) => setError(err.message))
    }

    return () => {
      stoppedRef.current = true
      if (animRef.current) cancelAnimationFrame(animRef.current)
      controlsRef.current?.stop()
      if (video?.srcObject) video.srcObject.getTracks().forEach(t => t.stop())
    }
  }, [onDetected, itemList])

  function handleManualSubmit(e) {
    e.preventDefault()
    const val = manualBarcode.trim()
    if (!val) return
    fireDetected(val)
  }

  return (
    <div className="scanner-screen">
      <div className="video-wrapper">
        <video ref={videoRef} className="scanner-video" playsInline muted />
        <div className="scan-overlay">
          <div className="scan-frame" />
        </div>
        {!ready && !error && (
          <div className="scanner-status">Starting camera…</div>
        )}
        {error && (
          <div className="scanner-status error">Camera unavailable</div>
        )}
        {ready && engine === 'native' && (
          <div style={{
            position: 'absolute', bottom: 8, right: 10,
            fontSize: 10, color: 'rgba(255,255,255,0.5)',
          }}>
            HD scan
          </div>
        )}
      </div>

      <p className="scan-hint">Point camera at a barcode to scan</p>

      <div className="manual-section">
        <button
          className="btn-ghost"
          onClick={() => setShowManual((v) => !v)}
        >
          {showManual ? 'Hide manual entry' : 'Enter barcode manually'}
        </button>

        {showManual && (
          <form onSubmit={handleManualSubmit} className="manual-form">
            <input
              className="input"
              type="text"
              inputMode="numeric"
              placeholder="Type barcode or article code"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-primary" disabled={!manualBarcode.trim()}>
              Use this barcode
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
