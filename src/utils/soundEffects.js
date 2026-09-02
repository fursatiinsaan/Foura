// Lightweight Web Audio API synthesizer for satisfying fintech recovery chimes
let audioCtx = null

export const playRecoveryChime = () => {
  try {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (AudioContext) audioCtx = new AudioContext()
    }
    if (!audioCtx) return

    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }

    const now = audioCtx.currentTime

    // Note 1 (E5 - 659.25Hz)
    const osc1 = audioCtx.createOscillator()
    const gain1 = audioCtx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(659.25, now)
    gain1.gain.setValueAtTime(0.12, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
    osc1.connect(gain1)
    gain1.connect(audioCtx.destination)
    osc1.start(now)
    osc1.stop(now + 0.35)

    // Note 2 (B5 - 987.77Hz - The "Cash Reclaimed" Chord)
    const osc2 = audioCtx.createOscillator()
    const gain2 = audioCtx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(987.77, now + 0.08)
    gain2.gain.setValueAtTime(0.15, now + 0.08)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
    osc2.connect(gain2)
    gain2.connect(audioCtx.destination)
    osc2.start(now + 0.08)
    osc2.stop(now + 0.5)

    // Note 3 (E6 - 1318.51Hz - Harmonic sparkle)
    const osc3 = audioCtx.createOscillator()
    const gain3 = audioCtx.createGain()
    osc3.type = 'triangle'
    osc3.frequency.setValueAtTime(1318.51, now + 0.16)
    gain3.gain.setValueAtTime(0.1, now + 0.16)
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
    osc3.connect(gain3)
    gain3.connect(audioCtx.destination)
    osc3.start(now + 0.16)
    osc3.stop(now + 0.6)
  } catch {
    // Graceful silent fallback
  }
}
