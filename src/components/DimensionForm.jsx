import { useState, useRef } from 'react'
import { enqueue, flushQueue, recordSave, getLastSaveMinutes } from '../saveQueue'

export default function DimensionForm({
  barcode, description, setDescription,
  initialWidth, initialHeight, initialDepth, initialWeight,
  onSaved, onRescan,
}) {
  const [width,  setWidth]  = useState(initialWidth  !== '' ? String(initialWidth)  : '')
  const [height, setHeight] = useState(initialHeight !== '' ? String(initialHeight) : '')
  const [depth,  setDepth]  = useState(initialDepth  !== '' ? String(initialDepth)  : '')
  const [weight, setWeight] = useState(initialWeight !== '' ? String(initialWeight) : '')
  const [savedOk,   setSavedOk]   = useState(false)
  const [saveError, setSaveError] = useState(null)

  // Duplicate detection — check once on mount
  const [dupMinutes] = useState(() => getLastSaveMinutes(barcode))

  const widthRef  = useRef()
  const heightRef = useRef()
  const depthRef  = useRef()
  const weightRef = useRef()
  const saveRef   = useRef()

  const advance = (nextRef) => (e) => {
    if (e.key === 'Enter') { e.preventDefault(); nextRef.current?.focus() }
  }

  function handleSave() {
    if (!width || !height || !depth) {
      setSaveError('W, H, and D are required.')
      return
    }

    const data = {
      barcode,
      description,
      width:  parseFloat(width),
      depth:  parseFloat(depth),
      height: parseFloat(height),
      weight: weight ? parseFloat(weight) : 0,
    }

    // Queue the save (works offline) then flush in background
    enqueue(data)
    recordSave(barcode)
    flushQueue()

    setSavedOk(true)
    setTimeout(() => onSaved(), 600)
  }

  if (savedOk) {
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
          type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.01"
          value={weight} onChange={(e) => setWeight(e.target.value)}
          onKeyDown={advance(saveRef)}
        />
      </div>

      {saveError && <p className="error-msg">{saveError}</p>}

      <button
        ref={saveRef}
        className="btn-primary btn-save"
        onClick={handleSave}
      >
        Save to Sheet
      </button>
    </div>
  )
}
