import { useState, useEffect } from 'react'
import BarcodeScanner from './components/BarcodeScanner'
import DimensionForm from './components/DimensionForm'
import { SCRIPT_URL } from './config'
import { flushQueue, getPendingCount } from './saveQueue'

const CACHE_KEY = 'shelf_scanner_items_v2'

export default function App() {
  const [step, setStep] = useState('scan')
  const [barcode, setBarcode] = useState('')
  const [description, setDescription] = useState('')
  const [foundItem, setFoundItem] = useState(null)
  const [listError, setListError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(getPendingCount)

  const [itemList, setItemList] = useState(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      return cached ? JSON.parse(cached) : null
    } catch { return null }
  })

  // Fetch fresh item list
  useEffect(() => {
    if (!SCRIPT_URL) { setListError('Apps Script URL not configured.'); return }
    setListError(null)
    fetch(SCRIPT_URL)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setItemList(data)
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch {}
        } else if (!itemList) {
          setListError(data.error || 'Unexpected response.')
        }
      })
      .catch(() => { if (!itemList) setListError('Failed to load item list.') })
  }, [retryCount])

  // Flush offline queue on mount and when coming back online
  useEffect(() => {
    flushQueue().then(() => setPendingCount(getPendingCount()))
    const handleOnline = () => flushQueue().then(() => setPendingCount(getPendingCount()))
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

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
    setRetryCount((n) => n + 1)
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
          <button className="btn-primary" onClick={() => setRetryCount((n) => n + 1)}>Retry</button>
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
