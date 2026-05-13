import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { beepSuccess, beepError } from '../beep'

export default function BarcodeScanner({ onDetected, validBarcodes }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)
  const [notInList, setNotInList] = useState(false)
  const [manualBarcode, setManualBarcode] = useState('')
  const [showManual, setShowManual] = useState(false)

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
            const code = result.getText()
            if (!validBarcodes.includes(code)) {
              beepError()
              setNotInList(true)
              return
            }
            beepSuccess()
            stopped = true
            controls.stop()
            onDetected(code)
          }
        }
      )
      .then(() => setReady(true))
      .catch((err) => setError(err.message))

    return () => {
      stopped = true
      controlsRef.current?.stop()
    }
  }, [onDetected, validBarcodes])

  function handleManualSubmit(e) {
    e.preventDefault()
    const val = manualBarcode.trim()
    if (!val) return
    if (!validBarcodes.includes(val)) {
      beepError()
      setNotInList(true)
      return
    }
    beepSuccess()
    onDetected(val)
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

      {notInList && (
        <p className="error-msg" style={{ textAlign: 'center' }}>
          Barcode not in item list. Try again.
        </p>
      )}

      <p className="scan-hint">Point camera at a barcode to scan</p>

      <div className="manual-section">
        <button
          className="btn-ghost"
          onClick={() => { setShowManual((v) => !v); setNotInList(false) }}
        >
          {showManual ? 'Hide manual entry' : 'Enter barcode manually'}
        </button>

        {showManual && (
          <form onSubmit={handleManualSubmit} className="manual-form">
            <input
              className="input"
              type="text"
              inputMode="numeric"
              placeholder="Type barcode number"
              value={manualBarcode}
              onChange={(e) => { setManualBarcode(e.target.value); setNotInList(false) }}
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
