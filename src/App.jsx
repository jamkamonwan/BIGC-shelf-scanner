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

function itemHasWeight(item) {
  return item.weight !== '' && item.weight != null && Number(item.weight) > 0
}

function getStatus(item) {
  if (!itemHasDims(item)) return 'need_dim'
  if (!itemHasWeight(item)) return 'need_weight'
  return 'done'
}

export default function App() {
  const [step, setStep]           = useState('scan')
  const [activeTab, setActiveTab] = useState('scan') // 'scan' | 'list'
  const [selectedDiv, setSelectedDiv]       = useState(null)   // null = all
  const [selectedStatus, setSelectedStatus] = useState(null)   // null | 'need_dim' | 'need_weight'
  const [barcodeSearch, setBarcodeSearch]   = useState('')
  const [showCount, setShowCount]           = useState(100)
  const [barcode, setBarcode]     = useState('')
  const [foundItem, setFoundItem]             = useState(null)
  const [notFoundBarcode, setNotFoundBarcode] = useState('')
  const [listError, setListError]             = useState(null)
  const [refreshing, setRefreshing]           = useState(false)
  const [listLoading, setListLoading]         = useState(true)
  const [pendingCount, setPendingCount]       = useState(getPendingCount)
  const [itemList, setItemList]               = useState(loadCache)

  const fetchingRef  = useRef(false)
  const itemListRef  = useRef(itemList)

  useEffect(() => { itemListRef.current = itemList }, [itemList])

  const fetchList = useCallback(() => {
    if (!SCRIPT_URL || fetchingRef.current) return
    fetchingRef.current = true
    setRefreshing(true)
    setListError(null)

    fetch(SCRIPT_URL)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          itemListRef.current = data
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

  const handleDetected = useCallback((code) => {
    const trimmed = code.trim()
    const list = itemListRef.current
    if (!Array.isArray(list)) return
    const found = list.find((item) => (item.barcode || '').trim() === trimmed)
    if (!found) {
      setNotFoundBarcode(trimmed)
      setStep('notfound')
      return
    }
    setBarcode(trimmed)
    setFoundItem(found)
    setStep('form')
  }, [])

  function handleSelectItem(item) {
    setBarcode((item.barcode || '').trim())
    setFoundItem(item)
    setStep('form')
  }

  function handleSaved(savedData) {
    if (savedData) {
      const prev = itemListRef.current
      if (Array.isArray(prev)) {
        const idx = prev.findIndex(item =>
          (item.barcode || '').trim() === savedData.barcode
        )
        let next
        if (idx === -1) {
          next = [...prev, {
            barcode: savedData.barcode,
            description: savedData.description,
            depth: savedData.depth, width: savedData.width,
            height: savedData.height, weight: savedData.weight,
            pkgDepth: savedData.pkgDepth, pkgWidth: savedData.pkgWidth, pkgHeight: savedData.pkgHeight,
          }]
        } else {
          next = [...prev]
          next[idx] = { ...next[idx], ...savedData }
        }
        itemListRef.current = next
        setItemList(next)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(next))
          localStorage.setItem(CACHE_TS_KEY, String(Date.now()))
        } catch {}
      }
    }
    setBarcode('')
    setFoundItem(null)
    setBarcodeSearch('')
    setStep('scan')
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

  const total        = Array.isArray(itemList) ? itemList.length : 0
  const remaining    = Array.isArray(itemList) ? itemList.filter(item => getStatus(item) !== 'done') : []
  const needDimCount    = remaining.filter(item => getStatus(item) === 'need_dim').length
  const needWeightCount = remaining.filter(item => getStatus(item) === 'need_weight').length
  const doneCount    = total - remaining.length

  // Unique divisions from remaining items (preserve sheet order)
  const divisions = []
  remaining.forEach(item => {
    const d = (item.division || '').trim()
    if (d && !divisions.includes(d)) divisions.push(d)
  })

  const divFiltered = selectedDiv
    ? remaining.filter(item => (item.division || '').trim() === selectedDiv)
    : remaining
  const statusFiltered = selectedStatus
    ? divFiltered.filter(item => getStatus(item) === selectedStatus)
    : divFiltered
  const barcodeQuery = barcodeSearch.trim().toLowerCase()
  const visibleItems = (barcodeQuery
    ? statusFiltered.filter(item =>
        (item.barcode || '').includes(barcodeQuery) ||
        (item.description || '').toLowerCase().includes(barcodeQuery)
      )
    : statusFiltered
  ).slice().sort((a, b) => {
    const dept = (a.department || '').localeCompare(b.department || '')
    if (dept !== 0) return dept
    return (a.cls || '').localeCompare(b.cls || '')
  })

  const emptyState = (() => {
    const msg = (icon, title, sub, color = '#374151') => (
      <div style={{ textAlign: 'center', padding: '48px 16px' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>{icon}</div>
        <p style={{ fontWeight: 600, fontSize: 16, color }}>{title}</p>
        {sub && <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{sub}</p>}
      </div>
    )
    if (barcodeQuery) {
      const match = (item) =>
        (item.barcode || '').includes(barcodeQuery) ||
        (item.description || '').toLowerCase().includes(barcodeQuery)
      if (!itemList.some(match))  return msg('🔍', 'ไม่พบสินค้าที่ค้นหา', 'ตรวจสอบบาร์โค้ดหรือชื่อสินค้าอีกครั้ง')
      if (!remaining.some(match)) return msg('✅', 'สินค้านี้บันทึกครบแล้ว', 'ข้อมูล W/H/D และน้ำหนักครบถ้วนแล้ว', '#16a34a')
      return msg('ℹ️', 'สินค้านี้อยู่ในหมวด/สถานะอื่น', 'ลองยกเลิกตัวกรอง Division หรือสถานะ')
    }
    if (selectedStatus === 'need_weight') return msg('⚖️', 'ไม่มีสินค้ารอใส่ข้อมูลชั่งจากผลการกรอง', 'ลองเปลี่ยน Division หรือตัวกรองสถานะ')
    if (selectedStatus === 'need_dim')    return msg('📐', 'ไม่มีสินค้ารอใส่ข้อมูลวัดจากผลการกรอง', 'ลองเปลี่ยน Division หรือตัวกรองสถานะ')
    return msg('✅', selectedDiv ? `${selectedDiv} — ครบแล้ว!` : 'ครบทุกรายการแล้ว!', 'สินค้าทุกชิ้นมีข้อมูลขนาดครบถ้วน', '#16a34a')
  })()

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
            borderBottom: '1px solid #e5e7eb', flexShrink: 0,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
          }}>
            <div style={{ display: 'flex', gap: 10, fontSize: 12, flexWrap: 'wrap' }}>
              <span style={{ color: '#dc2626', fontWeight: 600 }}>รอ Dim: {needDimCount}</span>
              <span style={{ color: '#ea580c', fontWeight: 600 }}>รอชั่ง: {needWeightCount}</span>
            </div>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              ✅ <strong style={{ color: '#16a34a' }}>{doneCount}</strong> / {total}
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
                onClick={() => { setSelectedDiv(null); setSelectedStatus(null); setBarcodeSearch(''); setShowCount(100) }}
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
                    onClick={() => { setSelectedDiv(div); setSelectedStatus(null); setBarcodeSearch(''); setShowCount(100) }}
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

          {/* Status filter pills */}
          <div style={{
            display: 'flex', gap: 6, padding: '6px 12px', background: '#fff',
            borderBottom: '1px solid #e5e7eb', flexShrink: 0,
          }}>
            {[
              { key: null,           label: `ทั้งหมด (${divFiltered.length})`,                                          bg: '#3b82f6' },
              { key: 'need_dim',     label: `รอ Dim (${divFiltered.filter(i => getStatus(i) === 'need_dim').length})`,     bg: '#dc2626' },
              { key: 'need_weight',  label: `รอชั่ง (${divFiltered.filter(i => getStatus(i) === 'need_weight').length})`,  bg: '#ea580c' },
            ].map(({ key, label, bg }) => {
              const active = selectedStatus === key
              return (
                <button key={String(key)} onClick={() => { setSelectedStatus(key); setShowCount(100) }} style={{
                  flexShrink: 0, padding: '4px 12px', borderRadius: 20, fontSize: 12,
                  border: `1.5px solid ${active ? bg : '#d1d5db'}`,
                  background: active ? bg : '#fff',
                  color: active ? '#fff' : '#374151',
                  cursor: 'pointer', fontWeight: 500,
                }}>
                  {label}
                </button>
              )
            })}
          </div>

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
            {visibleItems.length === 0 ? emptyState : (
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
                      {getStatus(item) === 'need_dim' && (
                        <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 4, padding: '0 5px', fontSize: 11, fontWeight: 600 }}>
                          รอ Dim
                        </span>
                      )}
                      {getStatus(item) === 'need_weight' && (
                        <span style={{ background: '#fff7ed', color: '#ea580c', borderRadius: 4, padding: '0 5px', fontSize: 11, fontWeight: 600 }}>
                          รอชั่ง
                        </span>
                      )}
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
          initialWidth={foundItem?.width || ''}
          initialHeight={foundItem?.height || ''}
          initialDepth={foundItem?.depth || ''}
          initialWeight={foundItem?.weight || ''}
          initialHanger={foundItem?.hanger ?? false}
          initialPkgDepth={foundItem?.pkgDepth || ''}
          initialPkgWidth={foundItem?.pkgWidth || ''}
          initialPkgHeight={foundItem?.pkgHeight || ''}
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
