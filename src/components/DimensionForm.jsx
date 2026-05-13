import { useState } from 'react'

export default function DimensionForm({ barcode, description, setDescription, onSaved, onRescan }) {
  const [width, setWidth] = useState('')
  const [depth, setDepth] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [saveError, setSaveError] = useState(null)

  async function handleSave() {
    if (!width || !depth || !height || !weight) {
      setSaveError('Please fill in all dimensions and weight.')
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      const params = new URLSearchParams({
        barcode,
        description,
        width: parseFloat(width),
        depth: parseFloat(depth),
        height: parseFloat(height),
        weight: parseFloat(weight),
      })
      const res = await fetch(`/api/save?${params}`)
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Script returned error')
      setSavedOk(true)
      setTimeout(() => onSaved(), 1200)
    } catch (err) {
      setSaveError(`Failed to save: ${err.message}`)
      setSaving(false)
    }
  }

  if (savedOk) {
    return (
      <div className="form-screen center">
        <div className="saved-badge">Saved!</div>
        <p className="muted">Ready for next item…</p>
      </div>
    )
  }

  return (
    <div className="form-screen">
      <div className="barcode-display">
        <span className="barcode-label">Barcode</span>
        <span className="barcode-value">{barcode}</span>
        <button className="btn-ghost small" onClick={onRescan}>Re-scan</button>
      </div>

      <div className="field">
        <label htmlFor="desc">
          Description{' '}
          {description ? <span className="muted">(from sheet)</span> : <span className="muted">(optional)</span>}
        </label>
        <input
          id="desc"
          className="input"
          type="text"
          placeholder="e.g. Snack box 200g"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={description ? { background: '#f0fdf4', borderColor: '#22c55e' } : {}}
        />
      </div>

      <div className="dims-grid">
        <div className="field">
          <label htmlFor="width">W (cm)</label>
          <input
            id="width"
            className="input dim-input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            placeholder="0.0"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="height">H (cm)</label>
          <input
            id="height"
            className="input dim-input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            placeholder="0.0"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="depth">D (cm)</label>
          <input
            id="depth"
            className="input dim-input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            placeholder="0.0"
            value={depth}
            onChange={(e) => setDepth(e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="weight">Weight (kg) <span className="muted">e.g. 0.01</span></label>
        <input
          id="weight"
          className="input"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="0.01"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
      </div>

      {saveError && <p className="error-msg">{saveError}</p>}

      <button
        className="btn-primary btn-save"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Saving…' : 'Save to Sheet'}
      </button>
    </div>
  )
}
