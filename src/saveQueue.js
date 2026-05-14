const QUEUE_KEY   = 'shelf_save_queue'
const RECENT_KEY  = 'shelf_recent_saves'
const DUP_WINDOW  = 10 * 60 * 1000 // 10 minutes

// ── Queue helpers ─────────────────────────────────────────────────────────────

function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') } catch { return [] }
}

function setQueue(q) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)) } catch {}
}

export function enqueue(data) {
  const q = getQueue()
  q.push({ _id: Date.now(), ...data })
  setQueue(q)
}

export function getPendingCount() {
  return getQueue().length
}

export async function flushQueue() {
  const queue = getQueue()
  if (!queue.length) return
  const remaining = []
  for (const item of queue) {
    try {
      const { _id, ...data } = item
      const params = new URLSearchParams({ action: 'save', ...data })
      const res  = await fetch(`/api/save?${params}`)
      const json = await res.json()
      if (!json.ok) remaining.push(item)
    } catch {
      remaining.push(item) // keep if network failed
    }
  }
  setQueue(remaining)
}

// ── Duplicate detection ───────────────────────────────────────────────────────

function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '{}') } catch { return {} }
}

export function recordSave(barcode) {
  const recent = getRecent()
  recent[String(barcode)] = Date.now()
  const cutoff = Date.now() - DUP_WINDOW
  for (const k of Object.keys(recent)) {
    if (recent[k] < cutoff) delete recent[k]
  }
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)) } catch {}
}

export function getLastSaveMinutes(barcode) {
  const ts = getRecent()[String(barcode)]
  if (!ts) return null
  const age = Date.now() - ts
  if (age > DUP_WINDOW) return null
  return Math.max(1, Math.round(age / 60000))
}
