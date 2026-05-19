import { useState, useRef } from 'react'
import { enqueue, flushQueue, recordSave, getLastSaveMinutes } from '../saveQueue'

const USERNAME_KEY = 'shelf_scanner_username'

export default function DimensionForm({
  barcode, description,
  initialWidth, initialHeight, initialDepth, initialWeight,
  initialHanger,
  initialPkgDepth, initialPkgWidth, initialPkgHeight,
  foundItem,
  onSaved, onRescan,
}) {
  const initW    = initialWidth  !== '' ? String(initialWidth)  : ''
  const initH    = initialHeight !== '' ? String(initialHeight) : ''
  const initD    = initialDepth  !== '' ? String(initialDepth)  : ''
  const initWt   = initialWeight !== '' ? String(initialWeight) : ''
  const initHanger = !!initialHanger
  const initPkgD = initialPkgDepth  !== '' ? String(initialPkgDepth)  : ''
  const initPkgW = initialPkgWidth  !== '' ? String(initialPkgWidth)  : ''
  const initPkgH = initialPkgHeight !== '' ? String(initialPkgHeight) : ''

  const [width,     setWidth]     = useState(initW)
  const [height,    setHeight]    = useState(initH)
  const [depth,     setDepth]     = useState(initD)
  const [weight,    setWeight]    = useState(initWt)
  const [isHanger,  setIsHanger]  = useState(initHanger)
  const [pkgDepth,  setPkgDepth]  = useState(initPkgD)
  const [pkgWidth,  setPkgWidth]  = useState(initPkgW)
  const [pkgHeight, setPkgHeight] = useState(initPkgH)
  const [username,  setUsername]  = useState(() => {
    try { return localStorage.getItem(USERNAME_KEY) || '' } catch { return '' }
  })
  const [savedOk,   setSavedOk]   = useState(false)
  const [saveError, setSaveError] = useState(null)

  function handleUsernameChange(e) {
    const val = e.target.value
    setUsername(val)
    try { localStorage.setItem(USERNAME_KEY, val) } catch {}
  }

  const [dupMinutes] = useState(() => getLastSaveMinutes(barcode))

  const isExisting = !!foundItem
  const unchanged  = isExisting &&
    width === initW && height === initH && depth === initD &&
    weight === initWt && isHanger === initHanger &&
    pkgDepth === initPkgD && pkgWidth === initPkgW && pkgHeight === initPkgH

  const widthRef     = useRef()
  const heightRef    = useRef()
  const depthRef     = useRef()
  const weightRef    = useRef()
  const pkgWidthRef  = useRef()
  const pkgHeightRef = useRef()
  const pkgDepthRef  = useRef()
  const saveRef      = useRef()

  const advance = (nextRef) => (e) => {
    if (e.key === 'Enter') { e.preventDefault(); nextRef.current?.focus() }
  }

  // Select all on focus so typing replaces the old value immediately
  const selectAll = (e) => e.target.select()

  // Normalize .6 → 0.6 and 6. → 6 on blur
  const normDecimal = (val, setter) => {
    if (!val) return
    let v = val
    if (v.startsWith('.')) v = '0' + v
    if (v.endsWith('.'))   v = v.slice(0, -1)
    if (v !== val) setter(v)
  }

  function handleSave() {
    if (!username.trim()) {
      setSaveError('กรุณากรอกชื่อผู้บันทึก')
      return
    }
    if (!width || !height || !depth) {
      setSaveError('กรุณากรอก W, H, และ D')
      return
    }
    const hasSci = (v) => /[eE]/.test(String(v))
    if (hasSci(width) || hasSci(height) || hasSci(depth)) {
      setSaveError('ไม่อนุญาตให้ใช้ scientific notation เช่น 1E+10')
      return
    }
    const rawW = parseFloat(width), rawH = parseFloat(height), rawD = parseFloat(depth)
    if (isNaN(rawW) || isNaN(rawH) || isNaN(rawD)) {
      setSaveError('W, H, D ต้องเป็นตัวเลขที่ถูกต้อง')
      return
    }
    if (rawW < 0.1 || rawH < 0.1 || rawD < 0.1) {
      setSaveError('W, H, D ต้องมีค่าอย่างน้อย 0.1 ซม.')
      return
    }
    if (rawW > 500 || rawH > 500 || rawD > 500) {
      setSaveError('W, H, D ต้องไม่เกิน 500 ซม.')
      return
    }
    const round2 = (v) => Math.round(v * 100) / 100
    const round3 = (v) => Math.round(v * 1000) / 1000
    const w = round2(rawW), h = round2(rawH), d = round2(rawD)

    const weightRaw = weight.trim()
    if (!weightRaw) {
      setSaveError('กรุณากรอกน้ำหนัก (Net Weight)')
      return
    }
    if (!/^\d+(\.\d+)?$/.test(weightRaw)) {
      setSaveError('น้ำหนักต้องเป็นตัวเลขบวก เช่น 0.5')
      return
    }
    const wt = round3(parseFloat(weightRaw))
    if (wt === 0) {
      setSaveError('น้ำหนักต้องมากกว่า 0')
      return
    }
    if (wt < 0.001) {
      setSaveError('น้ำหนักต้องมีค่าอย่างน้อย 0.001 กก. (1 กรัม)')
      return
    }
    if (wt > 999) {
      setSaveError('น้ำหนักต้องไม่เกิน 999 กก.')
      return
    }

    const pkgAny = pkgDepth.trim() || pkgWidth.trim() || pkgHeight.trim()
    let pkgD = 0, pkgW = 0, pkgH = 0
    if (pkgAny) {
      if (!pkgDepth.trim() || !pkgWidth.trim() || !pkgHeight.trim()) {
        setSaveError('กรุณากรอก W, H, D ของบรรจุภัณฑ์ให้ครบทั้ง 3 ค่า')
        return
      }
      if (hasSci(pkgWidth) || hasSci(pkgHeight) || hasSci(pkgDepth)) {
        setSaveError('ไม่อนุญาตให้ใช้ scientific notation ในขนาดบรรจุภัณฑ์')
        return
      }
      const rawPkgW = parseFloat(pkgWidth), rawPkgH = parseFloat(pkgHeight), rawPkgD = parseFloat(pkgDepth)
      if (isNaN(rawPkgW) || isNaN(rawPkgH) || isNaN(rawPkgD)) {
        setSaveError('ขนาดบรรจุภัณฑ์ต้องเป็นตัวเลขที่ถูกต้อง')
        return
      }
      if (rawPkgW < 0.1 || rawPkgH < 0.1 || rawPkgD < 0.1) {
        setSaveError('ขนาดบรรจุภัณฑ์ต้องมีค่าอย่างน้อย 0.1 ซม.')
        return
      }
      if (rawPkgW > 500 || rawPkgH > 500 || rawPkgD > 500) {
        setSaveError('ขนาดบรรจุภัณฑ์ต้องไม่เกิน 500 ซม.')
        return
      }
      pkgW = round2(rawPkgW); pkgH = round2(rawPkgH); pkgD = round2(rawPkgD)
    }

    const data = {
      barcode,
      description: description.trim(),
      width: w, height: h, depth: d,
      weight: wt,
      hanger: isHanger,
      pkgDepth: pkgD, pkgWidth: pkgW, pkgHeight: pkgH,
      username: username.trim(),
    }
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
        <div className="saved-badge" style={{ background: '#fef3c7', color: '#92400e' }}>รอส่งข้อมูล</div>
        <p className="muted">ไม่มีอินเทอร์เน็ต — จะซิงก์อัตโนมัติเมื่อออนไลน์</p>
      </div>
    )
  }

  if (savedOk === 'saved') {
    return (
      <div className="form-screen center">
        <div className="saved-badge">บันทึกแล้ว!</div>
        <p className="muted">พร้อมสแกนรายการถัดไป…</p>
      </div>
    )
  }

  return (
    <div className="form-screen">
      {dupMinutes && (
        <div style={{
          background: '#fef3c7', color: '#92400e', borderRadius: 8,
          padding: '8px 12px', marginBottom: 8, fontSize: 13,
        }}>
          ⚠️ บันทึกรายการนี้ไปแล้ว {dupMinutes} นาที — กำลังแก้ไขข้อมูลเดิม
        </div>
      )}

      <div className="field" style={{ marginBottom: 6 }}>
        <label htmlFor="username" style={{ fontSize: 13 }}>
          ชื่อผู้บันทึก <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          id="username"
          className="input"
          type="text"
          placeholder="กรอกชื่อของคุณ"
          value={username}
          onChange={handleUsernameChange}
          style={{ fontSize: 14 }}
        />
      </div>

      <div className="barcode-display">
        <span className="barcode-label">บาร์โค้ด</span>
        <span className="barcode-value">{barcode}</span>
        <button
          onClick={onRescan}
          style={{
            border: '1.5px solid #3b82f6', color: '#3b82f6',
            borderRadius: 6, padding: '4px 12px',
            background: 'transparent', cursor: 'pointer',
            fontSize: 13, fontWeight: 500,
          }}
        >
          สแกนใหม่
        </button>
      </div>

      <div className="field">
        <label>ชื่อสินค้า <span className="muted">(จากชีต)</span></label>
        <div style={{
          padding: '8px 12px', borderRadius: 8, fontSize: 14,
          background: description ? '#f0fdf4' : '#f9fafb',
          border: `1.5px solid ${description ? '#22c55e' : '#e5e7eb'}`,
          color: description ? '#14532d' : '#9ca3af',
          minHeight: 40, lineHeight: '22px',
        }}>
          {description || <em>ไม่มีชื่อสินค้าในชีต</em>}
        </div>
      </div>

      <div className="dims-grid">
        <div className="field">
          <label htmlFor="width">W (ซม.) <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            ref={widthRef} id="width" className="input dim-input"
            type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            onFocus={selectAll}
            onBlur={() => normDecimal(width, setWidth)}
            onKeyDown={advance(heightRef)} autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="height">H (ซม.) <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            ref={heightRef} id="height" className="input dim-input"
            type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            onFocus={selectAll}
            onBlur={() => normDecimal(height, setHeight)}
            onKeyDown={advance(depthRef)}
          />
        </div>
        <div className="field">
          <label htmlFor="depth">D (ซม.) <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            ref={depthRef} id="depth" className="input dim-input"
            type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00"
            value={depth}
            onChange={(e) => setDepth(e.target.value)}
            onFocus={selectAll}
            onBlur={() => normDecimal(depth, setDepth)}
            onKeyDown={advance(weightRef)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="weight">
          Net Weight (กก.) <span style={{ color: '#ef4444' }}>*</span>
          <span className="muted" style={{ marginLeft: 4, fontSize: 12 }}>ชั่งรวม product + packaging</span>
        </label>
        <input
          ref={weightRef} id="weight" className="input"
          type="text" inputMode="decimal" placeholder="0.001"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onFocus={selectAll}
          onBlur={() => normDecimal(weight, setWeight)}
          onKeyDown={advance(pkgWidthRef)}
        />
      </div>

      <div className="field" style={{ marginTop: 4 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={isHanger}
            onChange={(e) => setIsHanger(e.target.checked)}
            style={{ width: 20, height: 20, accentColor: '#3b82f6', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 15 }}>สินค้าแขวน (Hanger)</span>
        </label>
      </div>

      <div style={{ marginTop: 14, marginBottom: 4, borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
          ขนาดบรรจุภัณฑ์ (ซม.)
        </span>
        <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>ไม่บังคับ — กรอกครบทั้ง 3 หรือเว้นว่างทั้งหมด</span>
      </div>
      <div className="dims-grid">
        <div className="field">
          <label htmlFor="pkgWidth">W (ซม.)</label>
          <input
            ref={pkgWidthRef} id="pkgWidth" className="input dim-input"
            type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00"
            value={pkgWidth}
            onChange={(e) => setPkgWidth(e.target.value)}
            onFocus={selectAll}
            onBlur={() => normDecimal(pkgWidth, setPkgWidth)}
            onKeyDown={advance(pkgHeightRef)}
          />
        </div>
        <div className="field">
          <label htmlFor="pkgHeight">H (ซม.)</label>
          <input
            ref={pkgHeightRef} id="pkgHeight" className="input dim-input"
            type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00"
            value={pkgHeight}
            onChange={(e) => setPkgHeight(e.target.value)}
            onFocus={selectAll}
            onBlur={() => normDecimal(pkgHeight, setPkgHeight)}
            onKeyDown={advance(pkgDepthRef)}
          />
        </div>
        <div className="field">
          <label htmlFor="pkgDepth">D (ซม.)</label>
          <input
            ref={pkgDepthRef} id="pkgDepth" className="input dim-input"
            type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00"
            value={pkgDepth}
            onChange={(e) => setPkgDepth(e.target.value)}
            onFocus={selectAll}
            onBlur={() => normDecimal(pkgDepth, setPkgDepth)}
            onKeyDown={advance(saveRef)}
          />
        </div>
      </div>

      {saveError && <p className="error-msg">{saveError}</p>}

      {unchanged && (
        <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', margin: '4px 0' }}>
          ไม่มีการเปลี่ยนแปลง — แก้ไขค่าก่อนบันทึก
        </p>
      )}

      <button
        ref={saveRef}
        className="btn-primary btn-save"
        onClick={handleSave}
        disabled={unchanged}
        style={unchanged ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
      >
        บันทึก
      </button>
    </div>
  )
}
