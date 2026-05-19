import { useState, useEffect, useRef, useCallback } from 'react'
import BarcodeScanner from './components/BarcodeScanner'
import DimensionForm from './components/DimensionForm'
import { SCRIPT_URL } from './config'
import { flushQueue, getPendingCount } from './saveQueue'

const CACHE_KEY    = 'shelf_scanner_items_v2'
const CACHE_TS_KEY = 'shelf_scanner_items_ts'
const STALE_MS     = 30 * 1000 // 30 seconds (online-reconnect guard only)

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') } catch { return null }
}

function cacheAge() {
  const ts = parseInt(localStorage.getItem(CACHE_TS_KEY) || '0', 10)
  return ts ? Date.now() - ts : Infinity
}

export default function App() {
  const [step, setStep] = useState('scan')
  const [barcode, setBarcode] = useState('')
  const [foundItem, setFoundItem] = useState(null)
  const [notFoundBarcode, setNotFoundBarcode] = useState('')
  const [listError, setListError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [pendingCount, setPendingCount] = useState(getPendingCount)
  const [itemList, setItemList] = useState(loadCache)

  const fetchingRef = useRef(false)

  const fetchList = useCallback(() => {
    if (!SCRIPT_URL || fetchingRef.current) return
    fetchingRef.current = true
    setRefreshing(true)
    setListError(null)

    fetch(SCRIPT_URL)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setItemList(data)
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data))
            localStorage.setItem(CACHE_TS_KEY, String(Date.now()))
          } catch {}
        } else if (!loadCache()) {
          setListError(data.error || 'Unexpected response.')
        }
      })
      .catch(() => { if (!loadCache()) setListError('Failed to load item list.') })
      .finally(() => { fetchingRef.current = false; setRefreshing(false) })
  }, [])

  // Fetch on mount
  useEffect(() => { fetchList() }, [])

  // Always refresh when user returns to the tab — sheet may have changed
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchList()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [fetchList])

  // Flush offline queue on mount and when coming back online
  useEffect(() => {
    flushQueue().then(() => setPendingCount(getPendingCount()))
    const handleOnline = () => {
      flushQueue().then(() => setPendingCount(getPendingCount()))
      if (cacheAge() > STALE_MS) fetchList()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [fetchList])

  function handleDetected(code) {
    const trimmed = code.trim()
    const found = Array.isArray(itemList)
      ? itemList.find((item) => (item.barcode || '').trim() === trimmed)
      : null
    if (!found) {
      setNotFoundBarcode(trimmed)
      setStep('notfound')
      return
    }
    setBarcode(trimmed)
    setFoundItem(found)
    setStep('form')
  }

  function handleSaved(savedData) {
    if (savedData) {
      setItemList(prev => {
        if (!Array.isArray(prev)) return prev
        const idx = prev.findIndex(item =>
          (item.barcode || '').trim() === savedData.barcode
        )
        if (idx === -1) {
          return [...prev, {
            barcode: savedData.barcode,
            description: savedData.description,
            depth: savedData.depth, width: savedData.width,
            height: savedData.height, weight: savedData.weight,
            pkgDepth: savedData.pkgDepth, pkgWidth: savedData.pkgWidth, pkgHeight: savedData.pkgHeight,
          }]
        }
        const next = [...prev]
        next[idx] = { ...next[idx], ...savedData }
        return next
      })
    }
    setBarcode('')
    setFoundItem(null)
    setStep('scan')
    fetchList()
    setTimeout(() => setPendingCount(getPendingCount()), 2000)
  }

  const header = (
    <header className="app-header">
      <span className="app-icon">📦</span>
      <h1>Shelf Scanner</h1>
    </header>
  )

  if (listError && !itemList) {
    return (
      <div className="app">
        {header}
        <div className="form-screen center">
          <p className="error-msg">{listError}</p>
          <button className="btn-primary" onClick={fetchList}>ลองอีกครั้ง</button>
        </div>
      </div>
    )
  }

  if (itemList === null) {
    return (
      <div className="app">
        {header}
        <div className="form-screen center">
          <p className="muted">กำลังโหลดรายการสินค้า…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {header}

      {pendingCount > 0 && (
        <div style={{
          background: '#fef3c7', color: '#92400e', fontSize: 13,
          textAlign: 'center', padding: '6px 12px',
        }}>
          ⏳ รอส่งข้อมูล {pendingCount} รายการ — จะซิงก์เมื่อออนไลน์
        </div>
      )}

      {refreshing && (
        <div style={{
          background: '#eff6ff', color: '#1d4ed8', fontSize: 12,
          textAlign: 'center', padding: '4px 12px',
        }}>
          🔄 กำลังอัปเดตรายการสินค้า…
        </div>
      )}

      {step === 'notfound' && (
        <div className="form-screen center">
          <p style={{ fontSize: 16, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>
            ไม่พบบาร์โค้ดนี้ในระบบ
          </p>
          <p style={{ fontFamily: 'monospace', fontSize: 15, marginBottom: 20, color: '#374151' }}>
            {notFoundBarcode}
          </p>
          <button
            className="btn-primary"
            onClick={() => { setNotFoundBarcode(''); setStep('scan') }}
          >
            สแกนใหม่
          </button>
        </div>
      )}

      {step === 'scan' && (
        <BarcodeScanner onDetected={handleDetected} itemList={itemList} />
      )}

      {step === 'form' && (
        <DimensionForm
          key={barcode}
          barcode={barcode}
          description={foundItem?.description?.trim() || ''}
          initialWidth={foundItem?.width ?? ''}
          initialHeight={foundItem?.height ?? ''}
          initialDepth={foundItem?.depth ?? ''}
          initialWeight={foundItem?.weight ?? ''}
          initialHanger={foundItem?.hanger ?? false}
          initialPkgDepth={foundItem?.pkgDepth ?? ''}
          initialPkgWidth={foundItem?.pkgWidth ?? ''}
          initialPkgHeight={foundItem?.pkgHeight ?? ''}
          foundItem={foundItem}
          onSaved={handleSaved}
          onRescan={() => setStep('scan')}
        />
      )}
    </div>
  )
}
