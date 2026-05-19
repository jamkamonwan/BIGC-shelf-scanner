import { useState, useEffect, useRef, useCallback } from 'react'
import BarcodeScanner from './components/BarcodeScanner'
import DimensionForm from './components/DimensionForm'
import { SCRIPT_URL } from './config'
import { flushQueue, getPendingCount } from './saveQueue'

const CACHE_KEY    = 'shelf_scanner_items_v2'
const CACHE_TS_KEY = 'shelf_scanner_items_ts'
const STALE_MS     = 30 * 1000

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') } catch { return null }
}

function cacheAge() {
  const ts = parseInt(localStorage.getItem(CACHE_TS_KEY) || '0', 10)
  return ts ? Date.now() - ts : Infinity
}

function itemHasDims(item) {
  return item.width !== '' && item.height !== '' && item.depth !== '' &&
         item.width != null && item.height != null && item.depth != null &&
         item.width !== 0 && item.height !== 0 && item.depth !== 0
}

export default function App() {
  const [step, setStep]       = useState('scan')
  const [activeTab, setActiveTab] = useState('scan') // 'scan' | 'list'
  const [barcode, setBarcode] = useState('')
  const [foundItem, setFoundItem]         = useState(null)
  const [notFoundBarcode, setNotFoundBarcode] = useState('')
  const [listError, setListError]         = useState(null)
  const [refreshing, setRefreshing]       = useState(false)
  const [pendingCount, setPendingCount]   = useState(getPendingCount)
  const [itemList, setItemList]           = useState(loadCache)

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

  useEffect(() => { fetchList() }, [])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchList()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [fetchList])

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

  function handleSelectItem(item) {
    setBarcode((item.barcode || '').trim())
    setFoundItem(item)
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

  const remaining = Array.isArray(itemList) ? itemList.filter(item => !itemHasDims(item)) : []
  const total     = Array.isArray(itemList) ? itemList.length : 0
  const doneCount = total - remaining.length

  // Tab bar (shown when not in form)
  const tabBar = step !== 'form' && (
    <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', background: '#fff' }}>
      <button
        onClick={() => { setStep('scan'); setActiveTab('scan') }}
        style={{
          flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 600,
          border: 'none', background: 'none', cursor: 'pointer',
          borderBottom: activeTab === 'scan' ? '2px solid #3b82f6' : '2px solid transparent',
          color: activeTab === 'scan' ? '#3b82f6' : '#6b7280',
          marginBottom: -2,
        }}
      >
        📷 สแกน
      </button>
      <button
        onClick={() => setActiveTab('list')}
        style={{
          flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 600,
          border: 'none', background: 'none', cursor: 'pointer',
          borderBottom: activeTab === 'list' ? '2px solid #3b82f6' : '2px solid transparent',
          color: activeTab === 'list' ? '#3b82f6' : '#6b7280',
          marginBottom: -2,
        }}
      >
        📋 รายการ {remaining.length > 0 && (
          <span style={{
            background: '#ef4444', color: '#fff', borderRadius: 10,
            fontSize: 11, padding: '1px 6px', marginLeft: 4,
          }}>
            {remaining.length}
          </span>
        )}
      </button>
    </div>
  )

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

      {tabBar}

      {/* Not found screen */}
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

      {/* Scanner tab */}
      {step === 'scan' && activeTab === 'scan' && (
        <BarcodeScanner onDetected={handleDetected} itemList={itemList} />
      )}

      {/* Item list tab — remaining items only */}
      {step === 'scan' && activeTab === 'list' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{
            padding: '10px 16px', background: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              ยังไม่มีข้อมูล <strong style={{ color: '#dc2626' }}>{remaining.length}</strong> รายการ
            </span>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              เสร็จแล้ว <strong style={{ color: '#16a34a' }}>{doneCount}</strong> / {total}
            </span>
          </div>

          {remaining.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#16a34a' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
              <p style={{ fontWeight: 600, fontSize: 16 }}>ครบทุกรายการแล้ว!</p>
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>สินค้าทุกชิ้นมีข้อมูลขนาดครบถ้วน</p>
            </div>
          ) : (
            <div>
              {remaining.map((item, idx) => (
                <div
                  key={item.barcode || idx}
                  onClick={() => handleSelectItem(item)}
                  style={{
                    padding: '12px 16px', borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', background: '#fff',
                    activeOpacity: 0.7,
                  }}
                  onTouchStart={(e) => e.currentTarget.style.background = '#f0f9ff'}
                  onTouchEnd={(e) => e.currentTarget.style.background = '#fff'}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 500, color: '#111827',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {item.description || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>ไม่มีชื่อสินค้า</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, fontFamily: 'monospace' }}>
                      {item.barcode}
                    </div>
                  </div>
                  <span style={{ color: '#9ca3af', fontSize: 18, marginLeft: 8 }}>›</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dimension form */}
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
          onRescan={() => { setStep('scan'); setActiveTab('scan') }}
        />
      )}
    </div>
  )
}
