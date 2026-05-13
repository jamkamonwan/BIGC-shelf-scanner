import { useState, useEffect } from 'react'
import BarcodeScanner from './components/BarcodeScanner'
import DimensionForm from './components/DimensionForm'
import { SCRIPT_URL } from './config'

export default function App() {
  const [step, setStep] = useState('scan')
  const [barcode, setBarcode] = useState('')
  const [description, setDescription] = useState('')
  const [itemList, setItemList] = useState(null)
  const [listError, setListError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!SCRIPT_URL) {
      setListError('Apps Script URL not configured in src/config.js.')
      return
    }
    setListError(null)
    fetch(SCRIPT_URL)
      .then((res) => res.json())
      .then((data) => setItemList(data))
      .catch(() => setListError('Failed to load item list. Check your connection.'))
  }, [retryCount])

  function handleDetected(code) {
    const found = itemList?.find(
      (item) => item.barcode === code || item.articleCode === code
    )
    setBarcode(code)
    setDescription(found?.description || '')
    setStep('form')
  }

  function handleSaved() {
    setBarcode('')
    setDescription('')
    setStep('scan')
  }

  const header = (
    <header className="app-header">
      <span className="app-icon">📦</span>
      <h1>Shelf Scanner</h1>
    </header>
  )

  if (listError) {
    return (
      <div className="app">
        {header}
        <div className="form-screen center">
          <p className="error-msg">{listError}</p>
          {SCRIPT_URL && (
            <button className="btn-primary" onClick={() => setRetryCount((n) => n + 1)}>
              Retry
            </button>
          )}
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

      {step === 'scan' && (
        <BarcodeScanner onDetected={handleDetected} itemList={itemList} />
      )}

      {step === 'form' && (
        <DimensionForm
          barcode={barcode}
          description={description}
          setDescription={setDescription}
          onSaved={handleSaved}
          onRescan={() => setStep('scan')}
        />
      )}
    </div>
  )
}
