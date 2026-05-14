import { useState, useEffect, useRef, useCallback } from 'react'
import BarcodeScanner from './components/BarcodeScanner'
import DimensionForm from './components/DimensionForm'
import { SCRIPT_URL } from './config'
import { flushQueue, getPendingCount } from './saveQueue'

const CACHE_KEY    = 'shelf_scanner_items_v2'
const CACHE_TS_KEY = 'shelf_scanner_items_ts'
const STALE_MS     = 2 * 60 * 1000 // 2 minutes

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
  const [description, setDescription] = useState('')
  const [foundItem, setFoundItem] = useState(null)
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

  // Refresh when user comes back to the tab/app
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && cacheAge() > STALE_MS) {
        fetchList()
      }
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
      ? itemList.find(
          (item) =>
            (item.barcode || '').trim() === trimmed ||
            (item.articleCode || '').trim() === trimmed
        )
      : null
    setBarcode(trimmed)
    setDescription(found?.description?.trim() || '')
    setFoundItem(found || null)
    setStep('form')
  }

  function handleSaved() {
    setBarcode('')
    setDescription('')
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
          <button className="btn-primary" onClick={fetchList}>Retry</button>
        </div>
      </div>
    )
  }

  if (itemList === null) {
    return (
      <div className="app">
        {header}
        <div className="form-screen center">
          <p className="muted">Loading item list…</p>
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
          ⏳ {pendingCount} save{pendingCount > 1 ? 's' : ''} pending — will sync when online
        </div>
      )}

      {refreshing && (
        <div style={{
          background: '#eff6ff', color: '#1d4ed8', fontSize: 12,
          textAlign: 'center', padding: '4px 12px',
        }}>
          🔄 Updating item list…
        </div>
      )}

      {step === 'scan' && (
        <BarcodeScanner onDetected={handleDetected} itemList={itemList} />
      )}

      {step === 'form' && (
        <DimensionForm
          key={barcode}
          barcode={barcode}
          description={description}
          setDescription={setDescription}
          initialWidth={foundItem?.width ?? ''}
          initialHeight={foundItem?.height ?? ''}
          initialDepth={foundItem?.depth ?? ''}
          initialWeight={foundItem?.weight ?? ''}
          onSaved={handleSaved}
          onRescan={() => setStep('scan')}
        />
      )}
    </div>
  )
}
