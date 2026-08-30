/**
 * First run guidance. Two lines, shown once, gone the moment the student does
 * anything. It is not a tutorial and it does not gate the scene: a card that
 * has to be clicked away is a card that gets clicked away unread.
 *
 * The three variants exist because the controls genuinely differ. Telling a
 * tablet user to click, or a headset user to drag, is worse than saying nothing.
 */

export type OnboardingKind = 'desktop' | 'touch' | 'vr'

/** Exactly two lines each. The second line always covers the thing people get
 *  wrong: that a mistake is recorded rather than prevented. */
export const ONBOARDING: Record<OnboardingKind, readonly [string, string]> = {
  desktop: [
    'Drag to look around the skid. Click a handle to operate it.',
    'Work through the four steps below. A wrong move is recorded, not blocked.',
  ],
  touch: [
    'Drag to look around. Press a handle, then lift your finger to operate it.',
    'Slide off before lifting to cancel. A wrong move is recorded, not blocked.',
  ],
  // Deliberately terser than the flat modes. This is set large enough to read
  // at 1.6 m in a headset, and every extra word costs type size.
  vr: [
    'Point at a handle. Pull the trigger.',
    'Left stick moves. Right stick turns.',
  ],
}

/** Kept free of browser lookups so the choice can be tested directly. */
export function onboardingFor(mode: 'vr' | '2d', coarsePointer: boolean): OnboardingKind {
  if (mode === 'vr') return 'vr'
  return coarsePointer ? 'touch' : 'desktop'
}

export function hasCoarsePointer(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches ?? false
}

export interface Onboarding {
  dismiss(): void
}

/** The 2D card. VR gets a world space panel instead, see scene/world-panel. */
export function showOnboarding(kind: Exclude<OnboardingKind, 'vr'>): Onboarding {
  const card = document.createElement('div')
  card.className = 'onboarding'

  for (const line of ONBOARDING[kind]) {
    const row = document.createElement('p')
    row.className = 'onboarding-line'
    row.textContent = line
    card.appendChild(row)
  }

  document.body.appendChild(card)

  let gone = false
  return {
    dismiss(): void {
      if (gone) return
      gone = true
      card.classList.add('onboarding-gone')
      window.setTimeout(() => card.remove(), 260)
    },
  }
}
