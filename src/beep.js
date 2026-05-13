const ctx = () => new (window.AudioContext || window.webkitAudioContext)()

export function beepSuccess() {
  const ac = ctx()
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.frequency.setValueAtTime(880, ac.currentTime)
  osc.frequency.setValueAtTime(1200, ac.currentTime + 0.1)
  gain.gain.setValueAtTime(0.3, ac.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3)
  osc.start(ac.currentTime)
  osc.stop(ac.currentTime + 0.3)
}

export function beepError() {
  const ac = ctx()
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(300, ac.currentTime)
  osc.frequency.setValueAtTime(150, ac.currentTime + 0.15)
  gain.gain.setValueAtTime(0.3, ac.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.35)
  osc.start(ac.currentTime)
  osc.stop(ac.currentTime + 0.35)
}
