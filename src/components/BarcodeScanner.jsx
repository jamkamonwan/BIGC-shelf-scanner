import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { beepSuccess } from '../beep'

export default function BarcodeScanner({ onDetected, itemList }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)
  const [manualBarcode, setManualBarcode] = useState('')
  const [showManual, setShowManual] = useState(false)

  function isInList(code) {
    if (!Array.isArray(itemList)) return false
    return itemList.some(
      (item) => (item.barcode || '') === code || (item.articleCode || '') === code
    )
  }

  function handleCode(code) {
    try { if (isInList(code)) beepSuccess() } catch (_) {}
    onDetected(code)
  }

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let stopped = false

    reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current,
        (result, err, controls) => {
          if (stopped) return
          controlsRef.current = controls
          if (result) {
            stopped = true
            controls.stop()
            handleCode(result.getText())
          }
        }
      )
      .then(() => setReady(true))
      .catch((err) => setError(err.message))

    return () => {
      stopped = true
      controlsRef.current?.stop()
    }
  }, [onDetected, itemList])

  function handleManualSubmit(e) {
    e.preventDefault()
    const val = manualBarcode.trim()
    if (!val) return
    handleCode(val)
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
