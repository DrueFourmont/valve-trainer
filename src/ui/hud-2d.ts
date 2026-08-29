import { type Hud, type StepView, trackerText } from './hud'

/**
 * The touch and mouse HUD. A bar pinned to the bottom, padded clear of the
 * iPad home indicator.
 *
 * The bar does not take pointer events. Dragging across it still orbits the
 * scene, which matters because on a phone sized viewport the bar covers a real
 * share of the screen and a dead strip along the bottom would feel broken.
 */
export function createHud2d(): Hud {
  const bar = document.createElement('div')
  bar.className = 'hud-bar'

  const tracker = document.createElement('div')
  tracker.className = 'hud-tracker'
  bar.appendChild(tracker)

  const text = document.createElement('div')
  text.className = 'hud-text'

  const label = document.createElement('div')
  label.className = 'hud-label'
  text.appendChild(label)

  const hint = document.createElement('div')
  hint.className = 'hud-hint'
  text.appendChild(hint)

  bar.appendChild(text)
  document.body.appendChild(bar)

  return {
    update(view: StepView | null): void {
      if (!view) {
        bar.hidden = true
        return
      }
      bar.hidden = false
      tracker.textContent = trackerText(view)
      label.textContent = view.label
      hint.textContent = view.hint
    },
  }
}
