import { useState, useEffect, useRef, useCallback } from 'react'
import BarcodeScanner from './components/BarcodeScanner'
import DimensionForm from './components/DimensionForm'
import { SCRIPT_URL } from './config'
import { flushQueue, getPendingCount } from './saveQueue'

const CACHE_KEY    = 'shelf_scanner_items_v4'
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
  const [step, setStep]           = useState('scan')
  const [activeTab, setActiveTab] = useState('scan') // 'scan' | 'list'
  const [selectedDiv, setSelectedDiv] = useState(null) // null = all divisions
  const [barcodeSearch, setBarcodeSearch] = useState('')
  const [showCount, setShowCount] = useState(100)
  const [barcode, setBarcode]     = useState('')
  const [foundItem, setFoundItem]             = useState(null)
  const [notFoundBarcode, setNotFoundBarcode] = useState('')
  const [listError, setListError]             = useState(null)
  const [refreshing, setRefreshing]           = useState(false)
  const [listLoading, setListLoading]         = useState(true)
  const [pendingCount, setPendingCount]       = useState(getPendingCount)
  const [itemList, setItemList]               = useState(loadCache)

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
          setListLoading(false)
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data))
            localStorage.setItem(CACHE_TS_KEY, String(Date.now()))
          } catch {}
        } else if (!loadCache()) {
          setListError(data.error || 'Unexpected response.')
          setListLoading(false)
        }
      })
      .catch(() => {
        if (!loadCache()) setListError('Failed to load item list.')
        setListLoading(false)
      })
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
    if (!Array.isArray(itemList)) {
      // Still loading — can't look up yet; stay on scan screen
      return
    }
    const found = itemList.find((item) => (item.barcode || '').trim() === trimmed)
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

  // No cache — show loading screen so scanner doesn't fire before items are ready
  if (!itemList) {
    return (
      <div className="app">
        {header}
        <div className="form-screen center">
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>กำลังโหลดข้อมูลสินค้า…</p>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>รอสักครู่ ครั้งต่อไปจะเร็วขึ้น</p>
        </div>
      </div>
    )
  }

  const remaining  = Array.isArray(itemList) ? itemList.filter(item => !itemHasDims(item)) : []
  const total      = Array.isArray(itemList) ? itemList.length : 0
  const doneCount  = total - remaining.length

  // Unique divisions from remaining items (preserve sheet order)
  const divisions = []
  remaining.forEach(item => {
    const d = (item.division || '').trim()
    if (d && !divisions.includes(d)) divisions.push(d)
  })

  const divFiltered = selectedDiv
    ? remaining.filter(item => (item.division || '').trim() === selectedDiv)
    : remaining
  const barcodeQuery = barcodeSearch.trim().toLowerCase()
  const visibleItems = (barcodeQuery
    ? divFiltered.filter(item =>
        (item.barcode || '').includes(barcodeQuery) ||
        (item.description || '').toLowerCase().includes(barcodeQuery)
      )
    : divFiltered
  ).slice().sort((a, b) => {
    const dept = (a.department || '').localeCompare(b.department || '')
    if (dept !== 0) return dept
    return (a.cls || '').localeCompare(b.cls || '')
  })

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

      {/* Not found */}
      {step === 'notfound' && (
        <div className="form-screen center">
          <p style={{ fontSize: 16, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>
            ไม่พบบาร์โค้ดนี้ในระบบ
          </p>
          <p style={{ fontFamily: 'monospace', fontSize: 15, marginBottom: 20, color: '#374151' }}>
            {notFoundBarcode}
          </p>
          <button className="btn-primary" onClick={() => { setNotFoundBarcode(''); setStep('scan') }}>
            สแกนใหม่
          </button>
        </div>
      )}

      {/* Scanner */}
      {step === 'scan' && activeTab === 'scan' && (
        <BarcodeScanner onDetected={handleDetected} itemList={itemList} />
      )}

      {/* Item list tab */}
      {step === 'scan' && activeTab === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

          {/* Loading spinner when data not yet available */}
          {listLoading && !itemList && (
            <div style={{ textAlign: 'center', padding: '64px 16px', color: '#6b7280' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
              <p style={{ fontSize: 15 }}>กำลังโหลดรายการสินค้า…</p>
            </div>
          )}

          {/* List content — only when data is loaded */}
          {itemList && <>

          {/* Summary bar */}
          <div style={{
            padding: '8px 16px', background: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              ยังไม่มีข้อมูล <strong style={{ color: '#dc2626' }}>{remaining.length}</strong> รายการ
            </span>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              เสร็จแล้ว <strong style={{ color: '#16a34a' }}>{doneCount}</strong> / {total}
            </span>
          </div>

          {/* Division filter buttons */}
          {divisions.length > 0 && (
            <div style={{
              display: 'flex', gap: 8, overflowX: 'auto',
              padding: '8px 12px', background: '#fff',
              borderBottom: '1px solid #e5e7eb', flexShrink: 0,
              WebkitOverflowScrolling: 'touch',
            }}>
              <button
                onClick={() => { setSelectedDiv(null); setBarcodeSearch(''); setShowCount(100) }}
                style={{
                  flexShrink: 0, padding: '5px 14px', borderRadius: 20, fontSize: 13,
                  border: '1.5px solid',
                  borderColor: selectedDiv === null ? '#3b82f6' : '#d1d5db',
                  background: selectedDiv === null ? '#3b82f6' : '#fff',
                  color: selectedDiv === null ? '#fff' : '#374151',
                  cursor: 'pointer', fontWeight: 500,
                }}
              >
                ทั้งหมด ({remaining.length})
              </button>
              {divisions.map(div => {
                const count = remaining.filter(i => (i.division || '').trim() === div).length
                const active = selectedDiv === div
                return (
                  <button
                    key={div}
                    onClick={() => { setSelectedDiv(div); setBarcodeSearch(''); setShowCount(100) }}
                    style={{
                      flexShrink: 0, padding: '5px 14px', borderRadius: 20, fontSize: 13,
                      border: '1.5px solid',
                      borderColor: active ? '#3b82f6' : '#d1d5db',
                      background: active ? '#3b82f6' : '#fff',
                      color: active ? '#fff' : '#374151',
                      cursor: 'pointer', fontWeight: 500,
                    }}
                  >
                    {div} ({count})
                  </button>
                )
              })}
            </div>
          )}

          {/* Barcode search within selected division */}
          <div style={{ padding: '8px 12px', background: '#fff', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
            <input
              type="text"
              placeholder={selectedDiv ? `ค้นหาบาร์โค้ดหรือชื่อสินค้าใน ${selectedDiv}…` : 'ค้นหาบาร์โค้ดหรือชื่อสินค้า…'}
              value={barcodeSearch}
              onChange={e => { setBarcodeSearch(e.target.value); setShowCount(100) }}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '7px 12px', borderRadius: 8, fontSize: 14,
                border: '1.5px solid #d1d5db', outline: 'none',
              }}
            />
          </div>

          {/* Item rows */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {visibleItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: '#16a34a' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                <p style={{ fontWeight: 600, fontSize: 16 }}>
                  {selectedDiv ? `${selectedDiv} — ครบแล้ว!` : 'ครบทุกรายการแล้ว!'}
                </p>
                <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                  สินค้าทุกชิ้นมีข้อมูลขนาดครบถ้วน
                </p>
              </div>
            ) : (
              <>
              {visibleItems.slice(0, showCount).map((item, idx) => (
                <div
                  key={item.barcode || idx}
                  onClick={() => handleSelectItem(item)}
                  onTouchStart={(e) => e.currentTarget.style.background = '#f0f9ff'}
                  onTouchEnd={(e) => e.currentTarget.style.background = '#fff'}
                  style={{
                    padding: '12px 16px', borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', background: '#fff',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 500, color: '#111827',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {item.description || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>ไม่มีชื่อสินค้า</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'monospace' }}>{item.barcode}</span>
                      {!selectedDiv && item.division && (
                        <span style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 4, padding: '0 5px', fontSize: 11 }}>
                          {item.division}
                        </span>
                      )}
                      {item.department && (
                        <span style={{ background: '#f0fdf4', color: '#15803d', borderRadius: 4, padding: '0 5px', fontSize: 11 }}>
                          {item.department}
                        </span>
                      )}
                      {item.cls && (
                        <span style={{ background: '#fdf4ff', color: '#7e22ce', borderRadius: 4, padding: '0 5px', fontSize: 11 }}>
                          {item.cls}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ color: '#9ca3af', fontSize: 18, marginLeft: 8 }}>›</span>
                </div>
              ))}
              {visibleItems.length > showCount && (
                <div style={{ textAlign: 'center', padding: '16px' }}>
                  <button
                    onClick={() => setShowCount(c => c + 100)}
                    style={{
                      padding: '8px 24px', borderRadius: 8, fontSize: 14,
                      border: '1.5px solid #d1d5db', background: '#fff',
                      cursor: 'pointer', color: '#374151',
                    }}
                  >
                    โหลดเพิ่ม ({visibleItems.length - showCount} รายการที่เหลือ)
                  </button>
                </div>
              )}
              </>
            )}
          </div>

          </>}
        </div>
      )}

      {/* Form */}
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
          initialDimUsername={foundItem?.dimUsername ?? ''}
          initialWeightUsername={foundItem?.weightUsername ?? ''}
          foundItem={foundItem}
          onSaved={handleSaved}
          onRescan={() => { setStep('scan'); setActiveTab('scan') }}
        />
      )}
    </div>
  )
}
