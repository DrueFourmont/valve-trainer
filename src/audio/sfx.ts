/**
 * Placeholder sounds built from oscillators, so there are no asset files to
 * ship or license yet. Phase 7 can swap these for recordings.
 *
 * The context is created lazily because browsers only allow audio to start
 * after a user gesture, and every one of these plays in response to one.
 */

let context: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    return context
  } catch {
    return null
  }
}

interface ToneOptions {
  type: OscillatorType
  frequency: number
  /** Optional glide target, for the falling note in the buzzer. */
  endFrequency?: number
  durationMs: number
  gain: number
  startOffsetMs?: number
}

function tone(options: ToneOptions): void {
  const ctx = audio()
  if (!ctx) return

  const start = ctx.currentTime + (options.startOffsetMs ?? 0) / 1000
  const end = start + options.durationMs / 1000

  const oscillator = ctx.createOscillator()
  oscillator.type = options.type
  oscillator.frequency.setValueAtTime(options.frequency, start)
  if (options.endFrequency !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, end)
  }

  const envelope = ctx.createGain()
  // Short attack then exponential decay. A hard start or stop clicks audibly.
  envelope.gain.setValueAtTime(0.0001, start)
  envelope.gain.exponentialRampToValueAtTime(options.gain, start + 0.008)
  envelope.gain.exponentialRampToValueAtTime(0.0001, end)

  oscillator.connect(envelope).connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(end + 0.02)
}

/** Correct action. A short mechanical tick, like a valve seating. */
export function playClick(): void {
  tone({ type: 'triangle', frequency: 880, durationMs: 70, gain: 0.18 })
  tone({ type: 'square', frequency: 220, durationMs: 45, gain: 0.06 })
}

/** Wrong action. Low and unpleasant, falling so it reads as a fault. */
export function playBuzzer(): void {
  tone({ type: 'sawtooth', frequency: 165, endFrequency: 98, durationMs: 300, gain: 0.16 })
}

/** Procedure complete. Rising third, brief, not a fanfare. */
export function playSuccess(): void {
  tone({ type: 'triangle', frequency: 587, durationMs: 140, gain: 0.15 })
  tone({ type: 'triangle', frequency: 880, durationMs: 260, gain: 0.15, startOffsetMs: 120 })
}
