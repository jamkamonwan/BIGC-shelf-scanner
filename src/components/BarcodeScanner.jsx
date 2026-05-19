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
  const [manualError, setManualError] = useState(null)
  const [torchOn, setTorchOn]               = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [tapFocusSupported, setTapFocusSupported] = useState(false)
  const [focusPoint, setFocusPoint]         = useState(null)
  const [zoom, setZoom]           = useState(1)
  const [zoomMin, setZoomMin]     = useState(1)
  const [zoomMax, setZoomMax]     = useState(1)
  const [zoomSupported, setZoomSupported] = useState(false)
  const trackRef = useRef(null)

  async function initTrack(stream) {
    const track = stream?.getVideoTracks?.()?.[0]
    if (!track) return
    trackRef.current = track
    const caps = track.getCapabilities?.() || {}
    if (caps.torch) setTorchSupported(true)

    // Zoom support
    if (caps.zoom) {
      setZoomSupported(true)
      setZoomMin(caps.zoom.min ?? 1)
      setZoomMax(caps.zoom.max ?? 1)
      setZoom(caps.zoom.min ?? 1)
    }

    // Prefer continuous autofocus; on some devices try macro first for close-up scanning
    const modes = caps.focusMode || []
    try {
      if (modes.includes('continuous')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] })
      }
    } catch (_) {}

    // Tap-to-focus
    if (modes.includes('manual') && caps.pointsOfInterest) {
      setTapFocusSupported(true)
    }
  }

  async function applyZoom(level) {
    const track = trackRef.current
    if (!track) return
    const clamped = Math.max(zoomMin, Math.min(zoomMax, level))
    try {
      await track.applyConstraints({ advanced: [{ zoom: clamped }] })
      setZoom(clamped)
    } catch (_) {}
  }

  async function toggleTorch() {
    const track = trackRef.current
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] })
      setTorchOn(next)
    } catch (_) {}
  }

  async function handleVideoTap(e) {
    const track = trackRef.current
    if (!track || !tapFocusSupported) return
    const rect = videoRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    setFocusPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setTimeout(() => setFocusPoint(null), 800)
    try {
      await track.applyConstraints({ advanced: [{ focusMode: 'manual', pointsOfInterest: [{ x, y }] }] })
      setTimeout(async () => {
        try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }) } catch (_) {}
      }, 2000)
    } catch (_) {}
  }

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
        initTrack(stream)

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
        .then(() => {
          setReady(true)
          initTrack(video.srcObject)
        })
        .catch((err) => setError(err.message))
    }

    return () => {
      stoppedRef.current = true
      if (animRef.current) cancelAnimationFrame(animRef.current)
      controlsRef.current?.stop()
      if (video?.srcObject) video.srcObject.getTracks().forEach(t => t.stop())
      trackRef.current = null
      setTorchOn(false)
      setTorchSupported(false)
      setTapFocusSupported(false)
      setFocusPoint(null)
      setZoom(1)
      setZoomSupported(false)
    }
  }, [onDetected, itemList])

  function validateBarcode(val) {
    if (!/^\d+$/.test(val))       return 'บาร์โค้ดต้องเป็นตัวเลขเท่านั้น'
    if (val.length < 3)           return 'บาร์โค้ดต้องมีอย่างน้อย 3 หลัก'
    if (val.length > 20)          return 'บาร์โค้ดยาวเกินไป (สูงสุด 20 หลัก)'
    return null
  }

  function handleManualChange(e) {
    setManualBarcode(e.target.value)
    setManualError(null)
  }

  function handleManualSubmit(e) {
    e.preventDefault()
    const val = manualBarcode.trim()
    if (!val) return
    const err = validateBarcode(val)
    if (err) { setManualError(err); return }
    fireDetected(val)
  }

  const zoomStep = zoomMax <= 2 ? 0.1 : zoomMax <= 5 ? 0.5 : 1

  return (
    <div className="scanner-screen">
      <div className="video-wrapper">
        <video
          ref={videoRef}
          className="scanner-video"
          playsInline
          muted
          onClick={handleVideoTap}
          style={{ cursor: tapFocusSupported ? 'crosshair' : 'default' }}
        />
        <div className="scan-overlay">
          <div className="scan-frame" />
        </div>
        {focusPoint && (
          <div style={{
            position: 'absolute',
            left: focusPoint.x - 22, top: focusPoint.y - 22,
            width: 44, height: 44,
            border: '2px solid #fde047', borderRadius: 4,
            pointerEvents: 'none',
          }} />
        )}
        {tapFocusSupported && ready && (
          <div style={{
            position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
            fontSize: 11, color: 'rgba(255,255,255,0.65)',
            background: 'rgba(0,0,0,0.35)', borderRadius: 4, padding: '2px 8px',
            whiteSpace: 'nowrap',
          }}>
            แตะเพื่อโฟกัส
          </div>
        )}
        {!ready && !error && (
          <div className="scanner-status">กำลังเปิดกล้อง…</div>
        )}
        {error && (
          <div className="scanner-status error">เปิดกล้องไม่ได้</div>
        )}
        {ready && engine === 'native' && (
          <div style={{
            position: 'absolute', bottom: 8, right: 10,
            fontSize: 10, color: 'rgba(255,255,255,0.5)',
          }}>
            HD scan
          </div>
        )}

        {/* Zoom controls — shown when device supports zoom */}
        {zoomSupported && ready && (
          <div style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(0,0,0,0.55)', borderRadius: 20, padding: '4px 10px',
          }}>
            <button
              onClick={() => applyZoom(zoom - zoomStep)}
              disabled={zoom <= zoomMin}
              style={{
                background: 'none', border: 'none', color: '#fff', fontSize: 20,
                lineHeight: 1, padding: '0 4px', cursor: 'pointer',
                opacity: zoom <= zoomMin ? 0.3 : 1,
              }}
            >−</button>
            <span style={{ color: '#fff', fontSize: 12, minWidth: 34, textAlign: 'center' }}>
              {zoom.toFixed(1)}x
            </span>
            <button
              onClick={() => applyZoom(zoom + zoomStep)}
              disabled={zoom >= zoomMax}
              style={{
                background: 'none', border: 'none', color: '#fff', fontSize: 20,
                lineHeight: 1, padding: '0 4px', cursor: 'pointer',
                opacity: zoom >= zoomMax ? 0.3 : 1,
              }}
            >+</button>
          </div>
        )}

        {torchSupported && (
          <button
            onClick={toggleTorch}
            style={{
              position: 'absolute', bottom: 12, left: 12,
              background: torchOn ? '#fde047' : 'rgba(0,0,0,0.55)',
              border: 'none', borderRadius: 8,
              padding: '8px 14px', fontSize: 20, cursor: 'pointer',
              color: torchOn ? '#000' : '#fff',
              lineHeight: 1,
            }}
            aria-label={torchOn ? 'ปิดไฟ' : 'เปิดไฟ'}
          >
            🔦
          </button>
        )}
      </div>

      <p className="scan-hint">ส่องกล้องไปที่บาร์โค้ด{zoomSupported ? ' · ซูมได้ด้วยปุ่ม + / −' : ''}</p>

      <div className="manual-section">
        <button
          className="btn-ghost"
          onClick={() => setShowManual((v) => !v)}
        >
          {showManual ? 'ซ่อนช่องกรอก' : 'กรอกบาร์โค้ดเอง'}
        </button>

        {showManual && (
          <form onSubmit={handleManualSubmit} className="manual-form">
            <input
              className="input"
              type="text"
              inputMode="numeric"
              placeholder="เช่น 8850329213719"
              value={manualBarcode}
              onChange={handleManualChange}
              autoFocus
              style={manualError ? { borderColor: '#ef4444' } : {}}
            />
            {manualError && (
              <p style={{ color: '#ef4444', fontSize: 13, margin: '4px 0 0' }}>
                {manualError}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={!manualBarcode.trim()}>
              ใช้บาร์โค้ดนี้
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
