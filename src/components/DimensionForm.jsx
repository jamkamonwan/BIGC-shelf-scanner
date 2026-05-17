import { useState, useRef } from 'react'
import { enqueue, flushQueue, recordSave, getLastSaveMinutes } from '../saveQueue'

export default function DimensionForm({
  barcode, description, setDescription,
  initialWidth, initialHeight, initialDepth, initialWeight,
  foundItem,
  onSaved, onRescan,
}) {
  const initW   = initialWidth  !== '' ? String(initialWidth)  : ''
  const initH   = initialHeight !== '' ? String(initialHeight) : ''
  const initD   = initialDepth  !== '' ? String(initialDepth)  : ''
  const initWt  = initialWeight !== '' ? String(initialWeight) : ''

  const [width,  setWidth]  = useState(initW)
  const [height, setHeight] = useState(initH)
  const [depth,  setDepth]  = useState(initD)
  const [weight, setWeight] = useState(initWt)
  const [savedOk,   setSavedOk]   = useState(false) // false | 'saved' | 'queued'
  const [saveError, setSaveError] = useState(null)

  // Capture initial description at mount (description prop is live parent state)
  const initDescRef = useRef(description)

  // Duplicate detection — check once on mount
  const [dupMinutes] = useState(() => getLastSaveMinutes(barcode))

  // Disable Save if existing item and nothing has changed
  const isExisting = !!foundItem
  const unchanged  = isExisting &&
    width === initW && height === initH && depth === initD &&
    weight === initWt && description === initDescRef.current

  const widthRef  = useRef()
  const heightRef = useRef()
  const depthRef  = useRef()
  const weightRef = useRef()
  const saveRef   = useRef()

  const advance = (nextRef) => (e) => {
    if (e.key === 'Enter') { e.preventDefault(); nextRef.current?.focus() }
  }

  function handleSave() {
    // 1. Required fields
    if (!width || !height || !depth) {
      setSaveError('W, H, and D are required.')
      return
    }

    // 2. No scientific notation in dims
    const hasSci = (v) => /[eE]/.test(String(v))
    if (hasSci(width) || hasSci(height) || hasSci(depth)) {
      setSaveError('Scientific notation (e.g. 1E+10) is not allowed. Enter a plain number.')
      return
    }

    // 3. Validate raw values before rounding (catches 0.05 → would round to 0.1 bypass)
    const rawW = parseFloat(width), rawH = parseFloat(height), rawD = parseFloat(depth)
    if (isNaN(rawW) || isNaN(rawH) || isNaN(rawD)) {
      setSaveError('W, H, and D must be valid numbers.')
      return
    }
    if (rawW < 0.1 || rawH < 0.1 || rawD < 0.1) {
      setSaveError('W, H, and D must be at least 0.1 cm.')
      return
    }
    if (rawW > 500 || rawH > 500 || rawD > 500) {
      setSaveError('W, H, and D must be 500 cm or less.')
      return
    }

    // 4. Round dims
    const round1 = (v) => Math.round(v * 10) / 10
    const round3 = (v) => Math.round(v * 1000) / 1000
    const w = round1(rawW), h = round1(rawH), d = round1(rawD)

    // 5. Weight — type="text" so we get the raw string (catches paste of "-", "abc", etc.)
    const weightRaw = weight.trim()
    let wt = 0
    if (weightRaw !== '') {
      if (!/^\d+(\.\d+)?$/.test(weightRaw)) {
        setSaveError('Weight must be a positive number (e.g. 0.5) or leave blank.')
        return
      }
      wt = round3(parseFloat(weightRaw))
      if (wt === 0) {
        setSaveError('Weight cannot be 0. Enter a value ≥ 0.001 kg or leave blank.')
        return
      }
      if (wt < 0.001) {
        setSaveError('Weight must be at least 0.001 kg (1 g) or leave blank.')
        return
      }
      if (wt > 999) {
        setSaveError('Weight must be 999 kg or less.')
        return
      }
    }

    // 6. Description
    const desc = description.trim()
    if (desc.length > 100) {
      setSaveError('Description must be 100 characters or less.')
      return
    }
    if (desc && !/^[A-Za-z0-9฀-๿\s.,\-_()/]+$/.test(desc)) {
      setSaveError('Description: letters, numbers, Thai text, and . , - _ ( ) / only. No emoji or symbols.')
      return
    }

    const data = { barcode, description: desc, width: w, height: h, depth: d, weight: wt }

    enqueue(data)
    recordSave(barcode)
    flushQueue()

    const offline = !navigator.onLine
    setSavedOk(offline ? 'queued' : 'saved')
    setTimeout(() => onSaved(data), offline ? 1500 : 600)
  }

  if (savedOk === 'queued') {
    return (
      <div className="form-screen center">
        <div className="saved-badge" style={{ background: '#fef3c7', color: '#92400e' }}>Queued</div>
        <p className="muted">No internet — will sync automatically when back online</p>
      </div>
    )
  }

  if (savedOk === 'saved') {
    return (
      <div className="form-screen center">
        <div className="saved-badge">Saved!</div>
        <p className="muted">Ready for next item…</p>
      </div>
    )
  }

  const fromSheet = !!description

  return (
    <div className="form-screen">
      {dupMinutes && (
        <div style={{
          background: '#fef3c7', color: '#92400e', borderRadius: 8,
          padding: '8px 12px', marginBottom: 8, fontSize: 13,
        }}>
          ⚠️ This item was saved {dupMinutes} min ago — editing existing values
        </div>
      )}

      <div className="barcode-display">
        <span className="barcode-label">Barcode</span>
        <span className="barcode-value">{barcode}</span>
        <button className="btn-ghost small" onClick={onRescan}>Re-scan</button>
      </div>

      <div className="field">
        <label htmlFor="desc">
          Description{' '}
          {fromSheet
            ? <span className="muted">(from sheet)</span>
            : <span className="muted">(optional)</span>}
        </label>
        <input
          id="desc"
          className="input"
          type="text"
          placeholder="e.g. Snack box 200g"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={fromSheet ? { background: '#f0fdf4', borderColor: '#22c55e', color: '#14532d' } : {}}
        />
      </div>

      <div className="dims-grid">
        <div className="field">
          <label htmlFor="width">W (cm) <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            ref={widthRef} id="width" className="input dim-input"
            type="number" inputMode="decimal" min="0" step="0.1" placeholder="0.0"
            value={width} onChange={(e) => setWidth(e.target.value)}
            onKeyDown={advance(heightRef)} autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="height">H (cm) <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            ref={heightRef} id="height" className="input dim-input"
            type="number" inputMode="decimal" min="0" step="0.1" placeholder="0.0"
            value={height} onChange={(e) => setHeight(e.target.value)}
            onKeyDown={advance(depthRef)}
          />
        </div>
        <div className="field">
          <label htmlFor="depth">D (cm) <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            ref={depthRef} id="depth" className="input dim-input"
            type="number" inputMode="decimal" min="0" step="0.1" placeholder="0.0"
            value={depth} onChange={(e) => setDepth(e.target.value)}
            onKeyDown={advance(weightRef)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="weight">Weight (kg) <span className="muted">optional — e.g. 0.01</span></label>
        <input
          ref={weightRef} id="weight" className="input"
          type="text" inputMode="decimal" placeholder="0.01"
          value={weight} onChange={(e) => setWeight(e.target.value)}
          onKeyDown={advance(saveRef)}
        />
      </div>

      {saveError && <p className="error-msg">{saveError}</p>}

      {unchanged && (
        <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', margin: '4px 0' }}>
          No changes — edit a value to enable Save
        </p>
      )}

      <button
        ref={saveRef}
        className="btn-primary btn-save"
        onClick={handleSave}
        disabled={unchanged}
        style={unchanged ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
      >
        Save to Sheet
      </button>
    </div>
  )
}
